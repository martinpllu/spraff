// ============ Configuration ============

export const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth';
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
export const MODEL = 'google/gemini-3-flash-preview';
export const MODEL_ONLINE = 'google/gemini-3-flash-preview:online';
// Ensure callback URL ends with / for proper routing with base path
const pathname = window.location.pathname.endsWith('/')
  ? window.location.pathname
  : window.location.pathname + '/';
export const CALLBACK_URL = window.location.origin + pathname;

// Interaction thresholds
export const LONG_PRESS_THRESHOLD = 300; // ms

// Google OAuth
export const GOOGLE_CLIENT_ID = '337230337038-rqb906lb3a613u9g2vbdivkkqjabpkoe.apps.googleusercontent.com';
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
