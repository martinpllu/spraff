import { Signal } from '@preact/signals';
import { BUILD_ID } from '../../build-id';

interface Props {
  isOpen: Signal<boolean>;
}

export function AboutModal({ isOpen }: Props) {
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
      <div class="modal modal-small">
        <div class="modal-header">
          <h3>About</h3>
          <button class="modal-close" onClick={close}>
            &times;
          </button>
        </div>
        <div class="modal-body">
          <p style={{ marginBottom: '1rem' }}>Simple, private AI chat.</p>
          <p style={{ marginBottom: '1rem' }}>
            <a
              href="https://github.com/martinpllu/spraff"
              target="_blank"
              style={{ color: 'var(--link)', textDecoration: 'none', fontWeight: 600 }}
            >
              GitHub
            </a>
          </p>
          <p style={{ color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
            Created by{' '}
            <a
              href="https://www.linkedin.com/in/martin-pllu-7034513"
              target="_blank"
              style={{ color: 'var(--link)', textDecoration: 'none' }}
            >
              Martin Pllu
            </a>
          </p>
          <p
            style={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: 'var(--fg-muted)',
            }}
          >
            Build: {BUILD_ID}
          </p>
        </div>
      </div>
    </div>
  );
}
