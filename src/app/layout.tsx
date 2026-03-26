import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Offgluten AI",
  description: "AI-powered gluten-free assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
