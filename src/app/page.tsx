import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        Offgluten AI
      </h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Your AI-powered gluten-free assistant. Early access — coming soon.
      </p>
      <nav style={{ display: "flex", gap: 16 }}>
        <Link href="/login" style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6 }}>
          Login
        </Link>
        <Link href="/app" style={{ padding: "8px 16px", background: "#111", color: "#fff", borderRadius: 6 }}>
          Open App
        </Link>
      </nav>
    </main>
  );
}
