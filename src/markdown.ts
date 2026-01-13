// Markdown parsing for chat messages

export function parseMarkdown(text: string): string {
  if (!text) return '';

  let html = text;

  // Helper to escape HTML
  const escapeHtml = (str: string): string =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // Code blocks - extract first and replace with placeholders
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    const trimmed = code.replace(/^\n+|\n+$/g, '');
    const placeholder = `\x00CODEBLOCK${codeBlocks.length}\x00`;
    codeBlocks.push(`<pre><code>${escapeHtml(trimmed)}</code></pre>`);
    return placeholder;
  });

  // Tables (before HTML escaping, so we can detect pipe characters)
  const tableInputLines = html.split('\n');
  const processedLines: string[] = [];
  let tableLines: string[] = [];

  function parseTable(
    rows: string[],
    escape: (s: string) => string
  ): string | null {
    if (rows.length < 2) return null;

    // Check if second row is separator (|---|---|)
    const separatorRow = rows[1];
    if (!/^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(separatorRow)) return null;

    let tableHtml = '<div class="table-wrapper"><table>';

    // Header row
    const headerCells = rows[0].split('|').slice(1, -1);
    tableHtml += '<thead><tr>';
    headerCells.forEach((cell) => {
      tableHtml += '<th>' + escape(cell.trim()) + '</th>';
    });
    tableHtml += '</tr></thead>';

    // Body rows (skip header and separator)
    if (rows.length > 2) {
      tableHtml += '<tbody>';
      for (let i = 2; i < rows.length; i++) {
        const cells = rows[i].split('|').slice(1, -1);
        tableHtml += '<tr>';
        cells.forEach((cell) => {
          tableHtml += '<td>' + escape(cell.trim()) + '</td>';
        });
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody>';
    }

    tableHtml += '</table></div>';
    return tableHtml;
  }

  for (let i = 0; i < tableInputLines.length; i++) {
    const line = tableInputLines[i].trim();
    const isTableRow = line.startsWith('|') && line.endsWith('|');

    if (isTableRow) {
      tableLines.push(line);
    } else {
      // Process accumulated table lines if any
      if (tableLines.length >= 2) {
        const table = parseTable(tableLines, escapeHtml);
        if (table) {
          processedLines.push(table);
        } else {
          processedLines.push(...tableLines);
        }
      } else if (tableLines.length > 0) {
        processedLines.push(...tableLines);
      }
      tableLines = [];
      processedLines.push(tableInputLines[i]);
    }
  }

  // Handle table at end of content
  if (tableLines.length >= 2) {
    const table = parseTable(tableLines, escapeHtml);
    if (table) {
      processedLines.push(table);
    } else {
      processedLines.push(...tableLines);
    }
  } else if (tableLines.length > 0) {
    processedLines.push(...tableLines);
  }

  html = processedLines.join('\n');

  // Escape HTML for remaining content (but not the table HTML we just created)
  html = html.replace(/^(?!<div|<\/div|<table|<\/table|<thead|<\/thead|<tbody|<\/tbody|<tr|<\/tr|<th|<\/th|<td|<\/td)(.*)$/gm, (match) => {
    if (
      match.startsWith('<div') ||
      match.startsWith('</div') ||
      match.startsWith('<table') ||
      match.startsWith('</table') ||
      match.startsWith('<thead') ||
      match.startsWith('</thead') ||
      match.startsWith('<tbody') ||
      match.startsWith('</tbody') ||
      match.startsWith('<tr') ||
      match.startsWith('</tr') ||
      match.startsWith('<th') ||
      match.startsWith('</th') ||
      match.startsWith('<td') ||
      match.startsWith('</td')
    ) {
      return match;
    }
    return match
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  });

  // Inline code (must be before other inline processing)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic (order matters)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs - wrap lines that aren't already wrapped
  const lines = html.split('\n');
  const processed: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      processed.push('');
      continue;
    }

    // Check if line is already an HTML element
    if (
      trimmed.match(
        /^<(h[1-4]|ul|ol|li|pre|blockquote|hr|p|table|thead|tbody|tr|th|td)/
      )
    ) {
      processed.push(line);
      continue;
    }

    // Track list state
    if (trimmed.startsWith('<ul>') || trimmed.startsWith('<ol>')) {
      inList = true;
    }
    if (trimmed.endsWith('</ul>') || trimmed.endsWith('</ol>')) {
      inList = false;
    }

    if (inList || trimmed.startsWith('<li>')) {
      processed.push(line);
    } else {
      processed.push(`<p>${trimmed}</p>`);
    }
  }

  html = processed.join('\n');

  // Clean up empty paragraphs and normalize
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/\n+/g, '\n');

  // Restore code blocks from placeholders
  codeBlocks.forEach((block, i) => {
    html = html.replace(`\x00CODEBLOCK${i}\x00`, block);
    html = html.replace(`<p>\x00CODEBLOCK${i}\x00</p>`, block);
  });

  return html;
}

// Sanitize text for speech synthesis
export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s)]+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*+]\s+/gm, ', ')
    .replace(/^\d+\.\s+/gm, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}
