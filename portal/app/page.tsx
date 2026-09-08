import Link from 'next/link';
import { fetchLogoutUrl, fetchSession } from '@/lib/server/kratos';
import { AuthShell } from '@/components/AuthShell';

export default async function HomePage() {
  const session = await fetchSession();

  if (!session) {
    return (
      <AuthShell requestLabel="INFINITE STUDIO IDENTITY" requestName="통합 인증 포털">
        <div className="card-heading">
          <p>계정으로 계속하기</p>
          <h1>Infinite Studio에 오신 것을 환영합니다</h1>
          <span>로그인하면 연결된 서비스와 계정 설정을 안전하게 이용할 수 있습니다.</span>
        </div>
        <div className="inline-actions">
          <Link className="btn btn-primary" href="/login">로그인</Link>
          <Link className="btn btn-outline" href="/registration">계정 만들기</Link>
        </div>
      </AuthShell>
    );
  }

  const identity = session.identity;
  const logoutUrl = await fetchLogoutUrl();

  return (
    <AuthShell requestLabel="로그인됨" requestName="Infinite Studio 계정">
      <div className="card-heading">
        <p>계정 홈</p>
        <h1>안녕하세요</h1>
        <span>현재 안전하게 로그인되어 있습니다.</span>
      </div>
      <div className="profile-card">
        <p>로그인 계정</p>
        <strong>{identity.traits.email}</strong>
        <div className="profile-meta">권한 · {identity.traits.role || 'user'}</div>
      </div>
      <div className="inline-actions">
        <Link className="btn btn-primary" href="/settings">계정 설정</Link>
        {logoutUrl ? <a className="btn btn-danger" href={logoutUrl}>로그아웃</a> : null}
      </div>
    </AuthShell>
  );
}
