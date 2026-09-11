/**
 * Production OIDC interaction controller.
 *
 * Serves the static interaction endpoint (`GET /interaction`) that
 * `oidc-provider` uses in production (`features.devInteractions` is disabled
 * there). In development the provider overrides `interactions.url` with
 * `/interaction/:uid` and serves its own pages, so this controller is bypassed
 * (those `/interaction/:uid` paths are still delegated to `oidc-provider`; see
 * {@link ../main}).
 *
 * This controller only performs the protocol steps the backend alone can do:
 * it resolves the raw `inft_session` cookie and calls
 * `interactionDetails`/`interactionFinished`. Whenever user input is needed it
 * redirects to the www UI (`/login`, `/consent`), which sends the browser back
 * to this endpoint (the `_interaction` cookie is scoped to `/interaction`).
 */

import { Controller, Get, Inject, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import Provider, { errors as providerErrors } from "oidc-provider";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { readSessionCookie } from "../session/session.guard.js";
import { SessionService } from "../session/session.service.js";
import { OIDC_PROVIDER } from "./oidc.module.js";
import { OIDC_INTERACTION_ROUTE } from "./oidc-routes.js";

/** Decision query parameter supplied by the www consent page. */
type ConsentDecision = "allow" | "deny";

/** Subset of the consent prompt details produced by `oidc-provider`. */
interface ConsentPromptDetails {
  missingOIDCScope?: unknown;
  missingOIDCClaims?: unknown;
}

type InteractionDetails = Awaited<ReturnType<Provider["interactionDetails"]>>;

/**
 * Keeps only the string entries of an unknown value. Prompt details are
 * produced by `oidc-provider` itself, but interactions persist through the
 * adapter, so this guards the grant construction against malformed input.
 */
function toScopeList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

@Controller()
export class OidcInteractionController {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly provider: Provider,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly sessionService: SessionService,
  ) {}

  @Get(OIDC_INTERACTION_ROUTE)
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    let details: InteractionDetails;
    try {
      details = await this.provider.interactionDetails(req, res);
    } catch (error) {
      if (error instanceof providerErrors.SessionNotFound) {
        // The `_interaction` cookie is missing or expired; restart at login.
        res.redirect(302, `${this.uiOrigin}/login`);
        return;
      }
      throw error;
    }

    switch (details.prompt.name) {
      case "login":
        await this.handleLogin(req, res);
        return;
      case "consent":
        await this.handleConsent(req, res, details);
        return;
      default:
        res.status(501).end();
    }
  }

  private async handleLogin(req: Request, res: Response): Promise<void> {
    const session = await this.sessionService.resolveSessionFromCookie(
      readSessionCookie(req),
    );
    if (!session) {
      // No portal session yet: send the user to the www login page and back.
      const loginUrl = new URL("/login", this.uiOrigin);
      loginUrl.searchParams.set("return_to", OIDC_INTERACTION_ROUTE);
      res.redirect(302, loginUrl.toString());
      return;
    }
    await this.provider.interactionFinished(
      req,
      res,
      { login: { accountId: session.user.userId } },
      { mergeWithLastSubmission: false },
    );
  }

  private async handleConsent(
    req: Request,
    res: Response,
    details: InteractionDetails,
  ): Promise<void> {
    const decision = req.query.decision as ConsentDecision | undefined;
    const clientId =
      typeof details.params.client_id === "string"
        ? details.params.client_id
        : undefined;
    const accountId = details.session?.accountId;

    if (decision === "deny") {
      await this.provider.interactionFinished(
        req,
        res,
        {
          error: "access_denied",
          error_description: "End-User aborted interaction",
        },
        { mergeWithLastSubmission: false },
      );
      return;
    }

    if (decision === "allow") {
      if (!clientId || !accountId) {
        res.status(400).end();
        return;
      }
      const promptDetails = details.prompt.details as ConsentPromptDetails;
      const grant = new this.provider.Grant({ accountId, clientId });
      const missingOIDCScope = toScopeList(promptDetails.missingOIDCScope);
      if (missingOIDCScope.length > 0) {
        grant.addOIDCScope(missingOIDCScope.join(" "));
      }
      const missingOIDCClaims = toScopeList(promptDetails.missingOIDCClaims);
      if (missingOIDCClaims.length > 0) {
        grant.addOIDCClaims(missingOIDCClaims);
      }
      const grantId = await grant.save();
      await this.provider.interactionFinished(
        req,
        res,
        { consent: { grantId } },
        { mergeWithLastSubmission: true },
      );
      return;
    }

    // No decision yet: render the www consent UI, returning to this endpoint.
    const client = clientId
      ? ((await this.provider.Client.find(clientId).catch(() => undefined)) ??
        undefined)
      : undefined;
    const consentUrl = new URL("/consent", this.uiOrigin);
    consentUrl.searchParams.set(
      "client_name",
      client?.clientName ?? clientId ?? "",
    );
    consentUrl.searchParams.set(
      "scope",
      typeof details.params.scope === "string" ? details.params.scope : "",
    );
    consentUrl.searchParams.set("redirect_url", OIDC_INTERACTION_ROUTE);
    res.redirect(302, consentUrl.toString());
  }

  /** Origin hosting the www UI. Same origin as the issuer in production. */
  private get uiOrigin(): string {
    return new URL("/", this.config.issuerUrl).origin;
  }
}
