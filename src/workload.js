// ==========================================
// CRM Tracker — Team Workload View
// ==========================================

import { isAdmin, getTasks, getFreelancers, sanitizeHTML } from './store-async.js';
import icons from './icons.js';

async function renderWorkload() {
    const adminUser = await isAdmin();
    if (!adminUser) {
        return `<div class="page-header"><h1>Access Denied</h1></div><div class="page-body"><p>Only admins can view team workload.</p></div>`;
    }

    const tasks = await getTasks();
    const freelancers = await getFreelancers();

    const maxTasks = Math.max(...freelancers.map(f => tasks.filter(t => t.assignedTo === f.id).length), 1);

    const rows = freelancers.map(f => {
        const fTasks = tasks.filter(t => t.assignedTo === f.id);
        const active = fTasks.filter(t => ['assigned', 'in_progress', 'iteration'].includes(t.status)).length;
        const submitted = fTasks.filter(t => t.status === 'submitted').length;
        const approved = fTasks.filter(t => t.status === 'approved').length;
        const total = fTasks.length;
        const pct = maxTasks > 0 ? Math.round((total / maxTasks) * 100) : 0;

        let loadLevel = 'low';
        if (active >= 5) loadLevel = 'high';
        else if (active >= 3) loadLevel = 'medium';

        return `
            <div class="workload-row">
                <div class="workload-user">
                    <div class="workload-avatar">${f.name.split(' ').map(n => n[0]).join('').toUpperCase()}</div>
                    <div>
                        <div class="workload-name">${sanitizeHTML(f.name)}</div>
                        <span class="badge priority-${loadLevel}" style="font-size:0.7rem;">${loadLevel.charAt(0).toUpperCase() + loadLevel.slice(1)} Load</span>
                    </div>
                </div>
                <div class="workload-bar-wrap">
                    <div class="workload-bar">
                        <div class="workload-bar-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="workload-counts">
                        <span class="badge badge-assigned">${active} active</span>
                        <span class="badge badge-submitted">${submitted} submitted</span>
                        <span class="badge badge-approved">${approved} done</span>
                        <span style="color:var(--text-muted);font-size:0.78rem;">${total} total</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    return `
    <div class="page-header">
      <h1>${icons.analytics} Team Workload</h1>
    </div>
    <div class="page-body">
      <div class="workload-container">
        ${rows || '<div class="empty-state"><div class="empty-title">No team members</div></div>'}
      </div>
    </div>
  `;
}

export { renderWorkload };
