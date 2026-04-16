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

## Session: 2026-04-09

### Done — end-to-end durable memory update path (approved plan, fully implemented):

- [x] Patched `docs/memory-update-spec-v1.md` — добавлены Architecture section и counter-reset rule (e36655f)
- [x] Upgraded n8n draft workflow `GfCl6woJZWTwjFr8` (Offgluten Memory Update) via REST API:
  - Node 7: Call OpenAI (gpt-4.1-mini, json_object response_format, credential `OpenAi account`)
  - Node 9: Parse Model Output (validate allowed keys/categories, max 7 facts, fallback to existing memory)
  - Success response: strict `{ summary, facts }` only
  - Workflow remains inactive (draft)
- [x] `src/lib/chat/memory.ts` — добавлены `resetMemoryUpdateCounter` и `loadUserMemoryForChat`
- [x] `src/app/api/internal/memory-update/route.ts` — новый internal endpoint:
  - Принимает: user_id, last_user_message, last_assistant_answer
  - Загружает текущую память из Supabase, вызывает n8n, валидирует ответ, пишет обратно
  - Сбрасывает counter только при успешной записи
- [x] `src/app/api/chat/route.ts` — fire-and-forget trigger:
  - Только paid/beta + answered + updateDue + lastAnswer непустой
  - `last_assistant_answer` берётся из `n8nData.answer || n8nData.message`
  - URL строится через `new URL("/api/internal/memory-update", req.url).href`
- [x] `N8N_MEMORY_UPDATE_WEBHOOK_URL` добавлен в Vercel (production + preview, encrypted)
- [x] Redeploy задеплоен (e3c6d54 → dpl_DZky7LhbKSCg8GjSLi3PifTZtJTi, READY)
- [x] `docs/memory-update-n8n-workflow.md` — документация n8n воркфлоу

### Commits (2026-04-09):
- e36655f — docs: patch memory-update-spec
- 2f4af53 — feat: POST /api/internal/memory-update + resetMemoryUpdateCounter
- d34d4e5 — feat: wire memory-update trigger in /api/chat
- e3c6d54 — chore: trigger redeploy for N8N_MEMORY_UPDATE_WEBHOOK_URL env

### Done (2026-04-10 — полная сессия):

**Инфраструктура:**
- [x] Applied missing Supabase migrations to production (`user_memory` table + bookkeeping columns)
- [x] Fixed RLS gap: `/api/internal/memory-update` now uses service role client (`src/lib/supabase/service.ts`)
- [x] Added `SUPABASE_SERVICE_ROLE_KEY` to Vercel

**Memory extraction — Stage 1:**
- [x] Fixed n8n memory-update prompt: убрана over-restriction, добавлены секции EXTRACT/DO NOT EXTRACT
- [x] Fact merge logic в `/api/internal/memory-update`: avoids/includes мультизначные, остальные replace-in-place

**Memory extraction — Stage 2 (multi-turn context):**
- [x] `chat/page.tsx`: собирает и отправляет `recent_turns[]` (max 5, 500 символов) с каждым запросом
- [x] `/api/chat`: санитизирует, пробрасывает в memory-update trigger
- [x] `/api/internal/memory-update`: принимает, передаёт в n8n
- [x] n8n `GfCl6woJZWTwjFr8`: Normalize Input + Prepare Memory Prompt обновлены
- [x] Окно сужено 10→5 синхронно во всех точках

**Bug fix: main chat domain routing (Bug #1):**
- [x] Диагноз: два независимых дефекта — ё/е mismatch в keyword matching + нет контекста в main chat path
- [x] `/api/chat`: `recent_turns` теперь идёт и в основной n8n payload (ранее только в memory-update)
- [x] n8n `h724YslVLnv7QFNfQtVCT` — Normalize Input: добавлена нормализация `recent_turns`
- [x] n8n `h724YslVLnv7QFNfQtVCT` — Classify Query: ё→е нормализация + context-aware проверка по recent_turns
- [x] Прямой тест подтвердил: n8n classifier исправлен ("Обычно я ем рис и гречку" → answered при наличии recent_turns)

### Commits (2026-04-10):
- 78185eb — service role client + smoke-test fixes
- bbe9baf — feat: multi-turn context for memory extraction (stage 2)
- 54522d8 — fix: recent_turns window 10→5 везде
- 39eca0b — fix: pass recent_turns to main n8n webhook for domain classification

---

## Session: 2026-04-13

### Done:

**Bug #1 — main chat non_domain regression (исправлен и принят):**
- [x] Off-topic gate в `Classify Query` (`h724YslVLnv7QFNfQtVCT`): явный blocklist (анекдот, погода, кино...) проверяется ДО context fallback — prior domain context не может "спасти" off-topic сообщение
- [x] Все 4 acceptance cases пройдены: "Что такое целиакия?" → answered, "Обычно я ем рис и гречку" → answered, "Расскажи анекдот" → non_domain, "Какая сегодня погода?" → non_domain

**Bug #2 — weak_retrieval_medical fallback слишком жёсткий (исправлен):**
- [x] Root cause: similarity scores = None из Supabase Vector Store → maxSimilarity всегда 0 → порог ≥0.7 никогда не достигается → все medical запросы с чанками → weak → cautious
- [x] `Assess Retrieval Quality` (`h724YslVLnv7QFNfQtVCT`): cautious только при `empty` (нет чанков совсем); weak с чанками → AI отвечает осторожно
- [x] Тест: "у меня целиакия. хочу сдать анализы..." → answered (3 релевантных чанка)

**Bug #3 — memory-update pipeline не завершался (исправлен):**
- [x] Root cause: опечатка `existingFacts` вместо `existingFactsText` в `contextParts` → ReferenceError → workflow падал до OpenAI → summary/facts не обновлялись, счётчик не сбрасывался
- [x] `Prepare Memory Prompt` (`GfCl6woJZWTwjFr8`): одна строка исправлена
- [x] Supabase до/после: `answered_since_last_memory_update` 20→0, `last_memory_update_at` обновлён, summary обновлён

**Memory extraction policy v1 (реализована, частично верифицирована):**
- [x] `Prepare Memory Prompt` (`GfCl6woJZWTwjFr8`) обновлён:
  - Facts: строгие правила — только стабильные личные атрибуты; `includes` только при явных habitual-сигналах ("обычно", "каждый день", "часто", "регулярно")
  - Summary: stable profile + recurring interests; запрет временных симптомов, one-off событий, probabilistic medical inference
- [x] Прямые тесты webhook: "Вчера мне было плохо" → не попало в summary ✓; "Обычно я ем рис и гречку каждый день" → includes: rice, buckwheat ✓
- [ ] **Полный E2E цикл после последних патчей не пройден** — нужен clean smoke test

### Не завершено / следующая сессия:

**Memory extraction — revalidation (PENDING):**
- [ ] Чистый smoke test: реальный chat → trigger → n8n → Supabase writeback
- [ ] Проверить: нет временных симптомов в summary, `includes` появляются от habitual-фраз, счётчик сбрасывается
- [ ] Только после этого считать tuning закрытым

**Roadmap:**
- [ ] Paid soft-limit engine (20/5min, 30-50/day)
- [ ] Real billing integration

---

## Session: 2026-04-14

### Done:

**Durable memory pipeline — три app-side фикса (все подтверждены live):**
- [x] `708fc84` — `await incrementAnsweredCounter(...)`: был fire-and-forget, Vercel убивал до завершения
- [x] `e538d8a` — off-by-one в `updateDue`: `loadUserMemoryForChat` читал counter до инкремента → триггер срабатывал на N+1 вместо N; фикс: `isMemoryUpdateDue(count + 1)`
- [x] `a75b3d0` — `await fetch(internalUrl)` для memory-update trigger: та же fire-and-forget проблема, `/api/internal/memory-update` никогда не получал вызов
- [x] `4408e30` — `AbortSignal.timeout(20000)` на internal fetch + логирование n8n ошибок по типу (AbortError vs. сетевая)
- [x] Live подтверждение: `answered_since_last_memory_update` сбрасывается в 0, `last_memory_update_at` обновляется, `GfCl6woJZWTwjFr8` исполняется успешно

**Memory extraction quality — tuning (`GfCl6woJZWTwjFr8`, `Prepare Memory Prompt`):**
- [x] `includes`: расширен список habitual-сигналов, добавлено правило положительного bias, 4 новых позитивных + 3 негативных примера
- [x] Summary: запрет interpretive connectives (указывает на, свидетельствует о…), структурное правило "не добавлять вывод к факту", good/bad пример в промпте
- [x] Верифицировано direct webhook: summary описательный, `includes` извлекается из habitual-фраз

**Markdown rendering в chat UI:**
- [x] `react-markdown@10.1.0` добавлен как зависимость
- [x] `AssistantMessage` компонент — параграфы, списки, bold; user messages — plain text
- [x] Commit `33633b7`

**Answer formatting — `h724YslVLnv7QFNfQtVCT`:**
- [x] `Prepare AI Input`: добавлены правила валидного markdown (blank line перед списком, каждый bullet на новой строке, no bold+bullet на одной строке, good/bad пример), запрет citation markers
- [x] `Format AI Response`: regex-очистка citation markers + deterministic нормализатор псевдо-markdown → `**Header:** - item1 - item2` становится корректным markdown

### Commits (2026-04-14):
- 708fc84 — fix: await incrementAnsweredCounter
- e538d8a — fix: off-by-one в updateDue
- a75b3d0 — fix: await memory-update trigger fetch
- 4408e30 — fix: timeout на internal fetch + error logging
- 33633b7 — feat: markdown rendering (react-markdown)

### Next steps:
- [ ] Memory model comparison: gpt-4.1-mini vs. сильнее для extraction
- [ ] Smart allowance для user-context сообщений без явного gluten/celiac anchor
- [ ] Occasional temporary_error расследование (логирование добавлено, теперь наблюдаемо)
- [ ] Paid soft-limit engine
- [ ] Real billing integration

---

## Session: 2026-04-16

### Done:

**Диагностика temporary_error (СЕРВИС НЕДОСТУПЕН):**
- [x] Root cause: n8n выполнялся 26.5с, `AbortSignal.timeout(25000)` срабатывал на 25с → `/api/chat` возвращал `temporary_error`; n8n при этом успешно завершался через 1.5с
- [x] `src/app/api/chat/route.ts`: timeout 25000→35000, лог обновлён
- [x] `src/app/api/chat/route.ts` + `src/app/api/internal/memory-update/route.ts`: добавлен `export const maxDuration = 60`
- [x] Commit `02e31e0`

**RAG dataset — первичная генерация (celiac knowledge base):**
- [x] Загружен Google Docs документ (73 KB, ~1400 строк) через Playwright → `/playwright-mcp/Новый-документ.txt`
- [x] `RAG_main_edited/convert.py` — скрипт конвертации: line-by-line ремонт, chunk splitting, per-chunk JSON parsing с multi-strategy fallback, enrichment (domain/record_type/guardrail/region), дедупликация, валидация
- [x] Починено 6 типов структурных повреждений: `double_close`×1, `bare_brackets`×7, `missing_close`×5 (added `}` или 1–3 `]`)
- [x] `RAG_main_edited/rag-celiac-baseline-v2.json` — 171 запись, 230 KB, все поля заполнены, JSON валиден
- [x] `RAG_main_edited/rag-celiac-baseline-v2-notes.md` — лог ремонта + раздельная статистика по секциям
- [x] Доменная структура: lifestyle(54), diet(28), social(17), definitions(17), comorbidity(13), cross_contamination(15), certification(9), symptoms(5), diagnosis(5), treatment(5), action_algorithm(2), medications(1)
- [x] Preservation: exact(153), split_exact_sentences(6), mechanically_repaired_only(12)
- [x] Регионы: global(136), russia(35)
- [x] Исправлена пустая `topic` у записи `gluten-free-hotels` → "Отели с безглютеновым питанием — общие принципы"

### Next steps:
- [ ] Загрузить датасет в Supabase vector store (pgvector)
- [ ] Smoke test retrieval: несколько целевых запросов, проверить similarity scores
- [ ] Memory model comparison: gpt-4.1-mini vs. сильнее для extraction
- [ ] Paid soft-limit engine
- [ ] Real billing integration

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
