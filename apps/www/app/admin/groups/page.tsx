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
import {
  AdminApiError,
  addGroupMember,
  createGroup,
  deleteGroup,
  listGroups,
  removeGroupMember,
  type AdminGroup,
} from '@/lib/admin';

function GroupsPage() {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [newName, setNewName] = useState('');
  const [memberDrafts, setMemberDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    listGroups()
      .then((list) => {
        if (!cancelled) setGroups(list);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof AdminApiError ? err.message : '그룹을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="min-w-0">
          <CardTitle className="text-base">새 그룹</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <Label htmlFor="new-group-name" className="w-full">
            그룹 이름
          </Label>
          <Input
            id="new-group-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="그룹 이름"
            className="max-w-xs"
          />
          <Button
            size="sm"
            onClick={async () => {
              if (!newName.trim()) return;
              try {
                await createGroup(newName.trim());
                setNewName('');
                setError('');
                refresh();
              } catch {
                setError('그룹 생성에 실패했습니다.');
              }
            }}
          >
            만들기
          </Button>
        </CardContent>
      </Card>
      {groups.map((g) => (
        <Card
          key={g.id}
          className="grid gap-5 rounded-none border-0 border-b bg-transparent py-6 ring-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
        >
          <CardHeader className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {g.displayName}
              <Badge variant="outline">#{g.id}</Badge>
              <Badge variant="outline">{g.members.length}명</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5">
              {g.members.map((m) => (
                <span
                  key={m}
                  className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm"
                >
                  {m}
                  <button
                    type="button"
                    aria-label={`${m} 제거`}
                    className="flex size-11 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={async () => {
                      try {
                        await removeGroupMember(g.id, m);
                        setError('');
                        refresh();
                      } catch {
                        setError('멤버 제거에 실패했습니다.');
                      }
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`member-${g.id}`}>멤버 추가 (uid)</Label>
                <Input
                  id={`member-${g.id}`}
                  value={memberDrafts[g.id] ?? ''}
                  onChange={(e) => setMemberDrafts((prev) => ({ ...prev, [g.id]: e.target.value }))}
                  className="max-w-xs"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="self-end"
                onClick={async () => {
                  const uid = (memberDrafts[g.id] ?? '').trim();
                  if (!uid) return;
                  try {
                    await addGroupMember(g.id, uid);
                    setMemberDrafts((prev) => ({ ...prev, [g.id]: '' }));
                    setError('');
                    refresh();
                  } catch {
                    setError('멤버 추가에 실패했습니다.');
                  }
                }}
              >
                추가
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="self-end"
                onClick={async () => {
                  if (!window.confirm(`"${g.displayName}" 그룹을 삭제할까요?`)) return;
                  try {
                    await deleteGroup(g.id);
                    setError('');
                    refresh();
                  } catch {
                    setError('그룹 삭제에 실패했습니다. (어드민 그룹은 보호됩니다)');
                  }
                }}
              >
                그룹 삭제
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <AdminGuard required={PermissionFlags.GroupRead}>
      <GroupsPage />
    </AdminGuard>
  );
}
