import { buttonState, isTextMode } from '../../state/signals';
import { useSpeech } from '../../hooks/useSpeech';

interface Props {
  onPress: () => void;
  onRelease: () => void;
  onCancel: () => void;
  chatTitle?: string;
}

export function MainButton({ onPress, onRelease, onCancel, chatTitle }: Props) {
  const state = buttonState.value;

  // Don't show in text mode
  if (isTextMode.value) return null;

  const handleClick = (e: Event) => {
    e.preventDefault();
    // Read current state directly from signal to avoid stale closure
    const currentState = buttonState.value;
    if (currentState === 'ready') {
      onPress();
    } else if (currentState === 'listening') {
      onRelease();
    }
  };

  return (
    <div class="button-container">
      {chatTitle && <div class="current-chat-title">{chatTitle}</div>}
      <button
        class={`main-button ${state}`}
        onClick={handleClick}
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
      <StatusText onCancel={onCancel} />
    </div>
  );
}

function StatusText({ onCancel }: { onCancel: () => void }) {
  const state = buttonState.value;
  const { stopSpeaking } = useSpeech();

  // Check if on desktop (not touch device)
  const isDesktop = !('ontouchstart' in window);

  if (state === 'ready') {
    return (
      <div class="status-text">
        <span>
          {isDesktop ? (
            <>Tap or <kbd>Space</kbd> to speak</>
          ) : (
            'Tap to speak'
          )}
        </span>
      </div>
    );
  }

  if (state === 'listening') {
    return (
      <div class="status-text listening">
        <span>Tap to send</span>
        <button class="status-stop-btn" onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  if (state === 'uploading') {
    return (
      <div class="status-text">
        <span>Uploading</span>
        <button class="status-stop-btn" onClick={stopSpeaking}>Cancel</button>
      </div>
    );
  }

  if (state === 'processing') {
    return (
      <div class="status-text">
        <span>Thinking</span>
        <button class="status-stop-btn" onClick={stopSpeaking}>Cancel</button>
      </div>
    );
  }

  if (state === 'speaking') {
    return (
      <div class="status-text speaking">
        <span>Speaking</span>
        <button class="status-stop-btn" onClick={stopSpeaking}>Stop</button>
      </div>
    );
  }

  return null;
}
