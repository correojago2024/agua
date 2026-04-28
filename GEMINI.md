# Contexto del Proyecto: aGuaSaaS

## Estado del Proyecto (24 de abril, 2026)

### Resumen de Integración
El sistema de monitoreo de agua aGuaSaaS está plenamente operativo con integraciones de Email (Gmail API) y WhatsApp (Green API/Whapi/Meta).

### Últimas Mejoras Realizadas (28 de abril, 2026 - II)
- **Gestión de Planes y Nomenclatura:**
  - Se renombró el plan **"Empresarial"** a **"Premium"** en todo el sistema (Frontend, Backend, Admin Panel).
  - Se corrigió la inconsistencia en la visualización del plan actual en el portal del edificio, priorizando el campo `subscription_plan` sobre `subscription_status`.
- **Límites de Almacenamiento por Tiempo (Historial):**
  - Se migró el sistema de almacenamiento de un límite basado en cantidad de registros a un límite basado en **tiempo (días/meses)**.
  - **Plan Básico/Esencial:** Historial de 90 días (3 meses).
  - **Plan Profesional:** Historial de 120 días.
  - **Plan Premium:** Historial de 365 días (12 meses).
  - **Plan IA:** Historial de 730 días (24 meses).
- **Sistema de Alertas de Almacenamiento:**
  - Implementación de notificaciones automáticas al alcanzar el **90%** del tiempo límite del plan.
  - Notificación final al alcanzar el **100%** del límite, informando sobre el inicio de la política FIFO.
  - Estas notificaciones se envían una sola vez por ciclo para evitar spam al administrador.
- **Política FIFO de Autolimpieza:**
  - El sistema ahora elimina automáticamente los registros que exceden el plazo contratado según el plan del edificio al recibir una nueva medición.
- **Base de Datos:**
  - Se actualizó `supabase-storage-fix.sql` para incluir explícitamente `notified_90_storage` y evitar errores de ejecución.
  - Se renombró el archivo de respaldo `src/app/admin/page.tsx.bak` para evitar interferencias en el despliegue.
- **Visualización:**
  - Se forzó la visualización de "PREMIUM" incluso si en la base de datos aún existe el valor "empresarial" por compatibilidad.

### Últimas Mejoras Realizadas (28 de abril, 2026 - I)
- **Email de Anomalías:**
  - Se rediseñó y mejoró el email de alerta por anomalías (variaciones bruscas).
  - Ahora incluye explicación detallada: dato anterior, dato registrado, variación absoluta y porcentual, y el criterio (umbral) utilizado para disparar la alerta.
  - El diseño es más visual y profesional, facilitando la detección de fugas o errores de registro.
  - Consolidación del template en `lib/server/email-templates.ts` para facilitar el mantenimiento.
- **Configuración de Anomalías:**
  - Se agregaron controles en el panel de administración para habilitar/deshabilitar alertas de anomalía.
  - Se permite configurar el umbral de variación porcentual personalizado por edificio.
  - Estas funciones están restringidas a edificios con plan **Profesional** o superior.
- **Gestión de Planes:**
  - Se añadió la visualización clara del plan actual en la pestaña de configuración.
  - Se implementó un sistema de solicitud de cambio de plan mediante un formulario modal.
  - El sistema captura metadatos de seguridad (IP, navegador, hora local) en la solicitud.
  - Envío automático de email de confirmación al usuario y email de solicitud detallada al administrador (correojago@gmail.com).
- **Email Report:**
  - Se eliminó el gráfico Gauge para optimizar la visualización de los 16 gráficos de inteligencia hídrica restantes.
  - Se estandarizó el formato de fecha y hora en todas las tablas y reportes a `dd/mm/aaaa hh:mm AM/PM`.
  - El diseño es 100% responsivo y mantiene toda la información detallada de indicadores y variaciones.
- **Análisis por IA (Nuevo):**
  - Nueva pestaña "Análisis IA" en el panel de administración de edificios.
  - Generación de informes técnicos detallados utilizando inteligencia artificial (Gemini 2.0 Flash).
  - Configuración de envío automático (Manual, Semanal, Mensual, Trimestral) y destinatarios personalizados.
  - Reportes visualmente mejorados en la plataforma y en correos electrónicos.
  - Integración de gráficos de tendencia, nivel y consumo en los informes enviados por email.
  - Sistema de historial de reportes generados.
- **WhatsApp Integration:**
  - Integración completa en `api/measurements` para alertas automáticas por umbrales (Precaución, Racionamiento, Crítico).
  - Integración en `api/contact` para notificaciones inmediatas al administrador ante nuevos mensajes.
  - Interfaz de administración funcional para configurar credenciales y umbrales por edificio.
- **Base de Datos:**
  - Esquema actualizado para soportar Meta Business API y credenciales personalizadas por edificio mediante `supabase-whatsapp-updates.sql`.

### Tareas Pendientes
- [ ] Validar el funcionamiento de las alertas de WhatsApp con credenciales reales de Green API/Meta.
- [ ] Implementar sistema de facturación y gestión de pagos para edificios con suscripción activa.
- [ ] Optimizar la carga de gráficos históricos en el dashboard principal.

### Notas Técnicas
- **Frontend:** Next.js 16 (App Router) + TypeScript + Vanilla CSS / Tailwind.
- **Backend:** Supabase (PostgreSQL + Auth + Storage).
- **Servicios:** 
  - `whatsapp.ts`: Maneja múltiples proveedores de mensajería.
  - `email.ts`: Envío masivo de reportes vía Gmail.
  - `email-templates.ts`: Generación dinámica de reportes con 16 gráficos y mapas de calor.
