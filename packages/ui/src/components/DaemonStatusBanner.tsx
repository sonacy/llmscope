interface DaemonStatusBannerProps {
  connected: boolean;
}

export function DaemonStatusBanner({ connected }: DaemonStatusBannerProps) {
  if (connected) return null;
  return (
    <div className="bg-red-900/40 border-b border-red-800 text-red-200 text-xs px-4 py-2">
      Daemon disconnected — reconnecting…
    </div>
  );
}
