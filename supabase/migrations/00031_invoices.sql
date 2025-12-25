-- ============================================================
-- Invoice System Schema Migration
-- Milestone 5: Integrated Invoice System
-- Created: 2025-12-25
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

-- Invoice status enum
CREATE TYPE invoice_status AS ENUM (
    'DRAFT',
    'SENT', 
    'PAID',
    'VOID',
    'OVERDUE'
);

-- Invoice category enum
CREATE TYPE invoice_category AS ENUM (
    'RENTAL',
    'WHOLESALE',
    'MANUAL'
);

-- ============================================================
-- 2. INVOICES TABLE
-- ============================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Invoice identification
    invoice_number TEXT UNIQUE NOT NULL,
    category invoice_category NOT NULL,
    
    -- Linked entities (nullable for flexibility)
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Customer snapshot (preserved at invoice creation)
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    billing_address JSONB DEFAULT '{}'::jsonb,
    
    -- Billing configuration
    billing_profile_id UUID REFERENCES billing_profiles(id) ON DELETE SET NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    
    -- Amounts
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Dates
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    
    -- Status
    status invoice_status NOT NULL DEFAULT 'DRAFT',
    
    -- Future: Signed PDF storage path
    signed_file_path TEXT,
    
    -- Notes (admin internal or footer notes)
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_category ON invoices(category);
CREATE INDEX idx_invoices_reservation_id ON invoices(reservation_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);

-- ============================================================
-- 3. INVOICE ITEMS TABLE (Snapshot)
-- ============================================================

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Parent invoice
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Original item reference (for analytics, nullable)
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    
    -- Snapshot data (preserved at invoice creation)
    name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching items by invoice
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ============================================================
-- 4. INVOICE NUMBER GENERATION FUNCTION
-- ============================================================

-- Generate invoice number in format: INV-{TYPE}-{YYYYMMDD}-{SEQ}
-- TYPE: R (Rental), W (Wholesale), M (Manual)
CREATE OR REPLACE FUNCTION generate_invoice_number(p_category invoice_category)
RETURNS TEXT AS $$
DECLARE
    v_prefix TEXT;
    v_date_str TEXT;
    v_seq INTEGER;
    v_invoice_number TEXT;
BEGIN
    -- Determine prefix based on category
    CASE p_category
        WHEN 'RENTAL' THEN v_prefix := 'INV-R';
        WHEN 'WHOLESALE' THEN v_prefix := 'INV-W';
        WHEN 'MANUAL' THEN v_prefix := 'INV-M';
    END CASE;
    
    -- Get today's date string
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Find the next sequence number for today
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(invoice_number FROM v_prefix || '-' || v_date_str || '-(\d+)$') 
            AS INTEGER
        )
    ), 0) + 1
    INTO v_seq
    FROM invoices
    WHERE invoice_number LIKE v_prefix || '-' || v_date_str || '-%';
    
    -- Format: INV-R-20251225-0001
    v_invoice_number := v_prefix || '-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. AUTO-GENERATE INVOICE NUMBER TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := generate_invoice_number(NEW.category);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number_before_insert
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_invoice_number();

-- ============================================================
-- 6. AUTO-UPDATE TRIGGER (updated_at)
-- ============================================================

-- Ensure the function exists (re-defining it to be safe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- INVOICES policies
CREATE POLICY "Admins can view all invoices" ON invoices
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can insert invoices" ON invoices
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update invoices" ON invoices
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can delete invoices" ON invoices
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Customers can view their own invoices
CREATE POLICY "Customers can view own invoices" ON invoices
    FOR SELECT USING (customer_id = auth.uid());

-- INVOICE_ITEMS policies (follow parent invoice access)
CREATE POLICY "Admins can view all invoice items" ON invoice_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can insert invoice items" ON invoice_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update invoice items" ON invoice_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can delete invoice items" ON invoice_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Customers can view items of their own invoices
CREATE POLICY "Customers can view own invoice items" ON invoice_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM invoices 
            WHERE invoices.id = invoice_items.invoice_id 
            AND invoices.customer_id = auth.uid()
        )
    );

-- ============================================================
-- 8. STORAGE BUCKET FOR SIGNED DOCUMENTS
-- ============================================================

-- Note: Bucket creation must be done via Supabase Dashboard or API
-- This is a placeholder comment for documentation.
-- 
-- Bucket name: secure_documents
-- Public: false
-- File size limit: 10MB
-- Allowed MIME types: application/pdf
--
-- RLS Policies (to be created in Supabase Dashboard):
-- - Admin can upload: (auth.role() = 'admin')
-- - Admin can read: (auth.role() = 'admin')
-- - Customers can read own files: (auth.uid()::text = (storage.foldername(name))[1])
