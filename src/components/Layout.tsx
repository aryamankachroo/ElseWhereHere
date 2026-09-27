import type { ReactNode } from 'react'

import { Header } from '@/components/Header'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <img src="/nyc-night.jpg" alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/45" />
      </div>
      <a href="#main-content" className="sr-only-focusable">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="relative z-10 flex-1 pb-[env(safe-area-inset-bottom)]">
        {children}
      </main>
    </>
  )
}
