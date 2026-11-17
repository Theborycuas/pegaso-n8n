# STATUSIA, logging de IA, Groq TPM y vasos/oz

**Estado:** implementado en local, sin publicar en n8n ni commit.  
**Requisito DB:** ejecutar `schema/ia_llamadas.sql` en Postgres **antes** de que el logging inserte filas.

## 1. Groq está fallando (capturas)

| Qué se ve | Causa |
|---|---|
| `Request too large… TPM Limit 6000. Requested 16855` | El Chat Model `openai/gpt-oss-20b` (Groq) recibe ~16k tokens (prompt cerebro + schema + historial). La capa free solo admite **6000 TPM**. |
| `valid: false` / `Falta el campo obligatorio: intencion` | El Information Extractor no devolvió JSON: Groq rechazó el request; el validador marca inválido y cae a DeepSeek → OpenAI. |

**Mitigación en este cambio:** historial del cerebro más corto (`MAX_MENSAJES_HISTORIAL` 24→10, largo 4000→700) + más FAQs pre-IA (menos llamadas a Groq).  
**Si sigue fallando:** subir plan Groq (Dev Tier) o cambiar a un modelo con mayor TPM; el tamaño del prompt del Information Extractor sigue siendo alto.

## 2. Contacto 50086 — vasos 7 oz → “Permítame…”

El mensaje *“Necesito para los vasos de 7 onzas circular…”* activaba `PRODUCTO_NO_P4` (lema `vasos`) y terminaba en handoff.

| Cambio | Efecto |
|---|---|
| Preparar contexto IA **4.24** | Envase + oz/ml ya no es NO_P4; FAQ `ENVASE_VOLUMEN` → `PEDIR_MEDIDAS` |
| Resolver **3.35** | Misma red de seguridad: pide **ancho y alto en cm** y **foto del envase** |

Texto fijo: pedir cm (no bastan onzas) + foto con regla / área a etiquetar.

## 3. Logging de IAs + comando STATUSIA

Antes **no** se guardaban request/response de los cerebros.

| Pieza | Rol |
|---|---|
| `schema/ia_llamadas.sql` | Tabla `pegaso.ia_llamadas` |
| `Preparar registro IA` + `Insertar log IA` | Tras cada intento Groq/DeepSeek/OpenAI (y si fallan los tres) |
| `STATUSIA` (admin WhatsApp) | Igual que ACTIVEBOT: arma email día/semana/mes vía Brevo→Resend |

Uso:

```text
STATUSIA
```

Desde un teléfono administrador. El correo va a los mismos destinatarios que las derivaciones humanas.

Campos útiles del reporte: intentos OK/fallo por proveedor, conteo de fallback (DeepSeek/OpenAI), suma de `tokens_estimados` cuando el Chat Model los expone.

## 4. Nodos / versiones

| Nodo | Cambio |
|---|---|
| Preparar contexto IA | 4.23 → **4.24** |
| Resolver contexto comercial | 3.34 → **3.35** |
| Procesar comando BOT | 2.0 → **2.1** (`STATUSIA`) |
| IF: ¿Comando administrador? | Acepta `STATUSIA` |
| IF: ¿Comando STATUSIA? | Nuevo |
| Consultar uso IA STATUSIA | Nuevo (Postgres) |
| Preparar reporte STATUSIA | Nuevo |
| Preparar registro IA / Insertar log IA | Nuevos |

## 5. Checklist al publicar

1. Correr `schema/ia_llamadas.sql` en la DB de Pegaso.  
2. `.\scripts\push.ps1` (cuando autorices publicar).  
3. Probar: mensaje tipo “vasos de 7 onzas…” → pide cm + foto.  
4. Probar: `STATUSIA` desde admin → email (puede ir vacío hasta que haya logs).  
5. Revisar una ejecución con cerebro: fila en `pegaso.ia_llamadas`.

## 6. Diagnóstico 2026-11-16 — correo vacío

**Causa:** en producción la consulta falló con  
`relation "pegaso.ia_llamadas" does not exist`.  
El nodo tiene `onError: continueRegularOutput`, así que el flujo igual armó el email y puso “sin registros” en día/semana/mes.

**Qué hacer ahora (en este orden):**

1. Ejecutar en Postgres el contenido de `schema/ia_llamadas.sql` (crear tabla + índices).  
2. Publicar el fix del reporte (V1.2) que muestra el error real en el correo si vuelve a fallar.  
3. Esperar al menos un chat que pase por el cerebro (Groq/DeepSeek/OpenAI) para que `Insertar log IA` escriba filas.  
4. Volver a enviar `STATUSIA`.

Sin el paso 1 el logging también falla en silencio (mismo `onError` en el INSERT).
