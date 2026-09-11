'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Fingerprint,
  Globe,
  KeyRound,
  LayoutDashboard,
  MonitorSmartphone,
  ServerCog,
  Users,
  UsersRound,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const NAV: { label: string; items: { href: string; title: string; icon: typeof LayoutDashboard; exact?: boolean }[] }[] = [
  {
    label: '관리',
    items: [
      { href: '/admin', title: '개요', icon: LayoutDashboard, exact: true },
      { href: '/admin/clients', title: 'OIDC 클라이언트', icon: KeyRound },
      { href: '/admin/providers', title: '소셜 OAuth', icon: Fingerprint },
      { href: '/admin/webfinger', title: 'WebFinger', icon: Globe },
    ],
  },
  {
    label: '디렉터리',
    items: [
      { href: '/admin/users', title: '사용자', icon: Users },
      { href: '/admin/groups', title: '그룹', icon: UsersRound },
      { href: '/admin/sessions', title: '세션', icon: MonitorSmartphone },
    ],
  },
  {
    label: '시스템',
    items: [{ href: '/admin/env', title: '환경 설정', icon: ServerCog }],
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                IS
              </span>
              <span className="flex flex-col leading-tight">
                <strong className="text-sm">Infinite Studio</strong>
                <small className="text-xs text-muted-foreground">Admin</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton render={<Link href={item.href} />} isActive={active} tooltip={item.title}>
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/" />} tooltip="계정 홈으로">
              <span aria-hidden>←</span>
              <span>계정 홈으로</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
