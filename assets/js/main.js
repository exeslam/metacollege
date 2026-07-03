/* META College — interaction layer */

(() => {
  const html = document.documentElement;
  html.classList.add('js');

  /* ---------- Language switcher (RU / KZ) ---------- */
  const STORAGE_KEY = 'meta-college-lang';
  const setLang = (lang) => {
    html.setAttribute('data-lang', lang);
    document.querySelectorAll('[data-ru]').forEach((el) => {
      const ru = el.getAttribute('data-ru');
      const kz = el.getAttribute('data-kz') || ru;
      el.textContent = lang === 'kz' ? kz : ru;
    });
    document.querySelectorAll('.lang-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.lang === lang);
    });
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  };
  const initialLang = (() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'ru'; } catch (e) { return 'ru'; }
  })();
  setLang(initialLang);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn');
    if (btn) setLang(btn.dataset.lang);
  });

  /* ---------- Mobile menu ---------- */
  const menu = document.querySelector('.mobile-menu');
  const openBtn = document.querySelector('.menu-toggle');
  const closeBtn = document.querySelector('.mobile-menu .close-btn');
  if (openBtn && menu) {
    openBtn.addEventListener('click', () => menu.classList.add('open'));
  }
  if (closeBtn && menu) {
    closeBtn.addEventListener('click', () => menu.classList.remove('open'));
  }
  if (menu) {
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
  }

  /* ---------- Scroll reveal ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -10px 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in-view'));
  }
  // Hard fallback: if for any reason animations haven't run within 2.5s, force everything visible
  setTimeout(() => { html.classList.add('show-all'); }, 2500);
  // Also force-show on print and when reduced motion is preferred
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    html.classList.add('show-all');
  }

  /* ---------- Counter animation ---------- */
  const animateCount = (el) => {
    const raw = el.dataset.count;
    if (!raw) return;
    const target = parseFloat(raw);
    const duration = 1400;
    const start = performance.now();
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const isFloat = !Number.isInteger(target);
    const fmt = (n) => {
      const v = isFloat ? n.toFixed(1) : Math.round(n).toLocaleString('ru-RU');
      return prefix + v + suffix;
    };
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * ease);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        countIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-count]').forEach((el) => countIO.observe(el));

  /* ---------- Specialty filter (specialties.html) ---------- */
  const filter = document.querySelector('.spec-filter');
  if (filter) {
    filter.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cluster]');
      if (!btn) return;
      filter.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const cluster = btn.dataset.cluster;
      document.querySelectorAll('.spec-card').forEach((card) => {
        const show = cluster === 'all' || card.dataset.cluster === cluster;
        card.style.display = show ? '' : 'none';
      });
    });
  }

  /* ---------- Tilt 3D on cards ---------- */
  document.querySelectorAll('.tilt').forEach((el) => {
    let rect;
    const max = 8;
    el.addEventListener('mouseenter', () => { rect = el.getBoundingClientRect(); });
    el.addEventListener('mousemove', (e) => {
      if (!rect) rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      el.style.transform = `perspective(900px) rotateX(${(-dy * max).toFixed(2)}deg) rotateY(${(dx * max).toFixed(2)}deg) translateY(-6px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });

  /* ---------- Magnetic buttons ---------- */
  document.querySelectorAll('.magnetic').forEach((el) => {
    const strength = 18;
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate(${(dx / rect.width) * strength}px, ${(dy / rect.height) * strength}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });

  /* ---------- Parallax on hero blobs ---------- */
  const hero = document.querySelector('.hero');
  if (hero) {
    const blobs = hero.querySelectorAll('[data-parallax]');
    if (blobs.length) {
      window.addEventListener('scroll', () => {
        const y = window.scrollY;
        blobs.forEach((b) => {
          const speed = parseFloat(b.dataset.parallax || '0.2');
          b.style.transform = `translateY(${y * speed}px)`;
        });
      }, { passive: true });
    }
  }

  /* ---------- Form submit → /api/lead → amoCRM ---------- */
  const form = document.querySelector('form.app-form');
  if (form) {
    // Собираем UTM из URL и кладём в скрытые поля
    const utm = {};
    try {
      const p = new URLSearchParams(location.search);
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'].forEach(k => {
        const v = p.get(k); if (v) utm[k] = v;
      });
    } catch(e){}

    const statusEl = form.querySelector('#lead-status');
    const setStatus = (msg, ok) => {
      if (!statusEl) return;
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.style.color = ok ? 'var(--accent)' : '#c0392b';
      statusEl.style.fontWeight = '600';
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const origLabel = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Отправляем…'; btn.style.opacity = '.85'; }
      if (statusEl) statusEl.hidden = true;

      const fd = new FormData(form);
      const payload = {
        name: fd.get('name') || '',
        phone: fd.get('phone') || '',
        program: fd.get('program') || '',
        comment: fd.get('comment') || '',
        website: fd.get('website') || '', // honeypot
        page: location.href,
        referer: document.referrer || '',
        utm,
      };

      try {
        const r = await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Ошибка отправки');
        if (btn) { btn.textContent = '✓ Заявка отправлена'; btn.style.opacity = '.9'; }
        setStatus('Спасибо! Мы свяжемся в течение рабочего дня.', true);
        form.reset();
      } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = origLabel || 'Отправить заявку'; btn.style.opacity = '1'; }
        setStatus((err && err.message) ? err.message : 'Не удалось отправить. Позвоните: +7 (775) 500-97-45', false);
      }
    });
  }
})();
