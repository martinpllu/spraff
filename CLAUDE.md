# Claude Code Guidelines for Spraff

## Version String

Use a random 6-character hex string as the version identifier. This serves two purposes:
1. **Cache busting**: Used as query parameter for app.js to force browser refresh
2. **Debug identification**: Displayed in the About modal to verify which version is running

### Generating a new version

Run this command to generate a new version string:
```bash
head -c 3 /dev/urandom | xxd -p
```

### Where to update

When making code changes that need to be tested on mobile or verified:

1. **index.html** - Update the script tag cache buster:
   ```html
   <script src="app.js?v=XXXXXX"></script>
   ```

2. **index.html** - Update the About modal version display (inside `#aboutModal`):
   ```html
   <p style="color: var(--fg-muted); font-size: 0.8rem;">Version: XXXXXX</p>
   ```

Both locations should use the same version string.

## Debug Console

The app includes a built-in debug console accessible via Menu > Debug. Use `window.dbg('message')` to log messages that will appear in this console on mobile.

Key debug points are already instrumented:
- `MIC GRANTED via startRecording` / `MIC GRANTED via VAD init`
- `BLEED CHECK: micPermissionGranted=...`
- `BLEED DETECTING...`
- `BLEED RESULT: NO BLEED - interruption ON` / `BLEED RESULT: YES BLEED - interruption OFF`
- `VAD running for interruption during TTS`
