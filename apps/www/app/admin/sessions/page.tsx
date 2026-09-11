'use client';

import { useCallback, useEffect, useState } from 'react';
import { PermissionFlags } from '@inftkr/auth-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
        if (!cancelled) setError(err instanceof AdminApiError ? err.message : '세션을 불러오지 못했습니다.');
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
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filter.trim());
        }}
      >
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="userId로 필터" />
        <Button type="submit" size="sm" variant="outline">
          조회
        </Button>
      </form>
      <div className="flex flex-col gap-3">
        {sessions.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {s.email}
                <Badge variant={s.active ? 'default' : 'outline'}>{s.active ? '활성' : '비활성'}</Badge>
                <Badge variant="outline">{s.provider}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p className="break-all font-mono text-xs">{s.id}</p>
              <p>
                발급 {new Date(s.issuedAt).toLocaleString('ko-KR')} · 만료 {new Date(s.expiresAt).toLocaleString('ko-KR')}
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
