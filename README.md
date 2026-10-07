# ⚡ TaskFlow — Team Task Manager

A MERN task manager: projects with members, a kanban board, task assignment, and
an admin warning system with a recipient inbox.

- **Server** — Node 18+, Express 4, Mongoose 8, JWT auth
- **Client** — React 18, React Router 7, Vite 8, axios

---

## Quick start (fully local, no database setup)

If you don't have a MongoDB connection string yet, this runs everything on your
machine including the database:

```bash
git clone <your-repo>
cd team-task-manager
npm run install-all     # installs server + client dependencies
npm run dev:local       # temporary MongoDB + API on :5000
```

Then in a **second terminal**:

```bash
npm run client          # Vite dev server on :3000
```

Open <http://localhost:3000>, create an account, and you're in.

`npm run dev:local` starts an in-process MongoDB on port 27017 and points the
API at it. No `.env` needed, no install needed. **The data is thrown away when
you stop it** — that's the trade for zero setup. Once you have a real
`MONGO_URI`, switch to the persistent setup below.

Requires Node 18 or newer.

---

## Running with your own MongoDB

### Option 1 — temporary database, no install

Same as above, just on its own:

```bash
npm run dev:local
```

### Option 2 — a local MongoDB install

```bash
# Arch Linux
sudo pacman -S mongodb
sudo systemctl start mongod

# macOS
brew install mongodb-community
brew services start mongodb-community

# Ubuntu / Debian
sudo apt-get install -y mongodb-org
sudo systemctl start mongod

# Windows
winget install MongoDB.Server
```

Confirm it's running:

```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

### Option 3 — MongoDB Atlas (free tier)

Create a free cluster at <https://www.mongodb.com/atlas>, then:

1. **Database Access** → add a user with a password.
2. **Network Access** → allow your IP (or `0.0.0.0/0` for convenience).
3. Copy the connection string from **Deployment → Connect**.

### Configure `.env`

```bash
cp .env.example .env
```

Fill in the two required values:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/taskflow
JWT_SECRET=replace_this_with_a_long_random_string
```

Generate a real secret:

```bash
openssl rand -base64 48
```

The server **refuses to start** if either is missing, so a half-finished setup
fails immediately with a clear message instead of hanging on a connection.

For a local database, keep `CLIENT_ORIGIN=http://localhost:3000` (the default in
`.env.example`) — the Vite dev server runs on a different port than the API.

### Run it

```bash
npm run dev
```

One command, both processes:

| | |
| --- | --- |
| Frontend | <http://localhost:3000> |
| Backend | <http://localhost:5000> |
| Health check | <http://localhost:5000/health> |

If `http://localhost:5000/health` returns `{"status":"ok","db":"connected"}`,
the API and database are both up.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev:local` | Temporary in-process MongoDB + API. No `.env` needed. |
| `npm run dev` | API and client together, both with hot reload |
| `npm run server` | API only, with nodemon |
| `npm run client` | Vite dev server only |
| `npm start` | Production server; also serves `client/build` |
| `npm run build` | Install and build the client into `client/build` |
| `npm run install-all` | Install root and client dependencies |
| `npm test` | API + role-permission suites against a real MongoDB |
| `npm run test:ui` | Headless-browser suites against the production build |
| `npm run test:dev` | Verifies the Vite proxy and HMR |
| `npm run test:all` | All test suites |

To verify the quick-start flow itself (needs `npm run dev:local` and
`npm run client` running in two terminals): `node test/readme.js`.

### Production build

```bash
npm run build     # client -> client/build
npm start         # serves API + client from one origin
```

Then open <http://localhost:5000>. In production the API serves the SPA, so
both live on the same origin and no CORS configuration is needed.

### Tests

The suites run the real Express server against a real MongoDB, and the browser
suites drive the real production build in headless Chrome. Nothing is mocked
except the database.

First run needs Chrome:

```bash
npx puppeteer browsers install chrome
```

```bash
npm test        # 124 assertions, no browser
npm run test:ui # 68 assertions, headless browser
```

`npm run test:dev` binds port 27017, so stop any running MongoDB first.

See [`test/README.md`](test/README.md) for what each suite covers.

---

## Environment variables

| Variable | Required | Default | Purpose |
| --- | :-: | --- | --- |
| `MONGO_URI` | yes | — | MongoDB connection string. `MONGO_URL` also accepted. |
| `JWT_SECRET` | yes | — | Signs session tokens. Use `openssl rand -base64 48`. |
| `PORT` | no | `5000` | API port |
| `NODE_ENV` | no | — | Set `production` to serve the built client |
| `JWT_EXPIRES_IN` | no | `7d` | Session lifetime |
| `CLIENT_ORIGIN` | no | — | Comma-separated allowed origins. Leave empty in production. |

---

## Deploy to Railway

`railway.toml` already sets the build and start commands.

1. Push to GitHub, then create a new Railway project from that repo.
2. Add a MongoDB plugin, or supply your own `MONGO_URI`.
3. Set: `MONGO_URI`, `JWT_SECRET`, `NODE_ENV=production`.
   Leave `CLIENT_ORIGIN` empty — the API and client share one origin.
4. Railway runs `npm run build` then `npm start`.

`GET /health` reports the live database state and returns `503` when Mongo is
unreachable, so Railway restarts on a broken connection.

---

## Roles and permissions

A project has one `owner` (the creator) plus any number of `admins` and
`members`. Membership is what grants access — non-members can't read a
project's tasks or stats at all.

| Action | Owner | Admin | Member |
| --- | :-: | :-: | :-: |
| View project, tasks, warnings | ✓ | ✓ | ✓ |
| Create tasks, move status, change assignee | ✓ | ✓ | ✓ |
| Edit title, description, priority, due date, tags | ✓ | ✓ | — |
| Expedite a task | ✓ | ✓ | — |
| Issue, resolve, delete warnings | ✓ | ✓ | — |
| Add or remove members | ✓ | ✓ | — |
| Edit project details | ✓ | ✓ | — |
| Delete the project | ✓ | — | — |
| Delete a task | ✓ | ✓ | own tasks only |

Removing a member unassigns their tasks. Deleting a task removes its warnings;
deleting a project removes its tasks and warnings.

## Warnings

Admins issue a warning against a project member for a specific task, at one of
three severities. Recipients see them under **Warnings** in the sidebar and can
mark them resolved themselves; admins can resolve or delete them from the
project's warnings tab. Nobody can warn themselves.

---

## Troubleshooting

**`❌ MONGO_URI is not set`** — you skipped the `.env` step. Run
`cp .env.example .env`, or use `npm run dev:local` to skip the database entirely.

**`Could not connect to any servers`** — the database isn't reachable. Check
it's running (`systemctl status mongod`), and for Atlas confirm your IP is in
**Network Access**.

**`EADDRINUSE :5000`** — something else owns the port. Either stop it or set a
different `PORT` in `.env`.

**Frontend loads but every request fails** — `CLIENT_ORIGIN` must include
`http://localhost:3000` when the client runs on its own port.

**Blank page after `npm start`** — you skipped `npm run build`. The API only
serves `client/build` when it exists.

---

## Dependencies

`nodemon`, `concurrently`, and the test tooling are `devDependencies` and are
not installed in production.

```bash
npm audit            # everything
npm audit --omit=dev # what actually ships — currently 0
```

---

## License

Copyright © 2026 Manvendra Sang. All rights reserved.

This repository and all of its contents are proprietary software.

No permission is granted to use, copy, modify, reproduce, distribute, publish,
sublicense, sell, or incorporate any portion of this software into another
project without prior written permission from the copyright holder.

This restriction applies to the current version and all historical versions,
commits, releases, branches, and other versions of the repository (all past
commits and updates and future ones as well are included).

Viewing or accessing this repository does not grant a license or any other right
to use the software.

For licensing or commercial-use inquiries, contact the copyright holder.