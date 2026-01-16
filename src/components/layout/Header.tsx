import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { SettingsDropdown } from './SettingsDropdown';
import { toggleSidebar, chats } from '../../state/signals';

interface Props {
  onVoiceSettings: () => void;
  onCost: () => void;
  onDebug: () => void;
  onAbout: () => void;
  onPrivacy: () => void;
  onInstall: () => void;
  showInstall: boolean;
}

export function Header({
  onVoiceSettings,
  onCost,
  onDebug,
  onAbout,
  onPrivacy,
  onInstall,
  showInstall,
}: Props) {
  const dropdownOpen = useSignal(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.settings-menu')) {
        dropdownOpen.value = false;
      }
    };

    if (dropdownOpen.value) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [dropdownOpen.value]);

  const toggleDropdown = (e: MouseEvent) => {
    e.stopPropagation();
    dropdownOpen.value = !dropdownOpen.value;
  };

  const chatCount = chats.value.length;

  return (
    <div class="top-menu">
      <button class="sidebar-toggle-btn" onClick={toggleSidebar} title="Chat History">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
        {chatCount > 0 && <span class="sidebar-badge">{chatCount}</span>}
      </button>
      <div class="settings-menu">
        <button class="settings-menu-btn" onClick={toggleDropdown} title="Settings">
          spraff
          <svg viewBox="0 0 24 24" width="16" height="16">
            <circle cx="12" cy="5" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="19" r="1.5" fill="currentColor" />
          </svg>
        </button>
        <SettingsDropdown
          isOpen={dropdownOpen}
          onVoiceSettings={onVoiceSettings}
          onCost={onCost}
          onDebug={onDebug}
          onAbout={onAbout}
          onPrivacy={onPrivacy}
          onInstall={onInstall}
          showInstall={showInstall}
        />
      </div>
    </div>
  );
}
