// ============ Signal-based State ============

import { signal, computed, effect } from '@preact/signals';
import type { Message, Stats, ButtonState } from '../types';

// ============ Helpers ============

function loadMessages(): Message[] {
  try {
    const saved = localStorage.getItem('conversationHistory');
    return saved ? (JSON.parse(saved) as Message[]) : [];
  } catch {
    return [];
  }
}

// ============ API & Auth ============

export const apiKey = signal<string | null>(localStorage.getItem('openrouter_api_key'));

// ============ Conversation ============

export const messages = signal<Message[]>(loadMessages());
export const messageCount = computed(() => messages.value.length);

// ============ Recording ============

export const isListening = signal(false);
export const recordingCancelled = signal(false);

// ============ Speech ============

export const isSpeaking = signal(false);
export const shouldStopSpeaking = signal(false);
export const speechQueue = signal<string[]>([]);
export const speechTotalChars = signal(0);
export const speechSpokenChars = signal(0);

// ============ UI ============

export const buttonState = signal<ButtonState>('ready');
export const isTextMode = signal(localStorage.getItem('textMode') === 'true');
export const isProcessingText = signal(false);
export const currentScreen = signal<'login' | 'voice'>(
  localStorage.getItem('openrouter_api_key') ? 'voice' : 'login'
);

// ============ Voice Settings ============

export const selectedVoiceName = signal<string | null>(localStorage.getItem('selectedVoice'));
export const cloudVoicesEnabled = signal(localStorage.getItem('cloudVoicesEnabled') === 'true');

// ============ Streaming ============

export const currentStreamingElement = signal<HTMLElement | null>(null);
export const streamingContent = signal('');

// ============ Stats ============

export const stats = signal<Stats>({
  sessionCost: 0,
  lastCost: 0,
  lastVoiceSize: 0,
});

// ============ Device Detection ============

export const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ============ Persistence Effects ============

// Auto-save conversation history
effect(() => {
  try {
    localStorage.setItem('conversationHistory', JSON.stringify(messages.value));
  } catch {
    // Silently fail
  }
});

// Auto-save text mode preference
effect(() => {
  localStorage.setItem('textMode', String(isTextMode.value));
});

// Auto-save API key
effect(() => {
  if (apiKey.value) {
    localStorage.setItem('openrouter_api_key', apiKey.value);
  } else {
    localStorage.removeItem('openrouter_api_key');
  }
});

// Auto-save voice settings
effect(() => {
  if (selectedVoiceName.value) {
    localStorage.setItem('selectedVoice', selectedVoiceName.value);
  } else {
    localStorage.removeItem('selectedVoice');
  }
});

effect(() => {
  localStorage.setItem('cloudVoicesEnabled', String(cloudVoicesEnabled.value));
});

// ============ Actions ============

export function addMessage(message: Message): void {
  messages.value = [...messages.value, message];
}

export function clearMessages(): void {
  messages.value = [];
  localStorage.removeItem('conversationHistory');
}

export function updateSessionCost(cost: number): void {
  stats.value = {
    ...stats.value,
    lastCost: cost,
    sessionCost: stats.value.sessionCost + cost,
  };
}

export function setLastVoiceSize(size: number): void {
  stats.value = {
    ...stats.value,
    lastVoiceSize: size,
  };
}

export function resetStats(): void {
  stats.value = {
    sessionCost: 0,
    lastCost: 0,
    lastVoiceSize: 0,
  };
}

// ============ Pending Voice Message ============

export function savePendingVoiceMessage(base64Audio: string): void {
  try {
    localStorage.setItem('pendingVoiceMessage', base64Audio);
    localStorage.setItem('pendingVoiceTimestamp', Date.now().toString());
  } catch {
    // Silently fail
  }
}

export function clearPendingVoiceMessage(): void {
  try {
    localStorage.removeItem('pendingVoiceMessage');
    localStorage.removeItem('pendingVoiceTimestamp');
  } catch {
    // Silently fail
  }
}

export function getPendingVoiceMessage(): string | null {
  try {
    const audio = localStorage.getItem('pendingVoiceMessage');
    const timestamp = localStorage.getItem('pendingVoiceTimestamp');
    if (audio && timestamp) {
      const age = Date.now() - parseInt(timestamp, 10);
      if (age < 60 * 60 * 1000) {
        return audio;
      } else {
        clearPendingVoiceMessage();
      }
    }
    return null;
  } catch {
    return null;
  }
}
