// Main entry point for Spraff

import './debug';
import { state, getPendingVoiceMessage, clearPendingVoiceMessage } from './state';
import { dbg } from './debug';
import {
  showLoginScreen,
  showVoiceScreen,
  setButtonState,
  showError,
  updateModeUI,
  updateVoiceSummary,
} from './ui';
import { handleOAuthCallback } from './oauth';
import { setupEventListeners, setupPWAInstall } from './events';
import { sendAudioToAPI } from './api';
import { isMobile } from './state';

// Temporarily disable service worker for debugging
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => reg.unregister());
  });
}

// Log version
console.log('Spraff - Vite + TypeScript build');
dbg('app loaded - Vite build');

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

// ============ Pending Voice Message Recovery ============
async function checkPendingVoiceMessage(): Promise<void> {
  if (!state.apiKey) return;
  // Don't retry if we're already doing something
  if (state.isListening || state.isSpeaking || state.isProcessingText) return;

  const pendingAudio = getPendingVoiceMessage();
  if (pendingAudio) {
    const sizeKB = Math.round((pendingAudio.length * 0.75) / 1024);
    // Auto-retry the upload
    setButtonState('processing');
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = `Retrying ${sizeKB} KB`;

    try {
      await sendAudioToAPI(pendingAudio);
      clearPendingVoiceMessage();
    } catch (e) {
      console.error('Failed to retry pending voice message:', e);
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

// ============ Initialization ============
function init(): void {
  dbg('init() called');
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    handleOAuthCallback(code);
    return;
  }

  if (state.apiKey) {
    showVoiceScreen();
  } else {
    showLoginScreen();
  }

  updateModeUI();
  setupEventListeners();
  setupPWAInstall();
  lockOrientation();
  checkPendingVoiceMessage();
  updateVoiceSummary();
}

// ============ Start ============
init();
