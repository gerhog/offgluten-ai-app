import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 520, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        Offgluten AI
      </h1>
      <p style={{ color: "#555", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
        Персональный ИИ-помощник для безглютеновой жизни.
        Помогает с питанием, составом продуктов и ответами на вопросы — быстро и понятно.
      </p>
      <Link
        href="/login"
        style={{
          display: "inline-block",
          padding: "10px 24px",
          background: "#111",
          color: "#fff",
          borderRadius: 6,
          fontSize: 15,
          fontWeight: 500,
        }}
      >
        Войти
      </Link>
    </main>
  );
}
