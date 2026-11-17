-- OBLIGATORIO antes de publicar la segunda entrega (eficiencia y avisos persistentes).
-- "Marcar prospecto requiere humano" y "Guardar contexto comercial" escriben en estas tablas:
-- sin ellas fallan la derivación y el guardado del contexto. Es idempotente.
CREATE TABLE IF NOT EXISTS pegaso.notificaciones_humano (
  id bigserial PRIMARY KEY,
  prospecto_id bigint NOT NULL REFERENCES pegaso.prospectos(id),
  conversacion_id bigint REFERENCES pegaso.conversaciones(id),
  evento_clave text NOT NULL,
  payload jsonb NOT NULL,
  estado text NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'ENVIANDO', 'ENVIADA')),
  intentos integer NOT NULL DEFAULT 0,
  reserva text,
  reservada_hasta timestamptz,
  proximo_intento_at timestamptz NOT NULL DEFAULT now(),
  creada_at timestamptz NOT NULL DEFAULT now(),
  enviada_at timestamptz,
  ultimo_error text,
  UNIQUE (prospecto_id, evento_clave)
);
CREATE INDEX IF NOT EXISTS ix_notificaciones_pendientes
  ON pegaso.notificaciones_humano (proximo_intento_at, id) WHERE estado <> 'ENVIADA';
CREATE INDEX IF NOT EXISTS ix_mensajes_conversacion_id
  ON pegaso.mensajes (conversacion_id, id DESC);
CREATE INDEX IF NOT EXISTS ix_mensajes_entrantes_pendientes
  ON pegaso.mensajes (conversacion_id, enviado_at)
  WHERE direccion = 'ENTRANTE' AND procesado IS NOT TRUE;

CREATE TABLE IF NOT EXISTS pegaso.metricas_preventa (
  id bigserial PRIMARY KEY,
  mensaje_externo_id text NOT NULL UNIQUE,
  conversacion_id bigint NOT NULL REFERENCES pegaso.conversaciones(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  calificacion text NOT NULL,
  accion text NOT NULL,
  cache_faq boolean NOT NULL,
  cerebro_requerido boolean NOT NULL,
  caracteres_contexto integer NOT NULL,
  duracion_preparacion_ms integer NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_metricas_preventa_fecha ON pegaso.metricas_preventa (creado_at);

-- Comprobación posterior: debe devolver 2.
-- SELECT COUNT(*) FROM information_schema.tables
-- WHERE table_schema = 'pegaso' AND table_name IN ('notificaciones_humano', 'metricas_preventa');
