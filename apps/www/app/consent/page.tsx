import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "권한 요청 · Infinite Studio SSO",
};

type PageProps = {
  searchParams: Promise<{
    client_name?: string;
    scope?: string;
    redirect_url?: string;
  }>;
};

const SCOPE_LABELS: Record<string, string> = {
  openid: "로그인 식별자 확인",
  profile: "프로필 정보 (이름, 사용자 이름)",
  email: "이메일 주소",
  offline_access: "오프라인 접근 (자동 로그인 유지)",
};

/**
 * Builds the backend interaction URL carrying the user's decision. Only
 * same-origin relative targets are accepted; anything else falls back to the
 * account home so this page can never become an open redirector.
 */
function decisionUrl(
  redirectUrl: string | undefined,
  decision: "allow" | "deny",
): string {
  if (!redirectUrl || !redirectUrl.startsWith("/")) {
    return "/";
  }
  const separator = redirectUrl.includes("?") ? "&" : "?";
  return `${redirectUrl}${separator}decision=${decision}`;
}

export default async function ConsentPage({ searchParams }: PageProps) {
  const {
    client_name: clientName = "연결 서비스",
    scope = "",
    redirect_url: redirectUrl,
  } = await searchParams;
  const scopes = scope.split(/\s+/).filter(Boolean);

  return (
    <AuthShell requestLabel="권한 요청" requestName={clientName}>
      <div className="card-heading">
        <p>권한 확인</p>
        <h1>{clientName} 연결</h1>
        <span>
          {clientName}에서 다음 정보를 요청합니다. 동의하면 연결이 계속됩니다.
        </span>
      </div>
      {redirectUrl && redirectUrl.startsWith("/") ? (
        <>
          <div className="messages">
            {scopes.length > 0 ? (
              scopes.map((item) => (
                <p key={item} className="message message-info">
                  {SCOPE_LABELS[item] ?? `추가 권한: ${item}`}
                </p>
              ))
            ) : (
              <p className="message message-info">
                기본 로그인 정보만 요청합니다.
              </p>
            )}
          </div>
          <div className="inline-actions">
            <Button
              size="lg"
              variant="outline"
              render={<Link href={decisionUrl(redirectUrl, "deny")} />}
            >
              거부
            </Button>
            <Button
              size="lg"
              render={<Link href={decisionUrl(redirectUrl, "allow")} />}
            >
              동의하고 연결
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="messages">
            <p className="message message-info">
              권한 심사 요청이 올바르지 않습니다. 처음부터 다시 시도해 주세요.
            </p>
          </div>
          <div className="inline-actions">
            <Button size="lg" variant="outline" render={<Link href="/" />}>
              계정 홈으로 돌아가기
            </Button>
          </div>
        </>
      )}
    </AuthShell>
  );
}
