# META College — сайт

Современный многостраничный сайт колледжа META College в Алматы. 9 образовательных программ, 1500+ студентов, 25 лет опыта.

Светлая премиум-палитра, бренд-красный `#D42B2B → #E85D2A`, шрифт Onest. Двуязычный (RU/KZ).

## Структура

```
metacollege/
├── index.html          # Главная (hero, marquee, kinetic, программы, META Life, партнёры, шаги, CTA)
├── specialties.html    # 9 программ с фильтром по 4 кластерам
├── campus.html         # Кампус и META LIFE (спорт, киберспорт, English Club, гитара, Art)
├── admission.html      # 3 шага поступления, форма заявки, FAQ
├── about.html          # История (ЕАТК → META), карьера, цифры
├── contacts.html       # Контакты, карта, часы работы
├── assets/
│   ├── css/styles.css  # Дизайн-система
│   ├── js/main.js      # Анимации, RU/KZ, tilt, magnetic, mobile menu
│   └── img/
│       ├── logo.svg
│       └── logo-mark.svg
├── robots.txt
└── sitemap.xml
```

## Вау-эффекты

- Анимированный mesh-blob в hero (oranжево-красный плавающий градиент)
- Stagger-анимация слов в заголовке
- Параллакс на плавающих карточках с цифрами
- Бегущая marquee-лента с ключевыми цифрами
- Гигантский kinetic-заголовок «META COLLEGE · ALMATY · 2026»
- 3D tilt на cluster-карточках
- Magnetic-эффект на CTA-кнопках
- Floating CTA-чип «Подать заявку» внизу справа
- Плавные scroll-reveal анимации

## SEO

Подключены: meta-теги, Open Graph, Schema.org `EducationalOrganization`, `robots.txt`, `sitemap.xml`.

## Локальный запуск

Просто открой `index.html` в браузере. Или подними простой сервер:

```bash
python3 -m http.server 8000
# Открыть http://localhost:8000
```

## Деплой

Сайт — статика, готова к Vercel/Netlify/GitHub Pages:

- **Vercel:** подключить репо, deploy запустится автоматически
- **Netlify:** перетащить папку в Netlify Drop или подключить репо
- **GitHub Pages:** Settings → Pages → Branch: main → Save

## Источник истины

Цифры и контент взяты из официальной презентации `колледж.pdf`. Старый сайт оставлен в подпапке `старый сайт/` (исключена через `.gitignore`).

## Контакты колледжа

- Адрес: ул. Наурызбай батыра, 9, Алматы
- Тел: +7 (775) 500-97-45
- Instagram: [@metacollegekz](https://instagram.com/metacollegekz)
- Email: info@meta-college.kz
