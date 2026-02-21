-- Create studio_styles table
CREATE TABLE IF NOT EXISTS public.studio_styles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.studio_styles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own styles"
    ON public.studio_styles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own styles"
    ON public.studio_styles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own styles"
    ON public.studio_styles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own styles"
    ON public.studio_styles FOR DELETE
    USING (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT ALL ON public.studio_styles TO authenticated;
GRANT ALL ON public.studio_styles TO service_role;
