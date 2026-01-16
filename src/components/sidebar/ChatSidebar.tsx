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

export function ChatSidebar() {
  const chatList = chats.value;

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
          <span class="chat-count">
            {chatList.length} {chatList.length === 1 ? 'chat' : 'chats'}
          </span>
        </footer>
      </aside>
    </>
  );
}
