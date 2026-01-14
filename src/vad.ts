// Voice Activity Detection (VAD) and continuous mode

import { state } from './state';
import { elements } from './dom';
import { setButtonState, showError, updateBleedStatus } from './ui';
import { dbg } from './debug';
import { cancelRecording, startRecording, blobToBase64, float32ToWav } from './audio';
import { stopSpeaking } from './speech';
import {
  SPEECH_END_BUFFER_MS,
  BLEED_DETECTION_WINDOW_MS,
  VERY_SHORT_UTTERANCE_MS,
  MEDIUM_UTTERANCE_MS,
  VERY_SHORT_WAIT_MS,
  MEDIUM_WAIT_MS,
  LONG_WAIT_MS,
} from './config';
import { isVADLoaded, isVADAvailable, loadVADLibrary, VAD_DOWNLOAD_SIZE_MB } from './vad-loader';
import type { VADInstance, VADOptions } from './types';

// ============ VAD Initialization ============
export async function initializeVAD(): Promise<VADInstance | null> {
  if (state.vadInstance) return state.vadInstance;

  // Check if VAD library scripts are loaded (they're loaded on-demand)
  if (!isVADAvailable()) {
    console.log('VAD library not yet loaded');
    return null;
  }

  try {
    // Collect audio frames ourselves to handle misfires
    let collectedFrames: Float32Array[] = [];
    let isCollectingSpeech = false;
    let speechStartTime = 0;
    let pendingAudio: Float32Array | null = null;
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

    function processPendingAudio(): void {
      if (pendingAudio && state.isListening && state.continuousModeActive) {
        console.log('VAD: Processing pending audio after pause');
        stopContinuousModeRecording(pendingAudio);
      }
      pendingAudio = null;
      pendingTimeout = null;
    }

    function cancelPendingAudio(): void {
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
      // Keep pendingAudio in case we need to combine it with new speech
    }

    const vadOptions: VADOptions = {
      positiveSpeechThreshold: 0.5,
      negativeSpeechThreshold: 0.15,
      redemptionFrames: 8,
      minSpeechFrames: 1,
      preSpeechPadFrames: 5,
      submitUserSpeechOnPause: false,

      onFrameProcessed: (_probs, frame) => {
        // Collect frames while we think there's speech
        if (isCollectingSpeech) {
          collectedFrames.push(new Float32Array(frame));
        }
      },

      onSpeechStart: () => {
        console.log('VAD: Speech start detected');

        // FIRST: Check for mic bleed during detection window
        if (state.isDetectingBleed) {
          console.log('VAD: Mic bleed detected during TTS');
          dbg('BLEED RESULT: YES BLEED - interruption OFF');
          state.micBleedDetected = true;
          state.interruptionEnabled = false;
          state.isDetectingBleed = false;
          updateBleedStatus();
          // Don't collect frames or take any action - this is just speaker bleed
          return;
        }

        // Now we know this is real user speech, not bleed
        isCollectingSpeech = true;
        collectedFrames = [];

        // Cancel any pending send - user is speaking again
        cancelPendingAudio();

        // Abort any in-flight API request - user is speaking more
        if (state.currentRequestController) {
          console.log('VAD: Aborting in-flight API request - user speaking');
          dbg('Aborting API request - more speech');
          state.currentRequestController.abort();
          state.currentRequestController = null;
        }

        // Stop any TTS that might be playing (user is interrupting)
        if (state.isSpeaking) {
          console.log('VAD: Stopping TTS - user interrupting');
          stopSpeaking();
        }

        // Handle interruption if enabled and speaking
        if (state.interruptionEnabled && state.isSpeaking && !state.isListening) {
          console.log('VAD: User interruption detected');
          stopSpeaking();
          startRecording();
          isCollectingSpeech = false;
          return;
        }

        if (state.vadSuppressed || state.isSpeaking || !state.continuousModeActive) {
          isCollectingSpeech = false;
          return;
        }

        // If we had pending audio from a previous segment, we're continuing
        if (pendingAudio) {
          console.log('VAD: Continuing speech after pause');
          pendingAudio = null; // Will be combined when this segment ends
        } else {
          speechStartTime = Date.now();
        }

        startContinuousModeRecording();
      },

      onSpeechEnd: (audio) => {
        console.log('VAD: Speech end detected');
        isCollectingSpeech = false;

        if (state.vadSuppressed || state.isSpeaking || !state.continuousModeActive) {
          collectedFrames = [];
          return;
        }
        if (!state.isListening) {
          collectedFrames = [];
          return;
        }

        // Combine with any pending audio from previous segments
        let finalAudio = audio;
        if (pendingAudio) {
          const combined = new Float32Array(pendingAudio.length + audio.length);
          combined.set(pendingAudio, 0);
          combined.set(audio, pendingAudio.length);
          finalAudio = combined;
          console.log(
            'VAD: Combined audio segments, total length:',
            finalAudio.length
          );
        }

        const speechDuration = Date.now() - speechStartTime;
        console.log('VAD: Speech duration:', speechDuration, 'ms');

        // Adaptive wait time based on utterance length
        let waitTime: number;
        if (speechDuration < VERY_SHORT_UTTERANCE_MS) {
          waitTime = VERY_SHORT_WAIT_MS;
          console.log('VAD: Very short utterance, waiting', waitTime, 'ms');
        } else if (speechDuration < MEDIUM_UTTERANCE_MS) {
          waitTime = MEDIUM_WAIT_MS;
          console.log('VAD: Medium utterance, waiting', waitTime, 'ms');
        } else {
          waitTime = LONG_WAIT_MS;
          console.log('VAD: Long utterance, waiting', waitTime, 'ms');
        }

        pendingAudio = finalAudio;
        collectedFrames = [];
        pendingTimeout = setTimeout(processPendingAudio, waitTime);
      },

      onVADMisfire: () => {
        console.log('VAD: Misfire - using collected frames instead');
        dbg('VAD MISFIRE - using ' + collectedFrames.length + ' frames');
        isCollectingSpeech = false;

        // Use our collected frames instead of discarding
        if (
          collectedFrames.length > 0 &&
          state.isListening &&
          state.continuousModeActive
        ) {
          // Concatenate all frames into one Float32Array
          const totalLength = collectedFrames.reduce(
            (sum, f) => sum + f.length,
            0
          );
          const combinedAudio = new Float32Array(totalLength);
          let offset = 0;
          for (const frame of collectedFrames) {
            combinedAudio.set(frame, offset);
            offset += frame.length;
          }
          console.log(
            'VAD: Processing misfire audio, length:',
            combinedAudio.length
          );
          // Treat misfire same as short utterance - send immediately
          stopContinuousModeRecording(combinedAudio);
        }
        collectedFrames = [];
      },
    };

    state.vadInstance = await vad.MicVAD.new(vadOptions);

    // VAD initialized successfully means mic permission was granted
    state.micPermissionGranted = true;
    console.log('VAD initialized, mic permission granted');
    dbg('MIC GRANTED via VAD init');
    return state.vadInstance;
  } catch (error) {
    console.error('Failed to initialize VAD:', error);
    showError('Voice detection failed to initialize');
    return null;
  }
}

// ============ Bleed Detection ============
export async function startBleedDetection(): Promise<void> {
  if (state.micBleedDetected !== null) {
    console.log('Bleed detection: already tested');
    return;
  }

  // Can't run bleed detection until mic permission has been granted
  console.log(
    'startBleedDetection: micPermissionGranted =',
    state.micPermissionGranted
  );
  dbg('BLEED CHECK: micPermissionGranted=' + state.micPermissionGranted);
  if (!state.micPermissionGranted) {
    console.log('Bleed detection skipped - mic permission not yet granted');
    dbg('BLEED SKIPPED - no mic');
    updateBleedStatus('no-mic');
    return;
  }

  // Initialize VAD if needed (for bleed detection even outside continuous mode)
  if (!state.vadInstance) {
    updateBleedStatus('init-vad');
    const vadReady = await initializeVAD();
    if (!vadReady) {
      console.log('Could not initialize VAD for bleed detection');
      updateBleedStatus('vad-failed');
      return;
    }
  }

  console.log('Starting mic bleed detection...');
  dbg('BLEED DETECTING...');
  state.isDetectingBleed = true;
  updateBleedStatus('detecting');
  state.vadInstance!.start();

  // After detection window, if no bleed detected, enable interruption
  setTimeout(() => {
    if (state.isDetectingBleed) {
      // No bleed detected during window
      state.isDetectingBleed = false;
      state.micBleedDetected = false;
      state.interruptionEnabled = true;
      console.log('No mic bleed detected - interruption enabled');
      dbg('BLEED RESULT: NO BLEED - interruption ON');
      updateBleedStatus();
    }
    // Keep VAD running for interruption if enabled, otherwise pause
    if (!state.interruptionEnabled && !state.continuousModeActive) {
      state.vadInstance!.pause();
    }
  }, BLEED_DETECTION_WINDOW_MS);
}

// ============ Continuous Mode Recording ============
function startContinuousModeRecording(): void {
  if (state.isListening) return;
  state.audioChunks = [];
  state.isListening = true;
  setButtonState('continuous-listening');
}

async function stopContinuousModeRecording(vadAudio: Float32Array): Promise<void> {
  if (!state.isListening) return;
  state.isListening = false;
  setButtonState('processing');

  // Suppress VAD before processing (will resume after TTS)
  suppressVAD();

  try {
    // Convert VAD Float32Array (16kHz) to WAV
    const wavBlob = float32ToWav(vadAudio, 16000);
    const base64Audio = await blobToBase64(wavBlob);

    // Import API and state functions dynamically
    const { sendAudioToAPI } = await import('./api');
    const { savePendingVoiceMessage, clearPendingVoiceMessage } = await import(
      './state'
    );

    savePendingVoiceMessage(base64Audio);
    await sendAudioToAPI(base64Audio);
    clearPendingVoiceMessage();
  } catch (error) {
    console.error('Continuous mode processing error:', error);
    showError('Failed to process speech');
    // Quick resume on error
    resumeVADAfterDelay(100);
  }
}

// ============ VAD Control ============
export function suppressVAD(): void {
  if (!state.vadInstance || state.vadSuppressed) return;
  state.vadSuppressed = true;
  state.vadInstance.pause();
  console.log('VAD: Suppressed');
}

export function resumeVAD(): void {
  if (!state.vadInstance || !state.vadSuppressed || !state.continuousModeActive)
    return;
  state.vadSuppressed = false;
  state.vadInstance.start();
  setButtonState('continuous-ready');
  console.log('VAD: Resumed');
}

export function resumeVADAfterDelay(delayMs: number = SPEECH_END_BUFFER_MS): void {
  setTimeout(() => {
    if (state.continuousModeActive && !state.isSpeaking) {
      resumeVAD();
    }
  }, delayMs);
}

// ============ VAD Download Dialog ============
function showVADDownloadDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    // Update size display
    elements.vadDownloadSize.textContent = `~${VAD_DOWNLOAD_SIZE_MB} MB`;

    // Reset dialog state
    elements.vadDownloadProgress.classList.add('hidden');
    elements.vadDownloadActions.classList.remove('hidden');
    elements.vadDownloadConfirm.disabled = false;

    // Show modal
    elements.vadDownloadModal.classList.remove('hidden');

    // Handle confirm
    const handleConfirm = (): void => {
      cleanup();
      resolve(true);
    };

    // Handle cancel
    const handleCancel = (): void => {
      cleanup();
      elements.vadDownloadModal.classList.add('hidden');
      resolve(false);
    };

    // Cleanup listeners
    const cleanup = (): void => {
      elements.vadDownloadConfirm.removeEventListener('click', handleConfirm);
      elements.vadDownloadCancel.removeEventListener('click', handleCancel);
      elements.vadDownloadModalClose.removeEventListener('click', handleCancel);
    };

    elements.vadDownloadConfirm.addEventListener('click', handleConfirm);
    elements.vadDownloadCancel.addEventListener('click', handleCancel);
    elements.vadDownloadModalClose.addEventListener('click', handleCancel);
  });
}

function updateDownloadProgress(stage: string): void {
  elements.vadDownloadStatus.textContent = stage;
}

// ============ Continuous Mode Control ============
export async function enterContinuousMode(): Promise<void> {
  // Update toggle UI immediately for responsive feel
  elements.continuousToggle.classList.add('active');

  // Cancel any current recording
  if (state.isListening) {
    cancelRecording();
  }

  // Stop any current speech
  if (state.isSpeaking) {
    stopSpeaking();
  }

  // Check if VAD library needs to be loaded
  if (!isVADAvailable()) {
    // First time ever - show confirmation dialog
    if (!isVADLoaded()) {
      const confirmed = await showVADDownloadDialog();
      if (!confirmed) {
        // Revert toggle if user cancels
        elements.continuousToggle.classList.remove('active');
        return;
      }

      // User confirmed - start download with progress UI
      try {
        elements.vadDownloadActions.classList.add('hidden');
        elements.vadDownloadProgress.classList.remove('hidden');
        elements.vadDownloadConfirm.disabled = true;

        await loadVADLibrary(updateDownloadProgress);

        // Hide modal on success
        elements.vadDownloadModal.classList.add('hidden');
      } catch (error) {
        console.error('Failed to load VAD library:', error);
        elements.vadDownloadModal.classList.add('hidden');
        elements.continuousToggle.classList.remove('active');
        showError('Failed to download voice detection model');
        return;
      }
    } else {
      // Previously downloaded - load silently from cache
      try {
        await loadVADLibrary();
      } catch (error) {
        console.error('Failed to load VAD library:', error);
        elements.continuousToggle.classList.remove('active');
        showError('Failed to load voice detection');
        return;
      }
    }
  }

  // Initialize VAD if needed
  const vadReady = await initializeVAD();
  if (!vadReady) {
    elements.continuousToggle.classList.remove('active');
    showError('Could not start continuous mode');
    return;
  }

  state.continuousModeActive = true;
  state.vadSuppressed = false;
  setButtonState('continuous-ready');
  state.vadInstance!.start();

  // Update main button UI
  elements.mainButton.classList.add('continuous-mode');
}

export function exitContinuousMode(): void {
  if (!state.continuousModeActive) return;

  state.continuousModeActive = false;

  // Stop VAD
  if (state.vadInstance) {
    state.vadInstance.pause();
    state.vadSuppressed = true;
  }

  // Cancel any ongoing recording
  if (state.isListening) {
    cancelRecording();
  }

  // Clear any pending utterance continuation
  state.pendingUtteranceTranscript = null;
  state.waitingForContinuation = false;

  // Update UI
  elements.mainButton.classList.remove('continuous-mode');
  elements.continuousToggle.classList.remove('active', 'listening');
  setButtonState('ready');
}
