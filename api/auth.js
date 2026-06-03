// Vercel Serverless Function: /api/auth
// Старт OAuth flow с GitHub. Перенаправляет пользователя на GitHub.
// ENV vars: OAUTH_CLIENT_ID, OAUTH_REDIRECT_URL

export default function handler(req, res) {
  const clientId = process.env.OAUTH_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('OAUTH_CLIENT_ID env var not set on Vercel');
  }
  const redirectUri = process.env.OAUTH_REDIRECT_URL
    || `https://${req.headers.host}/api/callback`;
  const scope = 'repo,user';
  const state = Math.random().toString(36).slice(2);
  // Можно сохранить state в куки для CSRF-защиты — оставим простым для MVP.
  const url = `https://github.com/login/oauth/authorize`
    + `?client_id=${encodeURIComponent(clientId)}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&scope=${encodeURIComponent(scope)}`
    + `&state=${state}`;
  res.writeHead(302, { Location: url });
  res.end();
}
