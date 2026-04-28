# Contexto del Proyecto: aGuaSaaS

## Estado del Proyecto (24 de abril, 2026)

### Resumen de Integración
El sistema de monitoreo de agua aGuaSaaS está plenamente operativo con integraciones de Email (Gmail API) y WhatsApp (Green API/Whapi/Meta).

### Últimas Mejoras Realizadas (28 de abril, 2026)
- **Email de Anomalías (Mejora Crítica):**
  - Se optimizó la explicación técnica en el email de anomalías para resolver confusiones del usuario.
  - El email ahora desglosa explícitamente:
    - **Dato Anterior:** Volumen en litros y porcentaje previo.
    - **Dato Registrado:** Volumen en litros y porcentaje nuevo.
    - **Variación Absoluta:** Diferencia neta en litros (+/-).
    - **Variación Porcentual Relativa:** El % exacto de cambio respecto al dato anterior que disparó la alerta.
    - **Criterio de Seguridad:** Explicación clara del umbral (threshold) configurado para el edificio.
  - Se añadieron posibles causas (fugas, llenado, errores manuales) para orientar al administrador.
  - Diseño visualmente jerarquizado para lectura rápida en móviles.

### Últimas Mejoras Realizadas (27 de abril, 2026)
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
