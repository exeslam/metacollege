// Приём заявок с формы сайта → amoCRM/Kommo (API v4, Неразобранное — Форма)
// ENV:
//   AMOCRM_SUBDOMAIN — например "metacollege" (для .amocrm.ru)
//   AMOCRM_HOST      — опционально: полный host, например "metacollege.kommo.com"
//   AMOCRM_ACCESS_TOKEN — долгоживущий токен интеграции
//   AMOCRM_PIPELINE_ID  — id воронки (опционально)
//   LEAD_NOTIFY_TG_TOKEN + LEAD_NOTIFY_TG_CHAT — опционально: параллельно шлём в Telegram

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function normPhone(v) {
  if (!v) return '';
  return String(v).replace(/[^\d+]/g, '');
}

function getAmoHost() {
  if (process.env.AMOCRM_HOST) return process.env.AMOCRM_HOST;
  const sub = process.env.AMOCRM_SUBDOMAIN;
  if (!sub) return null;
  return `${sub}.amocrm.ru`;
}

async function sendToAmo(lead) {
  const host = getAmoHost();
  const token = process.env.AMOCRM_ACCESS_TOKEN;
  if (!host || !token) return { ok: false, skipped: true, reason: 'no_amocrm_env' };

  const url = `https://${host}/api/v4/leads/unsorted/forms`;
  const now = Math.floor(Date.now() / 1000);

  const contactFields = [
    { field_code: 'PHONE', values: [{ value: lead.phone, enum_code: 'MOB' }] },
  ];
  if (lead.email) {
    contactFields.push({ field_code: 'EMAIL', values: [{ value: lead.email, enum_code: 'WORK' }] });
  }

  const leadBody = {
    name: `Заявка с сайта${lead.program ? ' — ' + lead.program : ''}`,
    _embedded: { tags: [{ name: 'сайт' }, { name: lead.program || 'без программы' }] },
  };
  if (process.env.AMOCRM_PIPELINE_ID) {
    leadBody.pipeline_id = Number(process.env.AMOCRM_PIPELINE_ID);
  }

  const payload = [{
    source_name: 'Сайт META College',
    source_uid: `meta-college-form-${now}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: now,
    metadata: {
      form_id: 'admission-form',
      form_name: 'Заявка на поступление',
      form_page: lead.page || 'https://meta-college.vercel.app/admission.html',
      form_sent_at: now,
      ip: lead.ip || '',
      referer: lead.referer || '',
    },
    pipeline_id: process.env.AMOCRM_PIPELINE_ID ? Number(process.env.AMOCRM_PIPELINE_ID) : undefined,
    _embedded: {
      contacts: [{ name: lead.name, custom_fields_values: contactFields }],
      leads: [leadBody],
    },
  }];

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (!r.ok) {
    return { ok: false, status: r.status, body: text.slice(0, 500) };
  }
  return { ok: true, status: r.status };
}

async function sendToTelegram(lead) {
  const token = process.env.LEAD_NOTIFY_TG_TOKEN;
  const chat = process.env.LEAD_NOTIFY_TG_CHAT;
  if (!token || !chat) return { ok: false, skipped: true };
  const text = [
    '🎓 Новая заявка с сайта',
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    lead.email ? `Email: ${lead.email}` : '',
    lead.program ? `Программа: ${lead.program}` : '',
    lead.comment ? `Комментарий: ${lead.comment}` : '',
    lead.page ? `Страница: ${lead.page}` : '',
    lead.utm ? `UTM: ${JSON.stringify(lead.utm)}` : '',
  ].filter(Boolean).join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export default async function handler(req, res) {
  // CORS для локальной разработки (при желании ужесточим)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const body = await readJson(req);

    // Honeypot: если бот заполнил поле "website" — молча делаем вид, что ок
    if (body.website && String(body.website).trim().length > 0) {
      res.status(200).json({ ok: true });
      return;
    }

    const name = String(body.name || '').trim();
    const phone = normPhone(body.phone);
    const email = String(body.email || '').trim();
    const program = String(body.program || '').trim();
    const comment = String(body.comment || '').trim();
    const page = String(body.page || '').trim();
    const referer = String(body.referer || req.headers['referer'] || '').trim();
    const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};

    if (!name || name.length < 2) { res.status(400).json({ error: 'Укажите имя' }); return; }
    if (!phone || phone.length < 7) { res.status(400).json({ error: 'Укажите телефон' }); return; }

    const ip = String(
      req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || ''
    ).split(',')[0].trim();

    const lead = { name, phone, email, program, comment, page, referer, utm, ip };

    // Параллельно отправляем в amoCRM и Telegram (если настроены)
    const [amo, tg] = await Promise.all([sendToAmo(lead), sendToTelegram(lead)]);

    if (!amo.ok && !amo.skipped) {
      // amoCRM настроен, но ответил ошибкой — сообщаем клиенту 502, но лид считается принят
      console.error('amoCRM error:', amo);
      res.status(502).json({ error: 'CRM недоступна, но мы получили заявку. Позвоним по указанному телефону.' });
      return;
    }

    res.status(200).json({ ok: true, amo: amo.ok ? 'sent' : (amo.skipped ? 'skipped' : 'error'), tg: tg.ok ? 'sent' : 'skipped' });
  } catch (e) {
    console.error('lead handler error:', e);
    res.status(500).json({ error: 'Не получилось обработать заявку. Позвоните нам: +7 (775) 500-97-45' });
  }
}
