import { Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-react';
import { FeatureCards } from '@/components/feature-cards';

const features = [
  {
    icon: Fingerprint,
    title: 'OAuth 2.0 / OIDC',
    description:
      'Standards-compliant provider built on oidc-provider with a Nest.js backend.',
    href: '/docs/guides/oidc',
    hrefText: 'OIDC & integrations',
  },
  {
    icon: ShieldCheck,
    title: 'LDAP identity',
    description:
      'User identities managed by lldap (PostgreSQL-backed, single source of truth).',
    href: '/docs/guides/security',
    hrefText: 'Security model',
  },
  {
    icon: LockKeyhole,
    title: 'Session & cookies',
    description:
      'Signed inft_session cookie — HttpOnly, Secure, SameSite=Lax, 7-day TTL.',
    href: '/docs/guides/security',
    hrefText: 'Security model',
  },
];

export default function HomePage() {
  return (
    <main className="docs-home">
      <section className="docs-home__hero">
        <div className="docs-home__intro">
          <h1>One account, every service</h1>
          <p>Self-hosted authentication for the InfiniteTeam ecosystem.</p>
          <div className="docs-home__actions">
            <a className="docs-home__action" href="/docs">
              Read the docs
            </a>
            <a
              className="docs-home__action docs-home__action--quiet"
              href="https://github.com/InfiniteTeam/auth"
            >
              View on GitHub
            </a>
          </div>
        </div>
        <figure
          className="docs-home__path"
          aria-label="Identity flow from LDAP through the OIDC provider to Tailscale"
        >
          <div className="docs-home__path-node">
            <strong>lldap</strong>
            <span>LDAP identity</span>
          </div>
          <div className="docs-home__path-node">
            <strong>Nest.js + oidc-provider</strong>
            <span>OAuth 2.0 / OIDC</span>
          </div>
          <div className="docs-home__path-node">
            <strong>Tailscale</strong>
            <span>Custom OIDC client</span>
          </div>
          <figcaption>InfiniteTeam identity path</figcaption>
        </figure>
      </section>

      <section className="docs-home__section docs-home__overview">
        <h2>Authentication in one place</h2>
        <p>
          OAuth 2.0 / OpenID Connect, LDAP identity, WebFinger and social login
          serve the InfiniteTeam ecosystem.
        </p>
      </section>

      <section className="docs-home__section docs-home__topics">
        <h2>Read by layer</h2>
        <FeatureCards features={features} />
      </section>

      <section className="docs-home__closing">
        <h2>Start with Tailscale</h2>
        <p>The first consuming service uses a custom OIDC client.</p>
      </section>
      <footer className="docs-home__footer">
        <span>InfiniteTeam identity platform</span>
        <a href="/docs">Documentation</a>
      </footer>
    </main>
  );
}
