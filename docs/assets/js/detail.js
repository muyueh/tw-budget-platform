import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { readJsonScript, createElement, buildExternalLink, formatNumber } from './common.js';

const root = document.querySelector('[data-role="budget-detail"]');
const budget = readJsonScript('budget-data');

const HTTPS_UPGRADE_HOSTS = new Set(['budget.tonyqstatic.org.s3.amazonaws.com']);

function logGroupStart(label, ...args) {
  if (typeof console !== 'undefined') {
    if (typeof console.groupCollapsed === 'function') {
      console.groupCollapsed(label, ...args);
      return;
    }
    if (typeof console.log === 'function') {
      console.log(label, ...args);
    }
  }
}

function logGroupEnd() {
  if (typeof console !== 'undefined' && typeof console.groupEnd === 'function') {
    console.groupEnd();
  }
}

function normalizeDatasetUrl(url) {
  if (typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, window.location.href);
    if (parsed.protocol === 'http:' && HTTPS_UPGRADE_HOSTS.has(parsed.hostname)) {
      parsed.protocol = 'https:';
      const normalized = parsed.toString();
      if (typeof console !== 'undefined' && typeof console.info === 'function') {
        console.info('Upgraded dataset URL to HTTPS', { from: trimmed, to: normalized });
      }
      return normalized;
    }
    if (parsed.protocol === 'http:' && window.location.protocol === 'https:' && typeof console !== 'undefined') {
      if (typeof console.warn === 'function') {
        console.warn('Dataset URL uses HTTP and may be blocked by the browser', trimmed);
      }
    }
    return parsed.toString();
  } catch (error) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('Invalid dataset URL', url, error);
    }
    return null;
  }
}

if (!root || !budget) {
  console.warn('Budget detail payload missing');
} else {
  const viewAttr = root.getAttribute('data-view') || 'bubble';
  const [viewKey, tableKey] = viewAttr.split(':');
  const container = root.querySelector('[data-role="view-container"]');

  const renderers = {
    bubble: renderVisualizationView,
    drilldown: renderVisualizationView,
    table: renderTableView,
  };

  const renderer = renderers[viewKey] || renderVisualizationView;
  renderer(container, budget, viewKey, tableKey);
}

function renderVisualizationView(container, budget, viewKey) {
  if (!container) {
    return;
  }

  container.innerHTML = '';

  const visualizationSection = createSection('預算視覺化');
  const chartHost = createElement('div', 'viz-placeholder');
  const vizStatus = createElement('p', 'viz-status text-muted');
  vizStatus.textContent = '資料載入中…';
  visualizationSection.appendChild(chartHost);
  visualizationSection.appendChild(vizStatus);
  container.appendChild(visualizationSection);

  loadAndRenderVisualization(chartHost, vizStatus, budget, viewKey);

  const overview = createSection('概觀');
  overview.appendChild(createParagraph(budget.description || '這份預算資料可以在頁面上直接瀏覽、比較與分享。'));
  if (budget.city || budget.tags) {
    const meta = createElement('ul', 'list-unstyled');
    if (budget.city) {
      meta.appendChild(createMetaItem('縣市', budget.city));
    }
    if (budget.tags) {
      meta.appendChild(createMetaItem('標籤', budget.tags));
    }
    if (budget.budget_file_type) {
      meta.appendChild(createMetaItem('資料類型', budgetFileTypeLabel(budget.budget_file_type)));
    }
    overview.appendChild(meta);
  }
  container.appendChild(overview);

  const dataSection = createSection('資料來源');
  dataSection.appendChild(buildDatasetList(budget));
  container.appendChild(dataSection);

  if (budget.reference || (budget.meta_links && budget.meta_links.length)) {
    const refSection = createSection('相關連結');
    if (budget.reference) {
      refSection.appendChild(createParagraph(budget.reference));
    }
    if (budget.meta_links && budget.meta_links.length) {
      const list = createElement('ul', 'data-list');
      budget.meta_links.forEach((link) => {
        const item = createElement('li');
        item.appendChild(buildExternalLink(link));
        list.appendChild(item);
      });
      refSection.appendChild(list);
    }
    container.appendChild(refSection);
  }

  container.appendChild(createNotice('圖表資料若未能正常載入，請改為下載下方的資料檔案，或至原專案頁面重新檢視。'));
}

function renderTableView(container, budget, tableKey) {
  if (!container) {
    return;
  }

  container.innerHTML = '';

  const labelMap = {
    all: '全部科目',
    topname: '支出別',
    depname: '機關別',
    category: '科目別',
  };

  const heading = labelMap[tableKey] || '預算表格';

  const intro = createSection(heading);
  intro.appendChild(createParagraph('下方列出原始資料的下載連結。您可以在試算表或資料分析工具中開啟，並依需求製作圖表。'));
  intro.appendChild(createNotice('表格檢視目前不會在瀏覽器中直接渲染，但提供所有原始數據連結，以便後續整理。'));
  container.appendChild(intro);

  const datasetSection = createSection('資料來源');
  const list = buildDatasetList(budget, true);
  datasetSection.appendChild(list);
  container.appendChild(datasetSection);

  if (budget.reference) {
    const ref = createSection('參考資訊');
    ref.appendChild(createParagraph(budget.reference));
    container.appendChild(ref);
  }
}

function createSection(title) {
  const section = createElement('section', 'data-section');
  const heading = createElement('h2');
  heading.textContent = title;
  section.appendChild(heading);
  return section;
}

function createParagraph(text) {
  const p = createElement('p');
  p.textContent = text;
  return p;
}

function createMetaItem(label, value) {
  const item = createElement('li');
  item.textContent = `${label}：${value}`;
  return item;
}

function buildDatasetList(budget, shouldSummarize = false) {
  const list = createElement('ul', 'data-list');
  const links = Array.isArray(budget.budgets) ? budget.budgets : [];

  if (!links.length) {
    const empty = createElement('li');
    empty.textContent = '此專案沒有提供資料連結。';
    list.appendChild(empty);
    return list;
  }

  links.forEach((url, index) => {
    const item = createElement('li');
    const label = createElement('div');
    label.appendChild(document.createTextNode(`資料檔案 ${index + 1}：`));
    label.appendChild(buildExternalLink(url));
    item.appendChild(label);

    if (shouldSummarize) {
      const summary = createElement('div', 'text-muted small');
      summary.textContent = '讀取中…';
      item.appendChild(summary);
      summarizeDataset(url)
        .then((info) => {
          if (!info) {
            summary.textContent = '無法讀取資料，請直接下載檔案後手動檢視。';
            return;
          }
          if (info.total != null) {
            const amount = formatNumber(info.total);
            summary.textContent = `共 ${info.count} 筆資料，總金額約為 ${amount}`;
          } else if (info.count != null) {
            summary.textContent = `共 ${info.count} 筆資料。`;
          } else {
            summary.textContent = '已載入資料。';
          }
        })
        .catch((error) => {
          console.warn('Failed to summarize dataset', error);
          summary.textContent = '無法讀取資料，請直接下載檔案後手動檢視。';
        });
    }

    list.appendChild(item);
  });

  return list;
}

function createNotice(message) {
  const el = createElement('div', 'notice');
  el.textContent = message;
  return el;
}

function budgetFileTypeLabel(type) {
  switch (String(type)) {
    case '0':
      return '一般政府預算';
    case '1':
      return '教育預算';
    case '2':
      return '政府總預算';
    default:
      return '其他';
  }
}

async function summarizeDataset(url) {
  try {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      return null;
    }

    if (!Array.isArray(data)) {
      return { count: Array.isArray(data.rows) ? data.rows.length : null };
    }

    let total = 0;
    let count = 0;
    data.forEach((item) => {
      const amount = Number(item.amount || item.budget || item.total || item.value || item.money);
      if (!Number.isNaN(amount)) {
        total += amount;
      }
      count += 1;
    });

    return { total, count };
  } catch (error) {
    return null;
  }
}

function summarizeDatasetPayload(payload) {
  if (!payload) {
    return { entries: 0, type: 'empty', sampleKeys: [] };
  }

  const rows = Array.isArray(payload) ? payload : extractRows(payload);
  const count = Array.isArray(rows) ? rows.length : 0;
  const sampleKeys = count && rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0]).slice(0, 6) : [];

  return {
    entries: count,
    type: Array.isArray(payload) ? 'array' : typeof payload,
    sampleKeys,
  };
}

async function loadAndRenderVisualization(container, statusElement, budget, viewKey) {
  if (!container || !statusElement || !budget) {
    return;
  }

  const label = budget.title || budget.name || `budget-${budget.id || ''}`;
  logGroupStart('[budget] render visualization', label);
  if (typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log('[budget] rendering view', { viewKey, budgetId: budget.id, title: budget.title || budget.name });
  }

  try {
    const { entries, summaries } = await loadBudgetEntries(budget, viewKey);
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log('[budget] dataset summaries', summaries);
    }

    if (!entries.length) {
      statusElement.textContent = '找不到可視覺化的預算資料。';
      statusElement.classList.remove('text-muted');
      statusElement.style.color = '#c0392b';
      return;
    }

    const { renderedCount, totalEntries, totalAmount, overallAmount } = renderBubbleChart(container, entries);
    if (renderedCount < totalEntries) {
      statusElement.textContent = `圖表顯示前 ${renderedCount} 筆資料，合計約 ${formatNumber(Math.round(totalAmount))} 元（全部約 ${formatNumber(Math.round(overallAmount))} 元，共 ${totalEntries} 筆）。`;
    } else {
      statusElement.textContent = `共 ${totalEntries} 筆資料，總金額約為 ${formatNumber(Math.round(overallAmount))} 元。`;
    }

    statusElement.classList.remove('text-muted');
    statusElement.style.color = '';

    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log('[budget] rendered visualization', {
        renderedCount,
        totalEntries,
        overallAmount,
        viewKey,
      });
    }
  } catch (error) {
    console.warn('Failed to render visualization', error);
    statusElement.textContent = '目前無法載入圖表，請改為下載資料檔案。';
    statusElement.classList.remove('text-muted');
    statusElement.style.color = '#c0392b';
  } finally {
    logGroupEnd();
  }
}

async function loadBudgetEntries(budget, viewKey) {
  const rawUrls = Array.isArray(budget.budgets) ? budget.budgets : [];
  if (!rawUrls.length) {
    return { entries: [], urls: [], summaries: [] };
  }

  const normalizedUrls = rawUrls
    .map((url) => normalizeDatasetUrl(url))
    .filter((url) => typeof url === 'string' && url.length);

  if (typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log('[budget] normalized dataset URLs', { raw: rawUrls, normalized: normalizedUrls, viewKey });
  }

  if (!normalizedUrls.length) {
    return { entries: [], urls: [], summaries: [] };
  }

  const typeHint = budget.budget_file_type != null ? String(budget.budget_file_type) : null;
  const summaries = [];
  const datasets = await Promise.all(
    normalizedUrls.map((url, index) => {
      if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log('[budget] fetching dataset', { index: index + 1, url, viewKey });
      }

      return fetchBudgetDataset(url, typeHint)
        .then((data) => {
          const summary = summarizeDatasetPayload(data);
          summaries.push(Object.assign({ url }, summary));
          if (typeof console !== 'undefined' && typeof console.log === 'function') {
            console.log('[budget] fetched dataset', { url, summary });
          }
          return data;
        })
        .catch((error) => {
          console.warn('Failed to fetch dataset', url, error);
          summaries.push({ url, error: error && error.message ? error.message : String(error) });
          return null;
        });
    }),
  );

  const merged = mergeBudgetDatasets(datasets.filter(Boolean));
  return { entries: merged, urls: normalizedUrls, summaries };
}

async function fetchBudgetDataset(url, typeHint) {
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const text = await response.text();
  if (!text) {
    return [];
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (typeHint === '1' || isLikelyCsv(url, trimmed)) {
    return d3.csvParse(trimmed).filter(Boolean);
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    try {
      return d3.csvParse(trimmed).filter(Boolean);
    } catch (csvError) {
      throw error;
    }
  }
}

function isLikelyCsv(url, sample) {
  if (/\.csv($|\?)/i.test(url)) {
    return true;
  }
  return sample.split(/\r?\n/).slice(0, 2).some((line) => line.includes(',') && /[A-Za-z\u4e00-\u9fff]/.test(line));
}

function mergeBudgetDatasets(datasets) {
  if (!datasets.length) {
    return [];
  }

  const map = new Map();

  datasets.forEach((dataset, datasetIndex) => {
    const items = Array.isArray(dataset) ? dataset : extractRows(dataset);
    items.forEach((item, itemIndex) => {
      const key = findFirstValue(item, CODE_KEYS) || `${datasetIndex}-${itemIndex}`;
      const existing = map.get(key) || {};
      map.set(key, Object.assign(existing, item));
    });
  });

  const normalized = [];
  let index = 0;
  map.forEach((value, key) => {
    const record = normalizeBudgetRecord(value, key, index);
    if (record) {
      normalized.push(record);
      index += 1;
    }
  });

  return normalized;
}

function extractRows(payload) {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload.rows)) {
    return payload.rows;
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload.Root && Array.isArray(payload.Root.Row)) {
    return payload.Root.Row;
  }
  if (Array.isArray(payload.children)) {
    return payload.children;
  }
  if (typeof payload === 'object') {
    const values = Object.values(payload).filter((value) => Array.isArray(value));
    if (values.length === 1) {
      return values[0];
    }
  }
  return [];
}

function normalizeBudgetRecord(raw, fallbackKey, index) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = findNumericValue(raw, AMOUNT_KEYS);
  if (!(value > 0)) {
    return null;
  }

  const previous = findNumericValue(raw, PREVIOUS_KEYS);
  const change = previous != null ? value - previous : null;
  const code = findFirstValue(raw, CODE_KEYS) || fallbackKey || `item-${index}`;
  const name = findFirstValue(raw, NAME_KEYS) || code || `科目 ${index + 1}`;
  const group = findFirstValue(raw, GROUP_KEYS) || null;
  const comment = findFirstValue(raw, COMMENT_KEYS) || null;

  const labelParts = [];
  if (group && !name.includes(group)) {
    labelParts.push(group);
  }
  labelParts.push(name);

  return {
    key: code,
    name,
    label: labelParts.join(' · '),
    group,
    value,
    change,
    previous,
    code,
    comment,
    raw,
  };
}

function findFirstValue(record, keys) {
  for (const key of keys) {
    if (key in record && record[key] != null && record[key] !== '') {
      return String(record[key]).trim();
    }
  }
  return null;
}

function findNumericValue(record, keys) {
  for (const key of keys) {
    if (key in record) {
      const value = parseNumber(record[key]);
      if (value != null) {
        return value;
      }
    }
  }

  for (const key of Object.keys(record)) {
    if (keys.some((target) => new RegExp(target, 'i').test(key))) {
      const value = parseNumber(record[key]);
      if (value != null) {
        return value;
      }
    }
  }

  return null;
}

function parseNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s]/g, '').replace(/[\u5143\u584a]/g, '');
    if (!cleaned) {
      return null;
    }
    const number = Number(cleaned);
    if (!Number.isNaN(number)) {
      return number;
    }
  }
  return null;
}

function renderBubbleChart(container, entries) {
  const sorted = entries.slice().sort((a, b) => b.value - a.value);
  const limit = Math.min(sorted.length, 80);
  const data = sorted.slice(0, limit);
  const totalAmount = data.reduce((sum, item) => sum + item.value, 0);
  const overallAmount = entries.reduce((sum, item) => sum + item.value, 0);

  const svg = d3.create('svg').attr('class', 'bubble-chart').attr('role', 'img');
  container.innerHTML = '';
  container.appendChild(svg.node());

  const render = () => {
    const width = container.clientWidth || 760;
    const height = Math.max(420, Math.round(width * 0.65));

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const pack = d3.pack().size([width, height]).padding(6);
    const root = pack(
      d3
        .hierarchy({ children: data })
        .sum((d) => Math.max(d.value, 0))
        .sort((a, b) => b.value - a.value),
    );

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const node = svg
      .selectAll('g')
      .data(root.leaves(), (d) => d.data.key)
      .join('g')
      .attr('transform', (d) => `translate(${d.x},${d.y})`);

    node
      .append('circle')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => color(d.data.group || 'default'))
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    node
      .append('title')
      .text((d) => bubbleTooltipText(d.data));

    const labelNode = node.filter((d) => d.r >= 18);

    labelNode
      .append('text')
      .attr('class', 'bubble-label')
      .selectAll('tspan')
      .data((d) => wrapLabel(d.data.name, Math.max(6, Math.floor(d.r / 6))))
      .join('tspan')
      .attr('x', 0)
      .attr('y', (d, i, nodes) => (i - (nodes.length - 1) / 2) * 14)
      .text((d) => d);

    labelNode
      .append('text')
      .attr('class', 'bubble-value')
      .attr('y', (d) => d.r * 0.6)
      .text((d) => formatNumber(Math.round(d.data.value)));
  };

  render();

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => render());
    observer.observe(container);
  } else {
    window.addEventListener('resize', render);
  }

  return { renderedCount: data.length, totalEntries: entries.length, totalAmount, overallAmount };
}

function bubbleTooltipText(data) {
  const parts = [];
  parts.push(data.label || data.name || data.code || '預算資料');
  parts.push(`本年度預算：約 ${formatNumber(Math.round(data.value))} 元`);
  if (data.previous != null) {
    parts.push(`前一年度：約 ${formatNumber(Math.round(data.previous))} 元`);
  }
  if (data.change != null && data.previous) {
    const percent = data.previous === 0 ? null : ((data.change / data.previous) * 100).toFixed(1);
    if (percent != null && Number.isFinite(Number(percent))) {
      parts.push(`變動：約 ${formatNumber(Math.round(data.change))} 元（${percent}%）`);
    } else {
      parts.push(`變動：約 ${formatNumber(Math.round(data.change))} 元`);
    }
  }
  if (data.comment) {
    parts.push(data.comment);
  }
  return parts.join('\n');
}

function wrapLabel(text, maxCharsPerLine) {
  const value = text ? String(text) : '';
  if (!value) {
    return [];
  }
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxCharsPerLine) {
    return [clean];
  }
  const output = [];
  let current = '';
  for (const char of clean) {
    const next = current + char;
    if (next.length > maxCharsPerLine) {
      output.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) {
    output.push(current);
  }
  return output.slice(0, 3);
}

const AMOUNT_KEYS = [
  'amount',
  'money',
  'budget',
  'total',
  'value',
  '本年度預算數',
  '本年度預算',
  '本年度數',
  '預算數',
  '總預算',
  '核定數',
  '歲出',
  '金額',
  '總額',
];

const PREVIOUS_KEYS = ['last_amount', 'lastAmount', '上年度預算數', '前一年度預算', '前一年度數', '去年預算數'];

const NAME_KEYS = [
  'name',
  '名稱',
  '項目',
  '項目名稱',
  '科目名稱',
  '預算科目',
  '節名稱',
  '目名稱',
  '機關名稱',
  'department',
  'depname',
  'category',
  '用途別',
  '用途別名稱',
  '部門名稱',
  '部門別',
  'budgetName',
];

const GROUP_KEYS = ['topname', 'depname', 'category', 'gov_type', '政事別', '機關別', '類別', '用途別', '用途別名稱'];

const CODE_KEYS = ['code', '科目代碼', '預算科目編號', '預算科目代號', '代碼'];

const COMMENT_KEYS = ['comment', '說明', '備註'];
