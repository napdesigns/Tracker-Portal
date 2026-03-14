// ==========================================
// CRM Tracker — User Management Page
// ==========================================

import {
    getCurrentUser, isAdmin, isSuperAdmin,
    getUsers, addUser, updateUser, deleteUser as deleteUserFromStore,
    getTasks, getStats,
} from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

async function renderUsers() {
    const currentUser = await getCurrentUser();
    const superAdmin = await isSuperAdmin();
    const users = await getUsers();

    const admins = users.filter(u => u.role === 'admin' || u.role === 'superadmin');
    const freelancers = users.filter(u => u.role === 'freelancer');

    // Pre-fetch all tasks once, then compute stats per freelancer (avoid N+1 queries)
    const allTasks = await getTasks();
    const freelancerStatsMap = {};
    for (const u of freelancers) {
        const fTasks = allTasks.filter(t => t.assignedTo === u.id);
        freelancerStatsMap[u.id] = await getStats(fTasks);
    }

    function renderUserTable(usersList, title, canAdd) {
        return `
      <div class="task-detail-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3>${title} (${usersList.length})</h3>
          ${canAdd ? `<button class="btn btn-sm btn-primary" onclick="openAddUserModal('${title === 'Admins' ? 'admin' : 'freelancer'}')" id="add-${title.toLowerCase()}-btn">${icons.plus} Add</button>` : ''}
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                ${title === 'Freelancers' ? '<th>Tasks</th><th>Approved</th><th>Iterations</th><th>Points</th><th>Badge</th>' : ''}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${usersList.length === 0 ? `
                <tr><td colspan="${title === 'Freelancers' ? 9 : 4}" style="text-align: center; color: var(--text-muted); padding: 30px;">No ${title.toLowerCase()} yet</td></tr>
              ` : usersList.map(u => {
            let statsHTML = '';
            if (title === 'Freelancers') {
                const fStats = freelancerStatsMap[u.id] || { totalTasks: 0, approved: 0, totalIterations: 0 };
                const badgeClass = u.badge === 'Platinum' ? 'approved' : u.badge === 'Gold' ? 'assigned' : u.badge === 'Silver' ? 'submitted' : '';
                statsHTML = `
                    <td>${fStats.totalTasks}</td>
                    <td>${fStats.approved}</td>
                    <td>${fStats.totalIterations}</td>
                    <td>${u.points || 0}</td>
                    <td>${u.badge ? `<span class="badge badge-${badgeClass}">${u.badge}</span>` : '—'}</td>
                  `;
            }
            const canDelete = u.id !== currentUser.id && (superAdmin || u.role === 'freelancer');
            return `
                  <tr>
                    <td><strong>${u.name}</strong></td>
                    <td style="color: var(--text-secondary);">${u.email}</td>
                    <td><span class="badge badge-${u.role === 'superadmin' ? 'approved' : u.role === 'admin' ? 'submitted' : 'assigned'}">${u.role === 'superadmin' ? 'Super Admin' : u.role}</span></td>
                    ${statsHTML}
                    <td class="row-actions">
                      <button class="btn-icon" onclick="openEditUserModal('${u.id}')" title="Edit">${icons.edit}</button>
                      ${canDelete ? `<button class="btn-icon" onclick="handleDeleteUser('${u.id}')" title="Delete">${icons.trash}</button>` : ''}
                    </td>
                  </tr>
                `;
        }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    }

    return `
    <div class="page-header">
      <h1>User Management</h1>
    </div>
    <div class="page-body">
      ${superAdmin ? renderUserTable(admins, 'Admins', true) : ''}
      ${renderUserTable(freelancers, 'Freelancers', true)}
    </div>
  `;
}

// ==========================================
// Add / Edit User Modal
// ==========================================

window.openAddUserModal = async function (role) {
    await showUserModal(null, role);
};

window.openEditUserModal = async function (id) {
    const users = await getUsers();
    const user = users.find(u => u.id === id);
    if (user) await showUserModal(user, user.role);
};

async function showUserModal(user, defaultRole) {
    const isEdit = !!user;
    const superAdminCheck = await isSuperAdmin();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${isEdit ? 'Edit User' : 'Add New User'}</h2>
        <button class="btn-icon" id="user-modal-close">✕</button>
      </div>
      <div class="modal-body">
        <form id="user-form">
          <div class="form-group">
            <label>Name</label>
            <input type="text" class="form-control" id="user-name" value="${user ? user.name : ''}" placeholder="Full name" required />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" class="form-control" id="user-email" value="${user ? user.email : ''}" placeholder="email@example.com" required ${isEdit ? 'disabled' : ''} />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="text" class="form-control" id="user-password" value="${user ? user.password : ''}" placeholder="Password" required />
          </div>
          <div class="form-group">
            <label>Role</label>
            <select class="form-control" id="user-role" onchange="togglePricingSection()">
              ${superAdminCheck ? `<option value="admin" ${defaultRole === 'admin' ? 'selected' : ''}>Admin</option>` : ''}
              <option value="freelancer" ${defaultRole === 'freelancer' ? 'selected' : ''}>Freelancer</option>
            </select>
          </div>
          <div id="pricing-section" style="${(user?.role || defaultRole) === 'freelancer' ? '' : 'display:none;'}">
            <div style="margin-bottom: 8px; font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">Pricing per Type (₹)</div>
            <div class="form-row">
              <div class="form-group"><label>Static</label><input type="number" class="form-control" id="price-Static" value="${user?.pricing?.Static || ''}" placeholder="0" min="0" /></div>
              <div class="form-group"><label>Animated</label><input type="number" class="form-control" id="price-Animated" value="${user?.pricing?.Animated || ''}" placeholder="0" min="0" /></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Video</label><input type="number" class="form-control" id="price-Video" value="${user?.pricing?.Video || ''}" placeholder="0" min="0" /></div>
              <div class="form-group"><label>Carousel</label><input type="number" class="form-control" id="price-Carousel" value="${user?.pricing?.Carousel || ''}" placeholder="0" min="0" /></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Reels</label><input type="number" class="form-control" id="price-Reels" value="${user?.pricing?.Reels || ''}" placeholder="0" min="0" /></div>
              <div class="form-group"><label>Logo</label><input type="number" class="form-control" id="price-Logo" value="${user?.pricing?.Logo || ''}" placeholder="0" min="0" /></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Branding</label><input type="number" class="form-control" id="price-Branding" value="${user?.pricing?.Branding || ''}" placeholder="0" min="0" /></div>
              <div class="form-group"><label>Other</label><input type="number" class="form-control" id="price-Other" value="${user?.pricing?.Other || ''}" placeholder="0" min="0" /></div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Points</label>
                <input type="number" class="form-control" id="user-points" value="${user?.points || 0}" min="0" />
              </div>
              <div class="form-group">
                <label>Badge</label>
                <select class="form-control" id="user-badge">
                  <option value="" ${!user?.badge ? 'selected' : ''}>None</option>
                  <option value="Silver" ${user?.badge === 'Silver' ? 'selected' : ''}>Silver (1000+)</option>
                  <option value="Gold" ${user?.badge === 'Gold' ? 'selected' : ''}>Gold (2000+)</option>
                  <option value="Platinum" ${user?.badge === 'Platinum' ? 'selected' : ''}>Platinum (3000+)</option>
                </select>
              </div>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="user-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="user-save-btn">${isEdit ? 'Update' : 'Create'} User</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.querySelector('#user-modal-close').onclick = closeModal;
    overlay.querySelector('#user-cancel-btn').onclick = closeModal;

    // Toggle pricing section based on role
    window.togglePricingSection = function () {
        const role = overlay.querySelector('#user-role').value;
        const section = overlay.querySelector('#pricing-section');
        if (section) section.style.display = role === 'freelancer' ? '' : 'none';
    };

    overlay.querySelector('#user-save-btn').onclick = async () => {
        const name = overlay.querySelector('#user-name').value.trim();
        const email = overlay.querySelector('#user-email').value.trim();
        const password = overlay.querySelector('#user-password').value;
        const role = overlay.querySelector('#user-role').value;

        // Collect pricing for freelancers
        const pricing = {};
        const types = ['Static', 'Animated', 'Video', 'Carousel', 'Reels', 'Logo', 'Branding', 'Other'];
        if (role === 'freelancer') {
            types.forEach(t => {
                const val = overlay.querySelector(`#price-${t}`)?.value;
                if (val && parseFloat(val) > 0) pricing[t] = parseFloat(val);
            });
        }

        const points = parseInt(overlay.querySelector('#user-points')?.value) || 0;
        const badge = overlay.querySelector('#user-badge')?.value || null;

        if (!name || !email || !password) {
            showToast('All fields are required', 'error');
            return;
        }

        try {
            if (isEdit) {
                await updateUser(user.id, { name, password, role, pricing, points, badge });
                showToast('User updated!', 'success');
            } else {
                await addUser({ name, email, password, role, pricing, points, badge });
                showToast('User created!', 'success');
            }
            closeModal();
            await window.renderApp();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };
}

// ==========================================
// Delete User
// ==========================================

window.handleDeleteUser = function (id) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal confirm-dialog">
      <div class="modal-body">
        <div class="confirm-icon">${icons.alertTriangle}</div>
        <h3 style="margin-bottom: 8px;">Delete this user?</h3>
        <p class="confirm-text">This action cannot be undone.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="del-user-cancel">Cancel</button>
        <button class="btn btn-danger" id="del-user-confirm">Delete</button>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);
    overlay.querySelector('#del-user-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#del-user-confirm').onclick = async () => {
        overlay.remove();
        await deleteUserFromStore(id);
        showToast('User deleted', 'success');
        await window.renderApp();
    };
};

export { renderUsers };
