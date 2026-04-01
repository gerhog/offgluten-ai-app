# Offgluten AI — Session Progress

## Session: 2026-04-01

### Done:
- [x] Initial Next.js skeleton (App Router, TypeScript)
- [x] Supabase foundation — client/server helpers
- [x] Auth: signup, login, logout, email confirmation, Russian error messages
- [x] Protected routes middleware — guards `/app` and `/chat`
- [x] Landing page (`/`) — Russian copy, CTA "Войти"
- [x] Login page (`/login`) — combined signin/signup, Russian UI
- [x] Profile page (`/app`) — entitlement_status badge, color-coded per status
- [x] Deployed to Vercel

### Access model alignment (Prompt #1A + #1B)
- [x] TypeScript types aligned to MVP v1: `trial | paid | beta | blocked`
  - `src/types/supabase.ts`: `EntitlementStatus` named type, full `Profile` type
- [x] Supabase schema updated:
  - enum: added `blocked` (guest kept at DB level, deprecated)
  - profiles: added `trial_messages_used int NOT NULL DEFAULT 0 CHECK >= 0`
  - RPC: `increment_trial_usage(user_id uuid)` — atomic Postgres-side increment
  - Migrations in `supabase/migrations/`
- [x] Profile page badge updated to handle all 4 statuses with distinct colors

### Chat access gate (Prompt #3A + #3A-fix)
- [x] `src/lib/chat/access.ts`:
  - `TRIAL_LIMIT = 3` — single source of truth
  - `checkChatAccess()` — server-side access decision, all 6 deny reasons
  - `incrementTrialUsage(userId)` — calls Postgres RPC (atomic, no race condition)
- [x] `src/app/api/chat/route.ts` — POST /api/chat:
  - Validates message body (trim, reject empty)
  - Access gate → increment → stub response
  - Structured `status` field in all responses
  - Increment only happens after validation + allowed access

### In progress:
- [ ] n8n MCP connection (n8n needs update to v1.88+ for native MCP)

### Next steps:
- [ ] Update n8n to v1.88+, reconnect MCP
- [ ] Analyze existing n8n workflow (ID: HdHX6N3gop0lbC87), plan rework
- [ ] Replace stub reply in `/api/chat` with real n8n webhook call
- [ ] Build chat UI at `/chat`
- [ ] Add paywall/CTA UI for `trial_exhausted` state

### Key decisions made:
- Stack: Next.js 15 (App Router) + Supabase + Vercel + n8n
- Auth: Supabase email/password with email confirmation
- Entitlement model: `trial | paid | beta | blocked` (guest deprecated)
- Trial limit: 3 messages, tracked in `profiles.trial_messages_used`
- Access logic lives in Next.js backend, NOT in n8n, NOT in client
- All model calls go through n8n orchestration (not directly from app)
- All UI copy in Russian
- No UI library — raw inline styles throughout
- Migrations tracked in `supabase/migrations/`

### n8n workflow analysis (via REST API):
- Existing workflow "OpenClaw edit backup" (HdHX6N3gop0lbC87) — inactive
- Has 17 nodes: webhook entry, access policy logic, AI Agent (OpenAI), retrieval (Supabase Vector Store + Embeddings), Simple Memory, format/respond
- Access policy nodes need removal (logic moved to Next.js)
- Reusable: AI Agent, memory, vector store, embeddings, format/respond

### Commits this session:
- e6811f1 — refactor: align app-side entitlement model to MVP v1
- 5e270a5 — feat: Supabase schema foundation for MVP v1
- 797ab6b — feat: backend-first chat access gate foundation
- ec1c456 — feat: /api/chat accepts message body, trial increment, structured response
- 937cbb7 — fix: atomic trial increment via Postgres RPC, deduplicate TRIAL_LIMIT
