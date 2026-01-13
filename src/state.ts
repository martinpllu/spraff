// Application state management

import type { Stats, Message, VADInstance } from './types';

// ============ Conversation Persistence ============
function loadConversationHistory(): Message[] {
  try {
    const saved = localStorage.getItem('conversationHistory');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.warn('Failed to load conversation history:', e);
    return [];
  }
}

// ============ State ============
export const state = {
  // Authentication
  apiKey: localStorage.getItem('openrouter_api_key') as string | null,

  // Recording state
  isListening: false,
  mediaRecorder: null as MediaRecorder | null,
  audioChunks: [] as Blob[],
  audioStream: null as MediaStream | null,
  recordingCancelled: false,

  // Conversation
  conversationHistory: loadConversationHistory(),

  // Voice settings
  selectedVoiceName: localStorage.getItem('selectedVoice') || null,
  cloudVoicesEnabled: localStorage.getItem('cloudVoicesEnabled') === 'true',

  // Speech synthesis
  speechQueue: [] as string[],
  isSpeaking: false,
  shouldStopSpeaking: false,
  speechTotalChars: 0,
  speechSpokenChars: 0,

  // Mode
  textMode: localStorage.getItem('textMode') === 'true',
  isProcessingText: false,
  currentStreamingElement: null as HTMLElement | null,

  // Continuous mode
  continuousModeActive: false,
  vadInstance: null as VADInstance | null,
  vadSuppressed: false,

  // Mic bleed detection
  micBleedDetected: null as boolean | null, // null = not yet tested
  isDetectingBleed: false,
  interruptionEnabled: false,
  micPermissionGranted: false,

  // Semantic utterance continuation
  pendingUtteranceTranscript: null as string | null,
  waitingForContinuation: false,

  // Request cancellation
  currentRequestController: null as AbortController | null,

  // Stats
  stats: {
    sessionCost: 0,
    lastCost: 0,
    lastVoiceSize: 0,
  } as Stats,
};

// Device detection
export const isMobile =
  'ontouchstart' in window || navigator.maxTouchPoints > 0;
export const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// ============ Persistence Functions ============
export function saveConversationHistory(): void {
  try {
    localStorage.setItem(
      'conversationHistory',
      JSON.stringify(state.conversationHistory)
    );
  } catch (e) {
    console.warn('Failed to save conversation history:', e);
  }
}

export function clearConversationHistory(): void {
  state.conversationHistory = [];
  try {
    localStorage.removeItem('conversationHistory');
  } catch (e) {
    console.warn('Failed to clear conversation history:', e);
  }
}

// ============ Pending Voice Message Persistence ============
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

// ============ Auth Functions ============
export function clearCredentials(): void {
  state.apiKey = null;
  localStorage.removeItem('openrouter_api_key');
  sessionStorage.removeItem('code_verifier');
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function setApiKey(key: string): void {
  state.apiKey = key;
  localStorage.setItem('openrouter_api_key', key);
}

// ============ Stats Functions ============
export function updateSessionCost(cost: number): void {
  state.stats.lastCost = cost;
  state.stats.sessionCost += cost;
}

export function resetStats(): void {
  state.stats.sessionCost = 0;
  state.stats.lastCost = 0;
  state.stats.lastVoiceSize = 0;
}
