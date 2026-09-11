'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PermissionFlags, hasPermissions } from '@inftkr/auth-core';
import { useSession } from '@inftkr/auth-core/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BACKEND_URL } from '@/lib/auth';

/**
 * Gate wrapper for admin pages. Layout stays unconditional (Next.js
 * guidance); each page checks the session and required permissions here.
 */
export function AdminGuard({
  children,
  required = PermissionFlags.OidcClientRead,
}: {
  children: ReactNode;
  required?: bigint | string;
}) {
  const { session, isLoading } = useSession({ baseUrl: BACKEND_URL });

  if (isLoading) {
    return (
      <div className="flow-loading" role="status">
        <span className="spinner" />
        계정 정보를 불러오는 중입니다.
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertTitle>로그인이 필요합니다</AlertTitle>
          <AlertDescription>어드민 패널을 이용하려면 먼저 로그인해 주세요.</AlertDescription>
        </Alert>
        <div>
          <Button size="sm" render={<Link href="/login" />}>
            로그인
          </Button>
        </div>
      </div>
    );
  }

  if (!hasPermissions(session.user.permissions, required)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>권한 없음</AlertTitle>
        <AlertDescription>이 페이지를 조회할 권한이 없습니다.</AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
