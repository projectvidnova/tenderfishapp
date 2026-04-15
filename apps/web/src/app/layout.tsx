import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenderfish",
  description: "AI-powered project management for German architectural projects",
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
