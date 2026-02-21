-- Migration for Deep Research
CREATE TABLE IF NOT EXISTS public.research_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    mode TEXT DEFAULT 'web', -- web, urls, docs, mix
    depth TEXT DEFAULT 'standard', -- quick, standard, exhaustive
    status TEXT DEFAULT 'pending', -- pending, framing, planning, collecting, synthesizing, completed, failed
    progress_stage TEXT DEFAULT 'framing',
    progress_percent INTEGER DEFAULT 0,
    progress_message TEXT DEFAULT 'Initialisation...',
    report_markdown TEXT, -- Final markdown report
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.research_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.research_runs(id) ON DELETE CASCADE,
    title TEXT,
    url TEXT,
    snippet TEXT,
    full_content TEXT,
    relevance_score FLOAT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;

-- Policies for research_runs
CREATE POLICY "Users can view their own research runs"
    ON public.research_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own research runs"
    ON public.research_runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own research runs"
    ON public.research_runs FOR UPDATE
    USING (auth.uid() = user_id);

-- Policies for research_sources
CREATE POLICY "Users can view sources for their own runs"
    ON public.research_sources FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.research_runs
        WHERE research_runs.id = research_sources.run_id
        AND research_runs.user_id = auth.uid()
    ));

-- Add Realtime to research_runs
ALTER PUBLICATION supabase_realtime ADD TABLE public.research_runs;
