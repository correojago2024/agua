# Contexto del Proyecto: AquaSAAS

## Estado de la Integración de Mensajería (24 de abril, 2026)

### Objetivo Actual
Implementar el envío de mensajes de WhatsApp para alertas de nivel de tanque y notificaciones de contacto.

### Decisiones Técnicas
- **Proveedor:** Se utilizará **Green API** (pendiente de confirmar credenciales).
- **Estructura:** Replicar el patrón de `email.ts`:
  - Tabla `whatsapp_credentials` en Supabase para `idInstance` y `apiTokenInstance`.
  - Tabla `whatsapp_queue` para registro y reintentos de mensajes.
  - Servicio centralizado en `src/lib/server/whatsapp.ts`.

### Progreso
- [x] Investigación de la estructura actual de emails y Supabase.
- [x] Configuración de persistencia del agente (Memoria + GEMINI.md).
- [x] Creación de tablas de WhatsApp en Supabase (`supabase-whatsapp-setup.sql`).
- [x] Creación del servicio `whatsapp.ts` con soporte para Green API y Whapi.
- [ ] Integración en `api/measurements` para alertas de umbral.
- [ ] Integración en `api/contact`.
- [ ] Creación de interfaz UI para configuración de umbrales.

### Notas Importantes
- El proyecto usa Next.js 16 con App Router.
- Las credenciales de email se gestionan en la tabla `email_credentials`.
- El administrador del sistema es `correojago@gmail.com`.
