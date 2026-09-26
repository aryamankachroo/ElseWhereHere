import type { ReactNode } from 'react'

import { Header } from '@/components/Header'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main-content" className="sr-only-focusable">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </>
  )
}
