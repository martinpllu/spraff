// ============ Main Entry Point ============

import './style.css';

import { render } from 'preact';
import { App } from './components/App';
import { dbg, initDebug } from './debug';
import { BUILD_ID } from './build-id';
import { isMobile, apiKey, buttonState, isListening, isSpeaking, isProcessingText } from './state/signals';
import { getPendingVoiceMessage, clearPendingVoiceMessage } from './state/signals';
import { sendAudioToAPI } from './api';

// ============ Initialization ============

function init(): void {
  dbg(`Spraff starting (build: ${BUILD_ID})`);
  lockOrientation();
  checkPendingVoiceMessage();
}

// ============ Pending Voice Message Recovery ============

async function checkPendingVoiceMessage(): Promise<void> {
  if (!apiKey.value) return;
  // Don't retry if we're already doing something
  if (isListening.value || isSpeaking.value || isProcessingText.value) return;

  const pendingAudio = getPendingVoiceMessage();
  if (pendingAudio) {
    const sizeKB = Math.round((pendingAudio.length * 0.75) / 1024);
    dbg(`Found pending voice message: ${sizeKB} KB`);
    // Auto-retry the upload
    buttonState.value = 'processing';

    try {
      await sendAudioToAPI(pendingAudio);
      clearPendingVoiceMessage();
    } catch (e) {
      dbg(`Failed to retry pending voice message: ${e}`, 'error');
      buttonState.value = 'ready';
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

// ============ Start ============

initDebug();
init();

// Mount Preact app
const appRoot = document.getElementById('app');
if (appRoot) {
  render(<App />, appRoot);
}
