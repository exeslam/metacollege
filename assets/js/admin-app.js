/* META College admin UI */
(() => {
  // ---- Collection schemas (форма редактирования) ----
  const SCHEMAS = {
    news: {
      label: 'Новости',
      singular: 'Новость',
      slugFrom: 'title',
      fields: [
        { name: 'title',    label: 'Заголовок',       type: 'text',     required: true },
        { name: 'date',     label: 'Дата',            type: 'datetime', required: true, default: () => new Date().toISOString() },
        { name: 'cover',    label: 'Обложка (URL)',   type: 'image',    help: 'Например: /assets/img/photos/group-friends.webp' },
        { name: 'tag',      label: 'Тег',             type: 'select',   options: ['Анонс','Достижение','Новости','Партнёры','Поступление'], default: 'Новости' },
        { name: 'excerpt',  label: 'Краткое описание',type: 'textarea' },
        { name: 'body',     label: 'Текст (Markdown)',type: 'markdown', required: true },
        { name: 'featured', label: 'Закрепить в главных', type: 'checkbox' },
      ],
    },
    posts: {
      label: 'Блог',
      singular: 'Статья',
      slugFrom: 'title',
      fields: [
        { name: 'title',        label: 'Заголовок',          type: 'text', required: true },
        { name: 'date',         label: 'Дата',               type: 'datetime', required: true, default: () => new Date().toISOString() },
        { name: 'cover',        label: 'Обложка (URL)',      type: 'image' },
        { name: 'author',       label: 'Автор',              type: 'text', default: 'META College' },
        { name: 'category',     label: 'Категория',          type: 'select', options: ['Поступление','Учёба','Карьера','Жизнь в колледже','Истории'], default: 'Учёба' },
        { name: 'reading_time', label: 'Время чтения (мин)', type: 'number', default: 5 },
        { name: 'excerpt',      label: 'Краткое описание',   type: 'textarea' },
        { name: 'body',         label: 'Текст (Markdown)',   type: 'markdown', required: true },
      ],
    },
    alumni: {
      label: 'Выпускники',
      singular: 'Выпускник',
      slugFrom: 'name',
      fields: [
        { name: 'name',            label: 'Имя и фамилия', type: 'text', required: true },
        { name: 'photo',           label: 'Фото (URL)',    type: 'image' },
        { name: 'program',         label: 'Программа',     type: 'text' },
        { name: 'graduation_year', label: 'Год выпуска',   type: 'number' },
        { name: 'company',         label: 'Место работы',  type: 'text' },
        { name: 'position',        label: 'Должность',     type: 'text' },
        { name: 'quote',           label: 'Цитата',        type: 'textarea' },
      ],
    },
    teachers: {
      label: 'Преподаватели',
      singular: 'Преподаватель',
      slugFrom: 'name',
      fields: [
        { name: 'name',       label: 'Имя и фамилия', type: 'text', required: true },
        { name: 'photo',      label: 'Фото (URL)',    type: 'image' },
        { name: 'position',   label: 'Должность',     type: 'text' },
        { name: 'department', label: 'Кафедра',       type: 'select', options: ['IT','Экономика','Автотранспорт','Аграрные','Общие дисциплины'] },
        { name: 'experience', label: 'Опыт (лет)',    type: 'number', default: 5 },
        { name: 'bio',        label: 'Биография',     type: 'textarea' },
      ],
    },
    settings: {
      label: 'Настройки сайта',
      singular: 'Файл настроек',
      readOnlySlug: true,
      fields: [
        { name: 'hero_title',    label: 'Заголовок hero',     type: 'text' },
        { name: 'hero_subtitle', label: 'Подзаголовок',       type: 'textarea' },
        { name: 'badge',         label: 'Бейдж (Набор открыт)', type: 'text' },
        { name: 'phone_display', label: 'Телефон отображение', type: 'text' },
        { name: 'phone',         label: 'Телефон (raw)',       type: 'text' },
        { name: 'email',         label: 'Email',               type: 'text' },
        { name: 'address',       label: 'Адрес',               type: 'text' },
        { name: 'instagram',     label: 'Instagram URL',       type: 'text' },
      ],
    },
  };

  let me = null;
  let current = 'news';
  let editing = null; // { slug, sha, data } или null = новая

  // ---- DOM ----
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---- Boot ----
  init();

  async function init() {
    // Check session
    const r = await fetch('/api/me');
    if (!r.ok) { location.href = '/admin/login.html'; return; }
    me = await r.json();
    renderUser();
    bindNav();
    bindHeader();
    bindModal();
    await loadCollection('news');
  }

  function renderUser() {
    $('#user-name').textContent = me.name || me.email;
    $('#user-role').textContent = me.role === 'admin' ? 'Администратор' : 'Редактор';
    $('#user-avatar').textContent = (me.name || me.email || '?').slice(0, 1).toUpperCase();
    $('#logout-btn').onclick = async () => {
      await fetch('/api/logout', { method: 'POST' });
      location.href = '/admin/login.html';
    };
  }

  function bindNav() {
    $$('.admin-nav a').forEach((a) => {
      a.addEventListener('click', () => {
        const c = a.dataset.collection;
        if (!c) return;
        $$('.admin-nav a').forEach((x) => x.classList.remove('active'));
        a.classList.add('active');
        current = c;
        loadCollection(c);
      });
    });
  }

  function bindHeader() {
    $('#new-btn').addEventListener('click', () => openEditor(null));
  }

  function bindModal() {
    $('#modal-close').onclick = closeEditor;
    $('#cancel-btn').onclick = closeEditor;
    $('#save-btn').onclick = saveEntry;
    $('.modal-backdrop').onclick = closeEditor;
  }

  async function loadCollection(name) {
    const schema = SCHEMAS[name];
    $('#page-title').textContent = schema.label;
    $('#new-btn').textContent = name === 'settings' ? '' : `+ Добавить ${schema.singular.toLowerCase()}`;
    $('#new-btn').style.display = name === 'settings' ? 'none' : '';

    const content = $('#admin-content');
    content.innerHTML = '<div class="loader">Загрузка…</div>';

    try {
      const r = await fetch(`/api/content?action=list&collection=${name}`);
      if (!r.ok) throw new Error((await r.json()).error || 'Ошибка');
      const { items } = await r.json();
      if (!items.length) {
        content.innerHTML = `<div class="empty">Пока ничего нет. Нажми «+ Добавить» чтобы создать первую запись.</div>`;
        return;
      }
      content.innerHTML = '';
      items.sort((a, b) => {
        const da = a.data?.date || a.slug;
        const db = b.data?.date || b.slug;
        return db.localeCompare(da);
      });
      for (const it of items) content.appendChild(entryCard(name, it));
    } catch (e) {
      content.innerHTML = `<div class="empty" style="color:#b91c1c;">${e.message}</div>`;
    }
  }

  function entryCard(collection, item) {
    const d = item.data || {};
    const div = document.createElement('div');
    div.className = 'entry-card';
    const title = d.title || d.name || item.slug;
    const cover = d.cover || d.photo;
    const meta = [];
    if (d.date) meta.push(new Date(d.date).toLocaleDateString('ru-RU'));
    if (d.tag) meta.push(d.tag);
    if (d.category) meta.push(d.category);
    if (d.program) meta.push(d.program);
    if (d.department) meta.push(d.department);
    if (d.author) meta.push('— ' + d.author);

    div.innerHTML = `
      <div class="thumb">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : '📄'}</div>
      <div class="body">
        <h3>${escapeHtml(title)}</h3>
        <div class="meta">${meta.map(escapeHtml).join(' · ')}</div>
      </div>
      <div class="actions">
        <button class="edit">Изменить</button>
        <button class="del">Удалить</button>
      </div>`;
    div.querySelector('.edit').onclick = () => openEditor(item);
    div.querySelector('.del').onclick = () => deleteEntry(collection, item);
    return div;
  }

  async function openEditor(item) {
    try {
      console.log('[admin] openEditor', { current, item });
      const schema = SCHEMAS[current];
      if (!schema) throw new Error(`SCHEMAS["${current}"] не найдена`);
      editing = item; // null = новая запись
      $('#modal-title').textContent = item ? `Редактирование: ${item.data?.title || item.data?.name || item.slug}` : `Новая запись: ${schema.singular}`;
      $('#editor-modal').hidden = false;

      const form = $('#editor-form');
      form.innerHTML = '';

      // Slug field (для новой; для существующей показываем readonly)
      if (current !== 'settings') {
        const slugField = field({
          name: '__slug', label: 'URL-идентификатор (slug)',
          type: 'text', help: 'Латиница, цифры и дефис. Можно оставить пустым — сгенерируется автоматически.',
        }, item?.slug || '');
        if (item) {
          const inp = slugField.querySelector('input');
          if (inp) inp.readOnly = true;
        }
        form.appendChild(slugField);
      }

      for (const f of schema.fields) {
        const val = item?.data?.[f.name] ?? (typeof f.default === 'function' ? f.default() : f.default);
        try {
          form.appendChild(field(f, val));
        } catch (e) {
          console.error('Ошибка рендера поля', f, e);
          throw new Error(`Поле «${f.label}» (${f.type}): ${e.message}`);
        }
      }
      console.log('[admin] form rendered, fields:', form.children.length);
    } catch (e) {
      console.error('openEditor failed:', e);
      alert('Ошибка открытия редактора: ' + e.message);
      $('#editor-modal').hidden = true;
    }
  }

  function field(f, value) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = f.label + (f.required ? ' *' : '');
    wrap.appendChild(label);

    let el;
    if (f.type === 'textarea') {
      el = document.createElement('textarea');
      el.value = value || '';
    } else if (f.type === 'markdown') {
      el = document.createElement('textarea');
      el.className = 'markdown';
      el.value = value || '';
    } else if (f.type === 'select') {
      el = document.createElement('select');
      el.appendChild(new Option('— выбрать —', ''));
      for (const o of f.options) el.appendChild(new Option(o, o));
      el.value = value || '';
    } else if (f.type === 'checkbox') {
      const row = document.createElement('div');
      row.className = 'checkbox-row';
      el = document.createElement('input');
      el.type = 'checkbox';
      el.checked = !!value;
      row.appendChild(el);
      const t = document.createElement('span');
      t.textContent = f.help || 'Включено';
      row.appendChild(t);
      wrap.appendChild(row);
      el.name = f.name;
      el.dataset.fieldType = f.type;
      return wrap;
    } else if (f.type === 'datetime') {
      el = document.createElement('input');
      el.type = 'datetime-local';
      try {
        if (value) {
          const d = new Date(value);
          if (!isNaN(d.getTime())) {
            const pad = (n) => String(n).padStart(2, '0');
            el.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          }
        }
      } catch (e) { /* ignore bad dates */ }
    } else if (f.type === 'number') {
      el = document.createElement('input');
      el.type = 'number';
      el.value = value ?? '';
    } else {
      el = document.createElement('input');
      el.type = f.type === 'image' ? 'text' : 'text';
      el.value = value || '';
    }
    el.name = f.name;
    el.dataset.fieldType = f.type;
    if (f.required) el.required = true;
    wrap.appendChild(el);

    if (f.help) {
      const help = document.createElement('div');
      help.className = 'help';
      help.textContent = f.help;
      wrap.appendChild(help);
    }
    if (f.type === 'image' && value) {
      const img = document.createElement('img');
      img.className = 'image-preview';
      img.src = value;
      wrap.appendChild(img);
    }
    return wrap;
  }

  async function saveEntry() {
    const schema = SCHEMAS[current];
    const form = $('#editor-form');
    const data = {};
    let slug = '';

    for (const el of form.querySelectorAll('input, select, textarea')) {
      if (el.name === '__slug') { slug = el.value.trim(); continue; }
      const t = el.dataset.fieldType;
      if (t === 'checkbox') data[el.name] = el.checked;
      else if (t === 'number') data[el.name] = el.value === '' ? null : Number(el.value);
      else if (t === 'datetime') data[el.name] = el.value ? new Date(el.value).toISOString() : null;
      else data[el.name] = el.value;
    }

    // Auto slug
    if (!slug && schema.slugFrom && data[schema.slugFrom]) {
      const base = transliterate(data[schema.slugFrom]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
      if (current === 'news' && data.date) {
        const d = new Date(data.date); const pad = (n) => String(n).padStart(2, '0');
        slug = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}-${base}`;
      } else {
        slug = base;
      }
    }
    if (!slug && editing?.slug) slug = editing.slug;

    if (!slug) { toast('Введите slug (URL-идентификатор)', 'error'); return; }

    $('#save-btn').disabled = true; $('#save-btn').textContent = 'Сохраняем…';
    try {
      const r = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', collection: current, slug, data, sha: editing?.sha || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Ошибка сохранения');
      toast('Сохранено! Сайт обновится через 30-60 сек', 'success');
      closeEditor();
      loadCollection(current);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      $('#save-btn').disabled = false; $('#save-btn').textContent = 'Сохранить';
    }
  }

  async function deleteEntry(collection, item) {
    if (!confirm(`Удалить «${item.data?.title || item.data?.name || item.slug}»? Это действие необратимо.`)) return;
    try {
      const r = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', collection, slug: item.slug }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Ошибка');
      toast('Удалено', 'success');
      loadCollection(collection);
    } catch (e) { toast(e.message, 'error'); }
  }

  function closeEditor() {
    $('#editor-modal').hidden = true;
    editing = null;
  }

  function toast(msg, type) {
    const t = document.createElement('div');
    t.className = `toast ${type || ''}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

  // Простая транслитерация для slug'ов
  const CYR = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya','ә':'a','ғ':'g','қ':'k','ң':'n','ө':'o','ұ':'u','ү':'u','һ':'h','і':'i' };
  function transliterate(s) {
    return String(s || '').toLowerCase().split('').map((ch) => CYR[ch] !== undefined ? CYR[ch] : ch).join('');
  }
})();
