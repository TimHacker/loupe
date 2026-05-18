import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/use-auth'
import { Sidebar } from '../components/Sidebar'

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
    <div className="grid h-dvh grid-cols-[280px_1fr] bg-neutral-950 text-neutral-100">
      <Sidebar />
      <main className="overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
