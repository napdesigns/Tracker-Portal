// ==========================================
// CRM Tracker — Activity Log Page
// ==========================================

import { getActivityLog, isAdmin, formatDateTime, sanitizeHTML } from './store-async.js';
import icons from './icons.js';

const ACTION_ICONS = {
    task_created: icons.clipboard,
    task_picked_up: icons.hammer,
    task_submitted: icons.send,
    task_approved: icons.checkCircle,
    task_rejected: icons.x,
    task_deleted: icons.trash,
    iteration_requested: icons.refreshCw,
};

const ACTION_LABELS = {
    task_created: 'Task Created',
    task_picked_up: 'Task Picked Up',
    task_submitted: 'Task Submitted',
    task_approved: 'Task Approved',
    task_rejected: 'Task Rejected',
    task_deleted: 'Task Deleted',
    iteration_requested: 'Iteration Requested',
};

async function renderActivityLog() {
    const adminUser = await isAdmin();
    const log = await getActivityLog(200);

    let tableRows = '';
    if (log.length === 0) {
        tableRows = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <div class="empty-icon">${icons.activity}</div>
            <div class="empty-title">No activity yet</div>
            <div class="empty-text">Actions like creating tasks, approving, and rejecting will appear here.</div>
          </div>
        </td>
      </tr>
    `;
    } else {
        tableRows = log.map(entry => {
            const icon = ACTION_ICONS[entry.action] || '📌';
            const label = ACTION_LABELS[entry.action] || entry.action;
            const badgeClass = entry.action.includes('approved') ? 'approved'
                : entry.action.includes('rejected') ? 'rejected'
                : entry.action.includes('iteration') ? 'iteration'
                : entry.action.includes('submitted') ? 'submitted'
                : entry.action.includes('picked') ? 'in_progress'
                : entry.action.includes('deleted') ? 'rejected'
                : 'assigned';

            return `
        <tr>
          <td style="font-size: 1.1rem; text-align: center; width: 40px;">${icon}</td>
          <td><span class="badge badge-${badgeClass}">${label}</span></td>
          <td><strong>${sanitizeHTML(entry.userName || 'System')}</strong></td>
          <td style="color: var(--text-secondary); font-size: 0.82rem;">${sanitizeHTML(entry.details)}</td>
          <td style="white-space: nowrap; color: var(--text-muted); font-size: 0.8rem;">${formatDateTime(entry.createdAt)}</td>
        </tr>
      `;
        }).join('');
    }

    return `
    <div class="page-header">
      <h1>Activity Log</h1>
    </div>
    <div class="page-body">
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;"></th>
              <th>Action</th>
              <th>User</th>
              <th>Details</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

export { renderActivityLog };
