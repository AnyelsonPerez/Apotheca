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
- dosis diaria X (decimal, opcional, para cálculo de agotamiento)
- duración del tratamiento Y días (decimal, opcional)
- fecha de inicio de la toma (opcional)

La dosis diaria es opcional: hay medicamentos que no está tomando nadie.
Cuando se añade un medicamento, se ofrece indicar la dosis diaria, la
duración del tratamiento (Y días) y una fecha de inicio para empezar a
descontar. Esto cubre el caso de registrar el medicamento días después de
empezar a tomarlo.

### UC3 Caducidad
Threshold global configurable (days_until_expiry). Cuando un lote está dentro
del threshold, aparece en GET /alerts. Notificación ntfy automática si ya
caducó.

### UC4 Agotamiento
Cálculo con descuento virtual progresivo: cada día se descuenta daily_dose
de la cantidad a partir de dose_start_date, durante treatment_days. Cuando
pasan los treatment_days, se deja de descontar (el tratamiento ha terminado).
- effective_quantity = quantity − (daily_dose × min(días_transcurridos, treatment_days))
- days_left = effective_quantity / daily_dose

Si days_left ≤ threshold, aparece en GET /alerts. Notificación ntfy
automática si days_left ≤ 2. La cantidad física (quantity) no se modifica,
el descuento es virtual (calculado en cada lectura).

La dosis diaria es opcional: un lote sin dosis no genera alerta de
agotamiento. Si falta fecha de inicio, no se descuenta nada (la dosis existe
pero el tratamiento no ha empezado).

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
