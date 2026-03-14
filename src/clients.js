// ==========================================
// CRM Tracker — Client Database
// ==========================================

import { getCurrentUser, isAdmin, getTasks, getTasksByFreelancer, sanitizeHTML } from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

function getClients() {
    return JSON.parse(localStorage.getItem('crm_clients') || '[]');
}

function saveClients(clients) {
    localStorage.setItem('crm_clients', JSON.stringify(clients));
}

async function renderClients() {
    const adminUser = await isAdmin();
    const user = await getCurrentUser();
    const tasks = adminUser ? await getTasks() : await getTasksByFreelancer(user.id);
    const clients = getClients();

    // Auto-discover clients from tasks
    const taskClients = [...new Set(tasks.map(t => t.client).filter(Boolean))];

    // Merge discovered clients with saved clients
    const allClients = [...clients];
    for (const name of taskClients) {
        if (!allClients.find(c => c.name.toLowerCase() === name.toLowerCase())) {
            allClients.push({ id: crypto.randomUUID(), name, email: '', phone: '', company: '', notes: '', createdAt: new Date().toISOString() });
        }
    }

    // Calculate stats per client
    const clientRows = allClients.map(c => {
        const clientTasks = tasks.filter(t => (t.client || '').toLowerCase() === c.name.toLowerCase());
        const totalAmount = clientTasks.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const completedTasks = clientTasks.filter(t => t.status === 'approved').length;
        return { ...c, taskCount: clientTasks.length, totalAmount, completedTasks };
    }).sort((a, b) => b.taskCount - a.taskCount);

    let tableRows = '';
    if (clientRows.length === 0) {
        tableRows = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">${icons.users}</div><div class="empty-title">No clients yet</div><div class="empty-text">Clients will appear here from your tasks.</div></div></td></tr>`;
    } else {
        tableRows = clientRows.map(c => `
            <tr>
                <td><strong>${sanitizeHTML(c.name)}</strong></td>
                <td>${sanitizeHTML(c.email || '—')}</td>
                <td>${sanitizeHTML(c.phone || '—')}</td>
                <td>${sanitizeHTML(c.company || '—')}</td>
                <td>${c.taskCount}</td>
                <td>₹${c.totalAmount.toLocaleString('en-IN')}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editClient('${c.id}')">Edit</button>
                </td>
            </tr>
        `).join('');
    }

    return `
    <div class="page-header">
      <h1>${icons.users} Clients</h1>
      ${adminUser ? `<button class="btn btn-primary" onclick="showAddClientModal()">+ Add Client</button>` : ''}
    </div>
    <div class="page-body">
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Company</th>
              <th>Tasks</th>
              <th>Total Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

window.showAddClientModal = function(clientId) {
    const clients = getClients();
    const client = clientId ? clients.find(c => c.id === clientId) : null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'client-modal-overlay';
    overlay.innerHTML = `
        <div class="modal" style="max-width:480px;">
            <div class="modal-header">
                <h3>${client ? 'Edit Client' : 'Add Client'}</h3>
                <button class="modal-close" onclick="document.getElementById('client-modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group"><label>Name *</label><input class="form-control" id="client-name" value="${client ? sanitizeHTML(client.name) : ''}" /></div>
                <div class="form-group"><label>Email</label><input class="form-control" id="client-email" value="${client ? sanitizeHTML(client.email || '') : ''}" /></div>
                <div class="form-group"><label>Phone</label><input class="form-control" id="client-phone" value="${client ? sanitizeHTML(client.phone || '') : ''}" /></div>
                <div class="form-group"><label>Company</label><input class="form-control" id="client-company" value="${client ? sanitizeHTML(client.company || '') : ''}" /></div>
                <div class="form-group"><label>Notes</label><textarea class="form-control" id="client-notes" rows="3">${client ? sanitizeHTML(client.notes || '') : ''}</textarea></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('client-modal-overlay').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="saveClient('${clientId || ''}')">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.editClient = function(id) { window.showAddClientModal(id); };

window.saveClient = function(existingId) {
    const name = document.getElementById('client-name').value.trim();
    if (!name) { showToast('Client name is required', 'error'); return; }

    const clients = getClients();
    const data = {
        name,
        email: document.getElementById('client-email').value.trim(),
        phone: document.getElementById('client-phone').value.trim(),
        company: document.getElementById('client-company').value.trim(),
        notes: document.getElementById('client-notes').value.trim(),
    };

    if (existingId) {
        const idx = clients.findIndex(c => c.id === existingId);
        if (idx >= 0) clients[idx] = { ...clients[idx], ...data };
    } else {
        clients.push({ id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() });
    }

    saveClients(clients);
    document.getElementById('client-modal-overlay').remove();
    showToast('Client saved!', 'success');
    window.renderApp();
};

export { renderClients };
