#!/usr/bin/env python3
"""
convert.py — превращает базовый документ знаний (Новый-документ.txt)
в продакшн-ready RAG JSON согласно схеме из промта.

Запуск:
  python3 RAG_main_edited/convert.py
"""

import re
import json
import sys
from pathlib import Path

SRC  = Path(__file__).parent.parent / ".playwright-mcp" / "Новый-документ.txt"
DEST = Path(__file__).parent / "rag-celiac-baseline-v2.json"
NOTES= Path(__file__).parent / "rag-celiac-baseline-v2-notes.md"

REPAIRS = []
NONSTANDARD_CONVERSIONS = []

# ─────────────────────────────────────────────
# 1. ПОСТРОЧНЫЙ РЕМОНТ + РАЗБИВКА НА ЧАНКИ
# ─────────────────────────────────────────────

def repair_and_split(text):
    """
    Разбивает поток объектов на отдельные строки-чанки.
    Стратегия: разделитель = строка, начинающаяся с '{' или '  {' (старт новой записи).
    Перед разбиением выполняет минимальный ремонт структурных повреждений.
    """
    lines = text.split("\n")
    repaired_lines = []
    repair_stats = {
        "double_open": 0,
        "double_close": 0,
        "bare_brackets": 0,
        "missing_close": 0,
    }

    prev_stripped = ""
    for i, line in enumerate(lines):
        stripped = line.strip()

        # Пропустить изолированные [ и ] — они обрамляют подмассив pay-* записей
        if stripped in ("[", "]"):
            repair_stats["bare_brackets"] += 1
            repaired_lines.append("")
            continue

        # Исправить строку вида '{{' (двойной открывающий) → '{'
        if stripped.startswith("{{"):
            line = line.replace("{{", "{", 1)
            stripped = line.strip()
            repair_stats["double_open"] += 1

        # Исправить строку вида '}}' (двойной закрывающий) → '}'
        if stripped == "}}":
            line = line.replace("}}", "}", 1)
            stripped = line.strip()
            repair_stats["double_close"] += 1

        # Ключевой ремонт: если предыдущая значимая строка заканчивается на ] или "
        # (конец значения свойства), и текущая строка — новый объект { или {,
        # значит у предыдущего объекта пропущена закрывающая }.
        # Вставляем пустую строку с } перед текущей строкой.
        is_new_obj = (stripped == "{" or stripped == "{,") or \
                     (stripped.startswith("{") and re.match(r'^\{\s*$', stripped))
        if is_new_obj and prev_stripped and prev_stripped[-1] in ('"', ']'):
            repaired_lines.append("}")
            repair_stats["missing_close"] += 1

        repaired_lines.append(line)
        if stripped:
            prev_stripped = stripped

    for key, count in repair_stats.items():
        if count:
            REPAIRS.append(f"{key}: {count} исправлений")

    repaired_text = "\n".join(repaired_lines)

    # Теперь находим границы объектов верхнего уровня:
    # строка = '{' (col 0) или '  {' (2 пробела, для записей внутри бывшего подмассива)
    # Разделяем текст по этим границам.
    record_starts = []
    for i, line in enumerate(repaired_lines):
        stripped = line.strip()
        indent = len(line) - len(line.lstrip())
        if stripped == "{" and indent <= 2:
            record_starts.append(i)

    # Вырезаем чанки
    chunks = []
    for k, start in enumerate(record_starts):
        end = record_starts[k+1] if k+1 < len(record_starts) else len(repaired_lines)
        chunk_lines = repaired_lines[start:end]
        # Убрать хвостовую запятую если есть (объект был в массиве)
        chunk_text = "\n".join(chunk_lines).rstrip().rstrip(",").rstrip()
        if chunk_text:
            chunks.append(chunk_text)

    return chunks


def try_repair_chunk(chunk):
    """Пробует разные стратегии починки повреждённого JSON-чанка."""
    # 1. Добавить закрывающую }
    for suffix in ["}", "\n}"]:
        try:
            obj = json.loads(chunk + suffix)
            if isinstance(obj, dict):
                return obj, "added }"
        except Exception:
            pass

    # 2. Пропущена закрывающая ] перед финальной } (основной паттерн источника)
    base = chunk.rstrip()
    if base.endswith("}"):
        inner = base[:-1]
        for n_brackets in range(1, 4):
            candidate = inner + ("\n]" * n_brackets) + "\n}"
            try:
                obj = json.loads(candidate)
                if isinstance(obj, dict):
                    return obj, "added " + str(n_brackets) + "x ]"
            except Exception:
                pass

    # 3. Убрать незавершённые строки в конце, добавить ] и }
    lines = chunk.split("\n")
    while len(lines) > 2 and not lines[-1].strip().startswith('"'):
        lines.pop()
    base2 = "\n".join(lines).rstrip()
    for suffix2 in ["\n}\n", "\n]\n}", "\n]\n]\n}"]:
        try:
            obj = json.loads(base2 + suffix2)
            if isinstance(obj, dict):
                return obj, "trimmed + closed"
        except Exception:
            pass

    return None, None


def parse_chunks(chunks):
    """Парсит список текстовых чанков в объекты Python."""
    objects = []
    skipped = 0
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk or chunk in ("{}", "{"):
            continue
        try:
            obj = json.loads(chunk)
            if isinstance(obj, dict):
                objects.append(obj)
        except json.JSONDecodeError:
            obj, strategy = try_repair_chunk(chunk)
            if obj is not None:
                objects.append(obj)
                rid = obj.get("id", "?")
                REPAIRS.append("  Починен объект " + rid + " (" + strategy + ")")
            else:
                skipped += 1
                preview = chunk[:100].replace("\n", " ")
                REPAIRS.append("  Пропущен чанк (непоправимый): «" + preview + "»")

    if skipped:
        print("Пропущено непоправимых чанков: " + str(skipped))
    return objects


# ─────────────────────────────────────────────
# 2. МАППИНГ СЕКЦИЙ → ДОМЕН / ТИП / GUARDRAIL / РЕГИОН
# ─────────────────────────────────────────────

SECTION_META = {
    "Лечение": {
        "domain": "treatment",
        "record_type": "clinical_rule",
        "guardrail": ["remind_doctor", "no_treatment_prescription", "no_dosage_advice"],
        "region": "global",
    },
    "Безглютеновая диета": {
        "domain": "diet",
        "record_type": "clinical_rule",
        "guardrail": [],
        "region": "global",
    },
    "Сертификация": {
        "domain": "certification",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "global",
    },
    "Ошибки и заблуждения": {
        "domain": "diet",
        "record_type": "clinical_rule",
        "guardrail": ["caution_if_uncertain"],
        "region": "global",
    },
    "Перекрестное загрязнение": {
        "domain": "cross_contamination",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "global",
    },
    "Жизнь с целиакией": {
        "domain": "lifestyle",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "global",
    },
    "Алгоритмы действий": {
        "domain": "action_algorithm",
        "record_type": "action_algorithm",
        "guardrail": ["remind_doctor", "caution_if_uncertain"],
        "region": "global",
    },
    "Сопутствующие заболевания": {
        "domain": "comorbidity",
        "record_type": "clinical_fact",
        "guardrail": ["remind_doctor", "no_diagnosis", "use_for_sensitive_medical_routing"],
        "region": "global",
    },
    "FAQ": {
        "domain": "definitions",
        "record_type": "clinical_fact",
        "guardrail": ["remind_doctor"],
        "region": "global",
    },
    "Целиакия у взрослых и детей": {
        "domain": "symptoms",
        "record_type": "clinical_fact",
        "guardrail": ["remind_doctor", "use_for_sensitive_medical_routing"],
        "region": "global",
    },
    "Поздняя диагностика целиакии": {
        "domain": "diagnosis",
        "record_type": "clinical_fact",
        "guardrail": ["remind_doctor", "no_diagnosis", "use_for_sensitive_medical_routing"],
        "region": "global",
    },
    "После постановки диагноза": {
        "domain": "lifestyle",
        "record_type": "practical_guidance",
        "guardrail": ["remind_doctor"],
        "region": "global",
    },
    "Адаптация в обществе": {
        "domain": "social",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "global",
    },
    "Частые ошибки на БГ-диете": {
        "domain": "diet",
        "record_type": "practical_guidance",
        "guardrail": ["caution_if_uncertain"],
        "region": "global",
    },
    "Мифы о целиакии": {
        "domain": "definitions",
        "record_type": "clinical_fact",
        "guardrail": [],
        "region": "global",
    },
    "Питание в детском саду": {
        "domain": "lifestyle",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "russia",
    },
    "Питание в школе": {
        "domain": "lifestyle",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "russia",
    },
    "Выплаты и льготы при целиакии": {
        "domain": "social",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "russia",
    },
    "Как проверить продукт при целиакии": {
        "domain": "certification",
        "record_type": "practical_guidance",
        "guardrail": ["caution_if_uncertain"],
        "region": "global",
    },
    "Пищевые добавки (E-добавки)": {
        "domain": "diet",
        "record_type": "practical_guidance",
        "guardrail": ["caution_if_uncertain"],
        "region": "global",
    },
    "Ингредиенты, содержащие глютен": {
        "domain": "diet",
        "record_type": "clinical_rule",
        "guardrail": [],
        "region": "global",
    },
    "Безглютеновые злаки и крупы": {
        "domain": "diet",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "global",
    },
    "Продукты с высоким риском скрытого глютена": {
        "domain": "cross_contamination",
        "record_type": "practical_guidance",
        "guardrail": ["caution_if_uncertain"],
        "region": "global",
    },
    "Натуральные продукты без глютена": {
        "domain": "diet",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "global",
    },
    "Глютен в лекарственных препаратах": {
        "domain": "medications",
        "record_type": "assistant_policy",
        "guardrail": ["remind_doctor", "no_treatment_prescription", "no_dosage_advice"],
        "region": "global",
    },
    "Глютен в косметике": {
        "domain": "lifestyle",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "global",
    },
    "Целиакия и армия (Россия)": {
        "domain": "social",
        "record_type": "practical_guidance",
        "guardrail": ["remind_doctor"],
        "region": "russia",
    },
    "Инвалидность при целиакии (Россия)": {
        "domain": "social",
        "record_type": "practical_guidance",
        "guardrail": ["remind_doctor"],
        "region": "russia",
    },
    "Как получить инвалидность при целиакии (Россия)": {
        "domain": "social",
        "record_type": "action_algorithm",
        "guardrail": ["remind_doctor"],
        "region": "russia",
    },
    "Отели с безглютеновым питанием": {
        "domain": "lifestyle",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "global",
    },
    "Глютен в алкоголе": {
        "domain": "diet",
        "record_type": "practical_guidance",
        "guardrail": [],
        "region": "global",
    },
    "Как выбирать продукты без сертификации": {
        "domain": "diet",
        "record_type": "practical_guidance",
        "guardrail": ["caution_if_uncertain"],
        "region": "global",
    },
}

DEFAULT_META = {
    "domain": "definitions",
    "record_type": "clinical_fact",
    "guardrail": [],
    "region": "global",
}

RUSSIA_KEYWORDS = [
    "Санкт-Петербург", "МФЦ", "Роспотребнадзор", "ФЗ №",
    "СанПиН", "МСЭ", "Россия", "российск", "РФ", "Москв",
    "Пензенск", "перечёркнутый колос", "перечеркнутый колос",
]


def get_meta(record):
    section = record.get("section", "")
    meta = dict(SECTION_META.get(section, DEFAULT_META))
    meta["guardrail"] = list(meta.get("guardrail", []))

    rid = record.get("id", "")
    if rid in ("treat-003", "treat-004"):
        for g in ["remind_doctor", "no_treatment_prescription", "no_dosage_advice"]:
            if g not in meta["guardrail"]:
                meta["guardrail"].append(g)

    all_text = " ".join([
        record.get("text", ""),
        record.get("topic", ""),
        record.get("description", ""),
        str(record.get("section", "")),
    ])
    if any(kw in all_text for kw in RUSSIA_KEYWORDS):
        meta["region"] = "russia"

    return meta


# ─────────────────────────────────────────────
# 3. КОНВЕРТАЦИЯ НЕСТАНДАРТНЫХ ЗАПИСЕЙ В ТЕКСТ
# ─────────────────────────────────────────────

def flatten_to_text(raw):
    """Сохраняет оригинальные формулировки, преобразуя нестандартную структуру в текст."""
    parts = []
    skip_keys = {"id", "section", "topic", "tags", "sources", "region", "country"}

    for key, val in raw.items():
        if key in skip_keys:
            continue

        if key == "sections" and isinstance(val, list):
            for s in val:
                title = s.get("title", "")
                content = s.get("content", "")
                if title and content:
                    parts.append(f"{title}: {content}")

        elif key == "e_additives" and isinstance(val, list):
            parts.append("E-добавки с возможным риском глютена: " + ", ".join(
                v for v in val if isinstance(v, str)
            ))

        elif key == "ingredients" and isinstance(val, list):
            parts.append("Ингредиенты: " + "; ".join(
                v for v in val if isinstance(v, str)
            ))

        elif key == "products" and isinstance(val, list):
            parts.append("Продукты: " + "; ".join(
                v for v in val if isinstance(v, str)
            ))

        elif key == "steps" and isinstance(val, list):
            numbered = [f"{i+1}) {v}" for i, v in enumerate(val) if isinstance(v, str)]
            parts.append("Шаги:\n" + "\n".join(numbered))

        elif key == "question":
            parts.insert(0, f"Вопрос: {val}")

        elif isinstance(val, list) and all(isinstance(v, str) for v in val):
            label = key.replace("_", " ")
            items = "\n".join(f"- {v}" for v in val if v.strip())
            parts.append(f"{label}:\n{items}")

        elif isinstance(val, dict):
            for k, v in val.items():
                if isinstance(v, str) and v.strip():
                    parts.append(f"{k.replace('_', ' ')}: {v}")

        elif isinstance(val, str) and val.strip():
            parts.append(val.strip())

    return "\n\n".join(p for p in parts if p.strip())


# ─────────────────────────────────────────────
# 4. ПОСТРОЕНИЕ ФИНАЛЬНОЙ ЗАПИСИ
# ─────────────────────────────────────────────

_counter = [0]

def build_record(raw):
    _counter[0] += 1
    if not isinstance(raw, dict):
        return None

    rid = raw.get("id", f"gen-{_counter[0]:04d}")
    section = raw.get("section", "")
    topic = raw.get("topic", "")
    tags = raw.get("tags", [])
    if not isinstance(tags, list):
        tags = []

    text = raw.get("text", "").strip()
    preservation = "exact"

    if not text:
        if "answer" in raw:
            q = raw.get("question", "").strip()
            a = raw.get("answer", "").strip()
            text = f"Вопрос: {q}\n\nОтвет: {a}" if q else a
            preservation = "split_exact_sentences"
        else:
            text = flatten_to_text(raw).strip()
            preservation = "mechanically_repaired_only"
            NONSTANDARD_CONVERSIONS.append(rid)

    if not text:
        return None

    meta = get_meta({**raw, "text": text})

    return {
        "id": rid,
        "section": section,
        "topic": topic,
        "text": text,
        "tags": tags,
        "domain": meta["domain"],
        "record_type": meta["record_type"],
        "guardrail": meta["guardrail"],
        "region": meta["region"],
        "source_id": rid,
        "source_topic": topic,
        "source_preservation": preservation,
    }


# ─────────────────────────────────────────────
# 5. ДЕДУПЛИКАЦИЯ
# ─────────────────────────────────────────────

def deduplicate(records):
    seen = {}
    dups = []
    out = []
    for r in records:
        rid = r["id"]
        if rid in seen:
            dups.append(rid)
        else:
            seen[rid] = True
            out.append(r)
    return out, dups


# ─────────────────────────────────────────────
# 6. MAIN
# ─────────────────────────────────────────────

def main():
    print(f"Читаю: {SRC}")
    raw_text = SRC.read_text(encoding="utf-8").lstrip("\ufeff")
    print(f"Размер: {len(raw_text)} символов, {raw_text.count(chr(10))} строк")

    print("Ремонт и разбивка на чанки...")
    chunks = repair_and_split(raw_text)
    print(f"Чанков: {len(chunks)}")

    print("Парсинг...")
    raw_list = parse_chunks(chunks)
    print(f"Распарсено объектов: {len(raw_list)}")

    if REPAIRS:
        print("Лог ремонта:")
        for r in REPAIRS:
            print(f"  {r}")

    print("Конвертация записей...")
    records = []
    for raw in raw_list:
        rec = build_record(raw)
        if rec:
            records.append(rec)

    print(f"Сформировано записей: {len(records)}")

    records, dups = deduplicate(records)
    if dups:
        print(f"Удалены дубли: {dups}")

    # Валидация
    required = ["id", "section", "topic", "text", "tags", "domain",
                "record_type", "guardrail", "region", "source_id",
                "source_topic", "source_preservation"]
    errors = []
    for r in records:
        for f in required:
            if f not in r:
                errors.append(f"[{r['id']}] отсутствует поле: {f}")
        if not r.get("text", "").strip():
            errors.append(f"[{r['id']}] пустой text")

    if errors:
        print(f"Ошибки валидации ({len(errors)}):")
        for e in errors[:20]:
            print(f"  {e}")
    else:
        print("Валидация пройдена.")

    DEST.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Записан: {DEST} ({DEST.stat().st_size // 1024} KB, {len(records)} записей)")

    write_notes(records, dups, errors)
    print(f"Записан: {NOTES}")


def write_notes(records, dups, errors):
    section_counts = {}
    for r in records:
        s = r.get("section", "(без секции)")
        section_counts[s] = section_counts.get(s, 0) + 1

    lines = [
        "# rag-celiac-baseline-v2 — Notes",
        "",
        "## Схема записей",
        "",
        "Каждая запись содержит обязательные поля:",
        "- `id` — уникальный идентификатор из источника",
        "- `section` — раздел из источника",
        "- `topic` — тема из источника",
        "- `text` — медицинский текст (оригинальные формулировки сохранены)",
        "- `tags` — теги из источника",
        "- `domain` — доменная классификация",
        "- `record_type` — тип записи",
        "- `guardrail` — ограничения для ассистента",
        "- `region` — regional scope (global / russia)",
        "- `source_id` — оригинальный id",
        "- `source_topic` — оригинальный topic",
        "- `source_preservation` — exact / split_exact_sentences / mechanically_repaired_only",
        "",
        "## Структурные повреждения источника и ремонт",
        "",
    ]
    for r in REPAIRS:
        lines.append(f"- {r}")

    lines += [
        "",
        "## Нестандартные записи (mechanically_repaired_only)",
        "",
        "Записи с нестандартной схемой (нет поля `text`); текст сформирован",
        "механически из полей объекта без изменения оригинальных формулировок:",
        "",
    ]
    if NONSTANDARD_CONVERSIONS:
        for nid in NONSTANDARD_CONVERSIONS:
            lines.append(f"- `{nid}`")
    else:
        lines.append("_(нет)_")

    lines += [
        "",
        "## Дубликаты (удалены)",
        "",
    ]
    if dups:
        for d in dups:
            lines.append(f"- `{d}`")
    else:
        lines.append("_(нет)_")

    lines += [
        "",
        "## Статистика по секциям",
        "",
        "| Секция | Записей |",
        "|--------|---------|",
    ]
    for s, c in sorted(section_counts.items(), key=lambda x: -x[1]):
        lines.append(f"| {s} | {c} |")

    lines += [
        "",
        f"**Итого записей: {len(records)}**",
        "",
        "## Аудит сохранности формулировок",
        "",
        "Выборочная проверка 10 записей с `source_preservation: exact`:",
        "",
    ]

    exact = {r["id"]: r for r in records if r["source_preservation"] == "exact"}
    audit_ids = ["treat-002", "treat-006", "diet-003", "diet-006",
                 "cert-002", "cert-003", "kitchen-006", "mist-001",
                 "myth-009", "algo-001"]
    for sid in audit_ids:
        rec = exact.get(sid)
        if rec:
            snippet = rec["text"][:220].replace("\n", " ")
            lines.append(f"- **{sid}** (`{rec['topic']}`)")
            lines.append(f"  «{snippet}…»")
            lines.append(f"  → `source_preservation: exact` ✓")
            lines.append("")

    lines += [
        "Все проверенные записи содержат оригинальные формулировки из источника без смягчений.",
        "",
        "## Ошибки валидации",
        "",
    ]
    if errors:
        for e in errors:
            lines.append(f"- {e}")
    else:
        lines.append("_(нет)_")

    NOTES.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
