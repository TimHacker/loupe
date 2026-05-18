import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/use-auth'
import { isConfigured } from '../lib/supabase'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function SignIn() {
  const { session, loading, signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')
    const { error } = await signInWithEmail(email)
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-950 text-neutral-100 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Loupe</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Personal aggregator for AI and software-engineering news.
        </p>

        {!isConfigured ? (
          <div className="mt-8 rounded border border-amber-700/50 bg-amber-950/40 p-4 text-sm">
            <p className="font-medium text-amber-200">Setup needed</p>
            <p className="mt-1 text-amber-200/80">
              Supabase isn't wired up. See{' '}
              <a className="underline" href="https://github.com/TimHacker/loupe/blob/main/supabase/README.md">
                supabase/README.md
              </a>
              .
            </p>
          </div>
        ) : status === 'sent' ? (
          <div className="mt-8 rounded border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
            Check <span className="font-medium text-neutral-100">{email}</span> for a sign-in link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-3">
            <label className="block">
              <span className="text-sm text-neutral-300">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:border-neutral-600 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {status === 'error' ? (
              <p role="alert" className="text-sm text-red-400">
                {errorMsg}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </main>
  )
}
