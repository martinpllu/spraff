# Spraff

**A private, subscription-free text and voice interface for AI.**

Most AI chat interfaces require subscriptions, and your data is stored by AI labs or intermediaries.

Spraff gives you conversations that leave no trace. No transcripts, no history, nothing stored.

*Requires an OpenRouter account. Pay-as-you-go with low cost and privacy guarantees.*

## Features

- **Private** - Zero Data Retention at every layer. No conversation history, no transcripts.
- **Voice or text** - Talk or type, with streaming responses and markdown formatting.
- **Self-hostable** - One HTML file. Host it yourself or use it [here](https://martinpllu.github.io/spraff/)
- **No subscription** - Pay only for what you use via OpenRouter (fractions of a cent per conversation).
- **Works everywhere** - Desktop and mobile, any modern browser.

## Privacy

ChatGPT, Claude and Gemini apps store every conversation against your account. Spraff doesn't.

The app has no backend - it's a static HTML file. Your conversations go through [OpenRouter](https://openrouter.ai) to Gemini Flash 3 on Google Vertex with **Zero Data Retention (ZDR)** enabled. This means:

- **This app**: No backend, no data collection
- **OpenRouter**: No conversation content stored, only metadata (timestamps, usage)
- **Google Vertex**: Zero Data Retention - your prompts and responses are not stored or logged

No conversation history, no transcripts, no record of what you said.

*Other models supporting zero data retention can be added if there is interest.*

## How it Works

In voice mode, your voice is recorded in the browser, sent to the AI model via OpenRouter, and the response is spoken back using your device's text-to-speech. In text mode, you type your message and responses stream back with markdown formatting. That's it.

## Voice Quality

Spraff uses your device's built-in text-to-speech instead of cloud voices (like Chrome's web voices, OpenAI or ElevenLabs). This is intentional: cloud voices send your conversations to third-party servers which don't offer zero data retention (and add cost).

The trade-off is that default system voices can sound robotic. The good news is you can download much better voices for free, e.g.

- **macOS**: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices
- **iOS**: Settings → Accessibility → Spoken Content → Voices → [Your Language]

Look for voices marked **Premium** or **Enhanced**. These are high-quality neural voices that run locally. Once installed, open Voice Settings in the app to select them.

## Cost

The app uses Gemini Flash 3 which works well at very low cost. Conversations typically cost a fraction of a cent, or a couple of cents with web search enabled. A few dollars of OpenRouter credit will usually last a long time.

## Getting Started

1. **Create an OpenRouter account** at [openrouter.ai](https://openrouter.ai)
2. **Add credits** - $5 is plenty to start (Settings → Credits)
3. **Open Spraff** at https://martinpllu.github.io/spraff
4. **Connect** with your OpenRouter account
5. **Tap the button** or press Space to talk, or switch to text mode to type

## Self-Hosting

It's just one HTML file. Download `index.html` and serve it from anywhere.

## Running locally

```bash
python3 -m http.server 3000
# Open http://localhost:3000
```
