import { ArrowLeft, RotateCcw } from 'lucide-react'
import { useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { AboutDialog } from '@/components/AboutDialog'
import { useFlow } from '@/context/FlowContext'

function getBackTarget(pathname: string, hasMatch: boolean): string | null {
  if (pathname === '/' || pathname === '/start') return null
  if (pathname === '/confirm') return '/start'
  if (pathname === '/matching') return '/confirm'
  if (pathname === '/result') return '/confirm'
  if (pathname.startsWith('/story/')) return hasMatch ? '/result' : '/start'
  return null
}

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const flow = useFlow()

  const backTarget = getBackTarget(location.pathname, Boolean(flow.matchResult))
  const showStartOver = location.pathname !== '/' && location.pathname !== '/start'

  const handleStartOver = useCallback(() => {
    flow.startOver()
    navigate('/start')
  }, [flow, navigate])

  return (
    <header className="glass-bar sticky top-0 z-30 border-b border-white/15 pt-[env(safe-area-inset-top)]">
      <div className="content-max flex items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
        <Link
          to="/"
          className="whitespace-nowrap text-base font-semibold tracking-tight text-[var(--color-text)] transition hover:opacity-80"
        >
          Elsewhere Here
        </Link>

        <nav className="flex shrink-0 items-center gap-0.5 sm:gap-1.5" aria-label="Flow navigation">
          {backTarget && (
            <button
              type="button"
              onClick={() => navigate(backTarget)}
              className="flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm text-[var(--color-text-secondary)] transition hover:bg-white/5 hover:text-[var(--color-text)] sm:gap-1.5 sm:px-3"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back
            </button>
          )}
          {showStartOver && (
            <button
              type="button"
              onClick={handleStartOver}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs text-[var(--color-text-muted)] transition hover:bg-white/5 hover:text-[var(--color-text-secondary)] sm:px-3"
              title="Clear this session and return home"
              aria-label="Start over"
            >
              <RotateCcw size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Start over</span>
            </button>
          )}
          <AboutDialog />
        </nav>
      </div>
    </header>
  )
}
