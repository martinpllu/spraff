import { Signal } from '@preact/signals';

interface Props {
  isOpen: Signal<boolean>;
}

export function InstallModal({ isOpen }: Props) {
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
          <h3>Install App</h3>
          <button class="modal-close" onClick={close}>
            &times;
          </button>
        </div>
        <div class="modal-body" style={{ lineHeight: 1.7 }}>
          <p style={{ marginBottom: '1rem' }}>To install Spraff on your device:</p>
          <ol style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              Tap the <strong>Share</strong> button in Safari
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Scroll down and tap <strong>Add to Home Screen</strong>
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Tap <strong>Add</strong> to confirm
            </li>
          </ol>
          <p style={{ color: 'var(--fg-muted)' }}>
            The app will then launch in full-screen mode without browser controls.
          </p>
        </div>
      </div>
    </div>
  );
}
