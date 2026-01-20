// ============ Audio Recording Hook ============

import { useSignal } from '@preact/signals';
import {
  isListening,
  recordingCancelled,
  setButtonState,
  savePendingVoiceMessage,
  clearPendingVoiceMessage,
} from '../state/signals';
import { dbg } from '../debug';

export function useAudio() {
  const mediaRecorder = useSignal<MediaRecorder | null>(null);
  const audioStream = useSignal<MediaStream | null>(null);
  const audioChunks = useSignal<Blob[]>([]);

  async function startRecording(): Promise<void> {
    try {
      audioChunks.value = [];
      recordingCancelled.value = false;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        dbg('mediaDevices API not available', 'error');
        throw new Error('Browser does not support audio recording');
      }

      // Enumerate devices first
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        dbg(`Available audio inputs: ${audioInputs.length}`);

        if (audioInputs.length === 0) {
          throw new Error('No microphone found. Check browser permissions.');
        }
      } catch (enumError) {
        dbg(`Could not enumerate devices: ${enumError}`, 'warn');
      }

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };
      audioStream.value = await navigator.mediaDevices.getUserMedia(constraints);

      // iOS Safari: unlock audio context on user gesture
      if (!window.audioUnlocked) {
        const audioCtx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);

        if (window.speechSynthesis) {
          const unlockUtterance = new SpeechSynthesisUtterance(' ');
          unlockUtterance.volume = 0.01;
          speechSynthesis.speak(unlockUtterance);
        }
        window.audioUnlocked = true;
      }

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }

      const recorder = new MediaRecorder(audioStream.value, { mimeType });
      mediaRecorder.value = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.value = [...audioChunks.value, event.data];
        }
      };

      recorder.start();
      isListening.value = true;
      setButtonState('listening', 'startRecording');
      dbg('Recording started');
    } catch (error) {
      dbg(`Microphone error: ${error}`, 'error');
      setButtonState('ready', 'startRecording-error');
      throw error;
    }
  }

  async function stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const recorder = mediaRecorder.value;
      if (!recorder || recorder.state === 'inactive') {
        isListening.value = false;
        setButtonState('uploading', 'stopRecording-noRecorder');
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        audioStream.value?.getTracks().forEach((track) => track.stop());
        audioStream.value = null;

        if (recordingCancelled.value) {
          recordingCancelled.value = false;
          setButtonState('ready', 'stopRecording-cancelled');
          resolve(null);
          return;
        }

        const mimeType = recorder.mimeType;
        const audioBlob = new Blob(audioChunks.value, { type: mimeType });
        resolve(audioBlob);
      };

      recorder.stop();
      dbg('Recording stopped');
      isListening.value = false;
      setButtonState('uploading', 'stopRecording');
    });
  }

  function cancelRecording(): void {
    recordingCancelled.value = true;
    const recorder = mediaRecorder.value;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    isListening.value = false;
    setButtonState('ready', 'cancelRecording');
    dbg('Recording cancelled');
  }

  return {
    startRecording,
    stopRecording,
    cancelRecording,
    isListening,
  };
}

// Utility functions for audio processing
export async function convertToWav(audioBlob: Blob): Promise<Blob> {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const audioContext = new AudioContextClass();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const targetSampleRate = 16000;
  const resampledBuffer = await resampleAudio(audioContext, audioBuffer, targetSampleRate);

  const wavBuffer = audioBufferToWav(resampledBuffer, targetSampleRate);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

async function resampleAudio(
  _audioContext: AudioContext,
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  if (audioBuffer.sampleRate <= targetSampleRate) {
    return audioBuffer;
  }

  const numSamples = Math.round(audioBuffer.duration * targetSampleRate);
  const offlineContext = new OfflineAudioContext(1, numSamples, targetSampleRate);

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  return await offlineContext.startRendering();
}

function audioBufferToWav(buffer: AudioBuffer, targetSampleRate?: number): ArrayBuffer {
  const sampleRate = targetSampleRate || buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const numChannels = 1;

  let samples: Float32Array;
  if (buffer.numberOfChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    samples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      samples[i] = (left[i]! + right[i]!) / 2;
    }
  } else {
    samples = buffer.getChannelData(0);
  }

  const dataLength = samples.length * (bitDepth / 8);
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return wavBuffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]!);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export { savePendingVoiceMessage, clearPendingVoiceMessage };
