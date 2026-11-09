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
    <header className="flex min-h-20 shrink-0 items-center gap-3 border-b px-5 sm:px-8 lg:px-10">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 data-vertical:h-4 data-vertical:self-center" />
      <h1 className="min-w-0 text-xl font-semibold break-words">{title}</h1>
    </header>
  );
}
