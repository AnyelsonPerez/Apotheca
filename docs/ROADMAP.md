# Roadmap

## EPIC-01 Infraestructura ✅
- [x] Monorepo (pnpm workspaces)
- [x] Docker (Dockerfile + docker-compose)
- [x] GitHub Actions CI (API, Web, Mobile)
- [ ] Proxmox LXC
- [ ] APK distribution

## EPIC-02 Autenticación ✅
- [x] Registro y login
- [x] JWT access + refresh token con rotación
- [x] Hash de contraseñas con Argon2
- [x] Recuperación de contraseña (token + expiración)
- [x] Audit log

## EPIC-03 CIMA ✅
- [x] Búsqueda por nombre comercial
- [x] Búsqueda por principio activo
- [x] Ficha completa del medicamento
- [x] Cache local (CIMA_data en Medication)

## EPIC-04 Inventario ✅
- [x] CRUD de medicamentos (alta desde CIMA)
- [x] Gestión de lotes (cantidad, caducidad, posología, dosis diaria)
- [x] Inventario total con totales
- [x] Alertas de caducidad (configurable)
- [x] Alertas de agotamiento (basado en dosis diaria)
- [x] Notificaciones ntfy
- [x] Settings (thresholds, ntfy config)

## EPIC-05 Web ✅
- [x] Layout con AppShell (Mantine)
- [x] Login / registro (React Hook Form + Zod)
- [x] Dashboard con stats y alertas
- [x] Búsqueda CIMA
- [x] Inventario con lotes anidados
- [x] Settings

## EPIC-06 Android ✅
- [x] Navegación con tabs (Expo Router)
- [x] Login / registro
- [x] Dashboard
- [x] Búsqueda CIMA
- [x] Inventario
- [x] Escáner de códigos de barras (react-native-vision-camera v5)
- [x] Settings

## EPIC-07 Próximos pasos
- [ ] Proxmox LXC deployment
- [ ] Backup y restore de SQLite
- [ ] Distribución de APK desde la instancia
- [ ] Múltiples usuarios/familia
- [ ] Exportar inventario (PDF/CSV)
- [ ] Recordatorios de toma de medicación
