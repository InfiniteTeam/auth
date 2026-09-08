# @inft/auth-sdk

OpenID Connect client SDK for consumer services that want to integrate with the
[inft-auth](https://github.com/InfiniteTeam/auth) identity platform — or any
standards-compliant OIDC provider.

## Features

- **PKCE authorization flow** (RFC 7636)
- **ID token verification** — signature validation against the provider's JWKS
  (`jose`), plus issuer / audience / nonce / timestamp enforcement
- **Token refresh** (`refresh_token` grant)
- **RP-Initiated Logout** (OIDC RP-Initiated Logout 1.0)
- **Userinfo retrieval**
- Runtime-agnostic: works in Node.js >= 22, edge runtimes and browsers (where
  `fetch` is available)

## Install

```bash
pnpm add @inft/auth-sdk
# or: npm install @inft/auth-sdk
```

## Quick start

```ts
import { OidcClient } from "@inft/auth-sdk";

const client = new OidcClient({
  issuerUrl: "https://auth.inft.kr",
  clientId: "my-web-app",
  // clientSecret: "...",                        // for confidential clients
  // tokenEndpointAuthMethod: "client_secret_basic",
  redirectUri: "https://my-web-app.example.com/auth/callback",
});

// 1. Start the flow — generates PKCE, state and nonce automatically
const flow = await client.startAuthFlow({
  redirectUri: "https://my-web-app.example.com/auth/callback",
});

// Redirect the user
res.redirect(flow.url);
```

## Handling the callback

```ts
async function handleCallback(req, res) {
  const { code, state, nonce } = parseCallbackQuery(req);

  // Optional: verify the `state` parameter matches what you stored
  if (state !== storedState) return res.status(403).end();

  const { tokens, claims, user } = await client.handleCallback(code, {
    verifier: storedVerifier, // the verifier from startAuthFlow
    redirectUri: REDIRECT_URI,
    nonce, // binds the ID token to this flow
  });

  // tokens  → { access_token, id_token, refresh_token, … }
  // claims  → { sub, email, name, iss, aud, exp, … }
  // user    → { sub, email, name, picture, … }
}
```

## Verifying an ID token independently

If you already hold an ID token (for example, from a Tailscale OIDC callback):

```ts
const claims = await client.verifyIdToken(idToken, {
  nonce: expectedNonce, // optional — enforced when provided
});
console.log(claims.sub, claims.email);
```

## Refreshing a token

```ts
const refreshed = await client.refreshToken(oldRefreshToken, {
  scopes: ["openid", "profile"], // optional
});
```

## RP-Initiated Logout

```ts
const logoutUrl = await client.buildEndSessionUrl({
  idToken: currentIdToken,
  postLogoutRedirectUri: "https://my-web-app.example.com/",
});

res.redirect(logoutUrl);
```

## Client options

| Option                    | Type                                              | Default                        | Description                                                          |
| ------------------------- | ------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| `issuerUrl`               | `string`                                          | _required_                     | OIDC issuer base URL                                                 |
| `clientId`                | `string`                                          | _required_                     | Registered OAuth 2.0 client ID                                       |
| `clientSecret`            | `string?`                                         | —                              | Client secret (confidential clients only)                            |
| `tokenEndpointAuthMethod` | `"client_secret_post"` \| `"client_secret_basic"` | `"client_secret_post"`         | How the secret is sent to the token endpoint                         |
| `scopes`                  | `string[]`                                        | `["openid","profile","email"]` | Default scopes                                                       |
| `redirectUri`             | `string?`                                         | —                              | Default callback URL used by `startAuthFlow`                         |
| `requestTimeoutMs`        | `number`                                          | `15000`                        | Per-request HTTP timeout (ms)                                        |
| `discoveryCacheTtlMs`     | `number`                                          | `3600000`                      | Discovery document cache TTL (ms)                                    |
| `jwksCacheTtlMs`          | `number`                                          | `3600000`                      | JWKS cache TTL (ms)                                                  |
| `clockToleranceSeconds`   | `number`                                          | `0`                            | Leeway for `exp` / `nbf` / `iat` (s)                                 |
| `algorithms`              | `string[]`                                        | `["RS256","ES256"]`            | Allowed signing algorithms (discovery takes precedence when present) |
| `fetch`                   | `typeof fetch`                                    | `globalThis.fetch`             | Custom fetch (tests, undici, edge runtimes)                          |

All secret-bearing options (`clientSecret`, refresh tokens, ID tokens for logout)
are passed by the consumer — the SDK never creates or stores credentials on its
own.

## Security notes

- ID token verification uses public keys only (`jose`'s `jwtVerify` against the
  provider's JWKS). No symmetric secrets are involved.
- A `nonce` should be included in every authorization flow and verified at the
  callback to prevent token replay.
- Store the PKCE verifier, state and nonce server-side (session, database) —
  never in browser local storage.
- See [SECURITY.md](../../SECURITY.md) if present.

## License

[MIT](../../LICENSE)
