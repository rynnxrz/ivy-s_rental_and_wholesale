-- Add retry_count to system_errors
alter table system_errors 
add column if not exists retry_count int default 0;
