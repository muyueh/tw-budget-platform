#!/usr/bin/env node

require('babel/register');

const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

const configModule = require('../config');
const Config = Object.assign({}, configModule.default || configModule);

if (process.env.BASE_PATH != null) {
  Config.base_path = process.env.BASE_PATH;
}

const budgetModelModule = Config.file_model
  ? require('../model/budgetfilemodel.jsx')
  : require('../model/budgetmodel.jsx');
const BudgetModel = budgetModelModule.default || budgetModelModule;

const DispatcherModule = require('../views/dispatch.jsx');
const Dispatcher = DispatcherModule.default || DispatcherModule;

global.__BASE_PATH__ = Config.base_path || '';

global.window = undefined;

global.document = undefined;

global.navigator = undefined;

const OUTPUT_DIR = path.join(__dirname, '..', 'docs');

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function writeFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, content, 'utf8');
}

function renderPage(props) {
  const element = React.createElement(Dispatcher, props);
  const markup = ReactDOMServer.renderToStaticMarkup(element);
  return '<!DOCTYPE html>' + markup;
}

async function renderIndex(defaultView, budgets) {
  const html = renderPage({
    comp: 'index',
    layout: 'default',
    nav: 'home',
    basePath: Config.base_path || '',
    pageInfo: {
      title: '預算視覺化產生器',
      ogimage: '',
      description: '迅速產生預算視覺化'
    },
    views: {
      default_view: defaultView,
      budgets
    }
  });
  await writeFile(path.join(OUTPUT_DIR, 'index.html'), html);
}

async function renderDrilldown(budget) {
  const html = renderPage({
    comp: 'drilldown',
    layout: 'front',
    nav: 'home',
    basePath: Config.base_path || '',
    budget_id: budget.id,
    pageInfo: budget,
    views: {
      budget_links: budget.budgets,
      budget_id: budget.id,
      budget_file_type: budget.budget_file_type,
      budget_meta_links: budget.meta_links
    }
  });
  await writeFile(path.join(OUTPUT_DIR, 'drilldown', String(budget.id), 'index.html'), html);
}

async function renderBubble(budget) {
  const compName = budget.budget_file_type === '2' ? 'bubble-gov' : 'bubble';
  const html = renderPage({
    comp: compName,
    layout: 'front',
    nav: 'home',
    basePath: Config.base_path || '',
    budget_id: budget.id,
    pageInfo: budget,
    views: {
      budget_links: budget.budgets,
      budget_id: budget.id,
      budget_file_type: budget.budget_file_type,
      budget_meta_links: budget.meta_links
    }
  });
  await writeFile(path.join(OUTPUT_DIR, 'bubble', String(budget.id), 'index.html'), html);
}

async function renderTable(budget, type) {
  const html = renderPage({
    comp: 'table',
    layout: 'front',
    nav: 'home',
    basePath: Config.base_path || '',
    pageInfo: budget,
    views: {
      _subnav: type,
      budget_links: budget.budgets,
      budget_id: budget.id,
      budget_file_type: budget.budget_file_type,
      budget_meta_links: budget.meta_links
    }
  });
  if (type === 'all') {
    await writeFile(path.join(OUTPUT_DIR, 'table', String(budget.id), 'index.html'), html);
  }
  await writeFile(path.join(OUTPUT_DIR, 'table', String(budget.id), type, 'index.html'), html);
}

async function copyPublicAssets() {
  const publicDir = path.join(__dirname, '..', 'public');
  await fs.promises.cp(publicDir, OUTPUT_DIR, { recursive: true });
}

async function createNotFoundPage() {
  const redirectTarget = Config.base_path && Config.base_path !== '/'
    ? Config.base_path
    : '/';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta http-equiv="refresh" content="0; url=${redirectTarget}" />` +
    `<title>Page not found</title></head><body><p>Page not found. Redirecting to <a href="${redirectTarget}">${redirectTarget}</a>.</p></body></html>`;
  await writeFile(path.join(OUTPUT_DIR, '404.html'), html);
}

async function cleanOutput() {
  await fs.promises.rm(OUTPUT_DIR, { recursive: true, force: true });
}

async function main() {
  await cleanOutput();
  await ensureDir(OUTPUT_DIR);

  const defaultView = Config.default_view === 'drilldown' ? 'drilldown' : 'bubble';
  const budgets = await BudgetModel.getAll(1, 1000);

  await renderIndex(defaultView, budgets);

  for (const budgetInfo of budgets) {
    const budget = await BudgetModel.get(budgetInfo.id);
    if (!budget) {
      continue;
    }

    await renderDrilldown(budget);
    await renderBubble(budget);

    const tableTypes = ['all', 'topname', 'depname', 'category'];
    for (const type of tableTypes) {
      await renderTable(budget, type);
    }
  }

  await copyPublicAssets();
  await createNotFoundPage();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
