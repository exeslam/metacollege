// Одноразовый эндпоинт для создания первого админа.
// Работает только если content/users.json пустой/не существует И в ENV нет ADMIN_USERS_JSON
// с хотя бы одним пользователем role=admin. После создания первого админа — больше не работает.

import { ghGet, ghPut, hashPassword, getEnvUsers, readJson, signJWT, setSessionCookie, invalidateUsersCache } from './_lib.js';

const USERS_PATH = 'content/users.json';

async function adminExists() {
  // Проверяем ENV
  const env = getEnvUsers();
  if (env.some((u) => u.role === 'admin')) return true;
  // Проверяем репо
  const f = await ghGet(USERS_PATH);
  if (!f) return false;
  try {
    const users = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));
    return Array.isArray(users) && users.some((u) => u.role === 'admin');
  } catch (e) { return false; }
}

export default async function handler(req, res) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) { res.status(500).json({ error: 'JWT_SECRET не настроен' }); return; }

    // GET: возвращает, доступен ли bootstrap
    if (req.method === 'GET') {
      const has = await adminExists();
      res.status(200).json({ available: !has });
      return;
    }

    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    // POST: создаём первого админа
    if (await adminExists()) {
      res.status(403).json({ error: 'Админ уже существует. Bootstrap больше недоступен.' });
      return;
    }

    const { email, password, name } = await readJson(req);
    if (!email || !password || !name) { res.status(400).json({ error: 'Заполните все поля' }); return; }
    if (password.length < 8) { res.status(400).json({ error: 'Пароль от 8 символов' }); return; }

    const user = {
      email: String(email).trim().toLowerCase(),
      name: String(name).trim(),
      role: 'admin',
      password: hashPassword(password),
    };

    // Читаем существующий файл (на случай если там были editor'ы без admin'а)
    const existing = await ghGet(USERS_PATH);
    let users = [];
    let sha = null;
    if (existing) {
      try { users = JSON.parse(Buffer.from(existing.content, 'base64').toString('utf8')); } catch (e) {}
      sha = existing.sha;
    }
    users.push(user);
    const content = JSON.stringify(users, null, 2) + '\n';
    await ghPut(USERS_PATH, content, `bootstrap: create first admin ${user.email}`, sha);
    invalidateUsersCache();

    // Сразу логиним
    const token = signJWT({ sub: user.email, role: user.role, name: user.name }, secret);
    setSessionCookie(res, token);
    res.status(200).json({ ok: true, user: { email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
