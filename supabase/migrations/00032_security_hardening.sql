-- Address lint findings:
-- 1) Harden function search_path to avoid role-dependent execution contexts
-- 2) Move extensions out of public schema
-- 3) Enable RLS on staging_products

-- Ensure extensions schema exists and move btree_gist out of public
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
        EXECUTE 'ALTER EXTENSION btree_gist SET SCHEMA extensions';
    END IF;
END
$$;

-- Lock down function search_path (lint 0011_function_search_path_mutable)
DO $$
DECLARE
    fn TEXT;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'public.get_available_items_v2(date,date,boolean)',
        'public.update_import_jobs_updated_at()',
        'public.is_admin()',
        'public.commit_staging_batch(uuid)',
        'public.get_unavailable_date_ranges(uuid)',
        'public.check_item_availability(uuid,date,date,uuid)',
        'public.get_available_items(date,date)',
        'public.update_billing_profiles_updated_at()',
        'public.restore_reservation(uuid)'
    ] LOOP
        IF to_regprocedure(fn) IS NOT NULL THEN
            EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
        END IF;
    END LOOP;
END
$$;

-- Protect staging_products with RLS (lint 0013_rls_disabled_in_public)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staging_products'
    ) THEN
        EXECUTE 'ALTER TABLE public.staging_products ENABLE ROW LEVEL SECURITY';
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'staging_products'
              AND policyname = 'Admin full access to staging_products'
        ) THEN
            EXECUTE 'CREATE POLICY "Admin full access to staging_products" ON public.staging_products FOR ALL USING (is_admin())';
        END IF;
    END IF;
END
$$;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
