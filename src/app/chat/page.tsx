"use client";

import { useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

/* ─────────────────────────────────────────────────────────
   Session helpers
───────────────────────────────────────────────────────── */
function getOrCreateSessionId(): string {
  let id = localStorage.getItem("chat_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("chat_session_id", id);
  }
  return id;
}

/* ─────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────── */
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

type AttachmentUIState = {
  localId: string;       // guards against stale upload results overwriting a newer selection
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "uploading" | "ready" | "error";
  attachmentId?: string;
  errorMsg?: string;
};

/* ─────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────── */
const SYSTEM_LABELS: Record<SystemSubtype, string> = {
  non_domain: "Вне специализации",
  weak_retrieval_medical: "Медицинский вопрос",
  temporary_error: "Сервис недоступен",
  unauthenticated: "Сессия истекла",
};

const SYSTEM_LABEL_COLORS: Record<SystemSubtype, string> = {
  non_domain: "#9a9590",
  weak_retrieval_medical: "#b45309",
  temporary_error: "#dc2626",
  unauthenticated: "#9a9590",
};

const PRESETS = [
  { icon: "🌾", iconBg: "#fde9c4", q: "Что такое целиакия?",                    hint: "Основы диагноза" },
  { icon: "🥣", iconBg: "#d4edda", q: "Можно ли есть овёс при целиакии?",       hint: "Безопасные продукты" },
  { icon: "🏷️", iconBg: "#d4e6f1", q: "Какие продукты содержат скрытый глютен?", hint: "Состав и маркировка" },
  { icon: "📋", iconBg: "#ede4f5", q: "Какие льготы доступны в России?",         hint: "Поддержка и права" },
];

const UPLOAD_ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf",
]);
const UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function getExtLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/webp": "WEBP",
  };
  return map[mimeType] ?? "FILE";
}

// Placeholder history — backend persistence is not yet implemented.
// Replace with real data when conversation storage is added.
const HISTORY_PLACEHOLDERS = [
  { id: "h1", title: "Можно ли есть овёс при целиакии?",       when: "Сегодня" },
  { id: "h2", title: "Какие продукты содержат скрытый глютен?", when: "Вчера" },
  { id: "h3", title: "Льготы и выплаты при целиакии в России",  when: "Вчера" },
  { id: "h4", title: "Сопутствующие заболевания",               when: "Пн" },
];

/* ─────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────── */
function AssistantMessage({ text }: { text: string }) {
  return (
    <div style={{ marginBottom: -8 }}>
      <ReactMarkdown
        components={{
          p:      ({ children }) => <p      style={{ margin: "0 0 8px", lineHeight: 1.65 }}>{children}</p>,
          ul:     ({ children }) => <ul     style={{ margin: "0 0 8px", paddingLeft: 20 }}>{children}</ul>,
          ol:     ({ children }) => <ol     style={{ margin: "0 0 8px", paddingLeft: 20 }}>{children}</ol>,
          li:     ({ children }) => <li     style={{ marginBottom: 3, lineHeight: 1.65 }}>{children}</li>,
          strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function SystemCard({ subtype, text }: { subtype: SystemSubtype; text: string }) {
  return (
    <div style={{
      alignSelf: "flex-start",
      maxWidth: "78%",
      padding: "14px 18px",
      borderRadius: 14,
      border: "1.5px solid #e5e0d8",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: SYSTEM_LABEL_COLORS[subtype],
      }}>
        {SYSTEM_LABELS[subtype]}
      </div>
      <div style={{ fontSize: 14, color: "#3d3a36", lineHeight: 1.6 }}>{text}</div>
      {subtype === "unauthenticated" && (
        <a href="/login" style={{
          marginTop: 4,
          display: "inline-block",
          padding: "7px 14px",
          borderRadius: 8,
          background: "#1c1a18",
          color: "#fff",
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
          alignSelf: "flex-start",
        }}>
          Войти снова
        </a>
      )}
    </div>
  );
}

function TrialExhaustedCard() {
  return (
    <div style={{
      alignSelf: "flex-start",
      maxWidth: "78%",
      padding: "16px 20px",
      borderRadius: 14,
      border: "1.5px solid #e5e0d8",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#1c1a18" }}>
        Пробный период закончился
      </div>
      <div style={{ fontSize: 14, color: "#6b6762", lineHeight: 1.55 }}>
        Вы использовали 3 пробных сообщения. Оформите доступ, чтобы продолжить.
      </div>
      <a href="/upgrade" style={{
        display: "inline-block",
        marginTop: 2,
        padding: "8px 16px",
        borderRadius: 8,
        background: "#1c1a18",
        color: "#fff",
        fontSize: 13,
        fontWeight: 500,
        textDecoration: "none",
        alignSelf: "flex-start",
      }}>
        Получить доступ
      </a>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────── */
export default function ChatPage() {
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentUIState | null>(null);

  const inputRef       = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const isExhausted = messages.some((m) => m.role === "trial_exhausted");

  // Auto-scroll to bottom on new messages / loading change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || isExhausted || attachment?.status === "uploading") return;
    sendMessage(text);
  }

  function pushSystem(subtype: SystemSubtype, text: string) {
    setMessages((prev) => [...prev, { role: "system", subtype, text }]);
  }

  function handleNewChat() {
    setMessages([]);
    setInput("");
    setAttachment(null);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function sendMessage(text: string) {
    // Capture attachment state now; only include if ready.
    const attachmentToSend = attachment?.status === "ready" ? attachment : null;
    setInput("");
    setSidebarOpen(false);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    const sessionId = getOrCreateSessionId();

    const recentTurns = messages
      .filter(
        (m): m is { role: "user" | "assistant"; text: string } =>
          (m.role === "user" || m.role === "assistant") && "text" in m
      )
      .slice(-5)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 500) }));

    const body: Record<string, unknown> = {
      message: text,
      session_id: sessionId,
      recent_turns: recentTurns,
    };
    if (attachmentToSend?.attachmentId) {
      body.attachment_id = attachmentToSend.attachmentId;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      // Clear attachment only on outcomes where the message was fully accepted and processed.
      // Preserve on temporary_error, attachment_*, unknown failures, and network errors (catch
      // below) — user should be able to retry without re-selecting the file.
      // unauthenticated: cleared — session is dead; re-login starts a fresh session anyway.
      if ((["answered", "limited", "trial_exhausted", "unauthenticated"] as string[]).includes(data.status as string)) {
        setAttachment(null);
      }

      if (data.status === "answered") {
        setMessages((prev) => [...prev, { role: "assistant", text: data.answer || data.message || "" }]);
      } else if (data.status === "limited" && data.reason === "non_domain") {
        pushSystem("non_domain", "Я специализируюсь на вопросах о целиакии и безглютеновом питании. Пожалуйста, задайте вопрос по этой теме.");
      } else if (data.status === "limited" && data.reason === "weak_retrieval_medical") {
        pushSystem("weak_retrieval_medical", "Это медицинский вопрос, требующий точных данных. В базе знаний недостаточно информации для надёжного ответа. Пожалуйста, проконсультируйтесь с врачом.");
      } else if (data.status === "limited") {
        setMessages((prev) => [...prev, { role: "assistant", text: data.answer || data.message || "Ответ ограничен." }]);
      } else if (data.status === "trial_exhausted") {
        setMessages((prev) => [...prev, { role: "trial_exhausted" }]);
      } else if (data.status === "temporary_error") {
        pushSystem("temporary_error", "Сервис временно недоступен. Пожалуйста, попробуйте через несколько секунд.");
      } else if (data.status === "unauthenticated") {
        pushSystem("unauthenticated", "Сессия истекла. Войдите снова, чтобы продолжить.");
      } else if (typeof data.status === "string" && data.status.startsWith("attachment_")) {
        pushSystem("temporary_error", "Не удалось прикрепить файл. Попробуйте загрузить снова.");
      } else {
        pushSystem("temporary_error", "Что-то пошло не так. Попробуйте ещё раз.");
      }
    } catch {
      // Keep attachment state on network error — request may not have reached server.
      pushSystem("temporary_error", "Ошибка соединения. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
      if (!isExhausted) inputRef.current?.focus();
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    if (!UPLOAD_ALLOWED_TYPES.has(file.type)) {
      setAttachment({
        localId: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        status: "error",
        errorMsg: "Формат не поддерживается. Разрешены: JPG, PNG, WEBP, PDF.",
      });
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      setAttachment({
        localId: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        status: "error",
        errorMsg: "Файл слишком большой. Максимум 5 МБ.",
      });
      return;
    }

    const localId = crypto.randomUUID();
    setAttachment({ localId, fileName: file.name, mimeType: file.type, sizeBytes: file.size, status: "uploading" });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/attachments/upload", { method: "POST", body: formData });
      const data = await res.json();

      setAttachment((prev) => {
        if (!prev || prev.localId !== localId) return prev; // newer selection replaced this one
        if (res.ok && data.attachment?.id) {
          return { ...prev, status: "ready", attachmentId: data.attachment.id };
        }
        return { ...prev, status: "error", errorMsg: data.message ?? "Ошибка загрузки. Попробуйте ещё раз." };
      });
    } catch {
      setAttachment((prev) => {
        if (!prev || prev.localId !== localId) return prev;
        return { ...prev, status: "error", errorMsg: "Ошибка соединения. Попробуйте ещё раз." };
      });
    }
  }

  /* ── Render ─────────────────────────────────────────── */
  return (
    <>
      <style>{`
        .chat-root {
          display: flex;
          height: 100vh;
          background: #faf9f7;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
        }

        /* ── Sidebar ───────────────────────────────────── */
        .chat-sidebar {
          width: 260px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: #f2ede8;
          border-right: 1.5px solid #e5e0d8;
          height: 100vh;
          overflow: hidden;
        }
        .sidebar-top {
          padding: 20px 16px 12px;
          border-bottom: 1.5px solid #e5e0d8;
          flex-shrink: 0;
        }
        .sidebar-logo {
          margin-bottom: 14px;
        }
        .sidebar-new-btn {
          width: 100%;
          padding: 9px 14px;
          background: #1c1a18;
          color: #fff;
          border: none;
          border-radius: 9px;
          font-size: 13.5px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          letter-spacing: 0.01em;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.15s;
        }
        .sidebar-new-btn:hover { background: #2e2b27; }

        .sidebar-history {
          flex: 1;
          overflow-y: auto;
          padding: 12px 10px;
        }
        .history-label {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #b0ada8;
          padding: 0 6px;
          margin-bottom: 6px;
        }
        .history-item {
          padding: 9px 10px;
          border-radius: 8px;
          cursor: default;
          margin-bottom: 2px;
          transition: background 0.12s;
        }
        .history-item:hover { background: #e8e2db; }
        .history-item-title {
          font-size: 13px;
          color: #3d3a36;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .history-item-when {
          font-size: 11px;
          color: #b0ada8;
          margin-top: 2px;
        }
        .history-coming-soon {
          margin: 12px 6px 0;
          padding: 9px 10px;
          background: #ede8e2;
          border-radius: 8px;
          font-size: 12px;
          color: #9a9590;
          line-height: 1.5;
        }

        /* ── Overlay (mobile) ──────────────────────────── */
        .chat-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(28,26,24,0.35);
          z-index: 40;
        }

        /* ── Main area ─────────────────────────────────── */
        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          height: 100vh;
        }

        /* ── Header ────────────────────────────────────── */
        .chat-header {
          display: none;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-bottom: 1.5px solid #e5e0d8;
          background: #faf9f7;
          flex-shrink: 0;
        }
        .chat-hamburger {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex-shrink: 0;
        }
        .chat-hamburger span {
          display: block;
          width: 20px;
          height: 1.8px;
          background: #1c1a18;
          border-radius: 2px;
        }

        /* ── Messages ──────────────────────────────────── */
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .chat-messages-inner {
          flex: 1;
          padding: 40px 48px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ── Empty state ───────────────────────────────── */
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 0 0 48px;
        }
        .empty-logo {
          margin-bottom: 20px;
          opacity: 0.85;
        }
        .empty-heading {
          font-size: 22px;
          font-weight: 700;
          color: #1c1a18;
          letter-spacing: -0.02em;
          margin: 0 0 8px;
        }
        .empty-sub {
          font-size: 15px;
          color: #9a9590;
          margin: 0 0 36px;
          line-height: 1.5;
        }
        .presets-scroll {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x;
          overscroll-behavior-x: contain;
          scrollbar-width: none;
          padding-bottom: 4px;
        }
        .presets-scroll::-webkit-scrollbar { display: none; }
        .presets-grid {
          display: inline-flex;
          flex-direction: row;
          gap: 12px;
          justify-content: center;
          min-width: 100%;
        }
        .preset-card {
          flex-shrink: 0;
          width: 156px;
          padding: 18px 14px 16px;
          background: #fff;
          border: none;
          border-radius: 14px;
          text-align: center;
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.1s;
          font-family: inherit;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 11px;
          box-shadow: 0 1px 4px rgba(28,26,24,0.06);
        }
        .preset-card:hover {
          box-shadow: 0 4px 14px rgba(28,26,24,0.1);
          transform: translateY(-2px);
        }
        .preset-card:active { transform: translateY(0); box-shadow: 0 1px 4px rgba(28,26,24,0.06); }
        .preset-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }
        .preset-q {
          font-size: 14px;
          font-weight: 700;
          color: #111;
          line-height: 1.4;
        }
        .preset-hint {
          font-size: 12px;
          color: #9a9590;
          line-height: 1.3;
        }

        /* ── Message bubbles ───────────────────────────── */
        .bubble-user {
          align-self: flex-end;
          max-width: 78%;
          padding: 11px 16px;
          border-radius: 16px 16px 4px 16px;
          background: #1c1a18;
          color: #fff;
          font-size: 14.5px;
          line-height: 1.6;
        }
        .bubble-assistant {
          align-self: flex-start;
          max-width: 78%;
          padding: 14px 18px;
          border-radius: 4px 16px 16px 16px;
          background: #fff;
          border: 1.5px solid #e5e0d8;
          color: #1c1a18;
          font-size: 14.5px;
          line-height: 1.65;
        }

        /* ── Loading dots ──────────────────────────────── */
        .loading-dots {
          align-self: flex-start;
          padding: 14px 18px;
          border-radius: 4px 16px 16px 16px;
          background: #fff;
          border: 1.5px solid #e5e0d8;
          display: flex;
          gap: 5px;
          align-items: center;
        }
        .loading-dots span {
          display: block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #c8c3bb;
          animation: dot-bounce 1.2s ease-in-out infinite;
        }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }

        /* ── Input area ────────────────────────────────── */
        .chat-input-wrap {
          flex-shrink: 0;
          padding: 16px 48px 28px;
          background: #faf9f7;
          border-top: 1.5px solid #e5e0d8;
        }
        .chat-input-inner {
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }
        .chat-input {
          flex: 1;
          padding: 12px 16px;
          border: 1.5px solid #e0dbd4;
          border-radius: 12px;
          font-size: 15px;
          font-family: inherit;
          background: #fff;
          color: #1c1a18;
          outline: none;
          resize: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          -webkit-appearance: none;
          line-height: 1.5;
        }
        .chat-input:focus {
          border-color: #1c1a18;
          box-shadow: 0 0 0 3px rgba(28,26,24,0.06);
        }
        .chat-input::placeholder { color: #c0bbb5; }
        .chat-input:disabled { background: #f5f2ee; color: #b0ada8; cursor: not-allowed; }
        .chat-send-btn {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 11px;
          border: none;
          background: #1c1a18;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, opacity 0.15s;
        }
        .chat-send-btn:hover:not(:disabled) { background: #2e2b27; }
        .chat-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        /* ── Responsive ────────────────────────────────── */
        @media (max-width: 1023px) {
          .chat-sidebar {
            position: fixed;
            left: 0; top: 0;
            z-index: 50;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            box-shadow: 4px 0 24px rgba(28,26,24,0.1);
          }
          .chat-sidebar.is-open {
            transform: translateX(0);
          }
          .chat-overlay.is-open { display: block; }
          .chat-header { display: flex; }
        }

        @media (max-width: 639px) {
          .chat-messages-inner { padding: 24px 20px; }
          .chat-input-wrap { padding: 12px 20px 20px; }
          .bubble-user, .bubble-assistant { max-width: 90%; }
          .empty-heading { font-size: 19px; }
          .presets-grid { justify-content: flex-start; }
        }

        /* ── Attachment chip ───────────────────────────── */
        .attach-chip-wrap { margin-bottom: 10px; }
        .attach-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          background: #fff;
          border: 1.5px solid #e5e0d8;
          border-radius: 10px;
        }
        .attach-ext {
          flex-shrink: 0;
          padding: 2px 7px;
          border-radius: 5px;
          background: #f2ede8;
          font-size: 10.5px;
          font-weight: 700;
          color: #6b6762;
          letter-spacing: 0.04em;
        }
        .attach-name {
          flex: 1;
          font-size: 13px;
          color: #3d3a36;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .attach-status {
          flex-shrink: 0;
          font-size: 12px;
          white-space: nowrap;
        }
        .attach-status-uploading { color: #9a9590; }
        .attach-status-ready     { color: #16a34a; }
        .attach-status-error     { color: #dc2626; }
        .attach-error-msg {
          margin-top: 5px;
          font-size: 12px;
          color: #dc2626;
        }
        .attach-remove {
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          border-radius: 5px;
          border: none;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #b0ada8;
          font-size: 17px;
          line-height: 1;
          padding: 0;
          transition: background 0.12s, color 0.12s;
        }
        .attach-remove:hover:not(:disabled) { background: #f2ede8; color: #1c1a18; }
        .attach-remove:disabled { opacity: 0.35; cursor: not-allowed; }
        .attach-hint {
          margin-top: 7px;
          font-size: 11.5px;
          color: #b0ada8;
          line-height: 1.5;
        }

        /* ── Paperclip button ─────────────────────────── */
        .attach-btn {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 11px;
          border: 1.5px solid #e0dbd4;
          background: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9a9590;
          transition: border-color 0.15s, background 0.15s, color 0.15s;
        }
        .attach-btn:hover:not(:disabled) { border-color: #1c1a18; background: #f5f2ee; color: #1c1a18; }
        .attach-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .attach-btn.active { border-color: #1c1a18; color: #1c1a18; }
      `}</style>

      <div className="chat-root">

        {/* ── Sidebar ──────────────────────────────────── */}
        <aside className={`chat-sidebar${sidebarOpen ? " is-open" : ""}`}>
          <div className="sidebar-top">
            <div className="sidebar-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/LOGO.png" alt="Offgluten AI" style={{ height: 22 }} />
            </div>
            <button className="sidebar-new-btn" onClick={handleNewChat}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <line x1="7" y1="1" x2="7" y2="13" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="1" y1="7" x2="13" y2="7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Новый чат
            </button>
          </div>

          <div className="sidebar-history">
            <div className="history-label">История</div>
            {HISTORY_PLACEHOLDERS.map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-item-title">{item.title}</div>
                <div className="history-item-when">{item.when}</div>
              </div>
            ))}
            <div className="history-coming-soon">
              Сохранение истории появится в следующем обновлении
            </div>
          </div>
        </aside>

        {/* ── Mobile overlay ───────────────────────────── */}
        <div
          className={`chat-overlay${sidebarOpen ? " is-open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* ── Main area ────────────────────────────────── */}
        <div className="chat-main">

          {/* Mobile header */}
          <header className="chat-header">
            <button className="chat-hamburger" onClick={() => setSidebarOpen((v) => !v)} aria-label="Меню">
              <span /><span /><span />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/LOGO.png" alt="Offgluten AI" style={{ height: 20 }} />
          </header>

          {/* Messages */}
          <div className="chat-messages">
            <div className="chat-messages-inner">

              {/* Empty state */}
              {messages.length === 0 && (
                <div className="empty-state">
                  <div className="empty-logo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/assistant%20icon.png" alt="" style={{ width: 120, height: 120 }} />
                  </div>
                  <h1 className="empty-heading">Чем могу помочь?</h1>
                  <p className="empty-sub">Задайте вопрос о целиакии или безглютеновом питании</p>
                  <div className="presets-scroll">
                    <div className="presets-grid">
                      {PRESETS.map(({ icon, iconBg, q, hint }) => (
                        <button
                          key={q}
                          className="preset-card"
                          onClick={() => { setInput(q); inputRef.current?.focus(); }}
                        >
                          <div className="preset-icon-wrap" style={{ background: iconBg }}>{icon}</div>
                          <div className="preset-q">{q}</div>
                          <div className="preset-hint">{hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Message list */}
              {messages.map((msg, i) => {
                if (msg.role === "trial_exhausted") return <TrialExhaustedCard key={i} />;
                if (msg.role === "system") return <SystemCard key={i} subtype={msg.subtype} text={msg.text} />;
                if (msg.role === "user") {
                  return <div key={i} className="bubble-user">{msg.text}</div>;
                }
                return (
                  <div key={i} className="bubble-assistant">
                    <AssistantMessage text={msg.text} />
                  </div>
                );
              })}

              {/* Loading */}
              {loading && (
                <div className="loading-dots">
                  <span /><span /><span />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="chat-input-wrap">

            {/* Attachment chip — shown while file is selected/uploading/ready/error */}
            {attachment && (
              <div className="attach-chip-wrap">
                <div className="attach-chip">
                  <span className="attach-ext">{getExtLabel(attachment.mimeType)}</span>
                  <span className="attach-name" title={attachment.fileName}>{attachment.fileName}</span>
                  <span className={`attach-status attach-status-${attachment.status}`}>
                    {attachment.status === "uploading" && "Загружается..."}
                    {attachment.status === "ready"     && "✓ Готово"}
                    {attachment.status === "error"     && "Ошибка"}
                  </span>
                  <button
                    type="button"
                    className="attach-remove"
                    onClick={() => setAttachment(null)}
                    disabled={loading}
                    aria-label="Удалить вложение"
                  >
                    ×
                  </button>
                </div>
                {attachment.status === "error" && attachment.errorMsg && (
                  <div className="attach-error-msg">{attachment.errorMsg}</div>
                )}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />

            <form className="chat-input-inner" onSubmit={handleSubmit}>
              {/* Paperclip button */}
              <button
                type="button"
                className={`attach-btn${attachment && attachment.status !== "error" ? " active" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || isExhausted}
                aria-label="Прикрепить файл"
                title="Прикрепить файл"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M15.5 8.5L8.2 15.8C6.6 17.4 4 17.4 2.4 15.8C0.8 14.2 0.8 11.6 2.4 10L9.7 2.7C10.7 1.7 12.3 1.7 13.3 2.7C14.3 3.7 14.3 5.3 13.3 6.3L6.4 13.2C6 13.6 5.3 13.6 4.9 13.2C4.5 12.8 4.5 12.1 4.9 11.7L10.8 5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <input
                ref={inputRef}
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isExhausted ? "Пробный период закончился" : "Спросите о целиакии или питании..."}
                disabled={loading || isExhausted}
                autoComplete="off"
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={loading || !input.trim() || isExhausted || attachment?.status === "uploading"}
                aria-label="Отправить"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M2 9L16 9M16 9L10 3M16 9L10 15" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </form>

            <div className="attach-hint">
              Можно прикрепить анализ, исследование или заключение врача · JPG, PNG, WEBP, PDF · до 5 МБ
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
