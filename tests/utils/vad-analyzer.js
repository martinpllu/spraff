/**
 * VAD Analyzer - Analyzes audio capture data to detect mic bleed issues.
 */

/**
 * Analyze audio capture data for mic bleed.
 * Mic bleed occurs when:
 * 1. MediaRecorder starts during TTS playback
 * 2. VAD triggers during or shortly after TTS ends
 *
 * @param {Object} captureData - Data from getAudioCapture()
 * @returns {Object} Analysis results
 */
export function analyzeMicBleed(captureData) {
  const { events, ttsUtterances, vadEvents } = captureData;

  // Build TTS active periods
  const ttsPeriods = ttsUtterances
    .filter((u) => u.startTime && u.endTime)
    .map((u) => ({
      start: u.startTime,
      end: u.endTime,
      text: u.text,
    }));

  // Find MediaRecorder start events
  const recordingStarts = events
    .filter((e) => e.type === 'mediarecorder_start')
    .map((e) => e.timestamp);

  // Detect mic activity during TTS
  const micActivityDuringTTS = recordingStarts.filter((startTime) =>
    ttsPeriods.some(
      (period) => startTime >= period.start && startTime <= period.end
    )
  );

  // Detect false VAD triggers (within grace period after TTS)
  const GRACE_PERIOD_MS = 600; // Same as SPEECH_END_BUFFER_MS
  const falseVADTriggers = vadEvents.filter((vad) => {
    if (!vad.message.includes('Speech start')) return false;
    return ttsPeriods.some((period) => {
      const afterTTSEnd = vad.timestamp - period.end;
      return afterTTSEnd >= 0 && afterTTSEnd < GRACE_PERIOD_MS;
    });
  });

  // Count total conversation turns (MediaRecorder cycles)
  const recordingCycles = events.filter(
    (e) => e.type === 'mediarecorder_start'
  ).length;

  // Calculate total TTS duration
  const totalTTSDuration = ttsPeriods.reduce(
    (sum, p) => sum + (p.end - p.start),
    0
  );

  return {
    // Core mic bleed indicators
    hasMicBleed: micActivityDuringTTS.length > 0,
    micActivityDuringTTS: micActivityDuringTTS.length,
    falseVADTriggers: falseVADTriggers.length,

    // Metrics
    recordingCycles,
    ttsPeriods: ttsPeriods.length,
    totalTTSDuration,

    // Detailed data for debugging
    details: {
      micActivityTimestamps: micActivityDuringTTS,
      falseVADEvents: falseVADTriggers,
      ttsPeriods,
    },
  };
}

/**
 * Assert no mic bleed occurred.
 * Throws descriptive error if mic bleed detected.
 *
 * @param {Object} analysis - Result from analyzeMicBleed()
 */
export function assertNoMicBleed(analysis) {
  const errors = [];

  if (analysis.hasMicBleed) {
    errors.push(
      `Mic activity detected during TTS: ${analysis.micActivityDuringTTS} occurrences`
    );
  }

  if (analysis.falseVADTriggers > 0) {
    errors.push(
      `False VAD triggers after TTS: ${analysis.falseVADTriggers} occurrences`
    );
  }

  if (errors.length > 0) {
    throw new Error(`Mic bleed detected:\n${errors.join('\n')}`);
  }
}

/**
 * Check if conversation went into an infinite loop.
 * This happens when mic bleed causes repeated recording cycles.
 *
 * @param {Object} analysis - Result from analyzeMicBleed()
 * @param {number} expectedTurns - Expected number of conversation turns
 * @returns {boolean} True if infinite loop detected
 */
export function detectInfiniteLoop(analysis, expectedTurns = 1) {
  // More than 2x expected turns suggests a loop
  return analysis.recordingCycles > expectedTurns * 2;
}
