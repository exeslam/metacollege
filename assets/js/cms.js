/* META College — CMS content loader
   Loads JSON from /content/ and renders cards / post detail.
   Supports: news, posts, alumni, teachers. */

(() => {
  const fmtDate = (iso, lang = 'ru') => {
    try {
      const d = new Date(iso);
      const months = lang === 'kz'
        ? ['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан']
        : ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) { return iso; }
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

  // Minimal Markdown → HTML (headings, lists, bold, italic, links, paragraphs)
  const mdToHtml = (md = '') => {
    const lines = md.split(/\r?\n/);
    let html = '', inList = false, inOlList = false;
    const closeLists = () => {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOlList) { html += '</ol>'; inOlList = false; }
    };
    const inline = (s) =>
      s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/\*(.+?)\*/g, '<em>$1</em>')
       .replace(/`(.+?)`/g, '<code>$1</code>')
       .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { closeLists(); continue; }
      if (line.startsWith('### ')) { closeLists(); html += `<h3>${inline(escapeHtml(line.slice(4)))}</h3>`; continue; }
      if (line.startsWith('## '))  { closeLists(); html += `<h2>${inline(escapeHtml(line.slice(3)))}</h2>`; continue; }
      if (line.startsWith('# '))   { closeLists(); html += `<h2>${inline(escapeHtml(line.slice(2)))}</h2>`; continue; }
      if (/^[-*] /.test(line))     {
        if (!inList) { closeLists(); html += '<ul>'; inList = true; }
        html += `<li>${inline(escapeHtml(line.replace(/^[-*]\s+/, '')))}</li>`; continue;
      }
      if (/^\d+\. /.test(line))    {
        if (!inOlList) { closeLists(); html += '<ol>'; inOlList = true; }
        html += `<li>${inline(escapeHtml(line.replace(/^\d+\.\s+/, '')))}</li>`; continue;
      }
      closeLists();
      html += `<p>${inline(escapeHtml(line))}</p>`;
    }
    closeLists();
    return html;
  };

  async function loadJSON(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error('Not found: ' + path);
    return r.json();
  }

  async function loadCollection(name) {
    const index = await loadJSON(`content/${name}.index.json`);
    const items = await Promise.all(index.map(async (slug) => {
      const data = await loadJSON(`content/${name}/${slug}.json`);
      return { slug, ...data };
    }));
    return items;
  }

  // ===== NEWS / BLOG LIST =====
  async function renderList(target, kind) {
    try {
      const items = await loadCollection(kind);
      if (!items.length) { target.innerHTML = '<p style="color:var(--muted)">Пока пусто.</p>'; return; }
      target.innerHTML = items.map((it) => `
        <a class="post-card reveal in-view" href="${kind === 'news' ? 'news' : 'post'}.html?slug=${encodeURIComponent(it.slug)}">
          ${it.cover ? `<div class="post-cover"><img src="${escapeHtml(it.cover)}" alt="${escapeHtml(it.title || it.name)}" loading="lazy"></div>` : ''}
          <div class="post-body">
            ${it.tag || it.category ? `<span class="post-tag">${escapeHtml(it.tag || it.category)}</span>` : ''}
            <h3>${escapeHtml(it.title || it.name)}</h3>
            ${it.excerpt ? `<p>${escapeHtml(it.excerpt)}</p>` : ''}
            <div class="post-meta">
              ${it.date ? `<span>${fmtDate(it.date)}</span>` : ''}
              ${it.reading_time ? `<span>· ${it.reading_time} мин чтения</span>` : ''}
              ${it.author ? `<span>· ${escapeHtml(it.author)}</span>` : ''}
            </div>
          </div>
        </a>
      `).join('');
    } catch (e) {
      target.innerHTML = `<p style="color:var(--muted)">Не удалось загрузить контент: ${escapeHtml(e.message)}</p>`;
    }
  }

  // ===== DETAIL (news.html?slug=... or post.html?slug=...) =====
  async function renderDetail(target, kind) {
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug');
    if (!slug) {
      target.innerHTML = `<p>Не указан slug. Вернись на <a href="${kind}s.html" style="color:var(--accent)">страницу со списком</a>.</p>`;
      return;
    }
    try {
      const data = await loadJSON(`content/${kind === 'news' ? 'news' : 'posts'}/${slug}.json`);
      document.title = `${data.title} — META College`;
      target.innerHTML = `
        <article class="post-detail">
          ${data.tag || data.category ? `<span class="post-tag">${escapeHtml(data.tag || data.category)}</span>` : ''}
          <h1>${escapeHtml(data.title)}</h1>
          <div class="post-meta">
            ${data.date ? `<span>${fmtDate(data.date)}</span>` : ''}
            ${data.author ? `<span>· ${escapeHtml(data.author)}</span>` : ''}
            ${data.reading_time ? `<span>· ${data.reading_time} мин чтения</span>` : ''}
          </div>
          ${data.cover ? `<div class="post-cover-big"><img src="${escapeHtml(data.cover)}" alt="${escapeHtml(data.title)}"></div>` : ''}
          <div class="post-content">${mdToHtml(data.body || '')}</div>
          <div class="post-back"><a class="btn btn-ghost" href="${kind}s.html">← ${kind === 'news' ? 'Все новости' : 'Весь блог'}</a></div>
        </article>
      `;
    } catch (e) {
      target.innerHTML = `<p>Материал не найден. <a href="${kind}s.html" style="color:var(--accent)">К списку</a>.</p>`;
    }
  }

  // ===== TEACHERS =====
  async function renderTeachers(target) {
    try {
      const items = await loadCollection('teachers');
      target.innerHTML = items.map((t) => `
        <div class="teacher-card reveal in-view">
          ${t.photo ? `<div class="teacher-photo"><img src="${escapeHtml(t.photo)}" alt="${escapeHtml(t.name)}" loading="lazy"></div>` : `<div class="teacher-photo"></div>`}
          <div class="teacher-body">
            <div class="teacher-dept">${escapeHtml(t.department)}</div>
            <h3>${escapeHtml(t.name)}</h3>
            <p class="teacher-pos">${escapeHtml(t.position)}</p>
            <p class="teacher-exp">${t.experience}+ лет опыта</p>
            ${t.bio ? `<p class="teacher-bio">${escapeHtml(t.bio)}</p>` : ''}
          </div>
        </div>
      `).join('');
    } catch (e) {
      target.innerHTML = `<p style="color:var(--muted)">Не удалось загрузить: ${escapeHtml(e.message)}</p>`;
    }
  }

  // ===== HOME WIDGETS =====
  async function renderHomeNews(target) {
    try {
      const items = await loadCollection('news');
      const featured = items.filter(i => i.featured).slice(0, 3);
      const toShow = featured.length ? featured : items.slice(0, 3);
      target.innerHTML = toShow.map((it) => `
        <a class="post-card reveal in-view" href="news.html?slug=${encodeURIComponent(it.slug)}">
          ${it.cover ? `<div class="post-cover"><img src="${escapeHtml(it.cover)}" alt="" loading="lazy"></div>` : ''}
          <div class="post-body">
            ${it.tag ? `<span class="post-tag">${escapeHtml(it.tag)}</span>` : ''}
            <h3>${escapeHtml(it.title)}</h3>
            <div class="post-meta"><span>${fmtDate(it.date)}</span></div>
          </div>
        </a>
      `).join('');
    } catch (e) {}
  }

  // ===== BOOT =====
  const newsList    = document.querySelector('[data-cms="news-list"]');
  const blogList    = document.querySelector('[data-cms="blog-list"]');
  const newsDetail  = document.querySelector('[data-cms="news-detail"]');
  const postDetail  = document.querySelector('[data-cms="post-detail"]');
  const teachers    = document.querySelector('[data-cms="teachers"]');
  const homeNews    = document.querySelector('[data-cms="home-news"]');

  if (newsList)   renderList(newsList, 'news');
  if (blogList)   renderList(blogList, 'posts');
  if (newsDetail) renderDetail(newsDetail, 'news');
  if (postDetail) renderDetail(postDetail, 'post');
  if (teachers)   renderTeachers(teachers);
  if (homeNews)   renderHomeNews(homeNews);
})();
