-- Create presentations table
CREATE TABLE IF NOT EXISTS public.presentations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title text,
    prompt text NOT NULL,
    provider text NOT NULL, -- 'gamma' or 'gemini'
    gamma_url text,
    pptx_url text,
    pdf_url text,
    num_slides integer,
    format text, -- 'presentation', 'webpage', 'document', 'social'
    dimensions text,
    language text DEFAULT 'Français',
    theme text,
    tone text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own presentations" 
ON public.presentations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presentations" 
ON public.presentations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presentations" 
ON public.presentations FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presentations" 
ON public.presentations FOR DELETE 
USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS presentations_user_id_idx ON public.presentations (user_id);
