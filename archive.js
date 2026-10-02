(() => {
  'use strict';

  const config = window.MATH_ARCHIVE_CONFIG || {};
  const state = { items: [], category: 'all', selectedKey: null };
  const list = document.querySelector('#resource-list');
  const resourceIndex = document.querySelector('#resource-index');
  const resourceIndexCount = document.querySelector('#resource-index-count');
  const status = document.querySelector('#archive-status');
  const search = document.querySelector('#archive-search');
  const levelFilter = document.querySelector('#level-filter');
  const sortOrder = document.querySelector('#sort-order');
  const dialog = document.querySelector('#contribution-dialog');
  const contributionForm = document.querySelector('#contribution-form');
  const uploadStatus = document.querySelector('#upload-status');
  const submitButton = document.querySelector('#submit-contribution');
  const turnstileInput = document.createElement('input');
  turnstileInput.type = 'hidden';
  turnstileInput.name = 'cf-turnstile-response';
  contributionForm.append(turnstileInput);

  function publicObjectUrl(item) {
    const bucket = encodeURIComponent(item.storage_bucket || 'study-hub-resources');
    const path = String(item.storage_path || '').split('/').map(encodeURIComponent).join('/');
    return `${String(config.supabaseUrl || '').replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${path}`;
  }

  function formatBytes(value) {
    const bytes = Number(value) || 0;
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  async function fetchCategory(category) {
    const endpoint = new URL('/rest/v1/study_hub_resources', config.supabaseUrl);
    endpoint.searchParams.set('select', 'category,storage_bucket,storage_path,original_filename,title,size_bytes,level,year,resource_type,uploaded_at');
    endpoint.searchParams.set('subject', 'eq.mathematics');
    endpoint.searchParams.set('category', `eq.${category}`);
    endpoint.searchParams.set('order', 'uploaded_at.desc,title.asc');
    endpoint.searchParams.set('limit', '1000');

    const headers = { apikey: config.anonKey };
    if (String(config.anonKey).startsWith('eyJ')) headers.Authorization = `Bearer ${config.anonKey}`;
    const response = await fetch(endpoint, { headers });
    if (!response.ok) throw new Error(`Archive request failed (HTTP ${response.status}).`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Archive returned an invalid resource list.');
    return rows;
  }

  function makeState(message, isError = false) {
    const element = document.createElement('div');
    element.className = 'archive-empty';
    element.textContent = message;
    if (isError) element.setAttribute('role', 'alert');
    return element;
  }

  function resourceKey(item) {
    return `${item.category}:${item.storage_bucket}:${item.storage_path}`;
  }

  function getFilteredItems() {
    const query = search.value.trim().toLowerCase();
    const level = levelFilter.value;
    const items = state.items.filter((item) => {
      if (state.category !== 'all' && item.category !== state.category) return false;
      if (level && item.level !== level) return false;
      const haystack = `${item.title || ''} ${item.original_filename || ''} ${item.year || ''}`.toLowerCase();
      return !query || haystack.includes(query);
    });

    if (sortOrder.value === 'recent') {
      items.sort((left, right) => String(right.uploaded_at || '').localeCompare(String(left.uploaded_at || '')));
    } else if (sortOrder.value === 'year') {
      items.sort((left, right) => (Number(right.year) || 0) - (Number(left.year) || 0));
    } else {
      items.sort((left, right) => String(left.title || left.original_filename).localeCompare(String(right.title || right.original_filename)));
    }

    return items;
  }

  function render() {
    const filtered = getFilteredItems();
    list.replaceChildren();
    resourceIndex.replaceChildren();
    status.textContent = `${filtered.length} resource${filtered.length === 1 ? '' : 's'} found`;
    resourceIndexCount.textContent = String(filtered.length);

    if (!filtered.length) {
      const message = state.items.length ? 'No resources match those filters.' : 'No published Mathematics resources yet.';
      resourceIndex.append(makeState(message));
      list.append(makeState(message));
      return;
    }

    if (!filtered.some((item) => resourceKey(item) === state.selectedKey)) {
      state.selectedKey = resourceKey(filtered[0]);
    }

    filtered.forEach((item, index) => {
      const key = resourceKey(item);
      const entryId = `mathematics-resource-${index + 1}`;
      const itemTitle = item.title || item.original_filename || 'Mathematics resource';

      const indexButton = document.createElement('button');
      indexButton.className = 'resource-index-item';
      indexButton.type = 'button';
      indexButton.dataset.resourceKey = key;
      indexButton.setAttribute('aria-pressed', String(key === state.selectedKey));
      const number = document.createElement('span');
      number.className = 'resource-index-number';
      number.textContent = String(index + 1).padStart(3, '0');
      const indexTitle = document.createElement('span');
      indexTitle.className = 'resource-index-title';
      indexTitle.textContent = itemTitle;
      indexButton.append(number, indexTitle);
      indexButton.addEventListener('click', () => {
        state.selectedKey = key;
        resourceIndex.querySelectorAll('.resource-index-item').forEach((button) => {
          button.setAttribute('aria-pressed', String(button.dataset.resourceKey === key));
        });
        list.querySelectorAll('.resource-entry').forEach((entry) => {
          entry.classList.toggle('is-selected', entry.dataset.resourceKey === key);
        });
        document.getElementById(entryId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      resourceIndex.append(indexButton);

      const row = document.createElement('article');
      row.id = entryId;
      row.className = `resource-entry${key === state.selectedKey ? ' is-selected' : ''}`;
      row.dataset.resourceKey = key;
      row.setAttribute('aria-labelledby', `${entryId}-title`);
      const heading = document.createElement('div');
      heading.className = 'resource-entry-heading';
      const details = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'resource-title';
      title.id = `${entryId}-title`;
      title.textContent = itemTitle;
      const meta = document.createElement('div');
      meta.className = 'resource-meta';
      const category = document.createElement('span');
      category.className = 'resource-category';
      category.textContent = item.category === 'papers' ? 'Past paper' : 'Notes';
      meta.append(category);
      for (const value of [item.level, item.year, formatBytes(item.size_bytes)]) {
        if (!value) continue;
        const detail = document.createElement('span');
        detail.textContent = value;
        meta.append(detail);
      }
      details.append(title, meta);
      heading.append(details);
      row.append(heading);

      if (item.original_filename) {
        const filename = document.createElement('p');
        filename.className = 'resource-filename';
        filename.textContent = item.original_filename;
        row.append(filename);
      }

      const open = document.createElement('a');
      open.className = 'resource-open';
      open.href = publicObjectUrl(item);
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      open.textContent = 'Open resource';
      open.setAttribute('aria-label', `Open ${title.textContent}`);
      row.append(open);
      list.append(row);

      if ((index + 1) % 8 === 0 && index < filtered.length - 1) {
        const adSlot = document.createElement('div');
        adSlot.className = 'archive-ad-slot';
        adSlot.dataset.adSlot = `mathematics-archive-${Math.floor((index + 1) / 8)}`;
        list.append(adSlot);
      }
    });
  }

  async function loadArchive() {
    if (!config.supabaseUrl || !config.anonKey) {
      status.textContent = 'The archive is not connected yet. Supabase public configuration is required.';
      list.replaceChildren(makeState('Mathematics resources are temporarily unavailable.', true));
      resourceIndex.replaceChildren(makeState('Mathematics resources are temporarily unavailable.', true));
      return;
    }

    status.textContent = 'Loading Mathematics resources...';
    list.replaceChildren(makeState('Connecting to the shared archive...'));
    try {
      const [notes, papers] = await Promise.all([fetchCategory('notes'), fetchCategory('papers')]);
      state.items = [...notes, ...papers];
      const levels = [...new Set(state.items.map((item) => item.level).filter(Boolean))].sort();
      levelFilter.replaceChildren(new Option('All levels', ''));
      for (const level of levels) levelFilter.add(new Option(level, level));
      render();
    } catch (error) {
      status.textContent = error.message || 'The Mathematics archive could not be loaded.';
      list.replaceChildren(makeState('The archive could not be loaded. Check the connection and try again.', true));
      resourceIndex.replaceChildren();
      const retry = document.createElement('button');
      retry.className = 'button button-outline';
      retry.type = 'button';
      retry.textContent = 'Retry';
      retry.addEventListener('click', loadArchive);
      list.append(retry);
    }
  }

  function setUploadMessage(message, stateName = '') {
    uploadStatus.textContent = message;
    uploadStatus.dataset.state = stateName;
  }

  function initializeTurnstile() {
    if (!config.turnstileSiteKey) {
      setUploadMessage('Contributions are not enabled yet. Secure upload verification is being configured.');
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.turnstile) {
        setUploadMessage('Verification could not load. Please try again later.', 'error');
        return;
      }
      window.turnstile.render('#turnstile-widget', {
        sitekey: config.turnstileSiteKey,
        callback(token) {
          turnstileInput.value = token;
          submitButton.disabled = false;
        },
        'expired-callback'() {
          turnstileInput.value = '';
          submitButton.disabled = true;
        },
        'error-callback'() {
          turnstileInput.value = '';
          submitButton.disabled = true;
          setUploadMessage('Verification failed to load. Please try again later.', 'error');
        }
      });
    };
    script.onerror = () => setUploadMessage('Verification could not load. Please try again later.', 'error');
    document.head.append(script);
  }

  document.querySelectorAll('.archive-tabs button').forEach((button) => {
    button.addEventListener('click', () => {
      state.category = button.dataset.category;
      document.querySelectorAll('.archive-tabs button').forEach((tab) => {
        tab.setAttribute('aria-pressed', String(tab === button));
      });
      render();
    });
  });
  search.addEventListener('input', render);
  levelFilter.addEventListener('change', render);
  sortOrder.addEventListener('change', render);

  document.querySelector('#open-contribution').addEventListener('click', () => dialog.showModal());
  document.querySelector('#close-contribution').addEventListener('click', () => dialog.close());
  document.querySelector('#cancel-contribution').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  contributionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!config.submitFunctionUrl || !config.anonKey || !turnstileInput.value) {
      setUploadMessage('Secure upload is not configured yet. Please try again later.', 'error');
      return;
    }

    submitButton.disabled = true;
    setUploadMessage('Sending your resource for review...');
    try {
      const response = await fetch(config.submitFunctionUrl, {
        method: 'POST',
        headers: { apikey: config.anonKey },
        body: new FormData(contributionForm)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Upload failed (HTTP ${response.status}).`);
      contributionForm.reset();
      turnstileInput.value = '';
      if (window.turnstile) window.turnstile.reset();
      submitButton.disabled = true;
      setUploadMessage('Thank you. Your upload is private and will appear after review.', 'success');
    } catch (error) {
      submitButton.disabled = !turnstileInput.value;
      setUploadMessage(error.message || 'The resource could not be submitted.', 'error');
    }
  });

  window.MathArchive = { reload: loadArchive };
  initializeTurnstile();
  void loadArchive();
})();