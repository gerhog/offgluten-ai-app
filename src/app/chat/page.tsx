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

type MessageEntry = {
  role: "user" | "assistant" | "error";
  text: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    sendMessage(text);
  }

  async function sendMessage(text: string) {
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    const sessionId = getOrCreateSessionId();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      const data = await res.json();

      if (data.status === "answered") {
        const reply = data.answer || data.message || "";
        setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      } else if (data.status === "limited" && data.reason === "non_domain") {
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            text: "Я специализируюсь на вопросах о целиакии и безглютеновом питании. Пожалуйста, задайте вопрос по этой теме.",
          },
        ]);
      } else if (data.status === "limited" && data.reason === "weak_retrieval_medical") {
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            text: "Это медицинский вопрос, требующий точных данных. В базе знаний недостаточно информации для надёжного ответа. Пожалуйста, проконсультируйтесь с врачом.",
          },
        ]);
      } else if (data.status === "limited") {
        const reply = data.answer || data.message || "Ответ ограничен.";
        setMessages((prev) => [...prev, { role: "error", text: reply }]);
      } else if (data.status === "trial_exhausted") {
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            text: "Вы использовали все пробные сообщения. Оформите подписку для продолжения.",
          },
        ]);
      } else if (data.status === "temporary_error") {
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            text: "Сервис временно недоступен. Попробуйте через несколько секунд.",
          },
        ]);
      } else if (data.status === "unauthenticated") {
        setMessages((prev) => [
          ...prev,
          { role: "error", text: "Сессия истекла. Пожалуйста, войдите снова." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "error", text: "Что-то пошло не так. Попробуйте ещё раз." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: "Ошибка соединения. Попробуйте ещё раз." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
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
          <p style={{ color: "#888", fontSize: 14 }}>
            Задайте вопрос о целиакии или безглютеновом питании.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 14,
              lineHeight: 1.6,
              background:
                msg.role === "user"
                  ? "#1a1a1a"
                  : msg.role === "error"
                  ? "#fff3cd"
                  : "#f0f0f0",
              color:
                msg.role === "user"
                  ? "#fff"
                  : msg.role === "error"
                  ? "#856404"
                  : "#1a1a1a",
            }}
          >
            {msg.text}
          </div>
        ))}
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
          placeholder="Введите вопрос..."
          disabled={loading}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 14,
            cursor: loading ? "wait" : "pointer",
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          Отправить
        </button>
      </form>
    </main>
  );
}
