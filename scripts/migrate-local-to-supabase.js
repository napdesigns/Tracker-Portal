// ==========================================
// Migrate localStorage data → Supabase
// ==========================================
// Usage: Run this in the browser console while logged in as admin,
// OR import and call migrateLocalToSupabase() from the app.

import { supabase } from '../src/supabase.js';

export async function migrateLocalToSupabase() {
    console.log('=== Starting localStorage → Supabase migration ===');

    // 1. Check auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        console.error('Not logged in! Please log in as an admin first.');
        return { success: false, error: 'Not authenticated' };
    }

    // 2. Read local data
    const localUsers = JSON.parse(localStorage.getItem('crm_users') || '[]');
    const localTasks = JSON.parse(localStorage.getItem('crm_tasks') || '[]');

    console.log(`Found ${localUsers.length} local users, ${localTasks.length} local tasks`);

    if (localTasks.length === 0) {
        console.log('No local tasks to migrate.');
        return { success: true, migrated: 0 };
    }

    // 3. Fetch Supabase profiles to map local user IDs → Supabase UUIDs
    const { data: supaProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('*');

    if (profileError) {
        console.error('Failed to fetch profiles:', profileError.message);
        return { success: false, error: profileError.message };
    }

    console.log(`Found ${supaProfiles.length} Supabase profiles`);

    // Build mapping: local user email → Supabase UUID
    const emailToUUID = {};
    for (const p of supaProfiles) {
        emailToUUID[p.email] = p.id;
    }

    // Build mapping: local user ID → Supabase UUID (via email)
    const localIdToUUID = {};
    for (const lu of localUsers) {
        if (emailToUUID[lu.email]) {
            localIdToUUID[lu.id] = emailToUUID[lu.email];
            console.log(`  Mapped: ${lu.name} (${lu.email}) → ${emailToUUID[lu.email]}`);
        } else {
            console.warn(`  No Supabase match for local user: ${lu.name} (${lu.email})`);
        }
    }

    // 4. Insert tasks one by one (to handle errors gracefully)
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const task of localTasks) {
        const assignedTo = task.assignedTo ? localIdToUUID[task.assignedTo] || null : null;
        const assignedBy = task.assignedBy ? localIdToUUID[task.assignedBy] || null : null;

        // Prepare task data for Supabase (snake_case)
        const taskInsert = {
            date: task.date || new Date().toISOString().split('T')[0],
            client: task.client || '',
            type: task.type || 'Static',
            reference_creative: task.referenceCreative || null,
            completed_creative: task.completedCreative || null,
            completed_creative_at: task.completedCreativeAt || null,
            editable_file_shared: task.editableFileShared || 'No',
            creative_status: task.creativeStatus || 'Pending',
            amount: parseFloat(task.amount) || 0,
            payment_status: task.paymentStatus || 'Unpaid',
            assigned_to: assignedTo,
            assigned_by: assignedBy,
            status: task.status || 'assigned',
            assigned_at: task.assignedAt || new Date().toISOString(),
            picked_up_at: task.pickedUpAt || null,
            submitted_at: task.submittedAt || null,
            rejected_at: task.rejectedAt || null,
            rejection_reason: task.rejectionReason || null,
        };

        // Skip base64 images (too large for DB text column, should use Storage)
        if (taskInsert.reference_creative && taskInsert.reference_creative.startsWith('data:')) {
            console.warn(`  Task #${task.slNo} "${task.client}": Skipping base64 reference_creative (use Storage instead)`);
            taskInsert.reference_creative = null;
        }
        if (taskInsert.completed_creative && taskInsert.completed_creative.startsWith('data:')) {
            console.warn(`  Task #${task.slNo} "${task.client}": Skipping base64 completed_creative (use Storage instead)`);
            taskInsert.completed_creative = null;
        }

        const { data: insertedTask, error: taskError } = await supabase
            .from('tasks')
            .insert(taskInsert)
            .select()
            .single();

        if (taskError) {
            console.error(`  FAILED Task #${task.slNo} "${task.client}":`, taskError.message);
            errors++;
            continue;
        }

        console.log(`  Migrated Task #${task.slNo} "${task.client}" → ${insertedTask.id}`);
        migrated++;

        // 5. Insert iterations for this task
        const iterations = task.iterations || [];
        for (const iter of iterations) {
            const { error: iterError } = await supabase
                .from('iterations')
                .insert({
                    task_id: insertedTask.id,
                    number: iter.number,
                    reason: iter.reason || '',
                    blame: iter.blame || 'freelancer',
                    requested_at: iter.requestedAt || new Date().toISOString(),
                    resolved_at: iter.resolvedAt || null,
                });

            if (iterError) {
                console.error(`    FAILED iteration #${iter.number}:`, iterError.message);
            } else {
                console.log(`    Migrated iteration #${iter.number}`);
            }
        }
    }

    const summary = `
=== Migration Complete ===
  Tasks migrated: ${migrated}
  Tasks with errors: ${errors}
  Total local tasks: ${localTasks.length}
`;
    console.log(summary);

    return { success: true, migrated, errors, total: localTasks.length };
}

// Make it available globally for browser console usage
if (typeof window !== 'undefined') {
    window.migrateLocalToSupabase = migrateLocalToSupabase;
}
