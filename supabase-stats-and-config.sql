-- ============================================================
-- SCRIPT: Mejoras de Configuración, Junta y Estadísticas
-- ============================================================

-- 1. Actualizar tabla de miembros para preferencias de notificación
ALTER TABLE building_members 
ADD COLUMN IF NOT EXISTS enable_email BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_whatsapp BOOLEAN DEFAULT TRUE;

-- 2. Añadir campos para reporte diario programado en building_whatsapp_settings
ALTER TABLE building_whatsapp_settings 
ADD COLUMN IF NOT EXISTS daily_report_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS daily_report_time TIME DEFAULT '19:00',
ADD COLUMN IF NOT EXISTS daily_report_days TEXT DEFAULT '1,2,3,4,5,6,0', -- 0 es Domingo
ADD COLUMN IF NOT EXISTS daily_report_last_sent TIMESTAMPTZ;

-- 3. Crear vista para estadísticas de uso (opcional, facilita las queries)
CREATE OR REPLACE VIEW usage_statistics AS
SELECT 
  building_id,
  COUNT(*) FILTER (WHERE entity_type = 'measurement') as total_measurements,
  COUNT(*) FILTER (WHERE entity_type = 'email' AND operation = 'SUCCESS') as total_emails_sent,
  COUNT(DISTINCT user_email) as total_active_users,
  MAX(created_at) as last_activity
FROM audit_logs
GROUP BY building_id;

-- 4. Parámetros avanzados de configuración
ALTER TABLE building_settings 
ADD COLUMN IF NOT EXISTS silence_start_time TIME DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS silence_end_time TIME DEFAULT '06:00',
ADD COLUMN IF NOT EXISTS enable_resident_notifications BOOLEAN DEFAULT TRUE;

-- 5. Comentario
COMMENT ON COLUMN building_settings.alert_threshold_percentage IS 'Porcentaje de variación brusca para considerar una anomalía (default 30%)';
