-- Database Schema Diagnosis Queries
-- Run these in your Supabase SQL Editor to check your database structure

-- 1. Check songs table structure and column names
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'songs' 
ORDER BY ordinal_position;

-- 2. Check for album art column variations
SELECT 
  column_name
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND (column_name ILIKE '%album%' OR column_name ILIKE '%art%');

-- 3. Check all existing indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef 
FROM pg_indexes 
WHERE tablename IN ('songs', 'requests', 'set_lists', 'set_list_songs', 'requesters', 'user_votes')
ORDER BY tablename, indexname;

-- 4. Check for missing critical indexes
SELECT 
  'Missing index: idx_requests_priority' as issue
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE indexname = 'idx_requests_priority'
)
UNION ALL
SELECT 
  'Missing index: idx_requests_title_artist_active' as issue
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE indexname = 'idx_requests_title_artist_active'
)
UNION ALL
SELECT 
  'Missing index: idx_user_votes_lookup' as issue
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE indexname = 'idx_user_votes_lookup'
);

-- 5. Check table sizes and row counts
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  (SELECT count(*) FROM songs) as songs_count,
  (SELECT count(*) FROM requests) as requests_count,
  (SELECT count(*) FROM set_lists) as setlists_count
FROM pg_tables 
WHERE tablename IN ('songs', 'requests', 'set_lists')
LIMIT 1;

-- 6. Check for slow queries (if you have pg_stat_statements enabled)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE query ILIKE '%songs%' OR query ILIKE '%requests%'
ORDER BY mean_time DESC
LIMIT 10;

-- 7. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('songs', 'requests', 'set_lists', 'set_list_songs', 'requesters', 'user_votes')
ORDER BY tablename, policyname;

-- 8. Check for any constraint violations or data issues
SELECT 
  'songs with null titles' as issue,
  count(*) as count
FROM songs 
WHERE title IS NULL OR title = ''
UNION ALL
SELECT 
  'requests with null votes' as issue,
  count(*) as count
FROM requests 
WHERE votes IS NULL
UNION ALL
SELECT 
  'set_lists with null is_active' as issue,
  count(*) as count
FROM set_lists 
WHERE is_active IS NULL;