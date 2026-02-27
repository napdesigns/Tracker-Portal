// ==========================================
// Supabase Edge Function — Delete User
// Deletes auth user + profile (requires admin role)
// ==========================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Verify caller is admin
        const anonClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user: caller } } = await anonClient.auth.getUser();
        if (!caller) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: callerProfile } = await anonClient
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .single();

        if (!callerProfile || !['admin', 'superadmin'].includes(callerProfile.role)) {
            return new Response(JSON.stringify({ error: 'Admin access required' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse request body
        const { userId } = await req.json();
        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing required field: userId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Prevent self-deletion
        if (userId === caller.id) {
            return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Check target user's role
        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: targetProfile } = await serviceClient
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!targetProfile) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Only superadmin can delete admins
        if (['admin', 'superadmin'].includes(targetProfile.role) && callerProfile.role !== 'superadmin') {
            return new Response(JSON.stringify({ error: 'Only super admins can delete admin users' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Delete profile (cascades from auth via FK)
        const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);

        if (deleteError) {
            return new Response(JSON.stringify({ error: deleteError.message }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
