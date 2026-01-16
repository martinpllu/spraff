import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import {
  chats,
  currentChatId,
  sidebarOpen,
  createNewChat,
  selectChat,
  deleteChat,
  updateChatTitle,
  toggleSidebar,
} from '../../state/signals';
import {
  googleUser,
  isSyncing,
  syncEnabled,
  lastSyncTime,
  syncError,
} from '../../state/syncSignals';
import { useGoogleSync } from '../../hooks/useGoogleSync';
import type { Chat } from '../../types';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
}

function ChatItem({ chat, isActive }: ChatItemProps) {
  const isEditing = useSignal(false);
  const editValue = useSignal(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const showDelete = useSignal(false);

  useEffect(() => {
    if (isEditing.value && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing.value]);

  const handleSave = () => {
    updateChatTitle(chat.id, editValue.value);
    isEditing.value = false;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      editValue.value = chat.title;
      isEditing.value = false;
    }
  };

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    if (showDelete.value) {
      deleteChat(chat.id);
    } else {
      showDelete.value = true;
      setTimeout(() => {
        showDelete.value = false;
      }, 3000);
    }
  };

  return (
    <div
      class={`chat-item ${isActive ? 'active' : ''}`}
      onClick={() => !isEditing.value && selectChat(chat.id)}
    >
      <div class="chat-item-content">
        {isEditing.value ? (
          <input
            ref={inputRef}
            type="text"
            class="chat-title-input"
            value={editValue.value}
            onInput={(e) => (editValue.value = (e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
          />
        ) : (
          <>
            <span class="chat-title">{chat.title}</span>
            <span class="chat-date">{formatDate(chat.updatedAt)}</span>
          </>
        )}
      </div>
      <div class="chat-item-actions">
        {!isEditing.value && (
          <button
            class="chat-action-btn edit"
            onClick={(e) => {
              e.stopPropagation();
              editValue.value = chat.title;
              isEditing.value = true;
            }}
            title="Rename"
          >
            <svg viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <button
          class={`chat-action-btn delete ${showDelete.value ? 'confirm' : ''}`}
          onClick={handleDelete}
          title={showDelete.value ? 'Click again to confirm' : 'Delete'}
        >
          <svg viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function formatSyncTime(timestamp: number | null): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} mins ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;

  return 'Over a day ago';
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" class="google-icon">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function ChatSidebar() {
  const chatList = chats.value;
  const { signIn } = useGoogleSync();

  // Close sidebar when clicking outside on mobile
  const handleOverlayClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('sidebar-overlay')) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        class={`sidebar-overlay ${sidebarOpen.value ? 'visible' : ''}`}
        onClick={handleOverlayClick}
      />

      {/* Sidebar panel */}
      <aside class={`chat-sidebar ${sidebarOpen.value ? 'open' : ''}`}>
        <header class="sidebar-header">
          <h2>Chats</h2>
          <button class="sidebar-close" onClick={toggleSidebar} title="Close">
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <button class="new-chat-btn" onClick={createNewChat}>
          <svg viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Chat
        </button>

        <div class="chat-list">
          {chatList.length === 0 ? (
            <div class="chat-list-empty">
              <p>No conversations yet</p>
              <span>Start chatting to create your first conversation</span>
            </div>
          ) : (
            chatList
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  isActive={chat.id === currentChatId.value}
                />
              ))
          )}
        </div>

        <footer class="sidebar-footer">
          {!googleUser.value ? (
            <button class="google-signin-btn" onClick={signIn} disabled={isSyncing.value}>
              <GoogleIcon />
              <span>Sign in with Google</span>
            </button>
          ) : (
            <div class="sync-status">
              <div class="sync-info">
                {isSyncing.value ? (
                  <span class="syncing">Syncing...</span>
                ) : syncError.value ? (
                  <span class="sync-error" title={syncError.value}>Sync error</span>
                ) : lastSyncTime.value ? (
                  <span class="synced">
                    <svg viewBox="0 0 24 24" class="sync-check-icon">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Synced {formatSyncTime(lastSyncTime.value)}
                  </span>
                ) : syncEnabled.value ? (
                  <span class="synced">
                    <svg viewBox="0 0 24 24" class="sync-check-icon">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Sync enabled
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </footer>
      </aside>
    </>
  );
}
