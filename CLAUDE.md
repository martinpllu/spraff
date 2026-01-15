# Spraff

Simple, private AI chat app using Vite + TypeScript.

## Package Manager

Use **pnpm** for all package operations.

## Commands

- `pnpm dev` - Start dev server on https://localhost:3001
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build

## Dev Server

The dev server runs on port 3001 with HTTPS enabled (requires `cert.pem` and `key.pem` in the root directory).

To test on mobile, use Cloudflare tunnel:
```bash
cloudflared tunnel --url https://localhost:3001
```

## Architecture

```
src/
  main.ts      # Entry point
  types.ts     # TypeScript definitions
  config.ts    # Constants
  state.ts     # Application state
  dom.ts       # DOM element references
  ui.ts        # UI updates
  markdown.ts  # Markdown parsing
  audio.ts     # Audio recording
  speech.ts    # Text-to-speech
  oauth.ts     # OAuth authentication
  api.ts       # API communication
  events.ts    # Event listeners
  debug.ts     # Debug logging
  build-id.ts  # Auto-generated build ID
  style.css    # Styles
public/
  manifest.json  # PWA manifest
  icons/         # PWA icons
```

## Debug Console

The app includes a debug console accessible from the menu. Use it to see request/response logs and errors.

In code, use the debug function:
```typescript
import { dbg } from './debug';

dbg('Info message');
dbg('Warning message', 'warn');
dbg('Error message', 'error');
```

For request tracking:
```typescript
import { dbgRequest, dbgResponse, getNextRequestId } from './debug';

const reqId = getNextRequestId();
dbgRequest(reqId, 'Description');
dbgResponse(reqId, 'normal', 'Response details');
```

## Build ID

The build ID is auto-generated on each build and displayed in the About modal. To manually regenerate:
```bash
./scripts/update-build-id.sh
```
