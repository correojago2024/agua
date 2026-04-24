-- ============================================================
-- SCRIPT: Reparación Integral de Banners y Estadísticas (v2)
-- ============================================================

-- 1. ESTRUCTURA DE TABLA BUILDINGS (Banner)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- 2. POLÍTICAS DE RLS PARA BUILDINGS
-- Permitir que se actualice el edificio (necesario para guardar el banner_url)
DROP POLICY IF EXISTS "Permitir actualización de edificios" ON buildings;
CREATE POLICY "Permitir actualización de edificios" 
ON buildings FOR UPDATE 
USING (true) 
WITH CHECK (true);

-- 3. ALMACENAMIENTO (Storage para Banners)
-- Asegurar que el bucket exista y sea público
INSERT INTO storage.buckets (id, name, public)
VALUES ('building-banners', 'building-banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para el bucket de banners
DROP POLICY IF EXISTS "Banners_Publicos" ON storage.objects;
CREATE POLICY "Banners_Publicos" ON storage.objects FOR SELECT USING (bucket_id = 'building-banners');

DROP POLICY IF EXISTS "Banners_Subida" ON storage.objects;
CREATE POLICY "Banners_Subida" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'building-banners');

DROP POLICY IF EXISTS "Banners_Update" ON storage.objects;
CREATE POLICY "Banners_Update" ON storage.objects FOR UPDATE USING (bucket_id = 'building-banners');

DROP POLICY IF EXISTS "Banners_Delete" ON storage.objects;
CREATE POLICY "Banners_Delete" ON storage.objects FOR DELETE USING (bucket_id = 'building-banners');

-- 4. TABLAS DE CONFIGURACIÓN Y ESTADÍSTICAS
CREATE TABLE IF NOT EXISTS building_settings (
  building_id UUID PRIMARY KEY REFERENCES buildings(id) ON DELETE CASCADE,
  alert_threshold_percentage NUMERIC DEFAULT 30,
  enable_anomaly_alerts BOOLEAN DEFAULT TRUE,
  silence_start_time TIME DEFAULT '22:00',
  silence_end_time TIME DEFAULT '06:00',
  enable_resident_notifications BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_summary (
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_filled NUMERIC DEFAULT 0,
  total_consumed NUMERIC DEFAULT 0,
  avg_level NUMERIC DEFAULT 0,
  min_level NUMERIC DEFAULT 0,
  max_level NUMERIC DEFAULT 0,
  measurement_count INTEGER DEFAULT 0,
  PRIMARY KEY (building_id, date)
);

CREATE TABLE IF NOT EXISTS weekly_summary (
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  total_filled NUMERIC DEFAULT 0,
  total_consumed NUMERIC DEFAULT 0,
  avg_level NUMERIC DEFAULT 0,
  measurement_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (building_id, week_start)
);

-- 5. COLUMNAS ADICIONALES EN MEASUREMENTS
-- Aseguramos que existan tanto los nombres en inglés como en español para compatibilidad
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS variation_lts NUMERIC;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS variacion_lts NUMERIC;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS flow_lpm NUMERIC;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS caudal_lts_min NUMERIC;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS caudal_lts_hora NUMERIC;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS tiempo_min_entre_mediciones NUMERIC;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS variacion_puntos_pct NUMERIC;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS altura_m NUMERIC;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS lts_faltantes_para_llenar NUMERIC;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS dia_semana TEXT;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS mes TEXT;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS is_anomaly BOOLEAN DEFAULT FALSE;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS anomaly_checked BOOLEAN DEFAULT FALSE;

-- 6. FUNCIONES DE BASE DE DATOS (Corregidas y Optimizadas)

-- Función 1: Verificar Anomalías
CREATE OR REPLACE FUNCTION public.check_anomaly()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  previous_measurement RECORD;
  variation_percentage NUMERIC;
  settings_record RECORD;
BEGIN
  SELECT * INTO settings_record
  FROM building_settings
  WHERE building_id = NEW.building_id;

  SELECT liters INTO previous_measurement
  FROM measurements
  WHERE building_id = NEW.building_id AND recorded_at < NEW.recorded_at
  ORDER BY recorded_at DESC
  LIMIT 1;

  IF previous_measurement IS NOT NULL AND previous_measurement.liters > 0 THEN
    variation_percentage := ABS((NEW.liters - previous_measurement.liters) / previous_measurement.liters * 100);
    IF variation_percentage > COALESCE(settings_record.alert_threshold_percentage, 30) THEN
      NEW.is_anomaly := TRUE;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Función 2: Resumen Diario
CREATE OR REPLACE FUNCTION public.update_daily_summary()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  summary_date DATE;
  total_filled NUMERIC := 0;
  total_consumed NUMERIC := 0;
  level_sum NUMERIC := 0;
  level_min NUMERIC := 999999999;
  level_max NUMERIC := 0;
  m_count INTEGER := 0;
  prev_liters NUMERIC := NULL;
  m RECORD;
BEGIN
  summary_date := NEW.recorded_at::DATE;

  FOR m IN SELECT liters FROM measurements 
           WHERE building_id = NEW.building_id 
           AND recorded_at::DATE = summary_date
           ORDER BY recorded_at LOOP
    level_sum := level_sum + m.liters;
    level_min := LEAST(level_min, m.liters);
    level_max := GREATEST(level_max, m.liters);
    m_count := m_count + 1;
    
    IF prev_liters IS NOT NULL THEN
      IF m.liters > prev_liters THEN
        total_filled := total_filled + (m.liters - prev_liters);
      ELSE
        total_consumed := total_consumed + (prev_liters - m.liters);
      END IF;
    END IF;
    prev_liters := m.liters;
  END LOOP;

  INSERT INTO daily_summary (building_id, date, total_filled, total_consumed, avg_level, min_level, max_level, measurement_count)
  VALUES (NEW.building_id, summary_date, total_filled, total_consumed, 
          CASE WHEN m_count > 0 THEN level_sum / m_count ELSE 0 END,
          CASE WHEN m_count > 0 THEN level_min ELSE 0 END,
          CASE WHEN m_count > 0 THEN level_max ELSE 0 END,
          m_count)
  ON CONFLICT (building_id, date) DO UPDATE SET
    total_filled = EXCLUDED.total_filled,
    total_consumed = EXCLUDED.total_consumed,
    avg_level = EXCLUDED.avg_level,
    min_level = EXCLUDED.min_level,
    max_level = EXCLUDED.max_level,
    measurement_count = EXCLUDED.measurement_count;

  RETURN NEW;
END;
$function$;

-- Función 3: Resumen Semanal
CREATE OR REPLACE FUNCTION public.update_weekly_summary()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_week_start DATE;
    v_building_id UUID;
    v_recorded_at TIMESTAMP;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_building_id := OLD.building_id;
        v_recorded_at := OLD.recorded_at;
    ELSE
        v_building_id := NEW.building_id;
        v_recorded_at := NEW.recorded_at;
    END IF;

    v_week_start := date_trunc('week', v_recorded_at)::DATE;

    INSERT INTO public.weekly_summary (
        building_id,
        week_start,
        total_filled,
        total_consumed,
        avg_level,
        measurement_count
    )
    SELECT 
        v_building_id,
        v_week_start,
        COALESCE(SUM(CASE WHEN (variation_lts > 0 OR variacion_lts > 0) THEN COALESCE(variation_lts, variacion_lts) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN (variation_lts < 0 OR variacion_lts < 0) THEN ABS(COALESCE(variation_lts, variacion_lts)) ELSE 0 END), 0),
        COALESCE(AVG(percentage), 0),
        COUNT(*)
    FROM public.measurements
    WHERE building_id = v_building_id 
      AND date_trunc('week', recorded_at)::DATE = v_week_start
    ON CONFLICT (building_id, week_start) 
    DO UPDATE SET
        total_filled = EXCLUDED.total_filled,
        total_consumed = EXCLUDED.total_consumed,
        avg_level = EXCLUDED.avg_level,
        measurement_count = EXCLUDED.measurement_count,
        created_at = NOW();

    DELETE FROM public.weekly_summary 
    WHERE measurement_count = 0 
      AND building_id = v_building_id 
      AND week_start = v_week_start;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$;

-- Función 4: Cálculos Automáticos de Mediciones (Soporta ambos idiomas de columnas)
CREATE OR REPLACE FUNCTION public.calculate_measurement_values()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  last_record RECORD;
  minutes_diff NUMERIC;
BEGIN
  -- Obtener última medición
  SELECT liters, recorded_at, percentage 
  INTO last_record 
  FROM measurements 
  WHERE building_id = NEW.building_id 
  ORDER BY recorded_at DESC 
  LIMIT 1;

  IF last_record IS NOT NULL THEN
    -- Variación
    NEW.variation_lts := NEW.liters - last_record.liters;
    NEW.variacion_lts := NEW.variation_lts;
    
    minutes_diff := EXTRACT(EPOCH FROM (NEW.recorded_at - last_record.recorded_at)) / 60;
    IF minutes_diff > 0 THEN
      -- Caudal
      NEW.caudal_lts_min := NEW.variation_lts / minutes_diff;
      NEW.flow_lpm := NEW.caudal_lts_min;
      NEW.caudal_lts_hora := NEW.caudal_lts_min * 60;
    END IF;

    NEW.tiempo_min_entre_mediciones := minutes_diff;
    NEW.variacion_puntos_pct := CASE 
      WHEN last_record.percentage > 0 
      THEN (NEW.percentage - last_record.percentage) / last_record.percentage * 100 
      ELSE 0 
    END;
  END IF;

  -- Faltantes y Fechas
  NEW.lts_faltantes_para_llenar := (SELECT tank_capacity_liters FROM buildings WHERE id = NEW.building_id) - NEW.liters;
  NEW.dia_semana := TO_CHAR(NEW.recorded_at, 'Day');
  NEW.mes := TO_CHAR(NEW.recorded_at, 'Month');

  RETURN NEW;
END;
$function$;

-- 7. DISPARADORES (Triggers)

DROP TRIGGER IF EXISTS trg_calculate_measurement_values ON measurements;
CREATE TRIGGER trg_calculate_measurement_values
BEFORE INSERT ON measurements
FOR EACH ROW EXECUTE FUNCTION calculate_measurement_values();

DROP TRIGGER IF EXISTS trg_check_anomaly ON measurements;
CREATE TRIGGER trg_check_anomaly
BEFORE INSERT ON measurements
FOR EACH ROW EXECUTE FUNCTION check_anomaly();

DROP TRIGGER IF EXISTS trg_update_daily_summary ON measurements;
CREATE TRIGGER trg_update_daily_summary
AFTER INSERT OR UPDATE ON measurements
FOR EACH ROW EXECUTE FUNCTION update_daily_summary();

DROP TRIGGER IF EXISTS trg_update_weekly_summary ON measurements;
CREATE TRIGGER trg_update_weekly_summary
AFTER INSERT OR UPDATE OR DELETE ON measurements
FOR EACH ROW EXECUTE FUNCTION update_weekly_summary();

-- 8. AUTO-CONFIGURACIÓN
CREATE OR REPLACE FUNCTION public.create_building_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.building_settings (building_id)
  VALUES (NEW.id)
  ON CONFLICT (building_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_create_building_settings ON buildings;
CREATE TRIGGER trg_create_building_settings
AFTER INSERT ON buildings
FOR EACH ROW EXECUTE FUNCTION create_building_settings();

-- Inicializar existentes
INSERT INTO building_settings (building_id)
SELECT id FROM buildings
ON CONFLICT (building_id) DO NOTHING;
