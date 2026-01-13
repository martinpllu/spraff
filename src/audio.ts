// Audio recording and processing

import { state } from './state';
import { setButtonState, showError } from './ui';
import { dbg } from './debug';

// ============ Recording Functions ============
export async function startRecording(): Promise<void> {
  dbg('startRecording CALLED');
  try {
    state.audioChunks = [];

    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('mediaDevices API not available');
      showError('Browser does not support audio recording');
      return;
    }

    // Enumerate devices first to check what's available
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      console.log('Available audio inputs:', audioInputs);

      if (audioInputs.length === 0) {
        showError('No microphone found. Check browser permissions.');
        setButtonState('ready');
        return;
      }
    } catch (enumError) {
      console.warn('Could not enumerate devices:', enumError);
    }

    // Try with explicit constraints - helps with some Brave configurations
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };
    state.audioStream = await navigator.mediaDevices.getUserMedia(constraints);
    state.micPermissionGranted = true;
    console.log('startRecording: mic permission granted');
    dbg('MIC GRANTED via startRecording');

    // iOS Safari: unlock audio context and speech synthesis on user gesture
    if (!window.audioUnlocked) {
      // Unlock Web Audio API
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
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

    state.mediaRecorder = new MediaRecorder(state.audioStream, { mimeType });

    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) state.audioChunks.push(event.data);
    };

    state.mediaRecorder.onstop = async () => {
      if (state.audioStream) {
        state.audioStream.getTracks().forEach((track) => track.stop());
        state.audioStream = null;
      }

      // If cancelled, don't process the audio
      if (state.recordingCancelled) {
        state.recordingCancelled = false;
        setButtonState('ready');
        return;
      }

      const audioBlob = new Blob(state.audioChunks, { type: mimeType });

      try {
        const wavBlob = await convertToWav(audioBlob);
        const base64Audio = await blobToBase64(wavBlob);
        // Import API function dynamically to avoid circular dependency
        const { sendAudioToAPI } = await import('./api');
        const { savePendingVoiceMessage, clearPendingVoiceMessage } = await import('./state');
        // Save before upload in case of page refresh
        savePendingVoiceMessage(base64Audio);
        await sendAudioToAPI(base64Audio);
        // Clear on success
        clearPendingVoiceMessage();
      } catch (e) {
        console.error('Audio conversion error:', e);
        showError('Failed to process audio');
        setButtonState('ready');
      }
    };

    state.mediaRecorder.start();
    state.isListening = true;
    setButtonState('listening');
  } catch (error) {
    console.error('Microphone error:', error);
    showError('Microphone access denied');
    setButtonState('ready');
  }
}

export function stopRecording(): void {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  state.isListening = false;
  setButtonState('processing');
}

export function cancelRecording(): void {
  state.recordingCancelled = true;
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  state.isListening = false;
}

// ============ Audio Conversion ============
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function convertToWav(audioBlob: Blob): Promise<Blob> {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Downsample to 16kHz for speech (Gemini downsamples anyway, saves bandwidth)
  const targetSampleRate = 16000;
  const resampledBuffer = await resampleAudio(
    audioContext,
    audioBuffer,
    targetSampleRate
  );

  const wavBuffer = audioBufferToWav(resampledBuffer, targetSampleRate);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

async function resampleAudio(
  audioContext: AudioContext,
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  // If already at or below target rate, just return mono version
  if (audioBuffer.sampleRate <= targetSampleRate) {
    return audioBuffer;
  }

  // Create offline context at target sample rate
  const numSamples = Math.round(audioBuffer.duration * targetSampleRate);
  const offlineContext = new OfflineAudioContext(
    1,
    numSamples,
    targetSampleRate
  );

  // Create buffer source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  // Render resampled audio
  return await offlineContext.startRendering();
}

function audioBufferToWav(
  buffer: AudioBuffer,
  targetSampleRate?: number
): ArrayBuffer {
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
      samples[i] = (left[i] + right[i]) / 2;
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
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      44 + i * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true
    );
  }

  return wavBuffer;
}

export function writeString(
  view: DataView,
  offset: number,
  str: string
): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Convert Float32Array to WAV for VAD output
export function float32ToWav(
  samples: Float32Array,
  sampleRate: number
): Blob {
  const numChannels = 1;
  const bitDepth = 16;
  const dataLength = samples.length * (bitDepth / 8);
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      44 + i * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true
    );
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}
