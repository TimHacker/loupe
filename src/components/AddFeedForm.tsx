import { useState, type FormEvent } from 'react'
import { useAddFeed } from '../lib/queries'

export function AddFeedForm() {
  const [url, setUrl] = useState('')
  const addFeed = useAddFeed()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    addFeed.mutate(url, {
      onSuccess: () => setUrl(''),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="url"
        required
        placeholder="https://example.com or https://example.substack.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={addFeed.isPending}
        className="flex-1 rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={addFeed.isPending}
        className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-60"
      >
        {addFeed.isPending ? 'Adding…' : 'Add'}
      </button>
      {addFeed.isError ? (
        <p role="alert" className="basis-full text-sm text-red-400">
          {addFeed.error.message}
        </p>
      ) : null}
    </form>
  )
}
