-- ============================================================
-- SISTEMA FINANCIERO Y DE NOTIFICACIONES COMPLETO
-- ============================================================

-- 1. Agregar campos adicionales a buildings
ALTER TABLE buildings 
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD' CHECK (currency IN ('USD', 'Bs', 'mixed')),
ADD COLUMN IF NOT EXISTS pending_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS overpaid_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_expiry_date DATE,
ADD COLUMN IF NOT EXISTS trial_check_last_run DATE,
ADD COLUMN IF NOT EXISTS last_email_trial_3days DATE,
ADD COLUMN IF NOT EXISTS last_email_suspended DATE,
ADD COLUMN IF NOT EXISTS last_email_trial_expired DATE;

-- 2. Tabla de historial de pagos
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id),
  payment_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  payment_method VARCHAR(50),
  bank VARCHAR(100),
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100)
);

-- 3. Tabla de templates de emails
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  subject_es TEXT NOT NULL,
  body_es TEXT NOT NULL,
  subject_en TEXT,
  body_en TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Insertar templates por defecto
INSERT INTO email_templates (name, subject_es, body_es) VALUES
('trial_3days', '⚠️ Tu período de prueba termina en 3 días - AquaSaaS', 
'Estimado administrador,

Tu período de prueba del sistema AquaSaaS para {building_name} termina el {trial_end_date}.

Te esperamos que hayas disfrutado del servicio. Recuerda que te quedan 3 días de uso gratuito para decidir si deseas continuar.

Para activar tu edificio y seguir usando el sistema, contacta al administrador: correojago@gmail.com

Saludos,
Equipo AquaSaaS'),

('trial_expired', '📅 Período de prueba terminado - AquaSaaS',
'Estimado administrador,

El período de prueba de tu edificio {building_name} ha terminado.

El sistema ha sido pausado. Para renovar el servicio, contacta a: correojago@gmail.com

Saludos,
Equipo AquaSaaS'),

('building_suspended', '🚫 Edificio pausado - AquaSaaS',
'Estimado administrador,

Tu edificio {building_name} ha sido pausado y no recibirá más datos de mediciones hasta tanto se solucione la situación de renovación/pago.

Para reactivar tu edificio, contacta al administrador: correojago@gmail.com

Saludos,
Equipo AquaSaaS'),

('payment_reminder', '💰 Recordatorio de pago - AquaSaaS',
'Estimado administrador,

El edificio {building_name} tiene un pago pendiente de ${pending_amount}.

Por favor regularice su situación para continuar disfrutando del servicio.

Saludos,
Equipo AquaSaaS'),

('welcome', '🎉 Bienvenido a AquaSaaS',
'Estimado administrador,

¡Bienvenido al sistema AquaSaaS! Tu edificio {building_name} ha sido registrado correctamente.

Ahora tienes 15 días de prueba gratuita para explorar todas las funcionalidades.

Si tienes alguna duda, contacta a: correojago@gmail.com

Saludos,
Equipo AquaSaaS')
ON CONFLICT (name) DO NOTHING;

-- 5. Tabla de logs de notificaciones
CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  building_id UUID REFERENCES buildings(id),
  email_type TEXT NOT NULL,
  sent_to TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

-- 6. Tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Configuraciones por defecto
INSERT INTO system_config (key, value, description) VALUES
('trial_days', '15', 'Días de período de prueba'),
('trial_warning_days', '3', 'Días antes de vencer para enviar advertencia'),
('trial_check_enabled', 'true', 'Habilitar verificación automática de trials'),
('trial_check_cron', '0 3 * * *', 'Cron para verificar trials (diario a las 3 AM)'),
('maintenance_cron', '0 3 1,15 * *', 'Cron para mantenimiento (días 1 y 15)'),
('admin_email', 'correojago@gmail.com', 'Email del administrador del sistema')
ON CONFLICT (key) DO NOTHING;

-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_payment_history_building ON payment_history(building_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_date ON payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_notification_logs_building ON notification_logs(building_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_date ON notification_logs(sent_at);