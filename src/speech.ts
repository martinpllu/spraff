// ============ Speech Utilities ============

import {
  isSpeaking,
  shouldStopSpeaking,
  speechQueue,
  speechTotalChars,
  speechSpokenChars,
  selectedVoiceName,
  setButtonState,
} from './state/signals';

// Recommended voices - high quality on-device voices
export const recommendedVoices = [
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
  'Microsoft Jenny',
  'Microsoft Aria',
  'Microsoft Guy',
];

// Low quality or novelty voices to filter out
export const voiceBlacklist = [
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
  'Eddy',
  'Flo',
  'Grandma',
  'Grandpa',
  'Reed',
  'Rocko',
  'Sandy',
  'Shelley',
  'eSpeak',
  'espeak',
];

export function isCloudVoice(voice: SpeechSynthesisVoice): boolean {
  return voice.localService === false;
}

export function isBlacklisted(voice: SpeechSynthesisVoice): boolean {
  return voiceBlacklist.some((blocked) => voice.name.includes(blocked));
}

export function isRecommended(voice: SpeechSynthesisVoice): boolean {
  return recommendedVoices.some((name) => voice.name.includes(name));
}

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

  let voice = voices.find((v) => v.lang.startsWith('en') && v.localService !== false);
  if (voice) return voice;

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
  if (!text.trim() || shouldStopSpeaking.value) return;
  const sanitized = sanitizeForSpeech(text);
  if (!sanitized) return;

  if (isFirst) {
    speechTotalChars.value = 0;
    speechSpokenChars.value = 0;
  }
  speechTotalChars.value += sanitized.length;

  speechQueue.value = [...speechQueue.value, sanitized];
  if (!isSpeaking.value) processQueue();
}

export function processQueue(): void {
  const queue = speechQueue.value;
  if (shouldStopSpeaking.value || queue.length === 0) {
    isSpeaking.value = false;
    if (queue.length === 0) {
      setButtonState('ready');
    }
    return;
  }

  isSpeaking.value = true;
  const [text, ...rest] = queue;
  speechQueue.value = rest;
  const textLength = text?.length ?? 0;

  if (!window.speechSynthesis) {
    speechSpokenChars.value += textLength;
    processQueue();
    return;
  }

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices = speechSynthesis.getVoices();
  let voice: SpeechSynthesisVoice | undefined;

  const voiceName = selectedVoiceName.value;
  if (voiceName) {
    voice = voices.find((v) => v.name === voiceName);
  }

  if (!voice) {
    voice = getDefaultVoice(voices);
  }

  if (voice) {
    utterance.voice = voice;
  }

  let ended = false;
  const markEnded = (): void => {
    if (ended) return;
    ended = true;
    speechSpokenChars.value += textLength;
    processQueue();
  };

  utterance.onend = markEnded;
  utterance.onerror = markEnded;

  const estimatedDuration = Math.max(2000, textLength * 80);
  setTimeout(() => {
    if (!ended && isSpeaking.value) {
      console.warn('Speech timeout fallback triggered');
      markEnded();
    }
  }, estimatedDuration);

  speechSynthesis.resume();
  speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  shouldStopSpeaking.value = true;
  speechQueue.value = [];
  speechSynthesis.cancel();
  isSpeaking.value = false;
  setButtonState('ready');
}
