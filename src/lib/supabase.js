import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lyyoktbmagggnrnbuhjq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5eW9rdGJtYWdnZ25ybmJ1aGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzczNTYsImV4cCI6MjA4OTQxMzM1Nn0.M6mT5JGyomxLyrQa7x3tJdPx4gf5Tb49q90hpjnh-zc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ═══════════════════════════════════════════════════════
// SUPABASE SQL SCHEMA — run this in Supabase SQL editor
// ═══════════════════════════════════════════════════════
//
// -- Players master list
// CREATE TABLE players (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   name TEXT NOT NULL UNIQUE,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Games
// CREATE TABLE games (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   title TEXT,
//   status TEXT NOT NULL DEFAULT 'active', -- active | ended | locked
//   started_at TIMESTAMPTZ DEFAULT NOW(),
//   ended_at TIMESTAMPTZ,
//   viewer_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Game participants
// CREATE TABLE game_players (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   game_id UUID REFERENCES games(id) ON DELETE CASCADE,
//   player_id UUID REFERENCES players(id),
//   player_name TEXT NOT NULL,
//   ending_chips INTEGER,
//   created_at TIMESTAMPTZ DEFAULT NOW(),
//   UNIQUE(game_id, player_id)
// );
//
// -- Buy-ins
// CREATE TABLE buyins (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   game_id UUID REFERENCES games(id) ON DELETE CASCADE,
//   game_player_id UUID REFERENCES game_players(id) ON DELETE CASCADE,
//   amount_ils INTEGER NOT NULL,
//   chips INTEGER NOT NULL,
//   recorded_at TIMESTAMPTZ DEFAULT NOW(),
//   deleted_at TIMESTAMPTZ,
//   delete_reason TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Settlements
// CREATE TABLE settlements (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   game_id UUID REFERENCES games(id) ON DELETE CASCADE,
//   from_player_id UUID REFERENCES game_players(id),
//   to_player_id UUID REFERENCES game_players(id),
//   from_player_name TEXT NOT NULL,
//   to_player_name TEXT NOT NULL,
//   required_amount INTEGER NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Settlement payments
// CREATE TABLE settlement_payments (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   settlement_id UUID REFERENCES settlements(id) ON DELETE CASCADE,
//   amount INTEGER NOT NULL,
//   method TEXT NOT NULL, -- cash | bit | paybox
//   paid_at TIMESTAMPTZ DEFAULT NOW(),
//   note TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Audit log
// CREATE TABLE audit_logs (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   game_id UUID REFERENCES games(id) ON DELETE CASCADE,
//   action TEXT NOT NULL,
//   entity_type TEXT,
//   entity_id UUID,
//   before_data JSONB,
//   after_data JSONB,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Enable realtime on all tables:
// ALTER PUBLICATION supabase_realtime ADD TABLE games, game_players, buyins, settlements, settlement_payments;
//
// -- Row Level Security (all public read, restrict writes via admin token or policies)
// -- For simplicity in this app, we use anon key for all + admin PIN stored in localStorage
// ALTER TABLE players ENABLE ROW LEVEL SECURITY;
// ALTER TABLE games ENABLE ROW LEVEL SECURITY;
// ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
// ALTER TABLE buyins ENABLE ROW LEVEL SECURITY;
// ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
// ALTER TABLE settlement_payments ENABLE ROW LEVEL SECURITY;
// ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
//
// -- Public read policies
// CREATE POLICY "public read" ON games FOR SELECT USING (true);
// CREATE POLICY "public read" ON game_players FOR SELECT USING (true);
// CREATE POLICY "public read" ON buyins FOR SELECT USING (true);
// CREATE POLICY "public read" ON settlements FOR SELECT USING (true);
// CREATE POLICY "public read" ON settlement_payments FOR SELECT USING (true);
// CREATE POLICY "public read" ON players FOR SELECT USING (true);
// CREATE POLICY "public read" ON audit_logs FOR SELECT USING (true);
//
// -- Write policies (allow anon for now — admin PIN enforced in UI)
// CREATE POLICY "anon write" ON games FOR ALL USING (true) WITH CHECK (true);
// CREATE POLICY "anon write" ON game_players FOR ALL USING (true) WITH CHECK (true);
// CREATE POLICY "anon write" ON buyins FOR ALL USING (true) WITH CHECK (true);
// CREATE POLICY "anon write" ON settlements FOR ALL USING (true) WITH CHECK (true);
// CREATE POLICY "anon write" ON settlement_payments FOR ALL USING (true) WITH CHECK (true);
// CREATE POLICY "anon write" ON players FOR ALL USING (true) WITH CHECK (true);
// CREATE POLICY "anon write" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
