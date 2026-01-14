// UI state management and updates

import { elements } from './dom';
import { state, isMobile, saveConversationHistory } from './state';
import type { ButtonState } from './types';
import { parseMarkdown } from './markdown';

// ============ Screen Management ============
export function showLoginScreen(): void {
  // Remove the style tag injected during OAuth callback (if present)
  document.getElementById('oauth-hide-login')?.remove();
  elements.loginScreen.classList.remove('hidden');
  elements.voiceScreen.classList.add('hidden');
}

export function showVoiceScreen(): void {
  elements.loginScreen.classList.add('hidden');
  elements.voiceScreen.classList.remove('hidden');
}

// ============ Button State ============
export function setButtonState(buttonState: ButtonState): void {
  const { mainButton, statusText, hintText, cancelBtn, continuousToggle } = elements;

  mainButton.classList.remove(
    'listening',
    'processing',
    'speaking',
    'continuous-listening'
  );
  statusText.classList.remove('listening', 'speaking', 'continuous');

  switch (buttonState) {
    case 'listening':
      mainButton.classList.add('listening');
      statusText.classList.add('listening');
      statusText.textContent = 'Listening';
      hintText.textContent = 'Tap or Space to send';
      hintText.classList.remove('hidden');
      cancelBtn.classList.remove('hidden');
      break;
    case 'processing':
      mainButton.classList.add('processing');
      statusText.textContent = 'Thinking';
      hintText.classList.add('hidden');
      cancelBtn.classList.add('hidden');
      break;
    case 'speaking':
      mainButton.classList.add('speaking');
      statusText.classList.add('speaking');
      statusText.textContent = 'Speaking';
      hintText.classList.add('hidden');
      cancelBtn.classList.add('hidden');
      break;
    case 'continuous-ready':
      statusText.classList.add('continuous');
      statusText.textContent = 'Listening';
      hintText.textContent = 'Speak anytime';
      hintText.classList.remove('hidden');
      cancelBtn.classList.add('hidden');
      continuousToggle.classList.remove('listening');
      break;
    case 'continuous-listening':
      mainButton.classList.add('continuous-listening');
      statusText.classList.add('continuous', 'listening');
      statusText.textContent = 'Listening...';
      hintText.classList.add('hidden');
      cancelBtn.classList.add('hidden');
      continuousToggle.classList.add('listening');
      break;
    default:
      statusText.textContent = 'Ready';
      hintText.textContent = 'Tap or Space to speak';
      hintText.classList.remove('hidden');
      cancelBtn.classList.add('hidden');
  }
}

// ============ Error Display ============
export function showError(message: string): void {
  elements.errorToast.textContent = message;
  elements.errorToast.classList.add('visible');
  setTimeout(() => elements.errorToast.classList.remove('visible'), 4000);
}

// ============ Mode Switching ============
export function updateModeUI(): void {
  const {
    voiceScreen,
    textInputContainer,
    conversationHistoryEl,
    voiceModeBtn,
    textModeBtn,
    textInput,
  } = elements;

  if (state.textMode) {
    voiceScreen.classList.add('text-mode');
    textInputContainer.classList.add('visible');
    conversationHistoryEl.classList.add('visible');
    voiceModeBtn.classList.remove('active');
    textModeBtn.classList.add('active');
    renderConversationHistory();
    // Only auto-focus on desktop to avoid keyboard popping up on mobile
    if (!isMobile) {
      textInput.focus();
    }
  } else {
    voiceScreen.classList.remove('text-mode');
    textInputContainer.classList.remove('visible');
    conversationHistoryEl.classList.remove('visible');
    voiceModeBtn.classList.add('active');
    textModeBtn.classList.remove('active');
  }
}

export function setTextMode(enabled: boolean): void {
  state.textMode = enabled;
  localStorage.setItem('textMode', String(enabled));
  updateModeUI();
}

// ============ Voice Mode Summary ============
export function updateVoiceSummary(): void {
  const { clearChatBtn, clearChatBadge } = elements;

  if (state.conversationHistory.length === 0) {
    clearChatBtn.classList.add('hidden');
    return;
  }

  // Count user messages only
  const messageCount = state.conversationHistory.filter(
    (m) => m.role === 'user'
  ).length;
  if (messageCount === 0) {
    clearChatBtn.classList.add('hidden');
    return;
  }

  clearChatBadge.textContent = String(messageCount);
  clearChatBtn.classList.remove('hidden');
}

// ============ Conversation History Rendering ============
export function renderConversationHistory(): void {
  const { conversationHistoryEl } = elements;
  conversationHistoryEl.innerHTML = '';

  for (let i = 0; i < state.conversationHistory.length; i += 2) {
    const userMsg = state.conversationHistory[i];
    const assistantMsg = state.conversationHistory[i + 1];

    if (userMsg) {
      const group = document.createElement('div');
      group.className = 'message-group';

      const userEl = document.createElement('div');
      userEl.className = 'message user';
      userEl.textContent =
        typeof userMsg.content === 'string' ? userMsg.content : '[voice]';
      group.appendChild(userEl);

      if (assistantMsg) {
        const assistantEl = document.createElement('div');
        assistantEl.className = 'message assistant';
        assistantEl.innerHTML = parseMarkdown(
          typeof assistantMsg.content === 'string' ? assistantMsg.content : ''
        );
        group.appendChild(assistantEl);
      }

      conversationHistoryEl.appendChild(group);
    }
  }

  scrollToBottom();
}

export function scrollToBottom(): void {
  elements.conversationHistoryEl.scrollTop =
    elements.conversationHistoryEl.scrollHeight;
}

export function addMessageToHistory(
  role: 'user' | 'assistant',
  content: string,
  streaming = false
): void {
  const { conversationHistoryEl } = elements;

  // Find the last message group (skip spacer if present)
  let group = conversationHistoryEl.lastElementChild as HTMLElement | null;
  if (group && group.classList.contains('scroll-spacer')) {
    group = group.previousElementSibling as HTMLElement | null;
  }

  if (role === 'user') {
    // Ensure spacer exists at the end
    let spacer = conversationHistoryEl.querySelector(
      '.scroll-spacer'
    ) as HTMLElement | null;
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.className = 'scroll-spacer';
      conversationHistoryEl.appendChild(spacer);
    }
    // Spacer height = viewport height so we can scroll the last item to top
    spacer.style.height = conversationHistoryEl.clientHeight + 'px';

    // Create new group for user message, insert before spacer
    group = document.createElement('div');
    group.className = 'message-group';
    conversationHistoryEl.insertBefore(group, spacer);

    const userEl = document.createElement('div');
    userEl.className = 'message user';
    userEl.textContent = content;
    group.appendChild(userEl);

    // Scroll so user message appears at top of visible area
    const groupRef = group;
    requestAnimationFrame(() => {
      const containerTop = conversationHistoryEl.getBoundingClientRect().top;
      const groupTop = groupRef.getBoundingClientRect().top;
      const relativePosition = groupTop - containerTop;
      const scrollTarget =
        conversationHistoryEl.scrollTop + relativePosition - 72; // 72px = ~4.5rem padding
      conversationHistoryEl.scrollTo({
        top: Math.max(0, scrollTarget),
        behavior: 'smooth',
      });
    });
    return;
  } else {
    // Assistant message goes in the last group
    if (!group) {
      group = document.createElement('div');
      group.className = 'message-group';
      conversationHistoryEl.appendChild(group);
    }

    let assistantEl = group.querySelector('.message.assistant') as HTMLElement;
    if (!assistantEl) {
      assistantEl = document.createElement('div');
      assistantEl.className = 'message assistant';
      group.appendChild(assistantEl);
    }

    assistantEl.textContent = content;
    if (streaming) {
      assistantEl.classList.add('streaming');
      state.currentStreamingElement = assistantEl;
    } else {
      assistantEl.classList.remove('streaming');
      state.currentStreamingElement = null;
    }
  }
}

export function updateStreamingMessage(content: string): void {
  if (state.currentStreamingElement) {
    state.currentStreamingElement.innerHTML = parseMarkdown(content);
  }
}

export function finishStreamingMessage(): void {
  if (state.currentStreamingElement) {
    state.currentStreamingElement.classList.remove('streaming');
    state.currentStreamingElement = null;
  }
}

// ============ Bleed Status ============
export function updateBleedStatus(statusState: string | null = null): void {
  const statusDiv = document.getElementById('bleedStatus');
  if (!statusDiv) return;

  // Log all state changes to debug console
  if (statusState === 'no-mic') {
    window.dbg?.('Bleed detection: waiting for mic permission');
    statusDiv.textContent = '';
  } else if (statusState === 'init-vad') {
    window.dbg?.('Bleed detection: initializing VAD...');
    statusDiv.textContent = '';
  } else if (statusState === 'vad-failed') {
    window.dbg?.('Bleed detection: VAD initialization failed');
    statusDiv.textContent = '';
  } else if (statusState === 'detecting') {
    window.dbg?.('Bleed detection: analyzing audio...');
    statusDiv.textContent = '';
  } else if (state.micBleedDetected === true) {
    window.dbg?.('Bleed detection: speaker bleed detected - voice interrupts disabled');
    statusDiv.textContent = '🎧 Headphones recommended';
    statusDiv.style.color = '';
  } else if (state.micBleedDetected === false) {
    window.dbg?.('Bleed detection: no bleed - voice interrupts enabled');
    statusDiv.textContent = '';
  } else {
    statusDiv.textContent = '';
  }
}

// ============ Utility ============
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
