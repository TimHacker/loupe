import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/use-auth'
import { useSubscriptions } from '../lib/queries'
import { AddFeedForm } from './AddFeedForm'

const KIND_DOT: Record<string, string> = {
  rss: 'bg-orange-500/70',
  atom: 'bg-orange-500/70',
  youtube: 'bg-red-500/70',
  podcast: 'bg-violet-500/70',
  substack: 'bg-emerald-500/70',
}

function navClass({ isActive }: { isActive: boolean }) {
  return `block rounded px-2 py-1.5 text-sm ${
    isActive ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
  }`
}

export function Sidebar() {
  const { session, signOut } = useAuth()
  const { data: subs } = useSubscriptions()
  const [adding, setAdding] = useState(false)

  return (
    <aside className="flex h-dvh flex-col border-r border-neutral-900 bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-900 p-4">
        <h1 className="text-lg font-semibold tracking-tight">Loupe</h1>
        <p className="mt-0.5 text-xs text-neutral-500">{session?.user.email}</p>
      </header>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <NavLink to="/" end className={navClass}>
          All items
        </NavLink>
        <NavLink to="/saved" className={navClass}>
          Saved
        </NavLink>

        <div className="mt-5 px-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Feeds
        </div>
        <ul className="mt-1 space-y-0.5">
          {(subs ?? []).map(({ feed }) => (
            <li key={feed.id}>
              <NavLink to={`/feed/${feed.id}`} className={navClass}>
                <span className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[feed.kind] ?? 'bg-neutral-500'}`}
                    aria-hidden
                  />
                  <span className="truncate">{feed.title ?? feed.url}</span>
                </span>
              </NavLink>
            </li>
          ))}
          {subs && subs.length === 0 ? (
            <li className="px-2 py-1 text-xs text-neutral-500">No feeds yet.</li>
          ) : null}
        </ul>
      </nav>

      <div className="space-y-2 border-t border-neutral-900 p-3">
        {adding ? (
          <div className="space-y-2">
            <AddFeedForm />
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            + Add feed
          </button>
        )}
        <button
          type="button"
          onClick={signOut}
          className="block w-full text-left text-xs text-neutral-500 hover:text-neutral-300"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
