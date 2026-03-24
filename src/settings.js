// ==========================================
// CRM Tracker — Agency Settings Page
// ==========================================

import {
    isAdmin, isSuperAdmin, sanitizeHTML,
    getAgencySettings, updateAgencySettings,
    getProjects, addProject, updateProject, deleteProject,
    TASK_CATEGORIES, PROJECT_TYPES,
} from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

async function renderSettings() {
    const adminUser = await isAdmin();
    if (!adminUser) return '<div class="page-header"><h1>Access Denied</h1></div>';

    const agency = await getAgencySettings();
    const projects = await getProjects();

    const projectRows = projects.length === 0
        ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No projects yet. Add one above.</td></tr>`
        : projects.map(p => `
            <tr>
                <td><strong>${sanitizeHTML(p.name)}</strong></td>
                <td>${sanitizeHTML(p.client)}</td>
                <td><span class="badge badge-${p.type === 'Retainer' ? 'approved' : p.type === 'Campaign' ? 'submitted' : 'assigned'}">${sanitizeHTML(p.type)}</span></td>
                <td>${p.startDate || '—'}</td>
                <td>${p.endDate || '—'}</td>
                <td><span class="badge badge-${p.status === 'Active' ? 'approved' : p.status === 'Completed' ? 'submitted' : 'rejected'}">${sanitizeHTML(p.status)}</span></td>
                <td class="row-actions">
                    <button class="btn-icon" onclick="editProject('${p.id}')" title="Edit">${icons.edit}</button>
                    <button class="btn-icon" onclick="handleDeleteProject('${p.id}')" title="Delete">${icons.trash}</button>
                </td>
            </tr>
        `).join('');

    return `
    <div class="page-header">
      <h1>${icons.settings || '⚙️'} Settings</h1>
    </div>
    <div class="page-body">
      <div class="task-detail-section">
        <h3>Agency Information</h3>
        <form id="agency-form">
          <div class="form-row">
            <div class="form-group">
              <label>Agency Name</label>
              <input type="text" class="form-control" id="agency-name" value="${sanitizeHTML(agency.name || '')}" placeholder="Your Agency Name" />
            </div>
            <div class="form-group">
              <label>Registration No.</label>
              <input type="text" class="form-control" id="agency-reg" value="${sanitizeHTML(agency.registrationNo || '')}" placeholder="REG-001" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Address</label>
              <input type="text" class="form-control" id="agency-address" value="${sanitizeHTML(agency.address || '')}" placeholder="123 Business Park, City" />
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" class="form-control" id="agency-phone" value="${sanitizeHTML(agency.phone || '')}" placeholder="+91 22 1234 5678" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email</label>
              <input type="email" class="form-control" id="agency-email" value="${sanitizeHTML(agency.email || '')}" placeholder="contact@agency.com" />
            </div>
            <div class="form-group">
              <label>Website</label>
              <input type="url" class="form-control" id="agency-website" value="${sanitizeHTML(agency.website || '')}" placeholder="https://www.agency.com" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>GST Number</label>
              <input type="text" class="form-control" id="agency-gst" value="${sanitizeHTML(agency.gstNumber || '')}" placeholder="27AAACD1234E1Z5" />
            </div>
            <div class="form-group">
              <label>PAN Number</label>
              <input type="text" class="form-control" id="agency-pan" value="${sanitizeHTML(agency.panNumber || '')}" placeholder="AAACD1234E" />
            </div>
          </div>
          <div class="form-group">
            <label>Bank Details</label>
            <input type="text" class="form-control" id="agency-bank" value="${sanitizeHTML(agency.bankDetails || '')}" placeholder="HDFC Bank - 12345678901234" />
          </div>
          <button type="button" class="btn btn-primary" onclick="saveAgencySettings()" style="margin-top:8px;">Save Agency Info</button>
        </form>
      </div>

      <div class="task-detail-section" style="margin-top:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3>Projects</h3>
          <button class="btn btn-primary btn-sm" onclick="openProjectModal()">${icons.plus} Add Project</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Client</th>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${projectRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Save Agency Settings
window.saveAgencySettings = async function () {
    const data = {
        name: document.getElementById('agency-name').value.trim(),
        registrationNo: document.getElementById('agency-reg').value.trim(),
        address: document.getElementById('agency-address').value.trim(),
        phone: document.getElementById('agency-phone').value.trim(),
        email: document.getElementById('agency-email').value.trim(),
        website: document.getElementById('agency-website').value.trim(),
        gstNumber: document.getElementById('agency-gst').value.trim(),
        panNumber: document.getElementById('agency-pan').value.trim(),
        bankDetails: document.getElementById('agency-bank').value.trim(),
    };
    await updateAgencySettings(data);
    showToast('Agency settings saved!', 'success');
};

// Project Modal
window.openProjectModal = async function (projectId) {
    const projects = await getProjects();
    const project = projectId ? projects.find(p => p.id === projectId) : null;

    // Get unique client names from localStorage
    const clients = JSON.parse(localStorage.getItem('crm_clients') || '[]');
    const tasks = JSON.parse(localStorage.getItem('crm_tasks') || '[]');
    const taskClients = [...new Set(tasks.map(t => t.client).filter(Boolean))];
    const allClientNames = [...new Set([...clients.map(c => c.name), ...taskClients])].sort();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'project-modal-overlay';
    overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <h3>${project ? 'Edit Project' : 'Add Project'}</h3>
        <button class="btn-icon" onclick="document.getElementById('project-modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Project Name *</label>
          <input type="text" class="form-control" id="proj-name" value="${project ? sanitizeHTML(project.name) : ''}" placeholder="Website Redesign" />
        </div>
        <div class="form-group">
          <label>Client *</label>
          <select class="form-control" id="proj-client">
            <option value="">Select Client</option>
            ${allClientNames.map(c => `<option value="${sanitizeHTML(c)}" ${project && project.client === c ? 'selected' : ''}>${sanitizeHTML(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select class="form-control" id="proj-type">
              ${PROJECT_TYPES.map(t => `<option value="${t}" ${project && project.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select class="form-control" id="proj-status">
              <option value="Active" ${!project || project.status === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Completed" ${project && project.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="On Hold" ${project && project.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
              <option value="Cancelled" ${project && project.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Start Date</label>
            <input type="date" class="form-control" id="proj-start" value="${project ? project.startDate || '' : ''}" />
          </div>
          <div class="form-group">
            <label>End Date</label>
            <input type="date" class="form-control" id="proj-end" value="${project ? project.endDate || '' : ''}" />
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea class="form-control" id="proj-notes" rows="2">${project ? sanitizeHTML(project.notes || '') : ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('project-modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="saveProject('${projectId || ''}')">${project ? 'Update' : 'Create'} Project</button>
      </div>
    </div>
    `;
    document.body.appendChild(overlay);
};

window.editProject = function (id) { window.openProjectModal(id); };

window.saveProject = async function (existingId) {
    const name = document.getElementById('proj-name').value.trim();
    const client = document.getElementById('proj-client').value;
    if (!name || !client) { showToast('Name and client are required', 'error'); return; }

    const data = {
        name,
        client,
        type: document.getElementById('proj-type').value,
        status: document.getElementById('proj-status').value,
        startDate: document.getElementById('proj-start').value || null,
        endDate: document.getElementById('proj-end').value || null,
        notes: document.getElementById('proj-notes').value.trim(),
    };

    if (existingId) {
        await updateProject(existingId, data);
        showToast('Project updated!', 'success');
    } else {
        await addProject(data);
        showToast('Project created!', 'success');
    }

    document.getElementById('project-modal-overlay').remove();
    await window.renderApp();
};

window.handleDeleteProject = async function (id) {
    if (!confirm('Delete this project?')) return;
    await deleteProject(id);
    showToast('Project deleted', 'success');
    await window.renderApp();
};

export { renderSettings };
