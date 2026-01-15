import { Signal } from '@preact/signals';

interface Props {
  isOpen: Signal<boolean>;
}

export function PrivacyModal({ isOpen }: Props) {
  if (!isOpen.value) return null;

  const close = () => {
    isOpen.value = false;
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if ((e.target as Element).classList.contains('modal-overlay')) {
      close();
    }
  };

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div class="modal">
        <div class="modal-header">
          <h3>Privacy Policy</h3>
          <button class="modal-close" onClick={close}>
            &times;
          </button>
        </div>
        <div class="modal-body" style={{ lineHeight: 1.7 }}>
          <p style={{ marginBottom: '1rem' }}>
            There's no backend — it's just a static HTML file. Your conversations go
            through{' '}
            <a href="https://openrouter.ai" target="_blank" style={{ color: 'var(--accent)' }}>
              OpenRouter
            </a>{' '}
            to Gemini on Google Vertex with{' '}
            <a
              href="https://openrouter.ai/docs/guides/features/zdr"
              target="_blank"
              style={{ color: 'var(--accent)' }}
            >
              Zero Data Retention
            </a>{' '}
            enabled.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            <strong>How your data flows:</strong>
          </p>
          <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>This app</strong> — No backend, no data collection. Your current
              conversation and any pending voice upload are stored in your browser's
              local storage so they persist if you switch apps or refresh. This data is
              cleared when you log out or start a new chat.
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>OpenRouter</strong> — No conversation content stored, just
              metadata (timestamps, usage).
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Google Vertex</strong> — Zero Data Retention — prompts and
              responses aren't stored or logged.
            </li>
          </ul>
          <p style={{ color: 'var(--fg-muted)' }}>
            Your OpenRouter API key is also stored in local storage so you don't have
            to log in every time. You can clear all local data by logging out.
          </p>
        </div>
      </div>
    </div>
  );
}
