import { useOAuth } from '../../hooks/useOAuth';

export function LoginScreen() {
  const { startOAuthFlow } = useOAuth();

  return (
    <div class="login-screen">
      <div class="logo">
        <svg width="220" height="80" viewBox="0 0 220 80">
          <defs>
            <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#4F46E5" />
              <stop offset="100%" stop-color="#7C3AED" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="220" height="80" rx="24" fill="url(#logo-gradient)" />
          <text
            x="110"
            y="54"
            text-anchor="middle"
            font-family="Bricolage Grotesque, sans-serif"
            font-size="42"
            font-weight="800"
            fill="white"
          >
            spraff
          </text>
        </svg>
      </div>
      <p class="login-tagline">Simple AI chat</p>
      <button class="login-btn" onClick={startOAuthFlow}>
        Get started
      </button>
      <div class="login-links">
        <a
          class="login-about"
          href="https://github.com/martinpllu/spraff"
          target="_blank"
          rel="noopener noreferrer"
        >
          About
        </a>
        <a class="login-about" href="#privacy">
          Privacy
        </a>
      </div>
    </div>
  );
}
