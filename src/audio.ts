// ============ Audio Recording ============

import { dbg } from './debug';
import {
  isListening,
  setIsListening,
  recordingCancelled,
  setRecordingCancelled,
  savePendingVoiceMessage,
  clearPendingVoiceMessage,
} from './state';
import { setButtonState, showError } from './ui';
import { sendAudioToAPI } from './api';

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioStream: MediaStream | null = null;

export async function startRecording(): Promise<void> {
  try {
    audioChunks = [];

    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      dbg('mediaDevices API not available', 'error');
      showError('Browser does not support audio recording');
      return;
    }

    // Enumerate devices first to check what's available
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      dbg(`Available audio inputs: ${audioInputs.length}`);

      if (audioInputs.length === 0) {
        showError('No microphone found. Check browser permissions.');
        setButtonState('ready');
        return;
      }
    } catch (enumError) {
      dbg(`Could not enumerate devices: ${enumError}`, 'warn');
    }

    // Try with explicit constraints - helps with some Brave configurations
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };
    audioStream = await navigator.mediaDevices.getUserMedia(constraints);

    // iOS Safari: unlock audio context and speech synthesis on user gesture
    if (!window.audioUnlocked) {
      // Unlock Web Audio API
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const buffer = audioCtx.createBuffer(1, 1, 22050);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);

      // Also unlock speechSynthesis with a space character (empty string doesn't work on iOS)
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

    mediaRecorder = new MediaRecorder(audioStream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      audioStream?.getTracks().forEach((track) => track.stop());
      audioStream = null;

      // If cancelled, don't process the audio
      if (recordingCancelled) {
        setRecordingCancelled(false);
        setButtonState('ready');
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: mimeType });

      try {
        const wavBlob = await convertToWav(audioBlob);
        const base64Audio = await blobToBase64(wavBlob);
        // Save before upload in case of page refresh
        savePendingVoiceMessage(base64Audio);
        await sendAudioToAPI(base64Audio);
        // Clear on success
        clearPendingVoiceMessage();
      } catch (e) {
        dbg(`Audio conversion error: ${e}`, 'error');
        showError('Failed to process audio');
        setButtonState('ready');
      }
    };

    mediaRecorder.start();
    setIsListening(true);
    setButtonState('listening');
    dbg('Recording started');
  } catch (error) {
    dbg(`Microphone error: ${error}`, 'error');
    showError('Microphone access denied');
    setButtonState('ready');
  }
}

export function stopRecording(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    dbg('Recording stopped');
  }
  setIsListening(false);
  setButtonState('processing');
}

export function cancelRecording(): void {
  setRecordingCancelled(true);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  setIsListening(false);
  dbg('Recording cancelled');
}

export function getIsListening(): boolean {
  return isListening;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]!);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function convertToWav(audioBlob: Blob): Promise<Blob> {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Downsample to 16kHz for speech (Gemini downsamples anyway, saves bandwidth)
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
  // If already at or below target rate, just return mono version
  if (audioBuffer.sampleRate <= targetSampleRate) {
    return audioBuffer;
  }

  // Create offline context at target sample rate
  const numSamples = Math.round(audioBuffer.duration * targetSampleRate);
  const offlineContext = new OfflineAudioContext(1, numSamples, targetSampleRate);

  // Create buffer source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  // Render resampled audio
  return await offlineContext.startRendering();
}

function audioBufferToWav(buffer: AudioBuffer, targetSampleRate?: number): ArrayBuffer {
  const sampleRate = targetSampleRate || buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const numChannels = 1; // Always mono for speech

  // Get mono audio data (mix down if stereo)
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
