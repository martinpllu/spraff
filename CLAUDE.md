# Claude Code Guidelines for Spraff

## Development

Spraff uses Vite + TypeScript for development and building. Use **pnpm** as the package manager.

### Development Commands

```bash
pnpm dev      # Start development server with HMR
pnpm build    # Build for production
pnpm preview  # Preview production build locally
```

### Mobile Testing via Cloudflare Tunnel

The app is served via Cloudflare tunnel at `https://spraff.pllu.ai` for mobile testing.

```bash
# 1. Start dev server (runs on port 3001 with HTTPS)
pnpm dev

# 2. Start Cloudflare tunnel (in another terminal)
cloudflared tunnel --url https://localhost:3001 --no-tls-verify run spraff

# 3. Access from mobile at https://spraff.pllu.ai
```

**Cache issues:** If you see stale content on mobile:
- The vite config has aggressive no-cache headers to prevent Cloudflare edge caching
- On mobile, open in a private/incognito tab to bypass browser cache
- PWA/Service Worker is disabled in dev mode to prevent caching issues

**Alternative - Direct IP (no OAuth):** For quick UI testing without login:
```bash
# Access at https://<YOUR_IP>:3001 (accept certificate warning)
ifconfig | grep "inet " | grep -v 127.0.0.1
```
Note: OAuth won't work with IP addresses - only the tunnel URL is registered with OpenRouter.

### Project Structure

```
src/
  main.ts      # Entry point
  types.ts     # TypeScript type definitions
  config.ts    # Configuration constants
  state.ts     # Application state management
  dom.ts       # DOM element references
  ui.ts        # UI updates and state management
  markdown.ts  # Markdown parsing
  audio.ts     # Audio recording and processing
  speech.ts    # Text-to-speech
  vad.ts       # Voice Activity Detection
  oauth.ts     # OAuth authentication
  api.ts       # API communication
  events.ts    # Event listeners
  style.css    # Styles
public/
  manifest.json
  icons/
```

### Cache Busting

Vite automatically handles cache busting with content hashes in production builds (e.g., `main-abc123.js`). No manual version strings needed.

For development, Vite's HMR ensures changes are reflected immediately.

## Debug Console

Access via Menu > Debug. Use `dbg(msg)` or `dbg(msg, 'warn'|'error')` - logs to both debug view and browser console.

API requests/responses are logged as `REQ #N` / `RES #N` with type (normal, waiting, tool_call, aborted, error).
