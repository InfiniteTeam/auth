import Image from 'next/image';
import type { ReactNode } from 'react';

type AuthShellProps = {
  children: ReactNode;
  requestLabel?: string;
  requestName?: string;
  wide?: boolean;
};

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 11a3 3 0 0 1 3 3c0 2.8-.8 5.2-2.2 7" />
      <path d="M9 21c1.2-2 1.5-4.4 1.5-7a1.5 1.5 0 0 1 3 0c0 2.1-.3 4.1-1.1 5.9" />
      <path d="M6.8 19.5c.8-1.8 1.2-3.6 1.2-5.5a4 4 0 0 1 8 0c0 1.8-.2 3.5-.8 5" />
      <path d="M5 15v-1a7 7 0 0 1 14 0c0 1.2-.1 2.4-.3 3.5" />
      <path d="M7.2 7.4A7 7 0 0 1 18.5 10" />
    </svg>
  );
}

export function AuthShell({
  children,
  requestLabel = 'INFINITE STUDIO IDENTITY',
  requestName = '통합 인증 포털',
  wide = false,
}: AuthShellProps) {
  return (
    <main className="auth-shell">
      <header className="site-header">
        <a className="brand" href="https://inft.kr" aria-label="Infinite Studio 홈">
          <Image src="/logo.svg" alt="" width={32} height={32} priority />
          <span>Infinite Studio</span>
          <span className="brand-product">SSO</span>
        </a>
        <div className="secure-label">
          <ShieldIcon />
          안전한 연결
        </div>
      </header>

      <div className="auth-layout">
        <section className="brand-stage" aria-labelledby="brand-heading">
          <div className="stage-copy">
            <div className="eyebrow">✦ ONE ACCOUNT · EVERY SERVICE</div>
            <h1 id="brand-heading">
              하나의 계정으로,
              <br />
              <span>모든 서비스를.</span>
            </h1>
            <p>Infinite Studio의 서비스를 더 빠르고 안전하게 이용하세요. 한 번의 인증으로 연결이 이어집니다.</p>
          </div>
          <div className="identity-orbit" aria-hidden="true">
            <i />
            <i />
            <i />
            <div className="identity-core">
              <FingerprintIcon />
            </div>
            <div className="service-node node-one">
              <b>A</b>
              <span>Aztra</span>
              <em>✓</em>
            </div>
            <div className="service-node node-two">
              <b>S</b>
              <span>Status</span>
              <em>✓</em>
            </div>
          </div>
          <div className="trust-row">
            <ShieldIcon />
            암호화된 인증 · Infinite Studio Identity
          </div>
        </section>

        <section className={`auth-panel${wide ? ' auth-panel-wide' : ''}`} aria-label="SSO 인증">
          <div className="auth-card screen-enter">
            <div className="request-badge">
              <b>IS</b>
              <span>
                {requestLabel}
                <strong>{requestName}</strong>
              </span>
            </div>
            {children}
            <div className="security-note">
              <ShieldIcon />
              <span>Infinite Studio는 비밀번호를 연결된 서비스와 공유하지 않습니다.</span>
            </div>
          </div>
          <footer className="panel-footer">
            <a href="https://inft.kr/privacy">개인정보 처리방침</a>
            <span>·</span>
            <a href="mailto:support@inftkr.kr">도움말</a>
            <span>·</span>
            <span>한국어</span>
          </footer>
        </section>
      </div>
    </main>
  );
}