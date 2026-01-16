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
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>The short version:</strong>
          </p>
          <ul style={{ marginBottom: '1.25rem', paddingLeft: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              Your chats stay on your device — we don't have servers and we don't
              collect your data
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Your conversations are sent to an AI provider to generate responses,
              but they don't store them
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              You can optionally sign in with Google to sync chats across devices —
              this stores your chats privately in your own Google Drive
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              You can delete all your data at any time by logging out
            </li>
          </ul>

          <details style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '0.75rem' }}>
              Technical details
            </summary>
            <div style={{ paddingLeft: '0.5rem' }}>
              <p style={{ marginBottom: '0.75rem' }}>
                Spraff is a static web app with no backend. Your conversations are
                routed through{' '}
                <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                  OpenRouter
                </a>{' '}
                to Google Gemini with{' '}
                <a
                  href="https://openrouter.ai/docs/guides/features/zdr"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)' }}
                >
                  Zero Data Retention
                </a>{' '}
                enabled, meaning prompts and responses aren't stored or logged.
              </p>

              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Local storage:</strong>
              </p>
              <ul style={{ marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>
                <li style={{ marginBottom: '0.25rem' }}>
                  Chat history and settings are stored in your browser's local storage
                </li>
                <li style={{ marginBottom: '0.25rem' }}>
                  Your login credentials are also stored locally so you stay signed in
                </li>
              </ul>

              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Google Drive sync:</strong>
              </p>
              <ul style={{ marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>
                <li style={{ marginBottom: '0.25rem' }}>
                  Uses the{' '}
                  <code style={{ fontSize: '0.85em', background: 'var(--bg-elevated)', padding: '2px 4px', borderRadius: '3px' }}>
                    drive.appdata
                  </code>{' '}
                  scope — a private app folder that only Spraff can access
                </li>
                <li style={{ marginBottom: '0.25rem' }}>
                  We cannot see or access any of your other Google Drive files
                </li>
                <li style={{ marginBottom: '0.25rem' }}>
                  Your local data is preserved if you sign out of Google
                </li>
              </ul>
            </div>
          </details>

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
