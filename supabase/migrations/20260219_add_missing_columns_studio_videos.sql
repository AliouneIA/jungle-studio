-- Add missing columns to studio_videos table
-- These columns are needed for the updated video generation function

-- Add generate_audio column (for audio generation toggle)
ALTER TABLE studio_videos
ADD COLUMN IF NOT EXISTS generate_audio BOOLEAN DEFAULT true;

-- Add quality column (for 720p/1080p selection)
ALTER TABLE studio_videos
ADD COLUMN IF NOT EXISTS quality TEXT DEFAULT '720p';

-- Add style_name column (for video style presets)
ALTER TABLE studio_videos
ADD COLUMN IF NOT EXISTS style_name TEXT;

-- Add image_url column (for image-to-video)
ALTER TABLE studio_videos
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add source_video_url column (for video editing)
ALTER TABLE studio_videos
ADD COLUMN IF NOT EXISTS source_video_url TEXT;

-- Add character_image_url column (for motion control)
ALTER TABLE studio_videos
ADD COLUMN IF NOT EXISTS character_image_url TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_studio_videos_provider_task ON studio_videos(provider_task_id);
CREATE INDEX IF NOT EXISTS idx_studio_videos_status ON studio_videos(status);

-- Comment for documentation
COMMENT ON COLUMN studio_videos.generate_audio IS 'Whether to generate audio for the video (Kling, Grok)';
COMMENT ON COLUMN studio_videos.quality IS 'Video quality: 720p or 1080p';
COMMENT ON COLUMN studio_videos.style_name IS 'Style preset name (e.g., cinematic, photorealistic)';
COMMENT ON COLUMN studio_videos.image_url IS 'Source image URL for image-to-video generation';
COMMENT ON COLUMN studio_videos.source_video_url IS 'Source video URL for video editing';
COMMENT ON COLUMN studio_videos.character_image_url IS 'Character image URL for motion control';
