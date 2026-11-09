'use client';

import { Suspense, useEffect, useState } from 'react';
import { PermissionFlags } from '@inftkr/auth-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminGuard } from '@/components/admin-guard';
import { AdminApiError, getAdminMeta, listClients, listSessions, listSettings } from '@/lib/admin';

function Overview() {
  const [stats, setStats] = useState({ clients: 0, sessions: 0, overrides: 0 });
  const [meta, setMeta] = useState<{
    issuerUrl: string;
    allowedDomains: string[];
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([listClients(), listSessions(), listSettings(), getAdminMeta()])
      .then(([clients, sessions, settings, meta]) => {
        if (!cancelled) {
          setStats({
            clients: clients.length,
            sessions: sessions.filter((s) => s.active).length,
            overrides: settings.filter((s) => s.source === 'override').length,
          });
          setMeta(meta);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof AdminApiError ? err.message : '개요를 불러오지 못했습니다.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-10">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid divide-y border-y py-2 md:grid-cols-3 md:divide-x md:divide-y-0">
        <Card className="rounded-none bg-transparent py-5 ring-0">
          <CardHeader className="px-5">
            <CardTitle>OIDC 클라이언트</CardTitle>
            <CardDescription>등록된 클라이언트 수</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-4xl font-medium tabular-nums">{stats.clients}</p>
          </CardContent>
        </Card>
        <Card className="rounded-none bg-transparent py-5 ring-0">
          <CardHeader className="px-5">
            <CardTitle>활성 세션</CardTitle>
            <CardDescription>현재 유효한 세션 수</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-4xl font-medium tabular-nums">{stats.sessions}</p>
          </CardContent>
        </Card>
        <Card className="rounded-none bg-transparent py-5 ring-0">
          <CardHeader className="px-5">
            <CardTitle>설정 재정의</CardTitle>
            <CardDescription>환경 기본값을 덮어쓴 항목</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-4xl font-medium tabular-nums">{stats.overrides}</p>
          </CardContent>
        </Card>
      </div>
      {meta ? (
        <Card className="grid gap-6 rounded-none bg-transparent py-0 ring-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <CardHeader className="px-0">
            <CardTitle>배포 정보</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 flex flex-col gap-4 px-0 text-sm">
            <p className="break-all">
              Issuer: <code>{meta.issuerUrl}</code>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {meta.allowedDomains.map((d) => (
                <Badge key={d} variant="outline">
                  {d}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <AdminGuard required={PermissionFlags.OidcClientRead}>
      <Suspense>
        <Overview />
      </Suspense>
    </AdminGuard>
  );
}
