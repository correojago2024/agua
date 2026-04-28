-- SCRIPT DEFINITIVO FINAL: Actualización de Columnas y Planes (2026-04-28)

-- 1. Agregar todas las columnas necesarias si no existen
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS notified_90_storage BOOLEAN DEFAULT FALSE;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS notified_100_storage BOOLEAN DEFAULT FALSE;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'basico';

-- 2. Migrar registros de 'empresarial' a 'premium' en la tabla de edificios
UPDATE buildings SET subscription_plan = 'premium' WHERE subscription_plan = 'empresarial';

-- 3. CAMBIO DE NOMBRE EN LA TABLA DE PRECIOS (Pestaña Planes del Admin)
-- Esto corrige que aparezca "Empresarial" en la lista de precios
UPDATE plan_precios SET nombre = 'Premium' WHERE plan_id = 'premium';
UPDATE plan_precios SET nombre = 'Premium' WHERE plan_id = 'empresarial';
-- Asegurar que el ID sea consistente si se usa 'premium' ahora
UPDATE plan_precios SET plan_id = 'premium' WHERE plan_id = 'empresarial';

-- 4. Comentarios de las columnas para el sistema
COMMENT ON COLUMN buildings.subscription_plan IS 'Plan: basico, profesional, premium, ia';
COMMENT ON COLUMN buildings.notified_90_storage IS 'Aviso 90% tiempo agotado';
COMMENT ON COLUMN buildings.notified_100_storage IS 'Aviso 100% tiempo agotado (FIFO activo)';
