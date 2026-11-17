-- ======================================================
-- Insistencia a leads de anuncio · Sprints 1 y 2
-- Roadmap: docs/ROADMAP-INSISTENCIA-LEADS-ANUNCIO.md
--
-- Ejecutar en PostgreSQL ANTES de publicar el workflow:
-- "Guardar mensaje entrante" escribe las columnas
-- ultimo_anuncio_* y seguimientos_prospecto, y falla si
-- no existen. La rutina queda apagada hasta activar
-- INSISTENCIA_LEADS en configuracion_bot.
--
-- Idempotente: se puede ejecutar más de una vez.
-- ======================================================

BEGIN;

-- ------------------------------------------------------
-- 1. Anuncio de Meta en el prospecto
-- ------------------------------------------------------
-- origen (columna existente) pasa a 'ANUNCIO_META' cuando
-- el primer mensaje del prospecto llega desde un anuncio.
-- ultimo_anuncio_* guarda el anuncio más reciente.

ALTER TABLE pegaso.prospectos
  ADD COLUMN IF NOT EXISTS ultimo_anuncio_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ultimo_anuncio_fuente varchar(30) NULL,
  ADD COLUMN IF NOT EXISTS ultimo_ctwa_clid text NULL;

CREATE INDEX IF NOT EXISTS ix_prospectos_ultimo_anuncio
  ON pegaso.prospectos (ultimo_anuncio_at)
  WHERE ultimo_anuncio_at IS NOT NULL;


-- ------------------------------------------------------
-- 2. Seguimientos (insistencia única)
-- ------------------------------------------------------
-- La usa el workflow programado del Sprint 2. Se crea
-- ahora para dejar la base lista.

CREATE TABLE IF NOT EXISTS pegaso.seguimientos_prospecto (
  id bigserial PRIMARY KEY,
  prospecto_id bigint NOT NULL REFERENCES pegaso.prospectos(id),
  conversacion_id bigint NOT NULL REFERENCES pegaso.conversaciones(id),
  tipo text NOT NULL DEFAULT 'INSISTENCIA_LEAD',
  estado text NOT NULL DEFAULT 'PROGRAMADO'
    CHECK (estado IN ('PROGRAMADO', 'ENVIANDO', 'ENVIADO', 'RESPONDIDO',
                      'RECHAZADO', 'SIN_RESPUESTA', 'EXPIRADO', 'CANCELADO', 'ERROR')),
  ultimo_mensaje_cliente_at timestamptz NOT NULL,
  ventana_cierra_at timestamptz NOT NULL,
  programado_para timestamptz NOT NULL,
  enviado_at timestamptz,
  mensaje_externo_id text,
  texto_enviado text,
  tipo_precio text,            -- free_entry_point / free_customer_service / regular
  respondido_at timestamptz,
  respuesta text,              -- SEG_SI / SEG_NO / TEXTO
  reserva text,
  reservada_hasta timestamptz,
  ultimo_error text,
  creado_at timestamptz NOT NULL DEFAULT now()
);

-- Un solo seguimiento vivo por prospecto (evita duplicados por concurrencia)
CREATE UNIQUE INDEX IF NOT EXISTS uq_seguimiento_vivo
  ON pegaso.seguimientos_prospecto (prospecto_id)
  WHERE estado IN ('PROGRAMADO', 'ENVIANDO', 'ENVIADO');

CREATE INDEX IF NOT EXISTS ix_seguimientos_programados
  ON pegaso.seguimientos_prospecto (programado_para)
  WHERE estado = 'PROGRAMADO';

CREATE INDEX IF NOT EXISTS ix_seguimientos_prospecto_creado
  ON pegaso.seguimientos_prospecto (prospecto_id, creado_at DESC);


-- ------------------------------------------------------
-- 3. Sprint 2: entrega y precio del envío
-- ------------------------------------------------------
-- mensaje_externo_id = id del mensaje en YCloud (respuesta
-- del envío); los webhooks whatsapp.message.updated lo usan
-- para registrar estado de entrega y precio cobrado.

ALTER TABLE pegaso.seguimientos_prospecto
  ADD COLUMN IF NOT EXISTS wamid text NULL,
  ADD COLUMN IF NOT EXISTS estado_entrega text NULL,
  ADD COLUMN IF NOT EXISTS categoria_precio text NULL,
  ADD COLUMN IF NOT EXISTS precio_total numeric(12, 6) NULL,
  ADD COLUMN IF NOT EXISTS moneda varchar(10) NULL;

CREATE INDEX IF NOT EXISTS ix_seguimientos_mensaje_externo
  ON pegaso.seguimientos_prospecto (mensaje_externo_id)
  WHERE mensaje_externo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_seguimientos_wamid
  ON pegaso.seguimientos_prospecto (wamid)
  WHERE wamid IS NOT NULL;


-- ------------------------------------------------------
-- 4. Sprint 2: configuración (nace APAGADA)
-- ------------------------------------------------------
-- activo: interruptor general. Sin esta fila no se envía nada.
-- telefonos_permitidos: si no está vacía, solo se insiste a
--   esos números (pruebas y piloto). MODO_PRUEBA también aplica.
-- franjas: hora de Ecuador [inicio, fin).
-- No se sobrescribe si ya existe.

-- La secuencia de ids puede ir atrasada si se cargaron filas con id
-- explícito (error "configuracion_bot_pkey ... Key (id)=(N) already
-- exists"). Se alinea con el id máximo antes de insertar.
SELECT setval(
  pg_get_serial_sequence('pegaso.configuracion_bot', 'id'),
  COALESCE((SELECT max(id) FROM pegaso.configuracion_bot), 0) + 1,
  false
);

INSERT INTO pegaso.configuracion_bot (clave, valor_json)
VALUES (
  'INSISTENCIA_LEADS',
  '{
    "activo": false,
    "telefonos_permitidos": [],
    "limite_diario": 20,
    "limite_por_corrida": 10,
    "espera_minima_horas": 4,
    "cierre_sin_respuesta_horas": 48,
    "max_mensajes_cliente": 2,
    "franjas": [["10:00", "12:30"], ["15:00", "16:00"], ["18:30", "20:30"]],
    "telefono_emisor": "593962645735",
    "producto_texto": "etiquetas adhesivas"
  }'::jsonb
)
ON CONFLICT (clave) DO NOTHING;

COMMIT;


-- ======================================================
-- Comprobación (después de publicar y recibir un lead
-- nuevo de anuncio):
--
-- SELECT id, telefono, origen, ultimo_anuncio_at,
--        ultimo_anuncio_fuente, ultimo_ctwa_clid IS NOT NULL AS tiene_clid
-- FROM pegaso.prospectos
-- WHERE ultimo_anuncio_at IS NOT NULL
-- ORDER BY ultimo_anuncio_at DESC
-- LIMIT 10;
-- ======================================================
