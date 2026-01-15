// ============ API Communication ============

import { OPENROUTER_API_URL, MODEL, MODEL_ONLINE } from './config';
import { dbg, dbgRequest, dbgResponse, getNextRequestId } from './debug';
import type { ToolCall, StreamResult } from './types';
import {
  apiKey,
  conversationHistory,
  stats,
  updateSessionCost,
  addToConversationHistory,
  saveConversationHistory,
  setShouldStopSpeaking,
  setSpeechQueue,
  selectedVoiceName,
} from './state';
import {
  setButtonState,
  showError,
  showStopButton,
  hideStopButton,
  addMessageToHistory,
  updateStreamingMessage,
  finishStreamingMessage,
} from './ui';
import { statusText } from './dom';
import { queueSpeech } from './speech';

function getModel(): string {
  return MODEL;
}

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `You are a helpful assistant that can communicate via voice or text. Today is ${today}.

The user is currently in VOICE MODE - they spoke this message aloud and your response will be read aloud via text-to-speech. Previous messages in the conversation may have been via text or voice.

NOTE: The technical details in this system prompt (about voice mode, text-to-speech, etc.) are about HOW to format your response, not WHAT to talk about. Answer the user's actual question - don't let these instructions bias your content toward tech topics.

CRITICAL REQUIREMENTS:

1. TRANSCRIPTION: You MUST ALWAYS start your response by transcribing exactly what the user said in their audio message using [USER]...[/USER] tags. Listen carefully to their audio and write what they said:

[USER]
<transcribe the user's spoken words here>
[/USER]

<your response here>

2. SPEECH-FRIENDLY OUTPUT: Your response will be converted to speech, so you MUST:
- Be concise and conversational
- NEVER include URLs or links - they sound terrible spoken aloud. Describe sources naturally, e.g. "according to Simon Willison's blog" not "according to simonwillison.net"
- NEVER use domain names like ".com", ".io", ".net", etc.
- Avoid all technical formatting, code, or special characters
- No lists or bullet points - use flowing sentences instead

3. TOOLS: You have access to a web_search tool. To use it, include the following AFTER your [USER] transcript:

\`\`\`tool_call
{"tool": "web_search"}
\`\`\`

ONLY use web_search when you are CERTAIN the user needs current, real-time information (news, weather, stock prices, sports scores, recent events). Do NOT use it for general knowledge. If unsure, just ask if they'd like you to search.

Respond naturally as if having a spoken conversation.`;
}

function buildVoiceSearchSystemPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `You are a helpful assistant. Today is ${today}.

Your response will be read aloud via text-to-speech.

Web search is ENABLED for this query. You have access to current information from the web. Provide a helpful response using the search results.

SPEECH-FRIENDLY OUTPUT: Your response will be converted to speech, so you MUST:
- Be concise and conversational
- NEVER include URLs or links - they sound terrible spoken aloud. Describe sources naturally, e.g. "according to Simon Willison's blog" not "according to simonwillison.net"
- NEVER use domain names like ".com", ".io", ".net", etc.
- Avoid all technical formatting, code, or special characters
- No lists or bullet points - use flowing sentences instead

Respond naturally as if having a spoken conversation.`;
}

function buildTextSystemPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `You are a helpful assistant that can communicate via voice or text. Today is ${today}.

The user is currently in TEXT MODE - they typed this message and will read your response on screen. Previous messages in the conversation may have been via text or voice.

## Tools

You have access to tools that run in the user's browser. To use a tool, respond with ONLY a JSON code block in this format:

\`\`\`tool_call
{"tool": "tool_name", "args": {...}}
\`\`\`

When you use a tool, do not include any other text in your response - just the tool call block.

### Available Tools

**web_search**
- Description: Routes the user's query to a search-enabled model that can access current information from the web.
- Arguments: none
- When to use: ONLY use this tool when you are CERTAIN the user needs current, real-time information that you cannot provide from your training data. Examples:
  - User explicitly asks to search: "search for...", "look up...", "find me..."
  - Current events: "what's in the news today", "latest on..."
  - Real-time data: weather, stock prices, sports scores, election results
  - Recent releases: "what's the newest iPhone", "latest software version"
- When NOT to use: Do NOT use for general knowledge questions, historical facts, explanations, coding help, or anything you can answer from your training data. Web searches are expensive (2.5 cents each vs fractions of a cent for regular queries), so use them conservatively.
- If unsure: Ask the user "Would you like me to search the web for that?" rather than automatically searching.

Because this response will be read on screen, you can use:
- Markdown formatting (bold, lists, code blocks) when helpful
- URLs and links if relevant
- Technical details and code snippets if appropriate

Be concise and direct in your responses. Focus on being helpful and informative.`;
}

function parseToolCall(response: string): ToolCall | null {
  // Look for ```tool_call\n{...}\n``` pattern
  const match = response.match(/```tool_call\s*\n([\s\S]*?)\n```/);
  if (!match) return null;

  try {
    const toolCall = JSON.parse(match[1]!.trim()) as ToolCall;
    if (toolCall.tool && typeof toolCall.tool === 'string') {
      return toolCall;
    }
  } catch (e) {
    console.warn('Failed to parse tool call:', e);
  }
  return null;
}

async function executeWebSearchText(userText: string, systemPrompt: string): Promise<StreamResult> {
  const reqId = getNextRequestId();
  dbgRequest(reqId, `Web search (text): ${userText.substring(0, 50)}...`);

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Spraff',
    },
    body: JSON.stringify({
      model: MODEL_ONLINE,
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            systemPrompt +
            '\n\nWeb search is ENABLED for this query. You have access to current information from the web. Provide a helpful response using the search results.',
        },
        ...conversationHistory,
        { role: 'user', content: userText },
      ],
      provider: {
        only: ['google-vertex'],
        allow_fallbacks: false,
        zdr: true,
      },
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: { message?: string } };
    dbgResponse(reqId, 'error', error.error?.message);
    throw new Error(error.error?.message || 'API request failed');
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let buffer = '';
  let usage = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

      const data = trimmedLine.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data) as {
          usage?: { cost?: number };
          choices?: Array<{ delta?: { content?: string } }>;
        };
        if (parsed.usage) usage = parsed.usage;

        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          updateStreamingMessage(fullResponse);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  dbgResponse(reqId, 'normal', `${fullResponse.length} chars`);
  return { fullResponse, usage };
}

export async function sendAudioToAPI(base64Audio: string): Promise<void> {
  setShouldStopSpeaking(false);
  setSpeechQueue([]);

  const reqId = getNextRequestId();

  // Calculate and store voice message size (base64 to bytes: ~75% of base64 length)
  const audioSizeBytes = Math.round(base64Audio.length * 0.75);
  stats.lastVoiceSize = audioSizeBytes;

  // Build request body
  const requestBody = JSON.stringify({
    model: getModel(),
    stream: true,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      ...conversationHistory,
      {
        role: 'user',
        content: [{ type: 'input_audio', input_audio: { data: base64Audio, format: 'wav' } }],
      },
    ],
    provider: {
      only: ['google-vertex'],
      allow_fallbacks: false,
      zdr: true,
    },
  });

  const payloadSize = new Blob([requestBody]).size;
  const payloadSizeKB = Math.round(payloadSize / 1024);

  dbgRequest(reqId, `Voice message ${payloadSizeKB} KB`);

  // Show uploading status
  statusText.textContent = `Uploading ${payloadSizeKB} KB`;

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Spraff',
      },
      body: requestBody,
    });

    if (!response.ok) {
      const error = (await response.json()) as { error?: { message?: string } };
      dbgResponse(reqId, 'error', error.error?.message);
      throw new Error(error.error?.message || 'API request failed');
    }

    statusText.textContent = 'Thinking';

    // Stream the response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';
    let usage = null;
    let userTranscript: string | null = null;
    let transcriptExtracted = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

        const data = trimmedLine.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data) as {
            usage?: { cost?: number };
            choices?: Array<{ delta?: { content?: string } }>;
          };
          if (parsed.usage) usage = parsed.usage;

          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullResponse += content;

            // Extract user transcript
            if (!transcriptExtracted) {
              const match = fullResponse.match(/\[USER\]\s*([\s\S]*?)\s*\[\/USER\]/);
              if (match) {
                userTranscript = match[1]!.trim();
                transcriptExtracted = true;
              }
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    }

    // Get the response text (after transcript)
    let responseOnly = fullResponse;
    const endTagIndex = fullResponse.indexOf('[/USER]');
    if (endTagIndex !== -1) {
      responseOnly = fullResponse.slice(endTagIndex + 7).trim();
    }

    // Check for tool calls
    const toolCall = parseToolCall(responseOnly);
    // Also check the full response in case the tool call came without transcript tags
    const toolCallFromFull = !toolCall ? parseToolCall(fullResponse) : null;
    const detectedToolCall = toolCall || toolCallFromFull;

    if (detectedToolCall && detectedToolCall.tool === 'web_search') {
      // If we don't have a transcript, we can't proceed with search in voice mode
      if (!userTranscript) {
        dbgResponse(reqId, 'error', 'Web search requested but no transcript');
        showError('Could not process voice search request');
        setButtonState('ready');
        hideStopButton();
        return;
      }

      dbgResponse(reqId, 'tool_call', 'web_search');

      // Show searching status and speak it
      statusText.textContent = 'Searching';
      setButtonState('speaking');

      // Speak the searching message and wait for it to finish
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance('Searching the web, please wait.');
        utterance.rate = 1.1;
        // Use the selected voice if available
        if (selectedVoiceName) {
          const voices = speechSynthesis.getVoices();
          const voice = voices.find((v) => v.name === selectedVoiceName);
          if (voice) utterance.voice = voice;
        }
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);
      });

      try {
        // Execute web search with the transcript as text (not audio)
        const searchResult = await executeWebSearchText(userTranscript, buildVoiceSearchSystemPrompt());

        // Update stats (include both requests)
        if (usage && typeof usage.cost === 'number') {
          updateSessionCost(usage.cost);
        }
        if (searchResult.usage && typeof searchResult.usage.cost === 'number') {
          updateSessionCost(searchResult.usage.cost);
        }

        // Now speak the search response
        setButtonState('speaking');
        showStopButton();

        const sentences = searchResult.fullResponse.match(/[^.!?]+[.!?]+/g) || [
          searchResult.fullResponse,
        ];
        for (let i = 0; i < sentences.length; i++) {
          queueSpeech(sentences[i]!.trim(), i === 0);
        }

        // Save to conversation history
        addToConversationHistory({ role: 'user', content: userTranscript });
        addToConversationHistory({ role: 'assistant', content: searchResult.fullResponse });
        saveConversationHistory();
      } catch (searchError) {
        dbg(`Web search error: ${searchError}`, 'error');
        showError('Web search failed: ' + String(searchError));
        setButtonState('ready');
        hideStopButton();
      }
    } else {
      dbgResponse(reqId, 'normal', `${responseOnly.length} chars`);

      // Normal response - speak it
      setButtonState('speaking');
      showStopButton();

      // Queue speech for the entire response, sentence by sentence
      const sentences = responseOnly.match(/[^.!?]+[.!?]+/g) || [responseOnly];
      for (let i = 0; i < sentences.length; i++) {
        queueSpeech(sentences[i]!.trim(), i === 0);
      }

      // Update stats from API response
      if (usage && typeof usage.cost === 'number') {
        updateSessionCost(usage.cost);
      }

      // Save to conversation history (keep speech hints for display)
      addToConversationHistory({ role: 'user', content: userTranscript || '[voice message]' });
      addToConversationHistory({ role: 'assistant', content: responseOnly });
      saveConversationHistory();
    }
  } catch (error) {
    dbg(`API error: ${error}`, 'error');
    showError(String(error));
    setButtonState('ready');
    hideStopButton();
  }
}

export async function sendTextToAPI(userText: string): Promise<void> {
  const reqId = getNextRequestId();

  // Test feature: NNNw generates NNN words on a random topic
  const wordMatch = userText.trim().match(/^(\d+)w$/);
  if (wordMatch) {
    const wordCount = parseInt(wordMatch[1]!, 10);
    userText = `Write exactly ${wordCount} words on a random interesting topic. Pick something unexpected and engaging.`;
  }

  dbgRequest(reqId, `Text: ${userText.substring(0, 50)}...`);

  // Add user message to UI
  addMessageToHistory('user', userText);

  // Start streaming response
  addMessageToHistory('assistant', '', true);

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Spraff',
      },
      body: JSON.stringify({
        model: getModel(),
        stream: true,
        messages: [
          { role: 'system', content: buildTextSystemPrompt() },
          ...conversationHistory,
          { role: 'user', content: userText },
        ],
        provider: {
          only: ['google-vertex'],
          allow_fallbacks: false,
          zdr: true,
        },
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { error?: { message?: string } };
      dbgResponse(reqId, 'error', error.error?.message);
      throw new Error(error.error?.message || 'API request failed');
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';
    let usage = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

        const data = trimmedLine.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data) as {
            usage?: { cost?: number };
            choices?: Array<{ delta?: { content?: string } }>;
          };
          if (parsed.usage) usage = parsed.usage;

          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullResponse += content;
            // Check if this looks like a tool call starting - don't display it
            if (!fullResponse.includes('```tool_call')) {
              updateStreamingMessage(fullResponse);
            } else {
              // Show searching message as soon as we detect tool call
              updateStreamingMessage('*Searching the web...*');
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    }

    // Check for tool calls before finishing
    const toolCall = parseToolCall(fullResponse);
    if (toolCall && toolCall.tool === 'web_search') {
      dbgResponse(reqId, 'tool_call', 'web_search');

      try {
        // Execute web search with :online model
        const searchResult = await executeWebSearchText(userText, buildTextSystemPrompt());

        // Update the streaming message with search results
        updateStreamingMessage(searchResult.fullResponse);
        finishStreamingMessage();

        // Update stats (include both requests)
        if (usage && typeof usage.cost === 'number') {
          updateSessionCost(usage.cost);
        }
        if (searchResult.usage && typeof searchResult.usage.cost === 'number') {
          updateSessionCost(searchResult.usage.cost);
        }

        // Save to conversation history (only save the final search result, not the tool call)
        addToConversationHistory({ role: 'user', content: userText });
        addToConversationHistory({ role: 'assistant', content: searchResult.fullResponse });
        saveConversationHistory();
      } catch (searchError) {
        dbg(`Web search error: ${searchError}`, 'error');
        showError('Web search failed: ' + String(searchError));
        finishStreamingMessage();
      }
    } else {
      dbgResponse(reqId, 'normal', `${fullResponse.length} chars`);
      finishStreamingMessage();

      // Update stats
      if (usage && typeof usage.cost === 'number') {
        updateSessionCost(usage.cost);
      }

      // Save to conversation history
      addToConversationHistory({ role: 'user', content: userText });
      addToConversationHistory({ role: 'assistant', content: fullResponse });
      saveConversationHistory();
    }
  } catch (error) {
    dbg(`API error: ${error}`, 'error');
    showError(String(error));
    finishStreamingMessage();
  }
}
