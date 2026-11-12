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
import { Textarea } from '@/components/ui/textarea';
import { AdminGuard } from '@/components/admin-guard';
import {
  AdminApiError,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type AdminUser,
} from '@/lib/admin';
import { BACKEND_URL } from '@/lib/auth';

function UsersPage() {
  const { session } = useSession({ baseUrl: BACKEND_URL });
  const canWrite =
    !!session &&
    hasPermissions(session.user.permissions, PermissionFlags.UserWrite);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<
    Record<string, { email: string; displayName: string }>
  >({});
  const [newUser, setNewUser] = useState({
    email: '',
    displayName: '',
    password: '',
  });
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    listUsers(query || undefined)
      .then((list) => {
        if (!cancelled) {
          setUsers(list);
          setListError('');
        }
      })
      .catch((err) => {
        if (!cancelled)
          setListError(
            err instanceof AdminApiError
              ? err.message
              : '사용자를 불러오지 못했습니다.',
          );
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
      {listError ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {canWrite ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">사용자 추가</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await createUser(newUser);
                    setNewUser({ email: '', displayName: '', password: '' });
                    setError('');
                    setNotice('사용자를 추가했습니다.');
                    refresh();
                  } catch (err) {
                    setError(
                      err instanceof AdminApiError
                        ? err.message
                        : '사용자 추가에 실패했습니다.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Label htmlFor="new-user-email">이메일</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  required
                  maxLength={256}
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser((u) => ({ ...u, email: e.target.value }))
                  }
                />
                <Label htmlFor="new-user-name">이름</Label>
                <Input
                  id="new-user-name"
                  required
                  maxLength={128}
                  value={newUser.displayName}
                  onChange={(e) =>
                    setNewUser((u) => ({ ...u, displayName: e.target.value }))
                  }
                />
                <Label htmlFor="new-user-password">초기 비밀번호</Label>
                <Input
                  id="new-user-password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={256}
                  autoComplete="new-password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser((u) => ({ ...u, password: e.target.value }))
                  }
                />
                <Button type="submit" size="sm" disabled={busy}>
                  추가
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">일괄 추가</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const rows = bulk
                    .replace(/(?:\r?\n)+$/, '')
                    .split(/\r?\n/)
                    .map((line) => line.split('\t'));
                  if (rows.length > 200) {
                    setError('한 번에 200명까지 추가할 수 있습니다.');
                    return;
                  }
                  if (
                    rows.some(
                      (row) =>
                        row.length !== 3 || row.some((value) => !value.trim()),
                    )
                  ) {
                    setError(
                      '각 줄에 이메일, 이름, 초기 비밀번호를 탭으로 구분해 입력하세요.',
                    );
                    return;
                  }
                  setBusy(true);
                  let added = 0;
                  const failed: number[] = [];
                  const failedRows: string[] = [];
                  for (const [index, row] of rows.entries()) {
                    try {
                      await createUser({
                        email: row[0]!.trim(),
                        displayName: row[1]!.trim(),
                        password: row[2]!,
                      });
                      added++;
                    } catch {
                      failed.push(index + 1);
                      failedRows.push(row.join('\t'));
                    }
                  }
                  setBulk(failedRows.join('\n'));
                  setBusy(false);
                  setError(
                    failed.length
                      ? `추가 실패: ${failed.join(', ')}번째 줄. 해당 사용자를 확인하세요.`
                      : '',
                  );
                  setNotice(`${added}명을 추가했습니다.`);
                  refresh();
                }}
              >
                <Label htmlFor="bulk-users">
                  한 줄에 이메일, 이름, 초기 비밀번호 순서로 탭 구분
                </Label>
                <Textarea
                  id="bulk-users"
                  value={bulk}
                  onChange={(e) => setBulk(e.target.value)}
                  placeholder={'user@example.com\t홍길동\t초기 비밀번호'}
                  rows={5}
                  required
                />
                <Button type="submit" size="sm" disabled={busy}>
                  일괄 추가
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
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
        {users.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            표시할 사용자가 없습니다.
          </p>
        ) : null}
        {users.map((u) => (
          <Card
            key={u.id}
            className="grid gap-5 rounded-none border-0 border-b bg-transparent py-6 ring-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
          >
            <CardHeader className="min-w-0 px-0">
              <CardTitle className="break-words text-base">
                {u.displayName}{' '}
                <span className="font-mono text-xs text-muted-foreground">
                  {u.id}
                </span>
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
              {canWrite ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor={`name-${u.id}`} className="w-full">
                    이름
                  </Label>
                  <Input
                    id={`name-${u.id}`}
                    value={editing[u.id]?.displayName ?? u.displayName}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [u.id]: {
                          email: prev[u.id]?.email ?? u.email,
                          displayName: e.target.value,
                        },
                      }))
                    }
                    className="min-w-0 flex-1 basis-40"
                  />
                  <Label htmlFor={`email-${u.id}`} className="w-full">
                    이메일
                  </Label>
                  <Input
                    id={`email-${u.id}`}
                    type="email"
                    value={editing[u.id]?.email ?? u.email}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [u.id]: {
                          email: e.target.value,
                          displayName: prev[u.id]?.displayName ?? u.displayName,
                        },
                      }))
                    }
                    className="min-w-0 flex-1 basis-40"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await updateUser(
                          u.id,
                          editing[u.id] ?? {
                            email: u.email,
                            displayName: u.displayName,
                          },
                        );
                        setEditing((prev) => {
                          const next = { ...prev };
                          delete next[u.id];
                          return next;
                        });
                        setError('');
                        refresh();
                      } catch (err) {
                        setError(
                          err instanceof AdminApiError
                            ? err.message
                            : '사용자 수정에 실패했습니다.',
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    변경 저장
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm(`"${u.id}" 사용자를 삭제할까요?`))
                        return;
                      setBusy(true);
                      try {
                        await deleteUser(u.id);
                        setError('');
                        refresh();
                      } catch (err) {
                        setError(
                          err instanceof AdminApiError
                            ? err.message
                            : '사용자 삭제에 실패했습니다.',
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    삭제
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
    <AdminGuard required={PermissionFlags.UserRead}>
      <UsersPage />
    </AdminGuard>
  );
}
