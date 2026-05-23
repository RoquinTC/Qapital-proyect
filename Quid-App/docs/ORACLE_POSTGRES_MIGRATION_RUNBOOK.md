# Migracion Oracle: SQLite custom.db a PostgreSQL

Este runbook es el procedimiento operativo para mover QUID en Oracle desde el
archivo `custom.db` hacia PostgreSQL en Docker sin borrar el origen.

## 1. Antes de tocar Oracle

En local debe estar verificado:

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run db:sqlite:generate`
- `npm run db:postgres:generate`
- `npm run db:migrate:sqlite-to-postgres -- --dry-run`

Si cualquiera falla, no se migra Oracle.

## 2. Backup del SQLite real en Oracle

En el servidor, ubica el volumen donde está `custom.db`. Luego crea una copia
con fecha. Ejemplo conceptual:

```bash
mkdir -p ~/quid-backups
cp /ruta/real/custom.db ~/quid-backups/custom-$(date +%Y%m%d-%H%M%S).db
gzip -k ~/quid-backups/custom-*.db
```

No borres `custom.db`. Queda como respaldo histórico.

## 3. PostgreSQL productivo

El `docker-compose.yml` principal ya define:

- Servicio `postgres`
- Volumen persistente `quid-postgres-data`
- Servicio `quid-app` apuntando a `postgresql://...@postgres:5432/quid`
- Servicio `quid-cron` para ejecutar recordatorios push y digest diario de Aura

En Oracle, ajusta las variables reales en `.env`:

```env
POSTGRES_DB=quid
POSTGRES_USER=quid
POSTGRES_PASSWORD=usa-una-clave-larga
DATABASE_URL=postgresql://quid:usa-una-clave-larga@postgres:5432/quid?schema=public
POSTGRES_DATABASE_URL=postgresql://quid:usa-una-clave-larga@localhost:5432/quid?schema=public
CRON_SECRET=usa-otra-clave-larga
CRON_INTERVAL_SECONDS=900
AURA_API_KEY=usa-otra-clave-larga-para-aura
AURA_MODEL=hermes3:8b
OLLAMA_URL=http://host.docker.internal:11434/api
```

## 4. Ensayo final

Primero levanta solo PostgreSQL y crea el schema:

```bash
docker compose up -d postgres
npm run db:postgres:push --prefix Quid-App
```

Ejecuta dry-run contra la copia de Oracle:

```bash
SQLITE_DATABASE_URL=file:/ruta/backup/custom.db \
POSTGRES_DATABASE_URL=postgresql://quid:clave@localhost:5432/quid?schema=public \
npm run db:migrate:sqlite-to-postgres --prefix Quid-App -- --dry-run
```

## 5. Migracion real

Hazlo en ventana corta:

```bash
docker compose stop quid-app
SQLITE_DATABASE_URL=file:/ruta/backup/custom.db \
POSTGRES_DATABASE_URL=postgresql://quid:clave@localhost:5432/quid?schema=public \
npm run db:migrate:sqlite-to-postgres --prefix Quid-App -- --reset
docker compose up -d --build quid-app quid-cron
```

## 6. Validacion

Valida en la app:

- Login con usuario real.
- Finanzas: cuentas, saldos, gastos, presupuestos, recurrentes.
- Transporte: vehiculos, placa, tanqueos, documentos, mantenimientos.
- Salud: citas y medicamentos.
- Despensa: productos y listas.
- Inicio: Resumen y Planner.
- Ajustes: backup y Aura.

Valida en consola:

```bash
docker compose logs --tail=200 quid-app
docker compose logs --tail=200 postgres
docker compose logs --tail=200 quid-cron
```

Exito significa: sin errores 500, sin loops 429 en navegador y sin diferencias
visibles frente al SQLite respaldado.

## 7. Aura y recordatorios proactivos

Aura Standalone se levanta desde su propia carpeta. Debe usar el mismo
`AURA_API_KEY` del `.env` de QUID y estar conectado a la red Docker
`quid-proyect_default`.

```bash
cd ~/Aura-Standalone
docker compose up -d --build
docker compose logs --tail=100 aura-standalone
```

El servicio `quid-cron` ejecuta cada `CRON_INTERVAL_SECONDS`:

- `/api/push/reminders` para notificaciones PWA/server.
- `http://aura-super-agent:3000/digest` para que Aura escriba en Telegram si
  hay pagos o citas del dia.

Para probarlo manualmente:

```bash
curl -fsS "http://localhost:3000/api/push/reminders?token=$CRON_SECRET"
curl -fsS -X POST "http://localhost:3000/api/aura/digest" \
  -H "x-aura-token: $AURA_API_KEY"
```

Si el segundo comando devuelve `count: 0`, no hay pendientes de hoy o ya se
envio el digest de ese dia.
