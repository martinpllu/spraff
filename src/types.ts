// Type definitions for Spraff

export interface Stats {
  sessionCost: number;
  lastCost: number;
  lastVoiceSize: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
}

export interface MessageContent {
  type: 'text' | 'input_audio';
  text?: string;
  input_audio?: {
    data: string;
    format: string;
  };
}

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
}

export interface OpenRouterResponse {
  id: string;
  choices: {
    delta?: {
      content?: string;
    };
    message?: {
      content: string;
    };
  }[];
  usage?: OpenRouterUsage;
}

export interface ToolCall {
  tool: string;
  args?: Record<string, unknown>;
}

export interface VADInstance {
  start: () => void;
  pause: () => void;
}

export type ButtonState =
  | 'ready'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'continuous-ready'
  | 'continuous-listening';

// Global declarations for external libraries
declare global {
  interface Window {
    debugLogs: string[];
    dbg: (msg: string) => void;
    audioUnlocked?: boolean;
    webkitAudioContext?: typeof AudioContext;
  }

  interface ScreenOrientation {
    lock?(orientation: string): Promise<void>;
  }

  // VAD library from CDN - MicVAD.new() is a static factory method
  const vad: {
    MicVAD: {
      new: (options: VADOptions) => Promise<VADInstance>;
    };
  };

  // ONNX Runtime from CDN
  const ort: {
    env: {
      wasm: {
        wasmPaths: string;
      };
    };
  };
}

export interface VADOptions {
  positiveSpeechThreshold?: number;
  negativeSpeechThreshold?: number;
  redemptionFrames?: number;
  minSpeechFrames?: number;
  preSpeechPadFrames?: number;
  submitUserSpeechOnPause?: boolean;
  onFrameProcessed?: (probs: number, frame: Float32Array) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: (audio: Float32Array) => void;
  onVADMisfire?: () => void;
}
