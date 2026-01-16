// ============ Google Drive Service ============

import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '../config';
import { dbg } from '../debug';
import type { GoogleUser, GoogleTokens, DriveData, Chat } from '../types';

const DRIVE_FILE_NAME = 'spraff-chats.json';
const DRIVE_API_BASE = 'https://www.googleapis.com';

// ============ Token Management ============

let tokenClient: { requestAccessToken: () => void } | null = null;
let pendingAuthResolve: ((user: GoogleUser) => void) | null = null;
let pendingAuthReject: ((error: Error) => void) | null = null;

function getStoredTokens(): GoogleTokens | null {
  try {
    const saved = localStorage.getItem('googleTokens');
    return saved ? (JSON.parse(saved) as GoogleTokens) : null;
  } catch {
    return null;
  }
}

function storeTokens(tokens: GoogleTokens): void {
  localStorage.setItem('googleTokens', JSON.stringify(tokens));
}

function clearTokens(): void {
  localStorage.removeItem('googleTokens');
}

export function getAccessToken(): string | null {
  const tokens = getStoredTokens();
  if (!tokens) return null;

  // Check if token is expired (with 5 min buffer)
  if (Date.now() >= tokens.expiresAt - 5 * 60 * 1000) {
    return null;
  }

  return tokens.accessToken;
}

// ============ Google Identity Services ============

export function initializeGoogleAuth(): void {
  if (!GOOGLE_CLIENT_ID) {
    dbg('Google Client ID not configured', 'warn');
    return;
  }

  // Wait for GIS library to load
  const checkGIS = () => {
    if (window.google?.accounts?.oauth2) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: handleTokenResponse,
      });
      dbg('Google Auth initialized');
    } else {
      setTimeout(checkGIS, 100);
    }
  };

  checkGIS();
}

function handleTokenResponse(response: { access_token?: string; error?: string }): void {
  if (response.error) {
    dbg(`Google auth error: ${response.error}`, 'error');
    if (pendingAuthReject) {
      pendingAuthReject(new Error(response.error));
      pendingAuthReject = null;
      pendingAuthResolve = null;
    }
    return;
  }

  if (response.access_token) {
    // Store token with 1 hour expiry (standard for Google OAuth)
    const tokens: GoogleTokens = {
      accessToken: response.access_token,
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
    storeTokens(tokens);
    dbg('Google token received');

    // Fetch user info
    fetchUserInfo(response.access_token)
      .then((user) => {
        if (pendingAuthResolve) {
          pendingAuthResolve(user);
          pendingAuthResolve = null;
          pendingAuthReject = null;
        }
      })
      .catch((error) => {
        if (pendingAuthReject) {
          pendingAuthReject(error);
          pendingAuthReject = null;
          pendingAuthResolve = null;
        }
      });
  }
}

async function fetchUserInfo(accessToken: string): Promise<GoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const data = (await response.json()) as { email: string; name: string; picture?: string };
  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

// ============ Auth Actions ============

export function signIn(): Promise<GoogleUser> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized. Check GOOGLE_CLIENT_ID in config.ts'));
      return;
    }

    pendingAuthResolve = resolve;
    pendingAuthReject = reject;
    tokenClient.requestAccessToken();
  });
}

export function signOut(): void {
  clearTokens();
  dbg('Signed out of Google');
}

// ============ Drive File Operations ============

async function findFile(): Promise<string | null> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${DRIVE_FILE_NAME}'`,
    fields: 'files(id,name)',
  });

  const response = await fetch(`${DRIVE_API_BASE}/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Drive API error: ${response.status}`);
  }

  const data = (await response.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id || null;
}

async function createFile(): Promise<string> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const metadata = {
    name: DRIVE_FILE_NAME,
    parents: ['appDataFolder'],
  };

  const response = await fetch(`${DRIVE_API_BASE}/drive/v3/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    throw new Error(`Failed to create file: ${response.status}`);
  }

  const data = (await response.json()) as { id: string };
  dbg(`Created Drive file: ${data.id}`);
  return data.id;
}

async function getOrCreateFileId(): Promise<string> {
  const existingId = await findFile();
  if (existingId) {
    return existingId;
  }
  return await createFile();
}

// ============ Public Drive API ============

export async function fetchChatsFromDrive(): Promise<DriveData | null> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const fileId = await findFile();
  if (!fileId) {
    // No file exists yet
    return null;
  }

  const response = await fetch(`${DRIVE_API_BASE}/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch from Drive: ${response.status}`);
  }

  const text = await response.text();
  if (!text || text.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(text) as DriveData;
  } catch {
    dbg('Failed to parse Drive data', 'error');
    return null;
  }
}

export async function saveChattoDrive(chatList: Chat[]): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const fileId = await getOrCreateFileId();

  const data: DriveData = {
    version: 1,
    syncedAt: Date.now(),
    chats: chatList,
  };

  const response = await fetch(
    `${DRIVE_API_BASE}/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to save to Drive: ${response.status}`);
  }

  dbg('Saved to Drive');
}

// ============ Utility ============

export function isGoogleAuthReady(): boolean {
  return tokenClient !== null;
}

export function hasValidToken(): boolean {
  return getAccessToken() !== null;
}
