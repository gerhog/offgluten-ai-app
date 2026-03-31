"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function mapAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) return "Неверный email или пароль";
  if (message.includes("Email not confirmed")) return "Сначала подтвердите email — проверьте почту";
  if (message.includes("User already registered")) return "Этот email уже зарегистрирован. Попробуйте войти";
  if (message.includes("Password should be at least")) return "Пароль должен быть не менее 6 символов";
  if (message.includes("Unable to validate email address")) return "Некорректный email";
  if (message.includes("signup is disabled")) return "Регистрация временно недоступна";
  if (message.includes("rate limit")) return "Слишком много попыток. Подождите немного";
  if (message.includes("weak password")) return "Пароль слишком простой";
  return "Что-то пошло не так. Попробуйте ещё раз";
}

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(mapAuthError(error.message))}`);
  }

  redirect("/app");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(mapAuthError(error.message))}`);
  }

  // user exists, session is null = email confirmation sent successfully
  if (data.user && !data.session) {
    redirect("/login?status=confirm");
  }

  // edge case: already confirmed account (identities empty = duplicate email, Supabase hides it)
  redirect("/login?status=confirm");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
