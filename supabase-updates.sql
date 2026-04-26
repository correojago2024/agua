-- ============================================================
-- SCRIPT: Actualizar tabla buildings para sistema de pruebas y suscripciones
-- ============================================================

-- 1. Agregar campos necesarios
ALTER TABLE buildings 
ADD COLUMN IF NOT EXISTS trial_start_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS trial_end_date DATE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'Prueba' CHECK (subscription_status IN ('Prueba', 'Activo', 'Suspendido', 'Cancelado')),
ADD COLUMN IF NOT EXISTS custom_rate DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS last_notification_sent DATE,
ADD COLUMN IF NOT EXISTS notification_3days_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_suspended_sent BOOLEAN DEFAULT FALSE;

-- 2. Actualizar registros existentes que no tienen trial_end_date
UPDATE buildings 
SET trial_end_date = trial_start_date + INTERVAL '15 days'
WHERE trial_end_date IS NULL AND status = 'Prueba';

-- 3. Crear tabla de templates de emails
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
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
('trial_3days', '⚠️ Tu período de prueba termina en 3 días - aGuaSaaS', 
'Estimado administrador,

Tu período de prueba del sistema aGuaSaaS para {building_name} termina el {trial_end_date}.

Te Esperamos que hayas disfrutado del servicio. Recuerda que te quedan 3 días de uso gratuito para decidir si deseas continuar.

Para activar tu edificio y seguir usando el sistema, contacta al administrador: correojago@gmail.com

Saludos,
Equipo aGuaSaaS'),

('building_suspended', '🚫 Edificio pausado - aGuaSaaS',
'Estimado administrador,

Tu edificio {building_name} ha sido pausado y no recibirá más datos de mediciones hasta tanto se solucione la situación de renovación/pago.

Para reactivar tu edificio, contacta al administrador: correojago@gmail.com

Saludos,
Equipo aGuaSaaS'),

('trial_expired', '📅 Período de prueba terminado - aGuaSaaS',
'Estimado administrador,

El período de prueba de tu edificio {building_name} ha terminado.

El sistema ha sido pausado. Para renovar el servicio, contacta al administrador: correojago@gmail.com

Saludos,
Equipo aGuaSaaS')
ON CONFLICT (name) DO NOTHING;

-- 5. Crear tabla de logs de notificaciones
CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  building_id UUID REFERENCES buildings(id),
  email_type TEXT NOT NULL,
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

-- 6. Crear índice para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_buildings_trial_end ON buildings(trial_end_date);
CREATE INDEX IF NOT EXISTS idx_buildings_status ON buildings(subscription_status);