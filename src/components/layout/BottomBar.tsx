import { ModeToggle } from '../controls/ModeToggle';
import { isSpeaking, isListening } from '../../state/signals';
import { useSpeech } from '../../hooks/useSpeech';

interface Props {
  onCancel: () => void;
}

export function BottomBar({ onCancel }: Props) {
  const { stopSpeaking } = useSpeech();
  const speaking = isSpeaking.value;
  const listening = isListening.value;

  return (
    <div class="bottom-bar">
      <ModeToggle />
      <div class="bottom-bar-right">
        {speaking && (
          <button class="action-btn" onClick={stopSpeaking}>
            <svg viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            <span>Stop</span>
          </button>
        )}
        {listening && (
          <button class="action-btn" onClick={onCancel}>
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
}
