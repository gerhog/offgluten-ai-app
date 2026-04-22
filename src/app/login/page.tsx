import { signIn, signUp } from "./actions";
import Link from "next/link";

type Props = {
  searchParams: Promise<{ error?: string; status?: string; mode?: string }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  confirm:
    "Письмо отправлено. Проверьте почту и перейдите по ссылке для подтверждения.",
  confirmed: "Почта подтверждена. Теперь можно войти.",
};

export default async function LoginPage({ searchParams }: Props) {
  const { error, status, mode } = await searchParams;
  const statusMessage = status ? STATUS_MESSAGES[status] : null;
  const isSignup = mode === "signup";

  return (
    <>
      <style>{`
        .auth-root {
          display: flex;
          min-height: 100vh;
        }

        /* ── Left panel ────────────────────── */
        .auth-left {
          flex: 0 0 44%;
          background: linear-gradient(155deg, #1e1c19 0%, #2a2620 55%, #181612 100%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 56px;
          position: relative;
          overflow: hidden;
        }
        .auth-left::before {
          content: '';
          position: absolute;
          right: -110px;
          top: -110px;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: rgba(250, 134, 105, 0.07);
          pointer-events: none;
        }
        .auth-left::after {
          content: '';
          position: absolute;
          left: -80px;
          bottom: -80px;
          width: 280px;
          height: 280px;
          border-radius: 50%;
          background: rgba(250, 134, 105, 0.05);
          pointer-events: none;
        }
        .auth-left-deco-mid {
          position: absolute;
          right: 60px;
          top: 45%;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: rgba(250, 134, 105, 0.04);
          pointer-events: none;
        }
        .auth-left-inner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }

        /* ── Right panel ───────────────────── */
        .auth-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #faf9f7;
          padding: 52px 24px;
        }
        .auth-right-inner {
          width: 100%;
          max-width: 400px;
        }

        /* ── Mobile brand header ───────────── */
        .auth-mobile-brand {
          display: none;
          flex-direction: column;
          align-items: center;
          margin-bottom: 40px;
        }

        /* ── Tab switcher ──────────────────── */
        .auth-tabs {
          display: flex;
          border-bottom: 1.5px solid #e8e4df;
          margin-bottom: 32px;
          gap: 28px;
        }
        .auth-tab {
          padding-bottom: 12px;
          font-size: 15px;
          margin-bottom: -1.5px;
          transition: color 0.15s;
          white-space: nowrap;
        }
        .auth-tab-on {
          color: #1c1a18;
          font-weight: 600;
          border-bottom: 2px solid #1c1a18;
        }
        .auth-tab-off {
          color: #b0ada8;
          font-weight: 400;
          border-bottom: 2px solid transparent;
        }
        .auth-tab-off:hover { color: #6b6762; }

        /* ── Form elements ─────────────────── */
        .auth-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #5c5854;
          margin-bottom: 6px;
          letter-spacing: 0.01em;
        }
        .auth-input {
          display: block;
          width: 100%;
          padding: 11px 14px;
          margin-bottom: 16px;
          border: 1.5px solid #e5e1db;
          border-radius: 9px;
          font-size: 15px;
          font-family: inherit;
          background: #fff;
          color: #1c1a18;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          -webkit-appearance: none;
        }
        .auth-input:focus {
          border-color: #1c1a18;
          box-shadow: 0 0 0 3px rgba(28, 26, 24, 0.06);
        }
        .auth-input::placeholder { color: #c8c4bf; }
        .auth-input-last { margin-bottom: 6px; }

        .auth-btn {
          width: 100%;
          padding: 13px 20px;
          margin-top: 16px;
          background: #1c1a18;
          color: #fff;
          border: none;
          border-radius: 9px;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          letter-spacing: 0.01em;
          transition: background 0.15s, transform 0.1s;
        }
        .auth-btn:hover { background: #2e2b27; }
        .auth-btn:active { transform: scale(0.997); }

        /* ── Banners ───────────────────────── */
        .auth-error {
          padding: 11px 14px;
          background: #fff5f5;
          border: 1.5px solid #f5c6c6;
          border-radius: 9px;
          color: #b83232;
          font-size: 13.5px;
          line-height: 1.55;
          margin-bottom: 20px;
        }
        .auth-success {
          padding: 11px 14px;
          background: #f0fff6;
          border: 1.5px solid #aedbc5;
          border-radius: 9px;
          color: #1a6b3a;
          font-size: 13.5px;
          line-height: 1.55;
          margin-bottom: 8px;
        }
        .auth-back {
          display: inline-block;
          margin-top: 16px;
          font-size: 13.5px;
          color: #7a7570;
          text-decoration: underline;
          text-decoration-color: rgba(122, 117, 112, 0.35);
        }
        .auth-back:hover { color: #1c1a18; }

        /* ── Responsive ────────────────────── */

        /* Tablet: left panel collapses to compact top strip */
        @media (max-width: 1023px) {
          .auth-root { flex-direction: column; }
          .auth-left {
            flex: none;
            padding: 24px 32px 20px;
            min-height: auto;
          }
          .auth-left .panel-center,
          .auth-left .panel-bottom {
            display: none;
          }
          .auth-left-deco-mid { display: none; }
          .auth-right { padding: 44px 24px; }
        }

        /* Mobile: hide left panel entirely, show inline brand mark */
        @media (max-width: 639px) {
          .auth-left { display: none; }
          .auth-mobile-brand { display: flex; }
          .auth-right {
            background: #fff;
            padding: 40px 20px 56px;
            align-items: flex-start;
          }
          .auth-right-inner { max-width: 100%; }
        }
      `}</style>

      <div className="auth-root">

        {/* ── Left visual panel ─────────────────────────────────── */}
        <div className="auth-left">
          <div className="auth-left-deco-mid" />
          <div className="auth-left-inner">

            {/* Brand mark */}
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <BrandMark size={34} />
              <span style={{ color: "#fff", fontWeight: 600, fontSize: 17, letterSpacing: "-0.01em" }}>
                Offgluten AI
              </span>
            </div>

            {/* Hero text */}
            <div className="panel-center">
              <h2 style={{
                color: "#fff",
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1.18,
                letterSpacing: "-0.03em",
                margin: "0 0 18px",
              }}>
                Умный помощник<br />для жизни<br />без глютена
              </h2>
              <p style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 15,
                lineHeight: 1.7,
                maxWidth: 272,
                margin: 0,
              }}>
                Ответы о целиакии, составе продуктов и безглютеновом питании — быстро и понятно.
              </p>
            </div>

            {/* Trust line */}
            <div className="panel-bottom" style={{
              borderLeft: "2px solid rgba(250, 134, 105, 0.35)",
              paddingLeft: 16,
            }}>
              <p style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: 13,
                lineHeight: 1.6,
                margin: 0,
              }}>
                На основе проверенных медицинских данных о целиакии
              </p>
            </div>

          </div>
        </div>

        {/* ── Right form panel ──────────────────────────────────── */}
        <div className="auth-right">
          <div className="auth-right-inner">

            {/* Mobile brand (visible only on mobile) */}
            <div className="auth-mobile-brand">
              <BrandMark size={44} radius={12} />
              <span style={{ marginTop: 12, color: "#1c1a18", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>
                Offgluten AI
              </span>
            </div>

            {/* Heading */}
            <h1 style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1c1a18",
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              margin: "0 0 6px",
            }}>
              {statusMessage
                ? "Проверьте почту"
                : isSignup
                ? "Создать аккаунт"
                : "Добро пожаловать"}
            </h1>
            <p style={{
              fontSize: 14.5,
              color: "#9a9590",
              margin: "0 0 28px",
              lineHeight: 1.5,
            }}>
              {statusMessage
                ? "Мы отправили вам письмо со ссылкой"
                : isSignup
                ? "Зарегистрируйтесь, чтобы начать"
                : "Войдите в свой аккаунт"}
            </p>

            {/* Tab switcher */}
            {!statusMessage && (
              <div className="auth-tabs">
                <Link href="/login" className={`auth-tab ${!isSignup ? "auth-tab-on" : "auth-tab-off"}`}>
                  Войти
                </Link>
                <Link href="/login?mode=signup" className={`auth-tab ${isSignup ? "auth-tab-on" : "auth-tab-off"}`}>
                  Регистрация
                </Link>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="auth-error">{decodeURIComponent(error)}</div>
            )}

            {/* Status banner */}
            {statusMessage && (
              <>
                <div className="auth-success">{statusMessage}</div>
                <Link href="/login" className="auth-back">
                  Вернуться ко входу
                </Link>
              </>
            )}

            {/* Login form */}
            {!statusMessage && !isSignup && (
              <form action={signIn}>
                <label className="auth-label" htmlFor="login-email">Почта</label>
                <input
                  id="login-email"
                  className="auth-input"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <label className="auth-label" htmlFor="login-password">Пароль</label>
                <input
                  id="login-password"
                  className="auth-input auth-input-last"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="submit" className="auth-btn">Войти</button>
              </form>
            )}

            {/* Signup form */}
            {!statusMessage && isSignup && (
              <form action={signUp}>
                <label className="auth-label" htmlFor="signup-email">Почта</label>
                <input
                  id="signup-email"
                  className="auth-input"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <label className="auth-label" htmlFor="signup-password">Пароль</label>
                <input
                  id="signup-password"
                  className="auth-input auth-input-last"
                  name="password"
                  type="password"
                  required
                  placeholder="минимум 6 символов"
                  autoComplete="new-password"
                />
                <button type="submit" className="auth-btn">Создать аккаунт</button>
              </form>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

/* ── Shared brand mark SVG component ─────────────────────────── */
function BrandMark({ size = 34, radius = 9 }: { size?: number; radius?: number }) {
  const s = Math.round(size * 0.52);
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: radius,
      background: "#fa8669",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}>
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Grain head */}
        <path
          d="M10 2C10 2 6 5.5 6 9C6 12 7.8 14 10 14C12.2 14 14 12 14 9C14 5.5 10 2 10 2Z"
          fill="white"
          fillOpacity="0.95"
        />
        {/* Stem */}
        <line x1="10" y1="14" x2="10" y2="18" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        {/* Side leaf hints */}
        <path d="M10 11C10 11 7.5 9.5 7 8" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.55" />
        <path d="M10 11C10 11 12.5 9.5 13 8" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.55" />
      </svg>
    </div>
  );
}
