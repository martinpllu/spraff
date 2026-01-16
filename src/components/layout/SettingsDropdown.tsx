import { Signal } from '@preact/signals';
import { useOAuth } from '../../hooks/useOAuth';
import { useGoogleSync } from '../../hooks/useGoogleSync';
import { messages } from '../../state/signals';
import { googleUser } from '../../state/syncSignals';

interface Props {
  isOpen: Signal<boolean>;
  onVoiceSettings: () => void;
  onCost: () => void;
  onDebug: () => void;
  onAbout: () => void;
  onPrivacy: () => void;
  onInstall: () => void;
  showInstall: boolean;
}

export function SettingsDropdown({
  isOpen,
  onVoiceSettings,
  onCost,
  onDebug,
  onAbout,
  onPrivacy,
  onInstall,
  showInstall,
}: Props) {
  const { logout } = useOAuth();
  const { signOut: googleSignOut } = useGoogleSync();

  if (!isOpen.value) return null;

  const copyChat = () => {
    const history = messages.value;
    if (history.length === 0) return;

    const text = history
      .map((msg) => `${msg.role === 'user' ? 'You' : 'AI'}: ${msg.content}`)
      .join('\n\n');

    navigator.clipboard.writeText(text);
    isOpen.value = false;
  };

  const handleAction = (action: () => void) => {
    action();
    isOpen.value = false;
  };

  return (
    <div class="settings-dropdown open">
      <button onClick={() => handleAction(onVoiceSettings)}>
        <svg viewBox="0 0 24 24">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        </svg>
        Voice
      </button>
      <button onClick={() => handleAction(onCost)}>
        <svg viewBox="0 0 24 24">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        Cost
      </button>
      <button onClick={copyChat}>
        <svg viewBox="0 0 24 24">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        Copy chat
      </button>
      {showInstall && (
        <button onClick={() => handleAction(onInstall)}>
          <svg viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Install app
        </button>
      )}
      <div class="divider" />
      <button onClick={() => handleAction(onDebug)}>
        <svg viewBox="0 0 24 24">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="M8 12h8" />
          <path d="M12 8v8" />
        </svg>
        Debug
      </button>
      <button onClick={() => handleAction(onAbout)}>
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        About
      </button>
      <button onClick={() => handleAction(onPrivacy)}>
        <svg viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Privacy
      </button>
      {googleUser.value && (
        <>
          <div class="divider" />
          <button onClick={() => handleAction(googleSignOut)}>
            <svg viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            </svg>
            Sign out of Google
          </button>
        </>
      )}
      <button onClick={() => handleAction(logout)}>
        <svg viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Logout
      </button>
    </div>
  );
}
