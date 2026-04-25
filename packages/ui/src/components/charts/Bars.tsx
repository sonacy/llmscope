interface BarSeries {
  label: string;
  value: number;
  color?: string;
}

interface BarsProps {
  data: BarSeries[];
  maxLabelChars?: number;
}

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a78bfa', '#06b6d4', '#fb7185', '#84cc16'];

export function Bars({ data, maxLabelChars = 32 }: BarsProps) {
  if (data.length === 0) return <p className="text-xs text-zinc-500">No data in range.</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-32 text-zinc-400 truncate" title={d.label}>
            {d.label.length > maxLabelChars ? d.label.slice(0, maxLabelChars - 1) + '…' : d.label}
          </span>
          <div className="flex-1 h-4 bg-zinc-900 rounded overflow-hidden">
            <div
              className="h-full"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? PALETTE[i % PALETTE.length] }}
            />
          </div>
          <span className="w-20 text-right text-zinc-300 tabular-nums">{Math.round(d.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
