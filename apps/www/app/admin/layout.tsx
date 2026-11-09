import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AdminSiteHeader } from '@/components/admin-site-header';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider className="admin-shell mx-auto max-w-[1360px]">
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AdminSiteHeader />
        <main className="admin-content mx-auto flex w-full flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
