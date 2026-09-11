'use client';

import { useCallback, useEffect, useState } from 'react';
import { PermissionFlags } from '@inftkr/auth-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminGuard } from '@/components/admin-guard';
import { AdminApiError, listSettings, setSetting, type AdminSetting } from '@/lib/admin';

const GROUP_TITLES: Record<string, string> = {
  social: '소셜 로그인',
  oidc: 'OIDC',
  smtp: '이메일 (SMTP)',
  domains: '도메인·정책',
};

function EnvRow({ setting, onChanged }: { setting: AdminSetting; onChanged: () => void }) {
  const [draft, setDraft] = useState(setting.secret ? '' : JSON.stringify(setting.value ?? null));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  const parse = useCallback(() => {
    if (setting.secret) return draft === '' ? undefined : draft;
    const trimmed = draft.trim();
    if (trimmed === '' || trimmed === 'null') return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }, [draft, setting.secret]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {setting.label}
          <Badge variant="outline">{setting.source === 'override' ? '재정의' : '환경값'}</Badge>
          {setting.requiresRestart ? <Badge variant="destructive">재시작 필요</Badge> : null}
          {setting.secret ? <Badge variant="outline">시크릿</Badge> : null}
        </CardTitle>
        <CardDescription className="font-mono text-xs">{setting.key}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          현재값 · {setting.secret ? (setting.configured ? '•••••••• (설정됨)' : '(미설정)') : JSON.stringify(setting.value)}
        </p>
        <Label>새 값 {setting.secret ? '(비워두면 변경 없음)' : '(JSON)'}</Label>
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={setting.secret ? '새 시크릿' : 'JSON 값'} />
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={async () => {
            const value = parse();
            if (value === undefined) {
              setMessage('입력된 값이 없습니다.');
              return;
            }
            setPending(true);
            try {
              await setSetting(setting.key, value);
              setMessage('저장됨');
              onChanged();
            } catch {
              setMessage('저장에 실패했습니다.');
            } finally {
              setPending(false);
            }
          }}
        >
          저장
        </Button>
        {setting.source === 'override' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await setSetting(setting.key, null);
                setDraft(setting.secret ? '' : 'null');
                setMessage('환경 기본값으로 되돌림');
                onChanged();
              } catch {
                setMessage('되돌리기에 실패했습니다.');
              } finally {
                setPending(false);
              }
            }}
          >
            되돌리기
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function EnvPage() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listSettings()
      .then((list) => {
        if (!cancelled) setSettings(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof AdminApiError ? err.message : '설정을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  const pendingRestart = settings.filter((s) => s.source === 'override' && s.requiresRestart);
  const groups = [...new Set(settings.map((s) => s.group))];

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {pendingRestart.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>재시작 필요 ({pendingRestart.length}건)</AlertTitle>
          <AlertDescription>
            아래 항목은 서버 재시작 후에 반영됩니다: {pendingRestart.map((s) => s.key).join(', ')}. 서버에 직접
            접속해 `cd deploy && docker compose up -d --build` 로 재부팅해 주세요.
          </AlertDescription>
        </Alert>
      ) : null}
      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{GROUP_TITLES[group] ?? group}</h2>
          {settings
            .filter((s) => s.group === group)
            .map((s) => (
              <EnvRow key={s.key} setting={s} onChanged={refresh} />
            ))}
        </section>
      ))}
      <Card>
        <CardHeader>
          <CardTitle>서버 재부팅 안내</CardTitle>
          <CardDescription>재시작 필요 항목은 어드민이 서버에 직접 접속해 재부팅합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="code-box">{'cd deploy\ndocker compose ps\ndocker compose up -d --build\ndocker compose logs -f backend'}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <AdminGuard required={PermissionFlags.SettingsRead}>
      <EnvPage />
    </AdminGuard>
  );
}
