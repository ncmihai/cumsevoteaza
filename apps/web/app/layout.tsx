import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "cumsevoteaza",
  description: "Romanian Parliament votes, bills, and parliamentary career history."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
