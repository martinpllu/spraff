// ============ Google Sync Hook ============

import { useEffect } from 'preact/hooks';
import { dbg } from '../debug';
import { chats } from '../state/signals';
import {
  googleUser,
  isSyncing,
  syncEnabled,
  lastSyncTime,
  syncError,
  setGoogleUser,
  setSyncEnabled,
  setLastSyncTime,
  clearSyncState,
} from '../state/syncSignals';
import {
  initializeGoogleAuth,
  signIn as googleSignIn,
  signOut as googleSignOut,
  fetchChatsFromDrive,
  saveChattoDrive,
  hasValidToken,
} from '../services/googleDrive';
import type { Chat } from '../types';

// ============ Debounced Sync ============

let syncTimeout: number | null = null;
const SYNC_DEBOUNCE_MS = 2000;

export function scheduleDebouncedSync(): void {
  if (!syncEnabled.value || !googleUser.value) {
    return;
  }

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = window.setTimeout(async () => {
    try {
      isSyncing.value = true;
      syncError.value = null;

      await saveChattoDrive(chats.value);
      setLastSyncTime(Date.now());

      dbg('Sync completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      syncError.value = message;
      dbg(`Sync error: ${message}`, 'error');
    } finally {
      isSyncing.value = false;
    }
  }, SYNC_DEBOUNCE_MS);
}

// ============ Merge Logic ============

export function mergeChats(local: Chat[], remote: Chat[]): Chat[] {
  const merged = new Map<string, Chat>();

  // Add all remote chats first
  for (const chat of remote) {
    merged.set(chat.id, chat);
  }

  // Merge local chats - newest wins by updatedAt
  for (const chat of local) {
    const existing = merged.get(chat.id);
    if (!existing) {
      // New local chat not in remote
      merged.set(chat.id, chat);
    } else if (chat.updatedAt > existing.updatedAt) {
      // Local is newer, replace
      merged.set(chat.id, chat);
    }
    // Otherwise keep remote (it's newer or same)
  }

  // Sort by updatedAt descending
  return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

// ============ Initial Sync ============

async function performInitialSync(): Promise<void> {
  dbg('Performing initial sync');

  try {
    isSyncing.value = true;
    const remoteData = await fetchChatsFromDrive();
    const localChats = chats.value;

    if (!remoteData && localChats.length === 0) {
      // Both empty - just enable sync
      dbg('Both local and remote empty');
      setSyncEnabled(true);
      return;
    }

    if (!remoteData && localChats.length > 0) {
      // Only local data - upload to Drive
      dbg('Uploading local chats to Drive');
      await saveChattoDrive(localChats);
      setSyncEnabled(true);
      setLastSyncTime(Date.now());
      return;
    }

    if (remoteData && localChats.length === 0) {
      // Only remote data - download to local
      dbg('Downloading chats from Drive');
      chats.value = remoteData.chats;
      setSyncEnabled(true);
      setLastSyncTime(remoteData.syncedAt);
      return;
    }

    // Both have data - merge automatically (newest wins)
    dbg('Both local and remote have data - merging');
    const merged = mergeChats(localChats, remoteData!.chats);
    chats.value = merged;
    await saveChattoDrive(merged);
    setSyncEnabled(true);
    setLastSyncTime(Date.now());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    syncError.value = message;
    dbg(`Initial sync error: ${message}`, 'error');
  } finally {
    isSyncing.value = false;
  }
}

// ============ Hook ============

export function useGoogleSync() {
  // Initialize Google Auth on mount
  useEffect(() => {
    initializeGoogleAuth();

    // Check if we have a valid session and should resume sync
    if (googleUser.value && hasValidToken() && syncEnabled.value) {
      dbg('Resuming sync session');
      // Could optionally pull latest from Drive here
    }
  }, []);

  const signIn = async () => {
    try {
      isSyncing.value = true;
      syncError.value = null;

      const user = await googleSignIn();
      setGoogleUser(user);
      dbg(`Signed in as ${user.email}`);

      // Perform initial sync after sign in
      await performInitialSync();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      syncError.value = message;
      dbg(`Sign in error: ${message}`, 'error');
    } finally {
      isSyncing.value = false;
    }
  };

  const signOut = () => {
    googleSignOut();
    clearSyncState();
    dbg('Signed out - local data preserved');
  };

  const syncNow = async () => {
    if (!syncEnabled.value || !googleUser.value) {
      return;
    }

    try {
      isSyncing.value = true;
      syncError.value = null;
      await saveChattoDrive(chats.value);
      setLastSyncTime(Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      syncError.value = message;
    } finally {
      isSyncing.value = false;
    }
  };

  return {
    signIn,
    signOut,
    syncNow,
    // Signals exposed for components
    googleUser,
    isSyncing,
    syncEnabled,
    lastSyncTime,
    syncError,
  };
}
