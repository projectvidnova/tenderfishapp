/**
 * EmptyState — consistent empty states across all tables/lists.
 */

import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="py-12 text-center">
      {icon && <div className="mb-3 flex justify-center text-text-quaternary">{icon}</div>}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description && <p className="text-xs text-text-tertiary mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
