# NRVS AI — Functional Chat App

A modern dark-theme AI chat web app built from the **NRVS AI – UI Implementation Prompt** spec.
**React + Vite + Tailwind CSS**, Lucide icons, Framer Motion, with a **Vercel serverless `/api/chat`**
endpoint that streams responses.

> Live demo works out of the box in **demo mode**. Add an `OPENAI_API_KEY` to enable real AI.

## ✨ Features (functional)

- **Real chat flow** — type a message, a thread is created, the assistant replies with a
  streaming, word-by-word effect.
- **Persisted threads** — conversations are saved in `localStorage`; they show up in
  **Recents** in the sidebar and survive reloads. Delete threads inline.
- **Streaming serverless API** (`/api/chat`) — uses an LLM when `OPENAI_API_KEY` is set,
  otherwise a built-in simulated assistant so the site is always functional.
- **Markdown rendering** — bold, italic, code, code blocks, lists, quotes, links (no raw HTML).
- **Stop generation**, prompt suggestions, auto-growing composer (Enter to send, Shift+Enter for newline).
- **Working Settings** — color mode / font style / haptic toggle persist; **Log out** clears local data.
- **Fully responsive** — fixed 280px sidebar on desktop; slide-in overlay (300ms) on mobile
  with top + bottom bars.

## Spec compliance

- "Claude" → **NRVS** everywhere · "Chat" → **Thread** everywhere
- **Library** added in the sidebar between Thread and Projects
- Model shown as **Sonnet 4.6**
- Exact dark palette, typography, spacing, radii, and outline icon style

## Project structure

```
api/chat.js            # Vercel Edge function (LLM + simulated fallback, streaming)
src/
  components/          # Layout, SidebarContent, Composer, Message, Toggle, Sunburst, …
  lib/                 # api client, store (localStorage), useChat, prefs, markdown
  screens/            # Home, Thread, Settings, Placeholder
vercel.json           # Vite framework + SPA rewrites (excludes /api)
tailwind.config.js    # all design tokens
```

## Run locally

```bash
npm install
npm run dev      # Vite dev server (UI). For the API, use `vercel dev`.
npm run build
```

To test the serverless function locally, use the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

## Enable real AI

In the Vercel project → **Settings → Environment Variables**, add:

| Name | Example | Required |
| --- | --- | --- |
| `OPENAI_API_KEY` | `sk-…` | ✅ |
| `OPENAI_MODEL` | `gpt-4o-mini` (default) | optional |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` (default) | optional |

Then **redeploy**. The same `/api/chat` endpoint will stream live model output.
Any OpenAI-compatible API works by overriding `OPENAI_BASE_URL`.

## Tech stack

React 18 · Vite 5 · Tailwind CSS 3 · React Router 6 · Lucide React · Framer Motion · Vercel Serverless
