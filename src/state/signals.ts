// ============ Signal-based State ============

import { signal, computed, effect } from '@preact/signals';
import type { Message, Stats, ButtonState, Chat } from '../types';
import { scheduleDebouncedSync } from '../hooks/useGoogleSync';

// ============ Helpers ============

const TITLE_LENGTH = 40;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function generateTitle(messages: Message[]): string {
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (!firstUserMessage) return 'New Chat';

  const content =
    typeof firstUserMessage.content === 'string'
      ? firstUserMessage.content
      : firstUserMessage.content.find((c) => c.type === 'text')?.text || '';

  if (content.length <= TITLE_LENGTH) return content;
  return content.slice(0, TITLE_LENGTH).trim() + '…';
}

function loadChats(): Chat[] {
  try {
    const saved = localStorage.getItem('chatHistory');
    if (saved) {
      return JSON.parse(saved) as Chat[];
    }
    // Migrate from old conversationHistory if exists
    const oldHistory = localStorage.getItem('conversationHistory');
    if (oldHistory) {
      const messages = JSON.parse(oldHistory) as Message[];
      if (messages.length > 0) {
        const now = Date.now();
        return [
          {
            id: generateId(),
            title: generateTitle(messages),
            messages,
            createdAt: now,
            updatedAt: now,
          },
        ];
      }
    }
    return [];
  } catch {
    return [];
  }
}

function loadCurrentChatId(): string | null {
  try {
    return localStorage.getItem('currentChatId');
  } catch {
    return null;
  }
}

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

// ============ Chat History ============

export const chats = signal<Chat[]>(loadChats());
export const currentChatId = signal<string | null>(loadCurrentChatId());
export const sidebarOpen = signal(false);

export const currentChat = computed(() => {
  if (!currentChatId.value) return null;
  return chats.value.find((c) => c.id === currentChatId.value) || null;
});

// ============ Conversation ============

export const messages = signal<Message[]>(
  currentChat.value?.messages || loadMessages()
);
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

// Auto-save chat history
effect(() => {
  try {
    localStorage.setItem('chatHistory', JSON.stringify(chats.value));
    // Also maintain backwards compatibility
    localStorage.setItem('conversationHistory', JSON.stringify(messages.value));

    // Trigger Google Drive sync if enabled
    scheduleDebouncedSync();
  } catch {
    // Silently fail
  }
});

// Auto-save current chat ID
effect(() => {
  try {
    if (currentChatId.value) {
      localStorage.setItem('currentChatId', currentChatId.value);
    } else {
      localStorage.removeItem('currentChatId');
    }
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
  const newMessages = [...messages.value, message];
  messages.value = newMessages;

  // Update current chat or create new one
  const now = Date.now();
  if (currentChatId.value) {
    // Update existing chat
    chats.value = chats.value.map((c) =>
      c.id === currentChatId.value
        ? {
            ...c,
            messages: newMessages,
            title: c.title === 'New Chat' ? generateTitle(newMessages) : c.title,
            updatedAt: now,
          }
        : c
    );
  } else {
    // Create new chat with first message
    const newChat: Chat = {
      id: generateId(),
      title: generateTitle(newMessages),
      messages: newMessages,
      createdAt: now,
      updatedAt: now,
    };
    chats.value = [newChat, ...chats.value];
    currentChatId.value = newChat.id;
  }
}

export function clearMessages(): void {
  messages.value = [];
  // Update current chat if exists
  if (currentChatId.value) {
    chats.value = chats.value.map((c) =>
      c.id === currentChatId.value ? { ...c, messages: [], updatedAt: Date.now() } : c
    );
  }
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

// ============ Chat Management ============

export function createNewChat(): void {
  messages.value = [];
  currentChatId.value = null;
  sidebarOpen.value = false;
}

export function selectChat(chatId: string): void {
  const chat = chats.value.find((c) => c.id === chatId);
  if (chat) {
    currentChatId.value = chatId;
    messages.value = chat.messages;
    sidebarOpen.value = false;
  }
}

export function deleteChat(chatId: string): void {
  chats.value = chats.value.filter((c) => c.id !== chatId);

  // If we deleted the current chat, start fresh
  if (currentChatId.value === chatId) {
    currentChatId.value = null;
    messages.value = [];
  }
}

export function updateChatTitle(chatId: string, newTitle: string): void {
  chats.value = chats.value.map((c) =>
    c.id === chatId ? { ...c, title: newTitle.trim() || 'New Chat', updatedAt: Date.now() } : c
  );
}

export function toggleSidebar(): void {
  sidebarOpen.value = !sidebarOpen.value;
}
