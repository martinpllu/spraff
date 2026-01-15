// ============ Text-to-Speech ============

import {
  speechQueue,
  isSpeaking,
  shouldStopSpeaking,
  selectedVoiceName,
  setSpeechQueue,
  setIsSpeaking,
  setShouldStopSpeaking,
  speechTotalChars,
  speechSpokenChars,
  setSpeechTotalChars,
  setSpeechSpokenChars,
} from './state';
import { setButtonState, hideStopButton } from './ui';

// Recommended voices - high quality on-device voices
const recommendedVoices = [
  'Samantha (Enhanced)',
  'Ava (Premium)',
  'Zoe (Premium)',
  'Tom (Enhanced)',
  'Serena (Premium)',
  'Daniel (Enhanced)',
  'Karen (Enhanced)',
  'Google UK English Female',
  'Google UK English Male',
  'Google US English',
  // Windows natural voices
  'Microsoft Jenny',
  'Microsoft Aria',
  'Microsoft Guy',
];

// Low quality, novelty, or problematic voices to filter out
const voiceBlacklist = [
  // Apple Novelty/Effects voices
  'Albert',
  'Bad News',
  'Bahh',
  'Bells',
  'Boing',
  'Bubbles',
  'Cellos',
  'Deranged',
  'Fred',
  'Good News',
  'Hysterical',
  'Jester',
  'Junior',
  'Kathy',
  'Organ',
  'Superstar',
  'Trinoids',
  'Whisper',
  'Wobble',
  'Zarvox',
  'Ralph',
  'Agnes',
  'Bruce',
  'Vicki',
  'Victoria',
  'Princess',
  // Apple Eloquence voices (robotic)
  'Eddy',
  'Flo',
  'Grandma',
  'Grandpa',
  'Reed',
  'Rocko',
  'Sandy',
  'Shelley',
  // eSpeak voices
  'eSpeak',
  'espeak',
];

export function isCloudVoice(voice: SpeechSynthesisVoice): boolean {
  return voice.localService === false;
}

export function isBlacklisted(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name;
  return voiceBlacklist.some((blocked) => name.includes(blocked));
}

export function isRecommended(voice: SpeechSynthesisVoice): boolean {
  return recommendedVoices.some((name) => voice.name.includes(name));
}

// Get the default voice using the same logic as processQueue
export function getDefaultVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const preferredLocal = [
    'Ava (Premium)',
    'Ava',
    'Samantha (Enhanced)',
    'Zoe (Premium)',
    'Tom (Enhanced)',
    'Serena (Premium)',
    'Daniel (Enhanced)',
    'Karen (Enhanced)',
    'Alex',
    'Samantha',
    'Daniel',
    'Karen',
    'Moira',
    'Tessa',
  ];

  for (const name of preferredLocal) {
    const voice = voices.find((v) => v.name.includes(name) && v.localService !== false);
    if (voice) return voice;
  }

  // Fallback to any English local voice
  let voice = voices.find((v) => v.lang.startsWith('en') && v.localService !== false);
  if (voice) return voice;

  // Last resort: any English voice
  return voices.find((v) => v.lang.startsWith('en'));
}

export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s)]+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*+]\s+/gm, ', ')
    .replace(/^\d+\.\s+/gm, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function queueSpeech(text: string, isFirst = false): void {
  if (!text.trim() || shouldStopSpeaking) return;
  const sanitized = sanitizeForSpeech(text);
  if (!sanitized) return;

  // Track total characters for progress
  if (isFirst) {
    setSpeechTotalChars(0);
    setSpeechSpokenChars(0);
  }
  setSpeechTotalChars(speechTotalChars + sanitized.length);

  speechQueue.push(sanitized);
  if (!isSpeaking) processQueue();
}

export function processQueue(): void {
  if (shouldStopSpeaking || speechQueue.length === 0) {
    setIsSpeaking(false);
    if (speechQueue.length === 0) {
      hideStopButton();
      setButtonState('ready');
    }
    return;
  }

  setIsSpeaking(true);
  const text = speechQueue.shift()!;
  const textLength = text.length;

  if (!window.speechSynthesis) {
    setSpeechSpokenChars(speechSpokenChars + textLength);
    processQueue();
    return;
  }

  // iOS Safari workaround: cancel any pending speech first
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  // Select voice
  const voices = speechSynthesis.getVoices();
  let voice: SpeechSynthesisVoice | undefined;

  if (selectedVoiceName) {
    voice = voices.find((v) => v.name === selectedVoiceName);
  }

  // Fallback to default voice if selected not found
  if (!voice) {
    voice = getDefaultVoice(voices);
  }

  if (voice) {
    utterance.voice = voice;
  }

  // iOS Safari fix: onend often doesn't fire, use timeout as fallback
  let ended = false;
  const markEnded = (): void => {
    if (ended) return;
    ended = true;
    setSpeechSpokenChars(speechSpokenChars + textLength);
    processQueue();
  };

  utterance.onend = markEnded;
  utterance.onerror = markEnded;

  // Fallback timeout for iOS
  const estimatedDuration = Math.max(2000, text.length * 80);
  setTimeout(() => {
    if (!ended && isSpeaking) {
      console.warn('Speech timeout fallback triggered');
      markEnded();
    }
  }, estimatedDuration);

  // iOS Safari: need to resume in case it's paused
  speechSynthesis.resume();
  speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  setShouldStopSpeaking(true);
  setSpeechQueue([]);
  speechSynthesis.cancel();
  setIsSpeaking(false);
  setButtonState('ready');
  hideStopButton();
}
