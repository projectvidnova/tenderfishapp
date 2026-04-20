import type { Metadata } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "Tenderfish",
  description: "AI-powered project management for German architectural projects",
  icons: {
    icon: "/tenderfish-icon.svg",
    shortcut: "/tenderfish-icon.svg",
    apple: "/tenderfish-icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
