'use client';

import { useCallback, useEffect, useState } from 'react';
import { PermissionFlags, hasPermissions } from '@inftkr/auth-core';
import { useSession } from '@inftkr/auth-core/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminGuard } from '@/components/admin-guard';
import { BACKEND_URL } from '@/lib/auth';
import {
  AdminApiError,
  addGroupMember,
  createGroup,
  deleteGroup,
  listGroups,
  removeGroupMember,
  updateGroup,
  type AdminGroup,
} from '@/lib/admin';

const permissionLabels: Record<keyof typeof PermissionFlags, string> = {
  OidcClientRead: 'OIDC 클라이언트 보기',
  OidcClientCreate: 'OIDC 클라이언트 만들기·수정',
  OidcClientDelete: 'OIDC 클라이언트 삭제',
  UserRead: '사용자 보기',
  UserWrite: '사용자 관리',
  GroupRead: '그룹 보기',
  GroupWrite: '그룹 관리',
  SessionRead: '세션 보기',
  SessionRevoke: '세션 취소',
  SettingsRead: '설정 보기',
  SettingsWrite: '설정 관리',
};

function GroupEditor({
  group,
  canEdit,
  onSaved,
  onError,
}: {
  group: AdminGroup;
  canEdit: boolean;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(group.displayName);
  const [priority, setPriority] = useState(String(group.priority));
  const [permissions, setPermissions] = useState(BigInt(group.permissions));
  const [nameEdited, setNameEdited] = useState(false);
  const [priorityEdited, setPriorityEdited] = useState(false);
  const [permissionsEdited, setPermissionsEdited] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!nameEdited) setName(group.displayName);
  }, [group.displayName, nameEdited]);
  useEffect(() => {
    if (!priorityEdited) setPriority(String(group.priority));
  }, [group.priority, priorityEdited]);
  useEffect(() => {
    if (!permissionsEdited) setPermissions(BigInt(group.permissions));
  }, [group.permissions, permissionsEdited]);

  if (group.isPlatformAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        플랫폼 관리자 그룹은 전체 권한을 가지며 수정할 수 없습니다.
      </p>
    );
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground">
        우선순위 {group.priority} · 권한{' '}
        {Object.entries(permissionLabels)
          .filter(
            ([name]) =>
              (BigInt(group.permissions) &
                PermissionFlags[name as keyof typeof PermissionFlags]) !==
              0n,
          )
          .map(([, label]) => label)
          .join(', ') || '없음'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`group-name-${group.id}`}>그룹 이름</Label>
          <Input
            id={`group-name-${group.id}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameEdited(true);
            }}
            maxLength={64}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`group-priority-${group.id}`}>우선순위</Label>
          <Input
            id={`group-priority-${group.id}`}
            type="number"
            min={0}
            max={1000}
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPriorityEdited(true);
            }}
            className="w-28"
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        숫자가 큰 그룹의 권한을 적용합니다. 같은 우선순위의 권한은 합칩니다.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          Object.entries(PermissionFlags) as [
            keyof typeof PermissionFlags,
            bigint,
          ][]
        ).map(([name, flag]) => (
          <Label key={name} className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={(permissions & flag) === flag}
              onCheckedChange={(checked) => {
                setPermissions((current) =>
                  checked ? current | flag : current & ~flag,
                );
                setPermissionsEdited(true);
              }}
            />
            {permissionLabels[name]}
          </Label>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={
          pending ||
          !(nameEdited || priorityEdited || permissionsEdited) ||
          !name.trim() ||
          !priority.trim() ||
          !Number.isInteger(Number(priority)) ||
          Number(priority) < 0 ||
          Number(priority) > 1000
        }
        onClick={async () => {
          setPending(true);
          try {
            await updateGroup(group.id, {
              ...(nameEdited ? { displayName: name.trim() } : {}),
              ...(priorityEdited ? { priority: Number(priority) } : {}),
              ...(permissionsEdited
                ? { permissions: permissions.toString() }
                : {}),
            });
            setNameEdited(false);
            setPriorityEdited(false);
            setPermissionsEdited(false);
            onError('');
            onSaved();
          } catch (error) {
            onError(
              error instanceof AdminApiError
                ? error.message
                : '그룹 수정에 실패했습니다.',
            );
          } finally {
            setPending(false);
          }
        }}
      >
        변경 저장
      </Button>
    </div>
  );
}

function GroupsPage() {
  const { session } = useSession({ baseUrl: BACKEND_URL });
  const canEdit = Boolean(
    session &&
    hasPermissions(session.user.permissions, PermissionFlags.GroupWrite),
  );
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
          setError(
            err instanceof AdminApiError
              ? err.message
              : '그룹을 불러오지 못했습니다.',
          );
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
      {canEdit ? (
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
      ) : null}
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
            <GroupEditor
              group={g}
              canEdit={canEdit}
              onSaved={refresh}
              onError={setError}
            />
            <div className="flex flex-wrap gap-1.5">
              {g.members.map((m) => (
                <span
                  key={m}
                  className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm"
                >
                  {m}
                  {canEdit ? (
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
                  ) : null}
                </span>
              ))}
            </div>
            {canEdit ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`member-${g.id}`}>멤버 추가 (uid)</Label>
                  <Input
                    id={`member-${g.id}`}
                    value={memberDrafts[g.id] ?? ''}
                    onChange={(e) =>
                      setMemberDrafts((prev) => ({
                        ...prev,
                        [g.id]: e.target.value,
                      }))
                    }
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
                {!g.isPlatformAdmin ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="self-end"
                    onClick={async () => {
                      if (
                        !window.confirm(`"${g.displayName}" 그룹을 삭제할까요?`)
                      )
                        return;
                      try {
                        await deleteGroup(g.id);
                        setError('');
                        refresh();
                      } catch {
                        setError(
                          '그룹 삭제에 실패했습니다. (어드민 그룹은 보호됩니다)',
                        );
                      }
                    }}
                  >
                    그룹 삭제
                  </Button>
                ) : null}
              </div>
            ) : null}
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
