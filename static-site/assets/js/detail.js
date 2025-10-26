import { readJsonScript, createElement, buildExternalLink, formatNumber } from './common.js';

const root = document.querySelector('[data-role="budget-detail"]');
const budget = readJsonScript('budget-data');

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

  container.appendChild(createNotice(`此頁面為 GitHub Pages 上的靜態版面，僅提供資料連結與背景資訊。若要再次產生互動式視覺化，請下載資料並在自己的環境執行。`));
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
