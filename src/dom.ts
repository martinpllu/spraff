// ============ DOM Element References ============
// Helper to safely get element
function getEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

// Screens
export const loginScreen = getEl('loginScreen');
export const voiceScreen = getEl('voiceScreen');

// Login elements
export const loginBtn = getEl('loginBtn');

// Settings menu
export const settingsMenu = getEl('settingsMenu');
export const settingsMenuBtn = getEl('settingsMenuBtn');
export const settingsDropdown = getEl('settingsDropdown');
export const voiceSettingsBtn = getEl('voiceSettingsBtn');
export const costSettingsBtn = getEl('costSettingsBtn');
export const copyChatBtn = getEl('copyChatBtn');
export const aboutBtn = getEl('aboutBtn');
export const privacyBtn = getEl('privacyBtn');
export const logoutBtn = getEl('logoutBtn');
export const installBtn = getEl('installBtn');
export const debugBtn = getEl('debugBtn');

// Main button and status
export const mainButton = getEl('mainButton');
export const statusText = getEl('statusText');
export const hintText = getEl('hintText');
export const stopBtn = getEl('stopBtn');
export const cancelBtn = getEl('cancelBtn');

// Voice modal
export const voiceModal = getEl('voiceModal');
export const modalClose = getEl('modalClose');
export const voiceList = getEl('voiceList');

// Cost modal
export const costModal = getEl('costModal');
export const costModalClose = getEl('costModalClose');
export const costBalance = getEl('costBalance');
export const costLast = getEl('costLast');
export const costSession = getEl('costSession');
export const costVoiceSize = getEl('costVoiceSize');
export const voiceSizeStat = getEl('voiceSizeStat');

// About modal
export const aboutModal = getEl('aboutModal');
export const aboutModalClose = getEl('aboutModalClose');

// Privacy modal
export const privacyModal = getEl('privacyModal');
export const privacyModalClose = getEl('privacyModalClose');

// Install modal
export const installModal = getEl('installModal');
export const installModalClose = getEl('installModalClose');

// Debug modal
export const debugModal = getEl('debugModal');
export const debugModalClose = getEl('debugModalClose');
export const debugContent = getEl('debugContent');
export const debugClearBtn = getEl('debugClearBtn');

// Error toast
export const errorToast = getEl('errorToast');

// Text input
export const textInputContainer = getEl('textInputContainer');
export const textInput = getEl('textInput') as HTMLTextAreaElement;
export const textSendBtn = getEl('textSendBtn');

// Mode toggle
export const modeToggle = getEl('modeToggle');
export const voiceModeBtn = getEl('voiceModeBtn');
export const textModeBtn = getEl('textModeBtn');

// Conversation history
export const conversationHistoryEl = getEl('conversationHistory');

// Clear chat
export const clearChatBtn = getEl('clearChatBtn');
export const clearChatBadge = getEl('clearChatBadge');
