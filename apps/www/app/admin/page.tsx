'use client';

import { Suspense, useEffect, useState } from 'react';
import { PermissionFlags } from '@inftkr/auth-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminGuard } from '@/components/admin-guard';
import { AdminApiError, getAdminMeta, getAdminOverview, listClients, listSettings, type AdminOverview } from '@/lib/admin';

function Overview() {
  const [stats, setStats] = useState({ clients: 0, sessions: 0, overrides: 0 });
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [meta, setMeta] = useState<{
    issuerUrl: string;
    allowedDomains: string[];
  } | null>(null);
  const [error, setError] = useState('');
  const peak = Math.max(1, ...(overview?.weeks.map((week) => week.count) ?? []));

  useEffect(() => {
    let cancelled = false;
    Promise.all([listClients(), listSettings(), getAdminMeta(), getAdminOverview()])
      .then(([clients, settings, meta, overview]) => {
        if (!cancelled) {
          setStats({
            clients: clients.length,
            sessions: overview.activeSessions,
            overrides: settings.filter((s) => s.source === 'override').length,
          });
          setMeta(meta);
          setOverview(overview);
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
      {overview ? (
        <div className="grid gap-10 lg:grid-cols-2">
          <Card className="rounded-none bg-transparent py-0 ring-0">
            <CardHeader className="px-0">
              <CardTitle>주간 로그인</CardTitle>
              <CardDescription>최근 8주간 생성된 세션 수 · UTC 기준</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <ol className="space-y-3">
                {overview.weeks.map(({ week, count }) => (
                  <li key={week} className="grid grid-cols-[5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
                    <time dateTime={week}>{new Date(week).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })}</time>
                    <div className="h-3 rounded bg-muted" aria-hidden="true">
                      <div className="h-full rounded bg-primary" style={{ width: `${count / peak * 100}%` }} />
                    </div>
                    <span className="text-right tabular-nums">{count}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card className="rounded-none bg-transparent py-0 ring-0">
            <CardHeader className="px-0">
              <CardTitle>최근 변경</CardTitle>
              <CardDescription>OIDC 클라이언트와 플랫폼 설정의 최근 저장 기록</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {overview.changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">표시할 변경 내역이 없습니다.</p>
              ) : (
                <ol className="divide-y">
                  {overview.changes.map((change) => (
                    <li key={`${change.kind}-${change.label}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                      <span className="min-w-0 break-all">
                        {change.kind === 'client' ? '클라이언트' : '설정'} {change.label}
                        <span className="ml-2 text-muted-foreground">{change.action === 'created' ? '생성' : '변경'}</span>
                      </span>
                      <time className="text-muted-foreground" dateTime={change.at}>{new Date(change.at).toLocaleString('ko-KR')}</time>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
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
    <AdminGuard required={PermissionFlags.OidcClientRead | PermissionFlags.SessionRead | PermissionFlags.SettingsRead}>
      <Suspense>
        <Overview />
      </Suspense>
    </AdminGuard>
  );
}
