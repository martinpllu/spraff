# Speak

A simple, private voice interface for AI.

## Why Speak?

- **Private** - No backend server. No AI lab collecting your data. Your conversations go directly to OpenRouter and nowhere else. Nothing is stored or logged. 
- **Voice only** - Just you and the AI, talking.
- **Simple** - A single HTML file that you can copy and host anywhere.

## How it Works

Speak uses [OpenRouter](https://openrouter.ai) to connect to AI models. OpenRouter is an API gateway that provides access to various AI models (like Google's Gemini) through a single account.

Your voice is recorded in the browser, sent to the AI model via OpenRouter, and the response is spoken back to you using your device's text-to-speech. That's it.

## Cost

The app currently uses Gemini Flash 3 which works well at a very low cost.

Conversations typically cost a fraction of a cent, or a couple of cents if web search is enabled. A few dollars of OpenRouter credit will last a long time.

## Getting Started

1. **Create an OpenRouter account** at [openrouter.ai](https://openrouter.ai)
2. **Add credits** - $5 is plenty to start (Settings → Credits)
3. **Open Speak** at https://martinpllu.github.io/speak
4. **Connect** with your OpenRouter account
5. **Tap the button** or press Space to talk on desktop.

## Features

- Push-to-talk with spacebar shortcut
- Web search toggle for current information
- Voice selection for text-to-speech
- Works on desktop and mobile

## Local Development

```bash
python3 -m http.server 3000
# Open http://localhost:3000/
```
