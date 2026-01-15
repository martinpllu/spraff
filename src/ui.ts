// ============ UI Updates ============

import type { ButtonState } from './types';
import {
  loginScreen,
  voiceScreen,
  mainButton,
  statusText,
  hintText,
  cancelBtn,
  stopBtn,
  errorToast,
  textInputContainer,
  conversationHistoryEl,
  voiceModeBtn,
  textModeBtn,
  clearChatBtn,
  clearChatBadge,
  textInput,
} from './dom';
import {
  textMode,
  isMobile,
  conversationHistory,
  currentStreamingElement,
  setCurrentStreamingElement,
} from './state';
import { parseMarkdown } from './markdown';

export function showLoginScreen(): void {
  // Remove the style tag injected during OAuth callback (if present)
  document.getElementById('oauth-hide-login')?.remove();
  loginScreen.classList.remove('hidden');
  voiceScreen.classList.add('hidden');
}

export function showVoiceScreen(): void {
  loginScreen.classList.add('hidden');
  voiceScreen.classList.remove('hidden');
}

export function setButtonState(state: ButtonState): void {
  mainButton.classList.remove('listening', 'processing', 'speaking');
  statusText.classList.remove('listening', 'speaking');

  switch (state) {
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
    default:
      statusText.textContent = 'Ready';
      hintText.textContent = 'Tap or Space to speak';
      hintText.classList.remove('hidden');
      cancelBtn.classList.add('hidden');
  }
}

export function showError(message: string): void {
  errorToast.textContent = message;
  errorToast.classList.add('visible');
  setTimeout(() => errorToast.classList.remove('visible'), 4000);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ============ Mode Switching ============

export function updateModeUI(): void {
  if (textMode) {
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

// ============ Voice Mode Summary ============

export function updateVoiceSummary(): void {
  if (conversationHistory.length === 0) {
    clearChatBtn.classList.add('hidden');
    return;
  }

  // Count user messages only
  const messageCount = conversationHistory.filter((m) => m.role === 'user').length;
  if (messageCount === 0) {
    clearChatBtn.classList.add('hidden');
    return;
  }

  clearChatBadge.textContent = String(messageCount);
  clearChatBtn.classList.remove('hidden');
}

export function renderConversationHistory(): void {
  conversationHistoryEl.innerHTML = '';

  for (let i = 0; i < conversationHistory.length; i += 2) {
    const userMsg = conversationHistory[i];
    const assistantMsg = conversationHistory[i + 1];

    if (userMsg) {
      const group = document.createElement('div');
      group.className = 'message-group';

      const userEl = document.createElement('div');
      userEl.className = 'message user';
      userEl.textContent = typeof userMsg.content === 'string' ? userMsg.content : '[audio]';
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
  conversationHistoryEl.scrollTop = conversationHistoryEl.scrollHeight;
}

export function addMessageToHistory(role: 'user' | 'assistant', content: string, streaming = false): void {
  // Find the last message group (skip spacer if present)
  let group = conversationHistoryEl.lastElementChild as HTMLElement | null;
  if (group && group.classList.contains('scroll-spacer')) {
    group = group.previousElementSibling as HTMLElement | null;
  }

  if (role === 'user') {
    // Ensure spacer exists at the end
    let spacer = conversationHistoryEl.querySelector('.scroll-spacer') as HTMLElement | null;
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
    requestAnimationFrame(() => {
      // Calculate how far the group is from the top of the scrollable content
      const containerTop = conversationHistoryEl.getBoundingClientRect().top;
      const groupTop = group!.getBoundingClientRect().top;
      const relativePosition = groupTop - containerTop;
      const scrollTarget = conversationHistoryEl.scrollTop + relativePosition - 72; // 72px = ~4.5rem padding
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

    let assistantEl = group.querySelector('.message.assistant') as HTMLElement | null;
    if (!assistantEl) {
      assistantEl = document.createElement('div');
      assistantEl.className = 'message assistant';
      group.appendChild(assistantEl);
    }

    assistantEl.textContent = content;
    if (streaming) {
      assistantEl.classList.add('streaming');
      setCurrentStreamingElement(assistantEl);
    } else {
      assistantEl.classList.remove('streaming');
      setCurrentStreamingElement(null);
    }
  }
}

export function updateStreamingMessage(content: string): void {
  if (currentStreamingElement) {
    currentStreamingElement.innerHTML = parseMarkdown(content);
  }
}

export function finishStreamingMessage(): void {
  if (currentStreamingElement) {
    currentStreamingElement.classList.remove('streaming');
    setCurrentStreamingElement(null);
  }
}

export function hideStopButton(): void {
  stopBtn.classList.add('hidden');
}

export function showStopButton(): void {
  stopBtn.classList.remove('hidden');
}
