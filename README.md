# Offgluten AI App

AI-powered gluten-free assistant. Early-stage skeleton, ready for Vercel deployment.

## Stack

- Next.js 15 (App Router)
- TypeScript
- ESLint
- Supabase (client + server)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Path | Description |
|------|-------------|
| `/` | Home page |
| `/login` | Login (placeholder) |
| `/app` | Main app (placeholder) |
| `/chat` | AI chat (placeholder) |

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Add these same variables in Vercel project settings.

## Routes

| Path | Description |
|------|-------------|
| `/debug` | Supabase connection check (remove before prod) |

## Deploy

Push to GitHub and import into [Vercel](https://vercel.com). Set env vars in Vercel project settings.
