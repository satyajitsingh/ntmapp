# Notes → Sendable Email (MVP)

Turn messy meeting notes into a ready-to-send email (subject + body + action items).

## Quickstart

```bash
pnpm i   # or npm install / yarn
pnpm dev # or npm run dev
```

Open http://localhost:3000

- Works **without** an API key using a naive local extractor (demo mode).
- For best results, add your OpenAI key in `.env.local`:

```
OPENAI_API_KEY=sk-...
```

## Tech

- Next.js 14 (App Router), TypeScript
- TailwindCSS
- API route `/api/generate` with two-step extraction → composition
- Clipboard copy & `mailto:` link (Gmail/Outlook draft can be added next)

## Roadmap

- Gmail/Outlook: create draft via Workspace / MS Graph
- File uploads & audio transcription
- Templates and style presets
- Save outputs (opt-in), team workspace
