// ==========================================
// CRM Tracker — Payments Page + Razorpay
// ==========================================

import {
    getCurrentUser, isAdmin, getTasks, getFreelancers, updateTask,
    createPaymentTransaction, getPaymentTransactions,
    formatDate, sanitizeHTML, MONTHS,
} from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

// Razorpay config — update these with your actual keys
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_XXXXXXXXXX';
const COMPANY_NAME = 'CRM Tracker';

async function renderPayments() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();
    const allTasks = await getTasks();
    const freelancers = adminUser ? await getFreelancers() : [];

    // Filter state
    const pf = window.appState.paymentPageFilter || 'all';
    const ff = window.appState.paymentFreelancerFilter || 'all';
    const mf = window.appState.paymentMonthFilter ?? 'all';
    const viewMode = window.appState.paymentViewMode || 'table';

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
            const unpaidCount = fTasks.filter(t => t.paymentStatus !== 'Paid').length;
            const taskCount = fTasks.length;
            return { id: f.id, name: f.name, total, paid, pending, unpaid, unpaidCount, taskCount };
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
                  <td class="row-actions" style="display:flex;gap:4px;flex-wrap:wrap;">
                    ${f.unpaid > 0 ? `
                    <button class="btn btn-sm btn-primary" onclick="payFreelancerRazorpay('${f.id}')" title="Pay via Razorpay">
                      ${icons.dollarSign} Pay ₹${(f.unpaid + f.pending).toLocaleString('en-IN')}
                    </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline" onclick="bulkPayFreelancer('${f.id}')" title="Mark all as Paid">
                      ${icons.checkCircle} Mark Paid
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    }

    // ---- Transaction History ----
    let transactionsHTML = '';
    if (viewMode === 'transactions') {
        const transactions = await getPaymentTransactions(null, 50);
        transactionsHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Freelancer</th>
                <th>Amount</th>
                <th>Payment ID</th>
                <th>Status</th>
                <th>Tasks</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.length === 0
                ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No transactions yet</td></tr>`
                : transactions.map(txn => {
                    const statusClass = txn.status === 'success' ? 'approved'
                        : txn.status === 'failed' ? 'rejected' : 'assigned';
                    const taskCount = Array.isArray(txn.taskIds) ? txn.taskIds.length : 0;
                    return `
                    <tr>
                      <td>${formatDate(txn.createdAt)}</td>
                      <td><strong>${sanitizeHTML(txn.freelancerName)}</strong></td>
                      <td>₹${(parseFloat(txn.amount) || 0).toLocaleString('en-IN')}</td>
                      <td style="font-size:0.75rem;font-family:monospace;">${txn.razorpayPaymentId || '—'}</td>
                      <td><span class="badge badge-${statusClass}">${txn.status}</span></td>
                      <td>${taskCount} task${taskCount !== 1 ? 's' : ''}</td>
                      <td style="font-size:0.8rem;color:var(--text-muted);">${sanitizeHTML(txn.notes || '')}</td>
                    </tr>`;
                }).join('')}
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

    // Choose which content to show
    let mainContent = tableHTML;
    if (viewMode === 'summary' && adminUser) mainContent = summaryHTML;
    if (viewMode === 'transactions') mainContent = transactionsHTML;

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
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          <button class="btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}" onclick="switchPaymentView('table')">
            ${icons.table} Tasks
          </button>
          ${adminUser ? `
          <button class="btn btn-sm ${viewMode === 'summary' ? 'btn-primary' : 'btn-outline'}" onclick="switchPaymentView('summary')">
            ${icons.users} Payouts
          </button>
          <button class="btn btn-sm ${viewMode === 'transactions' ? 'btn-primary' : 'btn-outline'}" onclick="switchPaymentView('transactions')">
            ${icons.fileText} Transactions
          </button>
          ` : ''}
        </div>
      </div>

      ${mainContent}
    </div>
  `;
}

// ==========================================
// Handlers
// ==========================================

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

// Bulk mark all tasks for a freelancer as Paid (without Razorpay)
window.bulkPayFreelancer = async function (freelancerId) {
    try {
        const allTasks = await getTasks();
        const unpaidTasks = allTasks.filter(t =>
            t.assignedTo === freelancerId && t.paymentStatus !== 'Paid'
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

// ==========================================
// Razorpay Payment
// ==========================================

window.payFreelancerRazorpay = async function (freelancerId) {
    try {
        const allTasks = await getTasks();
        const freelancers = await getFreelancers();
        const freelancer = freelancers.find(f => f.id === freelancerId);
        if (!freelancer) {
            showToast('Freelancer not found', 'error');
            return;
        }

        const unpaidTasks = allTasks.filter(t =>
            t.assignedTo === freelancerId && t.paymentStatus !== 'Paid'
        );

        if (unpaidTasks.length === 0) {
            showToast('No pending payments', 'info');
            return;
        }

        const totalAmount = unpaidTasks.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

        if (totalAmount <= 0) {
            showToast('Payment amount must be greater than 0', 'error');
            return;
        }

        const user = await getCurrentUser();

        // Razorpay expects amount in paise (1 INR = 100 paise)
        const amountInPaise = Math.round(totalAmount * 100);

        const options = {
            key: RAZORPAY_KEY_ID,
            amount: amountInPaise,
            currency: 'INR',
            name: COMPANY_NAME,
            description: `Payment to ${freelancer.name} — ${unpaidTasks.length} task(s)`,
            prefill: {
                name: user.name,
                email: user.email || '',
            },
            theme: {
                color: '#6c5ce7',
            },
            handler: async function (response) {
                // Payment successful
                try {
                    // Mark all tasks as Paid
                    for (const t of unpaidTasks) {
                        await updateTask(t.id, { paymentStatus: 'Paid' });
                    }

                    // Record transaction
                    await createPaymentTransaction({
                        freelancerId: freelancerId,
                        freelancerName: freelancer.name,
                        paidBy: user.id,
                        paidByName: user.name,
                        amount: totalAmount,
                        currency: 'INR',
                        razorpayPaymentId: response.razorpay_payment_id || '',
                        razorpayOrderId: response.razorpay_order_id || '',
                        status: 'success',
                        taskIds: unpaidTasks.map(t => t.id),
                        notes: `Paid ${unpaidTasks.length} task(s) via Razorpay`,
                    });

                    showToast(`Payment of ₹${totalAmount.toLocaleString('en-IN')} to ${freelancer.name} successful!`, 'success');
                    await window.renderApp();
                } catch (err) {
                    showToast('Payment recorded but failed to update tasks: ' + err.message, 'error');
                }
            },
            modal: {
                ondismiss: function () {
                    showToast('Payment cancelled', 'info');
                },
            },
        };

        if (typeof window.Razorpay === 'undefined') {
            showToast('Razorpay SDK not loaded. Check your internet connection.', 'error');
            return;
        }

        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', async function (response) {
            try {
                await createPaymentTransaction({
                    freelancerId: freelancerId,
                    freelancerName: freelancer.name,
                    paidBy: user.id,
                    paidByName: user.name,
                    amount: totalAmount,
                    currency: 'INR',
                    razorpayPaymentId: response.error.metadata?.payment_id || '',
                    status: 'failed',
                    taskIds: unpaidTasks.map(t => t.id),
                    notes: `Failed: ${response.error.description || response.error.reason || 'Unknown error'}`,
                });
            } catch (e) {
                console.error('Failed to log failed transaction:', e);
            }
            showToast(`Payment failed: ${response.error.description || 'Unknown error'}`, 'error');
        });

        rzp.open();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// ==========================================
// CSV Export
// ==========================================

window.exportPaymentsCSV = async function () {
    try {
        const allTasks = await getTasks();
        const freelancers = await getFreelancers();
        const fMap = {};
        freelancers.forEach(f => { fMap[f.id] = f.name; });

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
