-- ============================================================
-- SCRIPT: Cuotas, Límites y Gestión de Emails
-- ============================================================

-- 1. Campos de cuotas en la tabla buildings
ALTER TABLE buildings 
ADD COLUMN IF NOT EXISTS emails_sent_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_emails_per_month INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS max_storage_records INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS last_quota_reset_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS notified_90_storage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notified_90_emails BOOLEAN DEFAULT FALSE;

-- 2. Insertar nuevos templates para alertas de límites
INSERT INTO email_templates (name, subject_es, body_es) VALUES
('limit_90_storage', '⚠️ Alerta de Almacenamiento: 90% alcanzado - {building_name}', 
'Estimado administrador,

Le informamos que el edificio {building_name} ha alcanzado el 90% de su límite de almacenamiento de registros ({current_count} de {max_count}).

Si lo desea, puede aumentar su plan para tener más capacidad. En caso de continuar en el mismo plan, los registros de almacenamiento se sobreescribirán desde el más antiguo (FIFO), por lo que irá perdiendo los registros más viejos.

Saludos,
Equipo AquaSaaS'),

('limit_90_emails', '📧 Alerta de Envío de Emails: 90% alcanzado - {building_name}',
'Estimado administrador,

Le informamos que el edificio {building_name} ha alcanzado el 90% de su límite mensual de envío de correos electrónicos ({current_count} de {max_count}).

Deberá esperar al mes siguiente para poder seguir recibiendo emails cuando se registre un nuevo dato o cambiar de plan. Los datos seguirán almacenándose en la base de datos, pero no se enviarán notificaciones por email hasta el reinicio del contador o cambio de plan.

Saludos,
Equipo AquaSaaS')
ON CONFLICT (name) DO NOTHING;

-- 3. Función para resetear contadores cada 30 días (opcional si se hace por Cron)
-- Se recomienda manejarlo desde el Cron Job de mantenimiento.

-- 4. Función para incrementar contadores (segura para concurrencia)
CREATE OR REPLACE FUNCTION increment_building_emails(b_id UUID, count INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE buildings 
  SET emails_sent_this_month = COALESCE(emails_sent_this_month, 0) + count
  WHERE id = b_id;
END;
$$ LANGUAGE plpgsql;
