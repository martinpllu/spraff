# Preact + Signals Migration Plan

Migrate from vanilla TypeScript DOM manipulation to Preact with Signals for reactive state management.

## Current Status: MIGRATION COMPLETE ✅

The migration from vanilla TypeScript DOM manipulation to Preact + Signals has been completed successfully. All 22 tests pass and the bundle size decreased from 72KB to 68KB.

### What Was Done:
- ✅ Preact + Signals installed and configured
- ✅ State migrated to Signals (`src/state/signals.ts`)
- ✅ All Preact components created in `src/components/`
- ✅ Custom hooks created in `src/hooks/`
- ✅ LoginScreen and VoiceScreen components created
- ✅ Header, SettingsDropdown, and BottomBar components created
- ✅ All modal components created (VoiceSettings, About, Cost, Debug, Privacy, Install)
- ✅ App.tsx assembled with full component tree
- ✅ index.html simplified to single mount point
- ✅ Legacy files deleted (dom.ts, ui.ts, events.ts, state.ts, bridge.ts, oauth.ts, speech.ts, audio.ts)
- ✅ api.ts refactored to use signals directly
- ✅ All 22 tests passing

---

## NEXT STEPS FOR COMPLETING MIGRATION

### Step 1: Create LoginScreen Component

Create `src/components/screens/LoginScreen.tsx`:
```tsx
import { apiKey, currentScreen } from '../../state/signals';
import { useOAuth } from '../../hooks';

export function LoginScreen() {
  const { startOAuthFlow } = useOAuth();

  if (apiKey.value) return null; // Already logged in

  return (
    <div class="login-screen">
      {/* Copy structure from index.html login screen */}
    </div>
  );
}
```

### Step 2: Create VoiceScreen Component

Create `src/components/screens/VoiceScreen.tsx` that composes:
- Header with SettingsDropdown
- MessageList (already created)
- TextInput (already created)
- MainButton (already created)
- ModeToggle (already created)

### Step 3: Create VoiceSettings Modal

Create `src/components/modals/VoiceSettings.tsx` - the voice selection modal.

### Step 4: Update App.tsx

Replace the empty App with the full component tree:
```tsx
import { signal } from '@preact/signals';
import { apiKey, currentScreen } from '../state/signals';
import { LoginScreen } from './screens/LoginScreen';
import { VoiceScreen } from './screens/VoiceScreen';
import { AboutModal, CostModal, DebugConsole, PrivacyModal, InstallModal } from './modals';

// Modal state
export const showAboutModal = signal(false);
export const showCostModal = signal(false);
// ... etc

export function App() {
  return (
    <>
      {!apiKey.value && <LoginScreen />}
      {apiKey.value && <VoiceScreen />}

      <AboutModal isOpen={showAboutModal} />
      <CostModal isOpen={showCostModal} />
      <DebugConsole isOpen={showDebugModal} />
      <PrivacyModal isOpen={showPrivacyModal} />
      <InstallModal isOpen={showInstallModal} />
    </>
  );
}
```

### Step 5: Simplify index.html

Remove all the HTML elements from `<body>` except:
```html
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

### Step 6: Update main.tsx

Remove all the legacy init code:
```tsx
import './style.css';
import { render } from 'preact';
import { App } from './components/App';
import { initDebug } from './debug';

initDebug();
render(<App />, document.getElementById('app')!);
```

### Step 7: Delete Legacy Files

Once the Preact app is working:
- Delete `src/dom.ts`
- Delete `src/ui.ts`
- Delete `src/events.ts`
- Delete `src/state.ts`
- Delete `src/audio.ts` (replaced by useAudio hook)
- Delete `src/speech.ts` (replaced by useSpeech hook)
- Delete `src/oauth.ts` (replaced by useOAuth hook)
- Delete `src/state/bridge.ts`

### Step 8: Final Testing

Run `pnpm test` to ensure all 23 tests still pass.

---

## Goals

- Componentize UI for better maintainability
- Simplify state management with Signals
- Keep bundle size small (Preact ~3KB + Signals ~1.5KB)
- Migrate incrementally to reduce risk

---

## Phase 1: Foundation

Set up Preact infrastructure alongside existing code.

### 1.1 Install dependencies

```bash
pnpm add preact @preact/signals
pnpm add -D @preact/preset-vite
```

### 1.2 Configure Vite

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  // ... existing config
});
```

### 1.3 Configure TypeScript

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

### 1.4 Create app shell

Create `src/components/App.tsx` as the root component that initially just wraps existing DOM:

```tsx
export function App() {
  return null; // Initially empty, will grow as we migrate
}
```

Mount alongside existing code in `main.ts`:

```typescript
import { render } from 'preact';
import { App } from './components/App';

render(<App />, document.getElementById('preact-root')!);
// Existing init() continues to work
```

---

## Phase 2: State Migration

Convert `state.ts` to Signals.

### 2.1 Create signal-based state

New file `src/state/signals.ts`:

```typescript
import { signal, computed } from '@preact/signals';
import type { Message, ButtonState } from '../types';

// API & Auth
export const apiKey = signal<string | null>(localStorage.getItem('openrouter_api_key'));

// Conversation
export const messages = signal<Message[]>(loadMessages());
export const messageCount = computed(() => messages.value.length);

// Recording
export const isListening = signal(false);
export const recordingCancelled = signal(false);

// Speech
export const isSpeaking = signal(false);
export const speechQueue = signal<string[]>([]);

// UI
export const buttonState = signal<ButtonState>('ready');
export const isTextMode = signal(localStorage.getItem('textMode') === 'true');
export const currentScreen = signal<'login' | 'voice'>('login');

// Persistence effects
import { effect } from '@preact/signals';

effect(() => {
  localStorage.setItem('conversation', JSON.stringify(messages.value));
});

effect(() => {
  localStorage.setItem('textMode', String(isTextMode.value));
});
```

### 2.2 Create bridge functions

Temporary bridge in `src/state/bridge.ts` to allow existing code to work:

```typescript
import { messages, isListening, /* etc */ } from './signals';

// Old API -> New signals
export function getConversationHistory() {
  return messages.value;
}

export function addMessage(msg: Message) {
  messages.value = [...messages.value, msg];
}

// Re-export for gradual migration
export * from './signals';
```

### 2.3 Update imports incrementally

Replace imports in existing files one at a time:

```typescript
// Before
import { getConversationHistory, addMessage } from './state';

// After
import { messages, addMessage } from './state/bridge';
// Then use messages.value where needed
```

---

## Phase 3: Component Migration

Migrate UI piece by piece, starting with leaf components.

### 3.1 Component structure

```
src/
  components/
    App.tsx              # Root component
    screens/
      LoginScreen.tsx    # OAuth login
      VoiceScreen.tsx    # Main chat interface
    chat/
      MessageList.tsx    # Conversation history
      MessageGroup.tsx   # Single message bubble
      StreamingMessage.tsx # Live streaming response
    controls/
      MainButton.tsx     # Record/send button
      ModeToggle.tsx     # Voice/text switch
      TextInput.tsx      # Text mode input
    modals/
      VoiceSettings.tsx  # Voice selection
      CostModal.tsx      # Usage stats
      DebugConsole.tsx   # Debug logs
      AboutModal.tsx     # Build info
    layout/
      Header.tsx         # Top bar with menu
      SettingsDropdown.tsx
```

### 3.2 Migration order

Start with isolated components, work toward the core:

1. **Modals** (AboutModal, DebugConsole) - isolated, easy win
2. **MessageGroup** - stateless, just renders a message
3. **MessageList** - reads from `messages` signal
4. **Header + SettingsDropdown** - simple UI state
5. **ModeToggle** - reads/writes `isTextMode` signal
6. **TextInput** - form handling
7. **MainButton** - complex but isolated logic
8. **StreamingMessage** - needs streaming integration
9. **VoiceScreen** - compose child components
10. **LoginScreen** - OAuth flow
11. **App** - final assembly, remove legacy code

### 3.3 Example: MessageGroup component

```tsx
// src/components/chat/MessageGroup.tsx
import { Message } from '../../types';
import { parseMarkdown } from '../../markdown';

interface Props {
  message: Message;
}

export function MessageGroup({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div class={`message-group ${isUser ? 'user' : 'assistant'}`}>
      <div class="avatar">{isUser ? 'You' : 'AI'}</div>
      <div
        class="message-content"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
      />
    </div>
  );
}
```

### 3.4 Example: MessageList with signals

```tsx
// src/components/chat/MessageList.tsx
import { messages } from '../../state/signals';
import { MessageGroup } from './MessageGroup';

export function MessageList() {
  return (
    <div class="message-list">
      {messages.value.map((msg, i) => (
        <MessageGroup key={i} message={msg} />
      ))}
    </div>
  );
}
```

---

## Phase 4: Logic Migration

Move business logic into hooks and keep components thin.

### 4.1 Custom hooks

```
src/
  hooks/
    useAudio.ts        # Recording logic from audio.ts
    useSpeech.ts       # TTS logic from speech.ts
    useApi.ts          # API streaming from api.ts
    useOAuth.ts        # Auth flow from oauth.ts
```

### 4.2 Example: useAudio hook

```typescript
// src/hooks/useAudio.ts
import { signal } from '@preact/signals';
import { isListening, recordingCancelled } from '../state/signals';

export function useAudio() {
  const mediaRecorder = signal<MediaRecorder | null>(null);

  async function startRecording() {
    isListening.value = true;
    recordingCancelled.value = false;
    // ... existing logic from audio.ts
  }

  function stopRecording() {
    isListening.value = false;
    mediaRecorder.value?.stop();
  }

  function cancelRecording() {
    recordingCancelled.value = true;
    stopRecording();
  }

  return { startRecording, stopRecording, cancelRecording };
}
```

### 4.3 Streaming integration

The streaming response pattern stays similar but updates signals:

```typescript
// In api hook or utility
import { streamingContent } from '../state/signals';

async function streamResponse(reader: ReadableStreamDefaultReader) {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Signal update triggers component re-render
    streamingContent.value += decodeChunk(value);
  }
}
```

---

## Phase 5: Cleanup

Remove legacy code once migration is complete.

### 5.1 Files to delete

- `src/dom.ts` - replaced by component refs
- `src/ui.ts` - replaced by components
- `src/events.ts` - replaced by component event handlers
- `src/state.ts` - replaced by signals

### 5.2 Files to keep (refactored)

- `src/api.ts` → `src/hooks/useApi.ts` or `src/services/api.ts`
- `src/audio.ts` → `src/hooks/useAudio.ts`
- `src/speech.ts` → `src/hooks/useSpeech.ts`
- `src/oauth.ts` → `src/hooks/useOAuth.ts`
- `src/markdown.ts` - keep as utility
- `src/debug.ts` - keep, maybe wrap in hook
- `src/config.ts` - keep as constants
- `src/types.ts` - keep, extend as needed

### 5.3 Update HTML

Simplify `index.html` to single mount point:

```html
<body>
  <div id="app"></div>
</body>
```

---

## Migration Checklist

### Phase 1: Foundation ✅
- [x] Install preact and @preact/signals
- [x] Configure Vite with @preact/preset-vite
- [x] Update tsconfig.json for JSX
- [x] Create App.tsx shell
- [x] Add preact-root to index.html
- [x] Verify existing app still works

### Phase 2: State ✅
- [x] Create src/state/signals.ts with all signals
- [x] Create bridge.ts for backwards compatibility
- [x] Add persistence effects
- [x] Migrate state.ts imports one file at a time
- [x] Verify state persistence works

### Phase 3: Components ✅ (Created, not yet connected)
- [x] AboutModal
- [x] DebugConsole
- [x] MessageGroup
- [x] MessageList
- [ ] Header + SettingsDropdown
- [x] ModeToggle
- [x] TextInput
- [x] MainButton
- [ ] StreamingMessage
- [ ] VoiceSettings modal
- [x] CostModal
- [x] PrivacyModal
- [x] InstallModal
- [ ] VoiceScreen
- [ ] LoginScreen
- [ ] App (final assembly)

### Phase 4: Logic ✅ (Created, not yet connected)
- [x] useAudio hook
- [x] useSpeech hook
- [ ] useApi hook (API still uses standalone functions)
- [x] useOAuth hook
- [ ] Remove legacy dom.ts references
- [ ] Remove legacy ui.ts references
- [ ] Remove legacy events.ts references

### Phase 5: Cleanup (Pending)
- [ ] Delete dom.ts
- [ ] Delete ui.ts
- [ ] Delete events.ts
- [ ] Delete state.ts
- [ ] Delete bridge.ts
- [ ] Simplify index.html
- [ ] Final testing pass
- [x] Update CLAUDE.md with new architecture

---

## Risk Mitigation

1. **Keep existing code working** - Mount Preact alongside, don't break what works
2. **Test after each component** - Run the app after every migration step
3. **Git commits per component** - Easy to revert if something breaks
4. **Bridge pattern** - Old code can call new signals during transition
5. **No big bang rewrite** - Incremental migration reduces risk

---

## Estimated Effort

- Phase 1: ~1 hour
- Phase 2: ~2 hours
- Phase 3: ~6-8 hours (largest phase)
- Phase 4: ~3-4 hours
- Phase 5: ~1-2 hours

Total: ~15-20 hours of focused work, spread across multiple sessions.
