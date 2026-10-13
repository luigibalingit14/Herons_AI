# Herons.AI

Herons.AI is a dark-first research workspace for University of Makati students. The app uses Next.js 16, React 19, TypeScript, Supabase Auth/Postgres/RLS, and a provider-fallback chat route (Gemini, Groq, then Ollama).

## Local setup

1. Install Node.js 20+ and copy `.env.example` to `.env.local`.
2. Create a Supabase project, enable Google OAuth, and run the SQL files in `supabase/migrations` in order.
3. Fill in the public Supabase URL/key and whichever server-side model credentials you want to use.
   OpenRouter supports an optional backup key: set `OPENROUTER_API_KEY` as the primary key and
   `OPENROUTER_API_KEY_2` as the fallback key. Both keys stay server-side and must never be committed.
4. Install and run the app:

```powershell
npm install
npm run dev
```

The browser app is available at `http://localhost:3000`. Only `@umak.edu.ph` accounts can register or sign in.

## Transcription service

The optional local Flask service is in `tools/youtube-or-video-to-transcribe`. Install FFmpeg, then run:

```powershell
cd tools/youtube-or-video-to-transcribe
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python app.py
```

Set `TRANSCRIBER_SERVICE_URL` in `.env.local` when enabling YouTube ingestion.

## Verification

```powershell
npm test
npx tsc --noEmit
npm run build
```

The database migration uses ownership-scoped RLS policies. Provider credentials, Supabase service-role keys, and local environment files are intentionally excluded from source control.

## Icons

The interface uses a selected set of locally bundled outlined Material Design SVG icons from
[`@material-design-icons/svg`](https://github.com/google/material-design-icons), distributed under
the Apache License 2.0. They are rendered through `src/components/ui/MaterialIcon.tsx` so their
color follows the Herons.AI design system.

Official UMak branding assets were sourced from
[`jayargrate/umak-public-assets`](https://github.com/jayargrate/umak-public-assets). The app
self-hosts the official white/black logo variants and Metropolis UI font weights under `public/`.
