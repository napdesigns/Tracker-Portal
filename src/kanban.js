// ==========================================
// CRM Tracker — Kanban Board View
// ==========================================

import {
    getCurrentUser, isAdmin, getTasks, getTasksByFreelancer,
    getFreelancers, getUserById,
    pickUpTask, submitTask, approveTask, updateTask,
    resolveIteration,
    formatDate, sanitizeHTML,
} from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

const KANBAN_COLUMNS = [
    { id: 'assigned', label: 'Assigned', color: 'var(--status-assigned)' },
    { id: 'in_progress', label: 'In Progress', color: 'var(--status-in-progress)' },
    { id: 'submitted', label: 'Submitted', color: 'var(--status-submitted)' },
    { id: 'approved', label: 'Approved', color: 'var(--status-approved)' },
    { id: 'iteration', label: 'Iteration', color: 'var(--status-iteration)' },
    { id: 'rejected', label: 'Rejected', color: 'var(--status-rejected)' },
];

async function renderKanban() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();

    let tasks;
    if (adminUser) {
        tasks = await getTasks();
    } else {
        tasks = await getTasksByFreelancer(user.id);
    }

    // Build freelancer map
    const freelancers = adminUser ? await getFreelancers() : [];
    const freelancerMap = {};
    for (const f of freelancers) {
        freelancerMap[f.id] = f;
    }
    if (!adminUser && user) {
        freelancerMap[user.id] = user;
    }

    // Group tasks by status
    const tasksByStatus = {};
    for (const col of KANBAN_COLUMNS) {
        tasksByStatus[col.id] = tasks.filter(t => t.status === col.id);
    }

    const columnsHTML = KANBAN_COLUMNS.map(col => {
        const colTasks = tasksByStatus[col.id] || [];
        const cardsHTML = colTasks.length === 0
            ? `<div class="kanban-empty">No tasks</div>`
            : colTasks.map(t => {
                const freelancer = t.assignedTo ? freelancerMap[t.assignedTo] : null;
                const isOverdue = t.dueDate && t.dueDate < new Date().toISOString().split('T')[0] && !['approved', 'rejected'].includes(t.status);
                return `
            <div class="kanban-card ${isOverdue ? 'overdue' : ''}"
                 draggable="true"
                 data-task-id="${t.id}"
                 data-status="${t.status}"
                 onclick="navigateTo('task-detail', { selectedTaskId: '${t.id}' })">
              <div class="kanban-card-header">
                <span class="kanban-card-id">#${t.slNo}</span>
                ${isOverdue ? '<span class="kanban-overdue-badge">Overdue</span>' : ''}
              </div>
              <div class="kanban-card-client">${sanitizeHTML(t.client) || '—'}</div>
              <div class="kanban-card-meta">
                <span class="badge badge-${(t.type || 'static').toLowerCase() === 'static' ? 'assigned' : 'in_progress'}" style="font-size: 0.68rem; padding: 2px 8px;">${sanitizeHTML(t.type)}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">₹${(parseFloat(t.amount) || 0).toLocaleString('en-IN')}</span>
              </div>
              ${t.dueDate ? `<div class="kanban-card-due ${isOverdue ? 'overdue-text' : ''}">Due: ${formatDate(t.dueDate)}</div>` : ''}
              <div class="kanban-card-footer">
                ${freelancer ? `<span class="kanban-card-avatar" title="${sanitizeHTML(freelancer.name)}">${freelancer.name.charAt(0).toUpperCase()}</span>` : ''}
                ${(t.iterations || []).length > 0 ? `<span class="kanban-iter-count">🔄 ${(t.iterations || []).length}</span>` : ''}
              </div>
            </div>
          `;
            }).join('');

        return `
      <div class="kanban-column" data-status="${col.id}">
        <div class="kanban-column-header" style="border-bottom-color: ${col.color};">
          <span class="kanban-column-dot" style="background: ${col.color};"></span>
          <span class="kanban-column-title">${col.label}</span>
          <span class="kanban-column-count">${colTasks.length}</span>
        </div>
        <div class="kanban-column-body" data-status="${col.id}">
          ${cardsHTML}
        </div>
      </div>
    `;
    }).join('');

    return `
    <div class="page-header">
      <h1>Kanban Board</h1>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary btn-sm" onclick="navigateTo('tasks')">${icons.table} Table View</button>
      </div>
    </div>
    <div class="page-body">
      <div class="kanban-board">${columnsHTML}</div>
    </div>
  `;
}

// ==========================================
// Drag & Drop Handlers
// ==========================================

function initKanbanDragDrop() {
    const cards = document.querySelectorAll('.kanban-card[draggable="true"]');
    const columns = document.querySelectorAll('.kanban-column-body');

    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.taskId);
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            columns.forEach(col => col.classList.remove('drag-over'));
        });
    });

    columns.forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            col.classList.add('drag-over');
        });
        col.addEventListener('dragleave', () => {
            col.classList.remove('drag-over');
        });
        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.status;
            const card = document.querySelector(`.kanban-card[data-task-id="${taskId}"]`);
            const oldStatus = card ? card.dataset.status : null;

            if (!taskId || newStatus === oldStatus) return;

            try {
                // Handle status transitions
                if (newStatus === 'in_progress' && (oldStatus === 'assigned' || oldStatus === 'iteration')) {
                    await resolveIteration(taskId);
                    await pickUpTask(taskId);
                } else if (newStatus === 'approved' && oldStatus === 'submitted') {
                    await approveTask(taskId);
                } else {
                    // Generic status update
                    await updateTask(taskId, { status: newStatus });
                }
                showToast(`Task moved to ${newStatus.replace('_', ' ')}`, 'success');
                await window.renderApp();
            } catch (err) {
                showToast(err.message || 'Failed to move task', 'error');
            }
        });
    });
}

// Make init available globally for post-render setup
window.initKanbanDragDrop = initKanbanDragDrop;

export { renderKanban, initKanbanDragDrop };
