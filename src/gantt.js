// ==========================================
// Gantt / Timeline View
// ==========================================

import { getCurrentUser, isAdmin, getTasks, getTasksByFreelancer, sanitizeHTML, formatDate } from './store-async.js';
import icons from './icons.js';

async function renderGantt() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();
    const allTasks = adminUser ? await getTasks() : await getTasksByFreelancer(user.id);

    // Filter to tasks that have dates
    const tasks = allTasks.filter(t => t.date || t.dueDate).sort((a, b) =>
        new Date(a.date || a.dueDate) - new Date(b.date || b.dueDate)
    );

    if (tasks.length === 0) {
        return `
        <div class="page-header"><h1>${icons.analytics} Timeline</h1></div>
        <div class="page-body">
          <div class="empty-state"><div class="empty-icon">${icons.kanban}</div><div class="empty-title">No tasks with dates</div></div>
        </div>`;
    }

    // Calculate date range — show last 15 days + next 45 days from today
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 15);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 45);

    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const dayWidth = 40; // pixels per day

    // Generate date headers
    let dateHeaders = '';
    let monthHeaders = '';
    let currentMonth = -1;
    let monthStartX = 0;
    let monthDayCount = 0;

    for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const isToday = d.toISOString().split('T')[0] === today.toISOString().split('T')[0];
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        if (d.getMonth() !== currentMonth) {
            if (currentMonth !== -1) {
                const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                monthHeaders += `<div class="gantt-month" style="left:${monthStartX}px;width:${monthDayCount * dayWidth}px;">${monthNames[currentMonth]}</div>`;
            }
            currentMonth = d.getMonth();
            monthStartX = i * dayWidth;
            monthDayCount = 0;
        }
        monthDayCount++;

        dateHeaders += `<div class="gantt-day ${isToday ? 'gantt-today' : ''} ${isWeekend ? 'gantt-weekend' : ''}" style="left:${i * dayWidth}px;width:${dayWidth}px;">${d.getDate()}</div>`;
    }
    // Last month
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    monthHeaders += `<div class="gantt-month" style="left:${monthStartX}px;width:${monthDayCount * dayWidth}px;">${monthNames[currentMonth]}</div>`;

    // Today line position
    const todayOffset = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));

    // Task bars
    const taskRows = tasks.slice(0, 30).map(t => {
        const taskStart = new Date(t.date || t.dueDate);
        const taskEnd = t.dueDate ? new Date(t.dueDate) : new Date(taskStart);
        if (taskEnd <= taskStart) taskEnd.setDate(taskStart.getDate() + 1);

        const startOffset = Math.max(0, Math.ceil((taskStart - startDate) / (1000 * 60 * 60 * 24)));
        const duration = Math.max(1, Math.ceil((taskEnd - taskStart) / (1000 * 60 * 60 * 24)));

        const statusColors = {
            assigned: '#6c5ce7', in_progress: '#0984e3', submitted: '#a29bfe',
            approved: '#00b894', iteration: '#fdcb6e', rejected: '#d63031'
        };
        const color = statusColors[t.status] || '#6c5ce7';

        return `
            <div class="gantt-row">
                <div class="gantt-row-label" onclick="navigateTo('task-detail', { selectedTaskId: '${t.id}' })" style="cursor:pointer;">
                    <strong>${sanitizeHTML(t.client || '—')}</strong>
                    <span class="badge badge-${t.status}" style="font-size:0.65rem;padding:1px 5px;margin-left:4px;">${t.status}</span>
                </div>
                <div class="gantt-row-chart" style="width:${totalDays * dayWidth}px;">
                    <div class="gantt-bar" style="left:${startOffset * dayWidth}px;width:${duration * dayWidth}px;background:${color};" title="${sanitizeHTML(t.client || '')} (${formatDate(t.date)} → ${t.dueDate ? formatDate(t.dueDate) : '—'})"></div>
                </div>
            </div>
        `;
    }).join('');

    return `
    <div class="page-header">
      <h1>${icons.analytics} Timeline</h1>
    </div>
    <div class="page-body">
      <div class="gantt-container">
        <div class="gantt-chart">
          <div class="gantt-header" style="width:${totalDays * dayWidth}px;">
            <div class="gantt-months">${monthHeaders}</div>
            <div class="gantt-days">${dateHeaders}</div>
          </div>
          <div class="gantt-body">
            <div class="gantt-today-line" style="left:${todayOffset * dayWidth + dayWidth/2}px;"></div>
            ${taskRows}
          </div>
        </div>
      </div>
    </div>
  `;
}

export { renderGantt };
