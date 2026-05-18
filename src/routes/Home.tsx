import { useAuth } from '../lib/use-auth'

export function Home() {
  const { session, signOut } = useAuth()

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Loupe</h1>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-neutral-400 hover:text-neutral-200"
        >
          Sign out
        </button>
      </header>
      <p className="mt-3 text-sm text-neutral-400">
        Signed in as {session?.user.email}
      </p>
      <section className="mt-10 rounded border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-300">
        <h2 className="text-base font-medium text-neutral-100">No feeds yet</h2>
        <p className="mt-2 text-neutral-400">
          Subscriptions, items, and the reader view land in subsequent commits.
        </p>
      </section>
    </main>
  )
}
