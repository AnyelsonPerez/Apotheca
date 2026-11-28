# Análisis: Búsqueda por código de barras (Scan) — API CIMA

## Fecha
2026-11-28

## Problema reportado
El escáner de código de barras no trae resultados correctos al buscar medicamentos en la API CIMA.

**Ejemplo de reproducción:**

| Campo | Valor |
|---|---|
| Código de barras (EAN-13) | `8470006794890` |
| Nombre comercial esperado | `DEFLAZACORT NORMON 30 mg COMPRIMIDOS EFG` |
| Laboratorio | Laboratorios Normon S.A. |
| `nregistro` (CIMA) | `73850` |
| `cn` (código nacional, presentación) | `679489` |

Al escanear `8470006794890`, el API no devuelve el medicamento esperado.

---

## Causa raíz

Hay **dos bugs** encadenados en la integración con la API CIMA:

### Bug 1 — Extracción incorrecta del CN desde el EAN-13

Archivo: [`apps/api/src/apotheca_api/routers/cima.py`](../apps/api/src/apotheca_api/routers/cima.py) — endpoint `GET /api/cima/barcode/{cn}`

El código actual toma los **primeros 6 dígitos** del código de barras como código nacional (CN):

```python
# código actual (INCORRECTO)
digits = ''.join(c for c in cn if c.isdigit())
if len(digits) >= 6:
    cn_clean = digits[:6]   # → "847000"  ❌
else:
    cn_clean = digits
```

Sin embargo, un código de barras español de medicamento es un **EAN-13** con la estructura:

```
8470006794890
││    │      │
││    │      └── dígito de control (posición 13)
││    └───────── CN de 6 dígitos (posiciones 7-12)  ✅
└└────────────── prefijo país + relleno (posiciones 1-6)
   84 = España
```

- Dígitos 1-2: `84` = España (prefijo GS1)
- Dígitos 3-6: `7000` = relleno/company prefix
- **Dígitos 7-12: `679489` = Código Nacional (CN) de la presentación**
- Dígito 13: `0` = dígito de control (check digit)

Por lo tanto, el código debería extraer `digits[6:12]` = `679489`, **no** `digits[:6]` = `847000`.

> **Nota importante:** El `cn` de la presentación (`679489`) **no** coincide necesariamente con el `nregistro` (`73850`). El `nregistro` identifica el medicamento; el `cn` identifica la presentación/envase concreta. Un mismo `nregistro` puede tener varias `presentaciones` con distintos `cn`.

### Bug 2 — Parámetro de consulta incorrecto en la API CIMA

Archivo: [`apps/api/src/apotheca_api/cima.py`](../apps/api/src/apotheca_api/cima.py) — método `CimaClient.search_by_cn`

El cliente usa el parámetro `codigoNacional` para buscar en el endpoint `/medicamentos`:

```python
# código actual (INCORRECTO)
async def search_by_cn(self, cn: str) -> dict:
    return await self._get("/medicamentos", {"codigoNacional": cn})
```

**La API CIMA no reconoce el parámetro `codigoNacional`** y lo **ignora silenciosamente**. Cuando esto ocurre, el endpoint `/medicamentos` devuelve **toda** la base de datos (`totalFilas: 25560`), y posteriormente el endpoint `/cima/barcode/{cn}` toma `resultados[0]`, que es siempre el primer medicamento de la lista, no el buscado.

### Verificación de comportamiento de la API CIMA

| Consulta | `totalFilas` | Resultado |
|---|---|---|
| `/rest/medicamentos?codigoNacional=73850` | `25560` ❌ | Ignora el parámetro, devuelve todo |
| `/rest/medicamentos?codigoNacional=847000` | `25560` ❌ | Ignora el parámetro, devuelve todo |
| `/rest/medicamentos?cn=679489` | `1` ✅ | Devuelve el medicamento correcto |
| `/rest/medicamento?nregistro=73850` | N/A ✅ | Devuelve el detalle completo |

**Parámetro correcto:** `cn` (no `codigoNacional`).

---

## Plan de implementación

### Cambio 1 — Corregir extracción del CN desde el EAN-13
**Archivo:** `apps/api/src/apotheca_api/routers/cima.py` — endpoint `/cima/barcode/{cn}`

Reemplazar la lógica de extracción para obtener el CN de las posiciones 7-12 del EAN-13. Añadir validación del dígito de control y tolerancia para códigos que ya vengan como CN puro (6 dígitos) o como `nregistro`.

Lógica nueva:
1. Quedarse solo con dígitos.
2. Si tiene 13 dígitos (EAN-13 completo): validar el check digit y extraer `digits[6:12]`.
3. Si tiene 6 dígitos: asumir que ya es un CN.
4. Si tiene 7 dígitos: asumir que es un `nregistro` y buscar directamente por `nregistro`.
5. En cualquier otro caso, intentar `digits[:6]` como fallback.

### Cambio 2 — Corregir parámetro de consulta a CIMA
**Archivo:** `apps/api/src/apotheca_api/cima.py` — método `search_by_cn`

Cambiar el parámetro de `codigoNacional` a `cn`:
```python
return await self._get("/medicamentos", {"cn": cn})
```

### Cambio 3 — Añadir método de búsqueda directa por `nregistro` (defensa en profundidad)
**Archivo:** `apps/api/src/apotheca_api/cima.py`

Añadir `search_by_nregistro(nregistro)` usando el endpoint `/medicamento` (singular) por si el escáner entrega un `nregistro` en lugar de un EAN-13.

### Cambio 4 — Ajustar el endpoint de barcode para cubrir todos los formatos
**Archivo:** `apps/api/src/apotheca_api/routers/cima.py` — endpoint `/cima/barcode/{cn}`

Después de extraer el CN:
- Buscar por `cn` en `/medicamentos`.
- Si no hay resultados, intentar buscar por `nregistro` en `/medicamento` como fallback.
- Devolver también `presentaciones` en la respuesta para que el frontend pueda mostrar los envases disponibles.

### Cambio 5 — Tests
**Archivo:** `apps/api/tests/` (test existente o nuevo)

Añadir casos de prueba para:
- EAN-13 completo: `8470006794890` → CN `679489` → `DEFLAZACORT NORMON 30 mg`
- CN puro de 6 dígitos: `679489`
- `nregistro` de 7 dígitos: `73850`

---

## Estado
- [x] Análisis completo
- [x] Causa raíz identificada
- [x] Plan de implementación definido
- [x] Cambios aplicados — [`cima.py`](../apps/api/src/apotheca_api/cima.py) y [`routers/cima.py`](../apps/api/src/apotheca_api/routers/cima.py)
- [x] Validación en vivo contra API CIMA real

## Resultados de validación

Pruebas ejecutadas contra `https://cima.aemps.es/cima/rest` con el código corregido:

| Entrada del escáner | CN extraído | `totalFilas` | Resultado |
|---|---|---|---|
| `8470006794890` (EAN-13) | `679489` | `1` ✅ | DEFLAZACORT NORMON 30 mg — Lab. Normon S.A. |
| `679489` (CN puro, 6 díg.) | `679489` | `1` ✅ | DEFLAZACORT NORMON 30 mg |
| `73850` (nregistro, 7 díg.) | fallback → `/medicamento` | N/A ✅ | DEFLAZACORT NORMON 30 mg (presentaciones: `679489`, `605398`) |

### Comportamiento anterior (bug)
| Consulta | `totalFilas` | Resultado |
|---|---|---|
| `/rest/medicamentos?codigoNacional=847000` | `25560` ❌ | Devolvía toda la BD, tomaba `resultados[0]` → medicamento equivocado |

### Comportamiento nuevo (fix)
| Consulta | `totalFilas` | Resultado |
|---|---|---|
| `/rest/medicamentos?cn=679489` | `1` ✅ | Medicamento correcto |

---

## Impacto en el frontend

El bug residía **exclusivamente en la API**. El frontend (web y móvil) no hace ningún parsing del código de barras: pasa el EAN-13 completo al endpoint `GET /api/cima/barcode/{cn}` y el backend se encarga de extraer el CN. Por tanto, con el fix del backend, el escáner ya funciona sin tocar el frontend.

### Flujo frontend-confirmado

| App | Archivo | Comportamiento |
|---|---|---|
| Web | [`hooks.ts`](../apps/web/src/api/hooks.ts) | `useCimaBarcodeLookup()` → `GET /cima/barcode/{barcode}` — pasa el EAN-13 completo ✅ |
| Web | [`SearchPage.tsx`](../apps/web/src/pages/SearchPage.tsx) | `handleScan` toma `nregistro` del resultado y luego llama a `useCimaDetail(nregistro)` para obtener `presentaciones` y pre-rellenar la cantidad ✅ |
| Móvil | [`scanner.tsx`](../apps/mobile/src/app/(tabs)/scanner.tsx) | `searchByBarcode` → `GET /cima/barcode/{barcode}` — usa `nregistro`, `nombre`, `pactivos`, `labtitular` ✅ |

### Campos nuevos añadidos a la respuesta (aditivos, no rompen el frontend)

- `presentaciones` — lista de presentaciones del medicamento (cuando se obtiene vía `/medicamento` por fallback de `nregistro`).
- `in_inventory` — booleano que indica si el medicamento ya está en el inventario del usuario.

> **Nota:** El endpoint `/medicamentos?cn=` de CIMA **no** devuelve `presentaciones`. Solo el endpoint `/medicamento?nregistro=` lo hace. Por eso el frontend web hace una segunda llamada `useCimaDetail(nregistro)` después del escaneo para obtener las presentaciones. Este flujo sigue siendo necesario para pre-rellenar la cantidad del envase.
>
> Los tipos `CimaBarcodeResult` en [`web/src/api/types.ts`](../apps/web/src/api/types.ts) y [`mobile/src/api/types.ts`](../apps/mobile/src/api/types.ts) no declaran los nuevos campos, pero como TypeScript no valida campos extra en runtime, no rompe la app.

### Opcional (no requerido para el fix)

- Actualizar los tipos `CimaBarcodeResult` de web y móvil para declarar `presentaciones` e `in_inventory`.

### Implementado — Feature: "En inventario" al escanear

El usuario confirmed que mostrar si un medicamento escaneado ya está en inventario es **el feature principal**. Se implementó el flujo completo:

**API** — [`routers/cima.py`](../apps/api/src/apotheca_api/routers/cima.py):
- El endpoint `GET /cima/barcode/{cn}` ahora requiere autenticación (`user: User = Depends(get_current_user)`).
- Devuelve `in_inventory` (bool), `medication_id` (string|null) y `total_quantity` (int) calculados a partir de los lotes del usuario.
- "En inventario" = el usuario tiene al menos un lote para un medicamento cuyo `national_code` coincide con el `nregistro` de CIMA.

**Web** — [`SearchPage.tsx`](../apps/web/src/pages/SearchPage.tsx):
- Tras escanear, el modal de lote muestra un badge verde "En inventario" cuando aplica.

**Móvil** — [`scanner.tsx`](../apps/mobile/src/app/(tabs)/scanner.tsx):
- El resultado del escaneo muestra un badge "✓ En inventario · N ud." cuando el medicamento ya está en el inventario del usuario.

**Tipos** — [`web/src/api/types.ts`](../apps/web/src/api/types.ts) y [`mobile/src/api/types.ts`](../apps/mobile/src/api/types.ts):
- `CimaBarcodeResult` extendido con `in_inventory`, `medication_id` y `total_quantity`.
