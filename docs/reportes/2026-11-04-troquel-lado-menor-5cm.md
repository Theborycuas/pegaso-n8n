# Troquel por lado menor a 5 cm

**Fecha:** 4 de noviembre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (código, validadores OK). **No** publicado en n8n, sin commit ni `git push`.

Una etiqueta con un lado de menos de 5 cm necesita troquel para el corte, aunque sea rectangular. Si su precio directo pasa de $18, ahora se calcula como troquelada: +1 cm de ancho y +1 cm de alto. Antes el `+1` solo se aplicaba cuando el cliente pedía una forma circular o troquelada, así que una 7×4 rectangular se cotizaba sin cubrir el troquel.

---

## 1. La regla

Se aplica `+1 / +1` cuando se cumple todo esto:

- un lado mide menos de 5 cm;
- el precio directo por 1000 con el primer rango (ancho × alto × 0.75) supera $18;
- la medida no tiene precio fijo (banda pequeña de $18 ni 4×4 de $20);
- no se aplicó ya el `+1` por forma ni el de 5×5 (nunca se suma dos veces).

Si el precio directo es de $18 o menos, sigue saliendo el mínimo de $18, que ya cubre el troquel.

**Se mide por tamaño, no por cantidad.** La misma etiqueta sigue la misma regla en 1000, 2000 o 3000. Si se midiera por el total, una 6×3 pasaría de $18 en 1000 a $42 en 2000, y el precio por unidad subiría con el volumen.

El cliente sigue viendo su medida real en la cotización ("7x4"). El 8×5 solo se usa para calcular.

---

## 2. Ejemplos

Factor actual: 0.75 de 1000 a 2000 y 0.67 de 3000 a 5000.

| Medida (rectangular) | Cantidad | Antes | Ahora | Calculada como |
|---|---|---:|---:|---|
| 7×4 | 1000 | $21 | **$30** | 8×5 |
| 7×4 | 2000 | $42 | **$60** | 8×5 |
| 7×4 | 3000 | $57 | **$81** | 8×5 |
| 10×4 | 1000 | $30 | **$42** | 11×5 |
| 3×9 | 1000 | $21 | **$30** | 4×10 |
| 2×15 | 1000 | $23 | **$36** | 3×16 |
| 4.9×4.9 | 1000 | $19 | **$27** | 5.9×5.9 |
| 6.1×4 | 1000 | $19 | **$27** | 7.1×5 |

No cambian:

| Medida | Cantidad | Precio | Motivo |
|---|---|---:|---|
| 6×4 | 1000 | $18 | Precio directo de exactamente $18 |
| 6×4 | 3000 | $49 | Precio directo por 1000 de $18 |
| 6×3 y 5×4 | 1000 | $18 | Mínimo |
| 3×3 y 4×4 | 1000 | $18 y $20 | Precio fijo |
| 7×4 troquelada o circular | 1000 | $30 | Ya tenía el `+1` por forma |
| 5×5 | 1000 | $27 | Ya tenía su `+1` |
| 5×7 y 5×10 | 1000 | $27 y $38 | Ningún lado es menor a 5 cm (§5) |

**Medidas grandes:** la confirmación de medidas (más de $140 por 1000) usa la misma regla. 50×4 pasa de $134 a $171 y 45×4 queda en $155, así que ambas piden confirmar antes de cotizar.

---

## 3. Qué se cambió

| Pieza | Versión | Cambio |
|---|---|---|
| Calcular precio detalle | 2.7 → **2.8** | Regla 8b, constante `TROQUEL_LADO_MENOR_A_CM` y campo de salida `incremento_troquel_aplicado`. |
| Resolver contexto comercial | 3.29 → **3.30** | `estimarPrecio1000Comercial` aplica la misma regla para la confirmación de medidas grandes. |

No hace falta tocar la base de datos: los nodos Postgres mapean sus columnas una por una y el campo nuevo no llega a ninguna. Los prompts de los cerebros tampoco describen este cálculo, así que no cambian.

---

## 4. Verificación

- **Nodo real, antes contra ahora**, en 14.520 combinaciones de medida, forma y cantidad: cambiaron 1.650, todas cumplen la regla, ninguna bajó de precio y ninguna suma dos veces el `+1`.
- **Estimador del resolver contra el nodo:** coinciden en toda la rejilla salvo 30×50, con $1006 frente a $1005. Es un error de redondeo decimal que ya existía y no afecta al umbral de $140.
- **Flujo completo:** 7×4 se cotiza sin pedir confirmación; 45×4 y 50×4 piden confirmar medidas.
- **Regresión:** las 8 baterías anteriores (diseño, correcciones, flujo, calendarios, cierre, links, IVA y envío, libretas) dan 0 diferencias.
- **Pipeline:** `inject-code`, `validate-workflow`, `prepare-update` y `check-encoding` OK.

---

## 5. A confirmar

- **Factor:** el pedido de este cambio menciona 0.77, pero el sistema usa 0.75 de 1000 a 2000. No se cambió: 8×5 da $30 con 0.75 y $31 con 0.77. Cambiar el factor movería todas las cotizaciones.
- **Lado de exactamente 5 cm:** la regla es "menos de 5 cm", así que 5×7 no lleva `+1` ($27). Hay dos señales en contra: 5×5 sí lo lleva, y el texto al cliente dice "desde los 5 cm para abajo se usa troquel". Con `+1`, 5×7 costaría $36.
- **Más de 1000 unidades en etiquetas de $18 o menos:** 6×4 en 3000 sigue en $49 sin `+1`, por la regla de tamaño de §1.
- **Salto de precio en el límite:** 6×4 cuesta $18 y 6.1×4 cuesta $27. Es la consecuencia directa de la regla.
- **Diferencia que ya existía:** 6×3 rectangular cuesta $18 y circular $21, porque la forma suma `+1` aunque el precio directo no pase de $18. No se cambió.
