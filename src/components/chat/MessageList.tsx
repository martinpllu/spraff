import { useRef, useEffect } from 'preact/hooks';
import { messages, streamingContent, isTextMode } from '../../state/signals';
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

  // Group messages into pairs (user + assistant)
  const pairs: Array<{ user: (typeof history)[0]; assistant?: (typeof history)[0] }> = [];
  for (let i = 0; i < history.length; i += 2) {
    const user = history[i];
    const assistant = history[i + 1];
    if (user) {
      pairs.push({ user, assistant });
    }
  }

  return (
    <div
      ref={containerRef}
      class={`conversation-history ${isTextMode.value ? 'visible' : ''}`}
    >
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
