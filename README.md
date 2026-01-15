# Spraff

**Voice and text chat with AI, no subscription, no data stored.**

Requires an OpenRouter account for pay-as-you-go model access. A few dollars go a long way with most conversations being a fraction of a cent.

Uses Gemini 3 Flash configured with Zero Data Retention. No chat data is stored at any layer.

Host it yourself or use it here: [https://martinpllu.github.io/spraff](https://martinpllu.github.io/spraff)


<p align="center">
  <img src="docs/spraff-1.png" height="525" alt="Spraff voice mode" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="docs/spraff-2.png" height="525" alt="Spraff text mode" />
</p>

## Getting Started

1. **Create an OpenRouter account** at [openrouter.ai](https://openrouter.ai)
2. **Add credits** - $5 is plenty to start
3. **Open Spraff** at https://martinpllu.github.io/spraff
4. **Log in** click 'Get Started' and log into to your OpenRouter account
5. **Chat** with the AI via voice or text mode
6. **Add to Home Screen** - recommended on mobile for easy access

## Privacy

There's no backend - it's a static site with no server-side code. Your conversations go through [OpenRouter](https://openrouter.ai) to Gemini 3 Flash on Google Vertex with [Zero Data Retention](https://openrouter.ai/docs/guides/features/zdr) enabled:

- **This app**: No backend, no data collection. Your current conversation and any pending voice upload are stored in your browser's local storage so they persist if you switch apps or refresh. This data is cleared when you log out or start a new chat.
- **OpenRouter**: No conversation content stored, just metadata (timestamps, usage)
- **Google Vertex**: Zero Data Retention - prompts and responses aren't stored or logged

## Cost

Most conversations cost a fraction of a cent ([model pricing](https://openrouter.ai/google/gemini-3-flash-preview)). Web searches cost about 2.5 cents each ([web search pricing](https://openrouter.ai/docs/guides/features/plugins/web-search)).

## Web Search

Spraff automatically searches the web when your question requires current information - news, weather, stock prices, sports scores, or recent events. The model decides when a search is needed, erring on the side of caution given the higher cost.

## Voice Input

Your voice is recorded in the browser via the Web Audio API, converted to 16kHz mono WAV, and sent directly to the AI model. Audio is downsampled from 48kHz to reduce upload size - this is optimal for speech since Gemini downsamples to 16kHz anyway.

- If an upload is interrupted (e.g. you switch apps), it's saved locally and automatically retried when you return
- Upload progress is shown for larger recordings
- You can check the size of your last voice message in the Cost panel

## Voice Output

Spraff uses your device's built-in text-to-speech rather than cloud voices (like OpenAI or ElevenLabs). Why? Cloud voices send your conversations to servers that don't offer zero data retention (and they cost extra).

Default system voices can sound a bit robotic, but you can download better ones for free:

- **macOS**: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices
- **iOS**: Settings → Accessibility → Spoken Content → Voices → [Your Language]
- **Windows**: Settings → Time & Language → Speech → Manage voices
- **Android**: Settings → Accessibility → Text-to-speech output → Preferred engine settings
- **Linux**: Install `espeak-ng` or `festival` for basic voices, or `piper` for neural voices

*(Settings locations vary between OS versions.)*

Look for **Premium** or **Enhanced** voices - they're high-quality neural voices that run locally.

## Models

Spraff uses **Gemini 3 Flash** via Google Vertex. Why this specific model?

- **Audio input + Zero Data Retention**: Very few models support both. OpenAI's GPT-4o Audio handles audio but doesn't offer ZDR. Gemini via Vertex is currently the only option that does both.
- **Flash over Pro**: Gemini 3 Pro also supports audio + ZDR, but Flash actually beats Pro in most benchmarks while being significantly cheaper and faster.

If other models add audio support with ZDR in the future, Spraff may offer model selection.

## Self-Hosting

Build and serve the static files however you like:

```bash
pnpm install
pnpm build
# Serve the dist/ directory
```

## Development

```bash
pnpm install
pnpm dev        # Dev server at https://localhost:3001
pnpm build      # Production build
pnpm preview    # Preview production build
```

The dev server requires HTTPS certificates (`cert.pem` and `key.pem`) for microphone access. Generate self-signed certs:

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
```

For mobile testing, you can use a Cloudflare tunnel:

```bash
cloudflared tunnel --url https://localhost:3001
```
