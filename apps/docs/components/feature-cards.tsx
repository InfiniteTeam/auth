import type { LucideIcon } from 'lucide-react';

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  hrefText: string;
}

export function FeatureCards({ features }: { features: Feature[] }) {
  return (
    <div className="docs-home__topic-list">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <article className="docs-home__topic" key={feature.title}>
            <div className="docs-home__topic-heading">
              <Icon aria-hidden="true" />
              <h3>{feature.title}</h3>
            </div>
            <p>{feature.description}</p>
            <a href={feature.href}>{feature.hrefText}</a>
          </article>
        );
      })}
    </div>
  );
}
