import type { Message } from '../../types';
import { parseMarkdown } from '../../markdown';

interface Props {
  userMessage: Message;
  assistantMessage?: Message;
}

export function MessageGroup({ userMessage, assistantMessage }: Props) {
  const userContent =
    typeof userMessage.content === 'string' ? userMessage.content : '[audio]';

  const assistantContent =
    assistantMessage && typeof assistantMessage.content === 'string'
      ? assistantMessage.content
      : '';

  return (
    <div class="message-group">
      <div class="message user">{userContent}</div>
      {assistantMessage && (
        <div
          class="message assistant"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(assistantContent) }}
        />
      )}
    </div>
  );
}
