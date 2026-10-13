Implementation Prompt

Copy everything below this line into the coding agent that will recreate the system.

---

## Role and objective

You are a senior full-stack engineer. Recreate **Herons AI**, an   AI-powered study and research workspace for University of Makati students and researchers. Build a complete, working application rather than a mockup. Preserve the behavior and information architecture described below.

The product converts PDFs, DOCX files, plain text, web pages, and YouTube links into a private research notebook. A user can chat with notebook sources, receive source-aware answers, and generate study materials such as flashcards, quizzes, study guides, and podcast-style deep-dive scripts.

The application must be usable locally and deployable to Vercel with Supabase. Do not hard-code credentials. Use environment variables and provide an `.env.example`.

## Non-negotiable stack

- Next.js 16 App Router
- React 19
- TypeScript with strict type checking
- Tailwind CSS v4 plus a small custom CSS design system
- Supabase: Auth, PostgreSQL, Row Level Security, Storage
- `@supabase/ssr` for server/client auth
- Google Gemini as the primary LLM
- Groq as the first fallback LLM
- Ollama as the local/offline fallback
- `react-markdown` for assistant responses and generated documents
- `lucide-react` or Material Icons for icons
- `mammoth` for DOCX extraction
- `unpdf` for PDF extraction
- A Python Flask transcription microservice using `yt-dlp` and OpenAI Whisper

Use current Next.js 16 conventions. In dynamic routes, treat `params` as a Promise. Keep server-only secrets in server route handlers.

## Visual identity and design system

Product name: **Herons.AI**. The visual direction is a polished university research tool with dark-first glassmorphism, not a generic chatbot.

- Primary navy: `#111c4e`
- Deep navy: `#060e33`
- Accent yellow: `#f5ec3a`
- Accent hover: `#fef760`
- Informational blue: `#105389`
- Dark surface: `#0d1020`
- Dark card: `#1a1f35`
- Dark variant: `#252b45`
- Light surface: `#f5f6fa`
- Primary text dark mode: `#e8eaf2`
- Muted text dark mode: `#6b7499`
- Border dark mode: `#2e3556`
- Error: `#e05c4b`
- Success: `#2ecc71`

Use Metropolis if the supplied font assets exist; otherwise fall back to system sans. Use Material Icons or Lucide consistently. Preserve visible focus rings, keyboard access, responsive behavior, readable contrast, and reduced-motion friendliness.

The authenticated shell has:

1. A navy top navigation bar.
2. University of Makati logo at the left, then a divider, then `Herons.AI`.
3. A Dashboard navigation item.
4. Dark/light mode switch.
5. Credits usage percentage and progress bar when a profile exists.
6. Sign out button.

The notebook page is a three-panel workspace:

- Left, fixed-width Sources panel: about 280px.
- Center, flexible Chat panel.
- Right, fixed-width Studio panel: about 320px.

On small screens, stack or collapse panels without losing functionality.

## Authentication and access control

Implement:

- `/login`
- `/signup`
- `/api/auth/callback`
- Supabase email/password sign up and sign in.
- Google OAuth sign in.
- Only emails ending in `@umak.edu.ph` may register or sign in.
- Reject the domain in the client for fast feedback and enforce it again in the authenticated server layout/callback.
- On invalid domain, sign out and redirect to `/login?error=umak_email_required`.
- Display friendly errors for invalid credentials, expired sessions, OAuth failures, and confirmation requirements.
- Signup collects full name, email, and password with minimum length 8.
- After signup, show a confirmation screen telling the user to check their inbox.
- Root `/` redirects authenticated users to `/dashboard`, otherwise `/login`.
- Unauthenticated users attempting `/dashboard` or `/notebook/[id]` are redirected to `/login`.
- Never trust a client-supplied user id for authorization.

## Required routes and behavior

### `/`

Server-rendered auth check. Redirect to `/dashboard` or `/login`.

### `/login`

Dark branded card centered on the page:

- UMak logo
- `Herons.AI` heading
- `Sign in with your @umak.edu.ph account`
- Continue with Google button
- Divider with `or`
- Email and password fields
- Sign In button
- Link to create an account
- Accessible inline error region

### `/signup`

Same branded card:

- Full Name
- Email
- Password
- Create Account
- Link back to sign in
- Confirmation state after successful signup

### `/dashboard`

Show `Research Dashboard`, notebook count, and the user's plan. Include a prominent `New Notebook` button.

Notebook cards must show:

- Notebook icon
- Title
- Optional two-line description
- Theme badge
- Last updated date
- Delete action with confirmation

When empty, show an empty state explaining that the user can create a notebook and a CTA. Creating a notebook opens a title modal, inserts an authenticated row, closes the modal, and navigates to `/notebook/[id]`.

### `/notebook/[id]`

Only render a notebook owned by the authenticated user. Load sources and chats server-side, then hydrate the interactive client workspace.

#### Sources panel

- Header `Sources` and add button.
- Add source popover with:
  - URL / YouTube URL input and Add button.
  - Add text action.
  - Choose file action.
- Drag-and-drop zone.
- Accept `.pdf`, `.docx`, `.txt`; maximum 50 MB.
- Add text form with optional title and textarea.
- List each source with type icon, title, status dot, size, and remove action.
- Status values: `processing`, `ready`, `error`.
- Automatically process pending sources after page load.
- Show actionable errors without silently swallowing them.
- Support:
  - PDF text extraction with `unpdf`
  - DOCX raw text extraction with `mammoth`
  - TXT UTF-8 extraction
  - HTTP/HTTPS webpage extraction with scripts/styles/noscript/tags removed
  - YouTube transcription through the local Flask service

#### Chat panel

- Notebook title and `Chat` label.
- Empty state with bot icon and guidance to add sources.
- Load persisted messages for the active chat.
- Create a chat lazily when the first message is sent.
- Persist the user message before generation.
- Call `/api/chat`.
- Persist the assistant response with model, tokens, cost, and citations.
- Render assistant Markdown.
- Render user and assistant messages as distinct bubbles.
- Auto-scroll to the latest message.
- Disable send while generating or when input is empty.
- Use `Ask about your sources…` as the normal placeholder and `Add sources first to chat…` when no sources exist.
- Show retryable error feedback.

The chat prompt must instruct the model to answer only from ready notebook sources when sources exist, cite source names, avoid fabricating unsupported facts, and say when the sources do not contain the answer. If there are no sources, explain that and suggest adding one.

#### Studio panel

Show these generator cards:

1. `Flashcards` — study cards from sources.
2. `Quiz` — test knowledge.
3. `Study Guide` — structured reference document.
4. `Quick Brief` — concise overview.
5. `Deep Dive Audio` — podcast-style script.

Each generator:

- Uses the ready source context.
- Shows loading state.
- Calls the chat/LLM generation path with a type-specific prompt.
- Validates the expected response shape.
- Saves the result to `study_materials` or `audio_overviews`.
- Opens a modal viewer.
- Adds the item to persisted saved materials.

Flashcards must have question/answer pairs. Quiz items must have question, options, and answer. The quiz viewer must support option selection, immediate correctness feedback, next question, score, completion state, and restart.

Saved materials should be clickable and reopen in the same viewer. Render text materials as Markdown. Show the model name where available.

## API contracts

### `POST /api/chat`

Input:

```json
{
  "message": "string",
  "notebookId": "uuid",
  "mode": "chat | flashcards | quiz | study_guide | brief | deep_dive"
}
```

Behavior:

1. Authenticate with Supabase server client.
2. Validate `message` and `notebookId`.
3. Verify the notebook belongs to the current user.
4. Load ready sources for that notebook only.
5. Build a bounded context; do not allow unbounded prompt growth.
6. Use Gemini first.
7. If Gemini is unavailable or fails, try Groq.
8. If Groq fails, try Ollama.
9. Return explicit errors if all providers fail.
10. Return the generated content, selected model, token count, estimated cost, and citations.

Response:

```json
{
  "message": "markdown or JSON string",
  "model": "provider/model",
  "tokens_used": 0,
  "cost_usd": 0,
  "citations": [{ "title": "Source title" }]
}
```

For structured Studio types, require JSON output and validate it with runtime guards before saving.

### `POST /api/sources/process`

Input:

```json
{ "sourceId": "uuid" }
```

Behavior:

- Authenticate.
- Load the source with both `sourceId` and current `user.id`.
- Process URL, YouTube, PDF, DOCX, or TXT.
- Trim extracted content.
- Compute word count and an approximate token count.
- Save `ready` content or an explicit `error` plus `error_message`.
- Never process an arbitrary storage path supplied by a client.
- Restrict webpage fetches to HTTP/HTTPS and reject localhost/private-network targets.
- Use timeouts for network and transcription calls.

Response:

```json
{ "status": "ready" }
```

or an HTTP 4xx/5xx JSON error with a useful `error` string.

## AI provider configuration

Provide these environment variables in `.env.example` without real values:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
GROQ_API_KEY=
GROQ_MODEL=qwen/qwen3.8-27b
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
TRANSCRIBER_SERVICE_URL=http://127.0.0.1:5000/transcribe
TRANSCRIBER_MODEL=tiny
```

Never print or commit `.env.local`, API keys, service tokens, or Supabase service-role keys. The browser may only receive public Supabase variables.

## Supabase schema

Create a migration with the following tables and relationships:

- `profiles`: id, email, full_name, avatar_url, plan, credits_used, credits_limit, timestamps.
- `notebooks`: user_id, title, description, emoji/icon, is_public, theme, metadata, timestamps.
- `sources`: notebook_id, user_id, type, title, content, file_path, file_size, url, word_count, token_count, status, error_message, metadata, timestamps.
- `chunks`: source_id, notebook_id, content, embedding, chunk_index, metadata, timestamps.
- `chats`: notebook_id, user_id, title, timestamps.
- `messages`: chat_id, notebook_id, user_id, role, content, citations, model_used, tokens_used, cost_usd, metadata, timestamp.
- `audio_overviews`: notebook_id, user_id, type, title, script, audio_url, duration_secs, status, error_message, usage fields, metadata, timestamp.
- `video_overviews`: notebook_id, user_id, title, script, video_url, thumbnail_url, duration_secs, status, error_message, usage fields, metadata, timestamp.
- `study_materials`: notebook_id, user_id, type, title, JSON content, usage fields, metadata, timestamp.
- `notes`: notebook_id, user_id, title, content, tags, is_pinned, metadata, timestamps.
- `api_keys`: user_id, name, key_hash, key_prefix, scopes, rate_limit, expires_at, last_used, is_active, metadata, timestamp.

Use UUID primary keys, foreign keys with cascade delete where appropriate, indexes on ownership/foreign keys/status/timestamps, JSONB metadata, and a vector extension if available.

Create a profile trigger after `auth.users` insert. Backfill existing users safely. Use strict RLS:

- A user can read/update their own profile.
- A user can CRUD their own notebooks, sources, chats, messages, study materials, overviews, notes, and API keys.
- Public notebooks may be read by unauthenticated/other users only if explicitly marked public.
- Chunks may be read through notebook ownership.
- Storage bucket `sources` must be private and scoped to authenticated ownership.

Do not use permissive policies that expose another user's sources or messages. Keep service-role operations server-only.

## YouTube transcription microservice

Create `tools/youtube-or-video-to-transcribe` as a small Python Flask service:

- `POST /transcribe`
- Accept `input_type=url|file`, URL/file, model, language, timestamps.
- Use `yt-dlp` to fetch captions or audio and Whisper for transcription.
- Support local media files as well as YouTube URLs.
- Models: tiny, base, small, medium, large.
- Return:

```json
{
  "text": "transcript",
  "title": "detected title",
  "language": "detected language",
  "source": "captions|whisper"
}
```

- Return clear JSON errors.
- Add upload size and timeout limits.
- Require FFmpeg for media extraction.
- Include `requirements.txt`, a short README, and a Windows-friendly startup command.

## Project structure to create

Use a structure equivalent to:

```text
src/
  app/
    page.tsx
    layout.tsx
    globals.css
    (auth)/login/page.tsx
    (auth)/signup/page.tsx
    (auth)/layout.tsx
    (app)/layout.tsx
    (app)/dashboard/page.tsx
    (app)/dashboard/DashboardClient.tsx
    (app)/notebook/[id]/page.tsx
    (app)/notebook/[id]/NotebookClient.tsx
    api/auth/callback/route.ts
    api/chat/route.ts
    api/sources/process/route.ts
  components/layout/AppNavbar.tsx
  components/layout/ThemeSwitcher.tsx
  components/ui/MaterialIcon.tsx
  lib/auth/allowed-email.ts
  lib/supabase/client.ts
  lib/supabase/server.ts
  lib/supabase/middleware.ts
  middleware.ts
  types/database.ts
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_backfill_profiles.sql
tools/youtube-or-video-to-transcribe/
```

## Reliability and security requirements

- Validate all request bodies and IDs.
- Scope every database query by authenticated ownership.
- Use explicit errors and accessible alerts.
- Avoid `any` except where a third-party library forces it; use type guards for JSON.
- Do not leak provider keys to the client.
- Do not use broad catches that turn failures into fake success.
- Bound source context and generated output.
- Add loading, empty, error, and success states for every async flow.
- Make delete actions require confirmation.
- Escape/render untrusted source text safely.
- Reject SSRF targets in URL ingestion.
- Do not claim “exact citations” unless citations actually identify the source used.

## Verification checklist

Before declaring the implementation complete:

1. `npm install` succeeds.
2. `npm run lint` succeeds.
3. `npm run build` succeeds.
4. Root redirects correctly for logged-out and logged-in states.
5. Non-`@umak.edu.ph` signup/login is rejected.
6. Signup confirmation UI works.
7. Notebook creation and deletion work.
8. File upload creates a processing source and eventually a ready/error source.
9. URL and YouTube sources are processed.
10. A first chat creates a chat and persists both messages.
11. Refreshing the notebook restores messages and saved Studio materials.
12. Gemini → Groq → Ollama fallback behavior is explicit and testable.
13. Flashcard and quiz JSON is validated before persistence.
14. Quiz scoring and restart work.
15. Dark/light mode persists in local storage.
16. Another authenticated user cannot read or mutate the first user's data.
17. No secrets are present in committed files.
18. Test the main flows in a real browser, not only with HTTP requests.

## Definition of done

Deliver a complete runnable repository, not a prose-only answer. Include:

- All source code and migrations.
- `.env.example`.
- Setup instructions for Supabase, Google OAuth, Gemini, Groq, Ollama, FFmpeg, and the transcription service.
- A responsive UI matching the navy/yellow Herons.AI identity.
- Working auth, dashboard, notebook, source ingestion, chat, Studio generators, persistence, and error states.
- A final verification report listing commands run and any integration credentials that still need to be supplied by the user.

If a third-party credential is unavailable, implement the integration behind the documented environment variable and provide a deterministic local/demo fallback; do not silently fake a successful production response.
