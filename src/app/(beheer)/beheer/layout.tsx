import { Sidebar } from "@/components/shell";

export const metadata = {
  title: {
    default: "Beheer",
    template: "%s · Beheer · OerVoer",
  },
};

export default function BeheerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="lg:pl-[15.5rem]">
        <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-8 lg:py-11">{children}</main>
      </div>
    </>
  );
}
