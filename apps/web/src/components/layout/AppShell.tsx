import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <TopBar />
      <main className="ml-sidebar mt-topbar min-h-[calc(100vh-52px)] bg-bg-bg-bg-page p-8">
        <div className="max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}
