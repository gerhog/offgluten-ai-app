export default function UpgradePage() {
  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px" }}>
      <a
        href="/chat"
        style={{
          fontSize: 13,
          color: "#888",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: 32,
        }}
      >
        ← Вернуться к чату
      </a>

      <div
        style={{
          border: "1px solid #e0e0e0",
          borderRadius: 16,
          padding: "32px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: 20,
              background: "#f3f4f6",
              color: "#6b7280",
              fontSize: 12,
              fontWeight: 500,
              marginBottom: 14,
            }}
          >
            Пробный период завершён
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
            Оформите подписку
          </h1>
          <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, margin: "10px 0 0" }}>
            Получите полный доступ к персональному ИИ-ассистенту по целиакии и безглютеновому
            питанию.
          </p>
        </div>

        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[
            "Неограниченные вопросы ИИ-ассистенту",
            "Ответы на основе проверенной базы знаний",
            "Учёт вашего рациона и медицинского контекста",
          ].map((item) => (
            <li key={item} style={{ fontSize: 14, color: "#374151", display: "flex", gap: 8 }}>
              <span style={{ color: "#1a1a1a", fontWeight: 600 }}>—</span>
              {item}
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            disabled
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 10,
              border: "none",
              background: "#1a1a1a",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              opacity: 0.4,
              cursor: "not-allowed",
            }}
          >
            Оформить подписку
          </button>
          <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
            Онлайн-оплата скоро станет доступна
          </p>
        </div>
      </div>
    </main>
  );
}
