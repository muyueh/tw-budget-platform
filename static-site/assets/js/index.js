import { withBase, readJsonScript, createElement } from './common.js';

const budgets = readJsonScript('budget-data') || [];
const listContainer = document.querySelector('[data-role="budget-list"]');
const searchInput = document.getElementById('budget-search');

function matchBudget(budget, keyword) {
  if (!keyword) {
    return true;
  }
  const haystack = [
    budget.name,
    budget.title,
    budget.city,
    budget.description,
    budget.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.indexOf(keyword) !== -1;
}

function renderBudgets(keyword = '') {
  if (!listContainer) {
    return;
  }
  const normalized = keyword.trim().toLowerCase();
  listContainer.innerHTML = '';

  const filtered = budgets.filter((budget) => matchBudget(budget, normalized));

  if (!filtered.length) {
    const empty = createElement('div', 'col-sm-12');
    empty.innerHTML = '<div class="alert alert-info">找不到符合搜尋條件的預算專案，請調整關鍵字再試一次。</div>';
    listContainer.appendChild(empty);
    return;
  }

  filtered.forEach((budget) => {
    const column = createElement('div', 'col-md-4 col-sm-6 budget-card');
    const panel = createElement('div', 'panel panel-default');

    const heading = createElement('div', 'panel-heading');
    heading.textContent = budget.title || budget.name;
    panel.appendChild(heading);

    const body = createElement('div', 'panel-body');
    if (budget.description) {
      const summary = createElement('p');
      summary.textContent = budget.description;
      body.appendChild(summary);
    }

    const meta = createElement('div', 'budget-meta');
    const pieces = [];
    if (budget.city) {
      pieces.push(budget.city);
    }
    if (budget.tags) {
      pieces.push(budget.tags);
    }
    if (budget.ts_update || budget.ts) {
      pieces.push(`更新於 ${new Date(budget.ts_update || budget.ts).getFullYear()} 年`);
    }
    meta.textContent = pieces.join(' · ');
    body.appendChild(meta);

    const actions = createElement('div');
    const link = createElement('a', 'btn btn-primary btn-sm');
    link.href = withBase(`bubble/${budget.id}/`);
    link.textContent = '開啟視覺化';
    actions.appendChild(link);

    const secondary = createElement('a', 'btn btn-link btn-sm');
    secondary.href = withBase(`table/${budget.id}/`);
    secondary.textContent = '查看表格';
    actions.appendChild(secondary);

    body.appendChild(actions);
    panel.appendChild(body);
    column.appendChild(panel);
    listContainer.appendChild(column);
  });
}

if (searchInput) {
  searchInput.addEventListener('input', (event) => {
    renderBudgets(event.target.value || '');
  });
}

renderBudgets();
