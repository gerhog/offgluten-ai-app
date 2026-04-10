"use client";

import { useRef, useState } from "react";

function getOrCreateSessionId(): string {
  let id = localStorage.getItem("chat_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("chat_session_id", id);
  }
  return id;
}

type SystemSubtype =
  | "non_domain"
  | "weak_retrieval_medical"
  | "temporary_error"
  | "unauthenticated";

type MessageEntry =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "system"; subtype: SystemSubtype; text: string }
  | { role: "trial_exhausted" };

const SYSTEM_LABELS: Record<SystemSubtype, string> = {
  non_domain: "Вне специализации",
  weak_retrieval_medical: "Медицинский вопрос",
  temporary_error: "Сервис недоступен",
  unauthenticated: "Сессия истекла",
};

const SYSTEM_LABEL_COLORS: Record<SystemSubtype, string> = {
  non_domain: "#6b7280",
  weak_retrieval_medical: "#b45309",
  temporary_error: "#dc2626",
  unauthenticated: "#6b7280",
};

const EXAMPLE_QUESTIONS = [
  "Что такое целиакия?",
  "Можно ли есть овёс?",
  "Какие продукты содержат скрытый глютен?",
];

function SystemCard({ subtype, text }: { subtype: SystemSubtype; text: string }) {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "80%",
        padding: "14px 18px",
        borderRadius: 12,
        border: "1px solid #e8e8e8",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: SYSTEM_LABEL_COLORS[subtype],
        }}
      >
        {SYSTEM_LABELS[subtype]}
      </div>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.55 }}>{text}</div>
      {subtype === "unauthenticated" && (
        <a
          href="/login"
          style={{
            marginTop: 4,
            display: "inline-block",
            padding: "7px 14px",
            borderRadius: 8,
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            alignSelf: "flex-start",
          }}
        >
          Войти снова
        </a>
      )}
    </div>
  );
}

function TrialExhaustedCard() {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "80%",
        padding: "16px 20px",
        borderRadius: 12,
        border: "1px solid #e0e0e0",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>
        Пробный период закончился
      </div>
      <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>
        Вы использовали 3 пробных сообщения. Оформите доступ, чтобы продолжить.
      </div>
      <a
        href="/upgrade"
        style={{
          display: "inline-block",
          marginTop: 2,
          padding: "8px 16px",
          borderRadius: 8,
          background: "#1a1a1a",
          color: "#fff",
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
          alignSelf: "flex-start",
        }}
      >
        Получить доступ
      </a>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExhausted = messages.some((m) => m.role === "trial_exhausted");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || isExhausted) return;
    sendMessage(text);
  }

  function pushSystem(subtype: SystemSubtype, text: string) {
    setMessages((prev) => [...prev, { role: "system", subtype, text }]);
  }

  async function sendMessage(text: string) {
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    const sessionId = getOrCreateSessionId();

    // Collect recent conversational turns for memory extraction context.
    // Uses messages from closure (state before current message) — current message
    // is already in the `message` field. System and trial_exhausted entries are excluded.
    const recentTurns = messages
      .filter(
        (m): m is { role: "user" | "assistant"; text: string } =>
          (m.role === "user" || m.role === "assistant") && "text" in m
      )
      .slice(-5) // up to ~2-3 exchanges
      .map((m) => ({ role: m.role, text: m.text.slice(0, 500) }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId, recent_turns: recentTurns }),
      });

      const data = await res.json();

      if (data.status === "answered") {
        const reply = data.answer || data.message || "";
        setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      } else if (data.status === "limited" && data.reason === "non_domain") {
        pushSystem(
          "non_domain",
          "Я специализируюсь на вопросах о целиакии и безглютеновом питании. Пожалуйста, задайте вопрос по этой теме."
        );
      } else if (data.status === "limited" && data.reason === "weak_retrieval_medical") {
        pushSystem(
          "weak_retrieval_medical",
          "Это медицинский вопрос, требующий точных данных. В базе знаний недостаточно информации для надёжного ответа. Пожалуйста, проконсультируйтесь с врачом."
        );
      } else if (data.status === "limited") {
        const reply = data.answer || data.message || "Ответ ограничен.";
        setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      } else if (data.status === "trial_exhausted") {
        setMessages((prev) => [...prev, { role: "trial_exhausted" }]);
      } else if (data.status === "temporary_error") {
        pushSystem(
          "temporary_error",
          "Сервис временно недоступен. Пожалуйста, попробуйте через несколько секунд."
        );
      } else if (data.status === "unauthenticated") {
        pushSystem("unauthenticated", "Сессия истекла. Войдите снова, чтобы продолжить.");
      } else {
        pushSystem("temporary_error", "Что-то пошло не так. Попробуйте ещё раз.");
      }
    } catch {
      pushSystem("temporary_error", "Ошибка соединения. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
      if (!isExhausted) inputRef.current?.focus();
    }
  }

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "40px 24px",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Offgluten AI</h1>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
              Задайте вопрос о целиакии или безглютеновом питании.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                  style={{
                    alignSelf: "flex-start",
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #e0e0e0",
                    background: "#fafafa",
                    color: "#374151",
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "trial_exhausted") {
            return <TrialExhaustedCard key={i} />;
          }
          if (msg.role === "system") {
            return <SystemCard key={i} subtype={msg.subtype} text={msg.text} />;
          }
          return (
            <div
              key={i}
              style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                padding: "10px 14px",
                borderRadius: 12,
                fontSize: 14,
                lineHeight: 1.6,
                background: msg.role === "user" ? "#1a1a1a" : "#f0f0f0",
                color: msg.role === "user" ? "#fff" : "#1a1a1a",
              }}
            >
              {msg.text}
            </div>
          );
        })}

        {loading && (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "10px 14px",
              borderRadius: 12,
              background: "#f0f0f0",
              fontSize: 14,
              color: "#888",
            }}
          >
            ...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isExhausted ? "Пробный период закончился" : "Введите вопрос..."}
          disabled={loading || isExhausted}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 14,
            outline: "none",
            background: isExhausted ? "#f9f9f9" : "#fff",
            color: isExhausted ? "#aaa" : "#1a1a1a",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || isExhausted}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 14,
            cursor: loading || isExhausted ? "default" : "pointer",
            opacity: loading || !input.trim() || isExhausted ? 0.4 : 1,
          }}
        >
          Отправить
        </button>
      </form>
    </main>
  );
}
