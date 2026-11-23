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

The startup script requires the PostgreSQL major version recorded in the data directory (currently 14). It checks `PATH`, then the matching Homebrew installation under `/opt/homebrew` or `/usr/local`, and displays the database log if startup fails. A different major version cannot open the existing data directory.

## Railway

The Lago Railway project has `test` and `production` environments. Each has an app and its own persistent PostgreSQL service. The app listens on port 3000 in Railway, uses the database's private connection URL, and serves a database-backed readiness check at `/api/health`.

Railway automatically deploys the `lago` service from `mbauckhage/lago-app` when you push to either deployment branch.

| GitHub branch | Railway environment | URL |
| --- | --- | --- |
| `test` | `test` | <https://test.lagonostre.ch> |
| `main` | `production` | <https://lagonostre.ch> |

## Frontend components and styling

The Vue app uses Tailwind CSS v4 through `@tailwindcss/vite`. Shared colors and the font live in the `@theme` block in `src/style.css`; layout and component styling use utility classes.

- `src/components/ui/AppButton.vue`: primary, soft, plain, icon, danger and danger-plain variants. Defaults to `type="button"`; use `type="submit"` for form submissions. Native attributes and click listeners pass through.
- `AppTab.vue`: navigation button with an icon and an `active` prop that sets `aria-current="page"`.
- `AppAvatar.vue`: photo or name initials, with an optional `large` size.
- `FormField.vue`: a label wrapping slotted native inputs or textareas; `checkbox` selects the checkbox layout. Native controls retain form names, validation and Vue bindings.
- `AppSheet.vue`: native modal dialog with title/default slots and exposed `showModal`, `close` and `open` APIs. Native focus management and Escape handling are preserved.
- `src/components/events/EventCard.vue` and `RsvpControls.vue`: compose the UI primitives, receive data via props and emit actions. API calls remain in `App.vue`.

```vue
<AppButton variant="soft" :disabled="busy" @click="save">Speichern</AppButton>
<FormField>Anzeigename<input v-model="name" name="name" required></FormField>
```

## Push notifications

Use HTTPS on hosted installations. On iPhone/iPad (iOS 16.4+), add Lago to the Home Screen, launch it there, and choose **Profil → Push auf diesem Gerät aktivieren**, then allow notifications. Other supported browsers can enable push directly. The saved push preference controls delivery across devices; the device button registers or disconnects only that browser installation. Signing out disconnects the current device.

Invitations, edits and cancellations enqueue notifications in PostgreSQL. The running API delivers them every five seconds, retries temporary failures, and deletes expired subscriptions. Set `WEB_PUSH_SUBJECT` to a monitored `mailto:` address. VAPID keys are generated automatically and persisted in `push_config`; preserve that table across deployments. Email delivery remains planned.
