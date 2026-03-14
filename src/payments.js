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

    return `
    <div class="page-header">
      <h1>${icons.dollarSign} Payments</h1>
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

      <!-- Filters -->
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
      </div>

      <!-- Payments Table -->
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
      </div>
    </div>
  `;
}

window.filterPayments = function (key, value) {
    if (key === 'status') window.appState.paymentPageFilter = value;
    if (key === 'freelancer') window.appState.paymentFreelancerFilter = value;
    if (key === 'month') window.appState.paymentMonthFilter = value;
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

export { renderPayments };
