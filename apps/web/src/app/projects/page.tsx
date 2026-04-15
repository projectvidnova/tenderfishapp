import Link from "next/link";
import { Plus, FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            All workspace projects.
          </p>
        </div>
        <Link href="/projects/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {/* Empty state */}
      <div className="card p-12 flex flex-col items-center justify-center text-center">
        <FolderKanban size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">
          No projects yet
        </h3>
        <p className="text-sm text-gray-400 mb-6 max-w-md">
          Start with whatever you have — an email, a PDF, or a briefing.
          Tenderfish will structure it using AI.
        </p>
        <Link href="/projects/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Create your first project
        </Link>
      </div>
    </div>
  );
}
