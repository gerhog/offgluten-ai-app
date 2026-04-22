// Placeholder — ready to be wired up to Supabase resetPasswordForEmail.
// When implementing: add a server action that calls
//   supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/auth/callback?next=/reset-password` })
// and an /auth/callback handler + /reset-password page with updateUser({ password }).

import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <>
      <style>{`
        .fp-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #faf9f7;
          padding: 40px 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
        }
        .fp-card {
          width: 100%;
          max-width: 400px;
        }
        .fp-logo {
          margin-bottom: 36px;
        }
        .fp-notice {
          padding: 12px 15px;
          background: #fff8ee;
          border: 1.5px solid #fde9b8;
          border-radius: 9px;
          color: #7a5c1e;
          font-size: 13.5px;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .fp-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #5c5854;
          margin-bottom: 6px;
          letter-spacing: 0.01em;
        }
        .fp-input {
          display: block;
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #e5e1db;
          border-radius: 9px;
          font-size: 15px;
          font-family: inherit;
          background: #f3f1ee;
          color: #aaa;
          outline: none;
          -webkit-appearance: none;
          cursor: not-allowed;
          margin-bottom: 16px;
        }
        .fp-btn {
          width: 100%;
          padding: 13px 20px;
          background: #e8e4df;
          color: #aaa;
          border: none;
          border-radius: 9px;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          cursor: not-allowed;
          letter-spacing: 0.01em;
        }
        .fp-back {
          display: inline-block;
          margin-top: 20px;
          font-size: 13.5px;
          color: #9a9590;
          text-decoration: underline;
          text-decoration-color: rgba(154, 149, 144, 0.4);
        }
        .fp-back:hover { color: #1c1a18; }

        @media (max-width: 639px) {
          .fp-root { background: #fff; align-items: flex-start; padding: 40px 20px 56px; }
        }
      `}</style>

      <div className="fp-root">
        <div className="fp-card">

          <div className="fp-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/LOGO.png" alt="Offgluten AI" style={{ height: 24 }} />
          </div>

          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1c1a18",
            letterSpacing: "-0.025em",
            lineHeight: 1.2,
            margin: "0 0 6px",
          }}>
            Восстановление пароля
          </h1>
          <p style={{
            fontSize: 14.5,
            color: "#9a9590",
            margin: "0 0 28px",
            lineHeight: 1.5,
          }}>
            Введите почту, указанную при регистрации
          </p>

          <div className="fp-notice">
            Восстановление пароля по email появится в ближайшее время.
            Если вам нужна помощь со входом — напишите нам напрямую.
          </div>

          <label className="fp-label" htmlFor="fp-email">Почта</label>
          <input
            id="fp-email"
            className="fp-input"
            type="email"
            placeholder="you@example.com"
            disabled
            aria-disabled="true"
          />

          <button className="fp-btn" disabled aria-disabled="true">
            Отправить инструкцию
          </button>

          <br />
          <Link href="/login" className="fp-back">
            ← Вернуться ко входу
          </Link>

        </div>
      </div>
    </>
  );
}
