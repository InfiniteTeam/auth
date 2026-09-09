import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  return (
    <AuthShell requestLabel="계정 만들기" requestName="Infinite Studio 계정">
      <div className="card-heading">
        <p>회원가입</p>
        <h1>계정 만들기</h1>
        <span>Infinite Studio 계정으로 모든 서비스를 더 편리하게 이용하세요.</span>
      </div>
      <div className="messages">
        <p className="message message-info">
          회원가입은 준비 중입니다. 시스템 관리팀의 초청을 통해서만 계정이 생성됩니다.
        </p>
      </div>
      <div className="inline-actions">
        <Button size="lg" variant="outline" render={<Link href="/login" />}>
          로그인으로 돌아가기
        </Button>
      </div>
    </AuthShell>
  );
}