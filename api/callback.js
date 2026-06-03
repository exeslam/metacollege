// Vercel Serverless Function: /api/callback
// Принимает callback от GitHub, меняет code на access_token, передаёт в CMS через postMessage.
// ENV vars: OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing code');
  }
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).send('OAuth env vars not set on Vercel');
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const data = await tokenRes.json();
    if (data.error || !data.access_token) {
      return res.status(400).send(`OAuth error: ${data.error_description || 'no token'}`);
    }

    // Передаём токен обратно в админку через postMessage (стандартный Decap/Sveltia handshake)
    const payload = JSON.stringify({ token: data.access_token, provider: 'github' });
    const html = `<!doctype html><html><body><script>
      (function() {
        function send(msg) {
          window.opener && window.opener.postMessage('authorization:github:success:' + ${JSON.stringify(payload)}, '*');
        }
        window.addEventListener('message', send, false);
        send();
        setTimeout(() => window.close(), 1000);
      })();
    </script>
    <p>Вход успешен. Можно закрыть это окно.</p>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (e) {
    res.status(500).send(`OAuth exception: ${e.message}`);
  }
}
