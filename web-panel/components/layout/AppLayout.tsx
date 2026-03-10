'use client'

import { Sidebar } from './Sidebar'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { BrandingProvider } from '@/contexts/BrandingContext'
import { AuthGuard } from '@/components/auth/AuthGuard'

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isLocked } = useSidebar()

  return (
    <div className="flex w-full h-screen overflow-x-hidden bg-background">
      {/* Sidebar - Fixed position, transitions smoothly */}
      <Sidebar />

      {/* Main Content Area - Margin adjusts based on lock state */}
      <div
        className="flex-1 flex flex-col overflow-hidden transition-all duration-200 ease-in-out min-w-0"
        style={{
          marginLeft: isLocked ? '240px' : '64px'
        }}
      >
        {/* Page Content - Scrollable */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-8">
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

