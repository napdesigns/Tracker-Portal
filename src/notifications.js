// ==========================================
// CRM Tracker — Notification Bell UI
// ==========================================

import {
    getCurrentUser, getNotifications, getUnreadCount,
    markNotificationRead, markAllNotificationsRead,
} from './store-async.js';

export async function renderNotificationBell() {
    const user = await getCurrentUser();
    if (!user) return '';

    const unreadCount = await getUnreadCount(user.id);

    return `
    <div class="notification-bell-wrapper">
      <button class="notification-bell" onclick="toggleNotificationDropdown()" id="notification-bell" title="Notifications">
        <span class="bell-icon">🔔</span>
        ${unreadCount > 0 ? `<span class="notification-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
      </button>
      <div class="notification-dropdown" id="notification-dropdown" style="display: none;"></div>
    </div>
  `;
}

// Time ago helper
function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function notifIcon(type) {
    const icons = {
        assigned: '📥',
        submitted: '📤',
        approved: '✅',
        rejected: '❌',
        iteration: '🔄',
        info: 'ℹ️',
    };
    return icons[type] || icons.info;
}

window.toggleNotificationDropdown = async function () {
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;

    if (dropdown.style.display === 'none') {
        // Load notifications
        const user = await getCurrentUser();
        if (!user) return;

        const notifications = await getNotifications(user.id);

        if (notifications.length === 0) {
            dropdown.innerHTML = `
        <div class="notif-header">
          <span class="notif-header-title">Notifications</span>
        </div>
        <div class="notif-empty">
          <div style="font-size: 1.5rem; margin-bottom: 8px; opacity: 0.5;">🔔</div>
          <div>No notifications yet</div>
        </div>
      `;
        } else {
            const hasUnread = notifications.some(n => !n.isRead);
            dropdown.innerHTML = `
        <div class="notif-header">
          <span class="notif-header-title">Notifications</span>
          ${hasUnread ? `<button class="notif-mark-all" onclick="event.stopPropagation(); handleMarkAllRead()">Mark all read</button>` : ''}
        </div>
        <div class="notif-list">
          ${notifications.map(n => `
            <div class="notif-item ${n.isRead ? '' : 'unread'}"
                 onclick="event.stopPropagation(); handleNotifClick('${n.id}', '${n.taskId || ''}')"
                 id="notif-${n.id}">
              <div class="notif-icon">${notifIcon(n.type)}</div>
              <div class="notif-body">
                <div class="notif-title">${n.title}</div>
                <div class="notif-message">${n.message}</div>
                <div class="notif-time">${timeAgo(n.createdAt)}</div>
              </div>
              ${!n.isRead ? '<div class="notif-unread-dot"></div>' : ''}
            </div>
          `).join('')}
        </div>
      `;
        }

        dropdown.style.display = 'block';

        // Close on outside click
        setTimeout(() => {
            const closeHandler = (e) => {
                const wrapper = document.querySelector('.notification-bell-wrapper');
                if (wrapper && !wrapper.contains(e.target)) {
                    dropdown.style.display = 'none';
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    } else {
        dropdown.style.display = 'none';
    }
};

window.handleNotifClick = async function (notifId, taskId) {
    await markNotificationRead(notifId);

    // Close dropdown
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) dropdown.style.display = 'none';

    // Navigate to task if present
    if (taskId) {
        await window.navigateTo('task-detail', { selectedTaskId: taskId });
    } else {
        await window.renderApp();
    }
};

window.handleMarkAllRead = async function () {
    const user = await getCurrentUser();
    if (!user) return;

    await markAllNotificationsRead(user.id);

    // Refresh dropdown
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) dropdown.style.display = 'none';

    await window.renderApp();
};
