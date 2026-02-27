// ==========================================
// CRM Tracker — Team Chat
// ==========================================

import { getChatMessages, sendChatMessage, getCurrentUser } from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function renderChat() {
    const user = await getCurrentUser();
    const messages = await getChatMessages(200);

    const messagesHTML = messages.length === 0
        ? `<div class="chat-empty">
            <div class="empty-icon">${icons.chat}</div>
            <div class="empty-title">No messages yet</div>
            <div class="empty-text">Start a conversation with your team.</div>
           </div>`
        : messages.map(msg => {
            const isMe = msg.userId === user.id;
            const initials = (msg.userName || 'U').split(' ').map(n => n[0]).join('').toUpperCase();
            const roleLabel = msg.userRole === 'superadmin' ? 'Super Admin'
                : msg.userRole === 'admin' ? 'Admin' : 'Freelancer';
            return `
            <div class="chat-message ${isMe ? 'chat-message-mine' : ''}">
              ${!isMe ? `<div class="chat-avatar">${initials}</div>` : ''}
              <div class="chat-bubble ${isMe ? 'mine' : ''}">
                ${!isMe ? `<div class="chat-sender">${sanitize(msg.userName)} <span class="chat-role">${roleLabel}</span></div>` : ''}
                <div class="chat-text">${sanitize(msg.message)}</div>
                <div class="chat-time">${timeAgo(msg.createdAt)}</div>
              </div>
            </div>
          `;
        }).join('');

    return `
    <div class="page-header">
      <h1>${icons.chat} Team Chat</h1>
    </div>
    <div class="page-body chat-page-body">
      <div class="chat-container">
        <div class="chat-messages" id="chat-messages">
          ${messagesHTML}
        </div>
        <div class="chat-input-bar">
          <input type="text" class="chat-input" id="chat-input" placeholder="Type a message..." autocomplete="off" />
          <button class="btn btn-primary chat-send-btn" id="chat-send-btn" onclick="handleSendChat()">
            ${icons.send} Send
          </button>
        </div>
      </div>
    </div>
  `;
}

window.handleSendChat = async function () {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    try {
        await sendChatMessage(message);
        await window.renderApp();
        // Scroll to bottom after render
        setTimeout(() => {
            const container = document.getElementById('chat-messages');
            if (container) container.scrollTop = container.scrollHeight;
        }, 50);
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// Handle Enter key to send
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        const input = document.getElementById('chat-input');
        if (input && document.activeElement === input) {
            e.preventDefault();
            window.handleSendChat();
        }
    }
});

export { renderChat };
