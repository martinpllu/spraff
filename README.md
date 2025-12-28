# Spraff

**One HTML file. Private AI chat. Pay as you go.**

No backend, no subscription, no data stored. Host it yourself or use it [here](https://martinpllu.github.io/spraff/).

*Uses [OpenRouter](https://openrouter.ai) for private, pay-per-use AI access.*

## Features

- **Private** - Zero Data Retention everywhere. Nothing saved, ever.
- **Voice or text** - Talk or type. Responses stream back with markdown support.
- **Self-hostable** - It's one HTML file. Host it yourself or use it [here](https://martinpllu.github.io/spraff/)
- **No subscription** - Pay per conversation via OpenRouter (fractions of a cent each).
- **Works everywhere** - Desktop, mobile, any modern browser.

<p align="center">
  <img src="docs/spraff-1.png" height="525" alt="Spraff voice mode" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="docs/spraff-2.png" height="525" alt="Spraff text mode" />
</p>

## Privacy

ChatGPT, Claude and Gemini store every conversation against your account. Spraff doesn't.

There's no backend - it's just a static HTML file. Your conversations go through [OpenRouter](https://openrouter.ai) to Gemini Flash 3 on Google Vertex with **Zero Data Retention** enabled:

- **This app**: No backend, no data collection
- **OpenRouter**: No conversation content stored, just metadata (timestamps, usage)
- **Google Vertex**: Zero Data Retention - prompts and responses aren't stored or logged

No history, no transcripts, no record of what you said.

## How it Works

Voice mode: speak, get a spoken response. Text mode: type, get a streamed response with markdown. That's it.

## Voice Quality

Spraff uses your device's built-in text-to-speech rather than cloud voices (like OpenAI or ElevenLabs). Why? Cloud voices send your conversations to servers that don't offer zero data retention (and they cost extra).

Default system voices can sound a bit robotic, but you can download better ones for free:

- **macOS**: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices
- **iOS**: Settings → Accessibility → Spoken Content → Voices → [Your Language]

Look for **Premium** or **Enhanced** voices - they're high-quality neural voices that run locally.

## Cost

Spraff uses Gemini Flash 3, which is fast and cheap. Most conversations cost a fraction of a cent (a couple of cents with web search). A few dollars of OpenRouter credit goes a long way.

## Getting Started

1. **Create an OpenRouter account** at [openrouter.ai](https://openrouter.ai)
2. **Add credits** - $5 is plenty to start
3. **Open Spraff** at https://martinpllu.github.io/spraff
4. **Connect** your OpenRouter account
5. **Tap the button** or press Space to talk, or switch to text mode

## Self-Hosting

It's one HTML file. Download `index.html` and serve it however you like.

## Running locally

```bash
python3 -m http.server 3000
# Open http://localhost:3000
```
