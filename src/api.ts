// ============ API Communication ============

import { OPENROUTER_API_URL, MODEL, MODEL_ONLINE } from './config';
import { dbg, dbgRequest, dbgResponse, getNextRequestId } from './debug';
import type { ToolCall, StreamResult } from './types';
import {
  apiKey,
  messages,
  addMessage,
  updateSessionCost,
  setLastVoiceSize,
  setButtonState,
  shouldStopSpeaking,
  speechQueue,
  selectedVoiceName,
  streamingContent,
} from './state/signals';
import { queueSpeech } from './speech';

function getModel(): string {
  return MODEL;
}

// ============ Error Toast ============

function showError(message: string): void {
  const toast = document.getElementById('errorToast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 5000);
  }
  dbg(`Error: ${message}`, 'error');
}

// ============ System Prompts ============

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

You have access to tools that run in the user's browser. This uses a TEXT-BASED tool calling format (not native function calling). To use a tool, respond with ONLY a JSON code block in this exact format:

\`\`\`tool_call
{"tool": "tool_name", "args": {...}}
\`\`\`

When you use a tool, do not include any other text in your response - just the tool call block. Do NOT use any native/built-in function calling - only this text format.

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
      Authorization: `Bearer ${apiKey.value}`,
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
        ...messages.value,
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
          streamingContent.value = fullResponse;
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
  shouldStopSpeaking.value = false;
  speechQueue.value = [];

  const reqId = getNextRequestId();

  const audioSizeBytes = Math.round(base64Audio.length * 0.75);
  setLastVoiceSize(audioSizeBytes);

  const requestBody = JSON.stringify({
    model: getModel(),
    stream: true,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      ...messages.value,
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

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.value}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Spraff',
      },
      body: requestBody,
    });

    // Upload complete, now waiting for response (thinking)
    setButtonState('processing');

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

    let responseOnly = fullResponse;
    const endTagIndex = fullResponse.indexOf('[/USER]');
    if (endTagIndex !== -1) {
      responseOnly = fullResponse.slice(endTagIndex + 7).trim();
    }

    const toolCall = parseToolCall(responseOnly);
    const toolCallFromFull = !toolCall ? parseToolCall(fullResponse) : null;
    const detectedToolCall = toolCall || toolCallFromFull;

    if (detectedToolCall && detectedToolCall.tool === 'web_search') {
      if (!userTranscript) {
        dbgResponse(reqId, 'error', 'Web search requested but no transcript');
        showError('Could not process voice search request');
        setButtonState('ready');
        return;
      }

      dbgResponse(reqId, 'tool_call', 'web_search');

      setButtonState('speaking');

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance('Searching the web, please wait.');
        utterance.rate = 1.1;
        const voiceName = selectedVoiceName.value;
        if (voiceName) {
          const voices = speechSynthesis.getVoices();
          const voice = voices.find((v) => v.name === voiceName);
          if (voice) utterance.voice = voice;
        }
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);
      });

      try {
        const searchResult = await executeWebSearchText(userTranscript, buildVoiceSearchSystemPrompt());

        if (usage && typeof usage.cost === 'number') {
          updateSessionCost(usage.cost);
        }
        if (searchResult.usage && typeof searchResult.usage.cost === 'number') {
          updateSessionCost(searchResult.usage.cost);
        }

        setButtonState('speaking');

        const sentences = searchResult.fullResponse.match(/[^.!?]+[.!?]+/g) || [
          searchResult.fullResponse,
        ];
        for (let i = 0; i < sentences.length; i++) {
          queueSpeech(sentences[i]!.trim(), i === 0);
        }

        addMessage({ role: 'user', content: userTranscript });
        addMessage({ role: 'assistant', content: searchResult.fullResponse });
      } catch (searchError) {
        dbg(`Web search error: ${searchError}`, 'error');
        showError('Web search failed: ' + String(searchError));
        setButtonState('ready');
      }
    } else {
      dbgResponse(reqId, 'normal', `${responseOnly.length} chars`);

      setButtonState('speaking');

      const sentences = responseOnly.match(/[^.!?]+[.!?]+/g) || [responseOnly];
      for (let i = 0; i < sentences.length; i++) {
        queueSpeech(sentences[i]!.trim(), i === 0);
      }

      if (usage && typeof usage.cost === 'number') {
        updateSessionCost(usage.cost);
      }

      addMessage({ role: 'user', content: userTranscript || '[voice message]' });
      addMessage({ role: 'assistant', content: responseOnly });
    }
  } catch (error) {
    dbg(`API error: ${error}`, 'error');
    showError(String(error));
    setButtonState('ready');
  }
}

export async function sendTextToAPI(userText: string): Promise<void> {
  const reqId = getNextRequestId();

  const wordMatch = userText.trim().match(/^(\d+)w$/);
  if (wordMatch) {
    const wordCount = parseInt(wordMatch[1]!, 10);
    userText = `Write exactly ${wordCount} words on a random interesting topic. Pick something unexpected and engaging.`;
  }

  dbgRequest(reqId, `Text: ${userText.substring(0, 50)}...`);

  // Add user message to conversation
  addMessage({ role: 'user', content: userText });

  // Start streaming
  streamingContent.value = '';

  const timingStart = performance.now();
  dbg(`[TIMING] Request start`);

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.value}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Spraff',
      },
      body: JSON.stringify({
        model: getModel(),
        stream: true,
        messages: [
          { role: 'system', content: buildTextSystemPrompt() },
          ...messages.value,
        ],
        provider: {
          only: ['google-vertex'],
          allow_fallbacks: false,
          zdr: true,
        },
      }),
    });

    const timingResponse = performance.now();
    dbg(`[TIMING] Response received: ${(timingResponse - timingStart).toFixed(0)}ms`);

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
    let firstChunkTime: number | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstChunkTime) {
        firstChunkTime = performance.now();
        dbg(`[TIMING] First chunk: ${(firstChunkTime - timingStart).toFixed(0)}ms`);
      }

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
            if (!fullResponse.includes('```tool_call')) {
              streamingContent.value = fullResponse;
            } else {
              streamingContent.value = '*Searching the web...*';
            }
          }
          // Check for Gemini's MALFORMED_FUNCTION_CALL error
          const nativeReason = (parsed as { choices?: Array<{ native_finish_reason?: string }> })
            .choices?.[0]?.native_finish_reason;
          if (nativeReason === 'MALFORMED_FUNCTION_CALL') {
            dbg('Gemini MALFORMED_FUNCTION_CALL - model confused by tool prompt', 'warn');
          }
        } catch (e) {
          dbg(`SSE parse error: ${e}, data: ${data.slice(0, 200)}`, 'warn');
        }
      }
    }

    const timingEnd = performance.now();
    dbg(`[TIMING] Stream complete: ${(timingEnd - timingStart).toFixed(0)}ms total`);

    const toolCall = parseToolCall(fullResponse);
    if (toolCall && toolCall.tool === 'web_search') {
      dbgResponse(reqId, 'tool_call', 'web_search');

      try {
        const searchResult = await executeWebSearchText(userText, buildTextSystemPrompt());

        streamingContent.value = '';

        if (usage && typeof usage.cost === 'number') {
          updateSessionCost(usage.cost);
        }
        if (searchResult.usage && typeof searchResult.usage.cost === 'number') {
          updateSessionCost(searchResult.usage.cost);
        }

        addMessage({ role: 'assistant', content: searchResult.fullResponse });
      } catch (searchError) {
        dbg(`Web search error: ${searchError}`, 'error');
        showError('Web search failed: ' + String(searchError));
        streamingContent.value = '';
      }
    } else {
      dbgResponse(reqId, 'normal', `${fullResponse.length} chars`);
      streamingContent.value = '';

      if (usage && typeof usage.cost === 'number') {
        updateSessionCost(usage.cost);
      }

      // Only add non-empty responses
      if (fullResponse.trim()) {
        addMessage({ role: 'assistant', content: fullResponse });
      } else {
        dbg('Skipping empty assistant response', 'warn');
      }
    }
  } catch (error) {
    dbg(`API error: ${error}`, 'error');
    showError(String(error));
    streamingContent.value = '';
  }
}
