# Lago

Lago is a private web app for the Lago friends group. The first implementation uses the Stream design. [SPEC.md](SPEC.md) describes current and planned behavior.

## Run locally

1. Install Node.js 22.18 or later and start PostgreSQL. Create an empty database called `lago` with `createdb lago`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to your database connection URL and set the initial administrator’s email and password. Use a password of at least 12 characters.
3. Run `npm ci`, then `npm run build` and `npm start`.
4. Open [Lago](http://127.0.0.1:3000). Sign in as the administrator, then open **Profile → Manage members** to approve registrations and assign groups.

The server prepares the database schema at startup and creates the administrator on first boot. Changing the configured password later does not reset an existing administrator’s password.

For development, run `./start.sh` and open [Lago with live reload](http://127.0.0.1:5173). Press Ctrl+C to stop the API and frontend. For hosting behind HTTPS, set `NODE_ENV=production`, `HOST=0.0.0.0`, and the database and administrator settings through the host. The site uses the host-provided `PORT` if set.

The initial database is empty. The original design exploration is available in [preview](preview/index.html).

### Local database on the setup machine

This checkout has a dedicated PostgreSQL instance on `127.0.0.1:5433`. Its data is in the ignored `.lago-local/postgres` directory, and the ignored `.env` contains the connection and local administrator credentials. `./start.sh` starts this database if needed and leaves it running when the app stops.

## Railway

The Lago Railway project has `test` and `production` environments. Each has an app and its own persistent PostgreSQL service. The app listens on port 3000 in Railway, uses the database's private connection URL, and serves a database-backed readiness check at `/api/health`.

Deploy the intended commit from a clean checkout with `railway up --service lago --environment test`. After verifying test, deploy that same checkout with `railway up --service lago --environment production`. These are CLI uploads. Automatic GitHub deployments require connecting a repository.
