import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-bg-bg-page">
      <Sidebar />
      <TopBar />
      <main className="ml-72 mt-topbar min-h-[calc(100vh-52px)] p-6 lg:p-8">
        <div className="w-full max-w-none">{children}</div>
      </main>
    </div>
  );
}
