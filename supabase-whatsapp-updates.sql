-- ============================================================
-- SCRIPT: Actualización de Esquema de WhatsApp (Meta Business + Credenciales por Edificio)
-- ============================================================

-- 1. Actualizar restricciones en whatsapp_credentials
ALTER TABLE whatsapp_credentials 
DROP CONSTRAINT IF EXISTS whatsapp_credentials_service_type_check;

ALTER TABLE whatsapp_credentials 
ADD CONSTRAINT whatsapp_credentials_service_type_check 
CHECK (service_type IN ('GREENAPI', 'WHAPI', 'BUSINESS'));

-- 2. Añadir phone_number_id a whatsapp_credentials
ALTER TABLE whatsapp_credentials 
ADD COLUMN IF NOT EXISTS phone_number_id TEXT;

-- 3. Actualizar restricciones en building_whatsapp_settings
ALTER TABLE building_whatsapp_settings 
DROP CONSTRAINT IF EXISTS building_whatsapp_settings_preferred_service_check;

ALTER TABLE building_whatsapp_settings 
ADD CONSTRAINT building_whatsapp_settings_preferred_service_check 
CHECK (preferred_service IN ('GREENAPI', 'WHAPI', 'BUSINESS'));

-- 4. Añadir campos de credenciales específicas por edificio
ALTER TABLE building_whatsapp_settings 
ADD COLUMN IF NOT EXISTS wa_instance_id TEXT,
ADD COLUMN IF NOT EXISTS wa_api_token TEXT,
ADD COLUMN IF NOT EXISTS wa_api_url TEXT,
ADD COLUMN IF NOT EXISTS wa_business_phone_number_id TEXT;

-- 5. Comentario de ayuda
COMMENT ON TABLE building_whatsapp_settings IS 'Configuración de WhatsApp y umbrales por edificio. Permite credenciales propias o compartidas.';
