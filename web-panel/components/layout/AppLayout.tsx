'use client'

import { Sidebar } from './Sidebar'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { BrandingProvider } from '@/contexts/BrandingContext'
import { AuthGuard } from '@/components/auth/AuthGuard'

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isLocked } = useSidebar()

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[-8rem] h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <Sidebar />

      <div
        className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300 ease-out"
        style={{ marginLeft: isLocked ? '248px' : '64px' }}
      >
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="dietitian">
      <SidebarProvider>
        <BrandingProvider>
          <AppLayoutContent>{children}</AppLayoutContent>
        </BrandingProvider>
      </SidebarProvider>
    </AuthGuard>
  )
}

