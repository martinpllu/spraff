import { buttonState, isTextMode } from '../../state/signals';

interface Props {
  onPress: () => void;
  onRelease: () => void;
  chatTitle?: string;
}

export function MainButton({ onPress, onRelease, chatTitle }: Props) {
  const state = buttonState.value;

  // Don't show in text mode
  if (isTextMode.value) return null;

  const handlePressStart = (e: Event) => {
    e.preventDefault();
    onPress();
  };

  const handlePressEnd = (e: Event) => {
    e.preventDefault();
    onRelease();
  };

  const handleMouseLeave = () => {
    // If dragged away while holding, treat as release
    if (state === 'listening') {
      onRelease();
    }
  };

  return (
    <div class="button-container">
      {chatTitle && <div class="current-chat-title">{chatTitle}</div>}
      <button
        class={`main-button ${state}`}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        <svg class="mic-icon" viewBox="0 0 24 24">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <svg class="stop-icon" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
        <div class="spinner-icon" />
      </button>
      <StatusText />
    </div>
  );
}

function StatusText() {
  const state = buttonState.value;

  const statusMap: Record<typeof state, string> = {
    ready: 'Ready',
    listening: 'Listening',
    processing: 'Thinking',
    speaking: 'Speaking',
  };

  return (
    <div class={`status-text ${state === 'listening' || state === 'speaking' ? state : ''}`}>
      {statusMap[state]}
    </div>
  );
}
