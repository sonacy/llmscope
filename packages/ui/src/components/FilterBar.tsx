import { useEffect, useState } from 'react';
import { setQuery } from '../lib/router';

interface FilterBarProps {
  query: URLSearchParams;
}

export function FilterBar({ query }: FilterBarProps) {
  const [q, setQ] = useState(query.get('q') ?? '');
  const [source, setSource] = useState(query.get('source') ?? '');
  const [provider, setProvider] = useState(query.get('provider') ?? '');
  const [status, setStatus] = useState(query.get('status') ?? '');

  useEffect(() => {
    setQ(query.get('q') ?? '');
    setSource(query.get('source') ?? '');
    setProvider(query.get('provider') ?? '');
    setStatus(query.get('status') ?? '');
  }, [query]);

  function commit() {
    setQuery((p) => {
      if (q) p.set('q', q);
      else p.delete('q');
      if (source) p.set('source', source);
      else p.delete('source');
      if (provider) p.set('provider', provider);
      else p.delete('provider');
      if (status) p.set('status', status);
      else p.delete('status');
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      className="flex flex-wrap gap-2 items-center"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="search prompts/responses"
        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs w-64"
      />
      <input
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="source kind"
        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs w-40"
      />
      <input
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
        placeholder="provider"
        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs w-32"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs"
      >
        <option value="">all</option>
        <option value="ok">ok</option>
        <option value="error">error</option>
      </select>
      <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 px-3 py-1 rounded text-xs">
        apply
      </button>
    </form>
  );
}
