-- ============================================================
-- CONFIGURACIÓN DE WHATSAPP PARA EDIFICIOS
-- ============================================================

-- 1. Tabla de credenciales de WhatsApp (Global o por Proveedor)
CREATE TABLE IF NOT EXISTS whatsapp_credentials (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, -- Ej: 'Green-API Principal'
  service_type TEXT NOT NULL CHECK (service_type IN ('GREENAPI', 'WHAPI')),
  instance_id TEXT,    -- Para Green API
  api_token TEXT NOT NULL,
  api_url TEXT,       -- Opcional, para Green API
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Configuración específica por edificio
CREATE TABLE IF NOT EXISTS building_whatsapp_settings (
  building_id UUID PRIMARY KEY REFERENCES buildings(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT FALSE,
  preferred_service TEXT DEFAULT 'GREENAPI' CHECK (preferred_service IN ('GREENAPI', 'WHAPI')),
  
  -- Umbrales configurables
  threshold_caution NUMERIC DEFAULT 60,
  threshold_rationing NUMERIC DEFAULT 40,
  threshold_critical NUMERIC DEFAULT 20,
  
  -- Control de envío para no repetir alertas del mismo umbral continuamente
  last_threshold_notified NUMERIC, -- Guarda el último umbral cruzado (20, 40 o 60)
  
  -- Miembros de la junta (Números de teléfono separados por coma o JSON)
  -- Formato: 584161234567,584127654321
  junta_phones TEXT,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de cola/log de WhatsApp (Similar a email_queue)
CREATE TABLE IF NOT EXISTS whatsapp_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  recipient_phone TEXT NOT NULL,
  message_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Insertar credenciales iniciales de Green API (basado en tu script)
INSERT INTO whatsapp_credentials (name, service_type, instance_id, api_token, api_url)
VALUES ('Green-API aGuaSaaS', 'GREENAPI', '7107580078', '428eaebbd79840ad8b3e1fe59fa507ef78d05a28e23043f6b4', 'https://7107.api.greenapi.com')
ON CONFLICT DO NOTHING;

-- 5. Insertar credenciales iniciales de Whapi
INSERT INTO whatsapp_credentials (name, service_type, api_token, api_url)
VALUES ('Whapi Cloud aGuaSaaS', 'WHAPI', 'ixyftJEkEQIRb26mp6gd4yhLrt1QUIu7', 'https://gate.whapi.cloud')
ON CONFLICT DO NOTHING;
