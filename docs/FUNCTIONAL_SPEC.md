# Functional Specification

## Casos de uso

### UC1 Buscar medicamento
Buscar por nombre comercial o principio activo en CIMA (AEMPS).
- Web: input con debounce, resultados en tarjetas
- Mobile: input + resultados en FlatList
- Escáner (mobile): código de barras → búsqueda en CIMA

### UC2 Agregar medicamento
Consulta CIMA por nregistro, precarga ficha (nombre, laboratorio, principio
activo, forma farmacéutica, receta) y guarda en BD con cache del JSON completo.
Permite crear lotes con:
- cantidad (entero ≥ 0)
- fecha de caducidad (opcional)
- posología (texto libre, opcional)
- dosis diaria (decimal, opcional, para cálculo de agotamiento)

### UC3 Caducidad
Threshold global configurable (days_until_expiry). Cuando un lote está dentro
del threshold, aparece en GET /alerts. Notificación ntfy automática si ya
caducó.

### UC4 Agotamiento
Cálculo: days_left = quantity / daily_dose. Si days_left ≤ threshold, aparece
en GET /alerts. Notificación ntfy automática si days_left ≤ 2.

### UC5 Configuración
- expiry_warning_days (default: 30)
- depletion_threshold_days (default: 7)
- ntfy_url (vacío = desactivado)
- ntfy_topic (default: apotheca)

### UC6 Autenticación
- Registro con email + password (min 8 chars, Argon2 hash)
- Login devuelve access token (15min) + refresh token (30 días)
- Refresh con rotación (el viejo se invalida al usarlo)
- Recuperación de contraseña por token (1h expiración)
- Audit log de acciones


### UC7 Inventario
- Listar todos los medicamentos con sus lotes
- Calcular total_quantity (suma de cantidades de lotes)
- Eliminar medicamentos (cascade elimina lotes)
- Eliminar lotes individuales
