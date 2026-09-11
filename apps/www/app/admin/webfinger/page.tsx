'use client';

import { useEffect, useState } from 'react';
import { PermissionFlags } from '@inftkr/auth-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminGuard } from '@/components/admin-guard';
import { AdminApiError, getAdminMeta, type AdminMeta } from '@/lib/admin';

function WebFingerPage() {
  const [meta, setMeta] = useState<AdminMeta | null>(null);
  const [resource, setResource] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getAdminMeta()
      .then((m) => {
        if (!cancelled) {
          setMeta(m);
          setResource(`acct:user@${m.rootDomain}`);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof AdminApiError ? err.message : '메타 정보를 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const descriptorUrl =
    meta && resource ? `${meta.issuerUrl}/.well-known/webfinger?resource=${encodeURIComponent(resource)}` : '';

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>WebFinger 디스커버리</CardTitle>
          <CardDescription>
            WebFinger에는 자격증명이 없습니다. 루트 도메인의 리소스가 OIDC 발급자로 해석되는지 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {meta ? (
            <>
              <p className="break-all">
                Issuer · <code>{meta.issuerUrl}</code>
              </p>
              <p className="break-all">
                Root · <code>{meta.rootDomain}</code>
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wf-resource">리소스 (acct: URI)</Label>
                <Input id="wf-resource" value={resource} onChange={(e) => setResource(e.target.value)} />
              </div>
              {descriptorUrl ? (
                <p className="break-all font-mono text-xs text-muted-foreground">{descriptorUrl}</p>
              ) : null}
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!descriptorUrl}
                  onClick={() => window.open(descriptorUrl, '_blank', 'noopener')}
                >
                  기술문서 열기
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">불러오는 중…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <AdminGuard required={PermissionFlags.SettingsRead}>
      <WebFingerPage />
    </AdminGuard>
  );
}
