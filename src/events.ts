// Event listeners setup

import { elements } from './dom';
import { state, isMobile, isIOS, isStandalone, clearConversationHistory, clearPendingVoiceMessage, resetStats, saveConversationHistory } from './state';
import { debugLogs } from './debug';
import { setButtonState, showError, setTextMode, updateVoiceSummary } from './ui';
import { startRecording, stopRecording, cancelRecording } from './audio';
import { stopSpeaking, openVoiceSettings, closeVoiceSettings, populateVoiceList, initDefaultVoice, isCloudVoice } from './speech';
import { enterContinuousMode, exitContinuousMode } from './vad';
import { startOAuthFlow, logout } from './oauth';
import { sendTextToAPI } from './api';
import { OPENROUTER_API_URL } from './config';
import { formatFileSize } from './ui';

// PWA Install prompt
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ============ Event Listeners Setup ============
export function setupEventListeners(): void {
  console.log('setupEventListeners START');
  elements.loginBtn.addEventListener('click', startOAuthFlow);
  elements.logoutBtn.addEventListener('click', () => {
    elements.settingsDropdown.classList.remove('open');
    logout();
  });

  // Main button - tap to toggle recording (continuous mode is controlled by toggle)
  function handleButtonTap(): void {
    // In continuous mode, button is disabled (VAD handles listening)
    if (state.continuousModeActive) {
      return;
    }

    // If speaking, tap interrupts and starts recording
    if (state.isSpeaking || state.speechQueue.length > 0) {
      stopSpeaking();
      startRecording();
      return;
    }

    // Toggle recording
    if (state.isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  // Mouse events for desktop
  elements.mainButton.addEventListener('click', handleButtonTap);

  // Touch events for mobile - prevent double-firing
  elements.mainButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleButtonTap();
  });

  // Continuous mode toggle
  elements.continuousToggle.addEventListener('click', async () => {
    if (state.continuousModeActive) {
      exitContinuousMode();
      elements.continuousToggle.classList.remove('active', 'listening');
    } else {
      await enterContinuousMode();
      // Only update UI if continuous mode was actually entered
      if (state.continuousModeActive) {
        elements.continuousToggle.classList.add('active');
      }
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!elements.voiceModal.classList.contains('hidden')) return;
    if (
      e.target instanceof HTMLElement &&
      (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
    )
      return;
    if (!state.apiKey) return;
    if (e.repeat) return; // Ignore key repeat

    // Escape key exits continuous mode
    if (e.code === 'Escape' && state.continuousModeActive) {
      e.preventDefault();
      exitContinuousMode();
      elements.continuousToggle.classList.remove('active', 'listening');
      return;
    }

    // Spacebar toggles recording (not continuous mode)
    if (e.code === 'Space') {
      e.preventDefault();

      // In continuous mode, spacebar does nothing
      if (state.continuousModeActive) {
        return;
      }

      if (state.isSpeaking || state.speechQueue.length > 0) {
        stopSpeaking();
      }

      // Toggle recording
      if (state.isListening) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  });

  // Settings dropdown menu
  elements.settingsMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.settingsDropdown.classList.toggle('open');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (
      !elements.settingsDropdown.contains(e.target as Node) &&
      e.target !== elements.settingsMenuBtn
    ) {
      elements.settingsDropdown.classList.remove('open');
    }
  });

  // Voice settings from dropdown
  elements.voiceSettingsBtn.addEventListener('click', () => {
    elements.settingsDropdown.classList.remove('open');
    openVoiceSettings();
  });

  // Cost settings from dropdown
  elements.costSettingsBtn.addEventListener('click', openCostModal);

  // Copy chat
  elements.copyChatBtn.addEventListener('click', copyChat);

  // Cost modal
  elements.costModalClose.addEventListener('click', closeCostModal);
  elements.costModal.addEventListener('click', (e) => {
    if (e.target === elements.costModal) closeCostModal();
  });

  // About modal
  elements.aboutBtn.addEventListener('click', () => {
    elements.settingsDropdown.classList.remove('open');
    elements.aboutModal.classList.remove('hidden');
  });
  elements.aboutModalClose.addEventListener('click', () => {
    elements.aboutModal.classList.add('hidden');
  });
  elements.aboutModal.addEventListener('click', (e) => {
    if (e.target === elements.aboutModal)
      elements.aboutModal.classList.add('hidden');
  });

  // Privacy modal
  elements.privacyBtn.addEventListener('click', () => {
    elements.settingsDropdown.classList.remove('open');
    elements.privacyModal.classList.remove('hidden');
  });
  elements.privacyModalClose.addEventListener('click', () => {
    elements.privacyModal.classList.add('hidden');
  });
  elements.privacyModal.addEventListener('click', (e) => {
    if (e.target === elements.privacyModal)
      elements.privacyModal.classList.add('hidden');
  });

  // Debug modal
  if (elements.debugBtn && elements.debugModal) {
    elements.debugBtn.addEventListener('click', () => {
      elements.settingsDropdown.classList.remove('open');
      const debugLog = document.getElementById('debugLog');
      if (debugLog) debugLog.textContent = debugLogs.join('\n');
      elements.debugModal.classList.remove('hidden');
    });
    elements.debugModalClose.addEventListener('click', () => {
      elements.debugModal.classList.add('hidden');
    });
    elements.debugModal.addEventListener('click', (e) => {
      if (e.target === elements.debugModal)
        elements.debugModal.classList.add('hidden');
    });
    elements.debugClearBtn.addEventListener('click', () => {
      debugLogs.length = 0;
      const debugLog = document.getElementById('debugLog');
      if (debugLog) debugLog.textContent = '';
    });
  } else {
    console.error('Debug elements not found:', {
      debugBtn: elements.debugBtn,
      debugModal: elements.debugModal,
    });
  }

  // Install app
  elements.installBtn.addEventListener('click', handleInstallClick);
  elements.installModalClose.addEventListener('click', () => {
    elements.installModal.classList.add('hidden');
  });
  elements.installModal.addEventListener('click', (e) => {
    if (e.target === elements.installModal)
      elements.installModal.classList.add('hidden');
  });

  // Stop button
  elements.stopBtn.addEventListener('click', stopSpeaking);

  // Cancel button
  elements.cancelBtn.addEventListener('click', cancelRecording);

  // Voice modal
  elements.modalClose.addEventListener('click', closeVoiceSettings);
  elements.voiceModal.addEventListener('click', (e) => {
    if (e.target === elements.voiceModal) closeVoiceSettings();
  });

  // Cloud voices toggle
  const cloudVoicesToggle = document.getElementById('cloudVoicesToggle') as HTMLInputElement | null;
  if (cloudVoicesToggle) {
    cloudVoicesToggle.addEventListener('change', (e) => {
      state.cloudVoicesEnabled = (e.target as HTMLInputElement).checked;
      localStorage.setItem('cloudVoicesEnabled', String(state.cloudVoicesEnabled));
      // If turning off cloud voices and current selection is a cloud voice, clear it
      if (!state.cloudVoicesEnabled && state.selectedVoiceName) {
        const voices = speechSynthesis.getVoices();
        const currentVoice = voices.find((v) => v.name === state.selectedVoiceName);
        if (currentVoice && isCloudVoice(currentVoice)) {
          state.selectedVoiceName = null;
          localStorage.removeItem('selectedVoice');
        }
      }
      populateVoiceList();
    });
  }

  // Load voices and init default at startup
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
      initDefaultVoice();
      // Update voice list if modal is open
      if (!elements.voiceModal.classList.contains('hidden')) {
        populateVoiceList();
      }
    };
  }
  // Also try immediately in case voices are already loaded
  initDefaultVoice();

  // Mode switching - click anywhere in the toggle container to switch
  elements.modeToggle.addEventListener('click', () => {
    console.log('Mode toggle clicked');
    setTextMode(!state.textMode);
  });
  // Debug: confirm event listener is attached
  console.log('Mode toggle listener attached', elements.modeToggle);

  // Clear chat with inline confirmation
  let clearChatConfirming = false;
  const clearChatText = elements.clearChatBtn.querySelector(
    '.clear-chat-text'
  ) as HTMLElement | null;

  function resetClearConfirmation(): void {
    if (clearChatConfirming && clearChatText) {
      clearChatConfirming = false;
      elements.clearChatBtn.classList.remove('confirming');
      clearChatText.textContent = 'Clear';
    }
  }

  elements.clearChatBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (clearChatConfirming) {
      // Second click - actually clear
      startNewChat();
      resetClearConfirmation();
      elements.clearChatBtn.classList.add('hidden');
    } else {
      // First click - show confirmation
      clearChatConfirming = true;
      elements.clearChatBtn.classList.add('confirming');
      if (clearChatText) clearChatText.textContent = 'Clear?';
    }
  });

  // Click anywhere else to cancel clear confirmation
  document.addEventListener('click', (e) => {
    if (!elements.clearChatBtn.contains(e.target as Node)) {
      resetClearConfirmation();
    }
  });

  // Text input handling
  elements.textInput.addEventListener('input', () => {
    // Auto-resize textarea
    const textInput = elements.textInput as HTMLTextAreaElement;
    textInput.style.height = 'auto';
    textInput.style.height = Math.min(textInput.scrollHeight, 160) + 'px';

    // Update send button state
    elements.textSendBtn.classList.toggle(
      'active',
      textInput.value.trim().length > 0
    );
  });

  elements.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitTextMessage();
    }
  });

  elements.textSendBtn.addEventListener('click', submitTextMessage);

  function submitTextMessage(): void {
    const textInput = elements.textInput as HTMLTextAreaElement;
    const text = textInput.value.trim();
    if (text && !state.isProcessingText) {
      textInput.value = '';
      textInput.style.height = 'auto';
      elements.textSendBtn.classList.remove('active');
      textInput.blur(); // Hide keyboard on mobile
      sendTextToAPI(text);
    }
  }

  // Mobile keyboard handling - keep input above virtual keyboard
  if (window.visualViewport) {
    function adjustForKeyboard(): void {
      const viewport = window.visualViewport!;
      const keyboardHeight =
        window.innerHeight - viewport.height - viewport.offsetTop;

      if (keyboardHeight > 100) {
        // Keyboard is open
        elements.textInputContainer.style.bottom = keyboardHeight + 12 + 'px';
      } else {
        // Keyboard is closed
        elements.textInputContainer.style.bottom = '';
      }
    }

    window.visualViewport.addEventListener('resize', adjustForKeyboard);
    window.visualViewport.addEventListener('scroll', adjustForKeyboard);
  }

  // Mobile swipe gestures for mode switching
  if (isMobile) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let swipeTracking = false;

    function handleTouchStart(e: TouchEvent): void {
      // Don't interfere with input fields, modals, or settings
      if (
        (e.target as HTMLElement).closest(
          '.text-input-container, .modal, .settings-dropdown'
        )
      )
        return;

      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      swipeTracking = true;
    }

    function handleTouchEnd(e: TouchEvent): void {
      if (!swipeTracking) return;
      swipeTracking = false;

      // Don't interfere with input fields, modals, or settings
      if (
        (e.target as HTMLElement).closest(
          '.text-input-container, .modal, .settings-dropdown'
        )
      )
        return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const elapsed = Date.now() - touchStartTime;

      // Require: horizontal swipe > 80px, much more horizontal than vertical, completed in < 300ms
      const minSwipeDistance = 80;
      const maxSwipeTime = 300;

      if (
        Math.abs(deltaX) > minSwipeDistance &&
        Math.abs(deltaX) > Math.abs(deltaY) * 2 &&
        elapsed < maxSwipeTime
      ) {
        if (deltaX < 0 && !state.textMode) {
          // Swipe left → text mode
          setTextMode(true);
        } else if (deltaX > 0 && state.textMode) {
          // Swipe right → voice mode
          setTextMode(false);
        }
      }
    }

    // Attach to both voiceScreen and conversationHistory (which is position:fixed overlay)
    elements.voiceScreen.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    elements.voiceScreen.addEventListener('touchend', handleTouchEnd, {
      passive: true,
    });
    elements.conversationHistoryEl.addEventListener(
      'touchstart',
      handleTouchStart,
      { passive: true }
    );
    elements.conversationHistoryEl.addEventListener(
      'touchend',
      handleTouchEnd,
      { passive: true }
    );
  }
  console.log('setupEventListeners END');
}

// ============ PWA Install ============
export function setupPWAInstall(): void {
  if (!isStandalone) {
    // Capture the install prompt (Chrome/Brave/Edge on desktop and Android)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e as BeforeInstallPromptEvent;
      elements.installBtn.classList.remove('hidden');
    });

    // Show install button on iOS Safari (no beforeinstallprompt event)
    if (isMobile && isIOS) {
      elements.installBtn.classList.remove('hidden');
    }

    // Hide install button if app gets installed
    window.addEventListener('appinstalled', () => {
      elements.installBtn.classList.add('hidden');
      deferredInstallPrompt = null;
    });
  }
}

function handleInstallClick(): void {
  elements.settingsDropdown.classList.remove('open');

  if (deferredInstallPrompt) {
    // Trigger native install prompt
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((result) => {
      if (result.outcome === 'accepted') {
        elements.installBtn.classList.add('hidden');
      }
      deferredInstallPrompt = null;
    });
  } else if (isMobile && isIOS) {
    // iOS Safari - show instructions modal
    elements.installModal.classList.remove('hidden');
  }
}

// ============ Cost Modal ============
async function openCostModal(): Promise<void> {
  elements.settingsDropdown.classList.remove('open');
  elements.costModal.classList.remove('hidden');

  // Update session stats
  elements.costLast.textContent =
    state.stats.lastCost > 0
      ? `$${state.stats.lastCost.toFixed(5)}`
      : '—';
  elements.costSession.textContent = `$${state.stats.sessionCost.toFixed(5)}`;

  // Show voice size if we have one
  if (state.stats.lastVoiceSize > 0) {
    elements.voiceSizeStat.style.display = '';
    elements.costVoiceSize.textContent = formatFileSize(
      state.stats.lastVoiceSize
    );
  } else {
    elements.voiceSizeStat.style.display = 'none';
  }

  // Fetch balance
  elements.costBalance.textContent = '...';
  try {
    const response = await fetch(`${OPENROUTER_API_URL}/credits`, {
      headers: { Authorization: `Bearer ${state.apiKey}` },
    });
    if (response.ok) {
      const data = await response.json();
      const totalCredits = data.data?.total_credits ?? 0;
      const totalUsage = data.data?.total_usage ?? 0;
      const balance = totalCredits - totalUsage;
      elements.costBalance.textContent = `$${balance.toFixed(2)}`;
    } else {
      elements.costBalance.textContent = '—';
    }
  } catch (e) {
    console.warn('Failed to fetch balance:', e);
    elements.costBalance.textContent = '—';
  }
}

function closeCostModal(): void {
  elements.costModal.classList.add('hidden');
}

// ============ Copy Chat ============
async function copyChat(): Promise<void> {
  elements.settingsDropdown.classList.remove('open');

  if (state.conversationHistory.length === 0) {
    showError('No conversation to copy');
    return;
  }

  let markdown = '';
  for (const msg of state.conversationHistory) {
    const content = typeof msg.content === 'string' ? msg.content : '[voice]';
    if (msg.role === 'user') {
      markdown += `**You:** ${content}\n\n`;
    } else {
      markdown += `**Assistant:** ${content}\n\n`;
    }
  }

  try {
    await navigator.clipboard.writeText(markdown.trim());
    // Show brief success feedback
    elements.copyChatBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => {
      elements.copyChatBtn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy chat`;
    }, 1500);
  } catch (e) {
    showError('Failed to copy to clipboard');
  }
}

// ============ New Chat ============
function startNewChat(): void {
  clearConversationHistory();
  clearPendingVoiceMessage();
  elements.conversationHistoryEl.innerHTML = '';
  resetStats();
  updateVoiceSummary();
}
