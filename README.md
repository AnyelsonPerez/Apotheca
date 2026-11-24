# Apotheca

Apotheca es una solución self-hosted para la gestión doméstica de medicamentos.

- Búsqueda de medicamentos por nombre o principio activo contra el catálogo oficial CIMA (AEMPS)
- Inventario por lotes con cantidad, fecha de caducidad y dosis diaria
- Auto-rellenado de cantidad del lote desde las presentaciones de CIMA
- Alertas de caducidad y de agotamiento estimado
- Web app (React + Mantine) y Android app (React Native + Expo)
- API REST (FastAPI + SQLAlchemy + SQLite)
- Despliegue con un solo comando en Proxmox LXC

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
| App Android | React Native + Expo |
| Escáner | react-native-vision-camera |
| Notificaciones | ntfy |
| Contenedores | Docker + Docker Compose |

## Estructura del monorepo
```
apotheca/
├── apps/
│   ├── api/              # FastAPI (Python + uv)
│   ├── web/              # React + Vite + Mantine
│   └── mobile/           # React Native + Expo
├── infrastructure/
│   ├── docker/           # Dockerfiles + docker-compose + nginx
│   └── proxmox/          # Script de despliegue en LXC
├── docs/                 # Documentación
└── .github/workflows/    # CI
```

---

## Despliegue en Proxmox (recomendado)

Un solo script crea un contenedor LXC en tu Proxmox, instala Docker, clona el
repositorio y lanza la API + Web. Ejecútalo en el host de Proxmox como root:

```bash
# Descargar y ejecutar (CT ID 220, IP 10.10.0.220)
bash <(curl -fsSL https://raw.githubusercontent.com/AnyelsonPerez/Apotheca/main/infrastructure/proxmox/install.sh) 220 10.10.0.220
```

O si ya tienes el repo clonado:

```bash
bash infrastructure/proxmox/install.sh 220 10.10.0.220
```

Parámetros (opcionales):

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| CT_ID | 220 | ID del contenedor LXC |
| CT_IP | 10.10.0.220 | IP estática del contenedor |
| Gateway | auto-detectado | Gateway de la red |

Una vez terminado:

1. **Web UI** → `http://10.10.0.220` — Registra tu primer usuario
2. **App Android** → ve a `http://10.10.0.220/app` para escanear el QR y descargar el APK
3. **En la app** → Configuración → URL de la API → `http://10.10.0.220`

### Gestión del contenedor

```bash
pct enter 220                          # Entrar al contenedor
pct reboot 220                         # Reiniciar
pct stop 220                           # Parar

# Dentro del contenedor:
cd /opt/apotheca/infrastructure/docker
docker compose logs -f                 # Ver logs
docker compose pull && docker compose up -d  # Actualizar
```

---

## Desarrollo local

### Requisitos
- Python 3.12+ con [uv](https://docs.astral.sh/uv/)
- Node.js 22+ con pnpm
- Android Studio (para móvil, opcional)

### 1. Clonar
```bash
git clone https://github.com/AnyelsonPerez/Apotheca.git
cd Apotheca
```

### 2. API (FastAPI)
```bash
cd apps/api
uv sync
uv run uvicorn apotheca_api.app:app --reload --host 0.0.0.0 --port 8000
```
La API se inicia en `http://localhost:8000`. Documentación Swagger en `/docs`.

### 3. Web (React)
```bash
pnpm install
pnpm dev:web
```
La web se inicia en `http://localhost:5173` con proxy a la API.

### 4. Móvil (Expo)
```bash
pnpm dev:mobile
```
Abrir en emulador Android o con la app Expo Go.

### Docker (local)
```bash
cd infrastructure/docker
docker compose up -d --build
```
Web en `http://localhost`, API en `http://localhost:8000`.
