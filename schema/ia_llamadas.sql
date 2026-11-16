-- =====================================================
-- PEGASO: registro de llamadas a IA (cerebro / visión / etc.)
-- Ejecutar una vez en Postgres antes de publicar el logging.
-- Sirve al comando STATUSIA (reporte por email).
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS pegaso.ia_llamadas_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;

CREATE TABLE IF NOT EXISTS pegaso.ia_llamadas (
	id bigint NOT NULL DEFAULT nextval('pegaso.ia_llamadas_id_seq'::regclass),
	creado_at timestamptz NOT NULL DEFAULT now(),
	proveedor varchar(30) NOT NULL,
	rol varchar(40) NOT NULL DEFAULT 'CEREBRO',
	modelo varchar(80) NULL,
	exito bool NOT NULL DEFAULT false,
	es_fallback bool NOT NULL DEFAULT false,
	validation_reason text NULL,
	error_texto text NULL,
	tokens_estimados int NULL,
	tokens_prompt int NULL,
	tokens_completion int NULL,
	conversacion_id int8 NULL,
	prospecto_id int8 NULL,
	execution_id varchar(64) NULL,
	mensaje_resumen text NULL,
	request_resumen text NULL,
	response_json jsonb NULL,
	CONSTRAINT ia_llamadas_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_ia_llamadas_creado_at
	ON pegaso.ia_llamadas (creado_at DESC);

CREATE INDEX IF NOT EXISTS idx_ia_llamadas_proveedor_creado
	ON pegaso.ia_llamadas (proveedor, creado_at DESC);

COMMENT ON TABLE pegaso.ia_llamadas IS
	'Cada intento de IA (Groq/DeepSeek/OpenAI) en cerebro u otros roles; alimenta STATUSIA.';
