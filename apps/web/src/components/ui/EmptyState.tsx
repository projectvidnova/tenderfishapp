/**
 * EmptyState — consistent empty states across all tables/lists.
 */

import { ReactNode } from "react";
import { UploadCloud } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  primaryActionText?: string;
  primaryActionOnClick?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  primaryActionText,
  primaryActionOnClick,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-brand-orange/30 bg-brand-orange-light/20 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-border text-brand-orange">
        {icon || <UploadCloud size={20} />}
      </div>
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-2xl text-sm text-text-secondary">
          {description}
        </p>
      )}
      {primaryActionText && primaryActionOnClick && (
        <div className="mt-5">
          <button
            type="button"
            onClick={primaryActionOnClick}
            className="btn-primary inline-flex items-center gap-2"
          >
            {primaryActionText}
          </button>
        </div>
      )}
    </div>
  );
}
