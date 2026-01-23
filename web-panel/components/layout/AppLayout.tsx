'use client'

import { Sidebar } from './Sidebar'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isLocked } = useSidebar()

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Sidebar - Fixed position, transitions smoothly */}
      <Sidebar />

      {/* Main Content Area - Margin adjusts based on lock state */}
      <div
        className="flex-1 flex flex-col overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          marginLeft: isLocked ? '240px' : '64px'
        }}
      >
        {/* Page Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </SidebarProvider>
  )
}

