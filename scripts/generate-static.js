#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'docs');
const STATIC_ASSETS_DIR = path.join(ROOT, 'static-site', 'assets');
const AppConfig = require(path.join(ROOT, 'config.js'));
const Config = AppConfig && AppConfig.default ? AppConfig.default : AppConfig;
function normalizeBasePath(input) {
  if (!input) {
    return '';
  }

  let base = input.trim();

  if (!base || base === '/' || base === '.' || base === './') {
    return '';
  }

  if (!base.startsWith('/')) {
    base = `/${base}`;
  }

  base = base.replace(/\/+$/, '');

  return `${base}/`;
}

function resolveAssetPath(basePath, assetPath) {
  if (!assetPath) {
    return basePath || '/';
  }

  if (!basePath) {
    return `/${assetPath.replace(/^\/+/, '')}`;
  }

  return `${basePath}${assetPath.replace(/^\/+/, '')}`;
}

function readBudgetList() {
  const filePath = path.join(ROOT, 'budget_list.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const withoutExport = source.replace(/^\s*export\s+default\s+/, '');
  const trimmed = withoutExport.replace(/;?\s*$/, '');
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`Unable to parse budget_list.js: ${error.message}`);
  }
}

function pickFeaturedBudget(budgets) {
  if (!Array.isArray(budgets) || !budgets.length) {
    return null;
  }
  const configured = parseInt(Config && Config.featured_budget_id, 10);
  if (!Number.isNaN(configured)) {
    const matched = budgets.find((budget) => Number(budget.id) === configured);
    if (matched) {
      return matched;
    }
  }
  return budgets[0];
}

async function cleanOutput() {
  await fs.promises.rm(OUTPUT_DIR, { recursive: true, force: true });
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeForScript(data) {
  return JSON.stringify(data).replace(/<\//g, '<\\/');
}

function serializeBasePath(basePath) {
  if (!basePath || basePath === '/') {
    return '';
  }
  return basePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatDate(dateString) {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function resolveSitePath(basePath, target) {
  const base = basePath || '';
  const cleaned = target && target.startsWith('/') ? target.slice(1) : target;

  if (!cleaned) {
    return base || '/';
  }

  if (!base) {
    return `/${cleaned}`;
  }

  return `${base}${cleaned}`;
}

function renderIndexHtml({ budgets, basePath }) {
  const serialized = serializeForScript(budgets);
  const baseScript = `window.__BASE_PATH__ = '${serializeBasePath(basePath)}';`;
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <title>預算視覺化清單</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="瀏覽並分享台灣各地政府的預算視覺化成果" />
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css" />
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap-theme.min.css" />
    <link rel="stylesheet" href="${resolveAssetPath(basePath, 'assets/css/site.css')}" />
  </head>
  <body>
    <div class="container" data-role="index-view">
      <header class="page-header">
        <h1 class="page-title">預算視覺化產生器</h1>
        <p class="lead">直接在瀏覽器中瀏覽過往建立的預算視覺化專案，並取得原始資料連結。</p>
      </header>
      <section class="search-panel">
        <label for="budget-search" class="sr-only">搜尋預算名稱</label>
        <input id="budget-search" type="search" class="form-control input-lg" placeholder="輸入縣市、年度或關鍵字" />
      </section>
      <section>
        <div class="row" data-role="budget-list"></div>
      </section>
      <footer class="site-footer">
        <hr />
        <p>原始專案由 <a href="https://github.com/tony1223/tw-budget-platform" rel="noopener" target="_blank">tony1223</a> 建立，程式碼來源 <a href="https://github.com/g0v/twbudget" rel="noopener" target="_blank">g0v</a> 社群。</p>
      </footer>
    </div>
    <script>${baseScript}</script>
    <script id="budget-data" type="application/json">${serialized}</script>
    <script type="module" src="${resolveAssetPath(basePath, 'assets/js/index.js')}"></script>
  </body>
</html>`;
}

function buildNavLinks({ basePath, budgetId }) {
  return [
    { key: 'drilldown', label: '鳥瞰圖', href: resolveSitePath(basePath, `drilldown/${budgetId}/`) },
    { key: 'bubble', label: '變化圖', href: resolveSitePath(basePath, `bubble/${budgetId}/`) },
    { key: 'table', label: '科目預算表格', href: resolveSitePath(basePath, `table/${budgetId}/`) },
    { key: 'list', label: '回清單', href: resolveSitePath(basePath, 'list/') }
  ];
}

function renderDetailHtml({ budget, basePath, viewKey, tableKey }) {
  const serialized = serializeForScript(budget);
  const baseScript = `window.__BASE_PATH__ = '${serializeBasePath(basePath)}';`;
  const navLinks = buildNavLinks({ basePath, budgetId: budget.id });
  const navItems = navLinks
    .map((item) => {
      const active = item.key === viewKey ? ' class="active"' : '';
      return `<li${active}><a href="${item.href}">${escapeHtml(item.label)}</a></li>`;
    })
    .join('');

  const tableNav = ['all', 'topname', 'depname', 'category']
    .map((key) => {
      const labelMap = {
        all: '全部科目',
        topname: '支出別',
        depname: '機關別',
        category: '科目別'
      };
      const active = tableKey === key ? ' class="active"' : '';
      const href = key === 'all'
        ? resolveSitePath(basePath, `table/${budget.id}/`)
        : resolveSitePath(basePath, `table/${budget.id}/${key}/`);
      return `<li${active}><a href="${href}">${labelMap[key]}</a></li>`;
    })
    .join('');

  const showTableNav = viewKey === 'table';

  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(budget.title || budget.name)} | 預算視覺化</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(budget.description || '')}" />
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css" />
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap-theme.min.css" />
    <link rel="stylesheet" href="${resolveAssetPath(basePath, 'assets/css/site.css')}" />
  </head>
  <body>
    <div class="container" data-role="budget-detail" data-view="${viewKey}${tableKey ? `:${tableKey}` : ''}">
      <header class="page-header">
        <h1 class="page-title">${escapeHtml(budget.title || budget.name)}</h1>
        ${budget.city ? `<p class="meta">${escapeHtml(budget.city)} · ${formatDate(budget.ts_update || budget.ts)}</p>` : ''}
      </header>
      <nav>
        <ul class="nav nav-pills">${navItems}</ul>
      </nav>
      ${showTableNav ? `<nav class="subnav"><ul class="nav nav-tabs">${tableNav}</ul></nav>` : ''}
      <main class="detail-content">
        <section data-role="view-container"></section>
      </main>
      <footer class="site-footer">
        <hr />
        <p>回到<a href="${resolveSitePath(basePath, 'list/')}">預算清單</a>或分享此頁面給有興趣的朋友。</p>
      </footer>
    </div>
    <script>${baseScript}</script>
    <script id="budget-data" type="application/json">${serialized}</script>
    <script type="module" src="${resolveAssetPath(basePath, 'assets/js/detail.js')}"></script>
  </body>
</html>`;
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

function renderLandingHtml({ budget, basePath }) {
  if (!budget) {
    return renderIndexHtml({ budgets: [], basePath });
  }
  return renderDetailHtml({
    budget,
    basePath,
    viewKey: 'bubble',
  });
}

async function build() {
  const basePath = normalizeBasePath(process.env.BASE_PATH);
  const budgets = readBudgetList();
  const featuredBudget = pickFeaturedBudget(budgets);

  await cleanOutput();
  await ensureDir(OUTPUT_DIR);

  const assetsOutput = path.join(OUTPUT_DIR, 'assets');
  await ensureDir(assetsOutput);

  if (fs.existsSync(STATIC_ASSETS_DIR)) {
    await copyDir(STATIC_ASSETS_DIR, assetsOutput);
  }

  const landingHtml = renderLandingHtml({ budget: featuredBudget, basePath });
  await fs.promises.writeFile(path.join(OUTPUT_DIR, 'index.html'), landingHtml, 'utf8');

  const listHtml = renderIndexHtml({ budgets, basePath });
  const listDir = path.join(OUTPUT_DIR, 'list');
  await ensureDir(listDir);
  await fs.promises.writeFile(path.join(listDir, 'index.html'), listHtml, 'utf8');

  for (const budget of budgets) {
    const detailViews = [
      { view: 'bubble' },
      { view: 'drilldown' },
      { view: 'table', table: 'all' },
      { view: 'table', table: 'topname' },
      { view: 'table', table: 'depname' },
      { view: 'table', table: 'category' }
    ];

    for (const detail of detailViews) {
      const segments = [];
      if (detail.view === 'table') {
        segments.push('table', String(budget.id));
        if (detail.table !== 'all') {
          segments.push(detail.table);
        }
      } else {
        segments.push(detail.view, String(budget.id));
      }

      const html = renderDetailHtml({
        budget,
        basePath,
        viewKey: detail.view,
        tableKey: detail.table,
      });

      const outputPath = path.join(OUTPUT_DIR, ...segments, 'index.html');
      await ensureDir(path.dirname(outputPath));
      await fs.promises.writeFile(outputPath, html, 'utf8');
    }
  }

  const redirectTarget = basePath || './';
  const notFoundHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta http-equiv="refresh" content="0; url=${redirectTarget}" /><title>頁面不存在</title></head><body><p>頁面不存在，將帶您回到<a href="${redirectTarget}">首頁</a>。</p></body></html>`;
  await fs.promises.writeFile(path.join(OUTPUT_DIR, '404.html'), notFoundHtml, 'utf8');
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
