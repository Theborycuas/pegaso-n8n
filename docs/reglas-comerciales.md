# Reglas comerciales

Reglas de negocio que aplica hoy el bot, con el archivo donde vive cada una. Cuando cambie una regla, edita el archivo indicado y actualiza esta página.

> ⚠️ marca reglas que hoy están **inconsistentes entre nodos**. El detalle está en [pendientes-tecnicos.md](pendientes-tecnicos.md).

## 1. A quién responde el bot

| Caso | Comportamiento | Dónde |
|---|---|---|
| Cliente registrado (contacto con `cliente_id`) | No responde; el flujo termina | IF "¿Cliente existente?" |
| Prospecto con `requiere_humano = true` | No responde; ya lo atiende una persona | IF "¿Requiere atención humana?" |
| Mensaje que no es texto (imagen, audio, documento…) | No responde | `01-entrada/preparar-entrada-whatsapp.js` |
| `MODO_PRUEBA` activo | Solo responde a `telefonos_permitidos` | `03-conversacion/resolver-permiso-automatizacion.js` |

### MODO_PRUEBA

Configuración en PostgreSQL (clave `MODO_PRUEBA`, columna `valor_json`):

```json
{ "activo": true, "telefonos_permitidos": ["593999999999"] }
```

- Los teléfonos se comparan **solo con dígitos y exactos**: guárdalos con prefijo `593`, sin `0` inicial ni `+`.
- Si no hay fila de configuración, se asume `activo: true` sin teléfonos (bloquea a todos).
- ⚠️ Si `valor_json` existe pero no trae `activo`, el bot queda **abierto** para todos.

## 2. Cantidad mínima

| Regla | Valor | Dónde |
|---|---|---|
| Mínimo de impresión | 1000 etiquetas por diseño o tamaño | `07-cotizacion/aplicar-minimo-impresion.js`, `04-cerebro-comercial/resolver-contexto-comercial.js` |
| Múltiplo | 1000 | mismos archivos |
| Cantidad faltante con medidas | se asume 1000 (`cantidad_asumida = true`) | mismos + `validar-extraccion-cerebro.js` |

Fórmula: `cantidad_cotizable = max(1000, ceil(cantidad / 1000) * 1000)`. Ejemplos: 300 → 1000, 1500 → 2000, 2300 → 3000.

Texto al cliente: *"La cantidad mínima de impresión es de 1000 etiquetas por diseño o tamaño y trabajamos en múltiplos de 1000. Si cambia una letra o palabra ya se considera otro diseño."*

## 3. Medidas mínimas producibles

⚠️ Hoy conviven dos umbrales:

| Nodo | Regla | Efecto |
|---|---|---|
| `04-cerebro-comercial/validar-extraccion-cerebro.js` | lado ≤ 1 cm | exige acción `MEDIDA_NO_PRODUCIBLE` |
| `04-cerebro-comercial/aplicar-reglas-comerciales.js` | lado ≤ 1 cm | fuerza `RESPONDER_NO_PRODUCIBLE` |
| `07-cotizacion/validar-producibilidad-p4.js` | lado **< 2 cm** | bloquea la cotización completa |
| `07-cotizacion/calcular-precio-detalle.js` | lado < 2 cm | lanza error |

Mensaje al cliente (`construir-mensaje-no-producible.js`): *"La medida de AxB cm no es posible de producir. No trabajamos etiquetas que tengan 1 cm o menos en cualquiera de sus lados. Indíquenos otra medida y con gusto le cotizamos."*

Un solo detalle no producible bloquea **toda** la cotización. No hay medida máxima.

## 4. Catálogo

Definido en código en `07-cotizacion/resolver-catalogo-pegaso.js`.

**Materiales**

| id | Clave | Nombre | Precio automático |
|---|---|---|---|
| 1 | P4 | Polipropileno P4 | Sí |
| 2 | COUCHE | Papel couché | No (manual) |
| 3 | CARTULINA | Papel cartulina para carpetas | No |
| 4 | TRANSPARENTE | Adhesivo transparente | No |
| 5 | METALIZADO | Adhesivo metalizado | No |
| 6 | BOND | Papel Bond para libretines/talonarios | No |

Sin material indicado se usa P4. ⚠️ Hoy el material nunca llega a este nodo, así que **todo se cotiza como P4**.

**Productos**: 1 Etiqueta genérica · 2 Etiqueta rectangular · 3 Etiqueta troquelada · 4 Etiqueta redondeada · 5 Adhesivo transparente · 6 Adhesivo metalizado · 7 Adhesivo ecológico · 8 Papel couché adhesivo · 9 Cartulina carpetas · 10 Bond libretines · 11 Bond talonarios.

Con P4 el producto sale de la forma: rectangular → 2, troquelada/irregular → 3, redondeada → 4, otra → 1.

## 5. Formas

| Contexto | Valores |
|---|---|
| Cerebro comercial (schema) | `RECTANGULAR`, `CIRCULAR`, `REDONDEADA`, `TROQUELADA`, `NO_ESPECIFICADA` |
| Extractor de cotización (schema) | `RECTANGULAR`, `CUADRADA`, `CIRCULAR`, `IRREGULAR`, `NO_ESPECIFICADA` |
| Cálculo de precio (normaliza a) | `RECTANGULAR` (incluye cuadrada y vacía), `REDONDEADA`, `CIRCULAR`, `TROQUELADA` |

En el cálculo, cualquier forma no reconocida se trata como `TROQUELADA` (la más cara).

## 6. Precio

Fuente única: `07-cotizacion/calcular-precio-detalle.js`, sección **"1. POLÍTICA CENTRAL DE PRECIOS PEGASO"**. Moneda USD; los precios se expresan por cada 1000 etiquetas.

**Paso 1 · Precios fijos** (ganan sobre todo lo demás; no les afecta forma ni volumen):

| Medida | Precio por 1000 |
|---|---|
| Ambos lados ≥ 2 y < 4 cm | $18 |
| Exactamente 4 × 4 cm | $20 |

**Paso 2 · Medidas de cálculo** (si no hubo precio fijo):

- Exactamente 5 × 5 cm → +1 cm por lado.
- Forma circular, redondeada o troquelada → +1 cm por lado (se acumula con la anterior).

**Paso 3 · Factor**, en orden de prioridad:

| Condición | Factor |
|---|---|
| Cantidad ≥ 10.000 | 0,50 |
| Ambos lados originales ≥ 10 cm | 0,67 |
| General | 0,72 |

**Paso 4 · Cálculo**

```
precio_1000  = ancho_calculo × alto_calculo × factor
precio_total = precio_1000 × cantidad / 1000 − descuento     (descuento en USD, por defecto 0)
total        = ceil(precio_total)                            (redondeo hacia arriba al dólar)
subtotal     = total / 1,15 ;  iva = total − subtotal        (IVA 15% incluido, no se muestra)
```

**Ejemplos (1000 unidades)**

| Medida | Cálculo | Total |
|---|---|---|
| 3 × 3 | precio fijo | $18 |
| 4 × 4 | precio fijo | $20 |
| 10 × 5 rectangular | 10 × 5 × 0,72 = 36 | $36 |
| 5 × 5 rectangular | 6 × 6 × 0,72 = 25,92 | $26 |
| 5 × 5 circular | 7 × 7 × 0,72 = 35,28 | $36 |
| 10 × 10 rectangular | 10 × 10 × 0,67 | $67 |
| 10 × 10, 10.000 unidades | 50 por mil × 10 | $500 |

No existe vigencia de cotización ni descuentos comerciales automáticos.

## 7. Mensaje de cotización

Archivo: `07-cotizacion/preparar-mensaje-cotizacion.js`. Se envían dos mensajes:

```
Le adjunto la cotización:

-1.000 Etiquetas adhesivas de 10x5 cm rectangulares le saldrían en $36.00 dólares

Adjúntenos su diseño para verificarle por favor
```

```
El precio se calcula en base a las medidas de la etiqueta. Si aumenta o disminuye las medidas, el precio también varía.
```

- Si se ajustó la cantidad a múltiplos de 1000 (y no fue asumida), se agrega la línea *"Trabajamos únicamente en múltiplos de 1000 unidades…"*.
- Reglas de presentación: no mostrar nombre largo del producto, ni línea "Total", ni "IVA incluido", ni repetir material, ni cerrar con "Si está de acuerdo…".

## 8. Diseños

Archivo: `07-cotizacion/resolver-diseno.js`. Un diseño existente se reutiliza si coinciden cliente, material, ancho, alto, forma y nombre (sin distinguir mayúsculas) y está activo. Si no, se crea uno nuevo. ⚠️ El campo `sabor` no se compara.

## 9. Clasificación de prospectos A/B/C

Archivos: `04-cerebro-comercial/normalizar-decision-ia.js` y `03-conversacion/preparar-contexto-ia.js`. **La clasificación nunca baja**: se toma la mayor entre la anterior, la de la IA y el mínimo por intención.

| Clase | Por estado del prospecto | Mínimo por intención |
|---|---|---|
| **A** (cierre) | INTERESADO, ACEPTADO, PAGO_PENDIENTE, ABONO_REPORTADO, EN_PROCESO | ACEPTAR_COTIZACION, CONFIRMAR_PEDIDO, REPORTAR_PAGO, o motivo SOLICITA_DATOS_PAGO / ENVIA_COMPROBANTE |
| **B** (interesado) | COTIZADO, CALIFICADO, EN_SEGUIMIENTO, CONTACTADO | COTIZAR_P4 o cualquier CONSULTAR_* (precio, material, mínimo, ubicación, metodología, entrega, diseño, pago) |
| **C** (frío) | cualquier otro, incluido NUEVO | — |

## 10. Intenciones y acciones

La IA elige **una intención** y **una acción** (`schemas/cerebro-comercial.schema.json`). El Switch "Enrutar acción comercial" usa la acción.

**Intenciones**: SOLICITAR_COTIZACION, APORTAR_DATOS, CONSULTAR_PRECIO, CONSULTAR_MATERIAL, CONSULTAR_MINIMO, CONSULTAR_UBICACION, CONSULTAR_METODOLOGIA, CONSULTAR_ENTREGA, CONSULTAR_DISENO, ACEPTAR_COTIZACION, CONSULTAR_PAGO, REPORTAR_PAGO, CONFIRMAR_PEDIDO, SOLICITAR_LLAMADA, SOLICITAR_HUMANO, POSPONER_DECISION, NEGOCIAR, RECLAMO, OTRO.

| Acción | Intención requerida | Rama |
|---|---|---|
| COTIZAR_P4 | con medidas y cantidad; clasificación ≠ C | 07 Cotización |
| PEDIR_MEDIDAS | falta alguna medida | 05 Respuesta |
| PEDIR_PRODUCTO | sin producto ni medidas | 05 Respuesta |
| PEDIR_FORMA | forma NO_ESPECIFICADA y sin medidas | 05 Respuesta |
| INFORMAR_MATERIAL / MINIMO / UBICACION / METODOLOGIA / ENTREGA / DISENO | CONSULTAR_ correspondiente | 05 Respuesta |
| INFORMAR_METODOLOGIA_PAGO | CONSULTAR_PAGO | 05 Respuesta |
| REGISTRAR_ACEPTACION | ACEPTAR_COTIZACION, clasificación A | 05 Respuesta |
| RESPONDER_GENERAL | OTRO, APORTAR_DATOS, POSPONER_DECISION | 05 Respuesta |
| MEDIDA_NO_PRODUCIBLE ⚠️ | lado ≤ 1 cm | 05 Respuesta |
| DERIVAR_HUMANO | REPORTAR_PAGO, CONFIRMAR_PEDIDO, SOLICITAR_LLAMADA, SOLICITAR_HUMANO, NEGOCIAR, RECLAMO (obligatorio); CONSULTAR_PAGO concreto | 06 Derivación |

⚠️ `MEDIDA_NO_PRODUCIBLE` no está en el enum del schema ni en el prompt, y `RESPONDER_NO_PRODUCIBLE` (de `aplicar-reglas-comerciales.js`) no tiene salida en el Switch.

### Cómo se decide la acción final

La IA propone; `04-cerebro-comercial/resolver-contexto-comercial.js` decide, en este orden:

1. Requiere humano → `DERIVAR_HUMANO`.
2. Acción informativa de la IA (INFORMAR_*, REGISTRAR_ACEPTACION, RESPONDER_GENERAL) → se respeta.
3. Faltan medidas y la intención es cotizar/consultar precio/aportar datos → `PEDIR_MEDIDAS` con texto fijo *"¿En qué medidas necesita sus etiquetas? Indíquenos ancho y alto por favor."*
4. Datos suficientes e intención SOLICITAR_COTIZACION o CONSULTAR_PRECIO → `COTIZAR_P4`.
5. Datos suficientes, APORTAR_DATOS y algún dato cambió respecto a la cotización guardada → `COTIZAR_P4` (recotiza).
6. Datos suficientes y la IA eligió COTIZAR_P4 → `COTIZAR_P4`.

Los datos nuevos del mensaje ganan; si faltan, se usan los de la cotización guardada en `contexto_comercial`. Con medidas y sin forma se asume `RECTANGULAR`.

## 11. Estados del prospecto

⚠️ Hay dos catálogos distintos:

| Nodo | Estados |
|---|---|
| `05-respuesta-comercial/resolver-estado-prospecto.js` (lanza error con otros) | NUEVO, EN_CONVERSACION, COTIZADO, PEDIDO_CONFIRMADO, REQUIERE_HUMANO |
| `normalizar-decision-ia.js`, `preparar-contexto-ia.js` (para A/B/C) | INTERESADO, ACEPTADO, PAGO_PENDIENTE, ABONO_REPORTADO, EN_PROCESO, COTIZADO, CALIFICADO, EN_SEGUIMIENTO, CONTACTADO |

Transiciones automáticas actuales:

- Al crear el prospecto → `NUEVO`.
- Primera respuesta comercial → `EN_CONVERSACION`.
- Cotización enviada → `COTIZADO`.
- Derivación humana → `requiere_humano = true` (el bot deja de responder).

## 12. Tono de las respuestas

Validado en `validar-extraccion-cerebro.js` y limpiado en `normalizar-decision-ia.js`:

- Sin el emoji 😊.
- No empezar con "Perfecto", "Entendemos", "Con gusto le explico" ni "Con mucho gusto".
- No repetir exactamente el último mensaje enviado por el bot. Si pasa, se reemplaza por *"¿Qué parte desea que revisemos o aclaremos por favor?"*.
- Trato de "usted".
