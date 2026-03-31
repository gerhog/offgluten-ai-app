import { signIn, signUp } from "./actions";

type Props = {
  searchParams: Promise<{ error?: string; status?: string }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  confirm: "Письмо отправлено. Проверьте почту и перейдите по ссылке для подтверждения.",
  confirmed: "Email подтверждён. Теперь можно войти.",
};

export default async function LoginPage({ searchParams }: Props) {
  const { error, status } = await searchParams;
  const statusMessage = status ? STATUS_MESSAGES[status] : null;

  const field: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "8px 10px",
    marginBottom: 12,
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
  };

  const btn: React.CSSProperties = {
    width: "100%",
    padding: "10px 16px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  };

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Offgluten AI</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 28 }}>Войдите или создайте аккаунт</p>

      {error && (
        <p style={{
          color: "#c0392b",
          fontSize: 13,
          marginBottom: 16,
          padding: "10px 12px",
          background: "#fff5f5",
          borderRadius: 6,
          border: "1px solid #fcc",
        }}>
          {decodeURIComponent(error)}
        </p>
      )}

      {statusMessage && (
        <p style={{
          color: "#1a6b3a",
          fontSize: 13,
          marginBottom: 16,
          padding: "10px 12px",
          background: "#f0fff6",
          borderRadius: 6,
          border: "1px solid #b2dfcc",
        }}>
          {statusMessage}
        </p>
      )}

      {!statusMessage && (
        <>
          <section style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, color: "#aaa", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Войти</p>
            <form action={signIn}>
              <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 4 }}>Email</label>
              <input name="email" type="email" required placeholder="вы@example.com" style={field} />
              <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 4 }}>Пароль</label>
              <input name="password" type="password" required placeholder="••••••••" style={{ ...field, marginBottom: 16 }} />
              <button type="submit" style={{ ...btn, background: "#111", color: "#fff" }}>
                Войти
              </button>
            </form>
          </section>

          <div style={{ borderTop: "1px solid #f0f0f0", margin: "24px 0" }} />

          <section>
            <p style={{ fontSize: 12, color: "#aaa", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Создать аккаунт</p>
            <form action={signUp}>
              <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 4 }}>Email</label>
              <input name="email" type="email" required placeholder="вы@example.com" style={field} />
              <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 4 }}>Пароль</label>
              <input name="password" type="password" required placeholder="минимум 6 символов" style={{ ...field, marginBottom: 16 }} />
              <button type="submit" style={{ ...btn, background: "#f5f5f5", color: "#111" }}>
                Зарегистрироваться
              </button>
            </form>
          </section>
        </>
      )}

      {statusMessage && (
        <a href="/login" style={{ display: "inline-block", marginTop: 16, fontSize: 13, color: "#555", textDecoration: "underline" }}>
          Вернуться ко входу
        </a>
      )}
    </main>
  );
}
