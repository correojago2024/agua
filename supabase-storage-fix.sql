-- SCRIPT DEFINITIVO: Actualización de Columnas y Planes (2026-04-28)

-- 1. Agregar todas las columnas necesarias si no existen
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS notified_90_storage BOOLEAN DEFAULT FALSE;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS notified_100_storage BOOLEAN DEFAULT FALSE;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'basico';

-- 2. Actualizar el plan a 'premium' para edificios que tengan 'empresarial' o 'Prueba' 
-- según lo solicitado para el edificio del usuario
UPDATE buildings SET subscription_plan = 'premium' WHERE subscription_plan = 'empresarial';
-- Si el edificio específico 13408559 debe ser Premium, asegúrate de que su subscription_plan sea 'premium'
-- Puedes hacerlo por ID si lo conoces, o por slug.

-- 3. Si quieres que los edificios con status 'Prueba' pasen a plan 'premium'
-- UPDATE buildings SET subscription_plan = 'premium' WHERE subscription_status = 'Prueba';

-- 4. Comentarios de las columnas
COMMENT ON COLUMN buildings.subscription_plan IS 'Plan: basico, profesional, premium, ia';
COMMENT ON COLUMN buildings.notified_90_storage IS 'Aviso 90% tiempo agotado';
COMMENT ON COLUMN buildings.notified_100_storage IS 'Aviso 100% tiempo agotado (FIFO activo)';
