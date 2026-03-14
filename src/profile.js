import { getCurrentUser, isAdmin, updateUser, getTasksByFreelancer, getTasks, sanitizeHTML } from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

async function renderProfile() {
    const user = await getCurrentUser();
    const adminUser = await isAdmin();
    const tasks = adminUser ? await getTasks() : await getTasksByFreelancer(user.id);

    const approved = tasks.filter(t => t.status === 'approved').length;
    const totalAmount = tasks.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();

    const badgeColor = user.badge === 'Platinum' ? '#7c3aed' : user.badge === 'Gold' ? '#d97706' : user.badge === 'Silver' ? '#6b7280' : 'var(--text-muted)';

    return `
    <div class="page-header">
      <h1>${icons.users} My Profile</h1>
    </div>
    <div class="page-body">
      <div class="profile-card">
        <div class="profile-header">
          <div class="profile-avatar">${initials}</div>
          <div class="profile-info">
            <h2>${sanitizeHTML(user.name)}</h2>
            <span class="profile-role badge badge-${user.role === 'freelancer' ? 'assigned' : 'approved'}">${user.role === 'superadmin' ? 'Super Admin' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
            ${user.badge ? `<span class="badge" style="background:${badgeColor};color:#fff;margin-left:6px;">${user.badge}</span>` : ''}
          </div>
        </div>
        <div class="profile-stats">
          <div class="stat-card purple">
            <div class="stat-value">${tasks.length}</div>
            <div class="stat-label">Total Tasks</div>
          </div>
          <div class="stat-card green">
            <div class="stat-value">${approved}</div>
            <div class="stat-label">Approved</div>
          </div>
          <div class="stat-card teal">
            <div class="stat-value">₹${totalAmount.toLocaleString('en-IN')}</div>
            <div class="stat-label">Earnings</div>
          </div>
          <div class="stat-card purple">
            <div class="stat-value">${user.points || 0}</div>
            <div class="stat-label">Points</div>
          </div>
        </div>
        <div class="profile-details">
          <h3>Account Details</h3>
          <div class="detail-grid">
            <div class="detail-field">
              <div class="field-label">Email</div>
              <div class="field-value">${sanitizeHTML(user.email || '—')}</div>
            </div>
            <div class="detail-field">
              <div class="field-label">Member Since</div>
              <div class="field-value">${user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export { renderProfile };
