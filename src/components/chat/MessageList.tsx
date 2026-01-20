import { useRef, useEffect } from 'preact/hooks';
import { messages, streamingContent, isTextMode, currentChat } from '../../state/signals';
import { MessageGroup } from './MessageGroup';
import { parseMarkdown } from '../../markdown';

export function MessageList() {
  const containerRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages change
  useEffect(() => {
    if (containerRef.current && messages.value.length > 0) {
      const container = containerRef.current;
      // Scroll to bottom with a small delay to allow render
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages.value.length]);

  // Update spacer height on resize
  useEffect(() => {
    if (!spacerRef.current || !containerRef.current) return;

    const updateSpacerHeight = () => {
      if (spacerRef.current && containerRef.current) {
        spacerRef.current.style.height = containerRef.current.clientHeight + 'px';
      }
    };

    updateSpacerHeight();
    window.addEventListener('resize', updateSpacerHeight);
    return () => window.removeEventListener('resize', updateSpacerHeight);
  }, []);

  const history = messages.value;
  const streaming = streamingContent.value;
  const chatTitle = currentChat.value?.title || 'New Chat';

  // Group messages into pairs (user + assistant), checking actual roles
  const pairs: Array<{ user: (typeof history)[0]; assistant?: (typeof history)[0] }> = [];
  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    if (!msg) continue;

    if (msg.role === 'user') {
      // Start a new pair with this user message
      const nextMsg = history[i + 1];
      if (nextMsg?.role === 'assistant') {
        pairs.push({ user: msg, assistant: nextMsg });
        i++; // Skip the assistant message since we've paired it
      } else {
        pairs.push({ user: msg });
      }
    } else if (msg.role === 'assistant' && pairs.length > 0) {
      // Orphan assistant message - attach to last pair if it has no assistant
      const lastPair = pairs[pairs.length - 1];
      if (lastPair && !lastPair.assistant) {
        lastPair.assistant = msg;
      }
    }
  }

  return (
    <div
      ref={containerRef}
      class={`conversation-history ${isTextMode.value ? 'visible' : ''}`}
    >
      <div class="chat-title-header">{chatTitle}</div>
      {pairs.map((pair, i) => (
        <MessageGroup
          key={i}
          userMessage={pair.user}
          assistantMessage={pair.assistant}
        />
      ))}
      {streaming && (
        <div class="message-group">
          <div
            class="message assistant streaming"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(streaming) }}
          />
        </div>
      )}
      <div ref={spacerRef} class="scroll-spacer" />
    </div>
  );
}
