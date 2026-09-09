import { ArrowRight } from 'lucide-react';
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <div
            key={feature.title}
            className="flex flex-col gap-3 rounded-xl border border-[--fd-border] bg-[#181b28] p-5"
          >
            <div className="flex size-10 items-center justify-center rounded-lg border border-[rgba(94,234,212,0.25)] bg-[rgba(64,216,140,0.08)] text-[#70e6bf]">
              <Icon className="size-5" />
            </div>
            <h2 className="text-base font-semibold text-fd-foreground">
              {feature.title}
            </h2>
            <p className="flex-1 text-sm leading-relaxed text-fd-muted-foreground">
              {feature.description}
            </p>
            <a
              href={feature.href}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6ee7b7] transition hover:text-[#99f6e4]"
            >
              {feature.hrefText}
              <ArrowRight className="size-3.5" />
            </a>
          </div>
        );
      })}
    </div>
  );
}