import { getSession } from './_lib.js';

export default function handler(req, res) {
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'Не авторизован' }); return; }
  res.status(200).json({ email: session.sub, role: session.role, name: session.name });
}
