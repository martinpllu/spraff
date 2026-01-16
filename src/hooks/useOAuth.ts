// ============ OAuth Hook ============

import { OPENROUTER_AUTH_URL, OPENROUTER_API_URL, CALLBACK_URL } from '../config';
import { dbg } from '../debug';
import { apiKey, currentScreen, messages } from '../state/signals';

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

export function useOAuth() {
  async function startOAuthFlow(): Promise<void> {
    dbg('Starting OAuth flow');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    sessionStorage.setItem('code_verifier', codeVerifier);
    const authUrl = `${OPENROUTER_AUTH_URL}?callback_url=${encodeURIComponent(CALLBACK_URL)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    window.location.href = authUrl;
  }

  async function handleOAuthCallback(code: string): Promise<boolean> {
    dbg('Handling OAuth callback');
    const codeVerifier = sessionStorage.getItem('code_verifier');
    if (!codeVerifier) {
      clearCredentials();
      return false;
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
      apiKey.value = data.key;
      sessionStorage.removeItem('code_verifier');
      window.history.replaceState({}, document.title, window.location.pathname);
      dbg('OAuth successful');
      currentScreen.value = 'voice';
      return true;
    } catch (error) {
      dbg(`OAuth error: ${error}`, 'error');
      clearCredentials();
      return false;
    }
  }

  function clearCredentials(): void {
    apiKey.value = null;
    sessionStorage.removeItem('code_verifier');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function logout(): void {
    dbg('Logging out');
    clearCredentials();
    messages.value = [];
    // Clear all local data
    localStorage.removeItem('conversationHistory');
    localStorage.removeItem('chatHistory');
    localStorage.removeItem('currentChatId');
    localStorage.removeItem('pendingVoiceMessage');
    localStorage.removeItem('pendingVoiceTimestamp');
    localStorage.removeItem('googleTokens');
    currentScreen.value = 'login';
  }

  return {
    startOAuthFlow,
    handleOAuthCallback,
    logout,
    clearCredentials,
  };
}
