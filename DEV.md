# Desarrollo Local — Rivoo Frontend

## Requisitos

- Node.js 22+
- Backend Rivoo corriendo (9 servicios en localhost:8080-8088)
- Keycloak corriendo en localhost:9080 con realm `rivoo`
- MySQL corriendo en localhost:3306

## Arranque rapido

### Opcion 1: Todo de golpe (desde el repo backend)
```bash
cd E:/IdeaProjects/rivoo
bash infrastructure/scripts/dev-full-stack.sh
```
Arranca: MySQL check → Keycloak → 9 servicios → Frontend

### Opcion 2: Solo frontend (backend ya corriendo)
```bash
cd E:/IdeaProjects/rivoo
bash infrastructure/scripts/dev-frontend-only.sh
```
Verifica backend y arranca solo el frontend.

### Opcion 3: Manual
```bash
cd E:/IdeaProjects/rivoo-frontend
npm run dev
```

## URLs

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8080 |
| Keycloak | http://localhost:9080 |
| Keycloak Admin | http://localhost:9080/admin (admin/admin) |

## Usuarios de test

| Usuario | Password | Rol |
|---------|----------|-----|
| owner@test.com | test1234 | ROLE_SALON_OWNER |
| employee@test.com | test1234 | ROLE_EMPLOYEE |
| admin@rivoo.com | admin1234 | ROLE_PLATFORM_ADMIN |

## Comandos

```bash
npm run dev        # Arranca en modo desarrollo
npm run build      # Build de produccion
npm run test       # Ejecutar tests (86 tests)
npm run test:watch # Tests en modo watch
npm run lint       # ESLint
```

## Flujo de prueba

1. Abre http://localhost:3000
2. Click "Iniciar sesion"
3. Login con `owner@test.com` / `test1234`
4. Deberias ver la Today view (vacia si no hay citas)
5. Navega a Equipo → Anadir empleado
6. Navega a Equipo → tab Servicios → Anadir servicio
7. Click FAB (+) → Wizard crear cita
8. Prueba /book/{slug} en otra ventana (sin login)

## Nota sobre Keycloak

Si Keycloak no tiene los usuarios de test, reimporta el realm:
```bash
cd E:/keycloak-26.0.6
bin/kc.bat start-dev --http-port=9080 --import-realm
```
El archivo `rivoo-realm.json` en `infrastructure/keycloak/` incluye 3 usuarios de test.
