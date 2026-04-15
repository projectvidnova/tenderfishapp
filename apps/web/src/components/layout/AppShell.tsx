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
      <main className="ml-sidebar mt-topbar min-h-[calc(100vh-64px)] bg-cream p-6">
        {children}
      </main>
    </div>
  );
}
