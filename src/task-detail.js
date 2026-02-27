// ==========================================
// CRM Tracker — Task Detail View
// ==========================================

import {
    getTaskById, getUserById, isAdmin, getCurrentUser, formatDate, formatDateTime, timeDiff, sanitizeHTML,
    rejectTask,
} from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

async function renderTaskDetail(taskId) {
    const task = await getTaskById(taskId);
    if (!task) {
        return `
      <div class="page-header">
        <h1>Task Not Found</h1>
        <button class="btn btn-secondary" onclick="navigateTo('tasks')">← Back to Tasks</button>
      </div>
      <div class="page-body">
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <div class="empty-title">Task not found</div>
        </div>
      </div>
    `;
    }

    const adminUser = await isAdmin();
    const currentUser = await getCurrentUser();
    const freelancer = task.assignedTo ? await getUserById(task.assignedTo) : null;
    const assigner = task.assignedBy ? await getUserById(task.assignedBy) : null;
    const iterations = task.iterations || [];

    // Time calculations
    const pickupTime = timeDiff(task.assignedAt, task.pickedUpAt);
    const workTime = timeDiff(task.pickedUpAt, task.submittedAt);

    // Status label
    const statusLabel = {
        'assigned': 'Assigned',
        'in_progress': 'In Progress',
        'submitted': 'Submitted',
        'approved': 'Approved',
        'iteration': 'Iteration',
        'rejected': 'Rejected',
    }[task.status] || task.status;

    // Reference Creative
    const refCreativeHTML = task.referenceCreative
        ? `<img src="${task.referenceCreative}" style="max-width: 300px; border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer;" onclick="openLightbox('${task.referenceCreative.replace(/'/g, "\\'")}')" alt="Reference Creative" />`
        : `<span style="color: var(--text-muted);">No reference creative</span>`;

    // Completed Creative
    const completedCreativeHTML = task.completedCreative
        ? `<div>
            <img src="${task.completedCreative}" style="max-width: 300px; border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer;" onclick="openLightbox('${task.completedCreative.replace(/'/g, "\\'")}')" alt="Completed Creative" />
            ${task.completedCreativeAt ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">Uploaded ${formatDateTime(task.completedCreativeAt)}</div>` : ''}
           </div>`
        : `<span style="color: var(--text-muted);">No completed creative yet</span>`;

    // Timeline events
    let timelineItems = [];
    if (task.assignedAt) {
        timelineItems.push({
            cls: 'assigned',
            time: formatDateTime(task.assignedAt),
            content: `<strong>Task assigned</strong> ${assigner ? `by ${sanitizeHTML(assigner.name)}` : ''} ${freelancer ? `to <strong>${sanitizeHTML(freelancer.name)}</strong>` : ''}`,
        });
    }

    // Interleave iterations & pickups/submits
    iterations.forEach((iter, i) => {
        timelineItems.push({
            cls: 'iteration',
            time: formatDateTime(iter.requestedAt),
            content: `<strong>Iteration #${iter.number} requested</strong> — <span class="badge badge-${iter.blame}">${capitalize(iter.blame)}</span><br/><span style="color: var(--text-secondary); font-size: 0.82rem;">${sanitizeHTML(iter.reason)}</span>`,
        });
        if (iter.resolvedAt) {
            timelineItems.push({
                cls: 'picked',
                time: formatDateTime(iter.resolvedAt),
                content: `<strong>Iteration #${iter.number} picked up</strong> by ${freelancer ? sanitizeHTML(freelancer.name) : 'Freelancer'}`,
            });
        }
    });

    if (task.pickedUpAt && iterations.length === 0) {
        timelineItems.push({
            cls: 'picked',
            time: formatDateTime(task.pickedUpAt),
            content: `<strong>Picked up</strong> by ${freelancer ? sanitizeHTML(freelancer.name) : 'Freelancer'}`,
        });
    }

    // Creative upload event
    if (task.completedCreativeAt) {
        timelineItems.push({
            cls: 'submitted',
            time: formatDateTime(task.completedCreativeAt),
            content: `<strong>Creative uploaded</strong> by ${freelancer ? sanitizeHTML(freelancer.name) : 'Freelancer'}`,
        });
    }

    if (task.submittedAt) {
        timelineItems.push({
            cls: 'submitted',
            time: formatDateTime(task.submittedAt),
            content: `<strong>Work submitted</strong> by ${freelancer ? sanitizeHTML(freelancer.name) : 'Freelancer'}`,
        });
    }

    if (task.status === 'approved') {
        timelineItems.push({
            cls: 'approved',
            time: '',
            content: `<strong>Task approved</strong>`,
        });
    }

    if (task.status === 'rejected') {
        timelineItems.push({
            cls: 'rejected',
            time: task.rejectedAt ? formatDateTime(task.rejectedAt) : '',
            content: `<strong>Task rejected</strong>${task.rejectionReason ? `<br/><span style="color: var(--text-secondary); font-size: 0.82rem;">${sanitizeHTML(task.rejectionReason)}</span>` : ''}`,
        });
    }

    const timelineHTML = timelineItems.length > 0
        ? timelineItems.map(item => `
        <div class="timeline-item ${item.cls}">
          <div class="timeline-time">${item.time}</div>
          <div class="timeline-content">${item.content}</div>
        </div>
      `).join('')
        : `<p style="color: var(--text-muted);">No timeline events yet.</p>`;

    // Iterations table
    let iterationsTableHTML = '';
    if (iterations.length > 0) {
        iterationsTableHTML = `
      <div class="task-detail-section">
        <h3>Iteration History (${iterations.length})</h3>
        <div class="table-container">
          <table class="iterations-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Reason</th>
                <th>Caused By</th>
                <th>Requested At</th>
                <th>Resolved At</th>
              </tr>
            </thead>
            <tbody>
              ${iterations.map(iter => `
                <tr>
                  <td>${iter.number}</td>
                  <td>${sanitizeHTML(iter.reason)}</td>
                  <td><span class="badge badge-${iter.blame}">${capitalize(iter.blame)}</span></td>
                  <td>${formatDateTime(iter.requestedAt)}</td>
                  <td>${iter.resolvedAt ? formatDateTime(iter.resolvedAt) : '<span style="color: var(--text-muted);">Pending</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    }

    // Blame summary
    let blameSummaryHTML = '';
    if (iterations.length > 0) {
        const blameCount = { freelancer: 0, admin: 0, client: 0 };
        iterations.forEach(it => { blameCount[it.blame] = (blameCount[it.blame] || 0) + 1; });
        blameSummaryHTML = `
      <div style="display: flex; gap: 12px; margin-top: 16px;">
        <div style="flex:1; padding: 12px; background: rgba(225,112,85,0.08); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 1.2rem; font-weight: 700; color: var(--blame-freelancer);">${blameCount.freelancer}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Freelancer</div>
        </div>
        <div style="flex:1; padding: 12px; background: rgba(253,203,110,0.08); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 1.2rem; font-weight: 700; color: var(--blame-admin);">${blameCount.admin}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Admin</div>
        </div>
        <div style="flex:1; padding: 12px; background: rgba(116,185,255,0.08); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 1.2rem; font-weight: 700; color: var(--blame-client);">${blameCount.client}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Client</div>
        </div>
      </div>
    `;
    }

    // Show upload button for freelancers when in_progress
    const isFreelancerOnTask = !adminUser && task.status === 'in_progress';

    return `
    <div class="page-header">
      <div style="display: flex; align-items: center; gap: 16px;">
        <button class="btn btn-secondary btn-sm" onclick="navigateTo('tasks')" id="back-to-tasks-btn">← Back</button>
        <h1>Task #${task.slNo}</h1>
        <span class="badge badge-${task.status}">${statusLabel}</span>
      </div>
      <div style="display: flex; gap: 8px;">
        ${adminUser && task.status === 'submitted' ? `
          <button class="btn btn-sm btn-primary" onclick="handleApproveTask('${task.id}')" id="approve-task-btn">Approve</button>
          <button class="btn btn-sm btn-danger" onclick="openRejectModal('${task.id}')" id="reject-task-btn">Reject</button>
          <button class="btn btn-sm btn-secondary" onclick="openIterationModal('${task.id}')" id="iterate-task-btn">Iterate</button>
        ` : ''}
        ${!adminUser && (task.status === 'assigned' || task.status === 'iteration') ? `
          <button class="btn btn-sm btn-primary" onclick="handlePickUp('${task.id}')" id="pickup-task-btn">Pick Up</button>
        ` : ''}
        ${isFreelancerOnTask ? `
          <button class="btn btn-sm btn-secondary" onclick="openUploadCreativeModal('${task.id}')" id="upload-creative-btn">Upload Creative</button>
          <button class="btn btn-sm btn-primary" onclick="openSubmitModal('${task.id}')" id="submit-task-btn">Submit</button>
        ` : ''}
      </div>
    </div>
    <div class="page-body">
      <div class="task-detail-grid">
        <div class="detail-field">
          <div class="field-label">Client</div>
          <div class="field-value">${sanitizeHTML(task.client) || '—'}</div>
        </div>
        <div class="detail-field">
          <div class="field-label">Date</div>
          <div class="field-value">${formatDate(task.date)}</div>
        </div>
        <div class="detail-field">
          <div class="field-label">Type</div>
          <div class="field-value">${sanitizeHTML(task.type)}</div>
        </div>
        <div class="detail-field">
          <div class="field-label">Amount</div>
          <div class="field-value">₹${(parseFloat(task.amount) || 0).toLocaleString('en-IN')}</div>
        </div>
        <div class="detail-field">
          <div class="field-label">Payment Status</div>
          <div class="field-value"><span class="badge badge-${(task.paymentStatus || 'unpaid').toLowerCase()}">${sanitizeHTML(task.paymentStatus) || 'Unpaid'}</span></div>
        </div>
        <div class="detail-field">
          <div class="field-label">Editable File Shared</div>
          <div class="field-value">${sanitizeHTML(task.editableFileShared)}</div>
        </div>
        <div class="detail-field">
          <div class="field-label">Due Date</div>
          <div class="field-value ${task.dueDate && task.dueDate < new Date().toISOString().split('T')[0] && !['approved', 'rejected'].includes(task.status) ? 'overdue-text' : ''}">${task.dueDate ? formatDate(task.dueDate) : '—'}</div>
        </div>
        <div class="detail-field">
          <div class="field-label">Assigned To</div>
          <div class="field-value">${freelancer ? sanitizeHTML(freelancer.name) : '—'}</div>
        </div>
        <div class="detail-field">
          <div class="field-label">Creative Status</div>
          <div class="field-value"><span class="badge badge-${creativeStatusBadgeClass(task.creativeStatus)}">${task.creativeStatus || 'Pending'}</span></div>
        </div>
        <div class="detail-field">
          <div class="field-label">Iterations</div>
          <div class="field-value">${iterations.length}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px;">
        <div class="detail-field">
          <div class="field-label">Time to Pick Up</div>
          <div class="field-value">${pickupTime}</div>
        </div>
        <div class="detail-field">
          <div class="field-label">Work Duration</div>
          <div class="field-value">${workTime}</div>
        </div>
      </div>

      ${task.description ? `
      <div class="task-detail-section">
        <h3>Description</h3>
        <p style="color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap;">${sanitizeHTML(task.description)}</p>
      </div>
      ` : ''}

      ${task.sourceLink ? `
      <div class="task-detail-section">
        <h3>Source Link</h3>
        <a href="${sanitizeHTML(task.sourceLink)}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); word-break: break-all; display: inline-flex; align-items: center; gap: 6px;">
          ${icons.pin} ${sanitizeHTML(task.sourceLink)}
        </a>
      </div>
      ` : ''}

      <div class="task-detail-section">
        <h3>Reference Creative</h3>
        ${refCreativeHTML}
      </div>

      <div class="task-detail-section">
        <h3>Completed Creative</h3>
        ${completedCreativeHTML}
      </div>

      <div class="task-detail-section">
        <h3>Timeline</h3>
        <div class="timeline">${timelineHTML}</div>
      </div>

      ${iterationsTableHTML}
      ${blameSummaryHTML ? `
        <div class="task-detail-section">
          <h3>Iteration Blame Summary</h3>
          ${blameSummaryHTML}
        </div>
      ` : ''}
    </div>
  `;
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

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

export { renderTaskDetail };
