function getBasePath() {
  const raw = typeof window !== 'undefined' ? window.__BASE_PATH__ : '';
  if (!raw || raw === '/') {
    return '/';
  }
  return raw.replace(/\/+$/, '') + '/';
}

export function withBase(path) {
  const base = getBasePath();
  if (!path) {
    return base;
  }
  if (/^https?:\/\//i.test(path) || path.startsWith('//')) {
    return path;
  }
  if (path.startsWith('/')) {
    path = path.slice(1);
  }
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

export function readJsonScript(id) {
  const el = document.getElementById(id);
  if (!el) {
    return null;
  }
  try {
    return JSON.parse(el.textContent || 'null');
  } catch (error) {
    console.error('Failed to parse JSON payload:', error);
    return null;
  }
}

export function renderEmpty(element, html) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  element.insertAdjacentHTML('beforeend', html);
}

export function createElement(tagName, className, text) {
  const el = document.createElement(tagName);
  if (className) {
    el.className = className;
  }
  if (text != null) {
    el.textContent = text;
  }
  return el;
}

export function formatNumber(num) {
  if (num == null || num === '') {
    return '';
  }
  const n = Number(num);
  if (Number.isNaN(n)) {
    return String(num);
  }
  return n.toLocaleString('zh-TW');
}

export function buildExternalLink(url) {
  const a = document.createElement('a');
  a.href = url;
  a.textContent = url;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}
