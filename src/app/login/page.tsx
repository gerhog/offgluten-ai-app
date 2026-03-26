import { signIn, signUp } from "./actions";

type Props = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { error, message } = await searchParams;

  const field: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "8px 10px",
    marginBottom: 12,
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 14,
  };

  const btn: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
  };

  return (
    <main style={{ maxWidth: 380, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Offgluten AI</h1>

      {error && (
        <p style={{ color: "red", fontSize: 13, marginBottom: 16 }}>{decodeURIComponent(error)}</p>
      )}
      {message && (
        <p style={{ color: "green", fontSize: 13, marginBottom: 16 }}>{message}</p>
      )}

      <form style={{ marginBottom: 32 }}>
        <label style={{ fontSize: 13, color: "#555" }}>Email</label>
        <input name="email" type="email" required style={field} />
        <label style={{ fontSize: 13, color: "#555" }}>Password</label>
        <input name="password" type="password" required style={field} />
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button formAction={signIn} style={{ ...btn, background: "#111", color: "#fff" }}>
            Log in
          </button>
          <button formAction={signUp} style={{ ...btn, background: "#f5f5f5", color: "#111" }}>
            Sign up
          </button>
        </div>
      </form>
    </main>
  );
}
