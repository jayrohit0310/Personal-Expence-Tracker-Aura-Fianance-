// ==========================================
// Aura Finance - Client Application Core
// ==========================================

// Global SPA State
const state = {
  user: null,
  transactions: [],
  budgets: [],
  summary: {
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    budgetsStatus: []
  },
  activeView: 'dashboard',
  selectedMonth: '', // YYYY-MM format
  theme: 'light', // 'light' or 'dark'
  
  // Transaction list filtering, sorting, and pagination
  filters: {
    search: '',
    type: 'all',
    category: 'all',
    date: 'all',
    amount: 'all'
  },
  sort: {
    key: 'date',
    order: 'desc' // 'asc' or 'desc'
  },
  pagination: {
    page: 1,
    itemsPerPage: 10
  },
  
  // Compiled report details
  report: {
    compiled: false,
    range: 'thismonth',
    startDate: '',
    endDate: '',
    data: {
      transactions: [],
      totalIncome: 0,
      totalExpense: 0,
      totalSavings: 0,
      highestCategory: '-',
      categorySummary: {}
    }
  },
  
  // Chart.js references
  charts: {
    trends: null,
    categories: null,
    utilization: null
  }
};

// Standard Categories Configuration
const CATEGORIES = {
  expense: [
    'Food & Dining',
    'Shopping',
    'Entertainment',
    'Utilities',
    'Rent & Housing',
    'Travel',
    'Healthcare',
    'Education',
    'Miscellaneous'
  ],
  income: [
    'Salary',
    'Freelance',
    'Investments',
    'Gifts',
    'Other'
  ]
};

// Color tokens for UI accents
const COLORS = {
  primary: '#2563eb', // Blue-600
  primaryDark: '#6366f1', // Indigo-500 (used in dark theme)
  success: '#22c55e', // Green-500
  danger: '#ef4444', // Red-500
  warning: '#f59e0b', // Amber-500
  info: '#0ea5e9', // Sky-500
  chartPalette: [
    '#2563eb', // Blue
    '#0ea5e9', // Sky
    '#22c55e', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#a855f7', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#6366f1'  // Indigo
  ]
};

// ==========================================
// Dynamic SweetAlert & Toast Helper
// ==========================================
function getSwalTheme() {
  const isDark = document.body.classList.contains('dark-theme');
  return {
    background: isDark ? '#0d1321' : '#ffffff',
    color: isDark ? '#f3f4f6' : '#1f2937',
    confirmButtonColor: isDark ? '#6366f1' : '#2563eb',
    cancelButtonColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  };
}

function getToast() {
  const st = getSwalTheme();
  return Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
    background: st.background,
    color: st.color,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });
}

// ==========================================
// Initialization & Session Management
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme preference or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  state.theme = savedTheme;
  if (savedTheme === 'dark') {
    document.body.className = 'dark-theme';
  } else {
    document.body.className = 'light-theme';
  }
  updateThemeIcons();

  // Check session status
  checkSession();
  
  // Dynamic category lists loading on Modal Flow Type switch
  document.querySelectorAll('input[name="tx-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      populateCategoryDropdown(e.target.value);
    });
  });

  // Handle outside clicks to close dropdowns
  window.addEventListener('click', (e) => {
    const dropdown = document.getElementById('mobile-dropdown-menu');
    const avatar = document.querySelector('.mobile-user-avatar');
    if (dropdown && avatar && !avatar.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
});

async function checkSession() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    
    if (data.loggedIn) {
      handleLoginSuccess(data.user);
    } else {
      showAuthScreen();
    }
  } catch (error) {
    console.error('Session check failed:', error);
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('mobile-header').classList.add('hidden');
  document.getElementById('mobile-nav').classList.add('hidden');
  state.user = null;
  lucide.createIcons();
}

function handleLoginSuccess(user) {
  state.user = user;
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  
  // Show header and mobile components
  if (window.innerWidth <= 768) {
    document.getElementById('mobile-header').classList.remove('hidden');
    document.getElementById('mobile-nav').classList.remove('hidden');
  }

  // Update profile name variables
  document.getElementById('username-display').textContent = user.username;
  document.getElementById('user-initials').textContent = user.username.substring(0, 2).toUpperCase();
  document.getElementById('mobile-user-initials').textContent = user.username.substring(0, 2).toUpperCase();
  document.getElementById('mobile-dropdown-name').textContent = user.username;
  document.getElementById('header-greeting').textContent = `Welcome back, ${user.username}`;
  
  // Format top header dates
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('header-date').textContent = new Date().toLocaleDateString('en-US', options);

  // Initialize data loading
  fetchData();
}

// ==========================================
// Theme Toggler
// ==========================================
function toggleTheme() {
  const currentTheme = document.body.className;
  if (currentTheme === 'dark-theme') {
    document.body.className = 'light-theme';
    state.theme = 'light';
    localStorage.setItem('theme', 'light');
  } else {
    document.body.className = 'dark-theme';
    state.theme = 'dark';
    localStorage.setItem('theme', 'dark');
  }
  updateThemeIcons();
  
  // Re-draw active charts with the new colors context
  if (state.activeView === 'analytics') {
    renderCharts();
  } else if (state.activeView === 'dashboard') {
    renderDashboardBudgets();
  }
  
  getToast().fire({
    icon: 'success',
    title: `Switched to ${state.theme} mode`
  });
}

function updateThemeIcons() {
  const isDark = state.theme === 'dark';
  const desktopIcon = document.getElementById('theme-icon-desktop');
  const mobileIcon = document.getElementById('theme-icon-mobile');
  
  if (desktopIcon) desktopIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
  if (mobileIcon) mobileIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
  
  const desktopText = document.querySelector('#theme-toggle-desktop span');
  if (desktopText) desktopText.textContent = isDark ? 'Light Theme' : 'Dark Theme';

  lucide.createIcons();
}

// Toggle mobile profile menu dropdown
function toggleMobileMenu() {
  const dropdown = document.getElementById('mobile-dropdown-menu');
  if (dropdown) dropdown.classList.toggle('hidden');
}

// ==========================================
// API Handlers (Data Retrieval)
// ==========================================
async function fetchData() {
  // Show Loading Animation
  showLoading(true);
  try {
    // Parallel fetching for high performance
    const [txRes, budgetRes] = await Promise.all([
      fetch('/api/transactions'),
      fetch('/api/budgets')
    ]);

    state.transactions = await txRes.json();
    state.budgets = await budgetRes.json();

    // Dynamically calculate months list from actual transactions log
    populateMonthSelector();
    
    // Set active month selection if empty
    if (!state.selectedMonth) {
      state.selectedMonth = getActiveMonth();
      document.getElementById('dashboard-month-select').value = state.selectedMonth;
    }

    // Now fetch month-filtered summary statistics
    await fetchSummaryStats();

    // Redraw interface views
    updateUI();
  } catch (error) {
    console.error('Data retrieval failed:', error);
    getToast().fire({
      icon: 'error',
      title: 'Database connection failed'
    });
  } finally {
    showLoading(false);
  }
}

async function fetchSummaryStats() {
  try {
    const monthParam = state.selectedMonth ? `?month=${state.selectedMonth}` : '';
    const res = await fetch(`/api/stats/summary${monthParam}`);
    state.summary = await res.json();
  } catch (error) {
    console.error('Stats query failed:', error);
  }
}

function showLoading(isLoading) {
  const loader = document.getElementById('skeleton-loader');
  const dashboard = document.getElementById('view-dashboard');
  if (loader && dashboard) {
    if (isLoading) {
      loader.classList.remove('hidden');
      dashboard.classList.add('hidden');
    } else {
      loader.classList.add('hidden');
      dashboard.classList.remove('hidden');
    }
  }
}

// Generate a listing of unique transaction months for selector dropdown
function populateMonthSelector() {
  const select = document.getElementById('dashboard-month-select');
  const prevVal = select.value || state.selectedMonth;
  select.innerHTML = '';

  const uniqueMonths = [...new Set(state.transactions.map(t => t.date.substring(0, 7)))].sort().reverse();
  
  // If no transactions, add current calendar month
  if (uniqueMonths.length === 0) {
    const current = new Date().toISOString().substring(0, 7);
    uniqueMonths.push(current);
  }

  uniqueMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = formatMonthYear(m);
    select.appendChild(opt);
  });

  // Keep state matching selection
  if (uniqueMonths.includes(prevVal)) {
    select.value = prevVal;
    state.selectedMonth = prevVal;
  } else {
    state.selectedMonth = uniqueMonths[0];
    select.value = uniqueMonths[0];
  }
}

function getActiveMonth() {
  const uniqueMonths = [...new Set(state.transactions.map(t => t.date.substring(0, 7)))].sort().reverse();
  if (uniqueMonths.length > 0) {
    return uniqueMonths[0];
  }
  return new Date().toISOString().substring(0, 7);
}

// ==========================================
// SPA View Controller
// ==========================================
function switchView(viewName) {
  state.activeView = viewName;
  
  // Update Navigation active styles (sidebar + mobile footer tab)
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
  
  const desktopNav = document.getElementById(`nav-${viewName}`);
  const mobileNav = document.getElementById(`mobile-nav-${viewName}`);
  if (desktopNav) desktopNav.classList.add('active');
  if (mobileNav) mobileNav.classList.add('active');

  // Switch display panels visibility
  document.querySelectorAll('.content-view').forEach(view => view.classList.add('hidden'));
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  // Show/Hide Month filter controls in header (hide on budgets, reports, and analytics)
  const monthFilter = document.getElementById('month-filter-container');
  if (monthFilter) {
    if (viewName === 'dashboard') {
      monthFilter.classList.remove('hidden');
    } else {
      monthFilter.classList.add('hidden');
    }
  }

  // Reload views contents
  if (viewName === 'analytics') {
    renderCharts();
    renderInsights();
  } else if (viewName === 'reports') {
    resetReportView();
  }
  
  lucide.createIcons();
}

async function handleMonthChange() {
  state.selectedMonth = document.getElementById('dashboard-month-select').value;
  showLoading(true);
  await fetchSummaryStats();
  updateUI();
  showLoading(false);
}

function updateUI() {
  renderMetrics();
  renderDashboardBudgets();
  renderDashboardTransactions();
  renderTransactionsList();
  renderBudgetsList();
  populateFilterCategoryDropdown();
  lucide.createIcons();
}

// ==========================================
// Dashboard Metric & Data Renderers
// ==========================================
function renderMetrics() {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  
  // Compute savings rate
  const income = state.summary.totalIncome;
  const expense = state.summary.totalExpense;
  const savings = income - expense;
  const rate = income > 0 ? ((savings / income) * 100).toFixed(0) : 0;
  
  document.getElementById('metric-balance').textContent = formatter.format(savings);
  document.getElementById('metric-income').textContent = formatter.format(income);
  document.getElementById('metric-expense').textContent = formatter.format(expense);
  document.getElementById('metric-savings').textContent = formatter.format(savings);
  
  const rateBadge = document.getElementById('metric-savings-rate');
  rateBadge.textContent = `${rate}%`;
  
  // Savings Rate Color
  if (savings < 0) {
    document.getElementById('metric-balance').className = 'amount text-danger';
    document.getElementById('metric-savings').className = 'amount text-danger';
    rateBadge.className = 'text-danger';
  } else {
    document.getElementById('metric-balance').className = 'amount text-primary';
    document.getElementById('metric-savings').className = 'amount text-success';
    rateBadge.className = 'text-success';
  }
}

function renderDashboardBudgets() {
  const container = document.getElementById('dashboard-budgets');
  container.innerHTML = '';
  
  const budgets = state.summary.budgetsStatus;
  
  if (!budgets || budgets.length === 0) {
    container.innerHTML = `
      <div class="no-data-msg">
        <i data-lucide="pie-chart"></i>
        <p>No active category budgets configured.</p>
      </div>
    `;
    return;
  }

  budgets.forEach(b => {
    const percentage = b.limit_amount > 0 ? (b.spent / b.limit_amount) * 100 : 0;
    const formattedPercent = percentage.toFixed(0);
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

    let fillClass = '';
    let warningHTML = '';
    
    if (percentage >= 100) {
      fillClass = 'exceeded';
      warningHTML = `
        <span class="budget-limit-exceeded-warning">
          <i data-lucide="alert-triangle"></i> Exceeded limit by ${formatter.format(b.spent - b.limit_amount)}
        </span>
      `;
    } else if (percentage >= 80) {
      fillClass = 'warning';
      warningHTML = `
        <span class="budget-limit-exceeded-warning text-warning">
          <i data-lucide="alert-circle"></i> Approaching category limit
        </span>
      `;
    }

    const budgetHTML = `
      <div class="budget-bar-container">
        <div class="budget-bar-meta">
          <span class="budget-bar-category">${b.category}</span>
          <span class="budget-bar-usage">${formatter.format(b.spent)} of ${formatter.format(b.limit_amount)} (${formattedPercent}%)</span>
        </div>
        <div class="budget-track">
          <div class="budget-fill ${fillClass}" style="width: ${Math.min(percentage, 100)}%"></div>
        </div>
        ${warningHTML}
      </div>
    `;
    container.insertAdjacentHTML('beforeend', budgetHTML);
  });
}

function renderDashboardTransactions() {
  const container = document.getElementById('dashboard-transactions');
  container.innerHTML = '';
  
  // Show only top 5 recent records for current month
  const monthlyTx = state.transactions.filter(t => t.date.substring(0, 7) === state.selectedMonth);
  const recent = monthlyTx.slice(0, 5);
  
  if (recent.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="4" class="text-center" style="padding: 24px; color: var(--text-muted);">
          No transactions logged in ${formatMonthYear(state.selectedMonth)}.
        </td>
      </tr>
    `;
    return;
  }

  recent.forEach(tx => {
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    const amountClass = tx.type === 'income' ? 'text-success font-semibold' : 'text-danger';
    const amountPrefix = tx.type === 'income' ? '+' : '-';
    
    const rowHTML = `
      <tr>
        <td><span class="tx-category-tag">${tx.category}</span></td>
        <td style="max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${tx.description || '<span style="color:var(--text-muted-dark); font-style:italic;">No description</span>'}
        </td>
        <td style="color: var(--text-muted);">${formatDate(tx.date)}</td>
        <td class="text-right ${amountClass}">${amountPrefix}${formatter.format(tx.amount)}</td>
      </tr>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);
  });
}

// ==========================================
// Transaction Vault Table (Filtering, Sorting, Pagination)
// ==========================================
function populateFilterCategoryDropdown() {
  const select = document.getElementById('tx-category-filter');
  const prevVal = select.value;
  select.innerHTML = '<option value="all">All Categories</option>';
  
  const uniqueCategories = [...new Set(state.transactions.map(t => t.category))].sort();
  uniqueCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
  select.value = prevVal;
}

function applyFilters() {
  state.filters.search = document.getElementById('tx-search').value.toLowerCase().trim();
  state.filters.type = document.getElementById('tx-type-filter').value;
  state.filters.category = document.getElementById('tx-category-filter').value;
  state.filters.date = document.getElementById('tx-date-filter').value;
  state.filters.amount = document.getElementById('tx-amount-filter').value;
  
  // Return to first page after filter change
  state.pagination.page = 1;
  
  renderTransactionsList();
}

function toggleSort(key) {
  if (state.sort.key === key) {
    state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.key = key;
    state.sort.order = 'asc';
  }
  
  renderTransactionsList();
}

function getFilteredTransactions() {
  return state.transactions.filter(tx => {
    // 1. Search Query
    const matchesSearch = tx.description.toLowerCase().includes(state.filters.search) || 
                          tx.category.toLowerCase().includes(state.filters.search);
    
    // 2. Flow Type
    const matchesType = state.filters.type === 'all' || tx.type === state.filters.type;
    
    // 3. Category
    const matchesCategory = state.filters.category === 'all' || tx.category === state.filters.category;
    
    // 4. Date Preset Range
    let matchesDate = true;
    if (state.filters.date !== 'all') {
      const txDate = new Date(tx.date);
      const today = new Date();
      today.setHours(0,0,0,0);
      
      if (state.filters.date === '7days') {
        const diff = (today - txDate) / (1000 * 60 * 60 * 24);
        matchesDate = diff <= 7 && diff >= 0;
      } else if (state.filters.date === '30days') {
        const diff = (today - txDate) / (1000 * 60 * 60 * 24);
        matchesDate = diff <= 30 && diff >= 0;
      } else if (state.filters.date === 'thismonth') {
        const currentMonthStr = today.toISOString().substring(0, 7);
        matchesDate = tx.date.substring(0, 7) === currentMonthStr;
      } else if (state.filters.date === 'lastmonth') {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthStr = lastMonth.toISOString().substring(0, 7);
        matchesDate = tx.date.substring(0, 7) === lastMonthStr;
      }
    }
    
    // 5. Amount Ranges
    let matchesAmount = true;
    if (state.filters.amount !== 'all') {
      if (state.filters.amount === 'under100') {
        matchesAmount = tx.amount < 100;
      } else if (state.filters.amount === '100to500') {
        matchesAmount = tx.amount >= 100 && tx.amount <= 500;
      } else if (state.filters.amount === 'over500') {
        matchesAmount = tx.amount > 500;
      }
    }

    return matchesSearch && matchesType && matchesCategory && matchesDate && matchesAmount;
  });
}

function renderTransactionsList() {
  const container = document.getElementById('transactions-list');
  container.innerHTML = '';

  let filtered = getFilteredTransactions();
  
  // Sort Transactions
  filtered.sort((a, b) => {
    let valA = a[state.sort.key];
    let valB = b[state.sort.key];
    
    // Handle string capitalization or dates
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }
    
    if (valA < valB) return state.sort.order === 'asc' ? -1 : 1;
    if (valA > valB) return state.sort.order === 'asc' ? 1 : -1;
    return 0;
  });

  // Apply Pagination
  const total = filtered.length;
  const itemsPerPage = state.pagination.itemsPerPage;
  const page = state.pagination.page;
  
  const startIdx = total === 0 ? 0 : (page - 1) * itemsPerPage;
  const endIdx = Math.min(page * itemsPerPage, total);
  
  const pageItems = filtered.slice(startIdx, endIdx);

  // Update Page details on screen
  document.getElementById('pg-start-idx').textContent = total === 0 ? 0 : startIdx + 1;
  document.getElementById('pg-end-idx').textContent = endIdx;
  document.getElementById('pg-total-count').textContent = total;
  
  updatePaginationControls(total);

  if (pageItems.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px; color: var(--text-muted);">
          <i data-lucide="search" style="width:32px; height:32px; opacity:0.3; margin-bottom:12px;"></i>
          <p>No transactions found matching your filters.</p>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  pageItems.forEach(tx => {
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    const typeBadge = tx.type === 'income' 
      ? '<span class="badge badge-income"><i data-lucide="arrow-up-right"></i>Income</span>'
      : '<span class="badge badge-expense"><i data-lucide="arrow-down-left"></i>Expense</span>';
    
    const amountClass = tx.type === 'income' ? 'text-success' : 'text-danger';
    const amountPrefix = tx.type === 'income' ? '+' : '-';

    const rowHTML = `
      <tr>
        <td>${typeBadge}</td>
        <td><span class="tx-category-tag">${tx.category}</span></td>
        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: normal;">
          ${tx.description || '<span style="color: var(--text-muted-dark); font-style: italic;">No description</span>'}
        </td>
        <td style="color: var(--text-muted);">${formatDate(tx.date)}</td>
        <td class="text-right ${amountClass}" style="font-weight: 600;">${amountPrefix}${formatter.format(tx.amount)}</td>
        <td class="text-center">
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button class="btn-icon edit-btn" onclick="openTransactionModal('${tx.type}', ${tx.id})" title="Edit record">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="btn-icon delete-btn" onclick="deleteTransaction(${tx.id})" title="Delete record">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);
  });
  
  updateSortIcons();
  lucide.createIcons();
}

function updateSortIcons() {
  document.querySelectorAll('.sortable-header').forEach(th => {
    const icon = th.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', 'arrow-up-down');
      icon.style.opacity = '0.3';
    }
  });

  const activeHeader = document.querySelector(`th[onclick="toggleSort('${state.sort.key}')"]`);
  if (activeHeader) {
    const icon = activeHeader.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', state.sort.order === 'asc' ? 'arrow-up' : 'arrow-down');
      icon.style.opacity = '1';
      icon.style.color = 'var(--primary)';
    }
  }
}

function updatePaginationControls(totalCount) {
  const totalPages = Math.ceil(totalCount / state.pagination.itemsPerPage);
  const prevBtn = document.getElementById('btn-pg-prev');
  const nextBtn = document.getElementById('btn-pg-next');
  const list = document.getElementById('pagination-pages-list');
  list.innerHTML = '';
  
  if (totalPages <= 1) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }
  
  prevBtn.disabled = state.pagination.page === 1;
  nextBtn.disabled = state.pagination.page === totalPages;

  // Render Page buttons
  for (let i = 1; i <= totalPages; i++) {
    // Only display surrounding pages on mobile to keep layouts compact
    if (totalPages > 5 && Math.abs(state.pagination.page - i) > 2 && i !== 1 && i !== totalPages) {
      if (i === 2 || i === totalPages - 1) {
        const dot = document.createElement('span');
        dot.textContent = '...';
        dot.style.padding = '0 6px';
        list.appendChild(dot);
      }
      continue;
    }

    const btn = document.createElement('button');
    btn.className = `page-num ${state.pagination.page === i ? 'active' : ''}`;
    btn.textContent = i;
    btn.onclick = () => {
      state.pagination.page = i;
      renderTransactionsList();
    };
    list.appendChild(btn);
  }
}

function changePage(delta) {
  state.pagination.page += delta;
  renderTransactionsList();
}

// ==========================================
// Transaction Form Modals Control
// ==========================================
function populateCategoryDropdown(type, selectedVal = '') {
  const select = document.getElementById('modal-tx-category');
  select.innerHTML = '<option value="" disabled selected>Select a category</option>';
  
  const categories = CATEGORIES[type] || [];
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
  
  if (selectedVal) {
    select.value = selectedVal;
  }
}

function openTransactionModal(type, editId = null) {
  const modal = document.getElementById('transaction-modal');
  const title = document.getElementById('modal-tx-title');
  const submitBtn = document.getElementById('modal-tx-submit-btn');
  
  document.getElementById('modal-tx-date').value = new Date().toISOString().split('T')[0];
  
  if (editId) {
    const tx = state.transactions.find(t => t.id === editId);
    if (!tx) return;
    
    title.textContent = 'Modify Transaction';
    submitBtn.textContent = 'Apply Edits';
    document.getElementById('modal-tx-id').value = editId;
    
    if (tx.type === 'expense') {
      document.getElementById('type-expense').checked = true;
    } else {
      document.getElementById('type-income').checked = true;
    }
    
    document.getElementById('modal-tx-amount').value = tx.amount;
    document.getElementById('modal-tx-date').value = tx.date;
    document.getElementById('modal-tx-desc').value = tx.description;
    
    populateCategoryDropdown(tx.type, tx.category);
  } else {
    title.textContent = type === 'expense' ? 'Add New Expense' : 'Add New Income';
    submitBtn.textContent = 'Save Record';
    document.getElementById('modal-tx-id').value = '';
    
    if (type === 'expense') {
      document.getElementById('type-expense').checked = true;
    } else {
      document.getElementById('type-income').checked = true;
    }
    
    document.getElementById('modal-tx-amount').value = '';
    document.getElementById('modal-tx-desc').value = '';
    
    populateCategoryDropdown(type);
  }
  
  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeTransactionModal() {
  document.getElementById('transaction-modal').classList.add('hidden');
  document.getElementById('transaction-form').reset();
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  
  const id = document.getElementById('modal-tx-id').value;
  const type = document.querySelector('input[name="tx-type"]:checked').value;
  const amount = parseFloat(document.getElementById('modal-tx-amount').value);
  const category = document.getElementById('modal-tx-category').value;
  const date = document.getElementById('modal-tx-date').value;
  const description = document.getElementById('modal-tx-desc').value;

  if (!category) {
    getToast().fire({ icon: 'warning', title: 'Please select a category' });
    return;
  }

  const payload = { type, amount, category, date, description };
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/transactions/${id}` : '/api/transactions';

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (response.ok) {
      getToast().fire({
        icon: 'success',
        title: id ? 'Transaction updated!' : 'Transaction recorded!'
      });
      closeTransactionModal();
      fetchData(); // Reload stats and list
    } else {
      const sw = getSwalTheme();
      Swal.fire({
        icon: 'error',
        title: 'Error Saving Transaction',
        text: data.error || 'Server error occurred.',
        confirmButtonColor: sw.confirmButtonColor,
        background: sw.background,
        color: sw.color
      });
    }
  } catch (error) {
    console.error('Failed to commit transaction:', error);
  }
}

async function deleteTransaction(id) {
  const sw = getSwalTheme();
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: 'This transaction record will be permanently deleted.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: sw.cancelButtonColor,
    confirmButtonText: 'Yes, delete it!',
    background: sw.background,
    color: sw.color
  });

  if (result.isConfirmed) {
    try {
      const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (response.ok) {
        getToast().fire({
          icon: 'success',
          title: 'Record deleted.'
        });
        fetchData();
      } else {
        getToast().fire({ icon: 'error', title: 'Failed to delete transaction' });
      }
    } catch (error) {
      console.error('Delete tx failed:', error);
    }
  }
}

// ==========================================
// Budgets View Managers
// ==========================================
async function handleSetBudget(e) {
  e.preventDefault();
  const category = document.getElementById('budget-category').value;
  const limit_amount = parseFloat(document.getElementById('budget-limit').value);

  if (!category) {
    getToast().fire({ icon: 'warning', title: 'Please select a category' });
    return;
  }

  try {
    const response = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, limit_amount })
    });

    const data = await response.json();
    if (response.ok) {
      getToast().fire({
        icon: 'success',
        title: `Budget set for ${category}!`
      });
      document.getElementById('budget-form').reset();
      fetchData();
    } else {
      getToast().fire({ icon: 'error', title: data.error || 'Failed to establish budget' });
    }
  } catch (error) {
    console.error('Save budget fail:', error);
  }
}

async function deleteBudget(id) {
  const sw = getSwalTheme();
  const result = await Swal.fire({
    title: 'Remove budget limit?',
    text: 'Outflow boundaries for this category will no longer be enforced.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: sw.cancelButtonColor,
    confirmButtonText: 'Remove Limit',
    background: sw.background,
    color: sw.color
  });

  if (result.isConfirmed) {
    try {
      const response = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (response.ok) {
        getToast().fire({
          icon: 'success',
          title: 'Budget rule removed.'
        });
        fetchData();
      }
    } catch (error) {
      console.error('Budget delete failed:', error);
    }
  }
}

function renderBudgetsList() {
  const container = document.getElementById('budgets-display-list');
  container.innerHTML = '';

  const budgets = state.summary.budgetsStatus;

  if (!budgets || budgets.length === 0) {
    container.innerHTML = `
      <div class="no-data-msg" style="grid-column: span 2;">
        <i data-lucide="pie-chart"></i>
        <p>No active category constraints found. Configure limits using the panel on the left!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  budgets.forEach(b => {
    const percentage = b.limit_amount > 0 ? (b.spent / b.limit_amount) * 100 : 0;
    const formattedPercent = percentage.toFixed(0);
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    
    let fillClass = '';
    let cardBorder = '';
    if (percentage >= 100) {
      fillClass = 'exceeded';
      cardBorder = 'style="border-color: rgba(239, 68, 68, 0.4);"';
    } else if (percentage >= 80) {
      fillClass = 'warning';
      cardBorder = 'style="border-color: rgba(245, 158, 11, 0.4);"';
    }

    const cardHTML = `
      <div class="budget-status-card" ${cardBorder}>
        <div class="budget-card-header">
          <span class="budget-card-title">${b.category}</span>
          <button class="btn-icon delete-btn" onclick="deleteBudget(${b.id})" title="Delete budget rule">
            <i data-lucide="minus-circle"></i>
          </button>
        </div>
        <div class="budget-card-amounts">
          <span class="spent-txt ${percentage >= 100 ? 'text-danger' : percentage >= 80 ? 'text-warning' : 'text-success'}">
            ${formatter.format(b.spent)}
          </span>
          <span class="limit-txt">Monthly Limit: ${formatter.format(b.limit_amount)}</span>
        </div>
        <div class="budget-track">
          <div class="budget-fill ${fillClass}" style="width: ${Math.min(percentage, 100)}%"></div>
        </div>
        <span style="font-size: 11px; text-align: right; color: var(--text-muted); font-weight:600; margin-top: -6px;">
          ${formattedPercent}% Allocated
        </span>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHTML);
  });
  lucide.createIcons();
}

// ==========================================
// Reports Compiler & Exports Engine (New)
// ==========================================
function toggleCustomReportDates() {
  const range = document.getElementById('report-range').value;
  const dateBlock = document.getElementById('custom-report-dates');
  if (range === 'custom') {
    dateBlock.classList.remove('hidden');
    // Set default dates
    const endStr = new Date().toISOString().split('T')[0];
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const startStr = start.toISOString().split('T')[0];
    document.getElementById('report-start-date').value = startStr;
    document.getElementById('report-end-date').value = endStr;
  } else {
    dateBlock.classList.add('hidden');
  }
}

function resetReportView() {
  state.report.compiled = false;
  document.getElementById('report-preview-empty').classList.remove('hidden');
  document.getElementById('report-preview-content').classList.add('hidden');
  document.getElementById('report-export-actions').classList.add('hidden');
}

function handleGenerateReport() {
  const range = document.getElementById('report-range').value;
  let startStr = '';
  let endStr = '';
  
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  if (range === 'thismonth') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    startStr = start.toISOString().split('T')[0];
    endStr = today.toISOString().split('T')[0];
  } else if (range === 'lastmonth') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    startStr = start.toISOString().split('T')[0];
    endStr = end.toISOString().split('T')[0];
  } else if (range === '7days') {
    const start = new Date();
    start.setDate(today.getDate() - 7);
    startStr = start.toISOString().split('T')[0];
    endStr = today.toISOString().split('T')[0];
  } else if (range === '30days') {
    const start = new Date();
    start.setDate(today.getDate() - 30);
    startStr = start.toISOString().split('T')[0];
    endStr = today.toISOString().split('T')[0];
  } else if (range === '3months') {
    const start = new Date();
    start.setMonth(today.getMonth() - 3);
    startStr = start.toISOString().split('T')[0];
    endStr = today.toISOString().split('T')[0];
  } else if (range === '6months') {
    const start = new Date();
    start.setMonth(today.getMonth() - 6);
    startStr = start.toISOString().split('T')[0];
    endStr = today.toISOString().split('T')[0];
  } else if (range === 'year') {
    const start = new Date();
    start.setFullYear(today.getFullYear() - 1);
    startStr = start.toISOString().split('T')[0];
    endStr = today.toISOString().split('T')[0];
  } else if (range === 'custom') {
    startStr = document.getElementById('report-start-date').value;
    endStr = document.getElementById('report-end-date').value;
    
    if (!startStr || !endStr) {
      getToast().fire({ icon: 'warning', title: 'Please select start and end dates' });
      return;
    }
  }

  // Compile Transactions in Date Range
  const startTimestamp = new Date(startStr + 'T00:00:00');
  const endTimestamp = new Date(endStr + 'T23:59:59');
  
  const reportTx = state.transactions.filter(tx => {
    const txDate = new Date(tx.date + 'T12:00:00');
    return txDate >= startTimestamp && txDate <= endTimestamp;
  });

  // Calculate Metrics
  let income = 0;
  let expense = 0;
  let categorySummary = {};
  
  reportTx.forEach(tx => {
    if (tx.type === 'income') {
      income += tx.amount;
    } else {
      expense += tx.amount;
      categorySummary[tx.category] = (categorySummary[tx.category] || 0) + tx.amount;
    }
  });

  // Find highest category
  let highestCat = '-';
  let maxSpent = -1;
  Object.keys(categorySummary).forEach(cat => {
    if (categorySummary[cat] > maxSpent) {
      maxSpent = categorySummary[cat];
      highestCat = cat;
    }
  });

  // Save report compilation state
  state.report.compiled = true;
  state.report.range = range;
  state.report.startDate = startStr;
  state.report.endDate = endStr;
  state.report.data = {
    transactions: reportTx,
    totalIncome: income,
    totalExpense: expense,
    totalSavings: income - expense,
    highestCategory: highestCat,
    categorySummary: categorySummary
  };

  // Populate preview DOM
  document.getElementById('report-preview-empty').classList.add('hidden');
  document.getElementById('report-preview-content').classList.remove('hidden');
  document.getElementById('report-export-actions').classList.remove('hidden');
  
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  document.getElementById('report-preview-range').textContent = `Compilation Range: ${startStr} to ${endStr}`;
  document.getElementById('report-metric-income').textContent = formatter.format(income);
  document.getElementById('report-metric-expense').textContent = formatter.format(expense);
  document.getElementById('report-metric-savings').textContent = formatter.format(income - expense);
  document.getElementById('report-metric-highest').textContent = highestCat === '-' ? '-' : `${highestCat} (${formatter.format(maxSpent)})`;
  document.getElementById('report-meta-count').textContent = reportTx.length;
  document.getElementById('report-meta-user').textContent = state.user.username;

  // Savings colors
  const reportSavingsEl = document.getElementById('report-metric-savings');
  if (income - expense < 0) {
    reportSavingsEl.className = 'report-metric-val text-danger';
  } else {
    reportSavingsEl.className = 'report-metric-val text-primary';
  }

  // Populate table
  const tbody = document.getElementById('report-transactions-list');
  tbody.innerHTML = '';
  
  if (reportTx.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:24px; color:var(--text-muted);">No records found in range.</td></tr>`;
    return;
  }

  reportTx.forEach(tx => {
    const typeBadge = tx.type === 'income' 
      ? '<span class="badge badge-income">Income</span>'
      : '<span class="badge badge-expense">Expense</span>';
    
    const amountClass = tx.type === 'income' ? 'text-success' : 'text-danger';
    const amountPrefix = tx.type === 'income' ? '+' : '-';
    
    const row = `
      <tr>
        <td>${typeBadge}</td>
        <td><span class="tx-category-tag">${tx.category}</span></td>
        <td>${tx.description || '<span style="color:var(--text-muted-dark); font-style:italic;">No description</span>'}</td>
        <td style="color:var(--text-muted);">${formatDate(tx.date)}</td>
        <td class="text-right ${amountClass}" style="font-weight: 600;">${amountPrefix}${formatter.format(tx.amount)}</td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', row);
  });
  
  getToast().fire({
    icon: 'success',
    title: 'Report compiled successfully!'
  });
}

// PDF, Excel, and CSV Export engines
function exportReport(format) {
  if (!state.report.compiled) return;
  
  const reportData = state.report.data;
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const dateRangeStr = `${state.report.startDate} to ${state.report.endDate}`;
  const filename = `Aura_Finance_Report_${state.report.startDate}_to_${state.report.endDate}`;

  if (format === 'csv') {
    // Generate CSV
    let csv = 'Type,Category,Description,Date,Amount ($)\n';
    reportData.transactions.forEach(t => {
      const amount = t.amount.toFixed(2);
      const desc = (t.description || '').replace(/"/g, '""');
      csv += `${t.type.toUpperCase()},"${t.category}","${desc}",${t.date},${t.type === 'expense' ? '-' : ''}${amount}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    getToast().fire({ icon: 'success', title: 'CSV Downloaded!' });
    
  } else if (format === 'excel') {
    // Generate Excel Sheets via SheetJS
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Summary Stats
    const summaryRows = [
      ['Aura Finance - Financial Summary Report'],
      ['Date Range', dateRangeStr],
      ['Generated On', new Date().toLocaleDateString()],
      ['Account Holder', state.user.username],
      [],
      ['Key Performance Indicators', 'Value ($)'],
      ['Total Income', reportData.totalIncome],
      ['Total Expenses', reportData.totalExpense],
      ['Net Savings', reportData.totalSavings],
      ['Highest Category Outflow', reportData.highestCategory],
      [],
      ['Category Expenses Summary', 'Spent ($)']
    ];
    
    Object.keys(reportData.categorySummary).forEach(cat => {
      summaryRows.push([cat, reportData.categorySummary[cat]]);
    });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Report Summary');
    
    // Sheet 2: Transactions Detail
    const txRows = [['Type', 'Category', 'Description', 'Date', 'Amount ($)']];
    reportData.transactions.forEach(t => {
      txRows.push([
        t.type.toUpperCase(),
        t.category,
        t.description || '',
        t.date,
        t.type === 'expense' ? -t.amount : t.amount
      ]);
    });
    
    const txSheet = XLSX.utils.aoa_to_sheet(txRows);
    XLSX.utils.book_append_sheet(workbook, txSheet, 'Transactions Detail');
    
    // Trigger download
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    getToast().fire({ icon: 'success', title: 'Excel File Downloaded!' });
    
  } else if (format === 'pdf') {
    // Generate Premium PDF Report via jsPDF & AutoTable
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Document Colors Matching Active Theme
    const isDark = state.theme === 'dark';
    const bgHeader = [37, 99, 235]; // Premium Blue
    const textGray = [107, 114, 128];
    const textDark = [31, 41, 55];
    
    // 1. Report Title & Header Banner
    doc.setFillColor(bgHeader[0], bgHeader[1], bgHeader[2]);
    doc.rect(0, 0, 210, 42, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('AURA FINANCE', 14, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Smart Elegant Wealth Intelligence', 14, 25);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | User: ${state.user.username}`, 14, 34);
    
    // 2. Report Overview Parameters
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('FINANCIAL SUMMARY REPORT', 14, 52);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text(`Date Scope: ${dateRangeStr}`, 14, 58);
    
    // Draw horizontal separator line
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 62, 196, 62);
    
    // 3. KPI Grid Columns (Mock Cards)
    doc.setFillColor(248, 250, 252);
    // Card 1
    doc.rect(14, 66, 42, 22, 'F');
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(8);
    doc.text('TOTAL INCOME', 18, 72);
    doc.setTextColor(34, 197, 94); // success green
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(formatter.format(reportData.totalIncome), 18, 81);
    
    // Card 2
    doc.setFillColor(248, 250, 252);
    doc.rect(60, 66, 42, 22, 'F');
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('TOTAL EXPENSE', 64, 72);
    doc.setTextColor(239, 68, 68); // danger red
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(formatter.format(reportData.totalExpense), 64, 81);
    
    // Card 3
    doc.setFillColor(248, 250, 252);
    doc.rect(106, 66, 42, 22, 'F');
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('NET SAVINGS', 110, 72);
    doc.setTextColor(reportData.totalSavings < 0 ? 239 : 37, reportData.totalSavings < 0 ? 68 : 99, reportData.totalSavings < 0 ? 68 : 235);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(formatter.format(reportData.totalSavings), 110, 81);
    
    // Card 4
    doc.setFillColor(248, 250, 252);
    doc.rect(152, 66, 44, 22, 'F');
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('HIGHEST SPENDING', 156, 72);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(reportData.highestCategory, 156, 81);

    // 4. Category breakdown table list
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Expense Breakdown by Category', 14, 98);
    
    const catRows = [];
    Object.keys(reportData.categorySummary).forEach(cat => {
      const spent = reportData.categorySummary[cat];
      const pct = reportData.totalExpense > 0 ? ((spent / reportData.totalExpense) * 100).toFixed(1) + '%' : '0%';
      catRows.push([cat, formatter.format(spent), pct]);
    });
    
    if (catRows.length === 0) {
      catRows.push(['No expenses recorded in range', '-', '-']);
    }

    doc.autoTable({
      startY: 104,
      head: [['Category', 'Amount Spent', 'Percentage share']],
      body: catRows,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 14, right: 14 }
    });

    // 5. Detailed Transactions table list
    const finalY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Detailed Logs & Transactions', 14, finalY);

    const txTableRows = [];
    reportData.transactions.forEach(t => {
      txTableRows.push([
        t.type.toUpperCase(),
        t.category,
        t.description || '',
        t.date,
        (t.type === 'expense' ? '-' : '+') + formatter.format(t.amount)
      ]);
    });
    
    if (txTableRows.length === 0) {
      txTableRows.push(['No transactions logged', '-', '-', '-', '-']);
    }

    doc.autoTable({
      startY: finalY + 6,
      head: [['Type', 'Category', 'Description', 'Date', 'Amount']],
      body: txTableRows,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105] }, // Cool Slate gray
      margin: { left: 14, right: 14 },
      columnStyles: {
        4: { halign: 'right' }
      }
    });

    // Footer page numbers using jsPDF internal loop
    const pagesCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pagesCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(`Aura Finance Reports | Page ${i} of ${pagesCount}`, 14, 287);
    }
    
    doc.save(`${filename}.pdf`);
    getToast().fire({ icon: 'success', title: 'PDF File Downloaded!' });
  }
}

// ==========================================
// Analytics Page Calculations & Financial Insights
// ==========================================
function renderInsights() {
  const container = document.getElementById('analytics-insights-list');
  container.innerHTML = '';

  const expenses = state.transactions.filter(t => t.type === 'expense');
  const incomes = state.transactions.filter(t => t.type === 'income');
  
  if (expenses.length === 0 && incomes.length === 0) {
    container.innerHTML = `
      <div class="insight-item insight-item-info">
        <div class="insight-icon-container"><i data-lucide="info"></i></div>
        <div>No financial logs available. Add transactions to generate dynamic savings insights!</div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const insights = [];

  // Insight 1: Compare selected month spending against previous month
  const today = new Date();
  const currentMonthStr = state.selectedMonth || today.toISOString().substring(0, 7);
  
  // Parse month values
  const parts = currentMonthStr.split('-');
  const yr = parseInt(parts[0], 10);
  const mn = parseInt(parts[1], 10);
  
  // Calculate previous month index
  const prevMonthDate = new Date(yr, mn - 2, 1);
  const prevMonthStr = prevMonthDate.toISOString().substring(0, 7);
  
  const currentMonthExpenses = expenses.filter(t => t.date.substring(0, 7) === currentMonthStr)
                                       .reduce((sum, t) => sum + t.amount, 0);
  const prevMonthExpenses = expenses.filter(t => t.date.substring(0, 7) === prevMonthStr)
                                    .reduce((sum, t) => sum + t.amount, 0);

  if (prevMonthExpenses > 0) {
    const diff = currentMonthExpenses - prevMonthExpenses;
    const pct = ((Math.abs(diff) / prevMonthExpenses) * 100).toFixed(0);
    
    if (diff > 0) {
      insights.push({
        type: 'warning',
        text: `Your spending in ${formatMonthYear(currentMonthStr)} increased by <strong>${pct}%</strong> (${formatter.format(diff)}) compared to last month. Consider review category limit caps.`
      });
    } else {
      insights.push({
        type: 'success',
        text: `Excellent! You saved <strong>${pct}%</strong> on monthly outflows compared to ${formatMonthYear(prevMonthStr)}. Keep it up!`
      });
    }
  }

  // Insight 2: Category share warning (e.g. food > 30%)
  const totalMonthExpense = expenses.filter(t => t.date.substring(0, 7) === currentMonthStr)
                                    .reduce((sum, t) => sum + t.amount, 0);
  if (totalMonthExpense > 0) {
    const catSummary = {};
    expenses.filter(t => t.date.substring(0, 7) === currentMonthStr).forEach(t => {
      catSummary[t.category] = (catSummary[t.category] || 0) + t.amount;
    });

    Object.keys(catSummary).forEach(cat => {
      const spent = catSummary[cat];
      const ratio = spent / totalMonthExpense;
      if (ratio > 0.3) {
        insights.push({
          type: 'info',
          text: `Category <strong>${cat}</strong> accounts for <strong>${(ratio * 100).toFixed(0)}%</strong> of your expenses this month. Check if you can reduce budget limits on it.`
        });
      }
    });
  }

  // Insight 3: Savings rate rate checks
  const totalIncome = incomes.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalSavings = totalIncome - totalExpense;
  
  if (totalIncome > 0) {
    const savingsRate = (totalSavings / totalIncome) * 100;
    if (savingsRate > 20) {
      insights.push({
        type: 'success',
        text: `Wow! Your overall lifetime savings rate is <strong>${savingsRate.toFixed(0)}%</strong>. This matches target boundaries for healthy retirement growth.`
      });
    } else if (savingsRate < 5 && savingsRate >= 0) {
      insights.push({
        type: 'warning',
        text: `Your overall savings rate of <strong>${savingsRate.toFixed(0)}%</strong> is on the lower side. Aim to save at least 15% of your total earnings.`
      });
    } else if (savingsRate < 0) {
      insights.push({
        type: 'warning',
        text: `Critically low savings: You have spent <strong>${formatter.format(Math.abs(totalSavings))}</strong> more than you earned. Review category outflows immediately.`
      });
    }
  }

  // Fallback if no specific triggers matched
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      text: 'Spend patterns match typical guidelines. Add more transactions to compile deep wealth tips.'
    });
  }

  // Render insights list HTML
  insights.forEach(ins => {
    let typeClass = 'insight-item-info';
    let icon = 'info';
    
    if (ins.type === 'warning') {
      typeClass = 'insight-item-warning';
      icon = 'alert-triangle';
    } else if (ins.type === 'success') {
      typeClass = 'insight-item-success';
      icon = 'check-circle';
    }
    
    const html = `
      <div class="insight-item ${typeClass}">
        <div class="insight-icon-container"><i data-lucide="${icon}"></i></div>
        <div>${ins.text}</div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
  });
  lucide.createIcons();
}

// ==========================================
// Chart.js Visualizations (Analytics Panel)
// ==========================================
function getChartThemeColors() {
  const isDark = document.body.classList.contains('dark-theme');
  return {
    gridColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
    tickColor: isDark ? '#9ca3af' : '#475569',
    legendColor: isDark ? '#9ca3af' : '#475569',
    tooltipBg: isDark ? '#0d1321' : '#ffffff',
    tooltipColor: isDark ? '#f3f4f6' : '#1f2937',
    tooltipBorderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
    doughnutBorder: isDark ? '#0d1321' : '#ffffff',
    barLimitBg: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.03)',
    barLimitBorder: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)'
  };
}

async function renderCharts() {
  // Clear any existing chart instances to prevent overlapping bugs
  Object.keys(state.charts).forEach(key => {
    if (state.charts[key]) {
      state.charts[key].destroy();
      state.charts[key] = null;
    }
  });

  try {
    const [breakdownRes, trendsRes] = await Promise.all([
      fetch('/api/stats/category-breakdown'),
      fetch('/api/stats/monthly-trends')
    ]);

    const breakdownData = await breakdownRes.json();
    const trendsData = await trendsRes.json();

    // 1. Chart 1: Income vs Expense (Double Bar / Line Chart)
    renderTrendsChart(trendsData);

    // 2. Chart 2: Category Composition (Pie/Doughnut)
    renderCategoriesChart(breakdownData);

    // 3. Chart 3: Budget Utilization (Bar Chart)
    renderBudgetUtilizationChart();

    // 4. Render Analytics metrics averages
    calculateAnalyticsAverages();

  } catch (error) {
    console.error('Failed to load chart reports:', error);
  }
}

function calculateAnalyticsAverages() {
  const expenses = state.transactions.filter(t => t.type === 'expense');
  const incomes = state.transactions.filter(t => t.type === 'income');
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  
  if (expenses.length === 0) {
    document.getElementById('analytics-daily-avg').textContent = '$0.00';
    document.getElementById('analytics-weekly-avg').textContent = '$0.00';
    document.getElementById('analytics-savings-rate').textContent = '0%';
    return;
  }

  // Get date range limits
  const dates = expenses.map(t => new Date(t.date));
  const minDate = new Date(Math.min.apply(null, dates));
  const maxDate = new Date(Math.max.apply(null, dates));
  
  let daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
  if (daysDiff < 1) daysDiff = 1;
  
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomes.reduce((sum, t) => sum + t.amount, 0);
  
  const dailyAvg = totalExpense / daysDiff;
  const weeklyAvg = dailyAvg * 7;
  
  const savings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(0) : 0;
  
  document.getElementById('analytics-daily-avg').textContent = formatter.format(dailyAvg);
  document.getElementById('analytics-weekly-avg').textContent = formatter.format(weeklyAvg);
  
  const rateBadge = document.getElementById('analytics-savings-rate');
  rateBadge.textContent = `${savingsRate}%`;
  rateBadge.className = savings < 0 ? 'amount text-danger' : 'amount text-success';
}

function renderTrendsChart(data) {
  const ctx = document.getElementById('chart-trends').getContext('2d');
  const colors = getChartThemeColors();
  
  if (data.length === 0) return;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const labels = data.map(item => {
    const parts = item.month.split('-');
    const monthIdx = parseInt(parts[1], 10) - 1;
    return `${monthNames[monthIdx]} ${parts[0]}`;
  });

  const incomes = data.map(item => item.income);
  const expenses = data.map(item => item.expense);

  // Gradient effects
  const incomeGradient = ctx.createLinearGradient(0, 0, 0, 300);
  incomeGradient.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
  incomeGradient.addColorStop(1, 'rgba(34, 197, 94, 0.01)');

  const expenseGradient = ctx.createLinearGradient(0, 0, 0, 300);
  expenseGradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
  expenseGradient.addColorStop(1, 'rgba(239, 68, 68, 0.01)');

  state.charts.trends = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomes,
          borderColor: COLORS.success,
          backgroundColor: incomeGradient,
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: COLORS.success,
          pointHoverRadius: 6
        },
        {
          label: 'Expenses',
          data: expenses,
          borderColor: COLORS.danger,
          backgroundColor: expenseGradient,
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: COLORS.danger,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: colors.legendColor, font: { family: 'Inter', weight: 500 } }
        },
        tooltip: {
          padding: 10,
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipColor,
          bodyColor: colors.tooltipColor,
          borderColor: colors.tooltipBorderColor,
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: colors.gridColor },
          ticks: { color: colors.tickColor }
        },
        y: {
          grid: { color: colors.gridColor },
          ticks: {
            color: colors.tickColor,
            callback: value => '$' + value
          }
        }
      }
    }
  });
}

function renderCategoriesChart(data) {
  const canvas = document.getElementById('chart-categories');
  const ctx = canvas.getContext('2d');
  const colors = getChartThemeColors();
  
  if (data.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "13px Inter";
    ctx.fillStyle = colors.tickColor;
    ctx.textAlign = "center";
    ctx.fillText("No expense data recorded.", canvas.width/2, canvas.height/2);
    return;
  }

  const labels = data.map(item => item.category);
  const values = data.map(item => item.total);

  state.charts.categories = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: COLORS.chartPalette,
        borderWidth: 2,
        borderColor: colors.doughnutBorder,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: window.innerWidth <= 768 ? 'bottom' : 'right',
          labels: {
            color: colors.legendColor,
            font: { family: 'Inter', size: 11 },
            boxWidth: 10
          }
        },
        tooltip: {
          padding: 10,
          backgroundColor: colors.tooltipBg,
          bodyColor: colors.tooltipColor,
          borderColor: colors.tooltipBorderColor,
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              const val = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percent = ((val / total) * 100).toFixed(1);
              return ` ${context.label}: $${val.toFixed(2)} (${percent}%)`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

function renderBudgetUtilizationChart() {
  const ctx = document.getElementById('chart-budget-utilization').getContext('2d');
  const colors = getChartThemeColors();
  
  const budgets = state.summary.budgetsStatus;
  if (!budgets || budgets.length === 0) return;

  const labels = budgets.map(b => b.category);
  const limits = budgets.map(b => b.limit_amount);
  const spents = budgets.map(b => b.spent);

  state.charts.utilization = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual Spent',
          data: spents,
          backgroundColor: spents.map((s, i) => s > limits[i] ? 'rgba(239, 68, 68, 0.75)' : 'rgba(34, 197, 94, 0.75)'),
          borderColor: spents.map((s, i) => s > limits[i] ? COLORS.danger : COLORS.success),
          borderWidth: 1.5,
          borderRadius: 4
        },
        {
          label: 'Budget Limit',
          data: limits,
          backgroundColor: colors.barLimitBg,
          borderColor: colors.barLimitBorder,
          borderWidth: 1.5,
          borderDash: [4, 4],
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: colors.legendColor, font: { family: 'Inter', weight: 500 } }
        },
        tooltip: {
          padding: 10,
          backgroundColor: colors.tooltipBg,
          bodyColor: colors.tooltipColor,
          borderColor: colors.tooltipBorderColor,
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.tickColor }
        },
        y: {
          grid: { color: colors.gridColor },
          ticks: {
            color: colors.tickColor,
            callback: value => '$' + value
          }
        }
      }
    }
  });
}

// ==========================================
// Helper Utilities
// ==========================================
function formatDate(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('-');
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatMonthYear(monthStr) {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  const dateObj = new Date(parts[0], parts[1] - 1, 1);
  return dateObj.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
}
