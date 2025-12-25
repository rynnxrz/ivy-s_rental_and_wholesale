-- ============================================================
-- VERIFICATION SCRIPT: The "Crash Test"
-- Run this in Supabase SQL Editor to prove the constraints work.
-- ============================================================

DO $$
DECLARE
  v_item_id UUID;
  v_customer_id UUID;
  v_reservation_id UUID;
BEGIN
  -- 1. SETUP: Create a dummy item
  INSERT INTO items (sku, name, rental_price, replacement_cost, status)
  VALUES ('TEST-SKU-001', 'Test Item for Crash Test', 10.00, 100.00, 'active')
  RETURNING id INTO v_item_id;
  
  -- Create a dummy profile (requires a user in auth.users ideally, but for pure table logic we might need to mock or just rely on existing if testing RLS, 
  -- BUT for exclusion constraints, we strictly need valid FKs. 
  -- IMPORTANT: `profiles` references `auth.users`. 
  -- If you are running this in SQL Editor, you might not have a user handy.
  -- Strategy: We'll assume the user running this has at least one valid user ID or we insert a fake one only if no FK constraint blocks us.
  -- Ideally, pick a real user ID from auth.users or create a fake one if constraints allow (which they don't usually).
  
  -- SIMPLIFICATION For Verification:
  -- We'll assume YOU (the person running this) have a valid User ID.
  -- Replace 'THE_UUID_BELOW' with a real User UUID from your auth.users table if needed, 
  -- OR, if you are just testing logic, we can try to insert a fake auth user if we have permissions.
  
  -- Actually, let's try to grab the first user we find, or fail.
  SELECT id INTO v_customer_id FROM auth.users LIMIT 1;
  
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'No users found in auth.users. Please sign up a user first to run this test.';
  END IF;

  RAISE NOTICE 'Using Test Item: %', v_item_id;
  RAISE NOTICE 'Using Customer: %', v_customer_id;

  -- 2. POSITIVE TEST: Confirm a reservation (Jan 1 - Jan 5)
  INSERT INTO reservations (item_id, customer_id, start_at, end_at, status)
  VALUES (v_item_id, v_customer_id, '2024-01-01 10:00:00+00', '2024-01-05 10:00:00+00', 'confirmed')
  RETURNING id INTO v_reservation_id;
  
  RAISE NOTICE 'Created First Confirmed Reservation: %', v_reservation_id;

  -- 3. NEGATIVE TEST: Attempt overlapping reservation (Jan 3 - Jan 7) -> SHOULD FAIL
  BEGIN
    INSERT INTO reservations (item_id, customer_id, start_at, end_at, status)
    VALUES (v_item_id, v_customer_id, '2024-01-03 10:00:00+00', '2024-01-07 10:00:00+00', 'confirmed');
    
    -- If we get here, it FAILED to block
    RAISE EXCEPTION 'FATAL: Exclusion constraint failed to block overlapping reservation!';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'SUCCESS: Database correctly rejected the overlapping reservation!';
  END;

  -- 4. CLEANUP
  -- DELETE FROM items WHERE id = v_item_id;
  -- (Cascades to reservations usually, but let's be explicit if needed)
  -- For now, we leave it so you can see it, or delete it:
  -- DELETE FROM items WHERE id = v_item_id;
  
  RAISE NOTICE 'Test Complete: The Foundation is Solid.';
END $$;
