import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      {icon && (
        <div className="mb-4 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-semibold text-slate-200 mb-2">{title}</h3>
      {description && (
        <p className="text-slate-400 mb-6 max-w-md">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
