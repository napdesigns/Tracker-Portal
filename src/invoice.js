// ==========================================
// PDF Invoice Generator
// ==========================================

import { getCurrentUser, isAdmin, getTasks, getTasksByFreelancer, getFreelancers, getUserById, sanitizeHTML } from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

async function renderInvoice() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();

    if (!adminUser) {
        return `<div class="page-header"><h1>Invoices</h1></div><div class="page-body"><p>Only admins can generate invoices.</p></div>`;
    }

    const tasks = await getTasks();
    const freelancers = await getFreelancers();

    const freelancerOptions = freelancers.map(f => {
        const fTasks = tasks.filter(t => t.assignedTo === f.id && t.status === 'approved');
        const unpaid = fTasks.filter(t => t.paymentStatus !== 'Paid');
        const totalUnpaid = unpaid.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        return `<option value="${f.id}">${sanitizeHTML(f.name)} — ₹${totalUnpaid.toLocaleString('en-IN')} (${unpaid.length} tasks)</option>`;
    }).join('');

    return `
    <div class="page-header">
      <h1>${icons.fileText} Invoices</h1>
    </div>
    <div class="page-body">
      <div style="background:var(--bg-card);border-radius:var(--radius-lg);padding:24px;box-shadow:var(--shadow-md);">
        <h3 style="margin-bottom:16px;">Generate Invoice</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end;">
          <div class="form-group" style="flex:1;min-width:200px;">
            <label>Freelancer</label>
            <select class="form-control" id="invoice-freelancer">${freelancerOptions}</select>
          </div>
          <div class="form-group">
            <label>Invoice Date</label>
            <input type="date" class="form-control" id="invoice-date" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div class="form-group">
            <label>Due Date</label>
            <input type="date" class="form-control" id="invoice-due-date" value="${new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0]}" />
          </div>
          <div class="form-group">
            <label>Filter</label>
            <select class="form-control" id="invoice-filter">
              <option value="unpaid">Unpaid Tasks</option>
              <option value="approved">All Approved</option>
              <option value="all">All Tasks</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="generateInvoice()">Preview Invoice</button>
        </div>
      </div>
      <div id="invoice-preview" style="margin-top:20px;"></div>
    </div>
  `;
}

window.generateInvoice = async function() {
    const freelancerId = document.getElementById('invoice-freelancer')?.value;
    const invoiceDate = document.getElementById('invoice-date')?.value;
    const dueDate = document.getElementById('invoice-due-date')?.value;
    const filter = document.getElementById('invoice-filter')?.value;

    if (!freelancerId) { showToast('Select a freelancer', 'error'); return; }

    const { getTasks, getUserById, sanitizeHTML } = await import('./store-async.js');
    const tasks = await getTasks();
    const freelancer = await getUserById(freelancerId);

    let fTasks = tasks.filter(t => t.assignedTo === freelancerId);
    if (filter === 'unpaid') fTasks = fTasks.filter(t => t.status === 'approved' && t.paymentStatus !== 'Paid');
    else if (filter === 'approved') fTasks = fTasks.filter(t => t.status === 'approved');

    if (fTasks.length === 0) { showToast('No tasks found for this filter', 'error'); return; }

    const totalAmount = fTasks.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const invoiceNum = `INV-${Date.now().toString(36).toUpperCase()}`;

    const rows = fTasks.map((t, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${sanitizeHTML(t.client || '—')}</td>
            <td>${sanitizeHTML(t.type || '—')}</td>
            <td>${t.date ? new Date(t.date).toLocaleDateString('en-IN') : '—'}</td>
            <td style="text-align:right;">₹${(parseFloat(t.amount) || 0).toLocaleString('en-IN')}</td>
        </tr>
    `).join('');

    const preview = document.getElementById('invoice-preview');
    preview.innerHTML = `
        <div class="invoice-doc" id="invoice-doc">
            <div class="invoice-header-bar">
                <div>
                    <h2 style="margin:0;color:var(--accent-primary);">INVOICE</h2>
                    <div style="color:var(--text-muted);font-size:0.85rem;">${invoiceNum}</div>
                </div>
                <div style="text-align:right;">
                    <strong>CRM Tracker</strong><br/>
                    <span style="font-size:0.85rem;color:var(--text-secondary);">Creative Agency</span>
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
                <div>
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">Bill To:</div>
                    <strong>${sanitizeHTML(freelancer?.name || '—')}</strong><br/>
                    <span style="font-size:0.85rem;color:var(--text-secondary);">${sanitizeHTML(freelancer?.email || '')}</span>
                </div>
                <div style="text-align:right;">
                    <div><span style="color:var(--text-muted);font-size:0.8rem;">Invoice Date:</span> ${invoiceDate || '—'}</div>
                    <div><span style="color:var(--text-muted);font-size:0.8rem;">Due Date:</span> ${dueDate || '—'}</div>
                </div>
            </div>
            <table class="data-table" style="margin-bottom:20px;">
                <thead>
                    <tr><th>#</th><th>Client</th><th>Type</th><th>Date</th><th style="text-align:right;">Amount</th></tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr style="font-weight:700;font-size:1rem;">
                        <td colspan="4" style="text-align:right;">Total:</td>
                        <td style="text-align:right;">₹${totalAmount.toLocaleString('en-IN')}</td>
                    </tr>
                </tfoot>
            </table>
            <div style="text-align:center;color:var(--text-muted);font-size:0.8rem;margin-top:20px;padding-top:12px;border-top:1px solid var(--border-color);">
                Generated by CRM Tracker Portal
            </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-primary" onclick="printInvoice()">Print / Save as PDF</button>
        </div>
    `;
};

window.printInvoice = function() {
    const invoiceEl = document.getElementById('invoice-doc');
    if (!invoiceEl) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html><head><title>Invoice</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>
            body { font-family: 'Poppins', sans-serif; padding: 40px; color: #333; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 0.9rem; }
            th { background: #f8f8f8; font-weight: 600; }
            tfoot td { border-top: 2px solid #333; }
            h2 { color: #6c5ce7; }
            @media print { body { padding: 20px; } }
        </style>
        </head><body>${invoiceEl.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.onload = function() { printWindow.print(); };
};

export { renderInvoice };
