// ==========================================
// CRM Tracker — Dashboard Page
// ==========================================

import {
    getCurrentUser, isAdmin, getTasks, getTasksByFreelancer,
    getStats, MONTHS,
} from './store-async.js';

async function renderDashboard() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();

    let tasks;
    if (adminUser) {
        tasks = await getTasks();
    } else {
        tasks = await getTasksByFreelancer(user.id);
    }

    const stats = await getStats(tasks);
    const currentMonth = MONTHS[new Date().getMonth()];

    let cardsHTML;
    if (adminUser) {
        cardsHTML = `
      <div class="stat-card purple">
        <div class="stat-icon">📋</div>
        <div class="stat-value">${stats.totalTasks}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-icon">💰</div>
        <div class="stat-value">₹${stats.totalAmount.toLocaleString('en-IN')}</div>
        <div class="stat-label">Total Amount</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${stats.approved}</div>
        <div class="stat-label">Approved</div>
      </div>
      <div class="stat-card amber">
        <div class="stat-icon">⏳</div>
        <div class="stat-value">${stats.pendingPayments}</div>
        <div class="stat-label">Pending Payments</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon">🔄</div>
        <div class="stat-value">${stats.totalIterations}</div>
        <div class="stat-label">Total Iterations</div>
      </div>
    `;
    } else {
        cardsHTML = `
      <div class="stat-card amber">
        <div class="stat-icon">📥</div>
        <div class="stat-value">${stats.assigned}</div>
        <div class="stat-label">Assigned to Me</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-icon">🔨</div>
        <div class="stat-value">${stats.inProgress}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">📤</div>
        <div class="stat-value">${stats.submitted}</div>
        <div class="stat-label">Submitted</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${stats.approved}</div>
        <div class="stat-label">Approved</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon">🔄</div>
        <div class="stat-value">${stats.totalIterations}</div>
        <div class="stat-label">Iterations</div>
      </div>
    `;
    }

    // Recent tasks
    const recentTasks = tasks.slice(-5).reverse();
    let recentHTML = '';
    if (recentTasks.length > 0) {
        recentHTML = `
      <div class="task-detail-section" style="margin-top: 8px;">
        <h3>📌 Recent Tasks</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Client</th>
                <th>Type</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Iterations</th>
              </tr>
            </thead>
            <tbody>
              ${recentTasks.map(t => `
                <tr style="cursor:pointer;" onclick="navigateTo('task-detail', { selectedTaskId: '${t.id}' })">
                  <td>${t.slNo}</td>
                  <td><strong>${t.client || '—'}</strong></td>
                  <td>${t.type}</td>
                  <td><span class="badge badge-${t.status}">${formatStatusLabel(t.status)}</span></td>
                  <td>₹${(parseFloat(t.amount) || 0).toLocaleString('en-IN')}</td>
                  <td>${(t.iterations || []).length}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    }

    return `
    <div class="page-header">
      <h1>Dashboard</h1>
      <span style="color: var(--text-secondary); font-size: 0.85rem;">${currentMonth} ${new Date().getFullYear()}</span>
    </div>
    <div class="page-body">
      <div class="stat-cards">${cardsHTML}</div>
      ${recentHTML}
    </div>
  `;
}

function formatStatusLabel(status) {
    const labels = {
        'assigned': 'Assigned',
        'in_progress': 'In Progress',
        'submitted': 'Submitted',
        'approved': 'Approved',
        'iteration': 'Iteration',
        'rejected': 'Rejected',
    };
    return labels[status] || status;
}

export { renderDashboard };
