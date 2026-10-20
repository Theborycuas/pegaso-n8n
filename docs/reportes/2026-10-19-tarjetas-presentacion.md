# Tarjetas de presentación: catálogo de acabados con videos

**Fecha:** 19 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (build + edit). **No** publicado en n8n, sin commit ni `git push`. Flyers y afiches siguen derivando a humano.

Cuando el prospecto pide con claridad **tarjetas de presentación** (y no etiquetas), el bot saluda según la hora, envía los **4 videos de acabados** (con caption de precio) y cierra con una frase corta. Al final: *Los precios adjuntos no incluyen IVA*. Material, entregas y caras se responden después, cuando pregunte, sin mezclar con etiquetas.

---

## 1. Decisiones de Pegaso

| Tema | Decisión |
|---|---|
| Producto | Tarjetas de presentación (Couche 300 gr, 9×5 cm) |
| Acabados / precios (1000 u.) | UV brillante $24 · Mate $30 · Mate + UV selectivo $40 ($45 con puntas redondeadas) · Mate + Pan de Oro $95 ($100 con puntas) |
| Cantidad | 1000 por diseño; mismo diseño; no se divide |
| Caras | 1 o 2 caras, mismo precio |
| Entregas (no etiquetas) | Abono lun/mar → envío miércoles; mié/jue → viernes |
| Otros Couche 300 gr | Estampitas u otras medidas en múltiplos de 9×5 cm |
| Flyers / afiches | Siguen en `PRODUCTO_NO_P4` → humano (catálogo más adelante) |
| Mezcla etiqueta + tarjeta | No cotizar P4 ni enviar catálogo; aclarar producto |

## 2. Flujo

```mermaid
flowchart TD
  A[Mensaje pide tarjetas] --> B{Catálogo ya enviado?}
  B -->|No| C[Saludo horario]
  C --> D[4 videos + caption]
  D --> E[Le adjunto videos y precios...]
  B -->|Sí| F{Qué pregunta?}
  F -->|Material| G[Couche 300 gr, 9x5 cm]
  F -->|Entrega| H[Lun-mar → mié / mié-jue → vie]
  F -->|Caras| I[1 o 2 caras, mismo precio]
  J[Flyers / afiches] --> K[DERIVAR_HUMANO]
  L[Etiquetas] --> M[Flujo P4 / metodología de etiquetas]
```

Orden de envío en el primer contacto: saludo → videos 1→4 → “Le adjunto videos y precios…”. Si el catálogo ya se envió, no se reenvían los videos.

## 3. Qué se cambió

| Pieza | Cambio |
|---|---|
| Preparar contexto IA 4.7 | Primer contacto `TARJETAS_PRESENTACION` → `INFORMAR_TARJETAS`. Si el catálogo ya salió, no salta el cerebro |
| Cerebro ×3 | Prompt §27A: primer contacto corto; siguientes turnos según pregunta; no mezclar con etiquetas |
| Validadores ×3 V2.4 | Aceptan `INFORMAR_TARJETAS` |
| Normalizar decisión IA 2.5 | No deriva por imagen de diseño/meme en ruta tarjetas |
| Resolver contexto comercial 3.6 | `producto_linea` TARJETAS vs ETIQUETAS; saludo + frase corta; FAQs de tarjetas sin imagen de etiquetas |
| Enrutar acción comercial salida 16 | `INFORMAR_TARJETAS` → Preparar respuesta comercial |
| Preparar envío WhatsApp 3.2 | `ycloud_request_saludo_tarjetas` + videos + texto de cierre corto |
| Obtener configuración | SQL incluye `CATALOGO_TARJETAS` |
| Nodos nuevos | IF videos · saludo · 4 videos · esperas |

Fichas en [FLUJO-WORKFLOW-PEGASO.md](../FLUJO-WORKFLOW-PEGASO.md): §2, §11, §16 y pendientes técnicos.

## 4. Cómo activarlo

1. **Publicar el workflow** en n8n (desde el build local).
2. **Opcional — fila de catálogo** (si no existe, el código usa los 4 videos por defecto):

```sql
INSERT INTO pegaso.configuracion_bot (clave, valor_json)
VALUES (
  'CATALOGO_TARJETAS',
  '{
    "activo": true,
    "videos": [
      {
        "clave": "UV_BRILLANTE",
        "url": "https://pegasoadhesivos.com/wp-content/uploads/2026/10/Tarjetas-UV-Brillantes.mp4",
        "caption": "Este es el acabado UV brillante 1000 tarjetas en $24.00 dólares"
      },
      {
        "clave": "MATE",
        "url": "https://pegasoadhesivos.com/wp-content/uploads/2026/10/Tarjetas-Mates.mp4",
        "caption": "Este es el acabado Mate normal 1000 tarjetas en $30.00 dólares."
      },
      {
        "clave": "UV_SELECTIVO",
        "url": "https://pegasoadhesivos.com/wp-content/uploads/2026/10/Tarjetas-UV-Selectivas.mp4",
        "caption": "Este es el acabado Mate  + UV Selectivo 1000 tarjetas en $40.00 dólares\n*Con las puntas redondeadas le saldría en $45.00 dólares."
      },
      {
        "clave": "PAN_DE_ORO",
        "url": "https://pegasoadhesivos.com/wp-content/uploads/2026/10/Tarjetas-Mate-Pan-de-Oro.mp4",
        "caption": "Este es el acabado Mate  + Pan de Oro 1000 tarjetas en $95.00 dólares\n*Con las puntas redondeadas le saldría en $100.00 dólares."
      }
    ]
  }'::jsonb
)
ON CONFLICT (clave) DO UPDATE
SET valor_json = EXCLUDED.valor_json,
    actualizado_at = NOW();
```

Para apagar el envío de videos sin borrar URLs: `"activo": false` en ese JSON.

3. **Probar en WhatsApp** con un teléfono autorizado en `MODO_PRUEBA`: “necesito tarjetas de presentación” / “a como las 1000 tarjetas”.

## 5. Verificación local

- `node scripts/inject-code.mjs` + `validate-workflow.mjs` → OK (200 nodos: saludo + espera).
- Primer contacto: saludo horario → 4 videos → “Le adjunto videos y precios…”.
- Detección: tarjetas → catálogo; etiqueta+tarjeta → no catálogo; volantes/afiches → no_p4.

## 6. Riesgos / siguientes

- Videos grandes: YCloud puede tardar; las esperas de 2 s mitigan el desorden, no garantizan orden estricto en el teléfono.
- Si falla un video (`continueRegularOutput`), el flujo sigue y el texto igual se envía.
- Flyers publicitarios y afiches: pendiente de catálogo propio (hoy derivan).
- Pedido con archivo `.ai`/PDF de tarjeta: no tumba el catálogo; el humano puede entrar después si hace falta revisión de diseño.
