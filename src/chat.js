// ==========================================
// CRM Tracker — Team Chat + Direct Messages
// ==========================================

import { getChatMessages, sendChatMessage, getCurrentUser, getUsers, getChatConversations } from './store-async.js';
import { showToast } from './toast.js';
import icons from './icons.js';

// Module-level state
let activeConversationId = 'team';
let miniChatConvoId = 'team';

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

function getInitials(name) {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase();
}

function renderMessageBubbles(messages, user) {
    if (messages.length === 0) {
        return `<div class="chat-empty">
            <div class="empty-icon">${icons.chat}</div>
            <div class="empty-title">No messages yet</div>
            <div class="empty-text">Start a conversation.</div>
           </div>`;
    }
    return messages.map(msg => {
        const isMe = msg.userId === user.id;
        const initials = getInitials(msg.userName);
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
}

// ==========================================
// Full Chat Page
// ==========================================

async function renderChat() {
    const user = await getCurrentUser();
    const conversations = await getChatConversations();
    const allUsers = await getUsers();
    const recipientId = activeConversationId === 'team' ? null : activeConversationId;
    const messages = await getChatMessages(200, recipientId);

    // Find active conversation label
    const activeConvo = conversations.find(c => c.id === activeConversationId);
    const activeLabel = activeConvo
        ? (activeConvo.type === 'team' ? 'Team Chat' : activeConvo.name)
        : 'Team Chat';

    // Conversation list HTML
    const convoListHTML = conversations.map(convo => {
        const isActive = convo.id === activeConversationId;
        const initials = convo.type === 'team' ? 'TC' : getInitials(convo.name);
        const preview = convo.lastMessage
            ? sanitize(convo.lastMessage.message).substring(0, 35) + (convo.lastMessage.message.length > 35 ? '...' : '')
            : 'No messages yet';
        const timeStr = convo.lastMessage ? timeAgo(convo.lastMessage.createdAt) : '';
        return `
        <div class="chat-convo-item ${isActive ? 'active' : ''}"
             onclick="selectConversation('${convo.id}')">
          <div class="chat-convo-avatar ${convo.type === 'team' ? 'team' : ''}">${initials}</div>
          <div class="chat-convo-info">
            <div class="chat-convo-name">${sanitize(convo.name)}</div>
            <div class="chat-convo-preview">${preview}</div>
          </div>
          ${timeStr ? `<div class="chat-convo-time">${timeStr}</div>` : ''}
        </div>`;
    }).join('');

    const messagesHTML = renderMessageBubbles(messages, user);

    // Recipient indicator
    const recipientBar = activeConversationId !== 'team'
        ? `<div class="chat-recipient-bar">
            ${icons.send} Sending to <strong>${sanitize(activeLabel)}</strong>
           </div>`
        : '';

    // New DM modal: list users not already in conversations
    const otherUsers = allUsers.filter(u => u.id !== user.id);
    const dmModalHTML = `
    <div class="modal-overlay" id="new-dm-modal" style="display:none;" onclick="closeNewDMModal(event)">
      <div class="modal-card" style="max-width:400px;">
        <div class="modal-header">
          <h3>${icons.send} New Direct Message</h3>
          <button class="btn-icon" onclick="document.getElementById('new-dm-modal').style.display='none'">${icons.close}</button>
        </div>
        <div class="modal-body">
          <input type="text" class="chat-input" placeholder="Search users..." id="dm-user-search" oninput="filterDMUsers(this.value)" style="margin-bottom:12px;" />
          <div class="dm-user-list" id="dm-user-list">
            ${otherUsers.map(u => {
                const init = getInitials(u.name);
                const roleLabel = u.role === 'superadmin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Freelancer';
                return `
                <div class="dm-user-item" onclick="startDMWith('${u.id}')" data-name="${sanitize(u.name.toLowerCase())}">
                  <div class="chat-avatar">${init}</div>
                  <div>
                    <div style="font-weight:600;font-size:0.88rem;">${sanitize(u.name)}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">${roleLabel}</div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>`;

    return `
    <div class="page-header">
      <h1>${icons.chat} Team Chat</h1>
      <div>
        <button class="btn btn-sm btn-outline" onclick="openNewDMPicker()">
          ${icons.plus} New Message
        </button>
      </div>
    </div>
    <div class="page-body chat-page-body">
      <div class="chat-layout">
        <div class="chat-sidebar">
          <div class="chat-sidebar-search">
            <input type="text" class="chat-input" placeholder="Search conversations..." id="chat-convo-search" oninput="filterConversations(this.value)" />
          </div>
          <div class="chat-convo-list" id="chat-convo-list">
            ${convoListHTML}
          </div>
        </div>
        <div class="chat-main">
          <div class="chat-main-header">
            <span class="chat-main-header-title">${activeConversationId === 'team' ? icons.users : icons.chat} ${sanitize(activeLabel)}</span>
          </div>
          <div class="chat-messages" id="chat-messages">
            ${messagesHTML}
          </div>
          ${recipientBar}
          <div class="chat-input-bar">
            <input type="text" class="chat-input" id="chat-input" placeholder="Type a message to ${sanitize(activeLabel)}..." autocomplete="off" />
            <button class="btn btn-primary chat-send-btn" id="chat-send-btn" onclick="handleSendChat()">
              ${icons.send} Send
            </button>
          </div>
        </div>
      </div>
    </div>
    ${dmModalHTML}
  `;
}

// ==========================================
// Chat Page Handlers
// ==========================================

window.handleSendChat = async function () {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    const recipientId = activeConversationId === 'team' ? null : activeConversationId;
    try {
        await sendChatMessage(message, recipientId);
        await window.renderApp();
        setTimeout(() => {
            const container = document.getElementById('chat-messages');
            if (container) container.scrollTop = container.scrollHeight;
        }, 50);
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.selectConversation = async function (convoId) {
    activeConversationId = convoId;
    await window.renderApp();
    setTimeout(() => {
        const container = document.getElementById('chat-messages');
        if (container) container.scrollTop = container.scrollHeight;
    }, 50);
};

window.openNewDMPicker = function () {
    const modal = document.getElementById('new-dm-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeNewDMModal = function (e) {
    if (e.target.id === 'new-dm-modal') {
        e.target.style.display = 'none';
    }
};

window.startDMWith = async function (userId) {
    const modal = document.getElementById('new-dm-modal');
    if (modal) modal.style.display = 'none';
    activeConversationId = userId;
    await window.renderApp();
    setTimeout(() => {
        const container = document.getElementById('chat-messages');
        if (container) container.scrollTop = container.scrollHeight;
    }, 50);
};

window.filterConversations = function (query) {
    const items = document.querySelectorAll('.chat-convo-item');
    const q = query.toLowerCase();
    items.forEach(item => {
        const name = item.querySelector('.chat-convo-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(q) ? '' : 'none';
    });
};

window.filterDMUsers = function (query) {
    const items = document.querySelectorAll('.dm-user-item');
    const q = query.toLowerCase();
    items.forEach(item => {
        item.style.display = (item.dataset.name || '').includes(q) ? '' : 'none';
    });
};

// Handle Enter key to send (works for both full chat page and mini chat)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        const input = document.getElementById('chat-input');
        if (input && document.activeElement === input) {
            e.preventDefault();
            window.handleSendChat();
            return;
        }
        const miniInput = document.getElementById('mini-chat-input');
        if (miniInput && document.activeElement === miniInput) {
            e.preventDefault();
            window.handleSendMiniChat();
        }
    }
});

// ==========================================
// Floating Chat Bubble + Mini Chat Panel
// ==========================================

async function renderChatBubble() {
    const user = await getCurrentUser();
    const conversations = user ? await getChatConversations() : [];

    const convoOptions = conversations.map(c => {
        const label = c.type === 'team' ? 'Team Chat' : c.name;
        return `<option value="${c.id}" ${c.id === miniChatConvoId ? 'selected' : ''}>${sanitize(label)}</option>`;
    }).join('');

    return `
    <div class="chat-fab" id="chat-fab" onclick="toggleMiniChat()">
      <span class="chat-fab-icon">${icons.chat}</span>
    </div>
    <div class="mini-chat-panel" id="mini-chat-panel">
      <div class="mini-chat-header">
        <select class="mini-chat-convo-select" id="mini-chat-convo-select" onchange="switchMiniChatConvo(this.value)">
          ${convoOptions}
        </select>
        <div style="display:flex;gap:6px;">
          <button class="btn-icon" onclick="navigateTo('chat');closeMiniChat();" title="Open full chat">${icons.arrowLeft}</button>
          <button class="btn-icon" onclick="closeMiniChat()" title="Close">${icons.close}</button>
        </div>
      </div>
      <div class="mini-chat-messages" id="mini-chat-messages">
        <div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.82rem;">Loading...</div>
      </div>
      <div class="mini-chat-input-bar">
        <input type="text" class="chat-input" id="mini-chat-input" placeholder="Type a message..." autocomplete="off" />
        <button class="btn btn-primary btn-sm" onclick="handleSendMiniChat()">${icons.send}</button>
      </div>
    </div>
  `;
}

window.toggleMiniChat = async function () {
    const panel = document.getElementById('mini-chat-panel');
    const fab = document.getElementById('chat-fab');
    if (!panel) return;

    const isOpen = panel.classList.contains('open');
    if (isOpen) {
        panel.classList.remove('open');
        fab.classList.remove('active');
    } else {
        panel.classList.add('open');
        fab.classList.add('active');
        await loadMiniChatMessages();
    }
};

window.closeMiniChat = function () {
    const panel = document.getElementById('mini-chat-panel');
    const fab = document.getElementById('chat-fab');
    if (panel) panel.classList.remove('open');
    if (fab) fab.classList.remove('active');
};

window.switchMiniChatConvo = async function (convoId) {
    miniChatConvoId = convoId;
    await loadMiniChatMessages();
};

async function loadMiniChatMessages() {
    const container = document.getElementById('mini-chat-messages');
    if (!container) return;

    const user = await getCurrentUser();
    if (!user) return;

    const recipientId = miniChatConvoId === 'team' ? null : miniChatConvoId;
    const messages = await getChatMessages(50, recipientId);

    if (messages.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.82rem;">No messages yet. Say hi!</div>`;
    } else {
        container.innerHTML = messages.map(msg => {
            const isMe = msg.userId === user.id;
            const initials = getInitials(msg.userName);
            return `
            <div class="chat-message ${isMe ? 'chat-message-mine' : ''}">
              ${!isMe ? `<div class="chat-avatar" style="width:26px;height:26px;font-size:0.6rem;">${initials}</div>` : ''}
              <div class="chat-bubble ${isMe ? 'mine' : ''}">
                ${!isMe ? `<div class="chat-sender" style="font-size:0.72rem;">${sanitize(msg.userName)}</div>` : ''}
                <div class="chat-text" style="font-size:0.82rem;">${sanitize(msg.message)}</div>
                <div class="chat-time">${timeAgo(msg.createdAt)}</div>
              </div>
            </div>
          `;
        }).join('');
    }

    container.scrollTop = container.scrollHeight;
}

window.loadMiniChatMessages = loadMiniChatMessages;

window.handleSendMiniChat = async function () {
    const input = document.getElementById('mini-chat-input');
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    const recipientId = miniChatConvoId === 'team' ? null : miniChatConvoId;
    try {
        await sendChatMessage(message, recipientId);
        await loadMiniChatMessages();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

export { renderChat, renderChatBubble };
