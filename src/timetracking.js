// ==========================================
// CRM Tracker — Time Tracking
// ==========================================

import { getCurrentUser, isAdmin, getTasks, getTasksByFreelancer, sanitizeHTML } from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

function getTimeEntries() {
    return JSON.parse(localStorage.getItem('crm_time_entries') || '[]');
}

function saveTimeEntries(entries) {
    localStorage.setItem('crm_time_entries', JSON.stringify(entries));
}

// Active timer state
let timerInterval = null;
let timerStart = null;
let timerTaskId = null;

async function renderTimeTracking() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();
    const tasks = adminUser ? await getTasks() : await getTasksByFreelancer(user.id);
    const entries = getTimeEntries().filter(e => adminUser || e.userId === user.id);

    // Active tasks for timer
    const activeTasks = tasks.filter(t => ['assigned', 'in_progress', 'iteration'].includes(t.status));

    const isTimerRunning = timerInterval !== null;
    const timerTaskName = timerTaskId ? (tasks.find(t => t.id === timerTaskId)?.client || '—') : '';

    // Summary
    const totalHours = entries.reduce((s, e) => s + (e.hours || 0), 0);
    const todayStr = new Date().toISOString().split('T')[0];
    const todayHours = entries.filter(e => (e.date || '').startsWith(todayStr)).reduce((s, e) => s + (e.hours || 0), 0);

    const recentEntries = entries.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

    let tableRows = '';
    if (recentEntries.length === 0) {
        tableRows = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">${icons.clock}</div><div class="empty-title">No time entries yet</div></div></td></tr>`;
    } else {
        tableRows = recentEntries.map(e => {
            const task = tasks.find(t => t.id === e.taskId);
            return `
                <tr>
                    <td>${sanitizeHTML(task?.client || e.taskName || '—')}</td>
                    <td>${e.hours.toFixed(2)}h</td>
                    <td>${sanitizeHTML(e.description || '—')}</td>
                    <td>${new Date(e.date).toLocaleDateString('en-IN')}</td>
                    <td><button class="btn btn-secondary btn-sm" onclick="deleteTimeEntry('${e.id}')" style="font-size:0.7rem;">✕</button></td>
                </tr>
            `;
        }).join('');
    }

    return `
    <div class="page-header">
      <h1>${icons.clock} Time Tracking</h1>
    </div>
    <div class="page-body">
      <div class="stat-cards" style="margin-bottom:20px;">
        <div class="stat-card teal" style="padding:16px;">
          <div class="stat-value" style="font-size:1.3rem;">${todayHours.toFixed(1)}h</div>
          <div class="stat-label">Today</div>
        </div>
        <div class="stat-card purple" style="padding:16px;">
          <div class="stat-value" style="font-size:1.3rem;">${totalHours.toFixed(1)}h</div>
          <div class="stat-label">All Time</div>
        </div>
      </div>

      <div class="timer-section" style="background:var(--bg-card);border-radius:var(--radius-lg);padding:20px;margin-bottom:20px;box-shadow:var(--shadow-sm);">
        <h3 style="margin-bottom:12px;">Timer</h3>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <select class="form-control" id="timer-task" style="max-width:250px;" ${isTimerRunning ? 'disabled' : ''}>
            <option value="">Select a task...</option>
            ${activeTasks.map(t => `<option value="${t.id}" ${t.id === timerTaskId ? 'selected' : ''}>${sanitizeHTML(t.client || '—')} (#${t.slNo})</option>`).join('')}
          </select>
          <div id="timer-display" style="font-size:1.4rem;font-weight:600;font-variant-numeric:tabular-nums;min-width:80px;">${isTimerRunning ? getTimerDisplay() : '00:00:00'}</div>
          ${isTimerRunning
            ? `<button class="btn btn-primary" onclick="stopTimer()" style="background:#d63031;">Stop</button>`
            : `<button class="btn btn-primary" onclick="startTimer()">Start</button>`
          }
        </div>
        ${isTimerRunning ? `<div style="margin-top:8px;color:var(--text-secondary);font-size:0.85rem;">Tracking: ${sanitizeHTML(timerTaskName)}</div>` : ''}
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <h3>Manual Entry</h3>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
        <select class="form-control" id="manual-task" style="max-width:200px;">
          ${tasks.map(t => `<option value="${t.id}">${sanitizeHTML(t.client || '—')} (#${t.slNo})</option>`).join('')}
        </select>
        <input type="number" class="form-control" id="manual-hours" placeholder="Hours" step="0.25" min="0.25" style="max-width:100px;" />
        <input type="text" class="form-control" id="manual-desc" placeholder="Description" style="max-width:200px;" />
        <button class="btn btn-primary" onclick="addManualTimeEntry()">Add</button>
      </div>

      <h3 style="margin-bottom:10px;">Recent Entries</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr><th>Task</th><th>Hours</th><th>Description</th><th>Date</th><th></th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function getTimerDisplay() {
    if (!timerStart) return '00:00:00';
    const elapsed = Math.floor((Date.now() - timerStart) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

window.startTimer = function() {
    const taskId = document.getElementById('timer-task')?.value;
    if (!taskId) { showToast('Select a task first', 'error'); return; }
    timerTaskId = taskId;
    timerStart = Date.now();
    timerInterval = setInterval(() => {
        const display = document.getElementById('timer-display');
        if (display) display.textContent = getTimerDisplay();
    }, 1000);
    window.renderApp();
};

window.stopTimer = async function() {
    if (!timerStart || !timerTaskId) return;
    const elapsed = (Date.now() - timerStart) / 1000 / 3600; // hours
    const entries = getTimeEntries();
    const { getCurrentUser: getUser } = await import('./store-async.js');
    const user = await getUser();
    entries.push({
        id: crypto.randomUUID(),
        taskId: timerTaskId,
        userId: user.id,
        userName: user.name,
        hours: Math.round(elapsed * 100) / 100,
        description: 'Timer entry',
        date: new Date().toISOString(),
    });
    saveTimeEntries(entries);
    clearInterval(timerInterval);
    timerInterval = null;
    timerStart = null;
    timerTaskId = null;
    showToast(`Logged ${elapsed.toFixed(2)} hours`, 'success');
    window.renderApp();
};

window.addManualTimeEntry = async function() {
    const taskId = document.getElementById('manual-task')?.value;
    const hours = parseFloat(document.getElementById('manual-hours')?.value);
    const desc = document.getElementById('manual-desc')?.value?.trim() || '';
    if (!taskId || !hours || hours <= 0) { showToast('Select task and enter hours', 'error'); return; }
    const { getCurrentUser: getUser } = await import('./store-async.js');
    const user = await getUser();
    const entries = getTimeEntries();
    entries.push({
        id: crypto.randomUUID(),
        taskId,
        userId: user.id,
        userName: user.name,
        hours,
        description: desc,
        date: new Date().toISOString(),
    });
    saveTimeEntries(entries);
    showToast('Time entry added', 'success');
    window.renderApp();
};

window.deleteTimeEntry = function(id) {
    let entries = getTimeEntries();
    entries = entries.filter(e => e.id !== id);
    saveTimeEntries(entries);
    showToast('Entry deleted', 'success');
    window.renderApp();
};

export { renderTimeTracking };
