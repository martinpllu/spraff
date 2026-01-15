import { useRef, useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { isTextMode, isProcessingText, isMobile } from '../../state/signals';
import { sendTextToAPI } from '../../api';

export function TextInput() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const text = useSignal('');
  const hasText = text.value.trim().length > 0;

  // Auto-focus on desktop when switching to text mode
  useEffect(() => {
    if (isTextMode.value && !isMobile && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isTextMode.value]);

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    text.value = target.value;

    // Auto-resize textarea
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 160) + 'px';
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = async () => {
    const message = text.value.trim();
    if (!message || isProcessingText.value) return;

    isProcessingText.value = true;
    text.value = '';
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.blur(); // Hide keyboard on mobile
    }

    try {
      await sendTextToAPI(message);
    } finally {
      isProcessingText.value = false;
      if (!isMobile && inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  if (!isTextMode.value) return null;

  return (
    <div class="text-input-container visible">
      <div class="text-input-wrapper">
        <textarea
          ref={inputRef}
          class="text-input"
          placeholder="Type your message..."
          rows={1}
          value={text.value}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isProcessingText.value}
        />
        <button
          class={`text-send-btn ${hasText ? 'active' : ''} ${isProcessingText.value ? 'loading' : ''}`}
          onClick={submit}
          disabled={!hasText || isProcessingText.value}
        >
          <svg viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <div class="spinner-icon" />
        </button>
      </div>
    </div>
  );
}
