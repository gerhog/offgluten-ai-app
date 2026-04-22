import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { redirect } from "next/navigation";
import type { Profile } from "@/types/supabase";

export default async function AppPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  redirect("/chat");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, entitlement_status, created_at")
    .eq("id", user.id)
    .single<Profile>();

  const entitlement = profile?.entitlement_status ?? "trial";

  const badgeColors: Record<string, { background: string; color: string }> = {
    trial:   { background: "#f0f0f0", color: "#555" },
    paid:    { background: "#111",    color: "#fff" },
    beta:    { background: "#e8f0fe", color: "#1a56db" },
    blocked: { background: "#fde8e8", color: "#c81e1e" },
  };
  const { background, color } = badgeColors[entitlement] ?? badgeColors.trial;

  const badge: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background,
    color,
  };

  return (
    <main style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Offgluten AI</h1>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 32 }}>
        <tbody>
          <tr>
            <td style={{ padding: "8px 0", color: "#555", width: 180 }}>ID пользователя</td>
            <td style={{ fontFamily: "monospace", fontSize: 12 }}>{user.id}</td>
          </tr>
          <tr>
            <td style={{ padding: "8px 0", color: "#555" }}>Email</td>
            <td>{user.email}</td>
          </tr>
          <tr>
            <td style={{ padding: "8px 0", color: "#555" }}>Доступ</td>
            <td><span style={badge}>{entitlement}</span></td>
          </tr>
          <tr>
            <td style={{ padding: "8px 0", color: "#555" }}>Профиль</td>
            <td>{profile ? "загружен" : "не найден (нет строки в profiles)"}</td>
          </tr>
        </tbody>
      </table>

      <form action={signOut}>
        <button style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, cursor: "pointer", background: "#fff" }}>
          Выйти
        </button>
      </form>
    </main>
  );
}
