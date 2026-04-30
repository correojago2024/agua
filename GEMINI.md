# Contexto del Proyecto: aGuaSaaS

## Estado del Proyecto (30 de abril, 2026 - Actualización 7)
### Resumen de Actualizaciones Recientes (30 de abril, 2026)
- **Sistema de Rastreo de Visitantes e Inteligencia de Notificaciones (MEJORADO):**
  - Se implementó un sistema de monitoreo de actividad integral para detectar visitas en toda la plataforma.
  - **Tabla `visitor_logs`:** Almacena IP, Región, Ciudad, País, Dispositivo (UA), Idioma, URL visitada y **Referrer (Origen)**.
  - **Acción de Servidor (`recordVisit`):** Registra las visitas de forma asíncrona, capturando el origen del tráfico con limpieza inteligente de referrers (Google, Facebook, Instagram, etc.).
  - **Resumen de Email Enriquecido (NUEVO):** Se mejoró el cuerpo del email enviado a `correojago@gmail.com` para incluir: Ubicación detallada (Ciudad, Región, País), IP, Origen (Referrer), User Agent (UA) y enlaces directos a las URLs visitadas, con formato de fecha ajustado a la zona horaria de Caracas.
  - **Cobertura de Rastreo:** 
    - Landing Page Principal (`/`)
    - Formulario Público de Edificios (`/edificio/[slug]`)
    - Portal Administrativo de Edificios (`/edificio-admin/[slug]`)
  - **Notificaciones Inteligentes:** Se configuró un sistema que solo envía un email a `correojago@gmail.com` cuando se alcanza un umbral configurable de visitas acumuladas (ej. cada 10 o 20 visitas), optimizando la cuota de envío de Gmail.
  - **Integración Admin (DISEÑO REFINADO):** Se optimizó la pestaña **"📈 Visitas"** en el panel administrativo (`/admin`):
    - El gráfico de **Fuentes de Tráfico** ahora ocupa todo el ancho (`lg:col-span-2`) para mejor visualización.
    - Se añadió iconografía contextual (`Link`) en la tabla de visitantes para identificar rápidamente el origen.
    - Se incluyó limpieza de protocolos (`http/https`) en la visualización de la tabla para ahorrar espacio.
  - **Documentación SQL:** Se creó el archivo `supabase-visitor-referrer.sql` con los comandos necesarios para preparar la base de datos.

- **Corrección de Campo de Fecha y Hora (Editable):**
  - Se corrigió el problema en el formulario de entrada de datos (`src/app/edificio/[slug]/page.tsx`) donde el campo de fecha y hora no permitía modificaciones manuales fluidas.
  - Se cambió el tipo de input de `datetime-local` a `text` para garantizar compatibilidad total y permitir la edición mediante teclado en cualquier dispositivo.
  - Se implementó el formato exacto solicitado por el usuario: **dd/mm/aaaa hh:mm AM/PM**.
  - Se añadió la lógica de parseo (`parseDateTime`) en `lib/formatters.ts` para validar y convertir la entrada manual a formato ISO antes de enviarla a la API, manteniendo la integridad de los datos.
  - Se actualizó el panel de administración (`src/app/edificio-admin/[slug]/page.tsx`) para permitir también la corrección manual de la fecha y hora de las mediciones existentes directamente desde la tabla de historial, utilizando el mismo formato editable.
  - Se mantuvo la coherencia visual conservando las instrucciones de formato y las previsualizaciones dinámicas sin eliminar textos existentes.

## Estado del Proyecto (29 de abril, 2026 - Actualización 5)
### Resumen de Actualizaciones Recientes (29 de abril, 2026)
- **Restauración de Mensaje de Éxito (CRÍTICO):**
  - Se restauró el texto explicativo completo solicitado por el usuario en la confirmación de envío.
  - Se eliminaron iconos y estilos que distraían o modificaban la estructura del mensaje original.
  - Se incluyó la nota sobre el ciclo de 5 correos y el vínculo literal para otra respuesta.
- **Corrección de Formato de Fecha (dd/mm/aaaa):**
  - Se implementó un helper visual dinámico en el formulario que muestra la fecha en formato `dd/mm/aaaa hh:mm AM/PM` en tiempo real.
  - Esto soluciona la confusión visual cuando el navegador muestra `mm/dd/aaaa` por defecto, garantizando claridad absoluta para el usuario.
- **Corrección Definitiva de Formato y Zona Horaria (Fecha/Hora):**
  - Se unificó nuevamente el campo de fecha y hora en un solo input nativo (`datetime-local`) respondiendo a la solicitud del usuario de no tener campos separados.
  - Se configuró el atributo `lang="es-ES"` en el input para forzar al navegador a mostrar el formato **dd/mm/aaaa** (día/mes/año) siempre que la configuración regional lo permita.
  - Se refinó la utilidad `formatDateTime` y la lógica del servidor para tratar los strings de fecha como "literales", garantizando que la hora mostrada en los correos electrónicos sea idéntica a la ingresada por el usuario, eliminando cualquier desviación por la zona horaria UTC del servidor.
- **Corrección de Error de Compilación (API Route):**
  - Se corrigió la falta de importación de `formatDateTime` en `/api/measurements/route.ts` que causaba el fallo del build en Vercel.
- **Corrección de Formulario de Registro (Fecha/Hora):**
  - Se restauró la funcionalidad del campo de fecha y hora en el formulario público del edificio (`src/app/edificio/[slug]/page.tsx`).
  - Se eliminó el icono superpuesto y la clase `cursor-pointer` que interferían con la activación del selector nativo en varios navegadores.
  - Se simplificó la inicialización del campo para asegurar compatibilidad total.
- **Corrección de Error de Compilación (TypeScript):**
  - Se corrigió un error de tipo en `src/app/edificio-admin/[slug]/page.tsx` donde se intentaba asignar un array que podía contener valores `undefined` (ids de mediciones) a un estado que solo acepta `string[]`.
  - Se implementó un filtrado preventivo y verificaciones de existencia de IDs (`m.id && ...`) en las funciones de selección masiva y visualización de la tabla para asegurar la compatibilidad de tipos y evitar errores en tiempo de ejecución.
  - Se aseguró que `selectedMeasurements.includes(m.id)` solo se llame cuando `m.id` está definido.
- **Gestión de Anomalías (Mejorada):**
  - Se corrigió el error donde el cambio de estado de anomalía no se reflejaba inmediatamente en la UI mediante actualizaciones optimistas del estado local.
  - Se implementó la **selección múltiple de mediciones** para permitir el procesamiento por lotes.
  - Se añadieron botones para "Seleccionar todas las anomalías" y "Marcar seleccionadas como normales" masivamente.
  - Se habilitó la posibilidad de que los administradores de edificios marquen mediciones detectadas como anomalías como "Normales" (y viceversa).
  - Se añadió la función `toggleAnomaly` en el panel de edificio que permite alternar el estado de cualquier medición.
  - La tabla de mediciones en el panel de administración ahora muestra indicadores claros y permite la corrección manual del estado.
  - Los reportes por email ahora incluyen una columna de "Estado" que refleja si una medición es Normal o una Anomalía, respetando las correcciones manuales realizadas por la junta.
- **Corrección de Descarga de Respaldos:** 
  - Se corrigió el error donde al intentar descargar un respaldo JSON se abría el contenido en una nueva ventana del navegador en lugar de descargarse.
  - **Cambio Técnico:** Se agregó la opción `{ download: true }` a la función `createSignedUrl` en `/api/backups` para forzar el encabezado `Content-Disposition: attachment`.
  - **Mejora UI:** Se actualizó la función `downloadBackup` en el Panel Admin (`/admin`) y se implementó en el Panel de Edificio (`/edificio-admin/[slug]`) utilizando un enlace oculto dinámico para asegurar la descarga del archivo.
  - **Consistencia:** Se añadió el botón de descarga en la tabla de historial de respaldos dentro de `/edificio-admin/[slug]`, que anteriormente solo permitía la eliminación.
- **Implementación de Respaldo Manual:** Botón "CREAR RESPALDO MANUAL AHORA" en el Panel Admin que invoca `/api/backups` (POST action: 'generate').

### Estrategia de Respaldos Supabase (Implementada)
1. **Respaldo Manual:** Botón "CREAR RESPALDO MANUAL AHORA" en el Panel Admin que invoca `/api/backups` (POST action: 'generate').
2. **Almacenamiento:** Los archivos se guardan en la ruta `{building_id}/{timestamp}_backup.json` dentro del bucket privado `backups`.
3. **Consolidación de Datos:** El backup incluye `buildings`, `measurements`, `building_settings`, `building_ia_settings`, `building_whatsapp_settings` y `resident_subscriptions`.

### Arquitectura de Frontend (Next.js 15)
- **Rutas Públicas:**
  - `/edificio/[slug]`: Formulario público para que los residentes reporten niveles.
  - `/edificio-admin/[slug]`: Panel privado para la junta y administrador.
- **Componentes:**
  - `DashboardCharts.tsx`: 16 tipos de gráficos (Recharts para web).
  - `SystemStatsCharts.tsx`: Gráficos de uso del sistema.
- **Estado Global:** Uso intensivo de `useState` y `useEffect` con Supabase Realtime.

### Backend y Lógica de Negocio
- **Cálculos (`calculations.ts`):** Motor de indicadores (caudal, proyecciones, balances).
- **API (`/api/measurements`):** Orquestador central. Al recibir un dato:
  1. Guarda en Supabase.
  2. Verifica anomalías (alertas inmediatas).
  3. Genera 16 gráficos vía QuickChart.
  4. Envía emails enriquecidos a suscriptores activos.
  5. Actualiza bitácora de auditoría.
- **Servicios:** 
  - `whatsapp.ts`: Maneja múltiples proveedores de mensajería.
  - `email.ts`: Envío masivo de reportes vía Gmail.
  - `email-templates.ts`: Generación dinámica de reportes con mapas de calor.
