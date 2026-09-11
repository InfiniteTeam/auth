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

/** Link relation used for OpenID Connect issuer discovery (RFC 7033 §3.1). */
const ISSUER_REL = "http://openid.net/specs/connect/1.0/issuer";

/**
 * Matches a WebFinger resource targeted at this platform: an `acct:` URI with
 * a local part whose host is exactly {@link DOMAIN_ROOT}. The local part is
 * required (`acct:user@host`, RFC 7565); rejecting anything else keeps the
 * endpoint from reflecting arbitrary URIs back to the client.
 */
const ACCT_RESOURCE_RE = new RegExp(
  `^acct:[^@\\s]+@${escapeRegExp(DOMAIN_ROOT)}$`,
);

@ApiTags("webfinger")
@Controller(".well-known/webfinger")
export class WebFingerController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * Resolves a WebFinger resource descriptor. The `resource` query parameter
   * is required exactly once (RFC 7033 §4.2): absent, repeated, malformed, or
   * foreign values fail with 400. The optional `rel` parameter filters the
   * returned links (RFC 7033 §4.3); unknown relations yield an empty `links`
   * array while the rest of the descriptor is preserved. Descriptors are
   * served with no-cache headers so responses cannot be cached and replayed
   * by intermediate caches.
   */
  @Get()
  @Header("Cache-Control", "no-store, max-age=0")
  @Header("Content-Type", "application/jrd+json")
  @Header("Access-Control-Allow-Origin", "*")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ summary: "WebFinger resource descriptor (RFC 7033)" })
  @ApiQuery({ name: "resource", required: true })
  @ApiQuery({ name: "rel", required: false })
  @ApiResponse({ status: 200, description: "JSON Resource Descriptor" })
  @ApiResponse({ status: 400, description: "Malformed or foreign resource" })
  getWebFinger(
    @Query("resource") resource?: string,
    @Query("rel") rel?: string | string[],
  ): WebFingerResponse {
    if (typeof resource !== "string" || !ACCT_RESOURCE_RE.test(resource)) {
      throw new BadRequestException("Invalid WebFinger resource");
    }
    const issuer = this.config.issuerUrl || OIDC_ISSUER;
    const requested = rel === undefined ? [] : Array.isArray(rel) ? rel : [rel];
    const links =
      requested.length === 0 || requested.includes(ISSUER_REL)
        ? [{ rel: ISSUER_REL, href: issuer }]
        : [];
    return { subject: resource, links };
  }
}
