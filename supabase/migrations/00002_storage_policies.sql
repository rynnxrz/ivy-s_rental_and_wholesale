-- ============================================================
-- Supabase Storage Policies for Item Images
-- ============================================================

-- Create storage bucket for item images (run in Supabase Dashboard)
-- Note: Bucket creation via SQL may require admin privileges
-- Alternative: Create bucket via Supabase Dashboard > Storage > New Bucket

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('item-images', 'item-images', true)
-- ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view images (public bucket)
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'item-images');

-- Policy: Only admins can upload images
CREATE POLICY "Admins can upload images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'item-images' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Policy: Only admins can update images
CREATE POLICY "Admins can update images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'item-images' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Policy: Only admins can delete images
CREATE POLICY "Admins can delete images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'item-images' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
