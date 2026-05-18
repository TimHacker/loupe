import { useAuth } from '../lib/use-auth'
import { AddFeedForm } from '../components/AddFeedForm'
import { SubscriptionList } from '../components/SubscriptionList'

export function Home() {
  const { session, signOut } = useAuth()

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Loupe</h1>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <span className="hidden sm:inline">{session?.user.email}</span>
          <button
            type="button"
            onClick={signOut}
            className="hover:text-neutral-200"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-medium text-neutral-300">Add a feed</h2>
        <AddFeedForm />
        <p className="text-xs text-neutral-500">
          Paste any feed URL, blog homepage, Substack root, YouTube channel page, or podcast feed.
          The server discovers the canonical feed and subscribes you.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-medium text-neutral-300">Your feeds</h2>
        <SubscriptionList />
      </section>
    </main>
  )
}
