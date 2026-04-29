# Contexto del Proyecto: aGuaSaaS

## Estado del Proyecto (29 de abril, 2026)

### Resumen de Actualizaciones Recientes
- **Restauración de Gráficos en Emails:** Se corrigió un error en `src/lib/server/email-templates.ts` donde la galería de 16 gráficos se generaba pero no se incluía en el HTML final. Ahora aparecen correctamente antes de las tablas de datos.
- **Corrección Definitiva de Historial:** Se optimizó la consulta a Supabase en `src/app/api/measurements/route.ts` para obtener los últimos 2000 registros en orden descendente. Esto resuelve el problema de la tabla de "Últimas 10 mediciones" que mostraba datos antiguos (ej: marzo) debido al límite de filas de Supabase cuando se usaba orden ascendente.
- **Sincronización de Datos para Gráficos:** Al asegurar que se obtienen los datos más recientes en la API, los gráficos de QuickChart ahora cuentan con la serie histórica necesaria, evitando que aparezcan vacíos o solo con los ejes.
- **Estandarización Global de Formatos (28 de abr):** Se implementó `src/lib/formatters.ts` para asegurar que en TODA la plataforma los números usen punto para miles y coma para decimales (ej: 1.234,56) y las fechas usen el formato `dd/mm/aaaa`.

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
