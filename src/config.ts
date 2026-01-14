// Configuration constants

export const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth';
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
export const MODEL = 'google/gemini-3-flash-preview';
export const MODEL_ONLINE = 'google/gemini-3-flash-preview:online';
export const CALLBACK_URL = window.location.origin + window.location.pathname;

// Timing constants
export const SPEECH_END_BUFFER_MS = 600;
export const BLEED_DETECTION_WINDOW_MS = 1500;

// Adaptive pause detection based on industry research
export const VERY_SHORT_UTTERANCE_MS = 600;
export const MEDIUM_UTTERANCE_MS = 2000;
export const VERY_SHORT_WAIT_MS = 150; // Quick response for "yes/no"
export const MEDIUM_WAIT_MS = 500; // Moderate wait for medium speech
export const LONG_WAIT_MS = 1000; // 1 second for extended speech with thinking pauses
