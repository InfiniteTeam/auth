/**
 * Unit tests for the OIDC provider factory proxy awareness.
 *
 * The backend serves plain HTTP behind the Cloudflare Tunnel; without
 * `proxy = true` the discovery document advertises `http://` endpoints and
 * strict consumers (Tailscale egress proxy) refuse the token fetch.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appConfigFixture } from "../config/app-config.fixture.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { LldapService } from "../lldap/lldap.service.js";
import { createProvider } from "./provider.factory.js";

describe("createProvider", () => {
  it("enables proxy awareness so discovery honors X-Forwarded-Proto", () => {
    const dir = mkdtempSync(join(tmpdir(), "inft-jwks-"));
    const provider = createProvider(
      appConfigFixture({ jwksPath: join(dir, "jwks.json") }),
      {} as PrismaService,
      {} as LldapService,
    );
    expect(provider.proxy).toBe(true);
  });
});
