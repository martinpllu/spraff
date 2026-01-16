// ============ Type Definitions ============

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

export interface Stats {
  sessionCost: number;
  lastCost: number;
  lastVoiceSize: number;
}

export interface ToolCall {
  tool: string;
  args?: Record<string, unknown>;
}

export interface APIUsage {
  cost?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
}

export interface StreamResult {
  fullResponse: string;
  usage: APIUsage | null;
}

export type ButtonState = 'ready' | 'listening' | 'processing' | 'speaking';

export type DebugLevel = 'log' | 'warn' | 'error';

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface DebugLogEntry {
  timestamp: number;
  level: DebugLevel;
  message: string;
}

// ============ Google Sync Types ============

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleTokens {
  accessToken: string;
  expiresAt: number;
}

export interface DriveData {
  version: number;
  syncedAt: number;
  chats: Chat[];
}

declare global {
  interface Window {
    debugLogs: DebugLogEntry[];
    dbg: (msg: string, level?: DebugLevel) => void;
    audioUnlocked?: boolean;
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}
