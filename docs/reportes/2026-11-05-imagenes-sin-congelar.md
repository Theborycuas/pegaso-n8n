# Imágenes y documentos sin congelar ni derivar

**Fecha:** 5 de noviembre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (build + edit). **No** publicado en n8n, sin commit ni `git push`.

---

## 1. Qué pasaba

Tras una foto de producto (p. ej. bolsa de chifles) el bot respondía “Permítame un momento por favor, ya revisamos la imagen…” y **derivaba a humano**. Una segunda imagen de diseño + “Quiero así los stickers…” se quedaba sin respuesta útil porque:

1. Una clasificación `ENVASE_O_PRODUCTO` **bloqueaba** detectar el diseño en el mismo turno.
2. `Normalizar decisión IA` mandaba a humano por `IMAGEN_REQUIERE_REVISION` / `ARCHIVO_NO_PROCESABLE` si no había `diseno_recibido_turno`.
3. Omitir envío / “Permítame…” dejaban el chat congelado sin pedir medidas.

---

## 2. Qué hace ahora

| Situación | Respuesta |
|---|---|
| Foto de producto / diseño / referencia / imagen incierta | Reconoce lo enviado y **pide medidas** (y producto si aplica). No deriva solo por la foto. |
| Documento (.ai, .pdf, etc.) | “En este momento verificamos su archivo. Mientras tanto…” + lo que falte (medidas, ciudad, editable). |
| “Quiero así los stickers…” sin medidas | Sigue la venta: pide ancho y alto / producto. |
| Se iba a omitir el mensaje pero faltan datos | Anti-congelado: siguiente pregunta (medidas → ciudad → diseño → metodología). |

Solo siguen derivando por media: **comprobante de pago** y el **archivo final** tras la metodología (revisión del asesor).

---

## 3. Nodos

| Nodo | Versión | Cambio |
|---|---|---|
| Preparar contexto IA | 4.21 → **4.22** | Detecta diseño aunque haya foto de producto; envase → clase PRODUCTO; cualquier documento cuenta; imagen incierta también. |
| Normalizar decisión IA | 2.12 → **2.13** | Ya no deriva por revisión de imagen/archivo. |
| Resolver contexto comercial | 3.32 → **3.33** | Prefijos de recibo; documento “verificamos… mientras tanto”; anti-congelado comercial. |
| Preparar mensaje transición humano | — | Textos de imagen/archivo orientados a pedir medidas (por si aún llega esa ruta). |

---

## 4. Pendiente

`.\scripts\push.ps1` cuando se autorice. Probar: foto de producto → medidas; dos imágenes + “quiero así los stickers”; un `.ai` sin medidas.
