import { ArrowLeft, RotateCcw } from 'lucide-react'
import { useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { AboutDialog } from '@/components/AboutDialog'
import { useFlow } from '@/context/FlowContext'

function getBackTarget(pathname: string, hasMatch: boolean): string | null {
  if (pathname === '/') return null
  if (pathname === '/confirm') return '/'
  if (pathname === '/matching') return '/confirm'
  if (pathname === '/result') return '/confirm'
  if (pathname.startsWith('/story/')) return hasMatch ? '/result' : '/'
  return null
}

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const flow = useFlow()

  const backTarget = getBackTarget(location.pathname, Boolean(flow.matchResult))
  const showStartOver = location.pathname !== '/'

  const handleStartOver = useCallback(() => {
    flow.startOver()
    navigate('/')
  }, [flow, navigate])

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur">
      <div className="content-max flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="text-base font-semibold tracking-tight text-[var(--color-text)] transition hover:opacity-80"
        >
          Elsewhere Here
        </Link>

        <nav className="flex items-center gap-1.5" aria-label="Flow navigation">
          {backTarget && (
            <button
              type="button"
              onClick={() => navigate(backTarget)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition hover:bg-white/5 hover:text-[var(--color-text)]"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back
            </button>
          )}
          {showStartOver && (
            <button
              type="button"
              onClick={handleStartOver}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[var(--color-text-muted)] transition hover:bg-white/5 hover:text-[var(--color-text-secondary)]"
              title="Clear this session and return home"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Start over
            </button>
          )}
          <AboutDialog />
        </nav>
      </div>
    </header>
  )
}
