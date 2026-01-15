// ============ Application State ============

import type { Message, Stats } from './types';

// API Key
export let apiKey: string | null = localStorage.getItem('openrouter_api_key');

export function setApiKey(key: string | null): void {
  apiKey = key;
  if (key) {
    localStorage.setItem('openrouter_api_key', key);
  } else {
    localStorage.removeItem('openrouter_api_key');
  }
}

// Recording state
export let isListening = false;
export let recordingCancelled = false;

export function setIsListening(value: boolean): void {
  isListening = value;
}

export function setRecordingCancelled(value: boolean): void {
  recordingCancelled = value;
}

// Conversation history
function loadConversationHistory(): Message[] {
  try {
    const saved = localStorage.getItem('conversationHistory');
    return saved ? (JSON.parse(saved) as Message[]) : [];
  } catch (e) {
    console.warn('Failed to load conversation history:', e);
    return [];
  }
}

export let conversationHistory: Message[] = loadConversationHistory();

export function saveConversationHistory(): void {
  try {
    localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
  } catch (e) {
    console.warn('Failed to save conversation history:', e);
  }
}

export function clearConversationHistory(): void {
  conversationHistory = [];
  try {
    localStorage.removeItem('conversationHistory');
  } catch (e) {
    console.warn('Failed to clear conversation history:', e);
  }
}

export function addToConversationHistory(message: Message): void {
  conversationHistory.push(message);
}

// Voice settings
export let selectedVoiceName: string | null = localStorage.getItem('selectedVoice');
export let cloudVoicesEnabled = localStorage.getItem('cloudVoicesEnabled') === 'true';

export function setSelectedVoiceName(name: string | null): void {
  selectedVoiceName = name;
  if (name) {
    localStorage.setItem('selectedVoice', name);
  } else {
    localStorage.removeItem('selectedVoice');
  }
}

export function setCloudVoicesEnabled(enabled: boolean): void {
  cloudVoicesEnabled = enabled;
  localStorage.setItem('cloudVoicesEnabled', String(enabled));
}

// Speech state
export let speechQueue: string[] = [];
export let isSpeaking = false;
export let shouldStopSpeaking = false;
export let speechTotalChars = 0;
export let speechSpokenChars = 0;

export function setSpeechQueue(queue: string[]): void {
  speechQueue = queue;
}

export function setIsSpeaking(value: boolean): void {
  isSpeaking = value;
}

export function setShouldStopSpeaking(value: boolean): void {
  shouldStopSpeaking = value;
}

export function setSpeechTotalChars(value: number): void {
  speechTotalChars = value;
}

export function setSpeechSpokenChars(value: number): void {
  speechSpokenChars = value;
}

// Text mode
export let textMode = localStorage.getItem('textMode') === 'true';
export let isProcessingText = false;

export function setTextMode(enabled: boolean): void {
  textMode = enabled;
  localStorage.setItem('textMode', String(enabled));
}

export function setIsProcessingText(value: boolean): void {
  isProcessingText = value;
}

// Device detection
export const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Streaming state
export let currentStreamingElement: HTMLElement | null = null;

export function setCurrentStreamingElement(el: HTMLElement | null): void {
  currentStreamingElement = el;
}

// Stats
export const stats: Stats = {
  sessionCost: 0,
  lastCost: 0,
  lastVoiceSize: 0,
};

export function updateSessionCost(cost: number): void {
  stats.lastCost = cost;
  stats.sessionCost += cost;
}

export function resetStats(): void {
  stats.sessionCost = 0;
  stats.lastCost = 0;
  stats.lastVoiceSize = 0;
}

// Pending voice message persistence
export function savePendingVoiceMessage(base64Audio: string): void {
  try {
    localStorage.setItem('pendingVoiceMessage', base64Audio);
    localStorage.setItem('pendingVoiceTimestamp', Date.now().toString());
  } catch (e) {
    console.warn('Failed to save pending voice message:', e);
  }
}

export function clearPendingVoiceMessage(): void {
  try {
    localStorage.removeItem('pendingVoiceMessage');
    localStorage.removeItem('pendingVoiceTimestamp');
  } catch (e) {
    console.warn('Failed to clear pending voice message:', e);
  }
}

export function getPendingVoiceMessage(): string | null {
  try {
    const audio = localStorage.getItem('pendingVoiceMessage');
    const timestamp = localStorage.getItem('pendingVoiceTimestamp');
    if (audio && timestamp) {
      // Only return if less than 1 hour old
      const age = Date.now() - parseInt(timestamp, 10);
      if (age < 60 * 60 * 1000) {
        return audio;
      } else {
        clearPendingVoiceMessage();
      }
    }
    return null;
  } catch (e) {
    console.warn('Failed to get pending voice message:', e);
    return null;
  }
}
