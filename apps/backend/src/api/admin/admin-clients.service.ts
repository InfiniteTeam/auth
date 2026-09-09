/**
 * Admin OIDC client management service.
 *
 * Issues, lists and revokes OIDC clients in the `auth` database. New clients
 * get a Snowflake `client_id` and a randomly generated `client_secret`. The
 * secret is returned exactly once in plain text and is otherwise stored in
 * plain text (oidc-provider compares it verbatim on the token endpoint), so
 * treat the issued value as a credential: rotate clients when compromised and
 * do not rely on the stored value for secret disclosure.
 */

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service.js";
import { APP_CONFIG, type AppConfig } from "../../config/config.js";
import { SnowflakeGenerator } from "../../common/snowflake.js";
import { TAILSCALE_CLIENT_ID } from "../../oidc/provider.factory.js";
import {
  CreateOidcClientDto,
  CreateOidcClientResponseDto,
  OidcClientDto,
} from "./dto/client-admin.dto.js";

const DEFAULT_GRANT_TYPES = ["authorization_code"];
const DEFAULT_RESPONSE_TYPES = ["code"];
const DEFAULT_SCOPES = ["openid", "profile", "email"];
const DEFAULT_TOKEN_ENDPOINT_AUTH_METHOD = "client_secret_post";

/** Injection token for the shared Snowflake generator. */
export const SNOWFLAKE = Symbol("SNOWFLAKE");

@Injectable()
export class AdminClientsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    @Inject(SNOWFLAKE) private readonly snowflake: SnowflakeGenerator,
  ) {}

  /** Lists all registered OIDC clients, newest first. */
  async list(): Promise<OidcClientDto[]> {
    const rows = await this.prisma.oidcClient.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toDto(row));
  }

  /**
   * Issues a new OIDC client.
   *
   * @param input - Client registration metadata.
   * @returns The full client record including the one-time plain-text secret.
   */
  async create(input: CreateOidcClientDto): Promise<CreateOidcClientResponseDto> {
    const clientId = this.snowflake.nextIdString();
    const clientSecret = randomBytes(32)
      .toString("base64url")
      .slice(0, 64);

    const grantTypes = input.grantTypes ?? DEFAULT_GRANT_TYPES;
    const responseTypes = input.responseTypes ?? DEFAULT_RESPONSE_TYPES;
    const scopes = input.scopes ?? DEFAULT_SCOPES;
    const tokenEndpointAuthMethod =
      input.tokenEndpointAuthMethod ?? DEFAULT_TOKEN_ENDPOINT_AUTH_METHOD;

    const metadata = {
      client_id: clientId,
      client_secret: clientSecret,
      client_secret_expires_at: 0,
      ...(input.clientName ? { client_name: input.clientName } : {}),
      redirect_uris: input.redirectUris,
      grant_types: grantTypes,
      response_types: responseTypes,
      scope: scopes.join(" "),
      token_endpoint_auth_method: tokenEndpointAuthMethod,
    } as const;

    const row = await this.prisma.oidcClient.create({
      data: {
        clientId,
        clientSecret,
        grantTypes,
        responseTypes,
        redirectUris: input.redirectUris,
        scopes,
        metadata,
      },
    });

    return { ...this.toDto(row), clientSecret };
  }

  /**
   * Deletes a registered OIDC client. The built-in Tailscale seed client cannot
   * be deleted.
   *
   * @param clientId - The Snowflake client identifier to remove.
   */
  async remove(clientId: string): Promise<void> {
    if (clientId === TAILSCALE_CLIENT_ID) {
      throw new BadRequestException(
        `Built-in client "${TAILSCALE_CLIENT_ID}" cannot be deleted`,
      );
    }
    await this.prisma.oidcClient.delete({
      where: { clientId },
    });
  }

  private toDto(row: {
    clientId: string;
    clientSecret: string | null;
    grantTypes: string[];
    responseTypes: string[];
    redirectUris: string[];
    scopes: string[];
    metadata: unknown;
    createdAt: Date;
  }): OidcClientDto {
    const payload = row.metadata as Record<string, unknown>;
    return {
      clientId: row.clientId,
      clientName:
        typeof payload.client_name === "string"
          ? payload.client_name
          : undefined,
      redirectUris: row.redirectUris,
      grantTypes: row.grantTypes,
      responseTypes: row.responseTypes,
      scopes: row.scopes,
      tokenEndpointAuthMethod:
        typeof payload.token_endpoint_auth_method === "string"
          ? payload.token_endpoint_auth_method
          : DEFAULT_TOKEN_ENDPOINT_AUTH_METHOD,
      createdAt: row.createdAt.toISOString(),
    };
  }
}