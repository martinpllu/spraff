import { ModeToggle } from '../controls/ModeToggle';
import { isSpeaking, isListening, isTextMode, createNewChat } from '../../state/signals';
import { useSpeech } from '../../hooks/useSpeech';

interface Props {
  onCancel: () => void;
}

export function BottomBar({ onCancel }: Props) {
  const { stopSpeaking } = useSpeech();

  const handleNewChat = (e: Event) => {
    const button = e.currentTarget as HTMLElement;
    button.classList.add('clicked');
    button.blur();
    createNewChat();
    const removeClicked = () => {
      button.classList.remove('clicked');
      button.removeEventListener('mouseleave', removeClicked);
    };
    button.addEventListener('mouseleave', removeClicked);
  };

  return (
    <div class="bottom-bar">
      <div class="bottom-bar-left">
        <ModeToggle />
      </div>
      <div class="bottom-bar-center">
        {isSpeaking.value && (
          <button class="action-btn" onClick={stopSpeaking}>
            <svg viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            <span>Stop</span>
          </button>
        )}
        {isListening.value && (
          <button class="action-btn" onClick={onCancel}>
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Cancel</span>
          </button>
        )}
      </div>
      <div class="bottom-bar-right">
        {!isTextMode.value && (
          <button class="new-chat-btn-voice" onClick={handleNewChat}>
            <svg viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        )}
      </div>
    </div>
  );
}
