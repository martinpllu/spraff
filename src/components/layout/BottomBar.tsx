import { ModeToggle } from '../controls/ModeToggle';
import { createNewChat } from '../../state/signals';

export function BottomBar() {
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
      <div class="bottom-bar-right">
        <button class="new-chat-btn-voice" onClick={handleNewChat}>
          <svg viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New
        </button>
      </div>
    </div>
  );
}
