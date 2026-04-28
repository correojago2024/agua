# Contexto del Proyecto: aGuaSaaS

## Estado del Proyecto (28 de abril, 2026)

### Resumen de Actualizaciones Recientes
- **Estandarización Global de Formatos:** Se implementó `src/lib/formatters.ts` para asegurar que en TODA la plataforma los números usen punto para miles y coma para decimales (ej: 1.234,56) y las fechas usen el formato `dd/mm/aaaa`.
- **Corrección en Emails:** Se corrigió el bug de la tabla de "Últimos 10 registros" que mostraba datos antiguos. Ahora se ordenan cronológicamente de forma descendente (más reciente primero).
- **Optimización de Gráficos:** Se implementó un sistema de enriquecimiento de datos en `src/lib/charts.ts` que calcula variaciones y caudales faltantes en tiempo real, evitando que los gráficos aparezcan vacíos cuando no hay datos pre-calculados en la base de datos.
- **Formulario de Residentes:** Se mejoró la claridad del campo de fecha/hora para indicar explícitamente el formato esperado `dd/mm/aaaa`.

### Estrategia de Respaldos Supabase (Propuesta)
1. **Respaldo Manual:** Implementar un botón en el Panel Admin que dispare un Edge Function de Supabase para generar un dump SQL y guardarlo en Storage.
2. **Respaldo Automático:** Configurar un GitHub Action con Cron Job (frecuencia ajustable) que use la CLI de Supabase para realizar el dump y subirlo a un bucket externo o repositorio privado.
3. **Restauración:** Procedimiento documentado usando `psql` o la CLI de Supabase para cargar los dumps generados.
4. **Destinos Independientes:** Almacenamiento cruzado entre cuentas de Supabase o servicios externos (AWS S3/Google Cloud Storage) para mitigar riesgos de baneo de cuenta principal.

### Arquitectura de Frontend (Next.js 15)
- **Rutas Principales:**
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
