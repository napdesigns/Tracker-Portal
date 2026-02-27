// ==========================================
// CRM Tracker — Tasks Table Page
// ==========================================

import {
    getCurrentUser, isAdmin, getTasks, getTasksByMonth, getTasksByFreelancer,
    getUserById, getFreelancers, deleteTask as deleteTaskFromStore,
    pickUpTask, submitTask, approveTask, rejectTask, requestIteration, resolveIteration,
    addTask, updateTask, uploadCompletedCreative, getTaskById,
    uploadCreativeFile,
    MONTHS, formatDate, sanitizeHTML,
} from './store-async.js';
import { showToast } from './toast.js';
import { validateImageFile } from './validation.js';

// ==========================================
// Filtering Helper
// ==========================================

async function getFilteredTasks() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();
    const month = window.appState.selectedMonth;
    const dateFrom = window.appState.dateFrom || '';
    const dateTo = window.appState.dateTo || '';
    const useDateRange = dateFrom || dateTo;

    let tasks;
    if (useDateRange) {
        // Date range overrides month tab
        if (adminUser) {
            tasks = await getTasks();
        } else {
            tasks = await getTasksByFreelancer(user.id);
        }
        if (dateFrom) {
            tasks = tasks.filter(t => t.date >= dateFrom);
        }
        if (dateTo) {
            tasks = tasks.filter(t => t.date <= dateTo);
        }
    } else {
        if (adminUser) {
            tasks = await getTasksByMonth(month);
        } else {
            tasks = (await getTasksByFreelancer(user.id)).filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === month;
            });
        }
    }

    // Search
    const q = (window.appState.searchQuery || '').toLowerCase();
    if (q) {
        tasks = tasks.filter(t =>
            (t.client || '').toLowerCase().includes(q) ||
            (t.type || '').toLowerCase().includes(q)
        );
    }

    // Status filter
    const sf = window.appState.statusFilter || 'all';
    if (sf !== 'all') {
        tasks = tasks.filter(t => t.status === sf);
    }

    // Payment filter
    const pf = window.appState.paymentFilter || 'all';
    if (pf !== 'all') {
        tasks = tasks.filter(t => (t.paymentStatus || 'Unpaid') === pf);
    }

    // Type filter
    const tf = window.appState.typeFilter || 'all';
    if (tf !== 'all') {
        tasks = tasks.filter(t => t.type === tf);
    }

    // Freelancer filter (admin only)
    const ff = window.appState.freelancerFilter || 'all';
    if (ff !== 'all' && adminUser) {
        tasks = tasks.filter(t => t.assignedTo === ff);
    }

    // Sorting
    const sortCol = window.appState.sortColumn || 'slNo';
    const sortDir = window.appState.sortDirection || 'asc';
    const dir = sortDir === 'asc' ? 1 : -1;

    tasks.sort((a, b) => {
        let valA, valB;
        switch (sortCol) {
            case 'slNo':
                return ((a.slNo || 0) - (b.slNo || 0)) * dir;
            case 'date':
                return (new Date(a.date) - new Date(b.date)) * dir;
            case 'client':
                valA = (a.client || '').toLowerCase();
                valB = (b.client || '').toLowerCase();
                return valA.localeCompare(valB) * dir;
            case 'type':
                return (a.type || '').localeCompare(b.type || '') * dir;
            case 'status':
                return (a.status || '').localeCompare(b.status || '') * dir;
            case 'amount':
                return ((parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0)) * dir;
            case 'payment':
                return (a.paymentStatus || '').localeCompare(b.paymentStatus || '') * dir;
            case 'iterations':
                return (((a.iterations || []).length) - ((b.iterations || []).length)) * dir;
            default:
                return ((a.slNo || 0) - (b.slNo || 0)) * dir;
        }
    });

    return tasks;
}

function sortableHeader(label, column) {
    const active = window.appState.sortColumn === column;
    const dir = window.appState.sortDirection || 'asc';
    const arrow = active ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable-th ${active ? 'sort-active' : ''}" onclick="handleSort('${column}')">${label}${arrow}</th>`;
}

async function renderTable() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();
    const month = window.appState.selectedMonth;
    const sf = window.appState.statusFilter || 'all';
    const pf = window.appState.paymentFilter || 'all';
    const tf = window.appState.typeFilter || 'all';
    const ff = window.appState.freelancerFilter || 'all';

    const allFiltered = await getFilteredTasks();

    // Pagination
    const page = window.appState.tablePage || 1;
    const pageSize = window.appState.pageSize || 15;
    const totalPages = Math.max(1, Math.ceil(allFiltered.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const tasks = allFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Freelancers for filter dropdown
    const freelancers = adminUser ? await getFreelancers() : [];

    // Month tabs
    const monthTabs = MONTHS.map((m, i) => `
    <button class="month-tab ${i === month ? 'active' : ''}"
            onclick="setMonth(${i})" id="month-tab-${i}">${m}</button>
  `).join('');

    // Bulk selection
    const selectedIds = window.appState.selectedTaskIds || [];
    const allOnPageSelected = tasks.length > 0 && tasks.every(t => selectedIds.includes(t.id));

    // Bulk action bar
    let bulkBarHTML = '';
    if (adminUser && selectedIds.length > 0) {
        bulkBarHTML = `
      <div class="bulk-action-bar">
        <span>${selectedIds.length} task${selectedIds.length > 1 ? 's' : ''} selected</span>
        <button class="btn btn-sm btn-primary" onclick="handleBulkApprove()">Approve Selected</button>
        <button class="btn btn-sm btn-danger" onclick="handleBulkDelete()">Delete Selected</button>
        <button class="btn btn-sm btn-secondary" onclick="handleBulkClear()">Clear</button>
      </div>
    `;
    }

    // Table rows
    let tableBody;
    if (tasks.length === 0) {
        tableBody = `
      <tr>
        <td colspan="${adminUser ? '14' : '13'}">
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div class="empty-title">No tasks found</div>
            <div class="empty-text">
              ${adminUser ? 'Click "Add Task" to create a new task.' : 'No tasks assigned for this month.'}
            </div>
          </div>
        </td>
      </tr>
    `;
    } else {
        // Build freelancer map from already-fetched list (avoid N+1 queries)
        const freelancerMap = {};
        for (const f of freelancers) {
            freelancerMap[f.id] = f;
        }
        // For non-admin users, add themselves to the map
        if (!adminUser && user) {
            freelancerMap[user.id] = user;
        }

        tableBody = tasks.map(t => {
            const freelancer = t.assignedTo ? freelancerMap[t.assignedTo] : null;
            const freelancerName = freelancer ? sanitizeHTML(freelancer.name) : '—';
            const iterCount = (t.iterations || []).length;

            // Creative column — show completedCreative (priority) or referenceCreative fallback
            const displayCreative = t.completedCreative || t.referenceCreative;
            const isCompleted = !!t.completedCreative;
            let creativeCol;
            if (displayCreative) {
                creativeCol = `
          <div class="creative-cell">
            <img class="creative-thumb" src="${displayCreative}" alt="Creative" onclick="event.stopPropagation(); openLightbox('${displayCreative.replace(/'/g, "\\'")}')" />
            ${isCompleted ? '<span class="completed-badge">Done</span>' : ''}
          </div>`;
            } else {
                creativeCol = `<div class="creative-placeholder">🖼</div>`;
            }

            // Checkbox for bulk ops (admin only)
            const checkboxCol = adminUser
                ? `<td onclick="event.stopPropagation();"><input type="checkbox" ${selectedIds.includes(t.id) ? 'checked' : ''} onchange="toggleTaskSelection('${t.id}')" /></td>`
                : '';

            // Actions based on role
            let actionsHTML = '';
            if (adminUser) {
                actionsHTML = `
          <button class="btn-icon" onclick="event.stopPropagation(); openEditTaskModal('${t.id}')" title="Edit">✏️</button>
          <button class="btn-icon" onclick="event.stopPropagation(); handleDeleteTask('${t.id}')" title="Delete">🗑️</button>
          ${t.status === 'submitted' ? `
            <button class="btn-icon" onclick="event.stopPropagation(); handleApproveTask('${t.id}')" title="Approve" style="color: var(--status-approved);">✅</button>
            <button class="btn-icon" onclick="event.stopPropagation(); openRejectModal('${t.id}')" title="Reject" style="color: var(--status-rejected);">❌</button>
            <button class="btn-icon" onclick="event.stopPropagation(); openIterationModal('${t.id}')" title="Request Iteration" style="color: var(--status-iteration);">🔄</button>
          ` : ''}
        `;
            } else {
                if (t.status === 'assigned' || t.status === 'iteration') {
                    actionsHTML = `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); handlePickUp('${t.id}')">Pick Up</button>`;
                } else if (t.status === 'in_progress') {
                    actionsHTML = `
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openUploadCreativeModal('${t.id}')">Upload</button>
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openSubmitModal('${t.id}')">Submit</button>
          `;
                }
            }

            return `
        <tr onclick="navigateTo('task-detail', { selectedTaskId: '${t.id}' })" style="cursor:pointer;">
          ${checkboxCol}
          <td>${t.slNo}</td>
          <td>${formatDate(t.date)}</td>
          <td><strong>${sanitizeHTML(t.client) || '—'}</strong></td>
          <td>${sanitizeHTML(t.type)}</td>
          <td>${creativeCol}</td>
          <td>${sanitizeHTML(t.editableFileShared)}</td>
          <td><span class="badge badge-${t.status}">${formatStatusLabel(t.status)}</span></td>
          <td><span class="badge badge-${creativeStatusBadgeClass(t.creativeStatus)}">${sanitizeHTML(t.creativeStatus || 'Pending')}</span></td>
          <td>₹${(parseFloat(t.amount) || 0).toLocaleString('en-IN')}</td>
          <td><span class="badge badge-${(t.paymentStatus || 'unpaid').toLowerCase()}">${sanitizeHTML(t.paymentStatus) || 'Unpaid'}</span></td>
          <td>${adminUser ? freelancerName : ''}</td>
          <td>${iterCount > 0 ? `<span class="badge badge-iteration">${iterCount}</span>` : '0'}</td>
          <td class="row-actions" onclick="event.stopPropagation();">${actionsHTML}</td>
        </tr>
      `;
        }).join('');
    }

    // Pagination controls
    let paginationHTML = '';
    if (totalPages > 1) {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`);
        }
        paginationHTML = `
      <div class="pagination-controls">
        <button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>‹</button>
        ${pages.join('')}
        <button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>›</button>
        <span class="page-info">${allFiltered.length} tasks</span>
      </div>
    `;
    }

    return `
    <div class="page-header">
      <h1>Tasks</h1>
      <div style="display: flex; gap: 8px;">
        ${adminUser ? `<button class="btn btn-secondary btn-sm" onclick="exportCSV()">📥 Export CSV</button>` : ''}
        ${adminUser ? `<button class="btn btn-primary" onclick="openAddTaskModal()" id="add-task-btn">➕ Add Task</button>` : ''}
      </div>
    </div>
    <div class="page-body">
      <div class="month-tabs">${monthTabs}</div>
      ${bulkBarHTML}
      <div class="table-container">
        <div class="table-toolbar">
          <div class="toolbar-left">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Search by client..."
                     value="${window.appState.searchQuery || ''}"
                     oninput="handleSearch(this.value)" id="search-input" />
            </div>
            <select class="filter-select" onchange="handleStatusFilter(this.value)" id="status-filter">
              <option value="all" ${sf === 'all' ? 'selected' : ''}>All Status</option>
              <option value="assigned" ${sf === 'assigned' ? 'selected' : ''}>Assigned</option>
              <option value="in_progress" ${sf === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="submitted" ${sf === 'submitted' ? 'selected' : ''}>Submitted</option>
              <option value="approved" ${sf === 'approved' ? 'selected' : ''}>Approved</option>
              <option value="iteration" ${sf === 'iteration' ? 'selected' : ''}>Iteration</option>
              <option value="rejected" ${sf === 'rejected' ? 'selected' : ''}>Rejected</option>
            </select>
            <select class="filter-select" onchange="handlePaymentFilter(this.value)" id="payment-filter">
              <option value="all" ${pf === 'all' ? 'selected' : ''}>All Payments</option>
              <option value="Unpaid" ${pf === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
              <option value="Pending" ${pf === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Paid" ${pf === 'Paid' ? 'selected' : ''}>Paid</option>
            </select>
            <select class="filter-select" onchange="handleTypeFilter(this.value)" id="type-filter">
              <option value="all" ${tf === 'all' ? 'selected' : ''}>All Types</option>
              <option value="Static" ${tf === 'Static' ? 'selected' : ''}>Static</option>
              <option value="Animated" ${tf === 'Animated' ? 'selected' : ''}>Animated</option>
              <option value="Video" ${tf === 'Video' ? 'selected' : ''}>Video</option>
              <option value="Carousel" ${tf === 'Carousel' ? 'selected' : ''}>Carousel</option>
              <option value="Reels" ${tf === 'Reels' ? 'selected' : ''}>Reels</option>
              <option value="Logo" ${tf === 'Logo' ? 'selected' : ''}>Logo</option>
              <option value="Branding" ${tf === 'Branding' ? 'selected' : ''}>Branding</option>
              <option value="Other" ${tf === 'Other' ? 'selected' : ''}>Other</option>
            </select>
            ${adminUser ? `
              <select class="filter-select" onchange="handleFreelancerFilter(this.value)" id="freelancer-filter">
                <option value="all" ${ff === 'all' ? 'selected' : ''}>All Freelancers</option>
                ${freelancers.map(f => `<option value="${f.id}" ${ff === f.id ? 'selected' : ''}>${sanitizeHTML(f.name)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
          <div class="date-range-filter">
            <label style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">From:</label>
            <input type="date" class="form-control" style="padding: 6px 10px; font-size: 0.82rem; width: auto;" value="${window.appState.dateFrom || ''}" onchange="handleDateFrom(this.value)" id="date-from" />
            <label style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">To:</label>
            <input type="date" class="form-control" style="padding: 6px 10px; font-size: 0.82rem; width: auto;" value="${window.appState.dateTo || ''}" onchange="handleDateTo(this.value)" id="date-to" />
            ${(window.appState.dateFrom || window.appState.dateTo) ? `<button class="btn btn-sm btn-secondary" onclick="clearDateRange()" style="padding: 4px 10px; font-size: 0.78rem;">Clear</button>` : ''}
          </div>
        </div>
        <div style="overflow-x: auto;">
          <table class="data-table">
            <thead>
              <tr>
                ${adminUser ? `<th><input type="checkbox" ${allOnPageSelected && tasks.length > 0 ? 'checked' : ''} onchange="toggleAllSelection(this.checked)" /></th>` : ''}
                ${sortableHeader('#', 'slNo')}
                ${sortableHeader('Date', 'date')}
                ${sortableHeader('Client', 'client')}
                ${sortableHeader('Type', 'type')}
                <th>Creative</th>
                <th>Editable File</th>
                ${sortableHeader('Status', 'status')}
                <th>Creative Status</th>
                ${sortableHeader('Amount', 'amount')}
                ${sortableHeader('Payment', 'payment')}
                ${adminUser ? '<th>Assigned To</th>' : '<th></th>'}
                ${sortableHeader('Iters', 'iterations')}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${tableBody}</tbody>
          </table>
        </div>
        ${paginationHTML}
      </div>
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

function creativeStatusBadgeClass(creativeStatus) {
    const map = {
        'Pending': 'assigned',
        'Approved': 'approved',
        'Iteration': 'iteration',
        'Rejected': 'rejected',
    };
    return map[creativeStatus] || 'assigned';
}

// ==========================================
// Global Handlers
// ==========================================

window.setMonth = async function (m) {
    window.appState.selectedMonth = m;
    window.appState.tablePage = 1;
    await window.renderApp();
};

window.handleSearch = async function (val) {
    window.appState.searchQuery = val;
    window.appState.tablePage = 1;
    await window.renderApp();
    setTimeout(() => {
        const input = document.getElementById('search-input');
        if (input) { input.focus(); input.setSelectionRange(val.length, val.length); }
    }, 0);
};

window.handleStatusFilter = async function (val) {
    window.appState.statusFilter = val;
    window.appState.tablePage = 1;
    await window.renderApp();
};

window.handlePaymentFilter = async function (val) {
    window.appState.paymentFilter = val;
    window.appState.tablePage = 1;
    await window.renderApp();
};

window.handleTypeFilter = async function (val) {
    window.appState.typeFilter = val;
    window.appState.tablePage = 1;
    await window.renderApp();
};

window.handleFreelancerFilter = async function (val) {
    window.appState.freelancerFilter = val;
    window.appState.tablePage = 1;
    await window.renderApp();
};

window.handleDateFrom = async function (val) {
    window.appState.dateFrom = val;
    window.appState.tablePage = 1;
    await window.renderApp();
};

window.handleDateTo = async function (val) {
    window.appState.dateTo = val;
    window.appState.tablePage = 1;
    await window.renderApp();
};

window.clearDateRange = async function () {
    window.appState.dateFrom = '';
    window.appState.dateTo = '';
    window.appState.tablePage = 1;
    await window.renderApp();
};

window.handleSort = async function (column) {
    if (window.appState.sortColumn === column) {
        window.appState.sortDirection = window.appState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        window.appState.sortColumn = column;
        window.appState.sortDirection = 'asc';
    }
    window.appState.tablePage = 1;
    await window.renderApp();
};

window.goToPage = async function (p) {
    const allFiltered = await getFilteredTasks();
    const totalPages = Math.max(1, Math.ceil(allFiltered.length / (window.appState.pageSize || 15)));
    if (p < 1 || p > totalPages) return;
    window.appState.tablePage = p;
    await window.renderApp();
};

window.handleDeleteTask = function (id) {
    showConfirmDialog('Delete this task?', 'This action cannot be undone.', async () => {
        await deleteTaskFromStore(id);
        window.appState.selectedTaskIds = (window.appState.selectedTaskIds || []).filter(sid => sid !== id);
        showToast('Task deleted', 'success');
        await window.renderApp();
    });
};

window.handleApproveTask = async function (id) {
    await approveTask(id);
    showToast('Task approved!', 'success');
    await window.renderApp();
};

window.handlePickUp = async function (id) {
    await resolveIteration(id);
    await pickUpTask(id);
    showToast('Task picked up! Get started.', 'success');
    await window.renderApp();
};

// ==========================================
// Bulk Operations
// ==========================================

window.toggleTaskSelection = async function (id) {
    const sel = window.appState.selectedTaskIds || [];
    const idx = sel.indexOf(id);
    if (idx > -1) {
        sel.splice(idx, 1);
    } else {
        sel.push(id);
    }
    window.appState.selectedTaskIds = [...sel];
    await window.renderApp();
};

window.toggleAllSelection = async function (checked) {
    const tasks = await getFilteredTasks();
    const page = window.appState.tablePage || 1;
    const pageSize = window.appState.pageSize || 15;
    const pageTasks = tasks.slice((page - 1) * pageSize, page * pageSize);
    if (checked) {
        const existing = new Set(window.appState.selectedTaskIds || []);
        pageTasks.forEach(t => existing.add(t.id));
        window.appState.selectedTaskIds = [...existing];
    } else {
        const pageIds = new Set(pageTasks.map(t => t.id));
        window.appState.selectedTaskIds = (window.appState.selectedTaskIds || []).filter(id => !pageIds.has(id));
    }
    await window.renderApp();
};

window.handleBulkApprove = async function () {
    const ids = window.appState.selectedTaskIds || [];
    let count = 0;
    for (const id of ids) {
        const task = await getTaskById(id);
        if (task && task.status === 'submitted') {
            await approveTask(id);
            count++;
        }
    }
    window.appState.selectedTaskIds = [];
    showToast(`${count} task${count !== 1 ? 's' : ''} approved`, 'success');
    await window.renderApp();
};

window.handleBulkDelete = function () {
    const ids = window.appState.selectedTaskIds || [];
    showConfirmDialog(`Delete ${ids.length} task${ids.length > 1 ? 's' : ''}?`, 'This action cannot be undone.', async () => {
        for (const id of ids) {
            await deleteTaskFromStore(id);
        }
        window.appState.selectedTaskIds = [];
        showToast(`${ids.length} task${ids.length !== 1 ? 's' : ''} deleted`, 'success');
        await window.renderApp();
    });
};

window.handleBulkClear = async function () {
    window.appState.selectedTaskIds = [];
    await window.renderApp();
};

// ==========================================
// CSV Export
// ==========================================

window.exportCSV = async function () {
    const tasks = await getFilteredTasks();
    const headers = ['Sl No', 'Date', 'Client', 'Type', 'Status', 'Amount', 'Payment', 'Assigned To', 'Iterations'];
    const freelancerCache = {};
    for (const t of tasks) {
        if (t.assignedTo && !freelancerCache[t.assignedTo]) {
            freelancerCache[t.assignedTo] = await getUserById(t.assignedTo);
        }
    }
    const rows = tasks.map(t => {
        const freelancer = t.assignedTo ? freelancerCache[t.assignedTo] : null;
        return [
            t.slNo,
            t.date,
            `"${(t.client || '').replace(/"/g, '""')}"`,
            t.type,
            formatStatusLabel(t.status),
            t.amount || 0,
            t.paymentStatus || 'Unpaid',
            freelancer ? `"${freelancer.name.replace(/"/g, '""')}"` : '',
            (t.iterations || []).length,
        ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks_export_${MONTHS[window.appState.selectedMonth]}_${new Date().getFullYear()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported!', 'success');
};

// ==========================================
// Lightbox
// ==========================================

window.openLightbox = function (src) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `<img src="${src}" alt="Creative Preview" />`;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
};

// ==========================================
// Confirm Dialog
// ==========================================

function showConfirmDialog(title, text, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal confirm-dialog">
      <div class="modal-body">
        <div class="confirm-icon">⚠️</div>
        <h3 style="margin-bottom: 8px;">${sanitizeHTML(title)}</h3>
        <p class="confirm-text">${sanitizeHTML(text)}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="confirm-cancel-btn">Cancel</button>
        <button class="btn btn-danger" id="confirm-ok-btn">Delete</button>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirm-cancel-btn').onclick = () => overlay.remove();
    overlay.querySelector('#confirm-ok-btn').onclick = () => { overlay.remove(); onConfirm(); };
}

// ==========================================
// Add / Edit Task Modal
// ==========================================

window.openAddTaskModal = async function () {
    await showTaskModal(null);
};

window.openEditTaskModal = async function (id) {
    const tasks = await getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) await showTaskModal(task);
};

async function showTaskModal(task) {
    const isEdit = !!task;
    const freelancers = await getFreelancers();
    const user = await getCurrentUser();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${isEdit ? 'Edit Task' : 'Add New Task'}</h2>
        <button class="btn-icon" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">
        <form id="task-form">
          <div class="form-row">
            <div class="form-group">
              <label>Date</label>
              <input type="date" class="form-control" id="task-date" value="${task ? task.date : new Date().toISOString().split('T')[0]}" required />
            </div>
            <div class="form-group">
              <label>Client</label>
              <input type="text" class="form-control" id="task-client" value="${task ? sanitizeHTML(task.client) : ''}" placeholder="Client name" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Type</label>
              <select class="form-control" id="task-type">
                <option value="Static" ${task && task.type === 'Static' ? 'selected' : ''}>Static</option>
                <option value="Animated" ${task && task.type === 'Animated' ? 'selected' : ''}>Animated</option>
                <option value="Video" ${task && task.type === 'Video' ? 'selected' : ''}>Video</option>
                <option value="Carousel" ${task && task.type === 'Carousel' ? 'selected' : ''}>Carousel</option>
                <option value="Reels" ${task && task.type === 'Reels' ? 'selected' : ''}>Reels</option>
                <option value="Logo" ${task && task.type === 'Logo' ? 'selected' : ''}>Logo</option>
                <option value="Branding" ${task && task.type === 'Branding' ? 'selected' : ''}>Branding</option>
                <option value="Other" ${task && task.type === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Assign To</label>
              <select class="form-control" id="task-assigned">
                <option value="">Select Freelancer</option>
                ${freelancers.map(f => `
                  <option value="${f.id}" ${task && task.assignedTo === f.id ? 'selected' : ''}>${sanitizeHTML(f.name)}</option>
                `).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Amount (₹)</label>
              <input type="number" class="form-control" id="task-amount" value="${task ? task.amount : ''}" placeholder="0" min="0" />
            </div>
            <div class="form-group">
              <label>Payment Status</label>
              <select class="form-control" id="task-payment">
                <option value="Unpaid" ${task && task.paymentStatus === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                <option value="Pending" ${task && task.paymentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Paid" ${task && task.paymentStatus === 'Paid' ? 'selected' : ''}>Paid</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Editable File Shared</label>
            <select class="form-control" id="task-editable">
              <option value="No" ${task && task.editableFileShared === 'No' ? 'selected' : ''}>No</option>
              <option value="Yes" ${task && task.editableFileShared === 'Yes' ? 'selected' : ''}>Yes</option>
            </select>
          </div>
          <div class="form-group">
            <label>Reference Creative</label>
            <div class="upload-zone" id="upload-zone">
              <div class="upload-icon">📁</div>
              <div class="upload-text">Drag & drop or click to upload</div>
              <input type="file" id="creative-input" accept="image/*" style="display:none;" />
            </div>
            <div id="upload-preview-container">
              ${task && task.referenceCreative ? `
                <div class="upload-preview">
                  <img src="${task.referenceCreative}" alt="Preview" />
                  <button class="remove-btn" type="button" onclick="removeCreativePreview()">✕</button>
                </div>
              ` : ''}
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="task-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="task-save-btn">${isEdit ? 'Update' : 'Create'} Task</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    let creativeData = task ? task.referenceCreative : null;

    // Close
    const closeModal = () => overlay.remove();
    overlay.querySelector('#modal-close-btn').onclick = closeModal;
    overlay.querySelector('#task-cancel-btn').onclick = closeModal;

    // Upload zone
    const uploadZone = overlay.querySelector('#upload-zone');
    const fileInput = overlay.querySelector('#creative-input');
    const previewContainer = overlay.querySelector('#upload-preview-container');

    uploadZone.onclick = () => fileInput.click();
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleFile(fileInput.files[0]);
    });

    function handleFile(file) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
            showToast(validation.error, 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            creativeData = e.target.result;
            previewContainer.innerHTML = `
        <div class="upload-preview">
          <img src="${creativeData}" alt="Preview" />
          <button class="remove-btn" type="button" id="remove-preview-btn">✕</button>
        </div>
      `;
            previewContainer.querySelector('#remove-preview-btn').onclick = () => {
                creativeData = null;
                previewContainer.innerHTML = '';
            };
        };
        reader.readAsDataURL(file);
    }

    window.removeCreativePreview = () => {
        creativeData = null;
        previewContainer.innerHTML = '';
    };

    // Save
    overlay.querySelector('#task-save-btn').onclick = async () => {
        const date = overlay.querySelector('#task-date').value;
        const client = overlay.querySelector('#task-client').value;
        const type = overlay.querySelector('#task-type').value;
        const assignedTo = overlay.querySelector('#task-assigned').value;
        const amount = overlay.querySelector('#task-amount').value;
        const paymentStatus = overlay.querySelector('#task-payment').value;
        const editableFileShared = overlay.querySelector('#task-editable').value;

        if (!client) {
            showToast('Please enter a client name', 'error');
            return;
        }

        if (isEdit) {
            await updateTask(task.id, {
                date, client, type, assignedTo: assignedTo || null,
                amount: parseFloat(amount) || 0, paymentStatus, editableFileShared,
                referenceCreative: creativeData, month: new Date(date).getMonth(),
            });
            showToast('Task updated!', 'success');
        } else {
            await addTask({
                date, client, type, assignedTo: assignedTo || null,
                amount: parseFloat(amount) || 0, paymentStatus, editableFileShared,
                referenceCreative: creativeData, assignedBy: user.id,
            });
            showToast('Task created!', 'success');
        }

        closeModal();
        await window.renderApp();
    };
}

// ==========================================
// Upload Creative Modal (Freelancer)
// ==========================================

window.openUploadCreativeModal = async function (taskId) {
    const task = await getTaskById(taskId);
    if (!task) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Upload Creative</h2>
        <button class="btn-icon" id="uc-close-btn">✕</button>
      </div>
      <div class="modal-body">
        ${task.referenceCreative ? `
          <div class="form-group">
            <label>Reference Creative (from admin)</label>
            <div class="upload-preview" style="margin-top:0;">
              <img src="${task.referenceCreative}" alt="Reference" style="max-width:200px; cursor:pointer;" onclick="openLightbox('${task.referenceCreative.replace(/'/g, "\\'")}')" />
            </div>
          </div>
        ` : ''}
        <div class="form-group">
          <label>Your Completed Creative</label>
          ${task.completedCreative ? `
            <div id="uc-existing-preview">
              <div class="upload-preview">
                <img src="${task.completedCreative}" alt="Current upload" />
                <button class="remove-btn" type="button" id="uc-remove-existing">✕</button>
              </div>
            </div>
          ` : ''}
          <div class="upload-zone" id="uc-upload-zone">
            <div class="upload-icon">📁</div>
            <div class="upload-text">${task.completedCreative ? 'Replace creative — drag & drop or click' : 'Drag & drop or click to upload'}</div>
            <input type="file" id="uc-file-input" accept="image/*" style="display:none;" />
          </div>
          <div id="uc-preview-container"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="uc-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="uc-save-btn">Save Creative</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);
    let newCreative = null;

    const closeModal = () => overlay.remove();
    overlay.querySelector('#uc-close-btn').onclick = closeModal;
    overlay.querySelector('#uc-cancel-btn').onclick = closeModal;

    // Remove existing
    const removeExistingBtn = overlay.querySelector('#uc-remove-existing');
    if (removeExistingBtn) {
        removeExistingBtn.onclick = () => {
            overlay.querySelector('#uc-existing-preview').innerHTML = '';
            newCreative = '__remove__';
        };
    }

    // Upload zone
    const zone = overlay.querySelector('#uc-upload-zone');
    const fInput = overlay.querySelector('#uc-file-input');
    const prevContainer = overlay.querySelector('#uc-preview-container');
    zone.onclick = () => fInput.click();
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault(); zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleUCFile(e.dataTransfer.files[0]);
    });
    fInput.addEventListener('change', () => {
        if (fInput.files.length) handleUCFile(fInput.files[0]);
    });

    function handleUCFile(file) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
            showToast(validation.error, 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            newCreative = e.target.result;
            prevContainer.innerHTML = `<div class="upload-preview"><img src="${newCreative}" alt="Preview" /></div>`;
            // Hide existing preview
            const existingPrev = overlay.querySelector('#uc-existing-preview');
            if (existingPrev) existingPrev.innerHTML = '';
        };
        reader.readAsDataURL(file);
    }

    // Save
    overlay.querySelector('#uc-save-btn').onclick = async () => {
        if (newCreative === '__remove__') {
            await uploadCompletedCreative(taskId, null);
            showToast('Creative removed', 'info');
        } else if (newCreative) {
            await uploadCompletedCreative(taskId, newCreative);
            showToast('Creative uploaded!', 'success');
        } else {
            showToast('No changes made', 'info');
        }
        closeModal();
        await window.renderApp();
    };
};

// ==========================================
// Submit Work Modal (Freelancer)
// ==========================================

window.openSubmitModal = async function (taskId) {
    const task = await getTaskById(taskId);
    if (!task) return;

    const hasCreative = !!task.completedCreative;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Submit Work</h2>
        <button class="btn-icon" id="submit-close-btn">✕</button>
      </div>
      <div class="modal-body">
        ${hasCreative ? `
          <div class="form-group">
            <label>Your Completed Creative</label>
            <div class="upload-preview" style="margin-top:0;">
              <img src="${task.completedCreative}" alt="Completed Creative" style="max-width:240px;" />
            </div>
          </div>
          <p style="color: var(--status-approved); font-size: 0.85rem; margin-bottom: 12px;">Creative uploaded — ready to submit.</p>
        ` : `
          <div class="form-group">
            <label>Upload Creative (required before submission)</label>
            <div class="upload-zone" id="submit-upload-zone">
              <div class="upload-icon">📁</div>
              <div class="upload-text">Drag & drop or click to upload</div>
              <input type="file" id="submit-file-input" accept="image/*" style="display:none;" />
            </div>
            <div id="submit-preview-container"></div>
          </div>
        `}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="submit-cancel-btn">Cancel</button>
        <button class="btn btn-primary ${hasCreative ? '' : 'btn-disabled'}" id="submit-confirm-btn" ${hasCreative ? '' : 'disabled'}>Submit Work</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.querySelector('#submit-close-btn').onclick = closeModal;
    overlay.querySelector('#submit-cancel-btn').onclick = closeModal;

    // If no creative yet, provide inline upload
    if (!hasCreative) {
        const zone = overlay.querySelector('#submit-upload-zone');
        const fInput = overlay.querySelector('#submit-file-input');
        const prevContainer = overlay.querySelector('#submit-preview-container');
        const submitBtn = overlay.querySelector('#submit-confirm-btn');
        zone.onclick = () => fInput.click();
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault(); zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleSubmitFile(e.dataTransfer.files[0]);
        });
        fInput.addEventListener('change', () => {
            if (fInput.files.length) handleSubmitFile(fInput.files[0]);
        });

        function handleSubmitFile(file) {
            const validation = validateImageFile(file);
            if (!validation.valid) {
                showToast(validation.error, 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = async (e) => {
                const creativeData = e.target.result;
                await uploadCompletedCreative(taskId, creativeData);
                prevContainer.innerHTML = `<div class="upload-preview"><img src="${creativeData}" alt="Preview" /></div>`;
                submitBtn.disabled = false;
                submitBtn.classList.remove('btn-disabled');
            };
            reader.readAsDataURL(file);
        }
    }

    // Submit
    overlay.querySelector('#submit-confirm-btn').onclick = async () => {
        try {
            await submitTask(taskId);
            showToast('Work submitted successfully!', 'success');
            closeModal();
            await window.renderApp();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };
};

// ==========================================
// Request Iteration Modal (Admin)
// ==========================================

window.openIterationModal = function (taskId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Request Iteration</h2>
        <button class="btn-icon" id="iter-close-btn">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Reason for iteration</label>
          <textarea class="form-control" id="iter-reason" rows="3" placeholder="Explain why this needs revision..." required></textarea>
        </div>
        <div class="form-group">
          <label>Iteration caused by</label>
          <div style="display: flex; gap: 10px; margin-top: 6px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-input); font-size: 0.85rem;">
              <input type="radio" name="blame" value="freelancer" checked /> Freelancer
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-input); font-size: 0.85rem;">
              <input type="radio" name="blame" value="admin" /> Admin
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-input); font-size: 0.85rem;">
              <input type="radio" name="blame" value="client" /> Client
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="iter-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="iter-submit-btn">Request Iteration</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.querySelector('#iter-close-btn').onclick = closeModal;
    overlay.querySelector('#iter-cancel-btn').onclick = closeModal;

    overlay.querySelector('#iter-submit-btn').onclick = async () => {
        const reason = overlay.querySelector('#iter-reason').value;
        const blame = overlay.querySelector('input[name="blame"]:checked').value;
        if (!reason.trim()) {
            showToast('Please enter a reason', 'error');
            return;
        }
        await requestIteration(taskId, reason, blame);
        showToast('Iteration requested', 'info');
        closeModal();
        await window.renderApp();
    };
};

// ==========================================
// Reject Task Modal (Admin)
// ==========================================

window.openRejectModal = function (taskId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Reject Task</h2>
        <button class="btn-icon" id="reject-close-btn">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Reason for rejection (optional)</label>
          <textarea class="form-control" id="reject-reason" rows="3" placeholder="Explain why this task is being rejected..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="reject-cancel-btn">Cancel</button>
        <button class="btn btn-danger" id="reject-confirm-btn">Reject Task</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.querySelector('#reject-close-btn').onclick = closeModal;
    overlay.querySelector('#reject-cancel-btn').onclick = closeModal;

    overlay.querySelector('#reject-confirm-btn').onclick = async () => {
        const reason = overlay.querySelector('#reject-reason').value;
        await rejectTask(taskId, reason);
        showToast('Task rejected', 'info');
        closeModal();
        await window.renderApp();
    };
};

export { renderTable };
