import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { Layout } from './routes/Layout'
import { SignIn } from './routes/SignIn'
import { Items } from './routes/Items'
import { Reader } from './routes/Reader'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
})

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <Items /> },
        { path: 'feed/:feedId', element: <Items /> },
        { path: 'saved', element: <Items savedOnly /> },
        { path: 'item/:itemId', element: <Reader /> },
      ],
    },
    { path: '/sign-in', element: <SignIn /> },
  ],
  { basename: '/loupe' },
)

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
