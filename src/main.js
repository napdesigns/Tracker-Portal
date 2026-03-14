// ==========================================
// CRM Tracker — Main Entry Point
// ==========================================

import './index.css';
import {
  seedData, migrateTaskData, getCurrentUser, logout, isAdmin, isSuperAdmin,
  clearUserCache,
} from './store-async.js';
import { supabase } from './supabase.js';
import { renderLogin } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { renderTable } from './table.js';
import { renderTaskDetail } from './task-detail.js';
import { renderUsers } from './users.js';
import { renderAnalytics } from './analytics.js';
import { renderKanban, initKanbanDragDrop } from './kanban.js';
import { renderCalendar } from './calendar.js';
import { renderActivityLog } from './activity-log.js';
import { renderPayments } from './payments.js';
import { renderChat, renderChatBubble } from './chat.js';
import { renderProfile } from './profile.js';
import { renderClients } from './clients.js';
import { renderWorkload } from './workload.js';
import { renderTimeTracking } from './timetracking.js';
import { renderGantt } from './gantt.js';
import { renderInvoice } from './invoice.js';
import { showToast } from './toast.js';
import { renderNotificationBell } from './notifications.js';
import icons from './icons.js';

// Initialize seed data & migrate
seedData();
migrateTaskData();

// App state
window.appState = {
  currentPage: 'dashboard',
  selectedMonth: new Date().getMonth(),
  searchQuery: '',
  statusFilter: 'all',
  paymentFilter: 'all',
  typeFilter: 'all',
  freelancerFilter: 'all',
  selectedTaskId: null,
  tablePage: 1,
  pageSize: 15,
  selectedTaskIds: [],
  sortColumn: 'slNo',
  sortDirection: 'asc',
  dateFrom: '',
  dateTo: '',
};

// ==========================================
// Router
// ==========================================

async function navigateTo(page, data) {
  window.appState.currentPage = page;
  if (data) Object.assign(window.appState, data);
  closeSidebar();
  await renderApp();
}

window.navigateTo = navigateTo;

// ==========================================
// App Shell
// ==========================================

async function renderAppShell(content) {
  const user = await getCurrentUser();
  const adminUser = await isAdmin();
  const notifBellHTML = await renderNotificationBell();

  const navItems = [
    { id: 'dashboard', icon: icons.dashboard, label: 'Dashboard' },
    { id: 'tasks', icon: icons.tasks, label: 'Tasks' },
    { id: 'kanban', icon: icons.kanban, label: 'Kanban' },
    { id: 'calendar', icon: icons.kanban, label: 'Calendar' },
    { id: 'timeline', icon: icons.analytics, label: 'Timeline' },
    { id: 'analytics', icon: icons.analytics, label: 'Analytics' },
  ];

  navItems.push({ id: 'payments', icon: icons.dollarSign, label: 'Payments' });
  if (adminUser) {
    navItems.push({ id: 'invoices', icon: icons.fileText, label: 'Invoices' });
  }
  if (adminUser) {
    navItems.push({ id: 'users', icon: icons.users, label: 'Users' });
  }
  navItems.push({ id: 'chat', icon: icons.chat, label: 'Chat' });
  navItems.push({ id: 'activity', icon: icons.activity, label: 'Activity Log' });
  navItems.push({ id: 'clients', icon: icons.users, label: 'Clients' });
  if (adminUser) {
    navItems.push({ id: 'workload', icon: icons.analytics, label: 'Workload' });
  }
  navItems.push({ id: 'timetracking', icon: icons.clock, label: 'Time Track' });
  navItems.push({ id: 'profile', icon: icons.users, label: 'My Profile' });

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();

  return `
    <div class="app-shell">
      <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon">CT</div>
          <h2>CRM Tracker</h2>
          ${notifBellHTML}
          <button class="btn-icon" onclick="toggleDarkMode()" title="Toggle dark mode" id="dark-mode-btn" style="margin-left:4px;">
            ${document.documentElement.getAttribute('data-theme') === 'dark' ? icons.sun : icons.moon}
          </button>
        </div>
        <nav class="sidebar-nav">
          ${navItems.map(item => `
            <button class="nav-item ${window.appState.currentPage === item.id ? 'active' : ''}"
                    onclick="navigateTo('${item.id}')" id="nav-${item.id}">
              <span class="nav-icon">${item.icon}</span>
              ${item.label}
            </button>
          `).join('')}
        </nav>
        <div class="sidebar-user">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name" style="cursor:pointer;" onclick="navigateTo('profile')">${user.name}</div>
            <div class="user-role">${user.role === 'superadmin' ? 'Super Admin' : user.role}</div>
          </div>
          <button class="logout-btn" onclick="handleLogout()" title="Logout" id="logout-btn">${icons.logout}</button>
        </div>
      </aside>
      <main class="main-content">
        <button class="hamburger-btn" onclick="toggleSidebar()" id="hamburger-btn">${icons.menu}</button>
        <div class="global-search-bar" id="global-search-bar">
          <div class="global-search-input-wrap">
            ${icons.search}
            <input type="text" class="global-search-input" id="global-search-input" placeholder="Search tasks..." oninput="handleGlobalSearch(this.value)" autocomplete="off" />
            <div class="global-search-results" id="global-search-results" style="display:none;"></div>
          </div>
        </div>
        ${content}
      </main>
    </div>
    <div class="toast-container" id="toast-container"></div>
    ${window.appState.currentPage !== 'chat' ? await renderChatBubble() : ''}
  `;
}

window.handleLogout = async function () {
  await logout();
  await renderApp();
};

window.toggleSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
};

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}
window.closeSidebar = closeSidebar;

window.toggleDarkMode = function () {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('crm_theme', isDark ? 'light' : 'dark');
    window.renderApp();
};

// Apply saved theme on load
(function applyTheme() {
    const saved = localStorage.getItem('crm_theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();

window.handleGlobalSearch = async function (query) {
    const results = document.getElementById('global-search-results');
    if (!results) return;
    if (!query || query.length < 2) {
        results.style.display = 'none';
        return;
    }
    const q = query.toLowerCase();
    const { getTasks, getTasksByFreelancer, isAdmin: checkAdmin, getCurrentUser: getUser } = await import('./store-async.js');
    const admin = await checkAdmin();
    const user = await getUser();
    const tasks = admin ? await getTasks() : await getTasksByFreelancer(user.id);
    const matches = tasks.filter(t =>
        (t.client || '').toLowerCase().includes(q) ||
        (t.type || '').toLowerCase().includes(q) ||
        String(t.slNo).includes(q) ||
        (t.status || '').toLowerCase().includes(q)
    ).slice(0, 8);

    if (matches.length === 0) {
        results.innerHTML = '<div class="search-no-results">No tasks found</div>';
    } else {
        results.innerHTML = matches.map(t => `
            <div class="search-result-item" onclick="navigateTo('task-detail', { selectedTaskId: '${t.id}' })">
                <span class="search-result-id">#${t.slNo}</span>
                <span class="search-result-client">${t.client || '—'}</span>
                <span class="badge badge-${t.status}" style="font-size:0.7rem;padding:2px 6px;">${t.status}</span>
            </div>
        `).join('');
    }
    results.style.display = '';
};

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    const results = document.getElementById('global-search-results');
    const wrap = document.getElementById('global-search-bar');
    if (results && wrap && !wrap.contains(e.target)) {
        results.style.display = 'none';
    }
});

// ==========================================
// Main Render
// ==========================================

async function renderApp() {
  const app = document.getElementById('app');
  try {
    // Clear user cache so we fetch fresh data once per render cycle
    clearUserCache();
    const user = await getCurrentUser();

    if (!user) {
      app.innerHTML = renderLogin();
      return;
    }

    let pageContent = '';
    const page = window.appState.currentPage;

    switch (page) {
      case 'dashboard':
        pageContent = await renderDashboard();
        break;
      case 'tasks':
        pageContent = await renderTable();
        break;
      case 'users':
        if (await isAdmin()) {
          pageContent = await renderUsers();
        } else {
          pageContent = await renderDashboard();
        }
        break;
      case 'analytics':
        pageContent = await renderAnalytics();
        break;
      case 'kanban':
        pageContent = await renderKanban();
        break;
      case 'calendar':
        pageContent = await renderCalendar();
        break;
      case 'timeline':
        pageContent = await renderGantt();
        break;
      case 'payments':
        pageContent = await renderPayments();
        break;
      case 'invoices':
        pageContent = (await isAdmin()) ? await renderInvoice() : await renderDashboard();
        break;
      case 'chat':
        pageContent = await renderChat();
        break;
      case 'activity':
        pageContent = await renderActivityLog();
        break;
      case 'clients':
        pageContent = await renderClients();
        break;
      case 'workload':
        pageContent = (await isAdmin()) ? await renderWorkload() : await renderDashboard();
        break;
      case 'timetracking':
        pageContent = await renderTimeTracking();
        break;
      case 'profile':
        pageContent = await renderProfile();
        break;
      case 'task-detail':
        pageContent = await renderTaskDetail(window.appState.selectedTaskId);
        break;
      default:
        pageContent = await renderDashboard();
    }

    app.innerHTML = await renderAppShell(pageContent);

    // Setup realtime notifications (non-blocking)
    setupRealtimeNotifications().catch(() => {});

    // Initialize Kanban drag-and-drop if on kanban page
    if (page === 'kanban') {
      setTimeout(() => initKanbanDragDrop(), 0);
    }

    // Scroll chat to bottom
    if (page === 'chat') {
      setTimeout(() => {
        const chatMsgs = document.getElementById('chat-messages');
        if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
      }, 50);
    }
  } catch (err) {
    console.error('RenderApp Error:', err);
    app.innerHTML = `<div style="padding:40px;color:#ff6b6b;font-family:monospace;"><h2>Error</h2><pre>${err.message}\n${err.stack}</pre></div>`;
  }
}

window.renderApp = renderApp;

// ==========================================
// Supabase Auth State Listener
// ==========================================

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      clearUserCache();
      renderApp();
    }
  });
}

// ==========================================
// Real-time Notification Subscription
// ==========================================

let notifSubscription = null;

async function setupRealtimeNotifications() {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;

  // Clean up old subscription
  if (notifSubscription) {
    supabase.removeChannel(notifSubscription);
    notifSubscription = null;
  }

  notifSubscription = supabase
    .channel('notifications-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user.id}`,
    }, (payload) => {
      // Show toast for new notification
      const notif = payload.new;
      if (notif) {
        showToast(notif.title || 'New notification', 'info');
        // Re-render to update badge count
        renderApp();
      }
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
    }, (payload) => {
      const msg = payload.new;
      // Only react to team messages or DMs involving current user
      if (msg && msg.recipient_id && msg.recipient_id !== user.id && msg.user_id !== user.id) {
        return;
      }
      // Re-render if on chat page to show new messages
      if (window.appState.currentPage === 'chat') {
        renderApp();
      }
      // Refresh mini chat if open
      const miniPanel = document.getElementById('mini-chat-panel');
      if (miniPanel && miniPanel.classList.contains('open') && window.loadMiniChatMessages) {
        window.loadMiniChatMessages();
      }
    })
    .subscribe();
}

// Initial render
(async () => {
  try {
    // Show loading state
    document.getElementById('app').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;color:var(--text-secondary);font-family:Poppins,sans-serif;"><div style="text-align:center;"><div style="font-size:2rem;margin-bottom:12px;">⏳</div><div>Loading CRM Tracker...</div></div></div>`;
    await renderApp();
  } catch (err) {
    console.error('Init Error:', err);
    document.getElementById('app').innerHTML = `<div style="padding:40px;color:#ff6b6b;font-family:monospace;"><h2>Init Error</h2><pre>${err.message}\n${err.stack}</pre></div>`;
  }
})();
