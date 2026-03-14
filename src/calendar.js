// ==========================================
// CRM Tracker — Calendar View
// ==========================================

import { getCurrentUser, isAdmin, getTasks, getTasksByFreelancer, formatDate, sanitizeHTML } from './store-async.js';
import icons from './icons.js';

async function renderCalendar() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();
    const tasks = adminUser ? await getTasks() : await getTasksByFreelancer(user.id);

    // Use appState or default to current month/year
    const now = new Date();
    const viewMonth = window.calendarMonth !== undefined ? window.calendarMonth : now.getMonth();
    const viewYear = window.calendarYear !== undefined ? window.calendarYear : now.getFullYear();

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date().toISOString().split('T')[0];

    // Build calendar grid cells
    let cells = '';
    // Empty cells for days before first day
    for (let i = 0; i < firstDay; i++) {
        cells += '<div class="cal-cell cal-empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === today;
        const dayTasks = tasks.filter(t => {
            const tDate = (t.dueDate || t.date || '').split('T')[0];
            return tDate === dateStr;
        });

        const taskDots = dayTasks.slice(0, 3).map(t =>
            `<div class="cal-task" onclick="event.stopPropagation(); navigateTo('task-detail', { selectedTaskId: '${t.id}' })" title="${sanitizeHTML(t.client || '')}">
                <span class="cal-task-dot badge-${t.status}"></span>
                <span class="cal-task-label">${sanitizeHTML(t.client || '\u2014')}</span>
            </div>`
        ).join('');
        const moreCount = dayTasks.length > 3 ? `<div class="cal-more">+${dayTasks.length - 3} more</div>` : '';

        cells += `
            <div class="cal-cell ${isToday ? 'cal-today' : ''}">
                <div class="cal-day-num">${day}</div>
                ${taskDots}${moreCount}
            </div>`;
    }

    return `
    <div class="page-header">
      <h1>${icons.kanban} Calendar</h1>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn btn-secondary btn-sm" onclick="changeCalMonth(-1)">\u2190 Prev</button>
        <span style="font-weight:600;min-width:140px;text-align:center;">${monthNames[viewMonth]} ${viewYear}</span>
        <button class="btn btn-secondary btn-sm" onclick="changeCalMonth(1)">Next \u2192</button>
      </div>
    </div>
    <div class="page-body">
      <div class="cal-grid">
        <div class="cal-header">Sun</div>
        <div class="cal-header">Mon</div>
        <div class="cal-header">Tue</div>
        <div class="cal-header">Wed</div>
        <div class="cal-header">Thu</div>
        <div class="cal-header">Fri</div>
        <div class="cal-header">Sat</div>
        ${cells}
      </div>
    </div>
  `;
}

window.changeCalMonth = function(delta) {
    const now = new Date();
    if (window.calendarMonth === undefined) window.calendarMonth = now.getMonth();
    if (window.calendarYear === undefined) window.calendarYear = now.getFullYear();
    window.calendarMonth += delta;
    if (window.calendarMonth > 11) { window.calendarMonth = 0; window.calendarYear++; }
    if (window.calendarMonth < 0) { window.calendarMonth = 11; window.calendarYear--; }
    window.renderApp();
};

export { renderCalendar };
