'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { PermissionFlags, hasPermissions, type Session } from '@inftkr/auth-core';
import { useSession, useSignIn, useSignOut } from '@inftkr/auth-core/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AuthShell } from '@/components/AuthShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AdminApiError,
  type AdminOidcClient,
  type CreateOidcClientResult,
  createClient,
  deleteClient,
  listClients,
} from '@/lib/admin';
import { BACKEND_URL } from '@/lib/auth';

const GRANT_TYPES = ['authorization_code', 'refresh_token', 'implicit', 'client_credentials'] as const;
const RESPONSE_TYPES = ['code', 'id_token', 'id_token token'] as const;
const SCOPE_OPTIONS = ['openid', 'profile', 'email', 'offline_access'] as const;
const AUTH_METHODS = ['client_secret_post', 'client_secret_basic', 'none'] as const;

type Tab = 'account' | 'clients';

function urlsValid(uris: string[]): boolean {
  // Lightweight check; the backend validates with a stricter URL rule.
  return uris.every((uri) => /^https?:\/\/.+/.test(uri));
}

function ToggleGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: readonly string[];
  selected: ReadonlySet<string>;
  onToggle: (value: string, checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{title}</span>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <span key={option} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={selected.has(option)}
              onCheckedChange={(checked) => onToggle(option, Boolean(checked))}
            />
            {option}
          </span>
        ))}
      </div>
    </div>
  );
}

const LINKABLE_PROVIDERS = [
  { id: 'github', label: 'GitHub' },
  { id: 'discord', label: 'Discord' },
] as const;

type LinkableProviderId = (typeof LINKABLE_PROVIDERS)[number]['id'];

function SocialConnect() {
  const { signInSocial, isLoading } = useSignIn(BACKEND_URL);
  const { session } = useSession({ baseUrl: BACKEND_URL });
  const [pending, setPending] = useState<LinkableProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const providers = session
    ? LINKABLE_PROVIDERS.filter((provider) => provider.id !== session.user.provider)
    : LINKABLE_PROVIDERS;

  const onConnect = useCallback(
    async (provider: LinkableProviderId) => {
      setError(null);
      setPending(provider);
      try {
        await signInSocial(provider);
      } catch {
        setError('소셜 계정 연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        setPending(null);
      }
    },
    [signInSocial],
  );

  return (
    <div className="profile-card flex flex-col gap-3">
      <div>
        <p>소셜 계정 연결</p>
        <p className="mt-1">다른 소셜 계정을 연결하면 그 계정으로도 로그인할 수 있습니다.</p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            variant="outline"
            size="sm"
            disabled={isLoading || !!pending}
            onClick={() => onConnect(provider.id)}
          >
            {pending === provider.id ? '연결 중…' : `${provider.label} 연결`}
          </Button>
        ))}
      </div>
    </div>
  );
}

function AccountTab({
  session,
  signingOut,
  onSignOut,
}: {
  session: Session;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="profile-card">
        <p>로그인 계정</p>
        <strong>{session.user.email}</strong>
        <p className="mt-1">{session.user.name || session.user.userId}</p>
        <div className="profile-meta">
          {session.user.provider} · {session.user.roles.join(', ') || 'user'}
        </div>
      </div>
      <SocialConnect />
      <Button size="lg" variant="destructive" disabled={signingOut} onClick={onSignOut}>
        {signingOut ? '로그아웃 중…' : '로그아웃'}
      </Button>
    </div>
  );
}

function ClientCreateForm({
  onCreated,
  onError,
}: {
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const [clientName, setClientName] = useState('');
  const [redirectUris, setRedirectUris] = useState('');
  const [authMethod, setAuthMethod] = useState<string>('client_secret_post');
  const [grants, setGrants] = useState<Set<string>>(() => new Set(['authorization_code']));
  const [responses, setResponses] = useState<Set<string>>(() => new Set(['code']));
  const [scopes, setScopes] = useState<Set<string>>(() => new Set(['openid', 'profile', 'email']));
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<CreateOidcClientResult | null>(null);
  const [copied, setCopied] = useState(false);

  const toggle = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
      (value: string, checked: boolean) =>
        setter((prev) => {
          const next = new Set(prev);
          if (checked) {
            next.add(value);
          } else {
            next.delete(value);
          }
          return next;
        }),
    [],
  );

  const onSubmit = useCallback(async () => {
    const uris = redirectUris
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (uris.length === 0 || !urlsValid(uris)) {
      onError('올바른 리다이렉트 URI를 최소 한 개 입력해 주세요. (한 줄에 하나씩)');
      return;
    }
    onError('');
    setPending(true);
    try {
      const result = await createClient({
        clientName: clientName.trim() || undefined,
        redirectUris: uris,
        grantTypes: [...grants],
        responseTypes: [...responses],
        scopes: [...scopes],
        tokenEndpointAuthMethod: authMethod,
      });
      setCreated(result);
      setClientName('');
      setRedirectUris('');
      onCreated();
    } catch (err) {
      onError(
        err instanceof AdminApiError
          ? err.statusCode === 401 || err.statusCode === 403
            ? '이 작업을 수행할 권한이 없습니다.'
            : err.message
          : '클라이언트 생성 중 문제가 발생했습니다.',
      );
    } finally {
      setPending(false);
    }
  }, [authMethod, clientName, grants, onCreated, onError, redirectUris, responses, scopes]);

  const onCopy = useCallback(async () => {
    if (!created) {
      return;
    }
    await navigator.clipboard.writeText(created.clientSecret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [created]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 OIDC 클라이언트</CardTitle>
        <CardDescription>리다이렉트 URI는 한 줄에 하나씩 입력해 주세요.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="client-name">클라이언트 이름</Label>
          <Input
            id="client-name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="예: Tailscale"
            className="h-10"
            maxLength={64}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="redirect-uris">리다이렉트 URI</Label>
          <Textarea
            id="redirect-uris"
            value={redirectUris}
            onChange={(e) => setRedirectUris(e.target.value)}
            placeholder={'https://login.tailscale.com/a/oauth_response'}
            rows={3}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>토큰 엔드포인트 인증 방식</Label>
          <Select value={authMethod} onValueChange={(value) => setAuthMethod(value ?? 'client_secret_post')}>
            <SelectTrigger size="default" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTH_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ToggleGroup
          title="권한 부여 유형"
          options={GRANT_TYPES}
          selected={grants}
          onToggle={toggle(setGrants)}
        />
        <ToggleGroup
          title="응답 유형"
          options={RESPONSE_TYPES}
          selected={responses}
          onToggle={toggle(setResponses)}
        />
        <ToggleGroup
          title="스코프"
          options={SCOPE_OPTIONS}
          selected={scopes}
          onToggle={toggle(setScopes)}
        />
        {created ? (
          <div className="flex flex-col gap-2">
            <Alert>
              <AlertTitle>클라이언트가 생성되었습니다</AlertTitle>
              <AlertDescription>
                이 비밀번호는 지금 한 번만 표시됩니다. 안전한 곳에 저장해 주세요.
              </AlertDescription>
            </Alert>
            <div className="code-box">{created.clientSecret}</div>
            <Button variant="outline" size="sm" onClick={onCopy}>
              {copied ? '복사됨' : '비밀번호 복사'}
            </Button>
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button size="lg" className="w-full" disabled={pending} onClick={onSubmit}>
          {pending ? '생성 중…' : '클라이언트 만들기'}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ClientItem({
  client,
  canDelete,
  onDeleted,
  onError,
}: {
  client: AdminOidcClient;
  canDelete: boolean;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);

  const onDelete = useCallback(async () => {
    if (!window.confirm(`"${client.clientName ?? client.clientId}" 클라이언트를 삭제할까요?`)) {
      return;
    }
    setPending(true);
    try {
      await deleteClient(client.clientId);
      onError('');
      onDeleted();
    } catch (err) {
      onError(
        err instanceof AdminApiError
          ? err.statusCode === 400
            ? '내장 클라이언트는 삭제할 수 없습니다.'
            : err.statusCode === 401 || err.statusCode === 403
              ? '이 작업을 수행할 권한이 없습니다.'
              : err.message
          : '클라이언트 삭제 중 문제가 발생했습니다.',
      );
    } finally {
      setPending(false);
    }
  }, [client, onDeleted, onError]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {client.clientName ?? client.clientId}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {client.clientId}
          </code>
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
        <ul className="space-y-0.5">
          {client.redirectUris.map((uri) => (
            <li key={uri} className="break-all font-mono text-xs text-muted-foreground">
              {uri}
            </li>
          ))}
        </ul>
      </CardContent>
      {canDelete ? (
        <CardFooter>
          <Button variant="destructive" size="sm" disabled={pending} onClick={onDelete}>
            {pending ? '삭제 중…' : '삭제'}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function ClientsTab({ canCreate, canDelete }: { canCreate: boolean; canDelete: boolean }) {
  const [clients, setClients] = useState<AdminOidcClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listClients()
      .then((list) => {
        if (!cancelled) {
          setClients(list);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.statusCode === 401 || err.statusCode === 403
                ? '이 목록을 조회할 권한이 없습니다.'
                : err.message
              : '클라이언트 목록을 불러오지 못했습니다.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <div className="mt-6 flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {canCreate ? (
        <div>
          <Button variant="outline" size="sm" onClick={() => setExpanded((value) => !value)}>
            {expanded ? '새 클라이언트 접기' : '새 클라이언트 만들기'}
          </Button>
        </div>
      ) : null}

      {expanded ? (
        <ClientCreateForm
          onCreated={() => {
            setExpanded(false);
            refresh();
          }}
          onError={setError}
        />
      ) : null}

      <Separator />

      {loading ? (
        <div className="flow-loading" role="status">
          <span className="spinner" />
          클라이언트 목록을 불러오는 중입니다.
        </div>
      ) : clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 OIDC 클라이언트가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {clients.map((client) => (
            <ClientItem
              key={client.clientId}
              client={client}
              canDelete={canDelete}
              onDeleted={refresh}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectedNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get('social') !== 'connected') {
    return null;
  }
  return (
    <Alert className="mb-4">
      <AlertTitle>연결 완료</AlertTitle>
      <AlertDescription>소셜 계정이 성공적으로 연결되었습니다.</AlertDescription>
    </Alert>
  );
}

function SettingsPage() {
  const { session, isLoading } = useSession({ baseUrl: BACKEND_URL });
  const { signOut } = useSignOut(BACKEND_URL);
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [signingOut, setSigningOut] = useState(false);

  const canReadClients = useMemo(
    () => Boolean(session && hasPermissions(session.user.permissions, PermissionFlags.OidcClientRead)),
    [session],
  );
  const canCreateClients = useMemo(
    () => Boolean(session && hasPermissions(session.user.permissions, PermissionFlags.OidcClientCreate)),
    [session],
  );
  const canDeleteClients = useMemo(
    () => Boolean(session && hasPermissions(session.user.permissions, PermissionFlags.OidcClientDelete)),
    [session],
  );

  const onSignOut = useCallback(() => {
    setSigningOut(true);
    signOut()
      .catch(() => {})
      .finally(() => {
        window.location.href = '/';
      });
  }, [signOut]);

  if (isLoading) {
    return (
      <AuthShell requestLabel="계정 관리" requestName="보안 및 프로필 설정" wide>
        <div className="flow-loading" role="status">
          <span className="spinner" />
          계정 정보를 불러오는 중입니다.
        </div>
      </AuthShell>
    );
  }

  if (!session) {
    return (
      <AuthShell requestLabel="계정 관리" requestName="보안 및 프로필 설정" wide>
        <div className="card-heading">
          <p>인증 필요</p>
          <h1>로그인이 필요합니다</h1>
          <span>계정 설정을 이용하려면 먼저 로그인해 주세요.</span>
        </div>
        <div className="inline-actions">
          <Button size="lg" render={<Link href="/login" />}>
            로그인
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell requestLabel="계정 관리" requestName="보안 및 프로필 설정" wide>
      <div className="card-heading">
        <p>내 계정</p>
        <h1>계정 설정</h1>
        <span>프로필과 OIDC 클라이언트 접근 권한을 관리하세요.</span>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="계정 설정">
        <Button
          variant={activeTab === 'account' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('account')}
        >
          계정
        </Button>
        {canReadClients ? (
          <Button
            variant={activeTab === 'clients' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('clients')}
          >
            OIDC 클라이언트
          </Button>
        ) : null}
      </div>

      <ConnectedNotice />

      {activeTab === 'account' ? (
        <AccountTab session={session} signingOut={signingOut} onSignOut={onSignOut} />
      ) : (
        <ClientsTab canCreate={canCreateClients} canDelete={canDeleteClients} />
      )}

      <p className="account-note">
        <Link href="/">계정 홈으로 돌아가기</Link>
      </p>
    </AuthShell>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <AuthShell requestLabel="계정 관리" requestName="보안 및 프로필 설정" wide>
          <div className="flow-loading" role="status">
            <span className="spinner" />
            계정 정보를 불러오는 중입니다.
          </div>
        </AuthShell>
      }
    >
      <SettingsPage />
    </Suspense>
  );
}