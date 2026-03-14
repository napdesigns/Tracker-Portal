// ==========================================
// CRM Tracker — Calendar View (Creative)
// ==========================================

import { getCurrentUser, isAdmin, getTasks, getTasksByFreelancer, sanitizeHTML } from './store-async.js';
import icons from './icons.js';

const STATUS_COLORS = {
    assigned: { bg: 'rgba(108, 92, 231, 0.15)', border: '#6c5ce7', text: '#6c5ce7' },
    in_progress: { bg: 'rgba(9, 132, 227, 0.15)', border: '#0984e3', text: '#0984e3' },
    submitted: { bg: 'rgba(162, 155, 254, 0.15)', border: '#a29bfe', text: '#6c5ce7' },
    approved: { bg: 'rgba(0, 184, 148, 0.15)', border: '#00b894', text: '#00b894' },
    iteration: { bg: 'rgba(253, 203, 110, 0.2)', border: '#fdcb6e', text: '#e17055' },
    rejected: { bg: 'rgba(214, 48, 49, 0.12)', border: '#d63031', text: '#d63031' },
};

async function renderCalendar() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();
    const tasks = adminUser ? await getTasks() : await getTasksByFreelancer(user.id);

    const now = new Date();
    const viewMonth = window.calendarMonth !== undefined ? window.calendarMonth : now.getMonth();
    const viewYear = window.calendarYear !== undefined ? window.calendarYear : now.getFullYear();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    const today = now.toISOString().split('T')[0];

    // Task stats for the month summary
    const monthTasks = tasks.filter(t => {
        const d = new Date(t.dueDate || t.date || '');
        return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });
    const monthApproved = monthTasks.filter(t => t.status === 'approved').length;
    const monthPending = monthTasks.filter(t => ['assigned', 'in_progress', 'submitted'].includes(t.status)).length;
    const monthOverdue = monthTasks.filter(t => {
        const dd = (t.dueDate || '').split('T')[0];
        return dd && dd < today && !['approved', 'rejected'].includes(t.status);
    }).length;

    // Build cells — include prev/next month faded days
    let cells = '';

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = prevMonthDays - i;
        cells += `<div class="cal-cell cal-other-month"><div class="cal-day-num">${day}</div></div>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === today;
        const isWeekend = new Date(viewYear, viewMonth, day).getDay() % 6 === 0;
        const dayTasks = tasks.filter(t => {
            const tDate = (t.dueDate || t.date || '').split('T')[0];
            return tDate === dateStr;
        });

        const taskChips = dayTasks.slice(0, 3).map(t => {
            const sc = STATUS_COLORS[t.status] || STATUS_COLORS.assigned;
            return `<div class="cal-chip" style="background:${sc.bg};border-left:3px solid ${sc.border};color:${sc.text};" onclick="event.stopPropagation(); navigateTo('task-detail', { selectedTaskId: '${t.id}' })" title="${sanitizeHTML(t.client || '')} — ${t.status}">
                ${sanitizeHTML(t.client || '—')}
            </div>`;
        }).join('');

        const moreCount = dayTasks.length > 3 ? `<div class="cal-more-badge" title="${dayTasks.length - 3} more tasks">+${dayTasks.length - 3}</div>` : '';

        const taskCountIndicator = dayTasks.length > 0
            ? `<div class="cal-count-dots">${dayTasks.slice(0, 5).map(t => `<span class="cal-dot" style="background:${(STATUS_COLORS[t.status] || STATUS_COLORS.assigned).border};"></span>`).join('')}</div>`
            : '';

        cells += `
            <div class="cal-cell ${isToday ? 'cal-today' : ''} ${isWeekend ? 'cal-weekend' : ''} ${dayTasks.length > 0 ? 'cal-has-tasks' : ''}">
                <div class="cal-day-header">
                    <span class="cal-day-num ${isToday ? 'cal-today-num' : ''}">${day}</span>
                    ${taskCountIndicator}
                </div>
                <div class="cal-tasks-area">
                    ${taskChips}${moreCount}
                </div>
            </div>`;
    }

    // Next month leading days to fill remaining cells
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        cells += `<div class="cal-cell cal-other-month"><div class="cal-day-num">${i}</div></div>`;
    }

    // Day headers
    const dayHeaders = dayNames.map(d => `<div class="cal-day-header-cell">${d}</div>`).join('');

    return `
    <div class="page-header">
      <h1>${icons.calendar} Calendar</h1>
    </div>
    <div class="page-body">
      <div class="cal-top-bar">
        <div class="cal-nav">
          <button class="cal-nav-btn" onclick="changeCalMonth(-1)">${icons.chevronLeft || '‹'}</button>
          <div class="cal-month-title">
            <span class="cal-month-name">${monthNames[viewMonth]}</span>
            <span class="cal-year">${viewYear}</span>
          </div>
          <button class="cal-nav-btn" onclick="changeCalMonth(1)">${icons.chevronRight || '›'}</button>
          <button class="cal-today-btn" onclick="goToToday()">Today</button>
        </div>
        <div class="cal-summary">
          <div class="cal-stat">
            <span class="cal-stat-num">${monthTasks.length}</span>
            <span class="cal-stat-label">Tasks</span>
          </div>
          <div class="cal-stat cal-stat-green">
            <span class="cal-stat-num">${monthApproved}</span>
            <span class="cal-stat-label">Done</span>
          </div>
          <div class="cal-stat cal-stat-blue">
            <span class="cal-stat-num">${monthPending}</span>
            <span class="cal-stat-label">Pending</span>
          </div>
          ${monthOverdue > 0 ? `
          <div class="cal-stat cal-stat-red">
            <span class="cal-stat-num">${monthOverdue}</span>
            <span class="cal-stat-label">Overdue</span>
          </div>` : ''}
        </div>
      </div>
      <div class="cal-legend">
        <span class="cal-legend-item"><span class="cal-dot" style="background:#6c5ce7;"></span> Assigned</span>
        <span class="cal-legend-item"><span class="cal-dot" style="background:#0984e3;"></span> In Progress</span>
        <span class="cal-legend-item"><span class="cal-dot" style="background:#a29bfe;"></span> Submitted</span>
        <span class="cal-legend-item"><span class="cal-dot" style="background:#00b894;"></span> Approved</span>
        <span class="cal-legend-item"><span class="cal-dot" style="background:#fdcb6e;"></span> Iteration</span>
        <span class="cal-legend-item"><span class="cal-dot" style="background:#d63031;"></span> Rejected</span>
      </div>
      <div class="cal-grid">
        ${dayHeaders}
        ${cells}
      </div>
    </div>
  `;
}

window.changeCalMonth = function (delta) {
    const now = new Date();
    if (window.calendarMonth === undefined) window.calendarMonth = now.getMonth();
    if (window.calendarYear === undefined) window.calendarYear = now.getFullYear();
    window.calendarMonth += delta;
    if (window.calendarMonth > 11) { window.calendarMonth = 0; window.calendarYear++; }
    if (window.calendarMonth < 0) { window.calendarMonth = 11; window.calendarYear--; }
    window.renderApp();
};

window.goToToday = function () {
    const now = new Date();
    window.calendarMonth = now.getMonth();
    window.calendarYear = now.getFullYear();
    window.renderApp();
};

export { renderCalendar };
