# Arquitectura

## Stack
- Backend: FastAPI
- DB: SQLite
- ORM: SQLAlchemy
- Migraciones: Alembic
- Web: React + Vite
- Mobile: React Native + Expo
- Notificaciones: ntfy

## Monorepo
```text
apotheca/
├── apps/
│   ├── api/
│   ├── web/
│   └── mobile/
├── packages/
├── infrastructure/
├── docs/
└── README.md
```

## Entidades
- Users
- Medications
- Presentations
- ActiveIngredients
- Lots
- Settings
- NotificationLog
- AuditLog
- PasswordResetTokens

## Flujo principal
Buscar -> Inventario -> Catálogo local -> CIMA -> Completar ficha -> Guardar lote
