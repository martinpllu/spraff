// ============ OAuth Flow ============

import { OPENROUTER_AUTH_URL, OPENROUTER_API_URL, CALLBACK_URL } from './config';
import { dbg } from './debug';
import { setApiKey, clearConversationHistory } from './state';
import { showLoginScreen, showVoiceScreen, showError, updateModeUI } from './ui';
import { setupEventListeners } from './events';

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function startOAuthFlow(): Promise<void> {
  dbg('Starting OAuth flow');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  sessionStorage.setItem('code_verifier', codeVerifier);
  const authUrl = `${OPENROUTER_AUTH_URL}?callback_url=${encodeURIComponent(CALLBACK_URL)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  window.location.href = authUrl;
}

export async function handleOAuthCallback(code: string): Promise<void> {
  dbg('Handling OAuth callback');
  const codeVerifier = sessionStorage.getItem('code_verifier');
  if (!codeVerifier) {
    // Clear any stale credentials on auth failure
    clearCredentials();
    showError('Authentication failed');
    showLoginScreen();
    return;
  }

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/auth/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        code_challenge_method: 'S256',
      }),
    });

    if (!response.ok) throw new Error('Failed to authenticate');

    const data = (await response.json()) as { key: string };
    setApiKey(data.key);
    sessionStorage.removeItem('code_verifier');
    window.history.replaceState({}, document.title, window.location.pathname);
    dbg('OAuth successful');
    showVoiceScreen();
    updateModeUI();
    setupEventListeners();
  } catch (error) {
    dbg(`OAuth error: ${error}`, 'error');
    // Clear any stale credentials on auth failure
    clearCredentials();
    showError('Authentication failed');
    showLoginScreen();
  }
}

export function clearCredentials(): void {
  setApiKey(null);
  sessionStorage.removeItem('code_verifier');
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function logout(): void {
  dbg('Logging out');
  clearCredentials();
  clearConversationHistory();
  showLoginScreen();
}
