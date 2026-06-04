import { findUser, verifyPassword, signJWT, setSessionCookie, readJson } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const secret = process.env.JWT_SECRET;
  if (!secret) { res.status(500).json({ error: 'JWT_SECRET не настроен на сервере' }); return; }

  const { email, password } = await readJson(req);
  if (!email || !password) { res.status(400).json({ error: 'Заполните все поля' }); return; }

  // Tiny rate-limiter via random delay (мелкая защита от перебора)
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));

  const user = findUser(email);
  if (!user || !verifyPassword(password, user.password)) {
    res.status(401).json({ error: 'Неверный email или пароль' });
    return;
  }
  const token = signJWT({ sub: user.email, role: user.role || 'editor', name: user.name || user.email }, secret);
  setSessionCookie(res, token);
  res.status(200).json({ ok: true, user: { email: user.email, role: user.role || 'editor', name: user.name } });
}
