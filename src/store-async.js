// ==========================================
// CRM Tracker — Async Store (Supabase Backend)
// ==========================================

import { supabase } from './supabase.js';

// Re-export utility constants and functions from sync store
import {
    STORAGE_KEYS, MONTHS,
    generateId, formatDate, formatDateTime, timeDiff, sanitizeHTML,
    seedData, migrateTaskData,
} from './store.js';

export {
    STORAGE_KEYS, MONTHS,
    generateId, formatDate, formatDateTime, timeDiff, sanitizeHTML,
    seedData, migrateTaskData,
};

// ==========================================
// camelCase <-> snake_case mappers
// ==========================================

function toSnakeCase(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(toSnakeCase);
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        result[snakeKey] = value;
    }
    return result;
}

function toCamelCase(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(toCamelCase);
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (key === 'iterations' && Array.isArray(value)) {
            result[camelKey] = value.map(toCamelCase);
        } else {
            result[camelKey] = value;
        }
    }
    return result;
}

function mapTaskFromDB(dbTask) {
    const task = toCamelCase(dbTask);
    // Ensure iterations is always an array
    if (!task.iterations) task.iterations = [];
    return task;
}

// ==========================================
// Check if Supabase is configured
// ==========================================

function isSupabaseConfigured() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    return url && url !== 'your-supabase-url-here' && url.includes('supabase');
}

// ==========================================
// Fallback imports (localStorage)
// ==========================================

import {
    getUsers as _getUsers, getUserById as _getUserById,
    getFreelancers as _getFreelancers, getAdmins as _getAdmins,
    addUser as _addUser, updateUser as _updateUser, deleteUser as _deleteUser,
    login as _login, logout as _logout, getCurrentUser as _getCurrentUser,
    isAdmin as _isAdmin, isSuperAdmin as _isSuperAdmin,
    getTasks as _getTasks, getTaskById as _getTaskById,
    getTasksByMonth as _getTasksByMonth, getTasksByFreelancer as _getTasksByFreelancer,
    addTask as _addTask, updateTask as _updateTask, deleteTask as _deleteTask,
    pickUpTask as _pickUpTask, uploadCompletedCreative as _uploadCompletedCreative,
    submitTask as _submitTask, approveTask as _approveTask, rejectTask as _rejectTask,
    requestIteration as _requestIteration, resolveIteration as _resolveIteration,
    getStats as _getStats, getFreelancerStats as _getFreelancerStats,
} from './store.js';

// ==========================================
// Auth (with in-memory cache to avoid repeated network calls)
// ==========================================

let _cachedUser = undefined; // undefined = not loaded yet, null = no session

export function clearUserCache() {
    _cachedUser = undefined;
}

export async function login(email, password) {
    if (!isSupabaseConfigured()) return _login(email, password);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) return null;

    // Fetch profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

    _cachedUser = profile ? toCamelCase(profile) : null;
    return _cachedUser;
}

export async function logout() {
    _cachedUser = null;
    if (!isSupabaseConfigured()) return _logout();
    await supabase.auth.signOut();
}

export async function getCurrentUser() {
    if (!isSupabaseConfigured()) return _getCurrentUser();

    // Return cache if available
    if (_cachedUser !== undefined) return _cachedUser;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        _cachedUser = null;
        return null;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    _cachedUser = profile ? toCamelCase(profile) : null;
    return _cachedUser;
}

export async function isAdmin() {
    const user = await getCurrentUser();
    return user && (user.role === 'admin' || user.role === 'superadmin');
}

export async function isSuperAdmin() {
    const user = await getCurrentUser();
    return user && user.role === 'superadmin';
}

// ==========================================
// Users
// ==========================================

export async function getUsers() {
    if (!isSupabaseConfigured()) return _getUsers();

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map(toCamelCase);
}

export async function getUserById(id) {
    if (!isSupabaseConfigured()) return _getUserById(id);

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return null;
    return data ? toCamelCase(data) : null;
}

export async function getFreelancers() {
    if (!isSupabaseConfigured()) return _getFreelancers();

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'freelancer')
        .order('name');

    if (error) throw new Error(error.message);
    return (data || []).map(toCamelCase);
}

export async function getAdmins() {
    if (!isSupabaseConfigured()) return _getAdmins();

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'superadmin'])
        .order('name');

    if (error) throw new Error(error.message);
    return (data || []).map(toCamelCase);
}

export async function addUser(userData) {
    if (!isSupabaseConfigured()) return _addUser(userData);

    // Call Edge Function (requires service role for auth user creation)
    const { data: { session } } = await supabase.auth.getSession();
    const response = await supabase.functions.invoke('create-user', {
        body: {
            email: userData.email,
            password: userData.password,
            name: userData.name,
            role: userData.role,
        },
    });

    if (response.error) throw new Error(response.error.message || 'Failed to create user');
    return toCamelCase(response.data);
}

export async function updateUser(id, data) {
    if (!isSupabaseConfigured()) return _updateUser(id, data);

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;

    const { data: profile, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return toCamelCase(profile);
}

export async function deleteUser(id) {
    if (!isSupabaseConfigured()) return _deleteUser(id);

    const response = await supabase.functions.invoke('delete-user', {
        body: { userId: id },
    });

    if (response.error) throw new Error(response.error.message || 'Failed to delete user');
}

// ==========================================
// Tasks
// ==========================================

export async function getTasks() {
    if (!isSupabaseConfigured()) return _getTasks();

    const { data, error } = await supabase
        .from('tasks')
        .select('*, iterations(*)')
        .order('sl_no', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map(mapTaskFromDB);
}

export async function getTaskById(id) {
    if (!isSupabaseConfigured()) return _getTaskById(id);

    const { data, error } = await supabase
        .from('tasks')
        .select('*, iterations(*)')
        .eq('id', id)
        .single();

    if (error) return null;
    return data ? mapTaskFromDB(data) : null;
}

export async function getTasksByMonth(month) {
    if (!isSupabaseConfigured()) return _getTasksByMonth(month);

    const { data, error } = await supabase
        .from('tasks')
        .select('*, iterations(*)')
        .eq('month', month)
        .order('sl_no', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map(mapTaskFromDB);
}

export async function getTasksByFreelancer(freelancerId) {
    if (!isSupabaseConfigured()) return _getTasksByFreelancer(freelancerId);

    const { data, error } = await supabase
        .from('tasks')
        .select('*, iterations(*)')
        .eq('assigned_to', freelancerId)
        .order('sl_no', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map(mapTaskFromDB);
}

export async function addTask(taskData) {
    if (!isSupabaseConfigured()) {
        const result = _addTask(taskData);
        // Notify assigned freelancer (localStorage mode)
        if (taskData.assignedTo) {
            try {
                await createNotification({
                    userId: taskData.assignedTo,
                    type: 'assigned',
                    title: 'New Task Assigned',
                    message: `You have been assigned a new task: "${taskData.client || 'Untitled'}"`,
                    taskId: result.id,
                });
            } catch (e) { console.warn('Notification error:', e); }
        }
        return result;
    }

    const insertData = {
        date: taskData.date || new Date().toISOString().split('T')[0],
        client: taskData.client || '',
        type: taskData.type || 'Static',
        reference_creative: taskData.referenceCreative || null,
        editable_file_shared: taskData.editableFileShared || 'No',
        amount: parseFloat(taskData.amount) || 0,
        payment_status: taskData.paymentStatus || 'Unpaid',
        assigned_to: taskData.assignedTo || null,
        assigned_by: taskData.assignedBy || null,
        due_date: taskData.dueDate || null,
        description: taskData.description || '',
        source_link: taskData.sourceLink || '',
        status: 'assigned',
        assigned_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
        .from('tasks')
        .insert(insertData)
        .select('*, iterations(*)')
        .single();

    // Retry without new columns if they don't exist in DB yet
    if (error && error.message && error.message.includes('column')) {
        delete insertData.description;
        delete insertData.source_link;
        ({ data, error } = await supabase
            .from('tasks')
            .insert(insertData)
            .select('*, iterations(*)')
            .single());
    }

    if (error) throw new Error(error.message);
    const task = mapTaskFromDB(data);

    // Notify assigned freelancer
    if (taskData.assignedTo) {
        try {
            await createNotification({
                userId: taskData.assignedTo,
                type: 'assigned',
                title: 'New Task Assigned',
                message: `You have been assigned a new task: "${taskData.client || 'Untitled'}"`,
                taskId: task.id,
            });
        } catch (e) { console.warn('Notification error:', e); }
    }

    logActivity({ action: 'task_created', entityType: 'task', entityId: task.id, details: `Created task "${taskData.client || 'Untitled'}"` }).catch(() => {});

    return task;
}

export async function updateTask(id, data) {
    if (!isSupabaseConfigured()) return _updateTask(id, data);

    // Convert camelCase keys to snake_case for DB
    const snakeData = toSnakeCase(data);
    // Remove fields that shouldn't be updated directly
    delete snakeData.id;
    delete snakeData.sl_no;
    delete snakeData.iterations;
    delete snakeData.created_at;
    delete snakeData.month; // generated column

    let { data: updated, error } = await supabase
        .from('tasks')
        .update(snakeData)
        .eq('id', id)
        .select('*, iterations(*)')
        .single();

    // Retry without new columns if they don't exist in DB yet
    if (error && error.message && error.message.includes('column')) {
        delete snakeData.description;
        delete snakeData.source_link;
        ({ data: updated, error } = await supabase
            .from('tasks')
            .update(snakeData)
            .eq('id', id)
            .select('*, iterations(*)')
            .single());
    }

    if (error) throw new Error(error.message);
    return mapTaskFromDB(updated);
}

export async function deleteTask(id) {
    if (!isSupabaseConfigured()) {
        _deleteTask(id);
        logActivity({ action: 'task_deleted', entityType: 'task', entityId: id, details: `Deleted task` }).catch(() => {});
        return;
    }

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
    logActivity({ action: 'task_deleted', entityType: 'task', entityId: id, details: `Deleted task` }).catch(() => {});
}

// ==========================================
// Task Lifecycle
// ==========================================

export async function pickUpTask(taskId) {
    const result = await updateTask(taskId, {
        status: 'in_progress',
        pickedUpAt: new Date().toISOString(),
    });
    logActivity({ action: 'task_picked_up', entityType: 'task', entityId: taskId, details: `Picked up task #${result.slNo}` }).catch(() => {});
    return result;
}

export async function uploadCompletedCreative(taskId, creativeUrl) {
    return updateTask(taskId, {
        completedCreative: creativeUrl,
        completedCreativeAt: new Date().toISOString(),
    });
}

export async function submitTask(taskId) {
    const task = await getTaskById(taskId);
    if (!task) throw new Error('Task not found');
    if (!task.completedCreative) throw new Error('Please upload a completed creative before submitting');
    const result = await updateTask(taskId, {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
    });

    // Notify all admins
    try {
        const admins = await getAdmins();
        for (const admin of admins) {
            await createNotification({
                userId: admin.id,
                type: 'submitted',
                title: 'Task Submitted',
                message: `Task #${task.slNo} "${task.client}" has been submitted for review.`,
                taskId,
            });
        }
    } catch (e) { console.warn('Notification error:', e); }

    logActivity({ action: 'task_submitted', entityType: 'task', entityId: taskId, details: `Submitted task #${task.slNo} "${task.client}"` }).catch(() => {});

    return result;
}

export async function approveTask(taskId) {
    const task = await getTaskById(taskId);
    const result = await updateTask(taskId, {
        status: 'approved',
        creativeStatus: 'Approved',
    });

    // Notify freelancer
    if (task && task.assignedTo) {
        try {
            await createNotification({
                userId: task.assignedTo,
                type: 'approved',
                title: 'Task Approved',
                message: `Task #${task.slNo} "${task.client}" has been approved!`,
                taskId,
            });
        } catch (e) { console.warn('Notification error:', e); }
    }

    logActivity({ action: 'task_approved', entityType: 'task', entityId: taskId, details: `Approved task #${task.slNo} "${task.client}"` }).catch(() => {});

    return result;
}

export async function rejectTask(taskId, reason) {
    const task = await getTaskById(taskId);
    const result = await updateTask(taskId, {
        status: 'rejected',
        creativeStatus: 'Rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason || '',
    });

    // Notify freelancer
    if (task && task.assignedTo) {
        try {
            await createNotification({
                userId: task.assignedTo,
                type: 'rejected',
                title: 'Task Rejected',
                message: `Task #${task.slNo} "${task.client}" was rejected.${reason ? ' Reason: ' + reason : ''}`,
                taskId,
            });
        } catch (e) { console.warn('Notification error:', e); }
    }

    logActivity({ action: 'task_rejected', entityType: 'task', entityId: taskId, details: `Rejected task #${task.slNo} "${task.client}"${reason ? '. Reason: ' + reason : ''}` }).catch(() => {});

    return result;
}

export async function requestIteration(taskId, reason, blame) {
    if (!isSupabaseConfigured()) {
        const result = _requestIteration(taskId, reason, blame);
        // Notify freelancer
        if (result && result.assignedTo) {
            try {
                await createNotification({
                    userId: result.assignedTo,
                    type: 'iteration',
                    title: 'Iteration Requested',
                    message: `Task #${result.slNo} "${result.client}" needs revision. Reason: ${reason}`,
                    taskId,
                });
            } catch (e) { console.warn('Notification error:', e); }
        }
        return result;
    }

    const task = await getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    const iterNumber = (task.iterations || []).length + 1;

    // Insert iteration record
    const { error: iterError } = await supabase
        .from('iterations')
        .insert({
            task_id: taskId,
            number: iterNumber,
            reason: reason,
            blame: blame,
            requested_at: new Date().toISOString(),
        });

    if (iterError) throw new Error(iterError.message);

    // Update task status
    const result = await updateTask(taskId, {
        status: 'iteration',
        creativeStatus: 'Iteration',
        pickedUpAt: null,
        submittedAt: null,
    });

    // Notify freelancer
    if (task.assignedTo) {
        try {
            await createNotification({
                userId: task.assignedTo,
                type: 'iteration',
                title: 'Iteration Requested',
                message: `Task #${task.slNo} "${task.client}" needs revision. Reason: ${reason}`,
                taskId,
            });
        } catch (e) { console.warn('Notification error:', e); }
    }

    logActivity({ action: 'iteration_requested', entityType: 'task', entityId: taskId, details: `Requested iteration on task #${task.slNo} "${task.client}" (blame: ${blame}). Reason: ${reason}` }).catch(() => {});

    return result;
}

export async function resolveIteration(taskId) {
    if (!isSupabaseConfigured()) return _resolveIteration(taskId);

    // Find the latest unresolved iteration
    const { data: iterations, error } = await supabase
        .from('iterations')
        .select('*')
        .eq('task_id', taskId)
        .is('resolved_at', null)
        .order('number', { ascending: false })
        .limit(1);

    if (error) throw new Error(error.message);

    if (iterations && iterations.length > 0) {
        const { error: updateError } = await supabase
            .from('iterations')
            .update({ resolved_at: new Date().toISOString() })
            .eq('id', iterations[0].id);

        if (updateError) throw new Error(updateError.message);
    }

    logActivity({ action: 'iteration_resolved', entityType: 'task', entityId: taskId, details: `Resolved iteration on task` }).catch(() => {});
}

// ==========================================
// Image Upload to Supabase Storage
// ==========================================

export async function uploadCreativeFile(file, taskId, type) {
    if (!isSupabaseConfigured()) return null; // Falls back to base64 in localStorage mode

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${taskId}/${type}_${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
        .from('creatives')
        .upload(path, file, {
            cacheControl: '3600',
            upsert: true,
        });

    if (error) throw new Error(error.message);

    const { data: urlData } = supabase.storage
        .from('creatives')
        .getPublicUrl(data.path);

    if (!urlData || !urlData.publicUrl) throw new Error('Failed to get public URL for uploaded file');
    return urlData.publicUrl;
}

// ==========================================
// Stats / Aggregations
// ==========================================

export async function getStats(tasks) {
    // Stats are computed client-side from the provided tasks array
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

export async function getFreelancerStats(freelancerId) {
    const tasks = await getTasksByFreelancer(freelancerId);
    return getStats(tasks);
}

// ==========================================
// Notifications
// ==========================================

// In-memory notification store for localStorage mode
const LOCAL_NOTIFICATIONS_KEY = 'crm_notifications';

function getLocalNotifications() {
    return JSON.parse(localStorage.getItem(LOCAL_NOTIFICATIONS_KEY) || '[]');
}

function saveLocalNotifications(notifications) {
    localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

export async function getNotifications(userId) {
    if (!isSupabaseConfigured()) {
        return getLocalNotifications()
            .filter(n => n.userId === userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 50);
    }

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw new Error(error.message);
    return (data || []).map(toCamelCase);
}

export async function getUnreadCount(userId) {
    if (!isSupabaseConfigured()) {
        return getLocalNotifications()
            .filter(n => n.userId === userId && !n.isRead)
            .length;
    }

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) throw new Error(error.message);
    return count || 0;
}

export async function markNotificationRead(notifId) {
    if (!isSupabaseConfigured()) {
        const notifs = getLocalNotifications();
        const n = notifs.find(n => n.id === notifId);
        if (n) n.isRead = true;
        saveLocalNotifications(notifs);
        return;
    }

    await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);
}

export async function markAllNotificationsRead(userId) {
    if (!isSupabaseConfigured()) {
        const notifs = getLocalNotifications();
        notifs.forEach(n => { if (n.userId === userId) n.isRead = true; });
        saveLocalNotifications(notifs);
        return;
    }

    await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
}

export async function createNotification({ userId, type, title, message, taskId }) {
    if (!isSupabaseConfigured()) {
        const notifs = getLocalNotifications();
        notifs.push({
            id: generateId(),
            userId,
            type: type || 'info',
            title,
            message: message || '',
            taskId: taskId || null,
            isRead: false,
            createdAt: new Date().toISOString(),
        });
        saveLocalNotifications(notifs);
        return;
    }

    await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            type: type || 'info',
            title,
            message: message || '',
            task_id: taskId || null,
        });
}

// ==========================================
// Activity Log
// ==========================================

const LOCAL_ACTIVITY_KEY = 'crm_activity_log';

function getLocalActivityLog() {
    return JSON.parse(localStorage.getItem(LOCAL_ACTIVITY_KEY) || '[]');
}

function saveLocalActivityLog(log) {
    localStorage.setItem(LOCAL_ACTIVITY_KEY, JSON.stringify(log));
}

export async function logActivity({ action, entityType, entityId, details }) {
    const user = await getCurrentUser();
    const entry = {
        userId: user ? user.id : null,
        userName: user ? user.name : 'System',
        action,
        entityType: entityType || 'task',
        entityId: entityId || null,
        details: details || '',
        createdAt: new Date().toISOString(),
    };

    if (!isSupabaseConfigured()) {
        const log = getLocalActivityLog();
        log.push({ id: generateId(), ...entry });
        saveLocalActivityLog(log);
        return;
    }

    await supabase.from('activity_log').insert({
        user_id: entry.userId,
        user_name: entry.userName,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        details: entry.details,
    }).then(() => {}).catch(e => console.warn('Activity log error:', e));
}

// ==========================================
// Task Comments
// ==========================================

const LOCAL_COMMENTS_KEY = 'crm_task_comments';

function getLocalComments() {
    return JSON.parse(localStorage.getItem(LOCAL_COMMENTS_KEY) || '[]');
}

function saveLocalComments(comments) {
    localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(comments));
}

export async function getTaskComments(taskId) {
    if (!isSupabaseConfigured()) {
        return getLocalComments()
            .filter(c => c.taskId === taskId)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

    if (error) {
        console.warn('Comments table not available:', error.message);
        return [];
    }
    return (data || []).map(toCamelCase);
}

export async function addTaskComment({ taskId, message }) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    if (!isSupabaseConfigured()) {
        const comments = getLocalComments();
        const comment = {
            id: generateId(),
            taskId,
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            message,
            createdAt: new Date().toISOString(),
        };
        comments.push(comment);
        saveLocalComments(comments);
        return comment;
    }

    const { data, error } = await supabase
        .from('task_comments')
        .insert({
            task_id: taskId,
            user_id: user.id,
            user_name: user.name,
            user_role: user.role,
            message,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return toCamelCase(data);
}

export async function deleteTaskComment(commentId) {
    if (!isSupabaseConfigured()) {
        const comments = getLocalComments().filter(c => c.id !== commentId);
        saveLocalComments(comments);
        return;
    }

    const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

    if (error) throw new Error(error.message);
}

// ==========================================
// Chat Messages
// ==========================================

const LOCAL_CHAT_KEY = 'crm_chat_messages';

function getLocalChatMessages() {
    return JSON.parse(localStorage.getItem(LOCAL_CHAT_KEY) || '[]');
}

function saveLocalChatMessages(msgs) {
    localStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify(msgs));
}

export async function getChatMessages(limit = 100) {
    if (!isSupabaseConfigured()) {
        return getLocalChatMessages()
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .slice(-limit);
    }

    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) {
        console.warn('Chat table not available:', error.message);
        return [];
    }
    return (data || []).map(toCamelCase);
}

export async function sendChatMessage(message) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    if (!isSupabaseConfigured()) {
        const msgs = getLocalChatMessages();
        const msg = {
            id: generateId(),
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            message,
            createdAt: new Date().toISOString(),
        };
        msgs.push(msg);
        saveLocalChatMessages(msgs);
        return msg;
    }

    const { data, error } = await supabase
        .from('chat_messages')
        .insert({
            user_id: user.id,
            user_name: user.name,
            user_role: user.role,
            message,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return toCamelCase(data);
}

export async function getActivityLog(limit = 100) {
    if (!isSupabaseConfigured()) {
        return getLocalActivityLog()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);
    }

    const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.warn('Activity log table not available:', error.message);
        return [];
    }
    return (data || []).map(toCamelCase);
}
