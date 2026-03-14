// ==========================================
// CRM Tracker — Payments Page
// ==========================================

import {
    getCurrentUser, isAdmin, getTasks, getFreelancers, updateTask,
    formatDate, sanitizeHTML, MONTHS,
} from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

async function renderPayments() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();
    const allTasks = await getTasks();
    const freelancers = adminUser ? await getFreelancers() : [];

    // Filter state
    const pf = window.appState.paymentPageFilter || 'all';
    const ff = window.appState.paymentFreelancerFilter || 'all';
    const mf = window.appState.paymentMonthFilter ?? 'all';
    const viewMode = window.appState.paymentViewMode || 'table'; // 'table' or 'summary'

    let tasks = allTasks;
    if (pf !== 'all') tasks = tasks.filter(t => (t.paymentStatus || 'Unpaid') === pf);
    if (ff !== 'all') tasks = tasks.filter(t => t.assignedTo === ff);
    if (mf !== 'all') tasks = tasks.filter(t => new Date(t.date).getMonth() === parseInt(mf));

    // Stats
    const totalAmount = tasks.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const paidAmount = tasks.filter(t => t.paymentStatus === 'Paid').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const pendingAmount = tasks.filter(t => t.paymentStatus === 'Pending').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const unpaidAmount = tasks.filter(t => !t.paymentStatus || t.paymentStatus === 'Unpaid').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    // Freelancer map
    const fMap = {};
    freelancers.forEach(f => { fMap[f.id] = f.name; });

    const freelancerOptions = freelancers.map(f =>
        `<option value="${f.id}" ${ff === f.id ? 'selected' : ''}>${sanitizeHTML(f.name)}</option>`
    ).join('');

    const monthOptions = MONTHS.map((m, i) =>
        `<option value="${i}" ${mf === String(i) ? 'selected' : ''}>${m}</option>`
    ).join('');

    // ---- Freelancer Payout Summary ----
    let summaryHTML = '';
    if (adminUser && viewMode === 'summary') {
        const freelancerSummary = freelancers.map(f => {
            const fTasks = tasks.filter(t => t.assignedTo === f.id);
            const total = fTasks.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
            const paid = fTasks.filter(t => t.paymentStatus === 'Paid').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
            const pending = fTasks.filter(t => t.paymentStatus === 'Pending').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
            const unpaid = fTasks.filter(t => !t.paymentStatus || t.paymentStatus === 'Unpaid').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
            const taskCount = fTasks.length;
            return { id: f.id, name: f.name, total, paid, pending, unpaid, taskCount };
        }).filter(f => f.taskCount > 0).sort((a, b) => b.total - a.total);

        summaryHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Freelancer</th>
                <th>Tasks</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Pending</th>
                <th>Unpaid</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${freelancerSummary.length === 0
                ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No data</td></tr>`
                : freelancerSummary.map(f => `
                <tr>
                  <td><strong>${sanitizeHTML(f.name)}</strong></td>
                  <td>${f.taskCount}</td>
                  <td>₹${f.total.toLocaleString('en-IN')}</td>
                  <td style="color:var(--status-approved);">₹${f.paid.toLocaleString('en-IN')}</td>
                  <td style="color:var(--payment-pending);">₹${f.pending.toLocaleString('en-IN')}</td>
                  <td style="color:var(--status-rejected);">₹${f.unpaid.toLocaleString('en-IN')}</td>
                  <td class="row-actions">
                    <button class="btn btn-sm btn-outline" onclick="bulkPayFreelancer('${f.id}')" title="Mark all as Paid">
                      ${icons.checkCircle} Pay All
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    }

    // ---- Task Table ----
    const rowsHTML = tasks.length === 0
        ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No tasks found</td></tr>`
        : tasks.map(t => {
            const fname = t.assignedTo ? (fMap[t.assignedTo] || 'Unknown') : '—';
            const status = t.paymentStatus || 'Unpaid';
            return `
            <tr>
              <td>#${t.slNo}</td>
              <td>${sanitizeHTML(t.client)}</td>
              <td>${sanitizeHTML(t.type)}</td>
              <td>${fname}</td>
              <td>₹${(parseFloat(t.amount) || 0).toLocaleString('en-IN')}</td>
              <td><span class="badge badge-${status.toLowerCase()}">${status}</span></td>
              <td class="row-actions">
                ${adminUser ? `
                  <select class="form-control" style="font-size:0.75rem;padding:4px 8px;width:auto;" onchange="updatePaymentStatus('${t.id}', this.value)">
                    <option value="Unpaid" ${status === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                    <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Paid" ${status === 'Paid' ? 'selected' : ''}>Paid</option>
                  </select>
                ` : ''}
              </td>
            </tr>`;
        }).join('');

    const tableHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>SL</th>
            <th>Client</th>
            <th>Type</th>
            <th>Freelancer</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
    </div>`;

    return `
    <div class="page-header">
      <h1>${icons.dollarSign} Payments</h1>
      <div style="display:flex;gap:8px;">
        ${adminUser ? `<button class="btn btn-sm btn-outline" onclick="exportPaymentsCSV()">
          ${icons.download} Export CSV
        </button>` : ''}
      </div>
    </div>
    <div class="page-body">
      <!-- Payment Stats -->
      <div class="stat-cards">
        <div class="stat-card purple">
          <div class="stat-icon">${icons.dollarSign}</div>
          <div class="stat-value">₹${totalAmount.toLocaleString('en-IN')}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">${icons.checkCircle}</div>
          <div class="stat-value">₹${paidAmount.toLocaleString('en-IN')}</div>
          <div class="stat-label">Paid</div>
        </div>
        <div class="stat-card teal">
          <div class="stat-icon">${icons.clock}</div>
          <div class="stat-value">₹${pendingAmount.toLocaleString('en-IN')}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon">${icons.alertTriangle}</div>
          <div class="stat-value">₹${unpaidAmount.toLocaleString('en-IN')}</div>
          <div class="stat-label">Unpaid</div>
        </div>
      </div>

      <!-- Filters + View Toggle -->
      <div class="toolbar" style="margin-bottom: 16px;">
        <div class="toolbar-filters">
          <select class="form-control" style="font-size:0.8rem;padding:6px 10px;" onchange="filterPayments('status', this.value)">
            <option value="all" ${pf === 'all' ? 'selected' : ''}>All Status</option>
            <option value="Unpaid" ${pf === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
            <option value="Pending" ${pf === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Paid" ${pf === 'Paid' ? 'selected' : ''}>Paid</option>
          </select>
          ${adminUser ? `
          <select class="form-control" style="font-size:0.8rem;padding:6px 10px;" onchange="filterPayments('freelancer', this.value)">
            <option value="all" ${ff === 'all' ? 'selected' : ''}>All Freelancers</option>
            ${freelancerOptions}
          </select>
          ` : ''}
          <select class="form-control" style="font-size:0.8rem;padding:6px 10px;" onchange="filterPayments('month', this.value)">
            <option value="all" ${mf === 'all' ? 'selected' : ''}>All Months</option>
            ${monthOptions}
          </select>
        </div>
        ${adminUser ? `
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}" onclick="switchPaymentView('table')">
            ${icons.table} Tasks
          </button>
          <button class="btn btn-sm ${viewMode === 'summary' ? 'btn-primary' : 'btn-outline'}" onclick="switchPaymentView('summary')">
            ${icons.users} Summary
          </button>
        </div>
        ` : ''}
      </div>

      ${viewMode === 'summary' && adminUser ? summaryHTML : tableHTML}
    </div>
  `;
}

window.filterPayments = function (key, value) {
    if (key === 'status') window.appState.paymentPageFilter = value;
    if (key === 'freelancer') window.appState.paymentFreelancerFilter = value;
    if (key === 'month') window.appState.paymentMonthFilter = value;
    window.renderApp();
};

window.switchPaymentView = function (mode) {
    window.appState.paymentViewMode = mode;
    window.renderApp();
};

window.updatePaymentStatus = async function (taskId, status) {
    try {
        await updateTask(taskId, { paymentStatus: status });
        showToast(`Payment status updated to ${status}`, 'success');
        await window.renderApp();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// Bulk mark all tasks for a freelancer as Paid
window.bulkPayFreelancer = async function (freelancerId) {
    try {
        const allTasks = await getTasks();
        const unpaidTasks = allTasks.filter(t =>
            t.assignedTo === freelancerId &&
            (t.paymentStatus !== 'Paid')
        );

        if (unpaidTasks.length === 0) {
            showToast('All tasks already paid', 'info');
            return;
        }

        for (const t of unpaidTasks) {
            await updateTask(t.id, { paymentStatus: 'Paid' });
        }

        showToast(`Marked ${unpaidTasks.length} task(s) as Paid`, 'success');
        await window.renderApp();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// Export filtered payments as CSV
window.exportPaymentsCSV = async function () {
    try {
        const allTasks = await getTasks();
        const freelancers = await getFreelancers();
        const fMap = {};
        freelancers.forEach(f => { fMap[f.id] = f.name; });

        // Apply current filters
        const pf = window.appState.paymentPageFilter || 'all';
        const ff = window.appState.paymentFreelancerFilter || 'all';
        const mf = window.appState.paymentMonthFilter ?? 'all';

        let tasks = allTasks;
        if (pf !== 'all') tasks = tasks.filter(t => (t.paymentStatus || 'Unpaid') === pf);
        if (ff !== 'all') tasks = tasks.filter(t => t.assignedTo === ff);
        if (mf !== 'all') tasks = tasks.filter(t => new Date(t.date).getMonth() === parseInt(mf));

        const headers = ['SL No', 'Date', 'Client', 'Type', 'Freelancer', 'Amount', 'Payment Status'];
        const rows = tasks.map(t => [
            t.slNo,
            t.date,
            `"${(t.client || '').replace(/"/g, '""')}"`,
            t.type,
            `"${(fMap[t.assignedTo] || 'Unknown').replace(/"/g, '""')}"`,
            parseFloat(t.amount) || 0,
            t.paymentStatus || 'Unpaid',
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('CSV exported successfully', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
};

export { renderPayments };
