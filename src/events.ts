// ============ Event Listeners ============

import { OPENROUTER_API_URL, LONG_PRESS_THRESHOLD } from './config';
import { openDebugModal, closeDebugModal, clearDebugLogs } from './debug';
import {
  loginBtn,
  logoutBtn,
  mainButton,
  settingsMenuBtn,
  settingsDropdown,
  voiceSettingsBtn,
  costSettingsBtn,
  copyChatBtn,
  aboutBtn,
  privacyBtn,
  installBtn,
  debugBtn,
  voiceModal,
  modalClose,
  voiceList,
  costModal,
  costModalClose,
  costBalance,
  costLast,
  costSession,
  costVoiceSize,
  voiceSizeStat,
  aboutModal,
  aboutModalClose,
  privacyModal,
  privacyModalClose,
  installModal,
  installModalClose,
  debugModal,
  debugModalClose,
  debugClearBtn,
  stopBtn,
  cancelBtn,
  modeToggle,
  textInput,
  textSendBtn,
  voiceScreen,
  conversationHistoryEl,
  clearChatBtn,
} from './dom';
import {
  apiKey,
  stats,
  textMode,
  setTextMode as setTextModeState,
  isProcessingText,
  setIsProcessingText,
  isMobile,
  selectedVoiceName,
  setSelectedVoiceName,
  cloudVoicesEnabled,
  setCloudVoicesEnabled,
  conversationHistory,
  clearConversationHistory,
  clearPendingVoiceMessage,
  resetStats,
} from './state';
import {
  showError,
  formatFileSize,
  updateModeUI,
  updateVoiceSummary,
} from './ui';
import { startOAuthFlow, logout } from './oauth';
import { startRecording, stopRecording, cancelRecording, getIsListening } from './audio';
import { stopSpeaking, isCloudVoice, isBlacklisted, isRecommended, getDefaultVoice } from './speech';
import { sendTextToAPI } from './api';

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function setupEventListeners(): void {
  loginBtn.addEventListener('click', startOAuthFlow);
  logoutBtn.addEventListener('click', () => {
    settingsDropdown.classList.remove('open');
    logout();
  });

  // Main button - support both tap-to-toggle and push-to-talk
  let buttonPressStart = 0;
  let buttonWasListening = false;

  function handlePressStart(): void {
    if (stopSpeaking) {
      stopSpeaking();
    }
    buttonPressStart = Date.now();
    buttonWasListening = getIsListening();

    // Always start recording on press (for both modes)
    if (!getIsListening()) {
      startRecording();
    }
  }

  function handlePressEnd(): void {
    const pressDuration = Date.now() - buttonPressStart;
    buttonPressStart = 0;

    if (pressDuration >= LONG_PRESS_THRESHOLD) {
      // Long press: push-to-talk mode - stop on release
      if (getIsListening()) {
        stopRecording();
      }
    } else {
      // Short press: toggle mode - stop if we were already listening before this press
      if (buttonWasListening && getIsListening()) {
        stopRecording();
      }
      // If we weren't listening, we already started on press, so do nothing
    }
  }

  // Mouse events for desktop
  mainButton.addEventListener('mousedown', handlePressStart);
  mainButton.addEventListener('mouseup', handlePressEnd);
  mainButton.addEventListener('mouseleave', () => {
    // If user drags away while holding, treat as push-to-talk release
    if (buttonPressStart > 0 && getIsListening()) {
      const pressDuration = Date.now() - buttonPressStart;
      if (pressDuration >= LONG_PRESS_THRESHOLD) {
        stopRecording();
      }
    }
  });

  // Touch events for mobile - distinguish swipes from taps
  let buttonTouchStartX = 0;
  let buttonTouchStartY = 0;
  let buttonTouchMoved = false;
  let buttonRecordingStarted = false;
  let buttonLongPressTimer: ReturnType<typeof setTimeout> | null = null;

  mainButton.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent mouse events from also firing
    buttonTouchStartX = e.touches[0]!.clientX;
    buttonTouchStartY = e.touches[0]!.clientY;
    buttonTouchMoved = false;
    buttonRecordingStarted = false;

    // Set timer to start recording after threshold (for push-to-talk when finger doesn't move)
    buttonLongPressTimer = setTimeout(() => {
      if (!buttonTouchMoved && !buttonRecordingStarted) {
        buttonRecordingStarted = true;
        handlePressStart();
      }
    }, LONG_PRESS_THRESHOLD);
  });

  mainButton.addEventListener('touchmove', (e) => {
    const deltaX = Math.abs(e.touches[0]!.clientX - buttonTouchStartX);
    const deltaY = Math.abs(e.touches[0]!.clientY - buttonTouchStartY);
    // If moved more than 20px, it's a swipe not a tap
    if (deltaX > 20 || deltaY > 20) {
      buttonTouchMoved = true;
      // Cancel the long press timer if it's a swipe
      if (buttonLongPressTimer) {
        clearTimeout(buttonLongPressTimer);
        buttonLongPressTimer = null;
      }
    }
  });

  mainButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    // Clear the long press timer
    if (buttonLongPressTimer) {
      clearTimeout(buttonLongPressTimer);
      buttonLongPressTimer = null;
    }
    if (buttonTouchMoved) {
      // It was a swipe - don't do anything
      buttonTouchMoved = false;
      return;
    }

    if (buttonRecordingStarted) {
      // Push-to-talk: already recording, stop now
      if (getIsListening()) {
        stopRecording();
      }
    } else {
      // Short tap: toggle recording
      stopSpeaking();
      if (getIsListening()) {
        stopRecording();
      } else {
        startRecording();
      }
    }
    buttonRecordingStarted = false;
  });

  // Spacebar - same logic as mouse
  let spacebarPressStart = 0;
  let spacebarWasListening = false;

  document.addEventListener('keydown', (e) => {
    if (!voiceModal.classList.contains('hidden')) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (!apiKey) return;
    if (e.repeat) return; // Ignore key repeat

    if (e.code === 'Space') {
      e.preventDefault();
      stopSpeaking();
      spacebarPressStart = Date.now();
      spacebarWasListening = getIsListening();

      // Always start recording on press (for both modes)
      if (!getIsListening()) {
        startRecording();
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && spacebarPressStart > 0) {
      const pressDuration = Date.now() - spacebarPressStart;
      spacebarPressStart = 0;

      if (pressDuration >= LONG_PRESS_THRESHOLD) {
        // Long press: push-to-talk - stop on release
        if (getIsListening()) {
          stopRecording();
        }
      } else {
        // Short press: toggle mode - stop if we were already listening before this press
        if (spacebarWasListening && getIsListening()) {
          stopRecording();
        }
        // If we weren't listening, we already started on keydown, so do nothing
      }
    }
  });

  // Settings dropdown menu
  settingsMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsDropdown.classList.toggle('open');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!settingsDropdown.contains(e.target as Node) && e.target !== settingsMenuBtn) {
      settingsDropdown.classList.remove('open');
    }
  });

  // Voice settings from dropdown
  voiceSettingsBtn.addEventListener('click', () => {
    settingsDropdown.classList.remove('open');
    openVoiceSettings();
  });

  // Cost settings from dropdown
  costSettingsBtn.addEventListener('click', openCostModal);

  // Copy chat
  copyChatBtn.addEventListener('click', copyChat);

  // Cost modal
  costModalClose.addEventListener('click', closeCostModal);
  costModal.addEventListener('click', (e) => {
    if (e.target === costModal) closeCostModal();
  });

  // About modal
  aboutBtn.addEventListener('click', () => {
    settingsDropdown.classList.remove('open');
    aboutModal.classList.remove('hidden');
  });
  aboutModalClose.addEventListener('click', () => {
    aboutModal.classList.add('hidden');
  });
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.classList.add('hidden');
  });

  // Privacy modal
  privacyBtn.addEventListener('click', () => {
    settingsDropdown.classList.remove('open');
    privacyModal.classList.remove('hidden');
  });
  privacyModalClose.addEventListener('click', () => {
    privacyModal.classList.add('hidden');
  });
  privacyModal.addEventListener('click', (e) => {
    if (e.target === privacyModal) privacyModal.classList.add('hidden');
  });

  // Debug modal
  if (debugBtn) {
    debugBtn.addEventListener('click', () => {
      settingsDropdown.classList.remove('open');
      openDebugModal();
    });
  }
  if (debugModalClose) {
    debugModalClose.addEventListener('click', closeDebugModal);
  }
  if (debugModal) {
    debugModal.addEventListener('click', (e) => {
      if (e.target === debugModal) closeDebugModal();
    });
  }
  if (debugClearBtn) {
    debugClearBtn.addEventListener('click', clearDebugLogs);
  }

  // Install app
  installBtn.addEventListener('click', handleInstallClick);
  installModalClose.addEventListener('click', () => {
    installModal.classList.add('hidden');
  });
  installModal.addEventListener('click', (e) => {
    if (e.target === installModal) installModal.classList.add('hidden');
  });

  // Stop button
  stopBtn.addEventListener('click', stopSpeaking);

  // Cancel button
  cancelBtn.addEventListener('click', cancelRecording);

  // Voice modal
  modalClose.addEventListener('click', closeVoiceSettings);
  voiceModal.addEventListener('click', (e) => {
    if (e.target === voiceModal) closeVoiceSettings();
  });

  // Cloud voices toggle
  const cloudVoicesToggle = document.getElementById('cloudVoicesToggle') as HTMLInputElement;
  cloudVoicesToggle.addEventListener('change', (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    setCloudVoicesEnabled(enabled);
    // If turning off cloud voices and current selection is a cloud voice, clear it
    if (!enabled && selectedVoiceName) {
      const voices = speechSynthesis.getVoices();
      const currentVoice = voices.find((v) => v.name === selectedVoiceName);
      if (currentVoice && isCloudVoice(currentVoice)) {
        setSelectedVoiceName(null);
      }
    }
    populateVoiceList();
  });

  // Load voices and init default at startup
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
      initDefaultVoice();
      // Update voice list if modal is open
      if (!voiceModal.classList.contains('hidden')) {
        populateVoiceList();
      }
    };
  }
  // Also try immediately in case voices are already loaded
  initDefaultVoice();

  // Mode switching - click anywhere in the toggle container to switch
  modeToggle.addEventListener('click', () => setTextModeUI(!textMode));

  // Clear chat with inline confirmation
  setupClearChatButton();

  // Text input handling
  setupTextInput();

  // Mobile keyboard handling
  setupMobileKeyboard();

  // Mobile swipe gestures for mode switching
  if (isMobile) {
    setupSwipeGestures();
  }

  // PWA install prompt
  setupPWAInstall();
}

function setTextModeUI(enabled: boolean): void {
  setTextModeState(enabled);
  updateModeUI();
}

function setupClearChatButton(): void {
  let clearChatConfirming = false;
  const textEl = clearChatBtn.querySelector('.clear-chat-text') as HTMLElement;

  function resetClearConfirmation(): void {
    if (clearChatConfirming) {
      clearChatConfirming = false;
      clearChatBtn.classList.remove('confirming');
      textEl.textContent = 'Clear';
    }
  }

  clearChatBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (clearChatConfirming) {
      // Second click - actually clear
      startNewChat();
      resetClearConfirmation();
      clearChatBtn.classList.add('hidden');
    } else {
      // First click - show confirmation
      clearChatConfirming = true;
      clearChatBtn.classList.add('confirming');
      textEl.textContent = 'Clear?';
    }
  });

  // Click anywhere else to cancel clear confirmation
  document.addEventListener('click', (e) => {
    if (!clearChatBtn.contains(e.target as Node)) {
      resetClearConfirmation();
    }
  });
}

function startNewChat(): void {
  clearConversationHistory();
  clearPendingVoiceMessage();
  conversationHistoryEl.innerHTML = '';
  resetStats();
  updateVoiceSummary();
}

function setupTextInput(): void {
  textInput.addEventListener('input', () => {
    // Auto-resize textarea
    textInput.style.height = 'auto';
    textInput.style.height = Math.min(textInput.scrollHeight, 160) + 'px';

    // Update send button state
    textSendBtn.classList.toggle('active', textInput.value.trim().length > 0);
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitTextMessage();
    }
  });

  textSendBtn.addEventListener('click', submitTextMessage);
}

async function submitTextMessage(): Promise<void> {
  const text = textInput.value.trim();
  if (!text || isProcessingText) return;

  setIsProcessingText(true);
  textSendBtn.classList.add('loading');
  textInput.disabled = true;
  stopBtn.classList.remove('hidden');

  textInput.value = '';
  textInput.style.height = 'auto';
  textSendBtn.classList.remove('active');
  textInput.blur(); // Hide keyboard on mobile

  try {
    await sendTextToAPI(text);
  } finally {
    setIsProcessingText(false);
    textSendBtn.classList.remove('loading');
    textInput.disabled = false;
    // Only auto-focus on desktop to avoid keyboard popping up on mobile
    if (!isMobile) {
      textInput.focus();
    }
    stopBtn.classList.add('hidden');
  }
}

function setupMobileKeyboard(): void {
  if (window.visualViewport) {
    function adjustForKeyboard(): void {
      const viewport = window.visualViewport!;
      const keyboardHeight = window.innerHeight - viewport.height - viewport.offsetTop;
      const textInputContainer = document.getElementById('textInputContainer')!;

      if (keyboardHeight > 100) {
        // Keyboard is open
        textInputContainer.style.bottom = keyboardHeight + 12 + 'px';
      } else {
        // Keyboard is closed
        textInputContainer.style.bottom = '';
      }
    }

    window.visualViewport.addEventListener('resize', adjustForKeyboard);
    window.visualViewport.addEventListener('scroll', adjustForKeyboard);
  }
}

function setupSwipeGestures(): void {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let swipeTracking = false;

  function handleTouchStart(e: TouchEvent): void {
    // Don't interfere with input fields, modals, or settings
    if ((e.target as Element).closest('.text-input-container, .modal, .settings-dropdown')) return;

    touchStartX = e.touches[0]!.clientX;
    touchStartY = e.touches[0]!.clientY;
    touchStartTime = Date.now();
    swipeTracking = true;
  }

  function handleTouchEnd(e: TouchEvent): void {
    if (!swipeTracking) return;
    swipeTracking = false;

    // Don't interfere with input fields, modals, or settings
    if ((e.target as Element).closest('.text-input-container, .modal, .settings-dropdown')) return;

    const touchEndX = e.changedTouches[0]!.clientX;
    const touchEndY = e.changedTouches[0]!.clientY;
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
      if (deltaX < 0 && !textMode) {
        // Swipe left → text mode
        setTextModeUI(true);
      } else if (deltaX > 0 && textMode) {
        // Swipe right → voice mode
        setTextModeUI(false);
      }
    }
  }

  // Attach to both voiceScreen and conversationHistory (which is position:fixed overlay)
  voiceScreen.addEventListener('touchstart', handleTouchStart, { passive: true });
  voiceScreen.addEventListener('touchend', handleTouchEnd, { passive: true });
  conversationHistoryEl.addEventListener('touchstart', handleTouchStart, { passive: true });
  conversationHistoryEl.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function setupPWAInstall(): void {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (!isStandalone) {
    // Capture the install prompt (Chrome/Brave/Edge on desktop and Android)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e as BeforeInstallPromptEvent;
      installBtn.classList.remove('hidden');
    });

    // Show install button on iOS Safari (no beforeinstallprompt event)
    if (isMobile && isIOS) {
      installBtn.classList.remove('hidden');
    }

    // Hide install button if app gets installed
    window.addEventListener('appinstalled', () => {
      installBtn.classList.add('hidden');
      deferredInstallPrompt = null;
    });
  }
}

function handleInstallClick(): void {
  settingsDropdown.classList.remove('open');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (deferredInstallPrompt) {
    // Trigger native install prompt
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((result) => {
      if (result.outcome === 'accepted') {
        installBtn.classList.add('hidden');
      }
      deferredInstallPrompt = null;
    });
  } else if (isMobile && isIOS) {
    // iOS Safari - show instructions modal
    installModal.classList.remove('hidden');
  }
}

// ============ Voice Settings ============

function initDefaultVoice(): void {
  if (selectedVoiceName) return; // Already have a selection

  const voices = speechSynthesis.getVoices();
  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
  if (englishVoices.length === 0) return;

  const defaultVoice = getDefaultVoice(englishVoices);
  if (defaultVoice) {
    setSelectedVoiceName(defaultVoice.name);
  }
}

function populateVoiceList(): void {
  const voices = speechSynthesis.getVoices();

  // If voices aren't loaded yet, wait for them
  if (voices.length === 0) {
    return;
  }

  let englishVoices = voices.filter((v) => v.lang.startsWith('en'));

  // Filter out blacklisted low-quality/novelty voices
  englishVoices = englishVoices.filter((v) => !isBlacklisted(v));

  // Deduplicate voices with the same name (macOS returns duplicates at different quality levels)
  const seenNames = new Set<string>();
  englishVoices = englishVoices.filter((v) => {
    if (seenNames.has(v.name)) return false;
    seenNames.add(v.name);
    return true;
  });

  // Ensure we have a default voice selected
  initDefaultVoice();

  // Filter out cloud voices if toggle is off
  if (!cloudVoicesEnabled) {
    englishVoices = englishVoices.filter((v) => !isCloudVoice(v));
  }

  // Check if any cloud voices exist
  const allVoices = speechSynthesis.getVoices();
  const hasCloudVoices = allVoices.some((v) => v.lang.startsWith('en') && isCloudVoice(v));

  // Sort: Recommended first, then Cloud (if enabled), then Premium/Enhanced, then alphabetical
  englishVoices.sort((a, b) => {
    const aRec = isRecommended(a);
    const bRec = isRecommended(b);
    // Recommended voices at the very top
    if (aRec && !bRec) return -1;
    if (!aRec && bRec) return 1;
    const aCloud = isCloudVoice(a);
    const bCloud = isCloudVoice(b);
    // Cloud voices next when enabled
    if (aCloud && !bCloud) return -1;
    if (!aCloud && bCloud) return 1;
    const aPremium = a.name.includes('Premium') || a.name.includes('Enhanced');
    const bPremium = b.name.includes('Premium') || b.name.includes('Enhanced');
    if (aPremium && !bPremium) return -1;
    if (!aPremium && bPremium) return 1;
    return a.name.localeCompare(b.name);
  });

  voiceList.innerHTML = '';

  // Update toggle state and visibility
  const toggle = document.getElementById('cloudVoicesToggle') as HTMLInputElement;
  const toggleContainer = document.querySelector('.cloud-toggle') as HTMLElement;
  if (toggle) toggle.checked = cloudVoicesEnabled;
  if (toggleContainer) toggleContainer.style.display = hasCloudVoices ? '' : 'none';

  // Update current voice display
  const currentVoiceEl = document.getElementById('currentVoiceName');
  if (currentVoiceEl) {
    currentVoiceEl.textContent = selectedVoiceName || 'None selected';
  }

  englishVoices.forEach((voice) => {
    const isSelected = selectedVoiceName === voice.name;
    const isCloud = isCloudVoice(voice);
    const isRec = isRecommended(voice);
    const item = document.createElement('div');
    item.className = `voice-item${isSelected ? ' selected' : ''}`;
    item.dataset.voiceName = voice.name;

    let badges = '';
    if (isRec) badges += '<span class="voice-recommended-badge">recommended</span>';
    if (isCloud) badges += '<span class="voice-cloud-badge">cloud</span>';

    item.innerHTML = `
      <div class="voice-radio"></div>
      <div class="voice-info">
        <div class="voice-name">${voice.name}${badges}</div>
        <div class="voice-lang">${voice.lang}</div>
      </div>
      <button class="voice-preview">Preview</button>
    `;

    item.addEventListener('click', (e) => {
      if ((e.target as Element).classList.contains('voice-preview')) return;
      selectVoice(voice.name);
    });

    item.querySelector('.voice-preview')!.addEventListener('click', (e) => {
      e.stopPropagation();
      previewVoice(voice);
    });

    voiceList.appendChild(item);
  });
}

function selectVoice(voiceName: string): void {
  setSelectedVoiceName(voiceName);
  document.querySelectorAll('.voice-item').forEach((item) => {
    const name = (item as HTMLElement).dataset.voiceName;
    item.classList.toggle('selected', name === voiceName);
  });
  // Update current voice display
  const currentVoiceEl = document.getElementById('currentVoiceName');
  if (currentVoiceEl) {
    currentVoiceEl.textContent = voiceName;
  }
}

function previewVoice(voice: SpeechSynthesisVoice): void {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance("Hello! I'm your voice assistant.");
  utterance.voice = voice;
  speechSynthesis.speak(utterance);
}

function openVoiceSettings(): void {
  voiceModal.classList.remove('hidden');

  // Try to populate immediately
  populateVoiceList();

  // If voices weren't ready, wait for them
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    // Set up a one-time handler to populate when voices load
    const onVoicesReady = (): void => {
      populateVoiceList();
      speechSynthesis.removeEventListener('voiceschanged', onVoicesReady);
    };
    speechSynthesis.addEventListener('voiceschanged', onVoicesReady);
  }
}

function closeVoiceSettings(): void {
  speechSynthesis.cancel();
  voiceModal.classList.add('hidden');
}

// ============ Cost Modal ============

async function openCostModal(): Promise<void> {
  settingsDropdown.classList.remove('open');
  costModal.classList.remove('hidden');

  // Update session stats
  costLast.textContent = stats.lastCost > 0 ? `$${stats.lastCost.toFixed(5)}` : '—';
  costSession.textContent = `$${stats.sessionCost.toFixed(5)}`;

  // Show voice size if we have one
  if (stats.lastVoiceSize > 0) {
    voiceSizeStat.style.display = '';
    costVoiceSize.textContent = formatFileSize(stats.lastVoiceSize);
  } else {
    voiceSizeStat.style.display = 'none';
  }

  // Fetch balance
  costBalance.textContent = '...';
  try {
    const response = await fetch(`${OPENROUTER_API_URL}/credits`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) {
      const data = (await response.json()) as { data?: { total_credits?: number; total_usage?: number } };
      const totalCredits = data.data?.total_credits ?? 0;
      const totalUsage = data.data?.total_usage ?? 0;
      const balance = totalCredits - totalUsage;
      costBalance.textContent = `$${balance.toFixed(2)}`;
    } else {
      costBalance.textContent = '—';
    }
  } catch (e) {
    console.warn('Failed to fetch balance:', e);
    costBalance.textContent = '—';
  }
}

function closeCostModal(): void {
  costModal.classList.add('hidden');
}

// ============ Copy Chat ============

async function copyChat(): Promise<void> {
  settingsDropdown.classList.remove('open');

  if (conversationHistory.length === 0) {
    showError('No conversation to copy');
    return;
  }

  let markdown = '';
  for (const msg of conversationHistory) {
    if (msg.role === 'user') {
      markdown += `**You:** ${typeof msg.content === 'string' ? msg.content : '[audio]'}\n\n`;
    } else {
      markdown += `**Assistant:** ${typeof msg.content === 'string' ? msg.content : ''}\n\n`;
    }
  }

  try {
    await navigator.clipboard.writeText(markdown.trim());
    // Show brief success feedback
    copyChatBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => {
      copyChatBtn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy chat`;
    }, 1500);
  } catch (e) {
    showError('Failed to copy to clipboard');
  }
}
