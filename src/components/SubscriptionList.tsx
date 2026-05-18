import { useSubscriptions } from '../lib/queries'

const KIND_LABEL: Record<string, string> = {
  rss: 'RSS',
  atom: 'Atom',
  youtube: 'YouTube',
  podcast: 'Podcast',
  substack: 'Substack',
}

export function SubscriptionList() {
  const { data, isLoading, error } = useSubscriptions()

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Loading feeds…</p>
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-400">
        Couldn't load feeds: {error.message}
      </p>
    )
  }
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No feeds yet. Paste a URL above to add one.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-neutral-900">
      {data.map(({ feed }) => (
        <li key={feed.id} className="py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-100">
                {feed.title ?? feed.url}
              </p>
              <p className="truncate text-xs text-neutral-500">
                {feed.site_url ?? feed.url}
              </p>
            </div>
            <span className="shrink-0 rounded bg-neutral-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
              {KIND_LABEL[feed.kind] ?? feed.kind}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
