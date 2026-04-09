# n8n Memory Update Workflow

## Identity

| Field | Value |
|---|---|
| Workflow ID | `GfCl6woJZWTwjFr8` |
| Name | Offgluten Memory Update (draft) |
| Status | **inactive** — activate before smoke-test |
| Production webhook | `https://n8n.offgluten.ru/webhook/offgluten-memory-update-draft-76962ec7` |
| Test webhook | `https://n8n.offgluten.ru/webhook-test/offgluten-memory-update-draft-76962ec7` |
| OpenAI credential | `OpenAi account` (id: `d3DJCG04YoZoCJ20`) |

---

## Node map

| ID | Name | Type | Role |
|---|---|---|---|
| 1 | Memory Update Webhook | webhook | Entry point |
| 2 | Normalize Input | code | Normalize body fields, handle aliases |
| 3 | Validate Contract | code | Validate required fields, filter invalid facts |
| 4 | Route By Validity | switch | Branch: invalid → node 5, ok → node 6 |
| 5 | Invalid Request Response | code | Returns `{ ok: false, error_code, message }` |
| 6 | Prepare Memory Prompt | code | Builds system prompt + user context + `openai_request` object |
| 7 | Call OpenAI | httpRequest | POST to OpenAI chat completions, `gpt-4.1-mini`, `json_object` |
| 8 | Respond JSON | respondToWebhook | Final JSON response node |
| 9 | Parse Model Output | code | Validate allowed keys/categories, clamp facts to 7, clamp summary to 300 chars, fallback on error |

---

## Input contract

```json
{
  "user_id": "string (required)",
  "latest_turn": {
    "user_message": "string (required)",
    "assistant_answer": "string (required)"
  },
  "existing_memory": {
    "summary": "string | null",
    "facts": [{ "key": "...", "value": "...", "category": "..." }]
  }
}
```

---

## Output contract (success)

```json
{ "summary": "string | null", "facts": MemoryFact[] }
```

Strict JSON, no extra fields.

---

## Output contract (invalid request)

```json
{ "ok": false, "status": "error", "error_code": "...", "message": "..." }
```

---

## Model config

- Model: `gpt-4.1-mini`
- `response_format: { type: "json_object" }`
- `temperature: 0`
- `max_tokens: 600`

---

## Activating the workflow

```bash
curl -s -X POST https://n8n.offgluten.ru/api/v1/workflows/GfCl6woJZWTwjFr8/activate \
  -H "X-N8N-API-KEY: <key>"
```

Do **not** activate until smoke-test is ready.
