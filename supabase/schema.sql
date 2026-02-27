-- ==========================================
-- CRM Tracker Portal — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- Profiles Table
-- ==========================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'freelancer')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Tasks Table
-- ==========================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sl_no SERIAL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    client TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'Static' CHECK (type IN ('Static', 'Animated', 'Video', 'Carousel', 'Reels', 'Logo', 'Branding', 'Other')),
    reference_creative TEXT,  -- Storage URL or null
    completed_creative TEXT,  -- Storage URL or null
    completed_creative_at TIMESTAMPTZ,
    editable_file_shared TEXT NOT NULL DEFAULT 'No' CHECK (editable_file_shared IN ('Yes', 'No')),
    creative_status TEXT NOT NULL DEFAULT 'Pending' CHECK (creative_status IN ('Pending', 'Approved', 'Iteration', 'Rejected')),
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Pending', 'Paid')),
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'submitted', 'approved', 'iteration', 'rejected')),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    picked_up_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    due_date DATE,
    description TEXT DEFAULT '',
    source_link TEXT DEFAULT '',
    month INTEGER GENERATED ALWAYS AS (EXTRACT(MONTH FROM date)::INTEGER - 1) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Iterations Table (normalized from JSON array)
-- ==========================================
CREATE TABLE IF NOT EXISTS iterations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    blame TEXT NOT NULL DEFAULT 'freelancer' CHECK (blame IN ('freelancer', 'admin', 'client')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Index for fast iteration lookups
CREATE INDEX IF NOT EXISTS idx_iterations_task_id ON iterations(task_id);

-- ==========================================
-- Notifications Table
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast notification lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ==========================================
-- Activity Log Table
-- ==========================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'task',
    entity_id TEXT,
    details TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast activity log lookups
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- ==========================================
-- Auto-update updated_at trigger
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- Storage Bucket for Creatives
-- ==========================================
-- Run this in Supabase Dashboard > Storage, or via SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('creatives', 'creatives', true, 5242880)  -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- Row Level Security (RLS) Policies
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: all authenticated users can read all profiles
CREATE POLICY "Profiles are viewable by authenticated users"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);

-- Profiles: users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Tasks: admins can see all tasks, freelancers can see assigned tasks
CREATE POLICY "Admins can view all tasks"
    ON tasks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Freelancers can view assigned tasks"
    ON tasks FOR SELECT
    TO authenticated
    USING (assigned_to = auth.uid());

-- Tasks: admins can insert/update/delete
CREATE POLICY "Admins can insert tasks"
    ON tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Admins can update all tasks"
    ON tasks FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Freelancers can update assigned tasks"
    ON tasks FOR UPDATE
    TO authenticated
    USING (assigned_to = auth.uid());

CREATE POLICY "Admins can delete tasks"
    ON tasks FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

-- Iterations: follow task access
CREATE POLICY "Users can view iterations for accessible tasks"
    ON iterations FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = iterations.task_id
            AND (
                tasks.assigned_to = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'superadmin')
                )
            )
        )
    );

CREATE POLICY "Authenticated users can insert iterations"
    ON iterations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update iterations"
    ON iterations FOR UPDATE
    TO authenticated
    USING (true);

-- Notifications: users can only see their own
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications"
    ON notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Activity Log: admins can view all, freelancers can view their own
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity logs"
    ON activity_log FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Freelancers can view own activity logs"
    ON activity_log FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert activity logs"
    ON activity_log FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Storage: authenticated users can upload to creatives bucket
CREATE POLICY "Authenticated users can upload creatives"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'creatives');

CREATE POLICY "Anyone can view creatives"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'creatives');

CREATE POLICY "Authenticated users can update creatives"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'creatives');

CREATE POLICY "Authenticated users can delete creatives"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'creatives');
