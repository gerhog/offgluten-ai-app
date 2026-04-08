# Durable Memory Update Spec — v1

## Status
Draft. Drives the next implementation step (memory-update workflow + trigger).

---

## Scope

- Applies to `paid` and `beta` users only.
- `trial` users have no durable memory. This spec does not apply to them.
- Memory lives in `user_memory` (Supabase). n8n consumes it; does not own it.

---

## Trigger baseline

- **Strategy:** event-based (not content-based).
- **Default rule:** run a memory update after every **5 answered messages** for a paid/beta user.
- Counter tracks answered messages per user (not total requests — access-denied and limited responses do not count).
- Trigger fires at the app layer, not inside the main chat workflow.
- A failed memory update must not block or degrade the chat response.

---

## Input contract

What the memory-update step receives:

```json
{
  "user_id": "uuid",
  "entitlement_status": "paid | beta",
  "recent_exchange": {
    "user_message": "string",
    "assistant_answer": "string"
  },
  "current_memory": {
    "summary": "string | null",
    "facts": [
      { "key": "MemoryFactKey", "value": "string", "category": "MemoryFactCategory" }
    ]
  }
}
```

`current_memory` may be null or empty on first update.

---

## Output contract

What the memory-update step must return (strict JSON, no prose):

```json
{
  "summary": "string | null",
  "facts": [
    { "key": "MemoryFactKey", "value": "string", "category": "MemoryFactCategory" }
  ]
}
```

- `summary` replaces the existing summary entirely on write.
- `facts` replaces the entire facts array on write (full overwrite, not append).
- If nothing useful was extracted, return the current memory unchanged.
- Output must be valid JSON matching the schema. No explanation text outside JSON.

---

## Summary rules

- Max length: **300 characters**.
- Must describe the user's confirmed context, not inferred guesses.
- Written in third person, factual, no filler ("The user has celiac disease and avoids oats.").
- Do not include: session-specific content, one-off questions, navigation/browsing intent.
- Do not include: medical advice, diagnoses the user didn't state themselves.

---

## Facts rules

### Allowed keys (MemoryFactKey)
| Key | Meaning |
|---|---|
| `diagnosed_with` | Confirmed diagnosis stated by user (e.g. "celiac disease") |
| `avoids` | Foods/ingredients the user avoids (e.g. "oats", "barley") |
| `includes` | Foods user consistently includes in their diet — not a safety claim |
| `prefers` | Dietary lifestyle preferences (e.g. "vegan", "lactose-free") |
| `diet_type` | Overall diet pattern (e.g. "strict gluten-free", "low-FODMAP") |

### Allowed categories (MemoryFactCategory)
`medical` | `dietary` | `preference`

### Limits
- Max **7 facts** total per user in v1.
- If at limit: replace an existing fact with the same key rather than appending.
- If no same-key fact exists and limit is reached: drop the least specific fact.

### What cannot be saved
- Inferred or assumed facts not stated by the user.
- Temporary or session-specific context ("asked about bread today").
- Emotional state, sentiment, or opinion ("user seemed worried").
- Medical interpretations or safety conclusions ("user can tolerate X").
- Anything from the assistant's answer that the user did not confirm.

---

## Model tier

- Use a cheap structured-output model tier (e.g. GPT-4.1-mini or equivalent).
- Must support strict JSON output mode.
- Do not use the high-trust tier for memory extraction.

---

## Validation criteria (pre-defined, checked during live validation)

| Criterion | Pass condition |
|---|---|
| Facts count | Never exceeds 7 per user |
| Summary length | Never exceeds 300 chars |
| Fact quality | No inferred/assumed facts; only user-stated |
| Cost per update | Acceptable at 5-message trigger cadence for paid/beta volume |
| Chat continuity | Memory-informed answers feel contextually relevant, not robotic |
| No regressions | Existing chat flow unaffected when memory update fails |
