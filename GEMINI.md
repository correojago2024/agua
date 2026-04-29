# Contexto del Proyecto: aGuaSaaS

## Estado del Proyecto (29 de abril, 2026 - Actualización 3)

### Resumen de Actualizaciones Recientes
- **Implementación de Respaldo Manual:** Se completó la funcionalidad de respaldo manual en el Panel Admin (`/admin`). Ahora, al expandir un edificio, se muestra una sección de **Respaldos de Base de Datos** que permite:
  - Generar un nuevo respaldo JSON en tiempo real (almacenado en el bucket `backups` de Supabase Storage).
  - Listar todos los respaldos históricos del edificio.
  - Descargar respaldos directamente al equipo local.
  - Eliminar respaldos antiguos.
  - Registro automático en la bitácora de auditoría para cada operación de backup.
- **Corrección UI Admin:** Se tradujeron etiquetas que estaban en chino ("基本信息" → "Información Básica") y se mejoró la visualización de la tabla de edificios con ajustes de `colSpan` y espaciado.
- **Integración de Auditoría:** Se vinculó el sistema de backups con `logAudit` para asegurar que cada descarga o generación sea rastreable.

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
