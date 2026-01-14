// DOM element references

export const elements = {
  // Screens
  loginScreen: document.getElementById('loginScreen') as HTMLElement,
  voiceScreen: document.getElementById('voiceScreen') as HTMLElement,

  // Buttons
  loginBtn: document.getElementById('loginBtn') as HTMLButtonElement,
  logoutBtn: document.getElementById('logoutBtn') as HTMLButtonElement,
  mainButton: document.getElementById('mainButton') as HTMLButtonElement,
  stopBtn: document.getElementById('stopBtn') as HTMLButtonElement,
  cancelBtn: document.getElementById('cancelBtn') as HTMLButtonElement,
  installBtn: document.getElementById('installBtn') as HTMLButtonElement,
  clearChatBtn: document.getElementById('clearChatBtn') as HTMLButtonElement,
  textSendBtn: document.getElementById('textSendBtn') as HTMLButtonElement,

  // Status and hints
  statusText: document.getElementById('statusText') as HTMLElement,
  hintText: document.getElementById('hintText') as HTMLElement,
  errorToast: document.getElementById('errorToast') as HTMLElement,
  clearChatBadge: document.getElementById('clearChatBadge') as HTMLElement,

  // Settings menu
  settingsMenu: document.getElementById('settingsMenu') as HTMLElement,
  settingsMenuBtn: document.getElementById('settingsMenuBtn') as HTMLButtonElement,
  settingsDropdown: document.getElementById('settingsDropdown') as HTMLElement,
  voiceSettingsBtn: document.getElementById(
    'voiceSettingsBtn'
  ) as HTMLButtonElement,
  costSettingsBtn: document.getElementById(
    'costSettingsBtn'
  ) as HTMLButtonElement,
  copyChatBtn: document.getElementById('copyChatBtn') as HTMLButtonElement,
  aboutBtn: document.getElementById('aboutBtn') as HTMLButtonElement,
  privacyBtn: document.getElementById('privacyBtn') as HTMLButtonElement,
  debugBtn: document.getElementById('debugBtn') as HTMLButtonElement,

  // Voice modal
  voiceModal: document.getElementById('voiceModal') as HTMLElement,
  modalClose: document.getElementById('modalClose') as HTMLButtonElement,
  voiceList: document.getElementById('voiceList') as HTMLElement,

  // Cost modal
  costModal: document.getElementById('costModal') as HTMLElement,
  costModalClose: document.getElementById('costModalClose') as HTMLButtonElement,
  costBalance: document.getElementById('costBalance') as HTMLElement,
  costLast: document.getElementById('costLast') as HTMLElement,
  costSession: document.getElementById('costSession') as HTMLElement,
  costVoiceSize: document.getElementById('costVoiceSize') as HTMLElement,
  voiceSizeStat: document.getElementById('voiceSizeStat') as HTMLElement,

  // About modal
  aboutModal: document.getElementById('aboutModal') as HTMLElement,
  aboutModalClose: document.getElementById('aboutModalClose') as HTMLButtonElement,

  // Privacy modal
  privacyModal: document.getElementById('privacyModal') as HTMLElement,
  privacyModalClose: document.getElementById(
    'privacyModalClose'
  ) as HTMLButtonElement,

  // Debug modal
  debugModal: document.getElementById('debugModal') as HTMLElement,
  debugModalClose: document.getElementById(
    'debugModalClose'
  ) as HTMLButtonElement,
  debugClearBtn: document.getElementById('debugClearBtn') as HTMLButtonElement,

  // Install modal
  installModal: document.getElementById('installModal') as HTMLElement,
  installModalClose: document.getElementById(
    'installModalClose'
  ) as HTMLButtonElement,

  // VAD download modal
  vadDownloadModal: document.getElementById('vadDownloadModal') as HTMLElement,
  vadDownloadModalClose: document.getElementById(
    'vadDownloadModalClose'
  ) as HTMLButtonElement,
  vadDownloadSize: document.getElementById('vadDownloadSize') as HTMLElement,
  vadDownloadProgress: document.getElementById(
    'vadDownloadProgress'
  ) as HTMLElement,
  vadDownloadStatus: document.getElementById('vadDownloadStatus') as HTMLElement,
  vadDownloadActions: document.getElementById(
    'vadDownloadActions'
  ) as HTMLElement,
  vadDownloadCancel: document.getElementById(
    'vadDownloadCancel'
  ) as HTMLButtonElement,
  vadDownloadConfirm: document.getElementById(
    'vadDownloadConfirm'
  ) as HTMLButtonElement,

  // Text mode
  textInputContainer: document.getElementById(
    'textInputContainer'
  ) as HTMLElement,
  textInput: document.getElementById('textInput') as HTMLTextAreaElement,
  modeToggle: document.getElementById('modeToggle') as HTMLElement,
  voiceModeBtn: document.getElementById('voiceModeBtn') as HTMLButtonElement,
  textModeBtn: document.getElementById('textModeBtn') as HTMLButtonElement,
  conversationHistoryEl: document.getElementById(
    'conversationHistory'
  ) as HTMLElement,

  // Continuous mode toggle
  continuousToggle: document.getElementById('continuousToggle') as HTMLElement,
};
