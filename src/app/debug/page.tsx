import { createClient } from "@/lib/supabase/server";

export default async function DebugPage() {
  const supabase = await createClient();

  let status = "connected";
  let error: string | null = null;

  try {
    const { error: err } = await supabase.rpc("version");
    if (err) {
      error = err.message;
      status = "error";
    }
  } catch (e) {
    status = "unreachable";
    error = e instanceof Error ? e.message : "Unknown error";
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "not set";

  return (
    <main style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px", fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Supabase Debug</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          <tr>
            <td style={{ padding: "8px 0", color: "#555", width: 160 }}>URL</td>
            <td>{url}</td>
          </tr>
          <tr>
            <td style={{ padding: "8px 0", color: "#555" }}>Status</td>
            <td style={{ color: status === "connected" ? "green" : "red" }}>{status}</td>
          </tr>
          {error && (
            <tr>
              <td style={{ padding: "8px 0", color: "#555" }}>Error</td>
              <td style={{ color: "red" }}>{error}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p style={{ marginTop: 32, color: "#999", fontSize: 12 }}>
        Remove this page before production.
      </p>
    </main>
  );
}
