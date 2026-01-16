import { Signal } from '@preact/signals';

interface Props {
  isOpen: Signal<boolean>;
}

export function PrivacyModal({ isOpen }: Props) {
  if (!isOpen.value) return null;

  const close = () => {
    isOpen.value = false;
    // Clear hash if it was used to open the modal
    if (window.location.hash === '#privacy') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
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
            <strong>Last updated:</strong> January 2025
          </p>
          <p style={{ marginBottom: '1rem' }}>
            Spraff is a voice-first AI chat app. There's no backend — it's a static
            web app. Your conversations go through{' '}
            <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
              OpenRouter
            </a>{' '}
            to Gemini on Google Vertex with{' '}
            <a
              href="https://openrouter.ai/docs/guides/features/zdr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              Zero Data Retention
            </a>{' '}
            enabled.
          </p>

          <p style={{ marginBottom: '0.5rem' }}>
            <strong>How your data flows:</strong>
          </p>
          <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>This app</strong> — No backend, no data collection, no analytics.
              Your conversations and settings are stored in your browser's local storage.
              This data stays on your device unless you enable Google Drive sync.
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>OpenRouter</strong> — Routes requests to AI providers. No
              conversation content stored, just metadata (timestamps, usage).
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Google Vertex</strong> — Zero Data Retention — prompts and
              responses aren't stored or logged by Google.
            </li>
          </ul>

          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Google Drive sync (optional):</strong>
          </p>
          <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              If you sign in with Google, your chat history can be synced to your
              Google Drive for backup and cross-device access.
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Data is stored in a private app-specific folder that only Spraff can
              access. It won't appear in your regular Drive files.
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              We only request the minimum permission needed:{' '}
              <code style={{ fontSize: '0.85em', background: 'var(--bg-elevated)', padding: '2px 4px', borderRadius: '3px' }}>
                drive.appdata
              </code>{' '}
              — we cannot see or access any of your other Google Drive files.
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              You can sign out of Google at any time. Your local data is preserved
              when you sign out.
            </li>
          </ul>

          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Local storage:</strong>
          </p>
          <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              Your OpenRouter API key is stored in local storage so you stay logged in.
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Chat history is stored locally and persists between sessions.
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              You can clear all local data by logging out from the menu.
            </li>
          </ul>

          <p style={{ color: 'var(--fg-muted)', fontSize: '0.9em' }}>
            Questions? Contact{' '}
            <a href="mailto:privacy@pllu.ai" style={{ color: 'var(--accent)' }}>
              privacy@pllu.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
