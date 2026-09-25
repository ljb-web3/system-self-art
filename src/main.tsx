import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ArtApp from './ArtApp'
import { Experiment00StudyProvider } from './experiment00StudyState'
import './index.css'

if (import.meta.env.DEV) {
  void import('./lib/supabase')
    .then(({ verifySupabaseConnection }) => verifySupabaseConnection())
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown connection error'
      console.error(`[Supabase] Connection test failed: ${message}`)
    })
}

const root = document.getElementById('root')

if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <Experiment00StudyProvider>
      <ArtApp />
    </Experiment00StudyProvider>
  </StrictMode>,
)
