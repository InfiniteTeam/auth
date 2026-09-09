/**
 * WebFinger (RFC 7033).
 *
 * Served at `/.well-known/webfinger` and used by Tailscale (and other OIDC
 * consumers) to resolve the account to the OpenID Connect issuer.
 */

import { Controller, Get, Inject, Query } from "@nestjs/common";
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

@ApiTags("webfinger")
@Controller(".well-known/webfinger")
export class WebFingerController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * Resolves a WebFinger resource association. The `resource` query parameter
   * follows RFC 7033; when omitted the controller falls back to resolving for
   * the platform domain itself (`acct:user@{domain}`).
   */
  @Get()
  @ApiOperation({ summary: "WebFinger resource descriptor (RFC 7033)" })
  @ApiQuery({ name: "resource", required: false })
  @ApiResponse({ status: 200, description: "JSON Resource Descriptor" })
  getWebFinger(@Query("resource") resource?: string): WebFingerResponse {
    const acct = resource ?? `acct:user@${DOMAIN_ROOT}`;
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
