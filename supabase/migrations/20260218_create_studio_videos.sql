CREATE TABLE IF NOT EXISTS studio_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT DEFAULT NULL,
  video_url TEXT DEFAULT NULL,
  thumbnail_url TEXT DEFAULT NULL,
  model TEXT DEFAULT 'kling-3.0-standard',
  fal_request_id TEXT DEFAULT NULL,
  status TEXT DEFAULT 'processing',
  duration INTEGER DEFAULT 5,
  aspect_ratio TEXT DEFAULT '16:9',
  generate_audio BOOLEAN DEFAULT true,
  batch_id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_videos_user ON studio_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_videos_status ON studio_videos(status);
CREATE INDEX IF NOT EXISTS idx_studio_videos_fal ON studio_videos(fal_request_id);

ALTER TABLE studio_videos ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'studio_videos' AND policyname = 'Users can view own videos') THEN
    CREATE POLICY "Users can view own videos" ON studio_videos
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'studio_videos' AND policyname = 'Users can insert videos') THEN
    CREATE POLICY "Users can insert videos" ON studio_videos
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'studio_videos' AND policyname = 'Service can update videos') THEN
    CREATE POLICY "Service can update videos" ON studio_videos
      FOR UPDATE USING (true);
  END IF;
END $$;
