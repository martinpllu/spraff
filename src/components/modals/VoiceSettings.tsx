import { Signal, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { selectedVoiceName, cloudVoicesEnabled } from '../../state/signals';
import { useSpeech } from '../../hooks/useSpeech';

interface Props {
  isOpen: Signal<boolean>;
}

interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  isCloud: boolean;
  isRecommended: boolean;
}

export function VoiceSettings({ isOpen }: Props) {
  const voices = useSignal<VoiceInfo[]>([]);
  const { isCloudVoice, isBlacklisted, isRecommended, getDefaultVoice } = useSpeech();

  useEffect(() => {
    if (!isOpen.value) return;

    const loadVoices = () => {
      const allVoices = speechSynthesis.getVoices();
      const englishVoices = allVoices
        .filter((v) => v.lang.startsWith('en') && !isBlacklisted(v))
        .map((voice) => ({
          voice,
          isCloud: isCloudVoice(voice),
          isRecommended: isRecommended(voice),
        }))
        .sort((a, b) => {
          // Recommended first
          if (a.isRecommended && !b.isRecommended) return -1;
          if (!a.isRecommended && b.isRecommended) return 1;
          // Then by name
          return a.voice.name.localeCompare(b.voice.name);
        });

      voices.value = englishVoices;

      // Set default voice if none selected
      if (!selectedVoiceName.value && englishVoices.length > 0) {
        const defaultVoice = getDefaultVoice(allVoices);
        if (defaultVoice) {
          selectedVoiceName.value = defaultVoice.name;
        }
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
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

  const selectVoice = (name: string) => {
    selectedVoiceName.value = name;
  };

  const toggleCloudVoices = () => {
    cloudVoicesEnabled.value = !cloudVoicesEnabled.value;
  };

  const filteredVoices = cloudVoicesEnabled.value
    ? voices.value
    : voices.value.filter((v) => !v.isCloud);

  const currentVoice = voices.value.find((v) => v.voice.name === selectedVoiceName.value);

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div class="modal">
        <div class="modal-header">
          <h3>Voice Settings</h3>
          <button class="modal-close" onClick={close}>
            &times;
          </button>
        </div>
        <div class="modal-body">
          <div class="current-voice">
            <span class="current-voice-label">Current:</span>
            <span class="current-voice-name">
              {currentVoice?.voice.name || selectedVoiceName.value || 'None selected'}
            </span>
          </div>

          <div class="cloud-toggle">
            <label class="toggle-row">
              <span class="toggle-label">
                <span class="toggle-title">Cloud voices</span>
                <span class="toggle-desc">
                  Higher quality, but text is sent to third party services
                </span>
              </span>
              <input
                type="checkbox"
                checked={cloudVoicesEnabled.value}
                onChange={toggleCloudVoices}
              />
              <span class="toggle-switch" />
            </label>
          </div>

          <div class="voice-help">
            <a
              class="voice-help-btn"
              href="https://github.com/martinpllu/spraff#voice-quality"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              How to install better voices
            </a>
          </div>

          <div class="voice-list">
            {filteredVoices.map((v) => (
              <button
                key={v.voice.name}
                class={`voice-option ${selectedVoiceName.value === v.voice.name ? 'selected' : ''} ${v.isRecommended ? 'recommended' : ''}`}
                onClick={() => selectVoice(v.voice.name)}
              >
                <span class="voice-name">{v.voice.name}</span>
                {v.isCloud && <span class="voice-badge cloud">Cloud</span>}
                {v.isRecommended && <span class="voice-badge recommended">Recommended</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
