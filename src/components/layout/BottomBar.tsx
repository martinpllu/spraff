import { ModeToggle } from '../controls/ModeToggle';
import {
  buttonState,
  isSpeaking,
  isListening,
  messages,
} from '../../state/signals';
import { useSpeech } from '../../hooks/useSpeech';

interface Props {
  onCancel: () => void;
  onClearChat: () => void;
}

export function BottomBar({ onCancel, onClearChat }: Props) {
  const { stopSpeaking } = useSpeech();
  const state = buttonState.value;
  const speaking = isSpeaking.value;
  const listening = isListening.value;
  const messageCount = messages.value.length;

  const showStop = speaking;
  const showCancel = listening;
  const showClear = messageCount > 0 && state === 'ready' && !listening && !speaking;

  return (
    <div class="bottom-bar">
      <ModeToggle />
      <div class="bottom-bar-right">
        {showStop && (
          <button class="action-btn" onClick={stopSpeaking}>
            <svg viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            <span>Stop</span>
          </button>
        )}
        {showCancel && (
          <button class="action-btn" onClick={onCancel}>
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Cancel</span>
          </button>
        )}
        {showClear && (
          <button class="action-btn" onClick={onClearChat}>
            <span class="clear-chat-text">Clear</span>
            <span class="clear-chat-badge">{messageCount}</span>
          </button>
        )}
      </div>
    </div>
  );
}
