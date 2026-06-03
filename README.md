# META College — сайт + админка (Vercel + Sveltia CMS)

Современный многостраничный сайт колледжа META College в Алматы с git-based CMS для редактирования контента без программистов. Деплой на Vercel.

Светлая премиум-палитра, бренд-красный `#D42B2B → #E85D2A`, шрифт Onest. Двуязычный (RU/KZ).

---

## 🚀 Деплой на Vercel — 3 минуты

1. Залогинься на [vercel.com](https://vercel.com) через GitHub.
2. **New Project** → Import `exeslam/metacollege` → Deploy.
3. Через 30 секунд получишь `metacollege.vercel.app` — сайт уже работает.

Никаких build-команд не нужно — статика + serverless functions для админки.

---

## 🛠️ Подключение админки — 5 минут

Админка живёт на `https://твой-домен/admin/`. После настройки:
- Редакторы логинятся через GitHub
- Создают новости/статьи/выпускников через визуальную форму
- Изменения автоматически коммитятся в репо
- Vercel ловит коммит и пересобирает сайт (30 сек)
- Новость появляется на сайте без программиста

### Вариант A — Sveltia CMS с публичным OAuth (рекомендуется)

**0 кода. 0 настроек.** Просто работает.

1. Зайди на `https://твой-домен.vercel.app/admin/`
2. Sveltia покажет кнопку «Login with GitHub»
3. Авторизуйся → получишь доступ к админке

Прокси `sveltia.dev` авторизует тебя через GitHub OAuth. Поддерживает unlimited public репозиториев бесплатно.

**Если репо приватный**, используй вариант B.

### Вариант B — собственный OAuth-прокси на Vercel

Уже подготовлено: `api/auth.js` + `api/callback.js`. Нужно только:

1. **Создать GitHub OAuth App**
   - GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**
   - Application name: `META College CMS`
   - Homepage URL: `https://твой-домен.vercel.app`
   - Authorization callback URL: `https://твой-домен.vercel.app/api/callback`
   - Скопируй **Client ID**, нажми **Generate a new client secret**, скопируй **Client Secret**

2. **Добавить ENV vars в Vercel**
   - Vercel Dashboard → твой проект → Settings → Environment Variables
   - Добавить:
     - `OAUTH_CLIENT_ID` = (значение из GitHub)
     - `OAUTH_CLIENT_SECRET` = (значение из GitHub)
   - Redeploy

3. **Подключить в config.yml**
   В файле `admin/config.yml` раскомментируй:
   ```yaml
   base_url: https://твой-домен.vercel.app
   auth_endpoint: /api/auth
   ```

4. **Готово** — открой `/admin/`, логинься через свой OAuth.

---

## 📂 Структура

```
metacollege/
├── index.html, specialties.html, campus.html, …    # Базовые страницы
├── program-*.html (10 шт.)                          # Страницы каждой программы
├── news.html, blog.html, post.html, teachers.html   # Динамические (из CMS)
├── admin/
│   ├── index.html                                   # Sveltia CMS UI
│   └── config.yml                                   # Схема коллекций
├── api/
│   ├── auth.js                                      # OAuth start (опционально)
│   └── callback.js                                  # OAuth callback (опционально)
├── content/                                          # Контент CMS (JSON)
│   ├── news/, posts/, alumni/, teachers/
│   ├── settings/{home,contacts}.json
│   └── *.index.json                                 # Списки slug'ов
├── .github/workflows/build-index.yml                # Auto-rebuild индексов
├── assets/
│   ├── css/styles.css
│   ├── js/main.js, cms.js
│   └── img/{logo.svg, og.jpg, photos/}
├── vercel.json                                       # Vercel конфиг
├── robots.txt, sitemap.xml
└── README.md
```

---

## ✏️ Коллекции в админке

| Коллекция | Куда выводится | Что редактируется |
|---|---|---|
| **Новости** | `news.html` + блок «Последние новости» на главной | Заголовок, дата, обложка, Markdown-текст, тег, флаг «закрепить» |
| **Блог / статьи** | `blog.html` | + автор, категория, время чтения |
| **Выпускники** | Будущая страница `/alumni`, секция testimonials | Имя, фото, программа, год выпуска, должность, цитата |
| **Преподаватели** | `teachers.html` | Фото, должность, кафедра, опыт, био |
| **Настройки** | Главная, footer | Цифры hero, контакты, режим работы |

При сохранении в админке Decap/Sveltia пушит JSON-файл в `content/<коллекция>/` и автоматически обновляет `content/<коллекция>.index.json` через GitHub Action в `.github/workflows/build-index.yml`.

---

## 🌐 Custom domain

1. Vercel Dashboard → проект → Settings → Domains
2. Add domain: `meta-college.kz`
3. Vercel покажет DNS-записи. Добавь их у своего регистратора (PS Internet или где зарегистрирован домен).
4. Через 5–60 минут — SSL и сайт работают.

---

## 💻 Локальный запуск

```bash
cd "/Users/umar/Documents/metacollege"
python3 -m http.server 8000
# Открыть http://localhost:8000
```

Админка локально работать НЕ будет — для OAuth-flow нужен реальный домен. Для тестирования контента редактируй JSON-файлы в `content/` напрямую.

---

## 🎨 Стек

- HTML / CSS / Vanilla JS (без сборки)
- [Sveltia CMS](https://github.com/sveltia/sveltia-cms) для админки
- Vercel — деплой и serverless functions
- Onest шрифт, фирменные SVG-логотипы
- Open Graph (`assets/img/og.jpg`)

---

## 📞 Контакты колледжа

- Адрес: ул. Наурызбай батыра, 9, Алматы
- Тел: +7 (775) 500-97-45
- Instagram: [@metacollegekz](https://instagram.com/metacollegekz)
- Email: info@meta-college.kz
