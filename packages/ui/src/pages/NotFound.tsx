import { Card, CardTitle } from '../components/ui/Card';

export function NotFoundPage() {
  return (
    <Card>
      <CardTitle>Not found</CardTitle>
      <p className="text-xs text-zinc-400">No such page.</p>
    </Card>
  );
}
