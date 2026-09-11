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
import { AdminApiError, getAdminMeta, listSettings, setSetting, type AdminSetting } from '@/lib/admin';

function secretDisplay(s: AdminSetting): string {
  if (!s.secret) return String(s.value ?? '');
  return s.configured ? '•••••••• (설정됨)' : '(미설정)';
}

function SettingRow({ setting, onChanged }: { setting: AdminSetting; onChanged: () => void }) {
  const [draft, setDraft] = useState(setting.secret ? '' : String(setting.value ?? ''));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  const save = useCallback(async () => {
    let value: unknown = draft;
    if (!setting.secret && setting.key.endsWith('roleIds')) {
      value = draft
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    if (!setting.secret && setting.key.endsWith('enabled')) {
      value = draft === 'true';
    }
    if (!setting.secret && setting.key.endsWith('port')) {
      value = Number(draft);
    }
    setPending(true);
    try {
      await setSetting(setting.key, value === '' ? null : value);
      setMessage('저장됨');
      onChanged();
    } catch {
      setMessage('저장에 실패했습니다.');
    } finally {
      setPending(false);
    }
  }, [draft, onChanged, setting]);

  const reset = useCallback(async () => {
    setPending(true);
    try {
      await setSetting(setting.key, null);
      setDraft('');
      setMessage('환경 기본값으로 되돌림');
      onChanged();
    } catch {
      setMessage('되돌리기에 실패했습니다.');
    } finally {
      setPending(false);
    }
  }, [onChanged, setting.key]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {setting.label}
          <Badge variant="outline">{setting.source === 'override' ? '재정의' : '환경값'}</Badge>
          {setting.requiresRestart ? <Badge variant="destructive">재시작 필요</Badge> : null}
        </CardTitle>
        <CardDescription className="font-mono text-xs">{setting.key}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">현재값 · {secretDisplay(setting)}</p>
        <div className="flex flex-col gap-2">
          <Label>새 값 {setting.secret ? '(비워두면 변경 없음)' : null}</Label>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={setting.secret ? '새 시크릿 입력' : '새 값 입력'} />
        </div>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={save}>
          저장
        </Button>
        {setting.source === 'override' ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={reset}>
            환경값으로 되돌리기
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function ProvidersPage() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [meta, setMeta] = useState<{ githubCallbackUrl: string; discordCallbackUrl: string } | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listSettings(), getAdminMeta()])
      .then(([list, meta]) => {
        if (!cancelled) {
          setSettings(list.filter((s) => s.group === 'social'));
          setMeta(meta);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof AdminApiError ? err.message : '설정을 불러오지 못했습니다.');
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
      {meta ? (
        <Card>
          <CardHeader>
            <CardTitle>콜백 URL</CardTitle>
            <CardDescription>소셜 개발자 콘솔에 등록된 리다이렉트 URI와 일치해야 합니다.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 font-mono text-xs">
            <p className="break-all">GitHub · {meta.githubCallbackUrl}</p>
            <p className="break-all">Discord · {meta.discordCallbackUrl}</p>
          </CardContent>
        </Card>
      ) : null}
      {settings.map((s) => (
        <SettingRow key={s.key} setting={s} onChanged={refresh} />
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <AdminGuard required={PermissionFlags.SettingsRead}>
      <ProvidersPage />
    </AdminGuard>
  );
}
