-- 1. Tabla de Edificios (Buildings)
CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tank_capacity_liters INTEGER NOT NULL DEFAULT 169000,
  admin_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Mediciones (Measurements)
CREATE TABLE measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  liters NUMERIC NOT NULL,
  percentage NUMERIC NOT NULL,
  height NUMERIC,
  email TEXT NOT NULL,
  collaborator_name TEXT,
  variation_lts NUMERIC,
  flow_lpm NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Suscripciones (Resident Subscriptions)
CREATE TABLE resident_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  emails_remaining INTEGER DEFAULT 5,
  UNIQUE(building_id, email)
);

-- Habilitar Row Level Security (RLS) para seguridad multi-inquilino
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura (simplificadas para el prototipo)
CREATE POLICY "Lectura pública por slug" ON buildings FOR SELECT USING (true);
CREATE POLICY "Escritura pública de mediciones" ON measurements FOR INSERT WITH CHECK (true);
CREATE POLICY "Lectura de mediciones por edificio" ON measurements FOR SELECT USING (true);
CREATE POLICY "Gestión de suscripciones" ON resident_subscriptions FOR ALL USING (true);
