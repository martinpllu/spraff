import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { apiKey } from '../state/signals';
import { useOAuth } from '../hooks/useOAuth';
import { LoginScreen } from './screens/LoginScreen';
import { VoiceScreen } from './screens/VoiceScreen';

export function App() {
  const { handleOAuthCallback } = useOAuth();

  // Modal states
  const showAbout = useSignal(false);
  const showCost = useSignal(false);
  const showDebug = useSignal(false);
  const showPrivacy = useSignal(false);
  const showInstall = useSignal(false);
  const showVoice = useSignal(false);

  // Handle OAuth callback and hash routing on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      handleOAuthCallback(code);
    }

    // Handle #privacy hash to open privacy modal directly
    if (window.location.hash === '#privacy') {
      showPrivacy.value = true;
    }
  }, []);

  // Determine which screen to show
  const isLoggedIn = apiKey.value !== null;

  return (
    <>
      {/* Landscape Warning */}
      <div class="landscape-warning">
        <svg viewBox="0 0 24 24">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12" y2="18.01" />
        </svg>
        <p>Please rotate your device to portrait mode</p>
      </div>

      {/* Error Toast */}
      <div class="error-toast" id="errorToast" />

      {/* Main Content */}
      {!isLoggedIn && <LoginScreen />}
      {isLoggedIn && (
        <VoiceScreen
          showAbout={showAbout}
          showCost={showCost}
          showDebug={showDebug}
          showPrivacy={showPrivacy}
          showInstall={showInstall}
          showVoice={showVoice}
        />
      )}
    </>
  );
}
