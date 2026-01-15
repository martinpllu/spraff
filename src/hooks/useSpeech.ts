// ============ Text-to-Speech Hook ============

import { isSpeaking } from '../state/signals';
import {
  queueSpeech,
  stopSpeaking,
  isCloudVoice,
  isBlacklisted,
  isRecommended,
  getDefaultVoice,
} from '../speech';

export function useSpeech() {
  return {
    queueSpeech,
    stopSpeaking,
    isSpeaking,
    isCloudVoice,
    isBlacklisted,
    isRecommended,
    getDefaultVoice,
  };
}
