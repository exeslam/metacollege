import { requireRole, ghList, ghGet, ghPut, ghDelete, readJson } from './_lib.js';

const COLLECTIONS = {
  news:     { dir: 'content/news',     allowedRoles: ['admin', 'editor'] },
  posts:    { dir: 'content/posts',    allowedRoles: ['admin', 'editor'] },
  alumni:   { dir: 'content/alumni',   allowedRoles: ['admin', 'editor'] },
  teachers: { dir: 'content/teachers', allowedRoles: ['admin', 'editor'] },
  settings: { dir: 'content/settings', allowedRoles: ['admin'] }, // только админ
};

export default async function handler(req, res) {
  try {
    const session = requireRole(req, res, ['admin', 'editor']);
    if (!session) return;

    const action = (req.query.action || req.body?.action || '').toString();
    const collection = (req.query.collection || req.body?.collection || '').toString();
    const slug = (req.query.slug || req.body?.slug || '').toString();

    const col = COLLECTIONS[collection];
    if (!col) { res.status(400).json({ error: 'Неизвестная коллекция' }); return; }
    if (!col.allowedRoles.includes(session.role)) { res.status(403).json({ error: 'Недостаточно прав для этой коллекции' }); return; }

    // ----- LIST -----
    if (action === 'list' && req.method === 'GET') {
      const items = await ghList(col.dir);
      const out = (items || []).filter((f) => f.name.endsWith('.json')).map((f) => ({
        slug: f.name.replace(/\.json$/, ''),
        path: f.path,
        sha: f.sha,
      }));
      // Load content for each (parallel) — для маленьких коллекций ок, для больших можно ленивее
      const enriched = await Promise.all(out.map(async (it) => {
        const f = await ghGet(it.path);
        try { it.data = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')); } catch (e) { it.data = {}; }
        return it;
      }));
      res.status(200).json({ items: enriched });
      return;
    }

    // ----- GET single -----
    if (action === 'get' && req.method === 'GET') {
      if (!slug) { res.status(400).json({ error: 'slug обязателен' }); return; }
      const path = `${col.dir}/${slug}.json`;
      const f = await ghGet(path);
      if (!f) { res.status(404).json({ error: 'Не найдено' }); return; }
      const data = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));
      res.status(200).json({ slug, data, sha: f.sha });
      return;
    }

    // ----- SAVE (create or update) -----
    if (action === 'save' && req.method === 'POST') {
      const body = await readJson(req);
      const targetSlug = (body.slug || '').toString().trim();
      const data = body.data || {};
      const sha = body.sha || null;
      if (!targetSlug) { res.status(400).json({ error: 'slug обязателен' }); return; }
      // Sanitize slug
      const safeSlug = targetSlug.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
      if (!safeSlug) { res.status(400).json({ error: 'Неверный slug' }); return; }
      const path = `${col.dir}/${safeSlug}.json`;
      const content = JSON.stringify(data, null, 2) + '\n';
      const message = `cms(${collection}): ${sha ? 'update' : 'create'} ${safeSlug} (by ${session.name || session.sub})`;
      const result = await ghPut(path, content, message, sha);
      // Rebuild collection index after save (best effort)
      if (collection !== 'settings') {
        try { await rebuildIndex(collection); } catch (e) { /* ignore */ }
      }
      res.status(200).json({ ok: true, slug: safeSlug, sha: result.content?.sha });
      return;
    }

    // ----- DELETE -----
    if (action === 'delete' && req.method === 'POST') {
      const body = await readJson(req);
      const targetSlug = (body.slug || slug).toString().trim();
      if (!targetSlug) { res.status(400).json({ error: 'slug обязателен' }); return; }
      const path = `${col.dir}/${targetSlug}.json`;
      const f = await ghGet(path);
      if (!f) { res.status(404).json({ error: 'Не найдено' }); return; }
      const message = `cms(${collection}): delete ${targetSlug} (by ${session.name || session.sub})`;
      await ghDelete(path, f.sha, message);
      try { await rebuildIndex(collection); } catch (e) {}
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Неизвестное действие' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function rebuildIndex(collection) {
  const col = COLLECTIONS[collection];
  const items = await ghList(col.dir);
  const slugs = (items || [])
    .filter((f) => f.name.endsWith('.json'))
    .map((f) => f.name.replace(/\.json$/, ''))
    .sort()
    .reverse();
  const path = `content/${collection}.index.json`;
  const existing = await ghGet(path);
  const content = JSON.stringify(slugs, null, 2) + '\n';
  await ghPut(path, content, `cms: rebuild ${collection} index`, existing?.sha || null);
}
