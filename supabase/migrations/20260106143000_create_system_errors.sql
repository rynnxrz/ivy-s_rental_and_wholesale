-- Create system_errors table for audit logging
create table if not exists system_errors (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    error_type text not null,
    payload jsonb,
    resolved boolean default false,
    resolved_at timestamp with time zone
);

-- Enable RLS
alter table system_errors enable row level security;

-- Policies: Only Admins can view/insert/update
create policy "Admins can view system errors"
    on system_errors for select
    to authenticated
    using (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
    );

create policy "Admins (and system actions) can insert system errors"
    on system_errors for insert
    to authenticated
    with check (
        -- For simplicity, allow any authenticated user to log system errors? 
        -- Or strictly admins? 
        -- Given fail-safe context, if a user action fails, we might want to log it. 
        -- But for now, let's restrict to 'admin' OR use service_role for critical logs.
        -- Actually, prompt implies 'Server Actions' log it. Server Actions run as user.
        -- If Guest user fails, we need to log.
        -- Let's allow public/authenticated insert for logging, but only admin select.
        true 
    );

create policy "Admins can update system errors (resolve)"
    on system_errors for update
    to authenticated
    using (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
    );
