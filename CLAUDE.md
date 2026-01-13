# Claude Code Guidelines for Spraff

## Development

Spraff uses Vite + TypeScript for development and building. Use **pnpm** as the package manager.

### Development Commands

```bash
pnpm dev      # Start development server with HMR
pnpm build    # Build for production
pnpm preview  # Preview production build locally
```

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

The app includes a built-in debug console accessible via Menu > Debug. Use `window.dbg('message')` to log messages that will appear in this console on mobile.

Key debug points are already instrumented:
- `MIC GRANTED via startRecording` / `MIC GRANTED via VAD init`
- `BLEED CHECK: micPermissionGranted=...`
- `BLEED DETECTING...`
- `BLEED RESULT: NO BLEED - interruption ON` / `BLEED RESULT: YES BLEED - interruption OFF`
- `VAD running for interruption during TTS`
