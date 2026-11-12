'use client';

import { useCallback, useEffect, useState } from 'react';
import { PermissionFlags, hasPermissions } from '@inftkr/auth-core';
import { useSession } from '@inftkr/auth-core/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminGuard } from '@/components/admin-guard';
import {
  AdminApiError,
  listSessions,
  revokeSession,
  type AdminSession,
} from '@/lib/admin';
import { BACKEND_URL } from '@/lib/auth';

function SessionsPage() {
  const { session } = useSession({ baseUrl: BACKEND_URL });
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [filter, setFilter] = useState('');
  const [applied, setApplied] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const canRevoke = Boolean(
    session &&
    hasPermissions(session.user.permissions, PermissionFlags.SessionRevoke),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listSessions(applied || undefined, activeOnly)
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setSessions([]);
          setError(
            err instanceof AdminApiError
              ? err.message
              : '세션을 불러오지 못했습니다.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, activeOnly, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        최근 50개 세션을 확인하고 필요한 경우 강제 종료할 수 있습니다.
      </p>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={refresh}
          >
            다시 시도
          </Button>
        </Alert>
      ) : null}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filter.trim());
        }}
      >
        <Label htmlFor="session-filter" className="w-full">
          사용자 ID로 필터
        </Label>
        <Input
          id="session-filter"
          className="min-w-0 flex-1"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="정확한 사용자 ID 입력"
        />
        <Button type="submit" size="sm" variant="outline">
          적용
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={activeOnly ? 'default' : 'outline'}
          aria-pressed={activeOnly}
          onClick={() => setActiveOnly(true)}
        >
          활성 세션
        </Button>
        <Button
          size="sm"
          variant={!activeOnly ? 'default' : 'outline'}
          aria-pressed={!activeOnly}
          onClick={() => setActiveOnly(false)}
        >
          전체 세션
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          disabled={loading}
        >
          새로고침
        </Button>
      </div>
      {loading ? (
        <div className="flow-loading" role="status">
          <span className="spinner" />
          세션 목록을 불러오는 중입니다.
        </div>
      ) : !error && sessions.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground" role="status">
          조건에 맞는 세션이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col" aria-label="세션 목록">
          {sessions.map((s) => (
            <Card
              key={s.id}
              className="grid gap-5 rounded-none border-0 border-b bg-transparent py-6 ring-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
            >
              <CardHeader className="min-w-0 px-0">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {s.email}
                  <Badge variant={s.active ? 'default' : 'outline'}>
                  {s.active ? '활성' : s.revokedAt ? '강제 종료' : '만료'}
                  </Badge>
                  <Badge variant="outline">{s.provider}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 px-0 flex flex-col gap-3 text-sm text-muted-foreground">
                <p className="break-all text-xs">사용자 ID: {s.userId}</p>
                <p className="break-all font-mono text-xs">세션 ID: {s.id}</p>
                <p>
                  <span className="block">
                    발급 {new Date(s.issuedAt).toLocaleString('ko-KR')}
                  </span>
                  <span className="block">
                    만료 {new Date(s.expiresAt).toLocaleString('ko-KR')}
                  </span>
                  {s.revokedAt ? (
                    <span className="block">
                      종료 {new Date(s.revokedAt).toLocaleString('ko-KR')}
                    </span>
                  ) : null}
                </p>
                {s.active && canRevoke ? (
                  <div>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pendingId !== null}
                      onClick={async () => {
                        if (!window.confirm('이 세션을 강제 종료할까요?'))
                          return;
                        setPendingId(s.id);
                        try {
                          await revokeSession(s.id);
                          setError('');
                          refresh();
                        } catch (err) {
                          setError(
                            err instanceof AdminApiError
                              ? err.message
                              : '세션 강제 종료에 실패했습니다.',
                          );
                        } finally {
                          setPendingId(null);
                        }
                      }}
                    >
                      {pendingId === s.id ? '종료 중…' : '강제 종료'}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <AdminGuard required={PermissionFlags.SessionRead}>
      <SessionsPage />
    </AdminGuard>
  );
}
