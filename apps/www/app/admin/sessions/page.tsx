'use client';

import { useCallback, useEffect, useState } from 'react';
import { PermissionFlags } from '@inftkr/auth-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminGuard } from '@/components/admin-guard';
import { AdminApiError, listSessions, revokeSession, type AdminSession } from '@/lib/admin';

function SessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [filter, setFilter] = useState('');
  const [applied, setApplied] = useState('');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listSessions(applied || undefined)
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof AdminApiError ? err.message : '세션을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [applied, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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
          사용자 ID
        </Label>
        <Input
          id="session-filter"
          className="min-w-0 flex-1"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="userId로 필터"
        />
        <Button type="submit" size="sm" variant="outline">
          조회
        </Button>
      </form>
      <div className="flex flex-col">
        {sessions.map((s) => (
          <Card
            key={s.id}
            className="grid gap-5 rounded-none border-0 border-b bg-transparent py-6 ring-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
          >
            <CardHeader className="min-w-0 px-0">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {s.email}
                <Badge variant={s.active ? 'default' : 'outline'}>
                  {s.active ? '활성' : '비활성'}
                </Badge>
                <Badge variant="outline">{s.provider}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 px-0 flex flex-col gap-3 text-sm text-muted-foreground">
              <p className="break-all font-mono text-xs">{s.id}</p>
              <p>
                <span className="block">발급 {new Date(s.issuedAt).toLocaleString('ko-KR')}</span>
                <span className="block">만료 {new Date(s.expiresAt).toLocaleString('ko-KR')}</span>
              </p>
              {s.active ? (
                <div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!window.confirm('이 세션을 강제 종료할까요?')) return;
                      try {
                        await revokeSession(s.id);
                        setError('');
                        refresh();
                      } catch {
                        setError('세션 무효화에 실패했습니다.');
                      }
                    }}
                  >
                    강제 종료
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
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
