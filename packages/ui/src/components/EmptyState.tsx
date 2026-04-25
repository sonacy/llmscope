interface EmptyStateProps {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 p-10 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {hint ? <p className="text-xs text-zinc-500 mt-1">{hint}</p> : null}
    </div>
  );
}
