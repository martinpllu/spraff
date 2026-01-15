import { Signal, useSignal, useComputed } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

interface Props {
  isOpen: Signal<boolean>;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function DebugConsole({ isOpen }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const refreshTrigger = useSignal(0);

  // Force refresh when modal opens or logs change
  const logs = useComputed(() => {
    // Access refreshTrigger to create dependency
    refreshTrigger.value;
    return window.debugLogs.slice(-100);
  });

  useEffect(() => {
    if (!isOpen.value) return;

    // Refresh logs periodically while open
    const interval = setInterval(() => {
      refreshTrigger.value++;
    }, 500);

    return () => clearInterval(interval);
  }, [isOpen.value]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [logs.value]);

  if (!isOpen.value) return null;

  const close = () => {
    isOpen.value = false;
  };

  const clearLogs = () => {
    window.debugLogs = [];
    refreshTrigger.value++;
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
          <h3>Debug Console</h3>
          <button class="modal-close" onClick={close}>
            &times;
          </button>
        </div>
        <div class="modal-body">
          <div class="debug-actions">
            <button class="debug-clear-btn" onClick={clearLogs}>
              Clear
            </button>
          </div>
          <div class="debug-content" ref={contentRef}>
            {logs.value.map((entry, i) => {
              const time = new Date(entry.timestamp).toLocaleTimeString();
              const levelClass =
                entry.level === 'error'
                  ? 'debug-error'
                  : entry.level === 'warn'
                    ? 'debug-warn'
                    : '';
              return (
                <div key={i} class={`debug-line ${levelClass}`}>
                  <span class="debug-time">{time}</span>{' '}
                  <span dangerouslySetInnerHTML={{ __html: escapeHtml(entry.message) }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
