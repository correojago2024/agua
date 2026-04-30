-- Añadir la columna referrer a la tabla de visitas
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS referrer TEXT;

-- Asegurar que la política de actualización siga vigente
DROP POLICY IF EXISTS "Allow update for visitor_logs" ON public.visitor_logs;
CREATE POLICY "Allow update for visitor_logs" ON public.visitor_logs 
    FOR UPDATE 
    USING (true) 
    WITH CHECK (true);
