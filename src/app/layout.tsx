import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/shell";

export const metadata: Metadata = {
  title: {
    default: "OerVoer · Picklist-wizard",
    template: "%s · OerVoer",
  },
  description:
    "Stel picklijsten samen uit de voorraad, order voor order. Rauw voer voor honden en katten.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <Sidebar />
        <div className="lg:pl-[15.5rem]">
          <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-8 lg:py-11">{children}</main>
        </div>
      </body>
    </html>
  );
}
