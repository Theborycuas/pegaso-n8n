-- DROP SCHEMA pegaso;

CREATE SCHEMA pegaso AUTHORIZATION "n8nPegaso";

-- DROP SEQUENCE pegaso.categorias_cliente_id_seq;

CREATE SEQUENCE pegaso.categorias_cliente_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.cliente_categorias_id_seq;

CREATE SEQUENCE pegaso.cliente_categorias_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.clientes_id_seq;

CREATE SEQUENCE pegaso.clientes_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.configuracion_bot_id_seq;

CREATE SEQUENCE pegaso.configuracion_bot_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.contactos_id_seq;

CREATE SEQUENCE pegaso.contactos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.conversaciones_id_seq;

CREATE SEQUENCE pegaso.conversaciones_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.cotizacion_detalles_id_seq;

CREATE SEQUENCE pegaso.cotizacion_detalles_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.cotizaciones_id_seq;

CREATE SEQUENCE pegaso.cotizaciones_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.despachos_id_seq;

CREATE SEQUENCE pegaso.despachos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.disenos_id_seq;

CREATE SEQUENCE pegaso.disenos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.empresas_id_seq;

CREATE SEQUENCE pegaso.empresas_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.interacciones_id_seq;

CREATE SEQUENCE pegaso.interacciones_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.materiales_id_seq;

CREATE SEQUENCE pegaso.materiales_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.mensajes_id_seq;

CREATE SEQUENCE pegaso.mensajes_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.pagos_id_seq;

CREATE SEQUENCE pegaso.pagos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.pedido_detalles_id_seq;

CREATE SEQUENCE pegaso.pedido_detalles_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.pedidos_id_seq;

CREATE SEQUENCE pegaso.pedidos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.plantillas_mensaje_id_seq;

CREATE SEQUENCE pegaso.plantillas_mensaje_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.producciones_id_seq;

CREATE SEQUENCE pegaso.producciones_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.productos_id_seq;

CREATE SEQUENCE pegaso.productos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.prospectos_id_seq;

CREATE SEQUENCE pegaso.prospectos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE pegaso.reglas_precio_id_seq;

CREATE SEQUENCE pegaso.reglas_precio_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;-- pegaso.categorias_cliente definition

-- Drop table

-- DROP TABLE pegaso.categorias_cliente;

CREATE TABLE pegaso.categorias_cliente (
	id bigserial NOT NULL,
	nombre varchar(100) NOT NULL,
	descripcion text NULL,
	activo bool DEFAULT true NULL,
	creado_at timestamptz DEFAULT now() NULL,
	CONSTRAINT categorias_cliente_nombre_key UNIQUE (nombre),
	CONSTRAINT categorias_cliente_pkey PRIMARY KEY (id)
);


-- pegaso.configuracion_bot definition

-- Drop table

-- DROP TABLE pegaso.configuracion_bot;

CREATE TABLE pegaso.configuracion_bot (
	id bigserial NOT NULL,
	clave varchar(100) NOT NULL,
	valor_json jsonb NOT NULL,
	actualizado_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT configuracion_bot_clave_key UNIQUE (clave),
	CONSTRAINT configuracion_bot_pkey PRIMARY KEY (id)
);


-- pegaso.empresas definition

-- Drop table

-- DROP TABLE pegaso.empresas;

CREATE TABLE pegaso.empresas (
	id bigserial NOT NULL,
	nombre varchar(200) NOT NULL,
	razon_social varchar(250) NULL,
	ruc varchar(20) NULL,
	ciudad varchar(100) NULL,
	provincia varchar(100) NULL,
	direccion text NULL,
	tipo_negocio varchar(150) NULL,
	notas text NULL,
	activo bool DEFAULT true NOT NULL,
	creado_at timestamptz DEFAULT now() NOT NULL,
	actualizado_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT empresas_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ux_empresas_ruc ON pegaso.empresas USING btree (ruc) WHERE ((ruc IS NOT NULL) AND (TRIM(BOTH FROM ruc) <> ''::text));


-- pegaso.materiales definition

-- Drop table

-- DROP TABLE pegaso.materiales;

CREATE TABLE pegaso.materiales (
	id bigserial NOT NULL,
	nombre varchar(150) NOT NULL,
	descripcion text NULL,
	activo bool DEFAULT true NULL,
	requiere_cotizacion_manual bool DEFAULT false NULL,
	notas text NULL,
	CONSTRAINT materiales_pkey PRIMARY KEY (id)
);


-- pegaso.plantillas_mensaje definition

-- Drop table

-- DROP TABLE pegaso.plantillas_mensaje;

CREATE TABLE pegaso.plantillas_mensaje (
	id bigserial NOT NULL,
	nombre varchar(150) NOT NULL,
	categoria varchar(80) NULL,
	contenido text NOT NULL,
	activo bool DEFAULT true NULL,
	orden int4 DEFAULT 0 NULL,
	creado_at timestamptz DEFAULT now() NULL,
	actualizado_at timestamptz DEFAULT now() NULL,
	CONSTRAINT plantillas_mensaje_pkey PRIMARY KEY (id)
);


-- pegaso.prospectos definition

-- Drop table

-- DROP TABLE pegaso.prospectos;

CREATE TABLE pegaso.prospectos (
	id bigserial NOT NULL,
	telefono varchar(30) NOT NULL,
	nombre_whatsapp varchar(150) NULL,
	canal varchar(30) DEFAULT 'WHATSAPP'::character varying NOT NULL,
	origen varchar(50) NULL,
	fuente varchar(100) NULL,
	estado varchar(30) DEFAULT 'NUEVO'::character varying NOT NULL,
	producto_interes varchar(255) NULL,
	ciudad varchar(100) NULL,
	provincia varchar(100) NULL,
	ultima_intencion varchar(50) NULL,
	ultima_accion varchar(50) NULL,
	requiere_humano bool DEFAULT false NOT NULL,
	activo bool DEFAULT true NOT NULL,
	creado_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	actualizado_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT prospectos_pkey PRIMARY KEY (id),
	CONSTRAINT uq_prospectos_telefono_canal UNIQUE (telefono, canal)
);


-- pegaso.reglas_precio definition

-- Drop table

-- DROP TABLE pegaso.reglas_precio;

CREATE TABLE pegaso.reglas_precio (
	id bigserial NOT NULL,
	nombre varchar(150) NOT NULL,
	tipo varchar(50) NOT NULL,
	valor numeric(10, 4) NULL,
	unidad varchar(30) NULL,
	descripcion text NULL,
	activo bool DEFAULT true NULL,
	creado_at timestamptz DEFAULT now() NULL,
	actualizado_at timestamptz DEFAULT now() NULL,
	CONSTRAINT reglas_precio_pkey PRIMARY KEY (id)
);


-- pegaso.clientes definition

-- Drop table

-- DROP TABLE pegaso.clientes;

CREATE TABLE pegaso.clientes (
	id bigserial NOT NULL,
	nombre varchar(200) NOT NULL,
	tipo_cliente varchar(30) DEFAULT 'PERSONA'::character varying NULL,
	identificacion varchar(20) NULL,
	telefono varchar(30) NULL,
	whatsapp varchar(30) NULL,
	email varchar(200) NULL,
	direccion text NULL,
	ciudad varchar(100) NULL,
	provincia varchar(100) NULL,
	activo bool DEFAULT true NULL,
	notas text NULL,
	empresa_id int8 NULL,
	CONSTRAINT clientes_pkey PRIMARY KEY (id),
	CONSTRAINT clientes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES pegaso.empresas(id)
);
CREATE UNIQUE INDEX ux_clientes_identificacion ON pegaso.clientes USING btree (identificacion) WHERE ((identificacion IS NOT NULL) AND (TRIM(BOTH FROM identificacion) <> ''::text));


-- pegaso.contactos definition

-- Drop table

-- DROP TABLE pegaso.contactos;

CREATE TABLE pegaso.contactos (
	id bigserial NOT NULL,
	cliente_id int8 NOT NULL,
	nombre varchar(200) NOT NULL,
	telefono varchar(30) NULL,
	whatsapp varchar(30) NULL,
	email varchar(200) NULL,
	cargo varchar(100) NULL,
	es_principal bool DEFAULT false NULL,
	activo bool DEFAULT true NULL,
	notas text NULL,
	CONSTRAINT contactos_pkey PRIMARY KEY (id),
	CONSTRAINT fk_contacto_cliente FOREIGN KEY (cliente_id) REFERENCES pegaso.clientes(id)
);


-- pegaso.conversaciones definition

-- Drop table

-- DROP TABLE pegaso.conversaciones;

CREATE TABLE pegaso.conversaciones (
	id bigserial NOT NULL,
	cliente_id int8 NULL,
	contacto_id int8 NULL,
	telefono varchar(30) NOT NULL,
	canal varchar(30) DEFAULT 'WHATSAPP'::character varying NULL,
	estado varchar(30) DEFAULT 'ACTIVA'::character varying NULL,
	ultimo_mensaje_at timestamptz NULL,
	creada_at timestamptz DEFAULT now() NULL,
	prospecto_id int8 NULL,
	contexto_comercial jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT conversaciones_pkey PRIMARY KEY (id),
	CONSTRAINT fk_conversaciones_cliente FOREIGN KEY (cliente_id) REFERENCES pegaso.clientes(id),
	CONSTRAINT fk_conversaciones_contacto FOREIGN KEY (contacto_id) REFERENCES pegaso.contactos(id),
	CONSTRAINT fk_conversaciones_prospecto FOREIGN KEY (prospecto_id) REFERENCES pegaso.prospectos(id)
);
CREATE INDEX idx_conversaciones_prospecto_id ON pegaso.conversaciones USING btree (prospecto_id);


-- pegaso.cotizaciones definition

-- Drop table

-- DROP TABLE pegaso.cotizaciones;

CREATE TABLE pegaso.cotizaciones (
	id bigserial NOT NULL,
	cliente_id int8 NULL,
	contacto_id int8 NULL,
	estado varchar(30) DEFAULT 'PENDIENTE'::character varying NULL,
	fecha_cotizacion timestamptz DEFAULT now() NULL,
	subtotal numeric(12, 2) NULL,
	iva numeric(12, 2) NULL,
	descuento numeric(12, 2) DEFAULT 0 NULL,
	total numeric(12, 2) NULL,
	observaciones text NULL,
	CONSTRAINT chk_cotizaciones_estado CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'ENVIADA'::character varying, 'ACEPTADA'::character varying, 'RECHAZADA'::character varying, 'VENCIDA'::character varying, 'CANCELADA'::character varying])::text[]))),
	CONSTRAINT cotizaciones_pkey PRIMARY KEY (id),
	CONSTRAINT fk_cotizaciones_cliente FOREIGN KEY (cliente_id) REFERENCES pegaso.clientes(id),
	CONSTRAINT fk_cotizaciones_contacto FOREIGN KEY (contacto_id) REFERENCES pegaso.contactos(id)
);


-- pegaso.disenos definition

-- Drop table

-- DROP TABLE pegaso.disenos;

CREATE TABLE pegaso.disenos (
	id bigserial NOT NULL,
	cliente_id int8 NOT NULL,
	material_id int8 NULL,
	nombre varchar(200) NOT NULL,
	codigo varchar(100) NULL,
	ancho_cm numeric(10, 2) NOT NULL,
	alto_cm numeric(10, 2) NOT NULL,
	forma varchar(30) DEFAULT 'RECTANGULAR'::character varying NULL,
	"version" int4 DEFAULT 1 NULL,
	archivo_original text NULL,
	activo bool DEFAULT true NULL,
	notas text NULL,
	CONSTRAINT disenos_pkey PRIMARY KEY (id),
	CONSTRAINT fk_disenos_cliente FOREIGN KEY (cliente_id) REFERENCES pegaso.clientes(id),
	CONSTRAINT fk_disenos_material FOREIGN KEY (material_id) REFERENCES pegaso.materiales(id)
);


-- pegaso.mensajes definition

-- Drop table

-- DROP TABLE pegaso.mensajes;

CREATE TABLE pegaso.mensajes (
	id bigserial NOT NULL,
	conversacion_id int8 NOT NULL,
	cliente_id int8 NULL,
	direccion varchar(20) NOT NULL,
	tipo varchar(30) DEFAULT 'TEXTO'::character varying NULL,
	contenido text NULL,
	mensaje_externo_id varchar(150) NULL,
	enviado_at timestamptz DEFAULT now() NULL,
	procesado bool DEFAULT false NULL,
	CONSTRAINT mensajes_pkey PRIMARY KEY (id),
	CONSTRAINT fk_mensajes_cliente FOREIGN KEY (cliente_id) REFERENCES pegaso.clientes(id),
	CONSTRAINT fk_mensajes_conversacion FOREIGN KEY (conversacion_id) REFERENCES pegaso.conversaciones(id)
);
CREATE UNIQUE INDEX uq_mensajes_mensaje_externo_id ON pegaso.mensajes USING btree (mensaje_externo_id) WHERE (mensaje_externo_id IS NOT NULL);


-- pegaso.pedidos definition

-- Drop table

-- DROP TABLE pegaso.pedidos;

CREATE TABLE pegaso.pedidos (
	id bigserial NOT NULL,
	cliente_id int8 NOT NULL,
	cotizacion_id int8 NULL,
	estado varchar(30) DEFAULT 'PENDIENTE'::character varying NULL,
	fecha_pedido timestamptz DEFAULT now() NULL,
	subtotal numeric(12, 2) NULL,
	iva numeric(12, 2) NULL,
	descuento numeric(12, 2) DEFAULT 0 NULL,
	total numeric(12, 2) NULL,
	porcentaje_abono numeric(5, 2) DEFAULT 50 NULL,
	valor_abonado numeric(12, 2) DEFAULT 0 NULL,
	valor_saldo numeric(12, 2) DEFAULT 0 NULL,
	observaciones text NULL,
	CONSTRAINT chk_pedidos_estado CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'CONFIRMADO'::character varying, 'EN_PRODUCCION'::character varying, 'TERMINADO'::character varying, 'DESPACHADO'::character varying, 'ENTREGADO'::character varying, 'EN_ESPERA'::character varying, 'CANCELADO'::character varying])::text[]))),
	CONSTRAINT pedidos_pkey PRIMARY KEY (id),
	CONSTRAINT fk_pedidos_cliente FOREIGN KEY (cliente_id) REFERENCES pegaso.clientes(id),
	CONSTRAINT fk_pedidos_cotizacion FOREIGN KEY (cotizacion_id) REFERENCES pegaso.cotizaciones(id)
);


-- pegaso.productos definition

-- Drop table

-- DROP TABLE pegaso.productos;

CREATE TABLE pegaso.productos (
	id bigserial NOT NULL,
	nombre varchar(200) NOT NULL,
	descripcion text NULL,
	tipo varchar(80) NOT NULL,
	material_id int8 NULL,
	activo bool DEFAULT true NULL,
	creado_at timestamptz DEFAULT now() NULL,
	actualizado_at timestamptz DEFAULT now() NULL,
	CONSTRAINT productos_pkey PRIMARY KEY (id),
	CONSTRAINT fk_productos_material FOREIGN KEY (material_id) REFERENCES pegaso.materiales(id)
);


-- pegaso.cliente_categorias definition

-- Drop table

-- DROP TABLE pegaso.cliente_categorias;

CREATE TABLE pegaso.cliente_categorias (
	id bigserial NOT NULL,
	cliente_id int8 NOT NULL,
	categoria_id int8 NOT NULL,
	creado_at timestamptz DEFAULT now() NULL,
	CONSTRAINT cliente_categorias_pkey PRIMARY KEY (id),
	CONSTRAINT uq_cliente_categoria UNIQUE (cliente_id, categoria_id),
	CONSTRAINT fk_cliente_categorias_categoria FOREIGN KEY (categoria_id) REFERENCES pegaso.categorias_cliente(id),
	CONSTRAINT fk_cliente_categorias_cliente FOREIGN KEY (cliente_id) REFERENCES pegaso.clientes(id)
);


-- pegaso.cotizacion_detalles definition

-- Drop table

-- DROP TABLE pegaso.cotizacion_detalles;

CREATE TABLE pegaso.cotizacion_detalles (
	id bigserial NOT NULL,
	cotizacion_id int8 NOT NULL,
	material_id int8 NULL,
	diseno_id int8 NULL,
	descripcion varchar(300) NULL,
	cantidad int4 NOT NULL,
	ancho_cm numeric(10, 2) NOT NULL,
	alto_cm numeric(10, 2) NOT NULL,
	forma varchar(30) DEFAULT 'RECTANGULAR'::character varying NULL,
	precio_unitario numeric(12, 4) NULL,
	precio_total numeric(12, 2) NULL,
	descuento numeric(12, 2) DEFAULT 0 NULL,
	requiere_cotizacion_manual bool DEFAULT false NULL,
	observaciones text NULL,
	producto_id int8 NULL,
	CONSTRAINT cotizacion_detalles_pkey PRIMARY KEY (id),
	CONSTRAINT fk_cotizacion_detalle_producto FOREIGN KEY (producto_id) REFERENCES pegaso.productos(id),
	CONSTRAINT fk_cotizacion_detalles_cotizacion FOREIGN KEY (cotizacion_id) REFERENCES pegaso.cotizaciones(id),
	CONSTRAINT fk_cotizacion_detalles_diseno FOREIGN KEY (diseno_id) REFERENCES pegaso.disenos(id),
	CONSTRAINT fk_cotizacion_detalles_material FOREIGN KEY (material_id) REFERENCES pegaso.materiales(id)
);


-- pegaso.despachos definition

-- Drop table

-- DROP TABLE pegaso.despachos;

CREATE TABLE pegaso.despachos (
	id bigserial NOT NULL,
	pedido_id int8 NOT NULL,
	tipo_despacho varchar(30) DEFAULT 'TRANSPORTE'::character varying NULL,
	empresa_transporte varchar(150) NULL,
	numero_guia varchar(100) NULL,
	destinatario varchar(200) NULL,
	cedula_destinatario varchar(20) NULL,
	ciudad varchar(100) NULL,
	direccion text NULL,
	telefono varchar(30) NULL,
	costo_envio numeric(12, 2) DEFAULT 0 NULL,
	estado varchar(30) DEFAULT 'PENDIENTE'::character varying NULL,
	fecha_despacho timestamptz NULL,
	fecha_entrega timestamptz NULL,
	observaciones text NULL,
	CONSTRAINT chk_despachos_estado CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PREPARANDO'::character varying, 'DESPACHADO'::character varying, 'EN_TRANSITO'::character varying, 'ENTREGADO'::character varying, 'CANCELADO'::character varying])::text[]))),
	CONSTRAINT chk_despachos_tipo CHECK (((tipo_despacho)::text = ANY ((ARRAY['TRANSPORTE'::character varying, 'RETIRO_LOCAL'::character varying, 'ENTREGA_PROPIA'::character varying, 'OTRO'::character varying])::text[]))),
	CONSTRAINT despachos_pkey PRIMARY KEY (id),
	CONSTRAINT fk_despachos_pedido FOREIGN KEY (pedido_id) REFERENCES pegaso.pedidos(id)
);


-- pegaso.interacciones definition

-- Drop table

-- DROP TABLE pegaso.interacciones;

CREATE TABLE pegaso.interacciones (
	id bigserial NOT NULL,
	cliente_id int8 NULL,
	contacto_id int8 NULL,
	pedido_id int8 NULL,
	cotizacion_id int8 NULL,
	canal varchar(30) DEFAULT 'WHATSAPP'::character varying NULL,
	tipo varchar(50) NULL,
	mensaje text NULL,
	fecha_interaccion timestamptz DEFAULT now() NULL,
	notas text NULL,
	CONSTRAINT interacciones_pkey PRIMARY KEY (id),
	CONSTRAINT fk_interacciones_cliente FOREIGN KEY (cliente_id) REFERENCES pegaso.clientes(id),
	CONSTRAINT fk_interacciones_contacto FOREIGN KEY (contacto_id) REFERENCES pegaso.contactos(id),
	CONSTRAINT fk_interacciones_cotizacion FOREIGN KEY (cotizacion_id) REFERENCES pegaso.cotizaciones(id),
	CONSTRAINT fk_interacciones_pedido FOREIGN KEY (pedido_id) REFERENCES pegaso.pedidos(id)
);


-- pegaso.pagos definition

-- Drop table

-- DROP TABLE pegaso.pagos;

CREATE TABLE pegaso.pagos (
	id bigserial NOT NULL,
	pedido_id int8 NOT NULL,
	tipo varchar(30) DEFAULT 'ABONO'::character varying NULL,
	valor numeric(12, 2) NOT NULL,
	fecha_pago timestamptz DEFAULT now() NULL,
	metodo_pago varchar(50) NULL,
	referencia varchar(150) NULL,
	comprobante text NULL,
	estado varchar(30) DEFAULT 'REGISTRADO'::character varying NULL,
	notas text NULL,
	CONSTRAINT chk_pagos_estado CHECK (((estado)::text = ANY ((ARRAY['REGISTRADO'::character varying, 'CONFIRMADO'::character varying, 'ANULADO'::character varying])::text[]))),
	CONSTRAINT chk_pagos_metodo_pago CHECK (((metodo_pago IS NULL) OR ((metodo_pago)::text = ANY ((ARRAY['TRANSFERENCIA'::character varying, 'DEPOSITO'::character varying, 'EFECTIVO'::character varying, 'TARJETA'::character varying, 'OTRO'::character varying])::text[])))),
	CONSTRAINT chk_pagos_tipo CHECK (((tipo)::text = ANY ((ARRAY['ABONO'::character varying, 'SALDO'::character varying, 'PAGO_TOTAL'::character varying, 'DEVOLUCION'::character varying])::text[]))),
	CONSTRAINT pagos_pkey PRIMARY KEY (id),
	CONSTRAINT fk_pagos_pedido FOREIGN KEY (pedido_id) REFERENCES pegaso.pedidos(id)
);


-- pegaso.pedido_detalles definition

-- Drop table

-- DROP TABLE pegaso.pedido_detalles;

CREATE TABLE pegaso.pedido_detalles (
	id bigserial NOT NULL,
	pedido_id int8 NOT NULL,
	material_id int8 NULL,
	diseno_id int8 NULL,
	descripcion varchar(300) NULL,
	cantidad int4 NOT NULL,
	ancho_cm numeric(10, 2) NOT NULL,
	alto_cm numeric(10, 2) NOT NULL,
	forma varchar(30) DEFAULT 'RECTANGULAR'::character varying NULL,
	precio_unitario numeric(12, 4) NULL,
	precio_total numeric(12, 2) NULL,
	descuento numeric(12, 2) DEFAULT 0 NULL,
	requiere_cotizacion_manual bool DEFAULT false NULL,
	observaciones text NULL,
	producto_id int8 NULL,
	CONSTRAINT pedido_detalles_pkey PRIMARY KEY (id),
	CONSTRAINT fk_pedido_detalle_producto FOREIGN KEY (producto_id) REFERENCES pegaso.productos(id),
	CONSTRAINT fk_pedido_detalles_diseno FOREIGN KEY (diseno_id) REFERENCES pegaso.disenos(id),
	CONSTRAINT fk_pedido_detalles_material FOREIGN KEY (material_id) REFERENCES pegaso.materiales(id),
	CONSTRAINT fk_pedido_detalles_pedido FOREIGN KEY (pedido_id) REFERENCES pegaso.pedidos(id)
);


-- pegaso.producciones definition

-- Drop table

-- DROP TABLE pegaso.producciones;

CREATE TABLE pegaso.producciones (
	id bigserial NOT NULL,
	pedido_id int8 NOT NULL,
	estado varchar(40) DEFAULT 'PENDIENTE'::character varying NULL,
	fecha_inicio timestamptz NULL,
	fecha_impresion timestamptz NULL,
	fecha_terminado timestamptz NULL,
	fecha_despacho timestamptz NULL,
	responsable varchar(150) NULL,
	notas text NULL,
	pedido_detalle_id int8 NULL,
	CONSTRAINT chk_producciones_estado CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PREPARACION'::character varying, 'IMPRESION'::character varying, 'SECADO'::character varying, 'CORTE'::character varying, 'TROQUELADO'::character varying, 'ACABADOS'::character varying, 'CONTROL_CALIDAD'::character varying, 'TERMINADO'::character varying, 'CANCELADO'::character varying])::text[]))),
	CONSTRAINT producciones_pkey PRIMARY KEY (id),
	CONSTRAINT fk_producciones_pedido FOREIGN KEY (pedido_id) REFERENCES pegaso.pedidos(id),
	CONSTRAINT fk_producciones_pedido_detalle FOREIGN KEY (pedido_detalle_id) REFERENCES pegaso.pedido_detalles(id)
);