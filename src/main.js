// ==========================================
// CRM Tracker — Main Entry Point
// ==========================================

import './index.css';
import {
  seedData, migrateTaskData, getCurrentUser, logout, isAdmin, isSuperAdmin,
  MONTHS, getTasks, getTasksByMonth, getStats,
  getFreelancers, getUserById, clearUserCache,
} from './store-async.js';
import { supabase } from './supabase.js';
import { renderLogin } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { renderTable } from './table.js';
import { renderTaskDetail } from './task-detail.js';
import { renderUsers } from './users.js';
import { showToast } from './toast.js';
import { renderNotificationBell } from './notifications.js';

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
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'tasks', icon: '📋', label: 'Tasks' },
  ];

  if (adminUser) {
    navItems.push({ id: 'users', icon: '👥', label: 'Users' });
  }

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();

  return `
    <div class="app-shell">
      <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon">CT</div>
          <h2>CRM Tracker</h2>
          ${notifBellHTML}
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
            <div class="user-name">${user.name}</div>
            <div class="user-role">${user.role === 'superadmin' ? 'Super Admin' : user.role}</div>
          </div>
          <button class="logout-btn" onclick="handleLogout()" title="Logout" id="logout-btn">🚪</button>
        </div>
      </aside>
      <main class="main-content">
        <button class="hamburger-btn" onclick="toggleSidebar()" id="hamburger-btn">☰</button>
        ${content}
      </main>
    </div>
    <div class="toast-container" id="toast-container"></div>
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
      case 'task-detail':
        pageContent = await renderTaskDetail(window.appState.selectedTaskId);
        break;
      default:
        pageContent = await renderDashboard();
    }

    app.innerHTML = await renderAppShell(pageContent);

    // Setup realtime notifications (non-blocking)
    setupRealtimeNotifications().catch(() => {});
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
