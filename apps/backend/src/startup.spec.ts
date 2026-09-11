/**
 * Startup regression tests.
 *
 * A module <-> controller file-level cycle once crashed production boot with
 * `ReferenceError: Cannot access '...' before initialization` (ESM TDZ):
 * unit tests kept passing because they never evaluate the production import
 * order. These tests lock in two guarantees:
 *
 * 1. The backend import graph stays acyclic (value imports only), so no
 *    evaluation order can hit a temporal-dead-zone binding.
 * 2. Non-module files never import `*.module.ts` (tokens must live in leaf
 *    files like `*-tokens.ts`, `*.guard.ts` or `config.ts`).
 * 3. The full Nest application initializes with a dummy environment
 *    (catches DI graph errors before deployment).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "generated") {
          walk(full);
        }
      } else if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) {
        out.push(full);
      }
    }
  };
  walk(SRC);
  return out;
}

function moduleKey(full: string): string {
  return relative(SRC, full).replace(/\.ts$/, "");
}

/** Builds the value-import graph (type-only imports excluded). */
function importGraph(): Map<string, Set<string>> {
  const files = sourceFiles();
  const known = new Set(files.map(moduleKey));
  const graph = new Map<string, Set<string>>();
  const pattern = /import\s+(type\s+)?[^;]*?from\s+["'](\.[^"']+)["']/g;
  for (const full of files) {
    const src = moduleKey(full);
    const targets = new Set<string>();
    const text = readFileSync(full, "utf8");
    for (const match of text.matchAll(pattern)) {
      if (match[1]) {
        continue;
      }
      const target = normalize(join(dirname(src), match[2])).replace(/\.js$/, "");
      if (known.has(target)) {
        targets.add(target);
      }
    }
    graph.set(src, targets);
  }
  return graph;
}

describe("backend import graph", () => {
  it("contains no import cycles", () => {
    const graph = importGraph();
    const visited = new Set<string>();
    const trail: string[] = [];
    const cycles: string[][] = [];
    const visit = (node: string): void => {
      if (trail.includes(node)) {
        cycles.push([...trail.slice(trail.indexOf(node)), node]);
        return;
      }
      if (visited.has(node)) {
        return;
      }
      trail.push(node);
      for (const next of graph.get(node) ?? []) {
        visit(next);
      }
      trail.pop();
      visited.add(node);
    };
    for (const node of graph.keys()) {
      visit(node);
    }
    expect(cycles, `Import cycles detected: ${JSON.stringify(cycles)}`).toEqual([]);
  });

  it("lets no non-module file import a *.module.ts file", () => {
    const graph = importGraph();
    const violations: string[] = [];
    for (const [src, targets] of graph) {
      if (src.endsWith(".module") || src === "main") {
        continue;
      }
      for (const target of targets) {
        if (target.endsWith(".module")) {
          violations.push(`${src} -> ${target}`);
        }
      }
    }
    expect(violations, `Module imports outside modules: ${JSON.stringify(violations)}`).toEqual([]);
  });
});

describe("application bootstrap", () => {
  it(
    "initializes the full Nest DI graph",
    async () => {
      process.env.ISSUER_URL ??= "http://localhost:3000";
      process.env.SESSION_SECRET ??= "test-session-secret-for-bootstrap-smoke-test";
      process.env.TAILSCALE_CLIENT_SECRET ??= "test-client-secret";
      process.env.DATABASE_URL ??= "postgresql://auth:auth@localhost:5432/auth";
      process.env.LLDAP_URL ??= "http://localhost:17170";
      process.env.LLDAP_ADMIN_DN ??= "admin";
      process.env.LLDAP_ADMIN_PASSWORD ??= "test";
      process.env.OIDC_JWKS_PATH ??= join(tmpdir(), "inft-auth-bootstrap-smoke-jwks.json");

      const { NestFactory } = await import("@nestjs/core");
      const { AppModule } = await import("./app.module.js");
      const app = await NestFactory.create(AppModule, { logger: false });
      await app.init();
      await app.close();
    },
    60_000,
  );
});
