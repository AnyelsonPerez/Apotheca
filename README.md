# Apotheca

Apotheca es una solución self-hosted para la gestión doméstica de medicamentos.

## Características
- Inventario familiar compartido
- Integración con CIMA (AEMPS) para búsqueda de medicamentos
- Búsqueda por nombre comercial y principio activo
- Gestión por lotes (cantidad, caducidad, posología, dosis diaria)
- Alertas de caducidad configurables
- Alertas de agotamiento estimado por dosis diaria
- Notificaciones push via ntfy
- Web (React + Vite + Mantine)
- Android (React Native + Expo + escáner de códigos de barras)
- API REST (FastAPI + SQLAlchemy + SQLite)
- Docker y list para Proxmox LXC

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend API | FastAPI |
| ORM | SQLAlchemy 2.x |
| Migraciones | Alembic |
| Base de datos | SQLite |
| Autenticación | JWT + Refresh Token |
| Hash contraseñas | Argon2 |
| Frontend Web | React + Vite + TypeScript |
| UI Web | Mantine |
| Estado servidor | TanStack Query |
| Formularios | React Hook Form + Zod |
| App Android | React Native + Expo |
| Escáner | react-native-vision-camera |
| Notificaciones | ntfy |
| CI/CD | GitHub Actions |
| Contenedores | Docker |

## Estructura del monorepo
```
apotheca/
├── apps/
│   ├── api/          # FastAPI (Python + uv)
│   ├── web/          # React + Vite + Mantine
│   └── mobile/       # React Native + Expo
├── packages/
│   └── shared/       # Tipos compartidos TypeScript
├── infrastructure/
│   └── docker/       # Dockerfile + docker-compose
├── docs/             # Documentación
└── .github/workflows/ # CI
```

## Instalación

### Requisitos
- Python 3.12+ con [uv](https://docs.astral.sh/uv/)
- Node.js 22+ con pnpm
- Android Studio (para móvil, opcional)

### Desarrollo local

#### 1. Clonar
```bash
git clone https://github.com/AnyelsonPerez/Apotheca.git
cd Apotheca
```

#### 2. API (FastAPI)
```bash
cd apps/api
uv sync
uv run uvicorn apotheca_api.app:app --reload --host 0.0.0.0 --port 8000
```
La API se inicia en `http://localhost:8000`. Documentación Swagger en `/docs`.

#### 3. Web (React)
```bash
# Desde la raíz del monorepo
pnpm install
pnpm dev:web
```
La web se inicia en `http://localhost:5173` con proxy a la API.

#### 4. Móvil (Expo)
```bash
pnpm dev:mobile
```
Abrir en emulador Android o con la app Expo Go.

### Docker
```bash
cd infrastructure/docker
docker-compose up -d
```
