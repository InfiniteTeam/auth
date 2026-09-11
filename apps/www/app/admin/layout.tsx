import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AdminSiteHeader } from '@/components/admin-site-header';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AdminSiteHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
