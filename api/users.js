import { requireRole, getEnvUsers, ghGet, ghPut, readJson, hashPassword, invalidateUsersCache } from './_lib.js';

const USERS_PATH = 'content/users.json';

async function loadUsers() {
  const f = await ghGet(USERS_PATH);
  if (!f) return { users: [], sha: null };
  try {
    const users = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));
    return { users: Array.isArray(users) ? users : [], sha: f.sha };
  } catch (e) {
    return { users: [], sha: f.sha };
  }
}

async function saveUsers(users, sha, message) {
  const content = JSON.stringify(users, null, 2) + '\n';
  await ghPut(USERS_PATH, content, message, sha);
  invalidateUsersCache();
}

export default async function handler(req, res) {
  try {
    const session = requireRole(req, res, ['admin']);
    if (!session) return;

    const action = (req.query.action || req.body?.action || '').toString();

    // ----- LIST -----
    if (action === 'list' && req.method === 'GET') {
      const envUsers = getEnvUsers().map((u) => ({ ...u, password: '••••••••', _source: 'env' }));
      const { users } = await loadUsers();
      const repoUsers = users.map((u) => ({ ...u, password: '••••••••', _source: 'repo' }));
      // Дедуп по email — env имеют приоритет
      const map = new Map();
      for (const u of [...envUsers, ...repoUsers]) if (u.email) map.set(u.email.toLowerCase(), u);
      res.status(200).json({ items: Array.from(map.values()) });
      return;
    }

    // ----- SAVE (создать или обновить) -----
    if (action === 'save' && req.method === 'POST') {
      const body = await readJson(req);
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const role = String(body.role || 'editor');
      const password = body.password ? String(body.password) : '';
      const originalEmail = String(body.originalEmail || email).trim().toLowerCase();

      if (!email || !name || !['admin', 'editor'].includes(role)) {
        res.status(400).json({ error: 'Email, имя и роль обязательны' }); return;
      }

      // Проверка: нельзя редактировать env-пользователей через API
      const envEmails = getEnvUsers().map((u) => u.email?.toLowerCase());
      if (envEmails.includes(email) || envEmails.includes(originalEmail)) {
        res.status(403).json({ error: 'Этот пользователь задан через переменные окружения и не может быть отредактирован через админку' }); return;
      }

      const { users, sha } = await loadUsers();
      const idx = users.findIndex((u) => u.email?.toLowerCase() === originalEmail);

      let user;
      if (idx === -1) {
        // Создаём нового
        if (!password) { res.status(400).json({ error: 'Для нового пользователя нужен пароль' }); return; }
        if (password.length < 8) { res.status(400).json({ error: 'Пароль должен быть от 8 символов' }); return; }
        user = { email, name, role, password: hashPassword(password) };
        users.push(user);
      } else {
        // Обновляем существующего
        user = { ...users[idx], email, name, role };
        if (password) {
          if (password.length < 8) { res.status(400).json({ error: 'Пароль должен быть от 8 символов' }); return; }
          user.password = hashPassword(password);
        }
        users[idx] = user;
      }

      await saveUsers(users, sha, `users: ${idx === -1 ? 'add' : 'update'} ${email} (by ${session.name || session.sub})`);
      res.status(200).json({ ok: true, user: { ...user, password: '••••••••' } });
      return;
    }

    // ----- DELETE -----
    if (action === 'delete' && req.method === 'POST') {
      const body = await readJson(req);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) { res.status(400).json({ error: 'Email обязателен' }); return; }
      if (email === session.sub.toLowerCase()) {
        res.status(400).json({ error: 'Нельзя удалить самого себя' }); return;
      }
      const envEmails = getEnvUsers().map((u) => u.email?.toLowerCase());
      if (envEmails.includes(email)) {
        res.status(403).json({ error: 'Этот пользователь задан через переменные окружения и не может быть удалён через админку' }); return;
      }
      const { users, sha } = await loadUsers();
      const filtered = users.filter((u) => u.email?.toLowerCase() !== email);
      if (filtered.length === users.length) { res.status(404).json({ error: 'Не найден' }); return; }
      await saveUsers(filtered, sha, `users: remove ${email} (by ${session.name || session.sub})`);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Неизвестное действие' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
