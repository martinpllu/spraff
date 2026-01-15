// ============ Main Entry Point ============

import './style.css';

import { dbg, initDebug } from './debug';
import { BUILD_ID } from './build-id';
import {
  apiKey,
  isListening,
  isSpeaking,
  isProcessingText,
  getPendingVoiceMessage,
  clearPendingVoiceMessage,
  isMobile,
} from './state';
import {
  showLoginScreen,
  showVoiceScreen,
  showError,
  setButtonState,
  updateModeUI,
  updateVoiceSummary,
} from './ui';
import { statusText } from './dom';
import { handleOAuthCallback } from './oauth';
import { setupEventListeners } from './events';
import { sendAudioToAPI } from './api';

// ============ Initialization ============

function init(): void {
  dbg(`Spraff starting (build: ${BUILD_ID})`);

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    handleOAuthCallback(code);
    return;
  }

  if (apiKey) {
    showVoiceScreen();
  } else {
    showLoginScreen();
  }

  updateModeUI();
  setupEventListeners();
  lockOrientation();
  checkPendingVoiceMessage();
  updateVoiceSummary();
}

// ============ Pending Voice Message Recovery ============

async function checkPendingVoiceMessage(): Promise<void> {
  if (!apiKey) return;
  // Don't retry if we're already doing something
  if (isListening || isSpeaking || isProcessingText) return;

  const pendingAudio = getPendingVoiceMessage();
  if (pendingAudio) {
    const sizeKB = Math.round((pendingAudio.length * 0.75) / 1024);
    dbg(`Found pending voice message: ${sizeKB} KB`);
    // Auto-retry the upload
    setButtonState('processing');
    statusText.textContent = `Retrying ${sizeKB} KB`;

    try {
      await sendAudioToAPI(pendingAudio);
      clearPendingVoiceMessage();
    } catch (e) {
      dbg(`Failed to retry pending voice message: ${e}`, 'error');
      showError('Failed to send saved voice message');
      setButtonState('ready');
    }
  }
}

// Retry pending audio when app returns to foreground (PWA support)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkPendingVoiceMessage();
  }
});

// ============ Orientation Lock ============

function lockOrientation(): void {
  // Only attempt on mobile devices
  if (!isMobile) return;

  // Try Screen Orientation API (works in some PWA contexts)
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('portrait').catch(() => {
      // Silently fail - CSS fallback will handle it
    });
  }
}

// ============ Service Worker Registration ============

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Silently fail
  });
}

// ============ Build ID Display ============

function displayBuildId(): void {
  const buildIdEl = document.getElementById('buildId');
  if (buildIdEl) {
    buildIdEl.textContent = `Build: ${BUILD_ID}`;
  }
}

// ============ Start ============

initDebug();
init();
displayBuildId();
