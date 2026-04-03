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
- [x] Supabase schema: added `blocked`, `trial_messages_used`, RPC `increment_trial_usage`
- [x] Profile page badge updated to handle all 4 statuses

### Chat access gate (Prompt #3A + #3A-fix)
- [x] `src/lib/chat/access.ts` — `checkChatAccess()`, `incrementTrialUsage()`, `TRIAL_LIMIT=3`
- [x] `src/app/api/chat/route.ts` — POST /api/chat with validation, access gate, stub reply

### Commits (2026-04-01):
- e6811f1, 5e270a5, 797ab6b, ec1c456, 937cbb7, d1d53fe

---

## Session: 2026-04-03

### Done:
- [x] n8n MCP server configured and connected via `npx -y n8n-mcp-server`
  - Required `N8N_API_URL=https://n8n.offgluten.ru/api/v1` (not just base URL)
  - Added to `~/.claude.json` project scope
  - Status: ✓ Connected (verified with `claude mcp list`)

### In progress:
- [ ] n8n workflow refactor — `OpenClaw edit` (h724YslVLnv7QFNfQtVCT)
  - Plan fully approved and saved in memory (n8n_workflow_plan.md)
  - MCP now connected, ready to start refactor in new session

### Next steps (immediate):
- [ ] Start new Claude Code session (MCP tools load at session start)
- [ ] Run approved refactor of `OpenClaw edit` via MCP
- [ ] Update `POST /api/chat` to call n8n webhook with new payload
- [ ] Build chat UI at `/chat`
- [ ] Add paywall/CTA UI for `trial_exhausted` state

### Key decisions made (2026-04-02/03):
- n8n MCP: use `npx -y n8n-mcp-server` with `N8N_API_URL=https://n8n.offgluten.ru/api/v1`
- `OpenClaw edit` refactor plan fully approved — see memory/n8n_workflow_plan.md
- Workflow to refactor: ID `h724YslVLnv7QFNfQtVCT` (active, 19 nodes)
- 9 nodes to delete (legacy guest/access), 10 to keep (retrieval core), 8 to add (new orchestration)
- Input contract: user_id, message, entitlement_status (required) + session_id, memory (optional)
- Output contract: {ok, status, answer, reason, meta: {route, retrieval, model_tier}}
- Retrieval quality thresholds: strong (>=2 chunks, similarity>=0.7), weak, empty
- classify_query: rules-first keyword matching (no LLM call for MVP)
- medical_sensitive + weak/empty → cautious response, no fallback to cheap model
