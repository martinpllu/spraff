// Text-to-speech functionality

import { state } from './state';
import { elements } from './dom';
import { setButtonState } from './ui';
import { dbg } from './debug';
import { sanitizeForSpeech } from './markdown';
import { SPEECH_END_BUFFER_MS } from './config';

// ============ Voice Configuration ============
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

// ============ Voice Helpers ============
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

export function getDefaultVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
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
    const voice = voices.find(
      (v) => v.name.includes(name) && v.localService !== false
    );
    if (voice) return voice;
  }

  // Fallback to any English local voice
  let voice = voices.find(
    (v) => v.lang.startsWith('en') && v.localService !== false
  );
  if (voice) return voice;

  // Last resort: any English voice
  return voices.find((v) => v.lang.startsWith('en'));
}

// ============ Speech Queue ============
export function queueSpeech(text: string, isFirst = false): void {
  if (!text.trim() || state.shouldStopSpeaking) return;
  const sanitized = sanitizeForSpeech(text);
  if (!sanitized) return;

  // Track total characters for progress
  if (isFirst) {
    state.speechTotalChars = 0;
    state.speechSpokenChars = 0;
  }
  state.speechTotalChars += sanitized.length;

  state.speechQueue.push(sanitized);
  if (!state.isSpeaking) processQueue();
}

export function processQueue(): void {
  // Import VAD functions dynamically to avoid circular dependencies
  const resumeVADAfterDelay = async () => {
    const { resumeVADAfterDelay: fn } = await import('./vad');
    fn();
  };

  if (state.shouldStopSpeaking || state.speechQueue.length === 0) {
    state.isSpeaking = false;
    if (state.speechQueue.length === 0) {
      elements.stopBtn.classList.add('hidden');
      // Resume VAD after TTS completes (with buffer delay)
      if (state.continuousModeActive) {
        resumeVADAfterDelay();
      } else {
        setButtonState('ready');
      }
    }
    return;
  }

  state.isSpeaking = true;

  // Import VAD functions dynamically
  const handleVADDuringSpeech = async () => {
    const { suppressVAD } = await import('./vad');
    // Suppress VAD while speaking, UNLESS interruption is enabled (no bleed detected)
    if (state.continuousModeActive && !state.interruptionEnabled) {
      suppressVAD();
    } else if (state.interruptionEnabled && state.vadInstance) {
      // Make sure VAD is running for voice interruption
      state.vadInstance.start();
      dbg('VAD running for interruption during TTS');
    }
  };
  handleVADDuringSpeech();

  const text = state.speechQueue.shift()!;
  const textLength = text.length;

  if (!window.speechSynthesis) {
    state.speechSpokenChars += textLength;
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
  let voice: SpeechSynthesisVoice | null = null;

  if (state.selectedVoiceName) {
    voice = voices.find((v) => v.name === state.selectedVoiceName) || null;
  }

  // Fallback to default voice if selected not found
  if (!voice) {
    voice = getDefaultVoice(voices) || null;
  }

  if (voice) {
    utterance.voice = voice;
  }

  // iOS Safari fix: onend often doesn't fire, use timeout as fallback
  let ended = false;
  const markEnded = () => {
    if (ended) return;
    ended = true;
    state.speechSpokenChars += textLength;
    processQueue();
  };

  utterance.onend = markEnded;
  utterance.onerror = markEnded;

  // Fallback timeout for iOS
  const estimatedDuration = Math.max(2000, text.length * 80);
  setTimeout(() => {
    if (!ended && state.isSpeaking) {
      console.warn('Speech timeout fallback triggered');
      markEnded();
    }
  }, estimatedDuration);

  // iOS Safari: need to resume in case it's paused
  speechSynthesis.resume();
  speechSynthesis.speak(utterance);

  // Start bleed detection on first TTS (only once per session)
  if (state.micBleedDetected === null) {
    console.log('First TTS - starting bleed detection');
    // Debug: show immediate status
    const statusDiv = document.getElementById('bleedStatus');
    if (statusDiv) statusDiv.textContent = 'TTS started...';
    // Import and call bleed detection
    import('./vad').then(({ startBleedDetection }) => {
      startBleedDetection();
    });
  } else if (state.interruptionEnabled && state.vadInstance) {
    // Restart VAD for voice interruption on subsequent TTS
    dbg('Restarting VAD for interruption');
    state.vadInstance.start();
  }
}

export function stopSpeaking(): void {
  state.shouldStopSpeaking = true;
  state.speechQueue = [];
  speechSynthesis.cancel();
  state.isSpeaking = false;
  elements.stopBtn.classList.add('hidden');

  // Import VAD functions dynamically
  const resumeAfterStop = async () => {
    const { resumeVADAfterDelay } = await import('./vad');
    // Resume VAD if in continuous mode (short delay when user stops)
    if (state.continuousModeActive) {
      resumeVADAfterDelay(100);
    } else {
      setButtonState('ready');
    }
  };
  resumeAfterStop();
}

// ============ Voice Settings ============
export function initDefaultVoice(): void {
  if (state.selectedVoiceName) return; // Already have a selection

  const voices = speechSynthesis.getVoices();
  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
  if (englishVoices.length === 0) return;

  const defaultVoice = getDefaultVoice(englishVoices);
  if (defaultVoice) {
    state.selectedVoiceName = defaultVoice.name;
    localStorage.setItem('selectedVoice', defaultVoice.name);
  }
}

export function populateVoiceList(): void {
  const voices = speechSynthesis.getVoices();

  // If voices aren't loaded yet, wait for them
  if (voices.length === 0) {
    return;
  }

  let englishVoices = voices.filter((v) => v.lang.startsWith('en'));

  // Filter out blacklisted low-quality/novelty voices
  englishVoices = englishVoices.filter((v) => !isBlacklisted(v));

  // Deduplicate voices with the same name (macOS returns duplicates at different quality levels)
  const seenNames = new Set<string>();
  englishVoices = englishVoices.filter((v) => {
    if (seenNames.has(v.name)) return false;
    seenNames.add(v.name);
    return true;
  });

  // Ensure we have a default voice selected
  initDefaultVoice();

  // Filter out cloud voices if toggle is off
  if (!state.cloudVoicesEnabled) {
    englishVoices = englishVoices.filter((v) => !isCloudVoice(v));
  }

  // Check if any cloud voices exist
  const allVoices = speechSynthesis.getVoices();
  const hasCloudVoices = allVoices.some(
    (v) => v.lang.startsWith('en') && isCloudVoice(v)
  );

  // Sort: Recommended first, then Cloud (if enabled), then Premium/Enhanced, then alphabetical
  englishVoices.sort((a, b) => {
    const aRec = isRecommended(a);
    const bRec = isRecommended(b);
    // Recommended voices at the very top
    if (aRec && !bRec) return -1;
    if (!aRec && bRec) return 1;
    const aCloud = isCloudVoice(a);
    const bCloud = isCloudVoice(b);
    // Cloud voices next when enabled
    if (aCloud && !bCloud) return -1;
    if (!aCloud && bCloud) return 1;
    const aPremium = a.name.includes('Premium') || a.name.includes('Enhanced');
    const bPremium = b.name.includes('Premium') || b.name.includes('Enhanced');
    if (aPremium && !bPremium) return -1;
    if (!aPremium && bPremium) return 1;
    return a.name.localeCompare(b.name);
  });

  elements.voiceList.innerHTML = '';

  // Update toggle state and visibility
  const toggle = document.getElementById(
    'cloudVoicesToggle'
  ) as HTMLInputElement | null;
  const toggleContainer = document.querySelector(
    '.cloud-toggle'
  ) as HTMLElement | null;
  if (toggle) toggle.checked = state.cloudVoicesEnabled;
  if (toggleContainer)
    toggleContainer.style.display = hasCloudVoices ? '' : 'none';

  // Update current voice display
  const currentVoiceEl = document.getElementById('currentVoiceName');
  if (currentVoiceEl) {
    currentVoiceEl.textContent = state.selectedVoiceName || 'None selected';
  }

  englishVoices.forEach((voice) => {
    const isSelected = state.selectedVoiceName === voice.name;
    const isCloud = isCloudVoice(voice);
    const isRec = isRecommended(voice);
    const item = document.createElement('div');
    item.className = `voice-item${isSelected ? ' selected' : ''}`;
    item.dataset.voiceName = voice.name;

    let badges = '';
    if (isRec)
      badges += '<span class="voice-recommended-badge">recommended</span>';
    if (isCloud) badges += '<span class="voice-cloud-badge">cloud</span>';

    item.innerHTML = `
      <div class="voice-radio"></div>
      <div class="voice-info">
        <div class="voice-name">${voice.name}${badges}</div>
        <div class="voice-lang">${voice.lang}</div>
      </div>
      <button class="voice-preview">Preview</button>
    `;

    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('voice-preview')) return;
      selectVoice(voice.name);
    });

    item.querySelector('.voice-preview')!.addEventListener('click', (e) => {
      e.stopPropagation();
      previewVoice(voice);
    });

    elements.voiceList.appendChild(item);
  });
}

export function selectVoice(voiceName: string): void {
  state.selectedVoiceName = voiceName;
  localStorage.setItem('selectedVoice', voiceName);
  document.querySelectorAll('.voice-item').forEach((item) => {
    const name = (item as HTMLElement).dataset.voiceName;
    item.classList.toggle('selected', name === voiceName);
  });
  // Update current voice display
  const currentVoiceEl = document.getElementById('currentVoiceName');
  if (currentVoiceEl) {
    currentVoiceEl.textContent = voiceName;
  }
}

export function previewVoice(voice: SpeechSynthesisVoice): void {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(
    "Hello! I'm your voice assistant."
  );
  utterance.voice = voice;
  speechSynthesis.speak(utterance);
}

export function openVoiceSettings(): void {
  elements.voiceModal.classList.remove('hidden');

  // Try to populate immediately
  populateVoiceList();

  // If voices weren't ready, wait for them
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    // Set up a one-time handler to populate when voices load
    const onVoicesReady = () => {
      populateVoiceList();
      speechSynthesis.removeEventListener('voiceschanged', onVoicesReady);
    };
    speechSynthesis.addEventListener('voiceschanged', onVoicesReady);
  }
}

export function closeVoiceSettings(): void {
  speechSynthesis.cancel();
  elements.voiceModal.classList.add('hidden');
}
