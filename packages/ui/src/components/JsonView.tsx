interface JsonViewProps {
  value: unknown;
}

export function JsonView({ value }: JsonViewProps) {
  let pretty: string;
  try {
    pretty = typeof value === 'string' ? prettyMaybeJson(value) : JSON.stringify(value, null, 2);
  } catch {
    pretty = String(value);
  }
  return (
    <pre className="text-xs leading-relaxed font-mono bg-zinc-950 border border-zinc-800 rounded-md p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap">
      {pretty}
    </pre>
  );
}

function prettyMaybeJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
