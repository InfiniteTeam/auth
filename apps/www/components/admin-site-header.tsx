'use client';

import { usePathname } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

const TITLES: Record<string, string> = {
  '/admin': '개요',
  '/admin/clients': 'OIDC 클라이언트',
  '/admin/providers': '소셜 OAuth',
  '/admin/webfinger': 'WebFinger',
  '/admin/users': '사용자',
  '/admin/groups': '그룹',
  '/admin/sessions': '세션',
  '/admin/env': '환경 설정',
};

export function AdminSiteHeader() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? '관리';

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
      <h1 className="text-base font-medium">{title}</h1>
    </header>
  );
}
