/**
 * Unit tests for the production OIDC interaction controller.
 */

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { errors as providerErrors } from "oidc-provider";
import { appConfigFixture } from "../config/app-config.fixture.js";
import { OidcInteractionController } from "./oidc-interaction.controller.js";

interface MockResponse {
  redirected?: { status: number; url: string };
  statusCode: number;
  ended: boolean;
  redirect: (status: number, url: string) => void;
  status: (code: number) => MockResponse;
  end: () => void;
}

function mockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    ended: false,
    redirect(status: number, url: string) {
      res.redirected = { status, url };
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    end() {
      res.ended = true;
    },
  };
  return res;
}

function mockRequest(
  query: Record<string, string> = {},
  cookies: Record<string, string> = {},
) {
  return { query, cookies } as never;
}

class GrantMock {
  static last?: GrantMock;
  readonly props: { accountId?: string; clientId?: string };
  readonly addOIDCScope = vi.fn();
  readonly addOIDCClaims = vi.fn();
  readonly save = vi.fn(async () => "grant-id");

  constructor(props?: { accountId?: string; clientId?: string }) {
    this.props = { ...props };
    GrantMock.last = this;
  }
}

function createController(
  overrides: {
    details?: unknown;
    detailsError?: unknown;
    session?: unknown;
    client?: unknown;
  } = {},
) {
  const provider = {
    interactionDetails: vi.fn(async () => {
      if (overrides.detailsError) {
        throw overrides.detailsError;
      }
      return overrides.details;
    }),
    interactionFinished: vi.fn(async () => undefined),
    Grant: GrantMock,
    Client: { find: vi.fn(async () => overrides.client) },
  };
  const sessionService = {
    resolveSessionFromCookie: vi.fn(async () => overrides.session ?? null),
  };
  const controller = new OidcInteractionController(
    provider as never,
    appConfigFixture(),
    sessionService as never,
  );
  GrantMock.last = undefined;
  return { controller, provider, sessionService };
}

function loginDetails() {
  return {
    prompt: { name: "login", reasons: [], details: {} },
    params: {},
    returnTo: "/auth/uid",
  };
}

function consentDetails() {
  return {
    prompt: {
      name: "consent",
      reasons: [],
      details: {
        missingOIDCScope: ["openid", "email"],
        missingOIDCClaims: ["email"],
      },
    },
    params: { client_id: "tailscale", scope: "openid profile email" },
    session: { accountId: "lldap-user", uid: "uid", cookie: "cookie" },
    returnTo: "/auth/uid",
  };
}

describe("OidcInteractionController", () => {
  it("completes login from the portal session", async () => {
    const { controller, provider } = createController({
      details: loginDetails(),
      session: { user: { userId: "lldap-user" } },
    });

    await controller.handle(mockRequest(), mockResponse() as never);

    expect(provider.interactionFinished).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { login: { accountId: "lldap-user" } },
      { mergeWithLastSubmission: false },
    );
  });

  it("redirects anonymous users to the login page", async () => {
    const { controller, provider } = createController({
      details: loginDetails(),
      session: null,
    });
    const res = mockResponse();

    await controller.handle(mockRequest(), res as never);

    expect(provider.interactionFinished).not.toHaveBeenCalled();
    expect(res.redirected?.status).toBe(302);
    expect(res.redirected?.url).toBe(
      "http://localhost:3000/login?return_to=%2Finteraction",
    );
  });

  it("grants the missing scopes on consent allow", async () => {
    const { controller, provider } = createController({
      details: consentDetails(),
    });

    await controller.handle(
      mockRequest({ decision: "allow" }),
      mockResponse() as never,
    );

    expect(GrantMock.last?.props).toEqual({
      accountId: "lldap-user",
      clientId: "tailscale",
    });
    expect(GrantMock.last?.addOIDCScope).toHaveBeenCalledWith("openid email");
    expect(GrantMock.last?.addOIDCClaims).toHaveBeenCalledWith(["email"]);
    expect(provider.interactionFinished).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { consent: { grantId: "grant-id" } },
      { mergeWithLastSubmission: true },
    );
  });

  it("aborts the interaction on consent deny", async () => {
    const { controller, provider } = createController({
      details: consentDetails(),
    });

    await controller.handle(
      mockRequest({ decision: "deny" }),
      mockResponse() as never,
    );

    expect(provider.interactionFinished).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        error: "access_denied",
        error_description: "End-User aborted interaction",
      },
      { mergeWithLastSubmission: false },
    );
  });

  it("redirects undecided consent to the www consent page", async () => {
    const { controller, provider } = createController({
      details: consentDetails(),
      client: { clientName: "Tailscale", clientId: "tailscale" },
    });
    const res = mockResponse();

    await controller.handle(mockRequest(), res as never);

    expect(provider.interactionFinished).not.toHaveBeenCalled();
    expect(res.redirected?.status).toBe(302);
    const url = new URL(res.redirected?.url ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(
      "http://localhost:3000/consent",
    );
    expect(url.searchParams.get("client_name")).toBe("Tailscale");
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("redirect_url")).toBe("/interaction");
  });

  it("restarts at login when the interaction cookie is gone", async () => {
    const { controller, provider } = createController({
      detailsError: new providerErrors.SessionNotFound("gone"),
    });
    const res = mockResponse();

    await controller.handle(mockRequest(), res as never);

    expect(provider.interactionFinished).not.toHaveBeenCalled();
    expect(res.redirected).toEqual({
      status: 302,
      url: "http://localhost:3000/login",
    });
  });
});
