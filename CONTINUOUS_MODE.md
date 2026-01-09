# Continuous Chat Mode - Implementation Progress

> **IMPORTANT FOR AGENTS**: Keep this file updated as you work. Add notes about what you tried, what worked, what didn't, and any errors encountered. This helps future sessions continue effectively.

## Overview

Adding a continuous conversation mode to Spraff where users can have a hands-free chat. The key challenge is **mic bleed** - when the assistant speaks through speakers, VAD (Voice Activity Detection) may detect it as user speech, causing infinite loops.

## Current Status: Bleed Detection Not Working on Mobile

**VAD initialization is FIXED** - works on desktop. Continuous mode works on desktop.

**Current issue**: Mic bleed detection and interruption feature not working on mobile (Android tested). The bleed status indicator doesn't appear after first TTS response.

## Git Branch

Working on branch: `continuous-talking`

Recent commits:
1. `feat: add continuous conversation mode with VAD` - Core VAD integration
2. `test: add Playwright e2e tests for continuous mode` - Test infrastructure
3. `feat: add toggle switch for continuous mode, simplify button interactions` - UI changes (toggle later removed)

**Uncommitted changes**: Mic bleed detection and interruption feature

## What's Working

### Continuous Mode (Desktop)
- **Hold button 500ms**: Enters continuous mode
- **Tap while in continuous mode**: Exits continuous mode
- **Escape key**: Exits continuous mode
- **Exit button**: Exits continuous mode
- **VAD**: Detects speech start/end, auto-records
- **Mic bleed prevention**: VAD pauses during TTS + 600ms buffer

### VAD Library Setup (FIXED)
Using older compatible versions:
```html
<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.js"></script>
<script>
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
</script>
<script src="https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.19/dist/bundle.min.js"></script>
```

### Button Interaction Model
- **Tap**: Toggle recording on/off (start/stop)
- **Hold 500ms**: Enter continuous mode
- **Tap while speaking**: Interrupt TTS and start recording
- **Tap in continuous mode**: Exit continuous mode

## What's NOT Working

### Mic Bleed Detection on Mobile
The feature should:
1. On first TTS response, start VAD in "detection mode" for 1.5 seconds
2. If VAD triggers during that window → mic bleed detected → disable voice interruption
3. If no VAD trigger → no bleed → enable voice interruption
4. Show status: "Audio bleed: yes (tap to interrupt)" or "Audio bleed: no (voice interrupts)"

**Problem**: On mobile, no status indicator appears. Detection doesn't seem to run.

**Possible causes**:
- VAD initialization failing silently on mobile
- Microphone permission not granted at time of first TTS
- `startBleedDetection()` not being called (different code path?)
- Console errors not visible

**Debug logging added**:
- `console.log('First TTS - starting bleed detection')` in processQueue
- `console.log('Starting mic bleed detection...')` in startBleedDetection
- `console.log('VAD: Mic bleed detected during TTS')` when bleed detected
- `console.log('No mic bleed detected - interruption enabled')` when no bleed

## Key Code Locations

| Feature | File | Lines (approx) |
|---------|------|----------------|
| Bleed detection state vars | app.js | 106-110 |
| VAD onSpeechStart (bleed check) | app.js | 1117-1140 |
| startBleedDetection() | app.js | 1167-1198 |
| updateBleedStatus() | app.js | 1200-1229 |
| Call to startBleedDetection | app.js | 2106-2109 |
| Tap-to-interrupt (mouse) | app.js | 2367-2372 |
| Tap-to-interrupt (touch) | app.js | 2448-2453 |
| initializeVAD() | app.js | 1098-1164 |
| enterContinuousMode() | app.js | ~1285 |
| exitContinuousMode() | app.js | ~1310 |
| VAD library scripts | index.html | 19-25 |
| Continuous mode styles | style.css | ~500+ |

## State Variables for Bleed Detection

```javascript
let micBleedDetected = null; // null = not yet tested, true = bleed, false = no bleed
let isDetectingBleed = false;
let interruptionEnabled = false;
const BLEED_DETECTION_WINDOW_MS = 1500;
```

## Next Steps for New Agent

1. **Debug on mobile**: Check browser console for errors during first TTS
   - Connect Android device to Chrome DevTools via `chrome://inspect`
   - Look for the debug console.log messages
   - Check if VAD initialization succeeds on mobile

2. **Check microphone permissions**: VAD needs mic access. On mobile, this might not be granted until user first records. Consider:
   - Request mic permission earlier (on page load or first user interaction)
   - Or skip bleed detection until user has recorded at least once

3. **Test on desktop first**: Verify bleed detection works on desktop before debugging mobile

4. **If VAD fails on mobile**: May need to initialize VAD on first user recording, then run bleed detection on second TTS response

## Running the App

```bash
cd /Users/martin/dev/speak

# Start local server
python3 -m http.server 3001

# Start Cloudflare tunnel (for mobile testing)
cloudflared tunnel --url http://localhost:3001 run spraff
# Access at: https://spraff.pllu.ai
```

## Running Tests

```bash
npm install
npm test
```

## Quick Visual Test

To verify you're seeing latest code on mobile, the menu currently says "spraff 4" - change this number to confirm updates are reaching the device.

## VAD Library Reference

- NPM: https://www.npmjs.com/package/@ricky0123/vad-web
- GitHub: https://github.com/ricky0123/vad
- Docs: https://docs.vad.ricky0123.com/
