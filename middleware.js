// Этот файл намеренно пустой. Защита /admin/ работает через JS-проверку /api/me
// в admin-app.js (если сессии нет — редирект на /admin/login.html).
//
// Если в будущем понадобится server-side проверка, можно добавить Edge Middleware:
// https://vercel.com/docs/functions/edge-middleware
export default function noop() {}
