# Tests

Integration tests that run the real Express server against a real MongoDB, plus
headless-browser tests against the real production build. Nothing is mocked
except the database, which runs in-process via `mongodb-memory-server`.

## Install

Both test dependencies are already `devDependencies`, so `npm install` covers
them. First run only, download the Chrome build Puppeteer drives:

```bash
npx puppeteer browsers install chrome
```

## Run

```bash
npm test              # API + RBAC suites (no browser needed)
npm run test:ui       # headless-browser suites
npm run test:dev      # npm run dev wiring (Vite proxy + HMR)
npm run test:all      # API + browser suites
```

| File | Covers |
| --- | --- |
| `test.js` | API surface: auth, validation, projects, tasks, warnings, cascade deletes, headers, rate limiting |
| `rbac.js` | Full role matrix (owner / admin / member / outsider) against every privileged action, plus IDOR checks |
| `e2e.js` | Production build served by Express: SPA fallback, `/api` 404 isolation, CSP, warnings inbox, code splitting |
| `browser.js` | Real browser: registration, theme, project creation, 404 route, mobile drawer, console cleanliness |
| `member.js` | Member-role UI: locked fields, hidden admin controls, assignee/status edits, warnings tab |
| `devmongo.js` | `npm run dev`: Vite dev server, `/api` proxying, HMR |
| `readme.js` | The documented quick-start path. Requires `npm run dev:local` and `npm run client` running in two terminals. |

`devmongo.js` binds MongoDB to port 27017, so stop any local MongoDB first.

## What the regression tests specifically guard

Each of these corresponds to a bug that was present at some point:

- Login and add-member normalise email case (`MEL@X.com` must work).
- Add/remove-member responses include `userRole`, so an admin never loses admin controls.
- Members get `403` on admin-only task fields instead of a silent `200` that discards the edit.
- Cross-project expedite and warning deletion are blocked.
- Un-expediting restores the previous priority.
- `completedAt` clears when a task is reopened.
- Deleting a task removes its warnings; deleting a project removes tasks and warnings.
- Removing a member unassigns their tasks.
- Unknown `/api/*` returns JSON `404`, never the SPA shell.
- Bad ids and invalid enum values return `400`, never `500`.
- `GET /api/tasks/:id` populates `assignee` like POST/PUT do.
- Modal inputs keep every typed character (focus must not be stolen mid-typing).
- Rapid changes to two form fields don't clobber each other.