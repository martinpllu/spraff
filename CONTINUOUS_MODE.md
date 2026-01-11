# Continuous Chat Mode - Implementation Progress

> **IMPORTANT FOR AGENTS**: Keep this file updated as you work. Add notes about what you tried, what worked, what didn't, and any errors encountered. This helps future sessions continue effectively.

## Overview

Adding a continuous conversation mode to Spraff where users can have a hands-free chat. The key challenge is **mic bleed** - when the assistant speaks through speakers, VAD (Voice Activity Detection) may detect it as user speech, causing infinite loops.

## Current Status: Voice Interruption Working, Short Utterances Being Missed

**Date**: January 2025
**Version**: 29c98b

### What's Working
- Bleed detection runs on first TTS after mic permission granted
- Voice interruption works when no bleed detected
- Interruption works on ALL TTS responses (not just first one) - fixed by ensuring VAD runs during TTS when `interruptionEnabled=true`
- Debug console accessible via Menu > Debug
- Version displayed in About modal

### Current Issue
**Short utterances (single words like "yes", "no") are being missed by VAD**

This is likely a VAD sensitivity issue. Current VAD config in `initializeVAD()`:
```javascript
positiveSpeechThreshold: 0.8,  // May be too high for short words
negativeSpeechThreshold: 0.3,
redemptionFrames: 8,
minSpeechFrames: 4,  // Minimum frames before triggering - may filter out short words
preSpeechPadFrames: 3,
```

Possible fixes to try:
1. Lower `positiveSpeechThreshold` (e.g., 0.6 or 0.5)
2. Reduce `minSpeechFrames` (e.g., 2 or 3)
3. Reduce `redemptionFrames` for faster detection

## Git Branch

Working on branch: `continuous-talking`

**Uncommitted changes**:
- Mic bleed detection and voice interruption feature
- Debug console
- Service worker disabled for debugging
- Cache-busting versioning system

## Key Fixes Made This Session

1. **Debug console not showing logs**: app.js was overwriting `window.debugLogs` array. Fixed by using existing array: `const debugLogs = window.debugLogs || [];`

2. **Bleed detection not running on mobile**: `micPermissionGranted` flag wasn't being set when VAD initialized (only when `startRecording()` called). Fixed by setting flag in `initializeVAD()` too.

3. **Voice interruption only working on first TTS**: VAD was being suppressed during ALL TTS in continuous mode. Fixed by only suppressing when `!interruptionEnabled`:
   ```javascript
   if (continuousModeActive && !interruptionEnabled) {
     suppressVAD();
   } else if (interruptionEnabled && vadInstance) {
     vadInstance.start();
   }
   ```

4. **Cache issues on mobile**: Added cache-busting query param to app.js script tag and moved version to About modal.

## How Bleed Detection Works

### Flow
1. User records voice → mic permission granted → `micPermissionGranted = true`
2. TTS plays → `startBleedDetection()` called (first TTS only)
3. VAD initialized and starts listening for 1.5 seconds
4. If VAD detects speech during TTS → bleed detected → `interruptionEnabled = false`
5. If no speech detected → no bleed → `interruptionEnabled = true`

### During Subsequent TTS
- If `interruptionEnabled=true`: VAD runs during TTS to allow voice interruption
- If `interruptionEnabled=false`: VAD suppressed during TTS to prevent bleed loop

### Interruption Behavior
- **Tap while speaking**: ALWAYS works (stops TTS, starts recording)
- **Voice interrupt**: Only works if `interruptionEnabled = true` (no bleed detected)

## Debug Console

Access via Menu > Debug. Key log messages:
- `MIC GRANTED via startRecording` / `MIC GRANTED via VAD init`
- `BLEED CHECK: micPermissionGranted=...`
- `BLEED DETECTING...`
- `BLEED RESULT: NO BLEED - interruption ON` / `BLEED RESULT: YES BLEED - interruption OFF`
- `VAD running for interruption during TTS`
- `Restarting VAD for interruption`

## Version Management

See `CLAUDE.md` for version update instructions. Generate new version:
```bash
head -c 3 /dev/urandom | xxd -p
```

Update in two places:
1. `index.html` About modal: `Version: XXXXXX`
2. `index.html` script tag: `app.js?v=XXXXXX`

## State Variables

```javascript
let micBleedDetected = null; // null = not yet tested, true = bleed, false = no bleed
let isDetectingBleed = false;
let interruptionEnabled = false;
let micPermissionGranted = false;
const BLEED_DETECTION_WINDOW_MS = 1500;
```

## VAD Configuration (Current)

```javascript
vadInstance = await vad.MicVAD.new({
  positiveSpeechThreshold: 0.8,
  negativeSpeechThreshold: 0.3,
  redemptionFrames: 8,
  minSpeechFrames: 4,
  preSpeechPadFrames: 3,
  submitUserSpeechOnPause: false,
  // ... callbacks
});
```

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

## VAD Library Reference

- NPM: https://www.npmjs.com/package/@ricky0123/vad-web
- GitHub: https://github.com/ricky0123/vad
- Docs: https://docs.vad.ricky0123.com/

## Next Steps for New Agent

1. **Fix short utterance detection**: Adjust VAD parameters to catch single words like "yes", "no"
   - Try lowering `positiveSpeechThreshold` to 0.5-0.6
   - Try reducing `minSpeechFrames` to 2-3
   - Test with various short words

2. **Clean up debug code**: Once stable, consider removing or reducing debug logging

3. **Re-enable service worker**: Currently disabled for debugging. Re-enable when ready:
   ```javascript
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.register('./sw.js').catch(() => {});
   }
   ```

4. **Commit changes**: All the bleed detection and interruption work is uncommitted
