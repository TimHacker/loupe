import { Link, useParams } from 'react-router-dom'
import { useItems, useSubscriptions, useToggleSave, type ItemListEntry } from '../lib/queries'

interface ItemsProps {
  savedOnly?: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function feedTitleFor(feedId: string, subs: ReturnType<typeof useSubscriptions>['data']): string | undefined {
  return subs?.find((s) => s.feed.id === feedId)?.feed.title ?? undefined
}

export function Items({ savedOnly }: ItemsProps) {
  const { feedId } = useParams<{ feedId?: string }>()
  const { data: subs } = useSubscriptions()
  const { data: entries, isLoading, error } = useItems({ feedId, savedOnly })

  const heading = savedOnly
    ? 'Saved'
    : feedId
      ? feedTitleFor(feedId, subs) ?? 'Feed'
      : 'All items'

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>

      {isLoading ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : error ? (
        <p role="alert" className="mt-6 text-sm text-red-400">
          Couldn't load items: {error.message}
        </p>
      ) : !entries || entries.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          {savedOnly ? 'Nothing saved yet.' : 'No items yet — the cron will fetch them soon.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-900">
          {entries.map((entry) => (
            <ItemRowView key={entry.item.id} entry={entry} subs={subs} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ItemRowView({ entry, subs }: { entry: ItemListEntry; subs: ReturnType<typeof useSubscriptions>['data'] }) {
  const { item, state } = entry
  const isRead = Boolean(state?.read_at)
  const isSaved = Boolean(state?.saved)
  const toggleSave = useToggleSave()
  const feedTitle = feedTitleFor(item.feed_id, subs)

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${isRead ? 'bg-transparent' : 'bg-sky-400'}`}
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/item/${item.id}`}
            className={`block text-base ${isRead ? 'text-neutral-400' : 'text-neutral-100'} hover:text-white`}
          >
            <span className="font-medium">{item.title ?? '(untitled)'}</span>
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            {feedTitle ? <span>{feedTitle}</span> : null}
            {feedTitle && item.published_at ? <span> · </span> : null}
            {item.published_at ? <span>{formatDate(item.published_at)}</span> : null}
          </p>
          {item.excerpt ? (
            <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{item.excerpt}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => toggleSave.mutate({ itemId: item.id, saved: !isSaved })}
          aria-pressed={isSaved}
          title={isSaved ? 'Unsave' : 'Save'}
          className={`shrink-0 text-lg ${
            isSaved ? 'text-amber-400 hover:text-amber-300' : 'text-neutral-600 hover:text-neutral-400'
          }`}
        >
          {isSaved ? '★' : '☆'}
        </button>
      </div>
    </li>
  )
}
