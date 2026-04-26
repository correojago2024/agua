
-- ============================================================
-- SISTEMA DE ANÁLISIS POR INTELIGENCIA ARTIFICIAL (IA)
-- ============================================================

-- 1. Configuración de IA por edificio
CREATE TABLE IF NOT EXISTS building_ia_settings (
  building_id UUID PRIMARY KEY REFERENCES buildings(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT FALSE,
  frequency TEXT DEFAULT 'manual', -- 'manual', 'weekly', 'monthly', 'quarterly'
  recipients TEXT, -- correos separados por coma
  send_to_junta BOOLEAN DEFAULT FALSE,
  analysis_type TEXT DEFAULT 'general',
  last_analysis_at TIMESTAMPTZ,
  next_analysis_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Reportes de análisis generados
CREATE TABLE IF NOT EXISTS ia_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  report_text TEXT NOT NULL,
  html_report TEXT,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  analysis_type TEXT,
  created_by TEXT, -- email del usuario que lo solicitó
  sent_to TEXT -- a quién se envió el reporte
);

-- 3. Habilitar RLS
ALTER TABLE building_ia_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_analysis_reports ENABLE ROW LEVEL SECURITY;

-- 4. Políticas (Lectura para todos, gestión para autenticados/admin)
CREATE POLICY "Lectura pública de settings IA" ON building_ia_settings FOR SELECT USING (true);
CREATE POLICY "Gestión de settings IA" ON building_ia_settings FOR ALL USING (true);
CREATE POLICY "Lectura pública de reportes IA" ON ia_analysis_reports FOR SELECT USING (true);
CREATE POLICY "Gestión de reportes IA" ON ia_analysis_reports FOR ALL USING (true);
