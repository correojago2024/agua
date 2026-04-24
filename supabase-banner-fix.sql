-- ============================================================
-- SCRIPT: Reparación de Almacenamiento (Banners)
-- ============================================================

-- 1. Crear el bucket si no existe y hacerlo PÚBLICO
INSERT INTO storage.buckets (id, name, public)
VALUES ('building-banners', 'building-banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Permitir que cualquier usuario (incluyendo anónimos) vea las imágenes
CREATE POLICY "Banner Público Lectura"
ON storage.objects FOR SELECT
USING (bucket_id = 'building-banners');

-- 3. Permitir que usuarios autenticados suban imágenes
CREATE POLICY "Banner Subida Autenticada"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'building-banners');

-- 4. Permitir actualizar/borrar (por si acaso el admin cambia el banner)
CREATE POLICY "Banner Actualización Autenticada"
ON storage.objects FOR UPDATE
USING (bucket_id = 'building-banners');

CREATE POLICY "Banner Borrado Autenticado"
ON storage.objects FOR DELETE
USING (bucket_id = 'building-banners');
