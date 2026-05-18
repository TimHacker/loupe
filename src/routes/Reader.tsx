import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { useItem, useItemBody, useMarkRead, useToggleSave, useSubscriptions } from '../lib/queries'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function Reader() {
  const { itemId } = useParams<{ itemId: string }>()
  const { data: item, isLoading: itemLoading, error: itemError } = useItem(itemId)
  const { data: bodyHtml, isLoading: bodyLoading } = useItemBody(item)
  const { data: subs } = useSubscriptions()
  const markRead = useMarkRead()
  const toggleSave = useToggleSave()

  useEffect(() => {
    if (item) markRead.mutate(item.id)
    // The mutation hook is stable and we only want this on mount per item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  const safeBody = useMemo(() => (bodyHtml ? DOMPurify.sanitize(bodyHtml) : ''), [bodyHtml])

  if (itemLoading) {
    return <p className="px-6 py-8 text-sm text-neutral-500">Loading…</p>
  }
  if (itemError || !item) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-red-400">
        Couldn't load item: {itemError?.message ?? 'not found'}
      </p>
    )
  }

  const feedTitle = subs?.find((s) => s.feed.id === item.feed_id)?.feed.title

  return (
    <article className="mx-auto max-w-3xl px-6 py-8">
      <Link to="/" className="text-xs text-neutral-500 hover:text-neutral-300">
        ← Back
      </Link>

      <header className="mt-4">
        <p className="text-xs text-neutral-500">
          {feedTitle ? <span>{feedTitle}</span> : null}
          {feedTitle && item.published_at ? <span> · </span> : null}
          {item.published_at ? <span>{formatDate(item.published_at)}</span> : null}
          {item.author ? <span> · {item.author}</span> : null}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
              {item.title ?? '(untitled)'}
            </a>
          ) : (
            (item.title ?? '(untitled)')
          )}
        </h1>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => toggleSave.mutate({ itemId: item.id, saved: true })}
            className="text-neutral-400 hover:text-amber-300"
          >
            ★ Save
          </button>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-400 hover:text-neutral-100"
            >
              Open original ↗
            </a>
          ) : null}
        </div>
      </header>

      {item.audio_url ? (
        <div className="mt-6">
          <audio
            controls
            preload="metadata"
            src={item.audio_url}
            className="w-full"
          />
        </div>
      ) : null}

      {item.thumbnail_url && !item.audio_url ? (
        <img
          src={item.thumbnail_url}
          alt=""
          className="mt-6 w-full rounded border border-neutral-900"
        />
      ) : null}

      {bodyLoading ? (
        <p className="mt-6 text-sm text-neutral-500">Loading article…</p>
      ) : safeBody ? (
        <div
          className="prose-reader mt-8 text-[15px] leading-7 text-neutral-200"
          dangerouslySetInnerHTML={{ __html: safeBody }}
        />
      ) : (
        <p className="mt-6 text-sm text-neutral-500">
          No body content. {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="underline">Read at the source.</a> : null}
        </p>
      )}
    </article>
  )
}
