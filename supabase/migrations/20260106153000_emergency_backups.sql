-- Emergency backups for failed submissions
create table if not exists emergency_backups (
    id uuid primary key default gen_random_uuid(),
    payload jsonb not null,
    fingerprint text unique not null,
    created_at timestamptz default now()
);

alter table emergency_backups enable row level security;

create policy "Admins can view backups"
    on emergency_backups for select
    to authenticated
    using (true);

create policy "Anyone can insert backups"
    on emergency_backups for insert
    to public
    with check (true);

create or replace function save_emergency_backup(payload jsonb, fingerprint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into emergency_backups (payload, fingerprint)
    values (payload, fingerprint)
    on conflict (fingerprint) do nothing;
end;
$$;

grant execute on function save_emergency_backup(jsonb, text) to anon, authenticated;
