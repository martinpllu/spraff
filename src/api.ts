// API communication with OpenRouter

import { OPENROUTER_API_URL, MODEL, MODEL_ONLINE } from './config';
import { state, updateSessionCost, saveConversationHistory } from './state';
import { elements } from './dom';
import {
  setButtonState,
  showError,
  updateStreamingMessage,
  finishStreamingMessage,
  addMessageToHistory,
} from './ui';
import { dbg } from './debug';
import { queueSpeech, stopSpeaking } from './speech';
import { resumeVADAfterDelay } from './vad';
import type { ToolCall, OpenRouterUsage } from './types';

// ============ Request Logging ============
let requestCounter = 0;

function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '... [truncated]';
}

function logRequest(
  reqNum: number,
  mode: 'voice' | 'text' | 'search',
  historyLength: number,
  userContent: string
): void {
  dbg(`--- REQ #${reqNum} (${mode}) ---`);
  dbg(`History: ${historyLength} messages`);
  dbg(`User: ${truncateText(userContent)}`);
}

function logResponse(
  reqNum: number,
  responseType: 'normal' | 'waiting' | 'tool_call' | 'error' | 'aborted',
  content: string
): void {
  // Don't truncate special response types
  const shouldTruncate = responseType === 'normal';
  const displayContent = shouldTruncate ? truncateText(content) : content;
  dbg(`--- RES #${reqNum} (${responseType}) ---`);
  dbg(`Assistant: ${displayContent}`);
}

// ============ Tool Calling ============
function parseToolCall(response: string): ToolCall | null {
  // Look for ```tool_call\n{...}\n``` pattern
  const match = response.match(/```tool_call\s*\n([\s\S]*?)\n```/);
  if (!match) return null;

  try {
    const toolCall = JSON.parse(match[1].trim());
    if (toolCall.tool && typeof toolCall.tool === 'string') {
      return toolCall;
    }
  } catch (e) {
    dbg('Failed to parse tool call: ' + e, 'warn');
  }
  return null;
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

CRITICAL TRANSCRIPTION RULES:
- Transcribe ONLY what you actually hear - NEVER add words, phrases, or sentences that weren't spoken
- If the audio cuts off mid-sentence, transcribe exactly what was said and stop there - do NOT complete the sentence
- Include filler words (um, uh, like) and hesitations exactly as spoken
- If audio is unclear or cuts off, indicate with "..." - do NOT guess or hallucinate what might have been said
- NEVER invent content the user didn't say - this is extremely important

2. INCOMPLETE SPEECH DETECTION: After transcribing, assess whether the user's speech appears COMPLETE or INCOMPLETE. Speech is INCOMPLETE if:
- It ends mid-sentence (e.g., "I was thinking about..." or "What do you think of...")
- It ends with conjunctions like "and", "but", "so", "because", "however"
- It ends with filler words like "um", "uh", "like", or trailing off
- The sentence structure is clearly unfinished
- It sounds like the user was interrupted or cut off

If the speech is INCOMPLETE, respond with ONLY:
[USER]
<transcription>
[/USER]
[WAITING]

Do NOT provide any other response - just the transcript and [WAITING] tag. The system will continue recording and send you the complete utterance.

If the speech is COMPLETE, respond normally with your answer.

<your response here>

3. SPEECH-FRIENDLY OUTPUT: Your response will be converted to speech, so you MUST:
- Be concise and conversational
- NEVER include URLs or links - they sound terrible spoken aloud. Describe sources naturally, e.g. "according to Simon Willison's blog" not "according to simonwillison.net"
- NEVER use domain names like ".com", ".io", ".net", etc.
- Avoid all technical formatting, code, or special characters
- No lists or bullet points - use flowing sentences instead

4. TOOLS: You have access to a web_search tool. To use it, include the following AFTER your [USER] transcript:

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

// ============ Web Search ============
async function executeWebSearchText(
  userText: string,
  systemPrompt: string
): Promise<{ fullResponse: string; usage: OpenRouterUsage | null }> {
  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.apiKey}`,
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
        ...state.conversationHistory,
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
    const error = await response.json();
    throw new Error(error.error?.message || 'API request failed');
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let buffer = '';
  let usage: OpenRouterUsage | null = null;

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
        const parsed = JSON.parse(data);
        if (parsed.usage) usage = parsed.usage;

        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          updateStreamingMessage(fullResponse);
        }
      } catch (e) {
        // Ignore parse errors for SSE
      }
    }
  }

  return { fullResponse, usage };
}

// ============ Audio API ============
export async function sendAudioToAPI(base64Audio: string): Promise<void> {
  state.shouldStopSpeaking = false;
  state.speechQueue = [];

  // Create AbortController for this request
  state.currentRequestController = new AbortController();
  const signal = state.currentRequestController.signal;

  // Assign request number for logging
  const reqNum = ++requestCounter;

  // Calculate and store voice message size (base64 to bytes: ~75% of base64 length)
  const audioSizeBytes = Math.round(base64Audio.length * 0.75);
  state.stats.lastVoiceSize = audioSizeBytes;

  // Build user message content - include pending transcript if continuing
  let userContent: Array<{ type: string; text?: string; input_audio?: { data: string; format: string } }>;
  let userContentDescription: string;
  if (state.pendingUtteranceTranscript) {
    dbg('Including pending transcript: ' + state.pendingUtteranceTranscript);
    userContent = [
      {
        type: 'text',
        text: `[CONTINUATION] The user previously said: "${state.pendingUtteranceTranscript}" but was cut off. The following audio is their continuation. Combine both parts when transcribing and responding.`,
      },
      {
        type: 'input_audio',
        input_audio: { data: base64Audio, format: 'wav' },
      },
    ];
    userContentDescription = `[CONTINUATION] "${state.pendingUtteranceTranscript}" + [audio ${Math.round(audioSizeBytes / 1024)}KB]`;
  } else {
    userContent = [
      {
        type: 'input_audio',
        input_audio: { data: base64Audio, format: 'wav' },
      },
    ];
    userContentDescription = `[audio ${Math.round(audioSizeBytes / 1024)}KB]`;
  }

  // Log the request
  logRequest(reqNum, 'voice', state.conversationHistory.length, userContentDescription);

  // Build request body
  const requestBody = JSON.stringify({
    model: MODEL,
    stream: true,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      ...state.conversationHistory,
      {
        role: 'user',
        content: userContent,
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

  // Show uploading status
  elements.statusText.textContent = `Uploading ${payloadSizeKB} KB`;

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      signal: signal,
      headers: {
        Authorization: `Bearer ${state.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Spraff',
      },
      body: requestBody,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    elements.statusText.textContent = 'Thinking';

    // Stream the response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';
    let usage: OpenRouterUsage | null = null;
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
          const parsed = JSON.parse(data);
          if (parsed.usage) usage = parsed.usage;

          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullResponse += content;

            // Extract user transcript
            if (!transcriptExtracted) {
              const match = fullResponse.match(
                /\[USER\]\s*([\s\S]*?)\s*\[\/USER\]/
              );
              if (match) {
                userTranscript = match[1].trim();
                transcriptExtracted = true;
              }
            }
          }
        } catch (e) {
          // Ignore parse errors for SSE
        }
      }
    }

    // Get the response text (after transcript)
    let responseOnly = fullResponse;
    const endTagIndex = fullResponse.indexOf('[/USER]');
    if (endTagIndex !== -1) {
      responseOnly = fullResponse.slice(endTagIndex + 7).trim();
    }

    // Check for [WAITING] tag - LLM detected incomplete speech
    if (responseOnly.includes('[WAITING]') || fullResponse.includes('[WAITING]')) {
      dbg('LLM detected incomplete speech, waiting for continuation');
      logResponse(reqNum, 'waiting', `[WAITING] transcript: "${userTranscript || ''}"`);

      // Store the transcript for later combination
      if (userTranscript) {
        if (state.pendingUtteranceTranscript) {
          // Append to existing pending transcript
          state.pendingUtteranceTranscript += ' ' + userTranscript;
        } else {
          state.pendingUtteranceTranscript = userTranscript;
        }
        dbg('Pending transcript: ' + state.pendingUtteranceTranscript);
      }

      state.waitingForContinuation = true;

      // Update stats if available
      if (usage && typeof usage.cost === 'number') {
        updateSessionCost(usage.cost);
      }

      // Resume listening for more speech
      elements.statusText.textContent = 'Listening...';
      setButtonState('continuous-ready');
      resumeVADAfterDelay(100);
      return; // Exit without speaking or saving to history
    }

    // If we were waiting for continuation, just clear the pending state
    if (state.pendingUtteranceTranscript) {
      dbg('Clearing pending transcript (LLM already combined it)');
      state.pendingUtteranceTranscript = null;
      state.waitingForContinuation = false;
    }

    // Check for tool calls
    const toolCall = parseToolCall(responseOnly);
    const toolCallFromFull = !toolCall ? parseToolCall(fullResponse) : null;
    const detectedToolCall = toolCall || toolCallFromFull;

    if (detectedToolCall && detectedToolCall.tool === 'web_search') {
      logResponse(reqNum, 'tool_call', `web_search for: "${userTranscript || ''}"`);

      if (!userTranscript) {
        dbg('Web search requested but no transcript available', 'warn');
        showError('Could not process voice search request');
        setButtonState('ready');
        elements.stopBtn.classList.add('hidden');
        return;
      }

      // Show searching status and speak it
      elements.statusText.textContent = 'Searching';
      setButtonState('speaking');

      // Speak the searching message and wait for it to finish
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(
          'Searching the web, please wait.'
        );
        utterance.rate = 1.1;
        // Use the selected voice if available
        if (state.selectedVoiceName) {
          const voices = speechSynthesis.getVoices();
          const voice = voices.find((v) => v.name === state.selectedVoiceName);
          if (voice) utterance.voice = voice;
        }
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);
      });

      try {
        const searchResult = await executeWebSearchText(
          userTranscript,
          buildVoiceSearchSystemPrompt()
        );

        // Update stats (include both requests)
        if (usage && typeof usage.cost === 'number') {
          updateSessionCost(usage.cost);
        }
        if (searchResult.usage && typeof searchResult.usage.cost === 'number') {
          updateSessionCost(searchResult.usage.cost);
        }

        // Now speak the search response
        setButtonState('speaking');
        elements.stopBtn.classList.remove('hidden');

        const sentences =
          searchResult.fullResponse.match(/[^.!?]+[.!?]+/g) || [
            searchResult.fullResponse,
          ];
        for (let i = 0; i < sentences.length; i++) {
          queueSpeech(sentences[i].trim(), i === 0);
        }

        // Save to conversation history
        state.conversationHistory.push({
          role: 'user',
          content: userTranscript,
        });
        state.conversationHistory.push({
          role: 'assistant',
          content: searchResult.fullResponse,
        });
        saveConversationHistory();
      } catch (searchError) {
        dbg('Web search error: ' + (searchError instanceof Error ? searchError.message : String(searchError)), 'error');
        showError(
          'Web search failed: ' +
            (searchError instanceof Error ? searchError.message : String(searchError))
        );
        setButtonState('ready');
        elements.stopBtn.classList.add('hidden');
      }
    } else {
      // Normal response - speak it
      logResponse(reqNum, 'normal', `transcript: "${userTranscript || ''}" | response: ${responseOnly}`);

      setButtonState('speaking');
      elements.stopBtn.classList.remove('hidden');

      // Queue speech for the entire response, sentence by sentence
      const sentences = responseOnly.match(/[^.!?]+[.!?]+/g) || [responseOnly];
      for (let i = 0; i < sentences.length; i++) {
        queueSpeech(sentences[i].trim(), i === 0);
      }

      // Update stats from API response
      if (usage && typeof usage.cost === 'number') {
        updateSessionCost(usage.cost);
      }

      // Save to conversation history (keep speech hints for display)
      state.conversationHistory.push({
        role: 'user',
        content: userTranscript || '[voice message]',
      });
      state.conversationHistory.push({ role: 'assistant', content: responseOnly });
      saveConversationHistory();
    }
  } catch (error) {
    // Check if this was an intentional abort (user started speaking)
    if (error instanceof Error && error.name === 'AbortError') {
      dbg('API request aborted - user started speaking');
      logResponse(reqNum, 'aborted', 'User started speaking');
      // Don't show error or change state - VAD will handle the new speech
      return;
    }
    dbg('API error: ' + (error instanceof Error ? error.message : String(error)), 'error');
    logResponse(reqNum, 'error', error instanceof Error ? error.message : String(error));
    showError(error instanceof Error ? error.message : String(error));
    setButtonState('ready');
    elements.stopBtn.classList.add('hidden');
  } finally {
    state.currentRequestController = null;
  }
}

// ============ Text API ============
export async function sendTextToAPI(userText: string): Promise<void> {
  if (!userText.trim() || state.isProcessingText) return;

  // Test feature: NNNw generates NNN words on a random topic
  const wordMatch = userText.trim().match(/^(\d+)w$/);
  if (wordMatch) {
    const wordCount = parseInt(wordMatch[1], 10);
    userText = `Write exactly ${wordCount} words on a random interesting topic. Pick something unexpected and engaging.`;
  }

  // Assign request number for logging
  const reqNum = ++requestCounter;
  logRequest(reqNum, 'text', state.conversationHistory.length, userText);

  state.isProcessingText = true;
  elements.textSendBtn.classList.add('loading');
  (elements.textInput as HTMLTextAreaElement).disabled = true;
  elements.stopBtn.classList.remove('hidden');

  // Add user message to UI
  addMessageToHistory('user', userText);

  // Start streaming response
  addMessageToHistory('assistant', '', true);

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Spraff',
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          { role: 'system', content: buildTextSystemPrompt() },
          ...state.conversationHistory,
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
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';
    let usage: OpenRouterUsage | null = null;

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
          const parsed = JSON.parse(data);
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
        } catch (e) {
          // Ignore parse errors for SSE
        }
      }
    }

    // Check for tool calls before finishing
    const toolCall = parseToolCall(fullResponse);
    if (toolCall && toolCall.tool === 'web_search') {
      logResponse(reqNum, 'tool_call', `web_search for: "${userText}"`);

      try {
        // Execute web search with :online model
        const searchResult = await executeWebSearchText(
          userText,
          buildTextSystemPrompt()
        );

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
        state.conversationHistory.push({ role: 'user', content: userText });
        state.conversationHistory.push({
          role: 'assistant',
          content: searchResult.fullResponse,
        });
        saveConversationHistory();
      } catch (searchError) {
        dbg('Web search error: ' + (searchError instanceof Error ? searchError.message : String(searchError)), 'error');
        logResponse(reqNum, 'error', 'Web search failed: ' + (searchError instanceof Error ? searchError.message : String(searchError)));
        showError(
          'Web search failed: ' +
            (searchError instanceof Error ? searchError.message : String(searchError))
        );
        finishStreamingMessage();
      }
    } else {
      logResponse(reqNum, 'normal', fullResponse);
      finishStreamingMessage();

      // Update stats
      if (usage && typeof usage.cost === 'number') {
        updateSessionCost(usage.cost);
      }

      // Save to conversation history
      state.conversationHistory.push({ role: 'user', content: userText });
      state.conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
      });
      saveConversationHistory();
    }
  } catch (error) {
    dbg('API error: ' + (error instanceof Error ? error.message : String(error)), 'error');
    logResponse(reqNum, 'error', error instanceof Error ? error.message : String(error));
    showError(error instanceof Error ? error.message : String(error));
    finishStreamingMessage();
    // Remove the empty assistant message if we failed
    const lastGroup = elements.conversationHistoryEl.lastElementChild;
    if (lastGroup) {
      const assistantEl = lastGroup.querySelector('.message.assistant');
      if (assistantEl && !assistantEl.textContent) {
        assistantEl.remove();
      }
    }
  } finally {
    state.isProcessingText = false;
    elements.textSendBtn.classList.remove('loading');
    (elements.textInput as HTMLTextAreaElement).disabled = false;
    // Only auto-focus on desktop to avoid keyboard popping up on mobile
    const { isMobile } = await import('./state');
    if (!isMobile) {
      elements.textInput.focus();
    }
    elements.stopBtn.classList.add('hidden');
  }
}
