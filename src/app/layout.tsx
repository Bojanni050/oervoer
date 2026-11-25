import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OerVoer · Voedingsadvies op maat",
    template: "%s · OerVoer",
  },
  description:
    "Bereken in een paar stappen hoeveel rauw voer je hond of kat nodig heeft, en welke samenstelling bij je dier past.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
