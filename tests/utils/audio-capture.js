/**
 * Audio capture utilities for testing VAD and mic bleed detection.
 * Hooks into browser audio APIs to capture timing events.
 */

/**
 * Inject audio capture hooks into the page.
 * This captures timing of MediaRecorder and SpeechSynthesis events.
 */
export async function injectAudioCapture(page) {
  await page.evaluate(() => {
    window._audioCapture = {
      events: [],
      micChunks: [],
      ttsUtterances: [],
      vadEvents: [],
    };

    const logEvent = (type, data = {}) => {
      window._audioCapture.events.push({
        type,
        timestamp: Date.now(),
        ...data,
      });
    };

    // Hook into MediaRecorder
    const OriginalMediaRecorder = window.MediaRecorder;
    window.MediaRecorder = class extends OriginalMediaRecorder {
      constructor(stream, options) {
        super(stream, options);

        this.addEventListener('start', () => {
          logEvent('mediarecorder_start');
        });

        this.addEventListener('stop', () => {
          logEvent('mediarecorder_stop');
        });

        this.addEventListener('dataavailable', (e) => {
          window._audioCapture.micChunks.push({
            timestamp: Date.now(),
            size: e.data.size,
          });
        });
      }
    };

    // Hook into SpeechSynthesis
    const originalSpeak = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = function (utterance) {
      const id = Date.now();
      const text = utterance.text;

      logEvent('tts_start', { id, text: text.substring(0, 50) });
      window._audioCapture.ttsUtterances.push({
        id,
        text,
        startTime: Date.now(),
        endTime: null,
      });

      const originalOnEnd = utterance.onend;
      utterance.onend = function (event) {
        logEvent('tts_end', { id });
        const utteranceRecord = window._audioCapture.ttsUtterances.find(
          (u) => u.id === id
        );
        if (utteranceRecord) {
          utteranceRecord.endTime = Date.now();
        }
        if (originalOnEnd) originalOnEnd.call(this, event);
      };

      const originalOnError = utterance.onerror;
      utterance.onerror = function (event) {
        logEvent('tts_error', { id, error: event.error });
        if (originalOnError) originalOnError.call(this, event);
      };

      return originalSpeak(utterance);
    };

    // Hook into console.log to capture VAD events
    const originalConsoleLog = console.log.bind(console);
    console.log = function (...args) {
      const message = args.join(' ');
      if (message.includes('VAD:')) {
        logEvent('vad_log', { message });
        window._audioCapture.vadEvents.push({
          timestamp: Date.now(),
          message,
        });
      }
      return originalConsoleLog(...args);
    };
  });
}

/**
 * Get the captured audio timeline from the page.
 */
export async function getAudioCapture(page) {
  return await page.evaluate(() => window._audioCapture);
}

/**
 * Clear the captured audio data.
 */
export async function clearAudioCapture(page) {
  await page.evaluate(() => {
    window._audioCapture = {
      events: [],
      micChunks: [],
      ttsUtterances: [],
      vadEvents: [],
    };
  });
}

/**
 * Wait for TTS to complete (all utterances finished).
 */
export async function waitForTTSComplete(page, timeoutMs = 30000) {
  await page.waitForFunction(
    () => {
      const capture = window._audioCapture;
      if (!capture || capture.ttsUtterances.length === 0) return false;
      return capture.ttsUtterances.every((u) => u.endTime !== null);
    },
    { timeout: timeoutMs }
  );
}

/**
 * Wait for a specific number of TTS utterances to start.
 */
export async function waitForTTSStart(page, count = 1, timeoutMs = 10000) {
  await page.waitForFunction(
    (expectedCount) => {
      const capture = window._audioCapture;
      return capture && capture.ttsUtterances.length >= expectedCount;
    },
    count,
    { timeout: timeoutMs }
  );
}
