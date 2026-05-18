import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/use-auth'

export function Layout() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-neutral-950 text-neutral-400">
        <span>Loading…</span>
      </main>
    )
  }

  if (!session) return <Navigate to="/sign-in" replace />

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      <Outlet />
    </div>
  )
}
