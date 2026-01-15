import { isTextMode } from '../../state/signals';

export function ModeToggle() {
  const toggle = () => {
    isTextMode.value = !isTextMode.value;
  };

  return (
    <div class="mode-toggle" onClick={toggle}>
      <button
        class={`mode-btn ${!isTextMode.value ? 'active' : ''}`}
        title="Voice mode"
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        </svg>
      </button>
      <button
        class={`mode-btn ${isTextMode.value ? 'active' : ''}`}
        title="Text mode"
      >
        <svg viewBox="0 0 24 24">
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
      </button>
    </div>
  );
}
