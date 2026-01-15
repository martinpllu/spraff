import { Signal, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { stats, apiKey } from '../../state/signals';
import { OPENROUTER_API_URL } from '../../config';

interface Props {
  isOpen: Signal<boolean>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function CostModal({ isOpen }: Props) {
  const balance = useSignal<string>('...');

  useEffect(() => {
    if (!isOpen.value) return;

    // Fetch balance when modal opens
    const fetchBalance = async () => {
      balance.value = '...';
      try {
        const response = await fetch(`${OPENROUTER_API_URL}/credits`, {
          headers: { Authorization: `Bearer ${apiKey.value}` },
        });
        if (response.ok) {
          const data = (await response.json()) as {
            data?: { total_credits?: number; total_usage?: number };
          };
          const totalCredits = data.data?.total_credits ?? 0;
          const totalUsage = data.data?.total_usage ?? 0;
          const bal = totalCredits - totalUsage;
          balance.value = `$${bal.toFixed(2)}`;
        } else {
          balance.value = '—';
        }
      } catch {
        balance.value = '—';
      }
    };

    fetchBalance();
  }, [isOpen.value]);

  if (!isOpen.value) return null;

  const close = () => {
    isOpen.value = false;
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if ((e.target as Element).classList.contains('modal-overlay')) {
      close();
    }
  };

  const currentStats = stats.value;

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div class="modal modal-small">
        <div class="modal-header">
          <h3>Cost</h3>
          <button class="modal-close" onClick={close}>
            &times;
          </button>
        </div>
        <div class="modal-body">
          <div class="cost-stats">
            <div class="cost-stat">
              <span class="cost-stat-label">OpenRouter balance</span>
              <span class="cost-stat-value">{balance.value}</span>
            </div>
            <div class="cost-stat">
              <span class="cost-stat-label">Last message</span>
              <span class="cost-stat-value">
                {currentStats.lastCost > 0 ? `$${currentStats.lastCost.toFixed(5)}` : '—'}
              </span>
            </div>
            <div class="cost-stat">
              <span class="cost-stat-label">This session</span>
              <span class="cost-stat-value">${currentStats.sessionCost.toFixed(5)}</span>
            </div>
            {currentStats.lastVoiceSize > 0 && (
              <div class="cost-stat">
                <span class="cost-stat-label">Last voice message</span>
                <span class="cost-stat-value">
                  {formatFileSize(currentStats.lastVoiceSize)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
