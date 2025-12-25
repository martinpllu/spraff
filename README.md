# Speak

A simple, private voice interface for AI. No app to install, no subscription, just a single HTML file.

## Features

- **Private** - Zero Data Retention at every layer. No conversation history, no transcripts.
- **Simple** - One HTML file. Host it yourself or use ours.
- **No subscription** - Pay only for what you use via OpenRouter (fractions of a cent per conversation).
- **Voice only** - Just you and the AI, talking.
- **Works everywhere** - Desktop and mobile, any modern browser.

## Privacy

ChatGPT, Claude and Gemini store every conversation against your account. Speak doesn't.

This app has no backend—it's just a static HTML file. Your conversations go through [OpenRouter](https://openrouter.ai) to Google Vertex with **Zero Data Retention (ZDR)** enabled. This means:

- **This app**: No backend, no data collection
- **OpenRouter**: No conversation content stored, only metadata (timestamps, usage)
- **Google Vertex**: Zero Data Retention—your prompts and responses are not stored or logged

No conversation history. No transcripts. No record of what you said.

## How it Works

Your voice is recorded in the browser, sent to the AI model via OpenRouter, and the response is spoken back using your device's text-to-speech. That's it.

## Cost

The app uses Gemini Flash which works well at very low cost. Conversations typically cost a fraction of a cent, or a couple of cents with web search enabled. A few dollars of OpenRouter credit will last a long time.

## Getting Started

1. **Create an OpenRouter account** at [openrouter.ai](https://openrouter.ai)
2. **Add credits** - $5 is plenty to start (Settings → Credits)
3. **Open Speak** at https://martinpllu.github.io/speak
4. **Connect** with your OpenRouter account
5. **Tap the button** or press Space to talk

## Self-Hosting

It's just one HTML file. Download `index.html` and serve it from anywhere.

```bash
python3 -m http.server 3000
# Open http://localhost:3000
```
