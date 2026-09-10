/**
 * WebFinger (RFC 7033).
 *
 * Served at `/.well-known/webfinger` and used by Tailscale (and other OIDC
 * consumers) to resolve the account to the OpenID Connect issuer.
 */

import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { DOMAIN_ROOT, OIDC_ISSUER } from "@inftkr/shared";
import { APP_CONFIG, type AppConfig } from "../config/config.js";

interface WebFingerLink {
  rel: string;
  href?: string;
  type?: string;
}

interface WebFingerResponse {
  subject: string;
  links: WebFingerLink[];
}

/** Escapes regular expression metacharacters in a literal string. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches a WebFinger resource targeted at this platform: an `acct:` URI whose
 * host (with an optional local part) is exactly {@link DOMAIN_ROOT}. Rejecting
 * anything outside the domain keeps the endpoint from reflecting arbitrary
 * URIs back to the client (RFC 7033).
 */
const ACCT_RESOURCE_RE = new RegExp(
  `^acct:(?:[^@\\s]+@)?${escapeRegExp(DOMAIN_ROOT)}$`,
);

@ApiTags("webfinger")
@Controller(".well-known/webfinger")
export class WebFingerController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * Resolves a WebFinger resource association. The `resource` query parameter
   * follows RFC 7033; when omitted the controller falls back to resolving for
   * the platform domain itself (`acct:user@{domain}`). Descriptors are served
   * with no-cache headers so responses cannot be cached and replayed by
   * intermediate caches.
   */
  @Get()
  @Header("Cache-Control", "no-store, max-age=0")
  @Header("Content-Type", "application/jrd+json")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ summary: "WebFinger resource descriptor (RFC 7033)" })
  @ApiQuery({ name: "resource", required: false })
  @ApiResponse({ status: 200, description: "JSON Resource Descriptor" })
  @ApiResponse({ status: 400, description: "Malformed or foreign resource" })
  getWebFinger(@Query("resource") resource?: string): WebFingerResponse {
    const acct = resource ?? `acct:user@${DOMAIN_ROOT}`;
    if (!ACCT_RESOURCE_RE.test(acct)) {
      throw new BadRequestException("Invalid WebFinger resource");
    }
    const issuer = this.config.issuerUrl || OIDC_ISSUER;
    return {
      subject: acct,
      links: [
        {
          rel: "http://openid.net/specs/connect/1.0/issuer",
          href: issuer,
        },
      ],
    };
  }
}
