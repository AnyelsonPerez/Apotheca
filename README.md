# Apotheca

Apotheca is a self-hosted pharmacy management system for home use.

- Search medications by brand name or active ingredient against the official AEMPS CIMA catalog
- Lot-based inventory with quantity, expiration date, and daily dose
- Auto-fill lot quantity from CIMA pharmaceutical presentations
- Expiration and stock depletion alerts
- Web app (React + Mantine) and Android app (React Native + Expo)

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/AnyelsonPerez/Apotheca.git
cd Apotheca/infrastructure/docker
docker compose up -d --build
```

| Service | Port | URL |
|---------|------|-----|
| Web UI  | 80   | http://localhost |
| API     | 8000 | http://localhost:8000 |
| API Docs| 8000 | http://localhost:8000/docs |

Data persists in a Docker volume (`apotheca-data`).

### Proxmox VE

Apotheca can be deployed as an LXC container on Proxmox VE.
Run this on your Proxmox host as root:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/AnyelsonPerez/Apotheca/main/infrastructure/proxmox/apotheca.sh)"
```

Updates are handled from inside the container:

```bash
pct enter <CT_ID>
# inside the container:
apotheca-update
```

## Stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI |
| ORM | SQLAlchemy 2.x |
| Database | SQLite |
| Auth | JWT + Refresh Tokens + Argon2 |
| Frontend Web | React + Vite + TypeScript |
| UI Web | Mantine |
| App Android | React Native + Expo |

## Repository Structure

```
apotheca/
├── apps/
│   ├── api/              # FastAPI (Python + uv)
│   ├── web/              # React + Vite + Mantine
│   └── mobile/           # React Native + Expo
├── infrastructure/
│   ├── docker/           # Dockerfiles + docker-compose + nginx
│   └── proxmox/          # LXC scripts (community-scripts compatible)
└── docs/
```

## Development

### Prerequisites
- Python 3.12+ with [uv](https://docs.astral.sh/uv/)
- Node.js 22+ with pnpm

### API
```bash
cd apps/api
uv sync
uv run uvicorn apotheca_api.app:app --reload --host 0.0.0.0 --port 8000
```

### Web
```bash
pnpm install
pnpm dev:web
```

### Mobile
```bash
pnpm dev:mobile
```

## License

MIT
