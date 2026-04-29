# Contexto del Proyecto: aGuaSaaS

## Estado del Proyecto (29 de abril, 2026 - Actualización 5)
### Resumen de Actualizaciones Recientes
- **Corrección de Formato y Zona Horaria (Fecha/Hora):**
  - Se corrigió el formato de entrada en el formulario del edificio para respetar el estándar local del navegador (evitando forzar esquemas que alteren el orden dd/mm/aaaa).
  - Se implementó una gestión robusta de la zona horaria: el formulario ahora captura el offset local del usuario para asegurar que la hora registrada sea exactamente la que el usuario ve, evitando desviaciones a UTC en los emails.
  - Se actualizó el API route (`/api/measurements`) para procesar correctamente los strings de fecha locales y preservar la hora exacta en los reportes por email y alertas de anomalías.
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
...

  - Se corrigió el error donde al intentar descargar un respaldo JSON se abría el contenido en una nueva ventana del navegador en lugar de descargarse.
  - **Cambio Técnico:** Se agregó la opción `{ download: true }` a la función `createSignedUrl` en `/api/backups` para forzar el encabezado `Content-Disposition: attachment`.
  - **Mejora UI:** Se actualizó la función `downloadBackup` en el Panel Admin (`/admin`) y se implementó en el Panel de Edificio (`/edificio-admin/[slug]`) utilizando un enlace oculto dinámico para asegurar la descarga del archivo.
  - **Consistencia:** Se añadió el botón de descarga en la tabla de historial de respaldos dentro de `/edificio-admin/[slug]`, que anteriormente solo permitía la eliminación.
- **Implementación de Respaldo Manual:** (Anteriormente implementado) ...


### Estrategia de Respaldos Supabase (Implementada)
1. **Respaldo Manual:** Botón "CREAR RESPALDO MANUAL AHORA" en el Panel Admin que invoca `/api/backups` (POST action: 'generate').
2. **Almacenamiento:** Los archivos se guardan en la ruta `{building_id}/{timestamp}_backup.json` dentro del bucket privado `backups`.
3. **Consolidación de Datos:** El backup incluye `buildings`, `measurements`, `building_settings`, `building_ia_settings`, `building_whatsapp_settings` y `resident_subscriptions`.

### Arquitectura de Frontend (Next.js 15)
... (resto igual)

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
