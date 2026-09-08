const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const KRATOS_PUBLIC_URL = process.env.KRATOS_PUBLIC_URL || 'http://kratos:4433';
const KRATOS_ADMIN_URL = process.env.KRATOS_ADMIN_URL || 'http://kratos:4434';
const HYDRA_PUBLIC_URL = process.env.HYDRA_PUBLIC_URL || 'http://hydra:4444';
const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || 'http://hydra:4445';
const SELF_URL = process.env.SELF_URL || 'https://id.inft.kr';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function log(level, msg, extra = {}) {
  console.log(JSON.stringify({ level, msg, ...extra, timestamp: new Date().toISOString() }));
}

async function fetchSession(req) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  try {
    const res = await fetch(`${KRATOS_PUBLIC_URL}/sessions/whoami`, {
      headers: { cookie },
    });
    if (res.ok) return await res.json();
  } catch (e) {
    log('error', 'session fetch failed', { error: e.message });
  }
  return null;
}

async function checkDiscordGuildMembership(discordId) {
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    log('warn', 'discord config missing, skipping guild check');
    return { member: false, roles: [] };
  }
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
      { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
    );
    if (res.status === 200) {
      const member = await res.json();
      return { member: true, roles: member.roles || [] };
    }
    if (res.status === 404) return { member: false, roles: [] };
    log('error', 'discord guild check failed', { status: res.status });
    return { member: false, roles: [] };
  } catch (e) {
    log('error', 'discord guild check error', { error: e.message });
    return { member: false, roles: [] };
  }
}

async function getHydraLoginRequest(loginChallenge) {
  const res = await fetch(`${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login?login_challenge=${loginChallenge}`);
  if (!res.ok) throw new Error(`hydra login request failed: ${res.status}`);
  return await res.json();
}

async function acceptHydraLoginRequest(loginChallenge, subject, remember = false) {
  const res = await fetch(`${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login/accept`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, remember, remember_for: 86400 }),
  });
  if (!res.ok) throw new Error(`hydra accept login failed: ${res.status}`);
  return await res.json();
}

async function getHydraConsentRequest(consentChallenge) {
  const res = await fetch(`${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent?consent_challenge=${consentChallenge}`);
  if (!res.ok) throw new Error(`hydra consent request failed: ${res.status}`);
  return await res.json();
}

async function acceptHydraConsentRequest(consentChallenge, grantScopes, session, remember = false) {
  const res = await fetch(`${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/accept`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_scope: grantScopes,
      grant_access_token_audience: grantScopes,
      remember,
      remember_for: 86400,
      session,
    }),
  });
  if (!res.ok) throw new Error(`hydra accept consent failed: ${res.status}`);
  return await res.json();
}

async function getHydraLogoutRequest(logoutChallenge) {
  const res = await fetch(`${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/logout?logout_challenge=${logoutChallenge}`);
  if (!res.ok) throw new Error(`hydra logout request failed: ${res.status}`);
  return await res.json();
}

async function acceptHydraLogoutRequest(logoutChallenge) {
  const res = await fetch(`${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/logout/accept`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`hydra accept logout failed: ${res.status}`);
  return await res.json();
}

function buildConsentSession(identity, discordGuild, grantScopes) {
  const idToken = {};
  const accessToken = {};

  if (grantScopes.includes('email')) {
    idToken.email = identity.traits.email;
    idToken.email_verified = (identity.verifiable_addresses || []).some(v => v.verified && v.value === identity.traits.email);
  }

  if (grantScopes.includes('profile')) {
    idToken.name = [identity.traits.name?.first, identity.traits.name?.last].filter(Boolean).join(' ') || identity.traits.email;
    idToken.preferred_username = identity.traits.email.split('@')[0];
  }

  if (grantScopes.includes('groups') && discordGuild.member) {
    idToken.groups = [`${DISCORD_GUILD_ID}`];
    if (discordGuild.roles.length > 0) {
      idToken.groups = idToken.groups.concat(discordGuild.roles.map(r => `discord:${r}`));
    }
    accessToken.groups = idToken.groups;
  }

  if (grantScopes.includes('role')) {
    const adminRoles = process.env.ADMIN_DISCORD_ROLES ? process.env.ADMIN_DISCORD_ROLES.split(',') : [];
    const isAdmin = identity.traits.role === 'admin' || discordGuild.roles.some(r => adminRoles.includes(r));
    idToken.role = isAdmin ? 'admin' : 'user';
    accessToken.role = idToken.role;
  }

  return { id_token: idToken, access_token: accessToken };
}

function html(body) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Infiniteteam Identity</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e0e0e0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { background: #1a1a2e; border-radius: 12px; padding: 2rem; width: 100%; max-width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    h1 { text-align: center; margin-bottom: 0.5rem; font-size: 1.4rem; color: #fff; }
    .subtitle { text-align: center; color: #888; font-size: 0.85rem; margin-bottom: 1.5rem; }
    .btn { display: block; width: 100%; padding: 0.75rem; border: none; border-radius: 8px; font-size: 0.95rem; font-weight: 600; cursor: pointer; margin-bottom: 0.75rem; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.85; }
    .btn-primary { background: #4f46e5; color: #fff; }
    .btn-danger { background: #dc2626; color: #fff; }
    .btn-github { background: #24292e; color: #fff; }
    .btn-discord { background: #5865F2; color: #fff; }
    .btn-outline { background: transparent; color: #e0e0e0; border: 1px solid #444; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; font-size: 0.85rem; color: #aaa; margin-bottom: 0.25rem; }
    input { width: 100%; padding: 0.65rem; border: 1px solid #333; border-radius: 6px; background: #111; color: #fff; font-size: 0.9rem; }
    input:focus { outline: none; border-color: #4f46e5; }
    .divider { display: flex; align-items: center; text-align: center; margin: 1rem 0; color: #666; font-size: 0.8rem; }
    .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid #333; }
    .divider::before { margin-right: 0.75rem; }
    .divider::after { margin-left: 0.75rem; }
    .error { background: #451a1a; border: 1px solid #7f1d1d; color: #fca5a5; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.85rem; }
    .info { background: #1a2a45; border: 1px solid #1e3a5f; color: #93c5fd; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.85rem; }
    .info-bad { background: #451a1a; border: 1px solid #7f1d1d; color: #fca5a5; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.85rem; }
    .scopes { list-style: none; margin: 1rem 0; }
    .scopes li { padding: 0.4rem 0; font-size: 0.9rem; color: #ccc; }
    .scopes li::before { content: "✓ "; color: #22c55e; }
    .links { text-align: center; margin-top: 1rem; }
    .links a { color: #818cf8; text-decoration: none; font-size: 0.85rem; }
    .links a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    ${body}
  </div>
</body>
</html>`;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Hydra login callback
app.get('/oauth2/login', async (req, res) => {
  try {
    const challenge = req.query.login_challenge;
    if (!challenge) return res.status(400).send(html('<h1>Error</h1><p>Missing login_challenge</p>'));

    const loginRequest = await getHydraLoginRequest(challenge);

    if (loginRequest.skip) {
      const result = await acceptHydraLoginRequest(challenge, loginRequest.subject, true);
      return res.redirect(result.redirect_to);
    }

    const session = await fetchSession(req);
    if (session && session.identity) {
      const result = await acceptHydraLoginRequest(challenge, session.identity.id, true);
      return res.redirect(result.redirect_to);
    }

    const returnUrl = encodeURIComponent(challenge);
    res.redirect(`${SELF_URL}/login?return_to=${returnUrl}`);
  } catch (e) {
    log('error', 'login callback error', { error: e.message });
    res.redirect(`${SELF_URL}/error?message=${encodeURIComponent('Login failed: ' + e.message)}`);
  }
});

// Login page
app.get('/login', async (req, res) => {
  const challenge = req.query.return_to;
  const error = req.query.error;

  if (challenge) {
    try {
      const loginRequest = await getHydraLoginRequest(challenge);
      if (loginRequest.skip) {
        const result = await acceptHydraLoginRequest(challenge, loginRequest.subject, true);
        return res.redirect(result.redirect_to);
      }
    } catch (e) {
      log('error', 'login page pre-check failed', { error: e.message });
    }
  }

  const errorHtml = error ? `<div class="error">${error}</div>` : '';

  res.send(html(`
    <h1>Infiniteteam</h1>
    <p class="subtitle">Sign in to your account</p>
    ${errorHtml}
    <form method="POST" action="/login">
      <input type="hidden" name="challenge" value="${challenge || ''}">
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="identifier" required autocomplete="email" placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" required autocomplete="current-password">
      </div>
      <button type="submit" class="btn btn-primary">Sign In</button>
    </form>
    <div class="divider">or</div>
    <a href="/oidc/start/github${challenge ? '?return_to=' + encodeURIComponent(challenge) : ''}" class="btn btn-github">Continue with GitHub</a>
    <a href="/oidc/start/discord${challenge ? '?return_to=' + encodeURIComponent(challenge) : ''}" class="btn btn-discord">Continue with Discord</a>
    <div class="links">
      <a href="/registration${challenge ? '?return_to=' + encodeURIComponent(challenge) : ''}">Create account</a>
      &nbsp;&middot;&nbsp;
      <a href="/recovery">Forgot password?</a>
    </div>
  `));
});

// Login form submission
app.post('/login', async (req, res) => {
  try {
    const { identifier, password, challenge } = req.body;

    const kratosRes = await fetch(`${KRATOS_PUBLIC_URL}/self-service/login?flow=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'password',
        identifier,
        password,
      }),
    });

    const setCookie = kratosRes.headers.get('set-cookie');
    const body = await kratosRes.json();

    if (kratosRes.status === 200 && body.session_token) {
      if (challenge) {
        const session = await fetch(`${KRATOS_PUBLIC_URL}/sessions/whoami`, {
          headers: { cookie: `ory_kratos_session=${body.session_token}` },
        }).then(r => r.json()).catch(() => null);

        if (session && session.identity) {
          const result = await acceptHydraLoginRequest(challenge, session.identity.id, true);
          res.setHeader('Set-Cookie', setCookie);
          return res.redirect(result.redirect_to);
        }
      }
      res.setHeader('Set-Cookie', setCookie);
      return res.redirect(`${SELF_URL}/`);
    }

    const errorMsg = body.ui?.messages?.[0]?.text || 'Login failed. Please check your credentials.';
    res.redirect(`${SELF_URL}/login?error=${encodeURIComponent(errorMsg)}${challenge ? '&return_to=' + encodeURIComponent(challenge) : ''}`);
  } catch (e) {
    log('error', 'login post error', { error: e.message });
    res.redirect(`${SELF_URL}/login?error=${encodeURIComponent('Login failed. Please try again.')}`);
  }
});

// Registration page
app.get('/registration', (req, res) => {
  const challenge = req.query.return_to;
  res.send(html(`
    <h1>Infiniteteam</h1>
    <p class="subtitle">Create a new account</p>
    <form method="POST" action="/registration">
      <input type="hidden" name="challenge" value="${challenge || ''}">
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" required autocomplete="email" placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" required autocomplete="new-password" minlength="8">
      </div>
      <button type="submit" class="btn btn-primary">Create Account</button>
    </form>
    <div class="links">
      <a href="/login${challenge ? '?return_to=' + encodeURIComponent(challenge) : ''}">Already have an account? Sign in</a>
    </div>
  `));
});

// Registration form submission
app.post('/registration', async (req, res) => {
  try {
    const { email, password, challenge } = req.body;

    const kratosRes = await fetch(`${KRATOS_PUBLIC_URL}/self-service/registration?flow=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'password',
        traits: {
          email,
          name: { first: '', last: '' },
          groups: [],
          role: 'user',
        },
        password,
      }),
    });

    const setCookie = kratosRes.headers.get('set-cookie');
    const body = await kratosRes.json();

    if (kratosRes.status === 200 && body.session_token) {
      if (challenge) {
        const session = await fetch(`${KRATOS_PUBLIC_URL}/sessions/whoami`, {
          headers: { cookie: `ory_kratos_session=${body.session_token}` },
        }).then(r => r.json()).catch(() => null);

        if (session && session.identity) {
          const result = await acceptHydraLoginRequest(challenge, session.identity.id, true);
          res.setHeader('Set-Cookie', setCookie);
          return res.redirect(result.redirect_to);
        }
      }
      res.setHeader('Set-Cookie', setCookie);
      return res.redirect(`${SELF_URL}/`);
    }

    const errorMsg = body.ui?.messages?.[0]?.text || 'Registration failed. Please try again.';
    res.redirect(`${SELF_URL}/registration?error=${encodeURIComponent(errorMsg)}${challenge ? '&return_to=' + encodeURIComponent(challenge) : ''}`);
  } catch (e) {
    log('error', 'registration post error', { error: e.message });
    res.redirect(`${SELF_URL}/registration?error=${encodeURIComponent('Registration failed. Please try again.')}`);
  }
});

// Recovery page
app.get('/recovery', (req, res) => {
  res.send(html(`
    <h1>Infiniteteam</h1>
    <p class="subtitle">Recover your account</p>
    <form method="POST" action="/recovery">
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" required autocomplete="email" placeholder="you@example.com">
      </div>
      <button type="submit" class="btn btn-primary">Send Recovery Email</button>
    </form>
    <div class="links">
      <a href="/login">Back to sign in</a>
    </div>
  `));
});

app.post('/recovery', async (req, res) => {
  try {
    const { email } = req.body;
    const kratosRes = await fetch(`${KRATOS_PUBLIC_URL}/self-service/recovery?flow=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, method: 'code' }),
    });
    const body = await kratosRes.json();
    res.send(html(`
      <h1>Infiniteteam</h1>
      <p class="subtitle">Check your email</p>
      <div class="info">If an account with that email exists, we've sent a recovery link.</div>
      <div class="links"><a href="/login">Back to sign in</a></div>
    `));
  } catch (e) {
    log('error', 'recovery error', { error: e.message });
    res.send(html(`
      <h1>Infiniteteam</h1>
      <p class="subtitle">Recovery</p>
      <div class="info">If an account with that email exists, we've sent a recovery link.</div>
      <div class="links"><a href="/login">Back to sign in</a></div>
    `));
  }
});

// Error page
app.get('/error', (req, res) => {
  const message = req.query.message || 'An unexpected error occurred.';
  res.send(html(`
    <h1>Error</h1>
    <div class="error">${message}</div>
    <div class="links"><a href="/">Go home</a></div>
  `));
});

// Settings page
app.get('/settings', async (req, res) => {
  const session = await fetchSession(req);
  if (!session) return res.redirect(`${SELF_URL}/login`);
  const identity = session.identity;
  res.send(html(`
    <h1>Account Settings</h1>
    <p class="subtitle">${identity.traits.email}</p>
    <div class="info">
      Name: ${[identity.traits.name?.first, identity.traits.name?.last].filter(Boolean).join(' ') || 'Not set'}<br>
      Role: ${identity.traits.role || 'user'}
    </div>
    <div class="links"><a href="/">Home</a></div>
  `));
});

// Hydra consent callback
app.get('/oauth2/consent', async (req, res) => {
  try {
    const challenge = req.query.consent_challenge;
    if (!challenge) return res.redirect(`${SELF_URL}/error?message=Missing+consent_challenge`);

    const consentRequest = await getHydraConsentRequest(challenge);

    if (consentRequest.skip) {
      const identityId = consentRequest.subject;
      const identityRes = await fetch(`${KRATOS_ADMIN_URL}/admin/identities/${identityId}`);
      if (!identityRes.ok) {
        res.redirect(`${SELF_URL}/error?message=Identity+not+found`);
        return;
      }
      const identity = await identityRes.json();

      let discordGuild = { member: false, roles: [] };

      for (const credential of Object.values(identity.credentials || {})) {
        if (credential.type === 'oidc') {
          const providers = credential.identifiers || [];
          for (const provider of providers) {
            const meta = credential.config?.providers || [];
            const providerMeta = meta.find(p => p.provider === 'discord');
            if (providerMeta && providerMeta.initial_access_token) {
              try {
                const meRes = await fetch('https://discord.com/api/v10/users/@me', {
                  headers: { Authorization: `Bearer ${providerMeta.initial_access_token}` },
                });
                if (meRes.ok) {
                  const discordUser = await meRes.json();
                  discordGuild = await checkDiscordGuildMembership(discordUser.id);
                }
              } catch (e) {
                log('warn', 'discord token check failed', { error: e.message });
              }
            }
          }
        }
      }

      if (DISCORD_GUILD_ID && !discordGuild.member) {
        res.send(html(`
          <h1>Access Denied</h1>
          <div class="info-bad">
            You must be a member of the designated Discord server to access this service.<br>
            Please join the server and try again.
          </div>
          <div class="links"><a href="/">Home</a></div>
        `));
        return;
      }

      const sessionData = buildConsentSession(identity, discordGuild, consentRequest.requested_scope);
      const result = await acceptHydraConsentRequest(challenge, consentRequest.requested_scope, sessionData, true);
      return res.redirect(result.redirect_to);
    }

    const scopes = consentRequest.requested_scope || ['openid'];
    res.send(html(`
      <h1>Authorize Access</h1>
      <p class="subtitle">${consentRequest.client?.client_name || consentRequest.client?.client_id || 'Unknown Client'}</p>
      <p style="font-size:0.9rem; color:#aaa; margin-bottom:1rem;">
        The application is requesting access to:
      </p>
      <ul class="scopes">
        ${scopes.map(s => `<li>${s}</li>`).join('\n')}
      </ul>
      <form method="POST" action="/oauth2/consent">
        <input type="hidden" name="challenge" value="${challenge}">
        <input type="hidden" name="grant" value="1">
        <button type="submit" class="btn btn-primary">Allow</button>
      </form>
      <form method="POST" action="/oauth2/consent">
        <input type="hidden" name="challenge" value="${challenge}">
        <input type="hidden" name="grant" value="0">
        <button type="submit" class="btn btn-outline">Deny</button>
      </form>
    `));
  } catch (e) {
    log('error', 'consent callback error', { error: e.message });
    res.redirect(`${SELF_URL}/error?message=${encodeURIComponent('Consent failed: ' + e.message)}`);
  }
});

// Consent form submission
app.post('/oauth2/consent', async (req, res) => {
  try {
    const { challenge, grant } = req.body;
    const session = await fetchSession(req);

    if (grant === '0' || !session) {
      const adminRes = await fetch(`${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge,
          error: 'access_denied',
          error_description: 'The resource owner denied the request.',
        }),
      });
      const result = await adminRes.json();
      return res.redirect(result.redirect_to);
    }

    const consentRequest = await getHydraConsentRequest(challenge);
    const identityId = consentRequest.subject;

    const identityRes = await fetch(`${KRATOS_ADMIN_URL}/admin/identities/${identityId}`);
    if (!identityRes.ok) {
      return res.redirect(`${SELF_URL}/error?message=Identity+not+found`);
    }
    const identity = await identityRes.json();

    let discordGuild = { member: false, roles: [] };

    for (const credential of Object.values(identity.credentials || {})) {
      if (credential.type === 'oidc') {
        const providers = credential.identifiers || [];
        for (const provider of providers) {
          const meta = credential.config?.providers || [];
          const providerMeta = meta.find(p => p.provider === 'discord');
          if (providerMeta && providerMeta.initial_access_token) {
            try {
              const meRes = await fetch('https://discord.com/api/v10/users/@me', {
                headers: { Authorization: `Bearer ${providerMeta.initial_access_token}` },
              });
              if (meRes.ok) {
                const discordUser = await meRes.json();
                discordGuild = await checkDiscordGuildMembership(discordUser.id);
              }
            } catch (e) {
              log('warn', 'discord token check failed', { error: e.message });
            }
          }
        }
      }
    }

    if (DISCORD_GUILD_ID && !discordGuild.member) {
      const adminRes = await fetch(`${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge,
          error: 'access_denied',
          error_description: 'You must be a member of the designated Discord server.',
        }),
      });
      const result = await adminRes.json();
      return res.redirect(result.redirect_to);
    }

    const sessionData = buildConsentSession(identity, discordGuild, consentRequest.requested_scope);
    const result = await acceptHydraConsentRequest(challenge, consentRequest.requested_scope, sessionData, true);
    return res.redirect(result.redirect_to);
  } catch (e) {
    log('error', 'consent post error', { error: e.message });
    res.redirect(`${SELF_URL}/error?message=${encodeURIComponent('Consent failed: ' + e.message)}`);
  }
});

// Hydra logout callback
app.get('/oauth2/logout', async (req, res) => {
  try {
    const challenge = req.query.logout_challenge;
    if (!challenge) return res.redirect(`${SELF_URL}/`);

    const logoutRequest = await getHydraLogoutRequest(challenge);
    const result = await acceptHydraLogoutRequest(challenge);

    res.setHeader('Set-Cookie', 'ory_kratos_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    return res.redirect(result.redirect_to);
  } catch (e) {
    log('error', 'logout callback error', { error: e.message });
    res.redirect(`${SELF_URL}/`);
  }
});

// OIDC social login flow
app.get('/oidc/start/:provider', async (req, res) => {
  try {
    const provider = req.params.provider;
    const returnTo = req.query.return_to;

    const callbackUrl = `${SELF_URL}/oidc/callback?provider=${provider}${returnTo ? '&return_to=' + encodeURIComponent(returnTo) : ''}`;

    const session = await fetchSession(req);

    const kratosFlowRes = await fetch(`${KRATOS_PUBLIC_URL}/self-service/login/flows?refresh=true&return_to=${encodeURIComponent(SELF_URL)}`, {
      method: 'GET',
      headers: session ? { cookie: req.headers.cookie || '' } : {},
    });

    const flow = await kratosFlowRes.json();
    const oidcMethod = flow.ui?.methods?.oidc;

    if (!oidcMethod || !oidcMethod.config?.action) {
      return res.redirect(`${SELF_URL}/login?error=${encodeURIComponent('Social login is not configured.')}`);
    }

    const csrfToken = oidcMethod.config?.action?.split('flow=')[1] || '';

    const hydraLoginUrl = `${HYDRA_PUBLIC_URL}/oauth2/auth?client_id=identity-portal&response_type=code&scope=openid+offline&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${provider}`;

    res.redirect(hydraLoginUrl);
  } catch (e) {
    log('error', 'oidc start error', { error: e.message });
    res.redirect(`${SELF_URL}/login?error=${encodeURIComponent('Social login failed to start.')}`);
  }
});

// OIDC callback
app.get('/oidc/callback', async (req, res) => {
  try {
    const { provider, code, state, return_to } = req.query;

    if (!provider || !code) {
      return res.redirect(`${SELF_URL}/login?error=${encodeURIComponent('Invalid callback parameters.')}`);
    }

    const tokenRes = await fetch(`${HYDRA_PUBLIC_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${process.env.DISCORD_CLIENT_ID}:${process.env.DISCORD_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${SELF_URL}/oidc/callback?provider=${provider}`,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      log('error', 'oidc token exchange failed', { status: tokenRes.status, body: err });
      return res.redirect(`${SELF_URL}/login?error=${encodeURIComponent('Token exchange failed.')}`);
    }

    const tokenData = await tokenRes.json();

    const userInfoRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      return res.redirect(`${SELF_URL}/login?error=${encodeURIComponent('Failed to fetch user info from ' + provider)}`);
    }

    const userInfo = await userInfoRes.json();

    let email = userInfo.email;
    if (!email && provider === 'discord') {
      email = `${userInfo.username}@discord.local`;
    }

    const cookie = req.headers.cookie || '';
    const session = await fetch(`${KRATOS_PUBLIC_URL}/sessions/whoami`, {
      headers: { cookie },
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    if (session && session.identity) {
      const identityId = session.identity.id;

      await fetch(`${KRATOS_ADMIN_URL}/admin/identities/${identityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ op: 'add', path: '/credentials/oidc', value: {
          config: {
            providers: [{
              provider,
              initializer: {
                email,
                name: {
                  first: userInfo.username || '',
                  last: '',
                },
              },
              initial_access_token: tokenData.access_token,
              initial_id_token: tokenData.id_token || '',
              initial_refresh_token: tokenData.refresh_token || '',
            }],
          },
          identifiers: [email],
          type: 'oidc',
          version: 1,
        }}]),
      });

      return res.redirect(returnTo || `${SELF_URL}/`);
    }

    const kratosSessionRes = await fetch(`${KRATOS_PUBLIC_URL}/self-service/registration/flows`, {
      method: 'GET',
      headers: { cookie },
    });

    res.redirect(`${SELF_URL}/oidc/complete?provider=${provider}&email=${encodeURIComponent(email)}&username=${encodeURIComponent(userInfo.username || '')}&discord_id=${encodeURIComponent(userInfo.id || '')}${returnTo ? '&return_to=' + encodeURIComponent(returnTo) : ''}`);
  } catch (e) {
    log('error', 'oidc callback error', { error: e.message });
    res.redirect(`${SELF_URL}/login?error=${encodeURIComponent('Social login callback failed.')}`);
  }
});

// OIDC completion page
app.get('/oidc/complete', (req, res) => {
  const { provider, email, username, discord_id, return_to } = req.query;
  res.send(html(`
    <h1>Complete Registration</h1>
    <p class="subtitle">Connect your ${provider} account</p>
    <form method="POST" action="/oidc/complete">
      <input type="hidden" name="provider" value="${provider || ''}">
      <input type="hidden" name="email" value="${email || ''}">
      <input type="hidden" name="username" value="${username || ''}">
      <input type="hidden" name="discord_id" value="${discord_id || ''}">
      <input type="hidden" name="return_to" value="${return_to || ''}">
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="confirmed_email" value="${email || ''}" ${email ? 'readonly style="opacity:0.7"' : ''} required>
      </div>
      <div class="form-group">
        <label>Password (for email/password login)</label>
        <input type="password" name="password" required autocomplete="new-password" minlength="8">
      </div>
      <button type="submit" class="btn btn-primary">Continue</button>
    </form>
  `));
});

// OIDC completion submission
app.post('/oidc/complete', async (req, res) => {
  try {
    const { provider, email, username, discord_id, password, return_to } = req.body;

    const cookie = req.headers.cookie || '';

    const regRes = await fetch(`${KRATOS_PUBLIC_URL}/self-service/registration/flows`, {
      method: 'GET',
      headers: { cookie },
    });

    const registrationRes = await fetch(`${KRATOS_PUBLIC_URL}/self-service/registration?flow=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie,
      },
      body: JSON.stringify({
        method: 'password',
        traits: {
          email: email,
          name: { first: username || '', last: '' },
          groups: [],
          role: 'user',
        },
        password: password,
      }),
    });

    const setCookie = registrationRes.headers.get('set-cookie');
    const body = await registrationRes.json();

    if (registrationRes.status === 200 && body.session_token) {
      if (setCookie) res.setHeader('Set-Cookie', setCookie);

      const session = await fetch(`${KRATOS_PUBLIC_URL}/sessions/whoami`, {
        headers: { cookie: `ory_kratos_session=${body.session_token}` },
      }).then(r => r.ok ? r.json() : null).catch(() => null);

      if (session && session.identity) {
        const identityId = session.identity.id;

        await fetch(`${KRATOS_ADMIN_URL}/admin/identities/${identityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ op: 'add', path: '/credentials/oidc', value: {
            config: {
              providers: [{
                provider,
                initializer: {
                  email,
                  name: { first: username || '', last: '' },
                },
              }],
            },
            identifiers: [email],
            type: 'oidc',
            version: 1,
          }}]),
        });
      }

      return res.redirect(returnTo || `${SELF_URL}/`);
    }

    const errorMsg = body.ui?.messages?.[0]?.text || 'Registration failed.';
    res.redirect(`${SELF_URL}/oidc/complete?provider=${provider}&email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&error=${encodeURIComponent(errorMsg)}`);
  } catch (e) {
    log('error', 'oidc complete error', { error: e.message });
    res.redirect(`${SELF_URL}/login?error=${encodeURIComponent('Registration completion failed.')}`);
  }
});

// Logout action
app.post('/logout', async (req, res) => {
  const cookie = req.headers.cookie;
  if (cookie) {
    try {
      await fetch(`${KRATOS_PUBLIC_URL}/self-service/logout/browser`, {
        method: 'GET',
        headers: { cookie },
      });
    } catch (e) {
      log('error', 'logout error', { error: e.message });
    }
  }
  res.setHeader('Set-Cookie', 'ory_kratos_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  res.redirect(`${SELF_URL}/`);
});

// Home
app.get('/', async (req, res) => {
  const session = await fetchSession(req);
  if (session && session.identity) {
    const identity = session.identity;
    res.send(html(`
      <h1>Infiniteteam</h1>
      <p class="subtitle">Identity Portal</p>
      <div class="info">
        Signed in as <strong>${identity.traits.email}</strong><br>
        Role: ${identity.traits.role || 'user'}
      </div>
      <a href="/settings" class="btn btn-outline">Account Settings</a>
      <form method="POST" action="/logout">
        <button type="submit" class="btn btn-danger">Sign Out</button>
      </form>
    `));
  } else {
    res.send(html(`
      <h1>Infiniteteam</h1>
      <p class="subtitle">Identity Portal</p>
      <a href="/login" class="btn btn-primary">Sign In</a>
      <a href="/registration" class="btn btn-outline">Create Account</a>
    `));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  log('info', 'Identity Portal started', { port: PORT });
});
