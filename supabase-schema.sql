-- ============================================================
-- POKER CASH GAME — Supabase SQL Schema
-- Run this entire file in: Supabase > SQL Editor > New Query
-- ============================================================

-- 1. Players master list
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Games
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'ערב פוקר',
  status TEXT NOT NULL DEFAULT 'active', -- active | ended | locked
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  viewer_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Game participants (players in a specific game)
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  player_name TEXT NOT NULL,
  ending_chips INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- 4. Buy-ins (soft delete via deleted_at)
CREATE TABLE IF NOT EXISTS buyins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  amount_ils INTEGER NOT NULL,
  chips INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  delete_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Settlements (computed P2P transfers)
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  from_player_id UUID REFERENCES game_players(id),
  to_player_id UUID REFERENCES game_players(id),
  from_player_name TEXT NOT NULL,
  to_player_name TEXT NOT NULL,
  required_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Settlement payments (actual payments per transfer)
CREATE TABLE IF NOT EXISTS settlement_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'bit', 'paybox')),
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REALTIME — Enable live updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE buyins;
ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
ALTER PUBLICATION supabase_realtime ADD TABLE settlement_payments;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyins ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone with the link can view)
CREATE POLICY "public read players" ON players FOR SELECT USING (true);
CREATE POLICY "public read games" ON games FOR SELECT USING (true);
CREATE POLICY "public read game_players" ON game_players FOR SELECT USING (true);
CREATE POLICY "public read buyins" ON buyins FOR SELECT USING (true);
CREATE POLICY "public read settlements" ON settlements FOR SELECT USING (true);
CREATE POLICY "public read settlement_payments" ON settlement_payments FOR SELECT USING (true);
CREATE POLICY "public read audit_logs" ON audit_logs FOR SELECT USING (true);

-- Write access via anon key (admin PIN enforced in the UI layer)
CREATE POLICY "anon write players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon write games" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon write game_players" ON game_players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon write buyins" ON buyins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon write settlements" ON settlements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon write settlement_payments" ON settlement_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon write audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Done! Your poker app database is ready.
-- ============================================================
