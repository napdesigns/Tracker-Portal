// ==========================================
// CRM Tracker — Data Store (localStorage)
// ==========================================

const STORAGE_KEYS = {
    USERS: 'crm_users',
    TASKS: 'crm_tasks',
    SESSION: 'crm_session',
};

// --- Utility ---
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function formatDate(date) {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(date) {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function timeDiff(start, end) {
    if (!start || !end) return '—';
    const ms = new Date(end) - new Date(start);
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
}

// --- Sanitization ---
function sanitizeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- Seed Data ---
function seedData() {
    const users = getUsers();
    if (users.length === 0) {
        const defaultUsers = [
            {
                id: generateId(),
                name: 'Super Admin',
                email: 'superadmin@tracker.com',
                password: 'admin123',
                role: 'superadmin',
                createdAt: new Date().toISOString(),
            },
            {
                id: generateId(),
                name: 'Admin User',
                email: 'admin@tracker.com',
                password: 'admin123',
                role: 'admin',
                createdAt: new Date().toISOString(),
            },
            {
                id: generateId(),
                name: 'Safvan',
                email: 'safvan@tracker.com',
                password: 'freelancer123',
                role: 'freelancer',
                createdAt: new Date().toISOString(),
            },
        ];
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
    }
}

// --- Migration ---
function migrateTaskData() {
    const tasks = getTasks();
    let changed = false;
    tasks.forEach(t => {
        // Rename creative → referenceCreative
        if ('creative' in t && !('referenceCreative' in t)) {
            t.referenceCreative = t.creative;
            delete t.creative;
            changed = true;
        }
        // Add new fields if missing
        if (!('completedCreative' in t)) {
            t.completedCreative = null;
            changed = true;
        }
        if (!('completedCreativeAt' in t)) {
            t.completedCreativeAt = null;
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
}

// ==========================================
// Users CRUD
// ==========================================

function getUsers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
}

function getUserById(id) {
    return getUsers().find(u => u.id === id);
}

function getFreelancers() {
    return getUsers().filter(u => u.role === 'freelancer');
}

function getAdmins() {
    return getUsers().filter(u => u.role === 'admin' || u.role === 'superadmin');
}

function addUser(userData) {
    const users = getUsers();
    const exists = users.find(u => u.email === userData.email);
    if (exists) throw new Error('User with this email already exists');
    const user = {
        id: generateId(),
        ...userData,
        createdAt: new Date().toISOString(),
    };
    users.push(user);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return user;
}

function updateUser(id, data) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');
    users[index] = { ...users[index], ...data };
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return users[index];
}

function deleteUser(id) {
    const users = getUsers().filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

// ==========================================
// Auth
// ==========================================

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function login(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return null;
    const session = {
        userId: user.id,
        loginAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    return user;
}

function logout() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
}

function getCurrentUser() {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION) || 'null');
    if (!session) return null;

    // Check session expiration
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        logout();
        return null;
    }

    // Sliding window: extend session on activity
    if (session.expiresAt) {
        session.expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    }

    return getUserById(session.userId);
}

function isAdmin() {
    const user = getCurrentUser();
    return user && (user.role === 'admin' || user.role === 'superadmin');
}

function isSuperAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'superadmin';
}

// ==========================================
// Tasks CRUD
// ==========================================

function getTasks() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');
}

function getTaskById(id) {
    return getTasks().find(t => t.id === id);
}

function getTasksByMonth(month) {
    return getTasks().filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === month;
    });
}

function getTasksByFreelancer(freelancerId) {
    return getTasks().filter(t => t.assignedTo === freelancerId);
}

function addTask(taskData) {
    const tasks = getTasks();
    const maxSlNo = tasks.length > 0 ? Math.max(...tasks.map(t => t.slNo || 0)) : 0;
    const task = {
        id: generateId(),
        slNo: maxSlNo + 1,
        date: taskData.date || new Date().toISOString().split('T')[0],
        client: taskData.client || '',
        type: taskData.type || 'Static',
        referenceCreative: taskData.referenceCreative || null,
        completedCreative: null,
        completedCreativeAt: null,
        editableFileShared: taskData.editableFileShared || 'No',
        creativeStatus: 'Pending',
        amount: taskData.amount || 0,
        paymentStatus: taskData.paymentStatus || 'Unpaid',
        assignedTo: taskData.assignedTo || null,
        assignedBy: taskData.assignedBy || null,
        dueDate: taskData.dueDate || null,
        status: 'assigned',
        assignedAt: new Date().toISOString(),
        pickedUpAt: null,
        submittedAt: null,
        month: new Date(taskData.date || Date.now()).getMonth(),
        iterations: [],
    };
    tasks.push(task);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    return task;
}

function updateTask(id, data) {
    const tasks = getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Task not found');
    tasks[index] = { ...tasks[index], ...data };
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    return tasks[index];
}

function deleteTask(id) {
    const tasks = getTasks().filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
}

// Task lifecycle actions
function pickUpTask(taskId) {
    return updateTask(taskId, {
        status: 'in_progress',
        pickedUpAt: new Date().toISOString(),
    });
}

function uploadCompletedCreative(taskId, creativeBase64) {
    return updateTask(taskId, {
        completedCreative: creativeBase64,
        completedCreativeAt: new Date().toISOString(),
    });
}

function submitTask(taskId) {
    const task = getTaskById(taskId);
    if (!task) throw new Error('Task not found');
    if (!task.completedCreative) throw new Error('Please upload a completed creative before submitting');
    return updateTask(taskId, {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
    });
}

function approveTask(taskId) {
    return updateTask(taskId, {
        status: 'approved',
        creativeStatus: 'Approved',
    });
}

function requestIteration(taskId, reason, blame) {
    const task = getTaskById(taskId);
    if (!task) throw new Error('Task not found');
    const iteration = {
        id: generateId(),
        number: (task.iterations || []).length + 1,
        reason: reason,
        blame: blame, // 'freelancer', 'admin', 'client'
        requestedAt: new Date().toISOString(),
        resolvedAt: null,
    };
    const iterations = [...(task.iterations || []), iteration];
    return updateTask(taskId, {
        status: 'iteration',
        creativeStatus: 'Iteration',
        iterations,
        pickedUpAt: null,
        submittedAt: null,
    });
}

function rejectTask(taskId, reason) {
    return updateTask(taskId, {
        status: 'rejected',
        creativeStatus: 'Rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason || '',
    });
}

function resolveIteration(taskId) {
    const task = getTaskById(taskId);
    if (!task) throw new Error('Task not found');
    const iterations = [...(task.iterations || [])];
    if (iterations.length > 0) {
        iterations[iterations.length - 1].resolvedAt = new Date().toISOString();
    }
    return updateTask(taskId, { iterations });
}

// ==========================================
// Stats / Aggregations
// ==========================================

function getStats(tasks) {
    const totalTasks = tasks.length;
    const totalAmount = tasks.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const approved = tasks.filter(t => t.status === 'approved').length;
    const pendingPayments = tasks.filter(t => t.paymentStatus === 'Unpaid' || t.paymentStatus === 'Pending').length;
    const totalIterations = tasks.reduce((sum, t) => sum + (t.iterations || []).length, 0);
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const submitted = tasks.filter(t => t.status === 'submitted').length;
    const assigned = tasks.filter(t => t.status === 'assigned').length;

    return {
        totalTasks, totalAmount, approved, pendingPayments,
        totalIterations, inProgress, submitted, assigned,
    };
}

function getFreelancerStats(freelancerId) {
    const tasks = getTasksByFreelancer(freelancerId);
    return getStats(tasks);
}

// ==========================================
// Months
// ==========================================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export {
    STORAGE_KEYS, MONTHS,
    generateId, formatDate, formatDateTime, timeDiff, sanitizeHTML,
    seedData, migrateTaskData,
    getUsers, getUserById, getFreelancers, getAdmins, addUser, updateUser, deleteUser,
    login, logout, getCurrentUser, isAdmin, isSuperAdmin,
    getTasks, getTaskById, getTasksByMonth, getTasksByFreelancer,
    addTask, updateTask, deleteTask,
    pickUpTask, uploadCompletedCreative, submitTask, approveTask, rejectTask, requestIteration, resolveIteration,
    getStats, getFreelancerStats,
};
