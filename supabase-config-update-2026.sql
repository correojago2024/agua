-- Migración: Agregar campos de configuración de emails y umbrales
ALTER TABLE building_settings 
ADD COLUMN IF NOT EXISTS emails_on_subscription INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS prevention_threshold NUMERIC DEFAULT 60,
ADD COLUMN IF NOT EXISTS rationing_threshold NUMERIC DEFAULT 40;

-- Comentarios para documentación
COMMENT ON COLUMN building_settings.emails_on_subscription IS 'Cantidad de emails que recibe un usuario al suscribirse tras reportar';
COMMENT ON COLUMN building_settings.prevention_threshold IS 'Umbral de nivel para prevención (default 60%)';
COMMENT ON COLUMN building_settings.rationing_threshold IS 'Umbral de nivel para racionamiento (default 40%)';
