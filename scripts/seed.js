// ==========================================
// CRM Tracker — Seed Script
// Creates demo users in Supabase Auth + profiles table
//
// Usage:
//   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars, then:
//   node scripts/seed.js
// ==========================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_USERS = [
    { email: 'superadmin@tracker.com', password: 'admin123', name: 'Super Admin', role: 'superadmin' },
    { email: 'admin@tracker.com', password: 'admin123', name: 'Admin User', role: 'admin' },
    { email: 'safvan@tracker.com', password: 'freelancer123', name: 'Safvan', role: 'freelancer' },
];

async function seed() {
    console.log('Seeding demo users...\n');

    for (const user of DEMO_USERS) {
        // Check if user already exists
        const { data: existingUsers } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', user.email)
            .limit(1);

        if (existingUsers && existingUsers.length > 0) {
            console.log(`  [skip] ${user.email} already exists`);
            continue;
        }

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
        });

        if (authError) {
            console.error(`  [error] Failed to create auth user ${user.email}:`, authError.message);
            continue;
        }

        // Insert profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authData.user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            });

        if (profileError) {
            console.error(`  [error] Failed to create profile for ${user.email}:`, profileError.message);
            continue;
        }

        console.log(`  [ok] Created ${user.role}: ${user.email}`);
    }

    console.log('\nSeed complete!');
    console.log('\nDemo credentials:');
    console.log('  Super Admin: superadmin@tracker.com / admin123');
    console.log('  Admin:       admin@tracker.com / admin123');
    console.log('  Freelancer:  safvan@tracker.com / freelancer123');
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
