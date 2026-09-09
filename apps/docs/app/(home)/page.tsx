import { Fingerprint, LockKeyhole, ShieldCheck, Server, BookOpenCheck, Code2 } from 'lucide-react';
import { FeatureCards } from '@/components/feature-cards';

const features = [
  {
    icon: Fingerprint,
    title: 'OAuth 2.0 / OIDC',
    description:
      'Standards-compliant provider built on oidc-provider with a Nest.js backend.',
    href: '/docs/oidc',
    hrefText: 'OIDC & integrations',
  },
  {
    icon: ShieldCheck,
    title: 'LDAP identity',
    description:
      'User identities managed by lldap (PostgreSQL-backed, single source of truth).',
    href: '/docs/security',
    hrefText: 'Security model',
  },
  {
    icon: LockKeyhole,
    title: 'Session & cookies',
    description:
      'Signed inft_session cookie — HttpOnly, Secure, SameSite=Lax, 7-day TTL.',
    href: '/docs/security',
    hrefText: 'Security model',
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16 md:py-24">
      <div className="text-center">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-fd-primary">
          InfiniteTeam identity platform
        </p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          One account,{' '}
          <span className="bg-gradient-to-r from-[#6ee7b7] to-[#5eead4] bg-clip-text text-transparent">
            every service
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-fd-muted-foreground md:text-lg">
          Self-hosted authentication for the InfiniteTeam ecosystem — OAuth 2.0 /
          OpenID Connect, LDAP identity, WebFinger and social login. The first
          consuming service is Tailscale (custom OIDC client).
        </p>
      </div>

      <FeatureCards features={features} />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="/docs"
          className="inline-flex items-center gap-2 rounded-lg bg-[#40d88c] px-5 py-2.5 text-sm font-semibold text-[#071b13] transition hover:bg-[#5eead4]"
        >
          <BookOpenCheck className="size-4" />
          Read the docs
        </a>
        <a
          href="https://github.com/InfiniteTeam/auth"
          className="inline-flex items-center gap-2 rounded-lg border border-[--fd-border] px-5 py-2.5 text-sm font-semibold text-fd-foreground transition hover:bg-fd-secondary"
        >
          <Code2 className="size-4" />
          View on GitHub
        </a>
        <a
          href="https://login.tailscale.com"
          className="inline-flex items-center gap-2 rounded-lg border border-[--fd-border] px-5 py-2.5 text-sm font-semibold text-fd-foreground transition hover:bg-fd-secondary"
        >
          <Server className="size-4" />
          Tailscale console
        </a>
      </div>
    </div>
  );
}