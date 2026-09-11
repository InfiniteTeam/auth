'use client';

import { useCallback, useEffect, useState } from 'react';
import { PermissionFlags, hasPermissions } from '@inftkr/auth-core';
import { useSession } from '@inftkr/auth-core/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { AdminGuard } from '@/components/admin-guard';
import {
  AdminApiError,
  createClient,
  deleteClient,
  listClients,
  rotateClientSecret,
  updateClient,
  type AdminOidcClient,
  type CreateOidcClientResult,
} from '@/lib/admin';
import { BACKEND_URL } from '@/lib/auth';

function SecretBox({ result }: { result: CreateOidcClientResult }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Alert>
        <AlertTitle>새 시크릿이 발급되었습니다</AlertTitle>
        <AlertDescription>지금 한 번만 표시됩니다. 안전한 곳에 저장해 주세요.</AlertDescription>
      </Alert>
      <div className="code-box">{result.clientSecret}</div>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(result.clientSecret);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? '복사됨' : '시크릿 복사'}
      </Button>
    </div>
  );
}

function ClientCard({
  client,
  canEdit,
  canDelete,
  onChanged,
  onSecret,
  onError,
}: {
  client: AdminOidcClient;
  canEdit: boolean;
  canDelete: boolean;
  onChanged: () => void;
  onSecret: (result: CreateOidcClientResult) => void;
  onError: (message: string) => void;
}) {
  const [uris, setUris] = useState(client.redirectUris.join('\n'));
  const [pending, setPending] = useState(false);

  const onRotate = useCallback(async () => {
    if (!window.confirm(`"${client.clientName ?? client.clientId}"의 시크릿을 회전할까요? 기존 시크릿은 즉시 무효화됩니다.`)) {
      return;
    }
    setPending(true);
    try {
      onSecret(await rotateClientSecret(client.clientId));
      onError('');
    } catch {
      onError('시크릿 회전 중 문제가 발생했습니다.');
    } finally {
      setPending(false);
    }
  }, [client, onError, onSecret]);

  const onSaveUris = useCallback(async () => {
    const list = uris
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (list.length === 0 || !list.every((u) => /^https?:\/\/.+/.test(u))) {
      onError('올바른 리다이렉트 URI를 최소 한 개 입력해 주세요.');
      return;
    }
    setPending(true);
    try {
      await updateClient(client.clientId, { redirectUris: list });
      onError('');
      onChanged();
    } catch {
      onError('클라이언트 수정 중 문제가 발생했습니다.');
    } finally {
      setPending(false);
    }
  }, [client.clientId, onChanged, onError, uris]);

  const onDelete = useCallback(async () => {
    if (!window.confirm(`"${client.clientName ?? client.clientId}" 클라이언트를 삭제할까요?`)) {
      return;
    }
    setPending(true);
    try {
      await deleteClient(client.clientId);
      onError('');
      onChanged();
    } catch (err) {
      onError(
        err instanceof AdminApiError && err.statusCode === 400
          ? '내장 클라이언트는 삭제할 수 없습니다.'
          : '클라이언트 삭제 중 문제가 발생했습니다.',
      );
    } finally {
      setPending(false);
    }
  }, [client, onChanged, onError]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {client.clientName ?? client.clientId}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{client.clientId}</code>
        </CardTitle>
        <CardDescription>인증 방식 · {client.tokenEndpointAuthMethod}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {client.scopes.map((scope) => (
            <Badge key={scope} variant="outline">
              {scope}
            </Badge>
          ))}
        </div>
        {canEdit ? (
          <div className="flex flex-col gap-2">
            <Label>리다이렉트 URI (한 줄에 하나씩)</Label>
            <Textarea value={uris} onChange={(e) => setUris(e.target.value)} rows={3} />
          </div>
        ) : (
          <ul className="space-y-0.5">
            {client.redirectUris.map((uri) => (
              <li key={uri} className="break-all font-mono text-xs text-muted-foreground">
                {uri}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {canEdit || canDelete ? (
        <CardFooter className="flex flex-wrap gap-2">
          {canEdit ? (
            <>
              <Button size="sm" variant="outline" disabled={pending} onClick={onSaveUris}>
                URI 저장
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={onRotate}>
                시크릿 회전
              </Button>
            </>
          ) : null}
          {canDelete ? (
            <Button size="sm" variant="destructive" disabled={pending} onClick={onDelete}>
              삭제
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}

function CreateCard({ onCreated, onError }: { onCreated: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [uris, setUris] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 OIDC 클라이언트</CardTitle>
        <CardDescription>리다이렉트 URI는 한 줄에 하나씩 입력해 주세요.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-client-name">클라이언트 이름</Label>
          <Input id="new-client-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-redirect-uris">리다이렉트 URI</Label>
          <Textarea id="new-redirect-uris" value={uris} onChange={(e) => setUris(e.target.value)} rows={3} />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          disabled={pending}
          onClick={async () => {
            const list = uris
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean);
            if (list.length === 0) {
              onError('리다이렉트 URI를 입력해 주세요.');
              return;
            }
            setPending(true);
            try {
              await createClient({ clientName: name.trim() || undefined, redirectUris: list });
              setName('');
              setUris('');
              onError('');
              onCreated();
            } catch {
              onError('클라이언트 생성 중 문제가 발생했습니다.');
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? '생성 중…' : '클라이언트 만들기'}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ClientsPage() {
  const { session } = useSession({ baseUrl: BACKEND_URL });
  const [clients, setClients] = useState<AdminOidcClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState<CreateOidcClientResult | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const canEdit = Boolean(session && hasPermissions(session.user.permissions, PermissionFlags.OidcClientCreate));
  const canDelete = Boolean(session && hasPermissions(session.user.permissions, PermissionFlags.OidcClientDelete));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listClients()
      .then((list) => {
        if (!cancelled) setClients(list);
      })
      .catch(() => {
        if (!cancelled) setError('클라이언트 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {secret ? <SecretBox result={secret} /> : null}
      {canEdit ? (
        <div>
          <Button variant="outline" size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? '새 클라이언트 접기' : '새 클라이언트 만들기'}
          </Button>
        </div>
      ) : null}
      {showCreate ? <CreateCard onCreated={() => { setShowCreate(false); refresh(); }} onError={setError} /> : null}
      <Separator />
      {loading ? (
        <div className="flow-loading" role="status">
          <span className="spinner" />
          클라이언트 목록을 불러오는 중입니다.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {clients.map((c) => (
            <ClientCard key={c.clientId} client={c} canEdit={canEdit} canDelete={canDelete} onChanged={refresh} onSecret={setSecret} onError={setError} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <AdminGuard required={PermissionFlags.OidcClientRead}>
      <ClientsPage />
    </AdminGuard>
  );
}
