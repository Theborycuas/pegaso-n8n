-- ======================================================
-- Insistencia a leads de anuncio · Sprint 3: purga a 180 días
-- Roadmap: docs/ROADMAP-INSISTENCIA-LEADS-ANUNCIO.md (fase 5)
--
-- Requiere schema/seguimientos-leads.sql aplicado.
-- Ejecutar en PostgreSQL ANTES de publicar el workflow:
-- "Anonimizar leads inactivos" usa prospectos.anonimizado_at.
-- La purga nace APAGADA y en simulación.
--
-- Idempotente: se puede ejecutar más de una vez.
-- ======================================================

BEGIN;

-- Marca de anonimización: el prospecto ya no tiene datos personales.
ALTER TABLE pegaso.prospectos
  ADD COLUMN IF NOT EXISTS anonimizado_at timestamptz NULL;

-- La purga borra las llamadas a IA por conversación.
CREATE INDEX IF NOT EXISTS ix_ia_llamadas_conversacion
  ON pegaso.ia_llamadas (conversacion_id)
  WHERE conversacion_id IS NOT NULL;

-- ------------------------------------------------------
-- Configuración (nace APAGADA y en simulación)
-- ------------------------------------------------------
-- activo: interruptor general.
-- simulacion: true = solo cuenta candidatos, no modifica nada.
-- dias_inactividad: días sin mensajes para anonimizar.
-- lote: máximo de prospectos por ejecución.
-- hora_local: hora de Ecuador en que corre (una vez al día).

-- La secuencia de ids puede ir atrasada (filas con id explícito).
SELECT setval(
  pg_get_serial_sequence('pegaso.configuracion_bot', 'id'),
  COALESCE((SELECT max(id) FROM pegaso.configuracion_bot), 0) + 1,
  false
);

INSERT INTO pegaso.configuracion_bot (clave, valor_json)
VALUES (
  'PURGA_DATOS_LEADS',
  '{
    "activo": false,
    "simulacion": true,
    "dias_inactividad": 180,
    "lote": 500,
    "hora_local": 3
  }'::jsonb
)
ON CONFLICT (clave) DO NOTHING;

COMMIT;
