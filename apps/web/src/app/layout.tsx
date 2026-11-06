import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Telecalling CRM — Operations & Recording Audit Console",
  description: "Live SIM calling CRM with universal multi-OEM Android recording sync, telecaller performance tracking, and automated offline sync.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">{children}</body>
    </html>
  );
}

