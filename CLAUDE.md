# Spraff

Simple, private AI chat app using Vite + Preact + Signals.

## Package Manager

Use **pnpm** for all package operations.

## Commands

- `pnpm dev` - Start dev server on https://localhost:3001
- `pnpm build` - Build for production
- `pnpm test` - Run Playwright tests

## Dev Server

The dev server runs on port 3001 with HTTPS enabled (requires `cert.pem` and `key.pem` in the root directory).

To test on mobile, use Cloudflare tunnel:
```bash
cloudflared tunnel --url https://localhost:3001
```

## Debug Console

The app includes a debug console accessible from the menu. Use the `dbg()` function from `./debug` for logging.
