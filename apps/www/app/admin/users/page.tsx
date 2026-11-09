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
import { AdminApiError, deleteUser, listUsers, updateUser, type AdminUser } from '@/lib/admin';

function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    listUsers(query || undefined)
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof AdminApiError ? err.message : '사용자를 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [query, reloadKey]);

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
          setQuery(search.trim());
        }}
      >
        <Label htmlFor="user-search" className="w-full">
          사용자 검색
        </Label>
        <Input
          id="user-search"
          className="min-w-0 flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="id / 이메일 / 이름 검색"
        />
        <Button type="submit" size="sm" variant="outline">
          검색
        </Button>
      </form>
      <div className="flex flex-col">
        {users.map((u) => (
          <Card
            key={u.id}
            className="grid gap-5 rounded-none border-0 border-b bg-transparent py-6 ring-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
          >
            <CardHeader className="min-w-0 px-0">
              <CardTitle className="break-words text-base">
                {u.displayName}{' '}
                <span className="font-mono text-xs text-muted-foreground">{u.id}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 px-0 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{u.email}</p>
              <div className="flex flex-wrap gap-1.5">
                {u.groups.map((g) => (
                  <Badge key={g} variant="outline">
                    {g}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={`name-${u.id}`} className="w-full">
                  이름
                </Label>
                <Input
                  id={`name-${u.id}`}
                  value={editing[u.id] ?? u.displayName}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  className="min-w-0 flex-1 basis-40"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await updateUser(u.id, {
                        displayName: editing[u.id] ?? u.displayName,
                      });
                      setError('');
                      refresh();
                    } catch {
                      setError('사용자 수정에 실패했습니다.');
                    }
                  }}
                >
                  이름 저장
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (!window.confirm(`"${u.id}" 사용자를 삭제할까요?`)) return;
                    try {
                      await deleteUser(u.id);
                      setError('');
                      refresh();
                    } catch {
                      setError('사용자 삭제에 실패했습니다.');
                    }
                  }}
                >
                  삭제
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AdminGuard required={PermissionFlags.UserRead}>
      <UsersPage />
    </AdminGuard>
  );
}
