-- ============================================================
-- Tennis Coaching App — Supabase Storage Setup
-- Run in SQL Editor AFTER schema.sql and rls_policies.sql
-- ============================================================

-- Create storage buckets
-- Note: You can also create these in the Supabase Dashboard
-- under Storage > New Bucket. SQL is provided for reproducibility.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Announcement images: visible to team members
  (
    'announcement-images',
    'announcement-images',
    false,  -- not public; accessed via signed URLs
    5242880,  -- 5MB limit
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  -- Avatar images: public so they can be used in img tags
  (
    'avatars',
    'avatars',
    true,  -- public bucket
    2097152,  -- 2MB limit
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;

-- ============================================================
-- STORAGE RLS POLICIES
-- ============================================================

-- AVATARS (public bucket)
-- Anyone can view avatars (they're public)
-- Users can only upload/update their own avatar
create policy "avatars_public_select"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update_own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ANNOUNCEMENT IMAGES
-- Team members can view images in announcements they can access.
-- Coaches and players can upload announcement images.
-- For MVP we simplify: any authenticated user can read/write
-- announcement images. Tighten in phase 2 if needed.
create policy "ann_images_authenticated_select"
  on storage.objects for select
  using (
    bucket_id = 'announcement-images'
    and auth.role() = 'authenticated'
  );

create policy "ann_images_authenticated_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'announcement-images'
    and auth.role() = 'authenticated'
  );

create policy "ann_images_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'announcement-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );