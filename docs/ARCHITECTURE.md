# Arquitectura

## Stack
- Backend: FastAPI + SQLAlchemy 2.x + Alembic
- DB: SQLite
- Autenticación: JWT (access + refresh) + Argon2
- Web: React + Vite + Mantine + TanStack Query + React Hook Form + Zod
- Mobile: React Native + Expo + react-native-vision-camera
- Notificaciones: ntfy
- CI/ GitHub Actions
- Contenedores: Docker (listo para Proxmox LXC)

## Monorepo
```text
apotheca/
├── apps/
│   ├── api/          # FastAPI (Python + uv)
│   ├── web/          # React + Vite + Mantine
│   └── mobile/       # React Native + Expo
├── packages/
│   └── shared/       # Tipos compartidos TS
├── infrastructure/
│   └── docker/       # Dockerfile + docker-compose
├── docs/
└── .github/workflows/
```

## Entidades
- **User** — usuarios con email, nombre, password_hash, is_admin
- **ActiveIngredient** — principios activos (únicos)
- **Presentation** — formas farmacéuticas (únicas)
- **Medication** — medicamentos con national_code (CIMA nregistro), nombre, laboratorio, barcode, CIMA_data (JSON cache)
- **Lot** — lotes: cantidad, fecha caducidad, dosis, dosis diaria
- **Settings** — configuración clave-valor (expiry_warning_days, depletion_threshold_days, ntfy_url, ntfy_topic)
- **NotificationLog** — registro de notificaciones enviadas
- **AuditLog** — registro de acciones (login, register, password reset)
- **PasswordResetToken** — tokens de recuperación de contraseña

## Endpoints API
### Auth (`/auth`)
- `POST /auth/register` — registro de usuario
- `POST /auth/login` — login, devuelve access + refresh token
- `POST /auth/refresh` — rotación de refresh token
- `POST /auth/password-reset` — solicitar reset (sin email enumeration)
- `POST /auth/password-reset/confirm` — confirmar reset con token

### CIMA (`/cima`)
- `GET /cima/search?nombre=X` — buscar por nombre comercial
- `GET /cima/search?pactivos=X` — buscar por principio activo
- `GET /cima/{nregistro}` — ficha completa del medicamento (con cache local)

### Inventory (`/inventory`)
- `POST /inventory/medications` — añadir medicamento desde CIMA por nregistro
- `GET /inventory/medications` — listar medicamentos
- `GET /inventory/medications/{id}` — detalle de medicamento
- `DELETE /inventory/medications/{id}` — eliminar medicamento
- `POST /inventory/lots` — crear lote
- `GET /inventory/lots` — listar lotes
- `PUT /inventory/lots/{id}` — actualizar lote
- `DELETE /inventory/lots/{id}` — eliminar lote
- `GET /inventory` — inventario completo con lotes y totales

### Settings (`/settings`)
- `GET /settings` — listar configuración
- `PUT /settings/{key}` — actualizar valor

### Alerts (`/alerts`)
- `GET /alerts` — alertas de caducidad y agotamiento (con notificaciones ntfy automáticas)

## Flujo principal
1. Buscar medicamento (CIMA por nombre o principio activo)
2. Añadir al inventario (carga datos de CIMA automáticamente)
3. Crear lotes (cantidad, caducidad, dosis, dosis diaria)
4. Consultar alertas (caducidad próxima, agotamiento estimado)
5. Configurar thresholds y notificaciones ntfy
