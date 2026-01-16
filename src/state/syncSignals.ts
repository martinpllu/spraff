// ============ Google Sync State ============

import { signal, computed } from '@preact/signals';
import type { GoogleUser, Chat } from '../types';

// ============ Helpers ============

function loadGoogleUser(): GoogleUser | null {
  try {
    const saved = localStorage.getItem('googleUser');
    return saved ? (JSON.parse(saved) as GoogleUser) : null;
  } catch {
    return null;
  }
}

function loadLastSyncTime(): number | null {
  try {
    const saved = localStorage.getItem('lastSyncTime');
    return saved ? parseInt(saved, 10) : null;
  } catch {
    return null;
  }
}

function loadSyncEnabled(): boolean {
  try {
    return localStorage.getItem('syncEnabled') === 'true';
  } catch {
    return false;
  }
}

// ============ Signals ============

export const googleUser = signal<GoogleUser | null>(loadGoogleUser());
export const isSyncing = signal(false);
export const syncEnabled = signal(loadSyncEnabled());
export const lastSyncTime = signal<number | null>(loadLastSyncTime());
export const syncError = signal<string | null>(null);

// For initial sync prompt
export const showSyncPrompt = signal(false);
export const pendingRemoteChats = signal<Chat[] | null>(null);

// Computed state
export const isSignedIn = computed(() => googleUser.value !== null);

// ============ Actions ============

export function setGoogleUser(user: GoogleUser | null): void {
  googleUser.value = user;
  if (user) {
    localStorage.setItem('googleUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('googleUser');
  }
}

export function setSyncEnabled(enabled: boolean): void {
  syncEnabled.value = enabled;
  localStorage.setItem('syncEnabled', String(enabled));
}

export function setLastSyncTime(time: number | null): void {
  lastSyncTime.value = time;
  if (time) {
    localStorage.setItem('lastSyncTime', String(time));
  } else {
    localStorage.removeItem('lastSyncTime');
  }
}

export function clearSyncState(): void {
  // Called on sign out - keep local data but clear sync state
  googleUser.value = null;
  syncEnabled.value = false;
  lastSyncTime.value = null;
  syncError.value = null;
  showSyncPrompt.value = false;
  pendingRemoteChats.value = null;

  localStorage.removeItem('googleUser');
  localStorage.removeItem('syncEnabled');
  localStorage.removeItem('lastSyncTime');
  localStorage.removeItem('googleTokens');
}
