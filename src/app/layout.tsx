import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DiputadoScore — Transparencia política en Costa Rica",
  description:
    "Calificaciones de diputados costarricenses basadas en datos públicos reales. Asistencia, proyectos, gasto y más — en una sola tarjeta.",
  keywords: ["diputados", "Costa Rica", "transparencia", "política", "Asamblea Legislativa"],
  openGraph: {
    title: "DiputadoScore",
    description: "¿Cuánto trabaja tu diputado? Datos públicos reales, score 1–10.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-white">{children}</body>
    </html>
  );
}
