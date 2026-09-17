-- ==============================================================================
-- PIXINERARY: BLIND EVALUATION PORTAL SCHEMA FOR SUPABASE
-- Run this script in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Table: blind_trips (Benchmark trips across scenarios)
CREATE TABLE IF NOT EXISTS public.blind_trips (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    scenario_title TEXT NOT NULL,
    scenario_notes TEXT,
    actual_model TEXT NOT NULL,
    preferences JSONB DEFAULT '{}'::jsonb,
    itinerary JSONB NOT NULL DEFAULT '[]'::jsonb,
    typical_weather JSONB,
    suggestions JSONB DEFAULT '[]'::jsonb,
    accommodations JSONB DEFAULT '[]'::jsonb,
    uploaded_locations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blind_trips_scenario ON public.blind_trips(scenario_id);
CREATE INDEX IF NOT EXISTS idx_blind_trips_model ON public.blind_trips(actual_model);

-- 2. Table: blind_evaluations (6-dimension detailed expert scores)
CREATE TABLE IF NOT EXISTS public.blind_evaluations (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    trip_id TEXT NOT NULL,
    blind_label TEXT NOT NULL,
    actual_model TEXT NOT NULL,
    expert_id TEXT NOT NULL,
    expert_name TEXT,
    expert_profile JSONB DEFAULT '{}'::jsonb,
    scores JSONB DEFAULT '{}'::jsonb,
    detailed_scores JSONB DEFAULT '{}'::jsonb,
    overall_pick BOOLEAN DEFAULT false,
    feedback TEXT,
    submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blind_evals_scenario ON public.blind_evaluations(scenario_id);
CREATE INDEX IF NOT EXISTS idx_blind_evals_trip ON public.blind_evaluations(trip_id);
CREATE INDEX IF NOT EXISTS idx_blind_evals_model ON public.blind_evaluations(actual_model);
CREATE INDEX IF NOT EXISTS idx_blind_evals_expert ON public.blind_evaluations(expert_id);

-- 3. Table: blind_comparisons (Ranking & 4 Qualitative Answers per Scenario)
CREATE TABLE IF NOT EXISTS public.blind_comparisons (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    expert_id TEXT NOT NULL,
    expert_name TEXT,
    expert_profile JSONB DEFAULT '{}'::jsonb,
    rankings JSONB NOT NULL DEFAULT '[]'::jsonb,
    best_for_practical_use JSONB DEFAULT '{}'::jsonb,
    qualitative_feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blind_comp_scenario ON public.blind_comparisons(scenario_id);
CREATE INDEX IF NOT EXISTS idx_blind_comp_expert ON public.blind_comparisons(expert_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.blind_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blind_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blind_comparisons ENABLE ROW LEVEL SECURITY;

-- 5. Policies for Public and Authenticated Access
-- Read policies
DROP POLICY IF EXISTS "Allow public read on blind_trips" ON public.blind_trips;
CREATE POLICY "Allow public read on blind_trips" ON public.blind_trips FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on blind_evaluations" ON public.blind_evaluations;
CREATE POLICY "Allow public read on blind_evaluations" ON public.blind_evaluations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on blind_comparisons" ON public.blind_comparisons;
CREATE POLICY "Allow public read on blind_comparisons" ON public.blind_comparisons FOR SELECT USING (true);

-- Insert / Update / Delete policies
DROP POLICY IF EXISTS "Allow all on blind_trips" ON public.blind_trips;
CREATE POLICY "Allow all on blind_trips" ON public.blind_trips FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on blind_evaluations" ON public.blind_evaluations;
CREATE POLICY "Allow all on blind_evaluations" ON public.blind_evaluations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on blind_comparisons" ON public.blind_comparisons;
CREATE POLICY "Allow all on blind_comparisons" ON public.blind_comparisons FOR ALL USING (true) WITH CHECK (true);
