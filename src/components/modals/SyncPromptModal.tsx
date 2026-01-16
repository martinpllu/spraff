import {
  showSyncPrompt,
  pendingRemoteChats,
} from '../../state/syncSignals';
import { chats } from '../../state/signals';
import {
  handleUploadLocal,
  handleDownloadRemote,
  handleMerge,
} from '../../hooks/useGoogleSync';

export function SyncPromptModal() {
  if (!showSyncPrompt.value) return null;

  const localCount = chats.value.length;
  const remoteCount = pendingRemoteChats.value?.length || 0;

  const handleOverlayClick = () => {
    // Don't allow closing by clicking overlay - user must choose
  };

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div class="modal">
        <div class="modal-header">
          <h3>Sync Chats</h3>
        </div>
        <div class="modal-body">
          <p class="sync-prompt-text">
            You have chats both locally and in Google Drive. How would you like to proceed?
          </p>

          <div class="sync-stats">
            <div class="sync-stat">
              <span class="sync-stat-label">Local chats</span>
              <span class="sync-stat-value">{localCount}</span>
            </div>
            <div class="sync-stat">
              <span class="sync-stat-label">Drive chats</span>
              <span class="sync-stat-value">{remoteCount}</span>
            </div>
          </div>

          <div class="sync-options">
            <button class="sync-option-btn" onClick={handleUploadLocal}>
              <svg viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div class="sync-option-content">
                <span class="sync-option-title">Upload to Drive</span>
                <span class="sync-option-desc">Replace Drive with your local chats</span>
              </div>
            </button>

            <button class="sync-option-btn" onClick={handleDownloadRemote}>
              <svg viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <div class="sync-option-content">
                <span class="sync-option-title">Download from Drive</span>
                <span class="sync-option-desc">Replace local with your Drive chats</span>
              </div>
            </button>

            <button class="sync-option-btn primary" onClick={handleMerge}>
              <svg viewBox="0 0 24 24">
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <path d="M6 21V9a9 9 0 0 0 9 9" />
              </svg>
              <div class="sync-option-content">
                <span class="sync-option-title">Merge</span>
                <span class="sync-option-desc">Keep all chats, newest version wins</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
