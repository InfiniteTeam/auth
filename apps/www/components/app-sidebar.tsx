'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
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

const NAV: {
  label: string;
  items: {
    href: string;
    title: string;
    icon: typeof LayoutDashboard;
    exact?: boolean;
  }[];
}[] = [
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
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
              <Image src="/logo.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
              <span className="flex flex-col leading-tight">
                <strong className="text-sm">Infinite Studio</strong>
                <small className="text-xs text-muted-foreground">Admin</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-3 py-4">
        {NAV.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-sm">{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={
                          <Link href={item.href} aria-current={active ? 'page' : undefined} />
                        }
                        isActive={active}
                        tooltip={item.title}
                      >
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
      <SidebarFooter className="border-t py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/" />} tooltip="계정 홈으로">
              <ArrowLeft aria-hidden="true" />
              <span>계정 홈으로</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
