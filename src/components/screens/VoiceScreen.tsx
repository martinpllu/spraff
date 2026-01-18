import { Signal, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Header } from '../layout/Header';
import { BottomBar } from '../layout/BottomBar';
import { MessageList } from '../chat/MessageList';
import { TextInput } from '../controls/TextInput';
import { MainButton } from '../controls/MainButton';
import { VoiceSettings } from '../modals/VoiceSettings';
import { AboutModal } from '../modals/AboutModal';
import { CostModal } from '../modals/CostModal';
import { DebugConsole } from '../modals/DebugConsole';
import { InstallModal } from '../modals/InstallModal';
import { ChatSidebar } from '../sidebar/ChatSidebar';
import { useAudio, blobToBase64, convertToWav } from '../../hooks/useAudio';
import {
  isTextMode,
  buttonState,
  shouldStopSpeaking,
  setLastVoiceSize,
  currentChat,
} from '../../state/signals';
import { sendAudioToAPI } from '../../api';
import { dbg } from '../../debug';

interface Props {
  showAbout: Signal<boolean>;
  showCost: Signal<boolean>;
  showDebug: Signal<boolean>;
  showPrivacy: Signal<boolean>;
  showInstall: Signal<boolean>;
  showVoice: Signal<boolean>;
}

export function VoiceScreen({
  showAbout,
  showCost,
  showDebug,
  showPrivacy,
  showInstall,
  showVoice,
}: Props) {
  const showInstallButton = useSignal(false);
  const { startRecording, stopRecording, cancelRecording } = useAudio();

  // Check if we should show install button (iOS Safari, not in standalone mode)
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    showInstallButton.value = isIOS && !isStandalone;
  }, []);

  // Keyboard shortcut for voice mode - toggle on Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only in voice mode
      if (isTextMode.value) return;

      // Space to toggle recording
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (buttonState.value === 'ready') {
          handlePress();
        } else if (buttonState.value === 'listening') {
          handleRelease();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handlePress = async () => {
    if (buttonState.value !== 'ready') return;
    shouldStopSpeaking.value = false;
    try {
      await startRecording();
    } catch (error) {
      dbg(`Failed to start recording: ${error}`, 'error');
    }
  };

  const handleRelease = async () => {
    if (buttonState.value !== 'listening') return;

    const audioBlob = await stopRecording();
    if (!audioBlob) return;

    try {
      const wavBlob = await convertToWav(audioBlob);
      setLastVoiceSize(wavBlob.size);
      const base64Audio = await blobToBase64(wavBlob);

      await sendAudioToAPI(base64Audio);
    } catch (error) {
      dbg(`Failed to send audio: ${error}`, 'error');
      buttonState.value = 'ready';
    }
  };

  const handleCancel = () => {
    cancelRecording();
  };

  const chatTitle = currentChat.value?.title || 'New Chat';

  return (
    <div class="voice-screen">
      <ChatSidebar />

      <Header
        onVoiceSettings={() => (showVoice.value = true)}
        onCost={() => (showCost.value = true)}
        onDebug={() => (showDebug.value = true)}
        onAbout={() => (showAbout.value = true)}
        onPrivacy={() => (showPrivacy.value = true)}
        onInstall={() => (showInstall.value = true)}
        showInstall={showInstallButton.value}
      />

      <MessageList />

      <TextInput />

      <MainButton onPress={handlePress} onRelease={handleRelease} chatTitle={chatTitle} />

      {!isTextMode.value && (
        <div class="hint-text">
          Tap or <kbd>Space</kbd> to speak
        </div>
      )}

      <BottomBar onCancel={handleCancel} />

      {/* Modals */}
      <VoiceSettings isOpen={showVoice} />
      <AboutModal isOpen={showAbout} />
      <CostModal isOpen={showCost} />
      <DebugConsole isOpen={showDebug} />
      <InstallModal isOpen={showInstall} />
      {/* Note: PrivacyModal is rendered at App level so it's accessible when logged out */}
    </div>
  );
}
