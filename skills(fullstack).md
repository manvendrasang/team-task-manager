# Full-Stack Web Development — Master Skills & Verification Framework

> **Purpose:** This document is a ground-up build & verification reference for full-stack web projects, covering the MERN (MongoDB/Express/React/Node) and MEAN (MongoDB/Express/Angular/Node) variants side by side, plus their TypeScript-first equivalents. It is written so a build agent (human or AI) can use it as a single source of truth for planning, building, and auditing a project before it ships.
>
> **How to use this document:**
> - **Sections 1–10 = knowledge base.** What each layer/concept/tool is and why it matters, ordered from foundational to advanced. Each item is a verifiable `[ ]` action, not a topic to "know about."
> - **Section 11 = build sequence.** The literal phase-by-phase order to build a real project from nothing to production. Each phase is gated by its own checklist — do not start a phase whose prior-phase items aren't checked.
> - **Section 12 = master verification checklist.** The final go/no-go audit a build agent runs before calling a project production-ready. It does not repeat every item above — it pulls the highest-stakes item from each section.
> - **Section 13 = appendix / decision matrix.** Used once, during Discovery, to choose and justify the stack. Every choice made here should be written up using the ADR template at the end of the appendix.
> - Items marked **(non-negotiable)** encode practices with real security/data-loss/compliance consequences if skipped — these are not judgment calls to be traded off against deadlines.

---

## 1. Foundational Language & Tooling Layer

### 1.1 HTML5
- [ ] Semantic elements used correctly (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`) instead of generic `<div>` soup
- [ ] One `<h1>` per page with a logical, non-skipping heading hierarchy (`h1`→`h2`→`h3`)
- [ ] Form inputs use correct `type` attributes (`email`, `tel`, `number`, `date`, `password`) and every input has a `<label for>` bound to its `id`
- [ ] `<html lang="...">` set to the correct locale
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1">` present
- [ ] ARIA roles/attributes used only to fill gaps semantic HTML can't cover, not as a replacement for semantic elements
- [ ] Every meaningful `<img>` has descriptive `alt` text; decorative images use `alt=""`
- [ ] `<link rel="canonical">`, `<meta charset="UTF-8">`, favicon, and `manifest.json` present if the app is PWA-capable

### 1.2 CSS3
- [ ] Layout built with Flexbox/CSS Grid (not float-based or table-based layout)
- [ ] Responsive design is mobile-first, using relative units (`rem`, `%`, `clamp()`) rather than fixed pixel breakpoints only
- [ ] A CSS methodology is explicitly chosen and applied consistently (BEM, utility-first via Tailwind CSS, CSS Modules, or CSS-in-JS) — not a mix with no convention
- [ ] Theming/design values (color, spacing, radius) defined as CSS custom properties, not hard-coded per component
- [ ] Animations respect `prefers-reduced-motion` media query
- [ ] Unused CSS is purged/tree-shaken from the production build (verified via bundle inspection, not assumed)
- [ ] Text contrast meets WCAG AA (4.5:1 for body text, 3:1 for large text) — checked with a contrast checker, not eyeballed

### 1.3 JavaScript (ES2020+)
- [ ] Modern syntax used throughout: `const`/`let` (no `var`), arrow functions, destructuring, spread/rest, optional chaining (`?.`), nullish coalescing (`??`)
- [ ] All async code uses `async`/`await` with `try/catch` error handling — no unhandled promise rejections in production logs
- [ ] Code is organized as ES Modules (`import`/`export`), bundler-aware for code splitting
- [ ] Debouncing/throttling applied to high-frequency events (scroll, resize, keystroke-triggered search)
- [ ] Event listeners, timers, and subscriptions are cleaned up on component/module teardown (verified with a memory profiler on at least one long-running view)
- [ ] Server-only APIs (`fs`, `process.env` secrets) never referenced in code that ships to the browser bundle

### 1.4 TypeScript
- [ ] `"strict": true` set in `tsconfig.json` (enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`)
- [ ] `interface` vs `type` usage follows one documented team convention, not mixed arbitrarily
- [ ] Generics used for reusable, type-safe utilities/components rather than duplicating logic per type
- [ ] Discriminated unions used to model mutually exclusive states (e.g., `{status:'loading'} | {status:'success', data} | {status:'error', error}`)
- [ ] Built-in utility types used where applicable (`Partial`, `Pick`, `Omit`, `Record`, `ReturnType`) instead of hand-rolled equivalents
- [ ] No unchecked `any` in application code — `unknown` plus type narrowing used at trust boundaries (API responses, form input)
- [ ] Frontend/backend share request/response types — via a monorepo shared package, OpenAPI-generated types, GraphQL codegen, or tRPC — rather than duplicated hand-written interfaces
- [ ] Path aliases (`compilerOptions.paths`) configured to avoid deep relative imports (`../../../..`)

---

## 2. Primary Frameworks & Platforms

### 2.1 React (MERN variant)
- [ ] Functional components with Hooks used exclusively (no legacy class components without a documented reason)
- [ ] Client state management tool chosen deliberately and only escalated as complexity requires: component state → Context → a dedicated library (Zustand, Redux Toolkit, or Jotai)
- [ ] Server state (data fetched from an API) is managed with a dedicated cache/fetch library (TanStack Query or SWR), not ad hoc `useEffect` + `useState` fetching
- [ ] Routing handled via React Router or a framework router (Next.js App Router)
- [ ] Rendering strategy (CSR, SSR, SSG, or ISR) chosen per page based on content/SEO needs, not defaulted to CSR everywhere
- [ ] Composition (children props, custom hooks) used in place of deep prop drilling
- [ ] `useMemo`/`useCallback`/`React.memo` applied only where profiling shows a real re-render cost, not preemptively everywhere
- [ ] Error boundaries wrap major layout regions so one component failure doesn't blank the whole page
- [ ] Route-level code splitting via `React.lazy`/dynamic `import()`

### 2.2 Angular (MEAN variant)
- [ ] Application organized into feature modules, a shared module, and a core module (singleton services) — or standalone components (Angular 15+) used consistently if that's the chosen convention
- [ ] RxJS subscriptions are cleaned up via the `async` pipe or `takeUntilDestroyed`, never left to leak
- [ ] Dependency injection scoping (root-provided vs component-provided services) is deliberate, not accidental
- [ ] Reactive Forms used for any form with conditional or cross-field validation; Template-driven forms reserved for trivial forms only
- [ ] `ChangeDetectionStrategy.OnPush` applied to performance-sensitive components
- [ ] Route guards (`CanActivate`/`CanMatch`) enforce auth/role checks on protected routes
- [ ] Angular Signals evaluated as the state-reactivity model for new code (Angular 17+ projects)

### 2.3 Cross-Cutting Frontend Concerns (applies to both variants)
- [ ] Keyboard navigation and visible focus states work across all interactive elements
- [ ] Screen-reader pass performed on at least the primary user flow (not just automated a11y linting)
- [ ] i18n strategy (e.g., `react-i18next`, Angular `i18n`) defined if multi-language support is in scope
- [ ] Shared design tokens (color, spacing, typography scale) are the single source of truth between the design tool and the codebase, not redefined independently in each
- [ ] Component library documented in a living catalog (Storybook or equivalent) if the component set is reused across features/apps
- [ ] Production JS bundle analyzed (`source-map-explorer`, `webpack-bundle-analyzer`, or framework-native equivalent) before launch, with any single chunk over budget investigated

---

## 3. Core Runtime & Data Layer

### 3.1 Node.js Runtime
- [ ] Non-blocking I/O patterns understood and followed; CPU-bound work offloaded to worker threads or a separate service, not run synchronously on the event loop
- [ ] Configuration is environment-layered (`development`/`staging`/`production`), never hardcoded per environment in source
- [ ] Graceful shutdown implemented (`SIGTERM`/`SIGINT` handlers drain in-flight requests and close DB connections before exit)
- [ ] Production logging is structured (JSON) via a logging library (Pino or Winston), not raw `console.log`

### 3.2 Express.js (MERN) / NestJS (structured alternative) / Fastify (perf-focused alternative)
- [ ] Middleware order is explicit and correct: request parsing → security headers → auth → input validation → rate limiting → route handler → centralized error handler
- [ ] A centralized error-handling middleware catches all thrown/rejected errors — no route left to crash the process on an unhandled exception
- [ ] Every route validates its input against a schema (Zod, Joi, or class-validator) before touching business logic
- [ ] Code is layered — routes/controllers → services → repositories/models — so business logic isn't embedded directly in route handlers
- [ ] If using NestJS: module boundaries and dependency injection are used as designed, not bypassed with direct imports across modules

### 3.3 Database Layer
- [ ] **MongoDB (MERN):** schemas defined via Mongoose (or a typed alternative) with validation at the schema level; indexes created for every field used in a query filter or sort; unbounded array growth avoided (e.g., comments modeled as a separate collection, not an ever-growing embedded array)
- [ ] **SQL (Postgres/MySQL, if used):** schema changes tracked via versioned migrations (Prisma Migrate, TypeORM migrations, or Knex migrations) — never hand-edited directly on production
- [ ] Connection pooling configured with sane min/max limits for expected concurrency
- [ ] N+1 query patterns identified and resolved (batched queries, `.populate()`/joins, or DataLoader for GraphQL)
- [ ] Multi-step writes that must be atomic are wrapped in a database transaction
- [ ] **(non-negotiable)** Automated backups are configured **and** a restore has actually been performed successfully at least once — a backup that has never been restored is unverified
- [ ] A caching layer (Redis or equivalent) is used for hot-path reads that don't need to hit the database on every request

---

## 4. Structural & Architectural Patterns

### 4.1 Project Structure (choose one deliberately, record the choice as an ADR)
| Pattern | Best For |
|---|---|
| Flat structure | Scripts, prototypes, single-purpose tools |
| Type-based (`controllers/`, `models/`, `routes/`) | Small-to-medium apps |
| Feature-based (`features/user/`, `features/orders/`) | Medium-large apps, team ownership boundaries |
| Atomic design (atoms/molecules/organisms/templates/pages) | Component-heavy design systems |
| Domain-driven design (bounded contexts, aggregates) | Complex business domains, large teams |
| Monorepo (Turborepo or Nx) | Shared types/UI across multiple apps (web, admin, mobile) |

### 4.2 Documentation Discipline
- [ ] An Architecture Decision Record (ADR) exists for every significant technical decision — context, decision, alternatives considered, consequences — stored under `/docs/adr/`
- [ ] The API contract (OpenAPI/Swagger for REST, SDL for GraphQL, `.proto` for gRPC) is treated as the source of truth: written before implementation, version-controlled, and validated against the actual API in CI
- [ ] A README documents local setup, an architecture diagram or description, and the full list of required environment variable **names** (never values)
- [ ] A runbook exists for on-call/incident response covering at minimum: how to check system health, how to roll back a deploy, and who/what to page

---

## 5. Interface, Communication & Protocol Design

### 5.1 Protocol Selection
| Protocol | Use Case |
|---|---|
| REST | Standard CRUD, cacheable via HTTP semantics, broad client/tooling support |
| GraphQL | Flexible querying across related resources, avoids over/under-fetching for varied clients |
| gRPC | High-performance internal service-to-service calls, strongly-typed contracts via protobuf |
| WebSocket | Full-duplex real-time (chat, live dashboards, collaborative editing) |
| Server-Sent Events (SSE) | One-way server-to-client push (notifications, live feeds) |
| Webhooks | Event-driven notifications between independent systems |
| SOAP | Legacy enterprise/financial system integration where required by the counterparty |
| MQTT | IoT/low-bandwidth pub-sub messaging |
| Long polling | Real-time fallback where WebSocket isn't viable (restrictive networks/proxies) |
| WebRTC | Peer-to-peer audio/video/data channels |

### 5.2 Reliability & Resilience Checklist
- [ ] Rate limiting is enforced on public/authenticated endpoints (e.g., token bucket or sliding-window algorithm via `express-rate-limit` or an API gateway)
- [ ] Retry logic uses exponential backoff with jitter, not fixed-interval retries that can synchronize into a thundering herd
- [ ] Unsafe operations that may be retried (payment, order creation) accept an idempotency key so a retry can't duplicate the effect
- [ ] A circuit breaker (open/half-open/closed) protects calls to unreliable downstream dependencies
- [ ] Defined, tested fallback/degraded-mode behavior exists for when a non-critical dependency is unavailable (e.g., serve cached data, disable a feature, don't hard-fail the whole request)
- [ ] Concurrency conflicts on shared resources are handled explicitly (optimistic locking with a version field, distributed locks, or queue-based serialization)
- [ ] Every read-modify-write code path has been reviewed for race conditions under concurrent requests
- [ ] Caching strategy is explicit per endpoint/resource: TTL, invalidation trigger, and staleness tolerance (ETags or stale-while-revalidate where applicable) are all defined, not left to library defaults
- [ ] **(non-negotiable)** Incoming webhook payloads are verified via signature check (HMAC comparison against a shared secret) before being trusted or processed
- [ ] API versioning strategy is defined (URL path, header, or media-type based) before the first external consumer integrates
- [ ] All list endpoints are paginated (cursor-based preferred for large/changing datasets; offset-based acceptable for small/static ones)
- [ ] Error responses follow one consistent shape (e.g., `{ error: { code, message, details } }`) across the entire API

---

## 6. Security

### 6.1 Application-Level
- [ ] **(non-negotiable)** Every endpoint validates input server-side, regardless of any client-side validation already present
- [ ] Output is encoded/escaped to prevent XSS; a Content-Security-Policy header restricts script sources
- [ ] **(non-negotiable)** All database queries use parameterized queries or an ORM/ODM — no string-concatenated queries, which are vulnerable to SQL/NoSQL injection
- [ ] CSRF protection is in place for cookie-authenticated state-changing requests: `SameSite=Lax/Strict` cookies at minimum, plus a double-submit or synchronizer token pattern for higher-risk flows
- [ ] Error responses sent to clients never include stack traces, internal file paths, or raw database error messages
- [ ] Security headers are set via a middleware such as Helmet.js: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`
- [ ] File uploads are validated by type and size, scanned if the threat model requires it, and stored outside the web root or in object storage (S3/GCS) rather than served directly from application disk

### 6.2 Authentication & Authorization
- [ ] Authentication uses a vetted method: server-side sessions, short-lived JWTs, or OAuth2/OIDC via a maintained library (Passport.js, Auth.js, or a managed identity provider) — not a hand-rolled scheme
- [ ] Authorization (RBAC or ABAC) is enforced **server-side** on every protected route — a hidden UI element is not access control
- [ ] Access tokens are short-lived; refresh tokens are rotated on use and revocable
- [ ] **(non-negotiable)** Auth tokens are never stored in `localStorage` or `sessionStorage` — they are stored in `httpOnly`, `Secure`, `SameSite` cookies, which JavaScript cannot read and which are immune to XSS-based token theft
- [ ] Sessions expire after both an absolute maximum lifetime and an idle-timeout period
- [ ] **(non-negotiable)** Passwords are hashed with bcrypt or argon2 (with a per-password salt and an adequate work factor) — never stored in plaintext or with reversible encryption
- [ ] Password-reset links are single-use and expire within a short, defined window (e.g., 15–60 minutes)
- [ ] Invite links are single-use, scoped to their intended recipient/role, and time-expiring
- [ ] Repeated failed login attempts trigger increasing delay or temporary lockout to slow credential-stuffing attacks
- [ ] Multi-factor authentication is available (and enforced) for admin/privileged accounts

### 6.3 Infrastructure & Secrets
- [ ] **(non-negotiable)** Secrets (API keys, DB credentials, signing keys) live in a secrets manager (AWS Secrets Manager, HashiCorp Vault, or a platform's built-in encrypted env store) — never committed to version control
- [ ] **(non-negotiable)** No API key or secret is ever bundled into client-side JavaScript or otherwise exposed in a response sent to the browser
- [ ] API keys have a defined rotation schedule, and rotation has been rehearsed at least once
- [ ] TLS is enforced on all traffic (HTTP redirects to HTTPS); certificates renew automatically (Let's Encrypt/ACM or platform-managed) rather than relying on manual renewal
- [ ] Dependency vulnerabilities are scanned automatically (`npm audit`, Dependabot, or Snyk) with a defined patch SLA for critical/high findings
- [ ] Network access follows least privilege (security groups/firewall rules scoped to only what each service needs to reach)
- [ ] Bot/abuse protection is in place on public-facing forms and auth endpoints (CAPTCHA/hCaptcha, WAF rules, and the rate limiting from Section 5.2)
- [ ] In multi-tenant systems, every query is scoped by tenant ID and this scoping has been tested by attempting cross-tenant access and confirming it fails
- [ ] Applicable regulatory/compliance requirements (GDPR, CCPA, SOC 2, HIPAA, PCI-DSS) are identified explicitly for this project rather than assumed not to apply

### 6.4 Governance, Logging & Auditability
- [ ] Security checks (dependency audit, static analysis, secret scanning) run in CI and **block the pipeline** on critical findings — they are not advisory-only
- [ ] **(non-negotiable)** Logs are filtered before storage so passwords, tokens, and other sensitive fields never appear in plaintext in logs
- [ ] Sensitive actions (permission changes, data deletion, admin overrides) are recorded in an audit trail capturing who/what/when, and that trail is append-only or otherwise tamper-evident
- [ ] PII fields are identified and encrypted at rest where warranted by the data's sensitivity
- [ ] A data retention and deletion policy is defined and technically enforceable (including responding to deletion/right-to-be-forgotten requests)
- [ ] Cookie consent is implemented and functional where required (GDPR/CCPA), with a working preference center, not just a static banner
- [ ] Dependencies are updated on a defined cadence (not only reactively when a CVE is announced)

---

## 7. Performance, Reliability & Operations

- [ ] Performance budgets are defined per page/route (bundle size ceiling, Largest Contentful Paint, Cumulative Layout Shift targets) and checked in CI or via Lighthouse CI
- [ ] Code splitting/lazy loading is applied so no single route ships the entire application's JavaScript
- [ ] A response-time SLA is documented and actively monitored against real production traffic, not just assumed from local testing
- [ ] Recovery Point Objective (RPO — max acceptable data loss) and Recovery Time Objective (RTO — max acceptable downtime) are explicitly defined numbers, not vague aspirations
- [ ] A disaster recovery plan is documented **and has been executed as a drill**, not only written
- [ ] Observability is in place: structured logs, metrics (Prometheus/Grafana or a hosted APM like Datadog), and distributed tracing (OpenTelemetry) across services
- [ ] Alerts are configured on the core reliability signals — error rate, latency, traffic, saturation — and have been verified to actually fire (test alert triggered and received)
- [ ] Deployments use a safe rollout strategy (blue-green or canary) with an automated or well-rehearsed rollback path
- [ ] Autoscaling (or a documented manual scaling procedure) is defined for anticipated traffic spikes
- [ ] Static assets are served through a CDN with appropriate cache headers

---

## 8. User/Output-Facing Quality Layer (SEO & UX)

### 8.1 Page & Navigation Essentials
- [ ] A custom 404 page exists and is styled consistently with the rest of the site
- [ ] A thank-you/confirmation page or state follows every conversion action (form submit, purchase, signup)
- [ ] An About Us / company page exists where trust/credibility matters to the audience
- [ ] Breadcrumbs are present on pages more than one level deep
- [ ] The navbar is visually stable across pages (no layout shift on navigation) and its state (logged in/out) is consistent
- [ ] The footer includes key links (legal, contact, sitemap-relevant navigation, social)
- [ ] A sticky mobile CTA is present on primary conversion pages
- [ ] Related content is internally linked to support both navigation and SEO
- [ ] The primary call-to-action is visible above the fold on key landing pages
- [ ] A Privacy Policy page (and Terms of Service, where applicable) is published and linked from the footer

### 8.2 SEO Technicals
- [ ] Every page has a unique, descriptive `<title>`
- [ ] Every page has a unique meta description
- [ ] Open Graph and Twitter Card tags (including a share image) are set per page
- [ ] All meaningful images have descriptive `alt` text
- [ ] Structured data (schema.org via JSON-LD) is implemented for relevant types (Organization, Product, FAQPage, BreadcrumbList)
- [ ] Every page has a canonical tag (self-referencing at minimum, pointing to the preferred URL where duplicates exist)
- [ ] `sitemap.xml` is generated, kept current, and submitted to Google Search Console (and Bing Webmaster Tools if relevant)
- [ ] `robots.txt` is correctly configured and doesn't accidentally block indexable content
- [ ] `lang` attribute (and hreflang tags, if multi-locale) is correct
- [ ] FAQs are present on the homepage or relevant landing pages, marked up with matching FAQ schema
- [ ] Critical content is verified to be present in server-rendered HTML (view-source or a fetch without JS execution), not injected only client-side where crawlers may not render it
- [ ] Original photography is used where trust signals matter, rather than generic AI-generated or stock imagery that may undermine credibility
- [ ] Core Web Vitals (LCP, INP, CLS) pass on both mobile and desktop, measured via PageSpeed Insights or CrUX data, not lab tests alone

---

## 9. Design & Style System

| Style | Notes |
|---|---|
| Skeuomorphism | Realistic textures/shadows mimicking physical objects |
| 3D | Depth and dimensionality, often via WebGL/Three.js |
| Glassmorphism | Frosted-glass blur with transparency |
| Neumorphism | Soft extruded shadows on a monochrome surface |
| Claymorphism | Rounded, puffy shapes with soft shadows |
| Liquid glass | Fluid, refractive glass-like motion (modern, physics-based UI) |

- [ ] A visual style is deliberately chosen and documented as a design system spec (color, spacing, radius, elevation, motion tokens) rather than emerging ad hoc component-by-component
- [ ] Dark mode is supported if relevant to the target audience, using the token system above rather than one-off overrides
- [ ] Design tokens are synced between the design tool (e.g., Figma variables) and the codebase so the two cannot silently drift apart

---

## 10. Testing Strategy

| Type | Purpose | Typical Tooling |
|---|---|---|
| Unit testing | Individual functions/components in isolation | Jest, Vitest |
| Integration testing | Module-to-module interaction (API + DB) | Supertest, Testcontainers |
| End-to-end (E2E) testing | Full user flows through the real UI | Playwright, Cypress |
| Regression testing | New changes don't break existing behavior | Full automated suite re-run on every PR |
| Load & stress testing | Behavior under peak/sustained traffic | k6, JMeter, Artillery |
| Chaos engineering & resilience testing | Validate fallbacks/circuit breakers/retries actually trigger | Chaos Mesh, Gremlin, or manual fault injection (killing a dependency, adding latency) |
| Test coverage threshold | Minimum enforced coverage gate | Enforced in CI (e.g., a defined % on critical modules — the number should be justified, not cargo-culted at 100%) |
| Accessibility testing | WCAG conformance | axe-core, Lighthouse accessibility audit |
| Visual regression testing | Catch unintended UI drift | Chromatic, Percy |

---

## 11. Build Sequence — Ground-Up Project Order

Each phase should be fully checked off before the next begins.

1. **Discovery & Planning**
   - [ ] Requirements and user stories documented
   - [ ] Stack decided using Section 13 and justified in an ADR
   - [ ] Data model / entity relationships sketched before any code is written
   - [ ] API contract (OpenAPI/GraphQL SDL) drafted before implementation begins

2. **Project Scaffolding**
   - [ ] Repository structure chosen (Section 4.1) and initialized
   - [ ] TypeScript `strict` mode configured across frontend and backend
   - [ ] Linting/formatting configured (ESLint, Prettier) and enforced via a pre-commit hook
   - [ ] Environment variable strategy set up (`.env.example` committed, real `.env` gitignored)
   - [ ] CI pipeline skeleton created: lint → typecheck → test → build

3. **Backend Foundation**
   - [ ] Database connected; schema/models defined; migrations set up
   - [ ] Authentication system implemented per Section 6.2
   - [ ] Core middleware chain established (validation, error handling, logging, rate limiting)
   - [ ] First endpoints built against the pre-drafted API contract

4. **Frontend Foundation**
   - [ ] Framework scaffolded (React or Angular); routing configured
   - [ ] Design tokens/theme established
   - [ ] Core layout built: navbar, footer, custom 404, base page templates
   - [ ] Typed API client layer built, sharing types with the backend where possible

5. **Feature Development**
   - [ ] Features built vertically (UI + API + DB together) per user story, not layer-by-layer across the whole app
   - [ ] Each feature ships with unit and integration tests before merge
   - [ ] Each feature is reviewed against the Section 6 security checklist before merge

6. **SEO/UX Pass**
   - [ ] Section 8 checklist applied across all public-facing pages
   - [ ] Structured data and meta tags implemented per page

7. **Hardening Pass**
   - [ ] Full Section 6 security checklist audited end-to-end
   - [ ] Full Section 5.2 reliability checklist audited end-to-end
   - [ ] Load testing performed against expected peak traffic plus a safety margin
   - [ ] Chaos/failure-mode testing performed on critical downstream dependencies

8. **Pre-Launch**
   - [ ] Full Section 10 testing matrix executed and passing
   - [ ] Disaster recovery drill executed and its result recorded
   - [ ] Monitoring/alerting verified end-to-end with a real test alert
   - [ ] Legal pages live (Privacy Policy, Terms, cookie consent)
   - [ ] Sitemap submitted; analytics/tracking verified firing correctly

9. **Launch & Post-Launch**
   - [ ] Rollout performed via the chosen safe-deploy strategy (blue-green/canary)
   - [ ] Error rates and performance actively monitored for the first 24–72 hours
   - [ ] A backup restore is re-verified in the actual production environment
   - [ ] A retrospective/ADR is written for any major deviation from the original plan

---

## 12. Master Verification Checklist (Go/No-Go)

A project is not production-ready until every item below is true. This list intentionally pulls only the highest-stakes item from each prior section — it is not a substitute for the full audit in Sections 6–10.

- [ ] Every checklist item in Sections 1–10 relevant to this project has been explicitly reviewed, not assumed
- [ ] No secret, API key, or credential exists in source control or in any client-side bundle
- [ ] All auth tokens are stored in `httpOnly` cookies, never in `localStorage`/`sessionStorage`
- [ ] Every endpoint validates input server-side and is covered by rate limiting
- [ ] All destructive/privileged actions are captured in a tamper-evident audit trail
- [ ] Backups exist **and** a restore has been successfully performed in a drill
- [ ] The defined test coverage threshold is met and the E2E suite passes on all critical user flows
- [ ] Load testing confirms the system meets its defined SLA at expected peak traffic plus margin
- [ ] SEO technicals (Section 8.2) are verified via a real crawler simulation, not just visual inspection
- [ ] Legal/compliance pages are live and cookie consent is functional
- [ ] Monitoring, logging, and alerting are confirmed operational via a live test alert that was actually received
- [ ] An ADR exists for every major architectural decision made during the project
- [ ] The disaster recovery plan has been tested within the last quarter

---

## 13. Appendix — Tech Stack Decision Matrix

> Use this appendix during Phase 1 (Discovery & Planning) to make and justify stack decisions. Record every decision made here using the ADR template at the end of this section.

### 13.1 Frontend Framework: React vs Angular vs Next.js vs Remix

| Choose | When |
|---|---|
| React (Vite SPA) | Simple SPA, small team, full control over tooling, no strong SEO requirement |
| Next.js (React) | SEO matters; need SSR/SSG/ISR; marketing pages and app share one codebase; deploying to an edge/serverless platform |
| Angular | Large enterprise team; want opinionated structure/conventions out of the box; heavy forms-driven apps; org already standardized on Angular/RxJS |
| Remix (React) | Data-loading-heavy apps that want nested routing with colocated loaders/actions rather than Next's file conventions |

### 13.2 Backend Framework: Express vs NestJS vs Fastify

| Choose | When |
|---|---|
| Express | Small-to-medium API; team wants minimal abstraction and the broadest middleware ecosystem; fast prototyping |
| NestJS | Large team; need enforced architecture (modules/DI/decorators); enterprise scale; TypeScript-first from day one |
| Fastify | Performance-critical APIs, high request throughput, schema-based validation built into the framework |

### 13.3 Overall Stack: MERN vs MEAN vs Next.js Full-Stack vs T3-Style vs MEVN

| Choose | When |
|---|---|
| MERN | Team knows React; flexible/loosely-structured document data fits the domain; fast-moving product; startup-speed iteration |
| MEAN | Team already Angular-heavy; enterprise app needing strict structure/conventions; RxJS-based reactive data flows |
| Next.js full-stack (Route Handlers/Server Actions + Prisma + Postgres) | SEO-critical product; want a single deployable; serverless-first; relational data with strong consistency needs |
| T3-style (Next.js + tRPC + Prisma + TypeScript everywhere) | Small-to-mid team wants maximum end-to-end type safety without hand-writing a separate API contract layer |
| MEVN (Vue instead of Angular/React) | Team prefers Vue's simpler learning curve, still wants MongoDB + Node |

### 13.4 Database: MongoDB vs PostgreSQL vs MySQL vs Hybrid

| Choose | When |
|---|---|
| MongoDB | Schema flexibility needed; nested/document-shaped data; rapid iteration on the data model; horizontal scale via sharding |
| PostgreSQL | Strong relational integrity needed (finance, inventory, multi-entity joins); ACID transactions required; JSONB gives flexibility when needed within a relational model |
| MySQL | Simpler relational needs; wide hosting support; legacy compatibility requirements |
| Hybrid (e.g., Postgres + Redis, or Mongo + a search engine like Elasticsearch/Meilisearch) | Core transactional data is relational, but a caching layer or full-text/search layer is also needed alongside it |

### 13.5 API Style: REST vs GraphQL vs gRPC vs tRPC

| Choose | When |
|---|---|
| REST | Public API with third-party consumers; simple CRUD; HTTP-native caching matters |
| GraphQL | Frontend needs flexible queries across many related resources; multiple client types (web/mobile) with different data needs; bandwidth-constrained clients |
| gRPC | Internal microservice-to-microservice calls; performance-critical; strongly-typed contracts via protobuf |
| tRPC | Full-stack TypeScript monorepo with a single frontend consumer; want type safety without codegen or a separate schema layer |
| WebSocket/SSE | Real-time requirements layered on top of any of the above (chat, live updates, notifications) |

### 13.6 React State Management: Context vs Zustand vs Redux Toolkit vs React Query

| Choose | When |
|---|---|
| Local state (`useState`/`useReducer`) | State is used by one component/subtree only |
| Context API | Simple global state (theme, current user), infrequent updates, small app |
| Zustand or Jotai | Medium-complexity global state; want minimal boilerplate; frequent updates without unnecessary re-renders |
| Redux Toolkit | Large app with complex state interactions; team needs devtools/time-travel debugging; team already knows Redux patterns |
| TanStack Query (React Query) | Always use this specifically for **server state** (data fetched from an API), regardless of which client-state tool above is also chosen |

### 13.7 CSS Methodology: Tailwind vs CSS Modules vs Styled Components vs Vanilla

| Choose | When |
|---|---|
| Tailwind CSS | Want speed and consistent design tokens via config; small production bundle via purge; team is comfortable with utility classes in markup |
| CSS Modules | Want scoped vanilla CSS without adopting a utility-class paradigm; simple build setup |
| Styled Components / Emotion (CSS-in-JS) | Heavy dynamic/theme-driven styling based on props/state; authoring a shared component library |
| Vanilla CSS + BEM | Very small project, no build tooling desired, or a strict separation of markup and style is required |

### 13.8 ORM / Query Layer: Mongoose vs Prisma vs TypeORM vs Raw SQL

| Choose | When |
|---|---|
| Mongoose | Using MongoDB and need schema validation/middleware/hooks at the model layer |
| Prisma | Using a SQL database; want type-safe queries plus migrations and strong developer experience; works with Postgres/MySQL/SQLite (and Mongo, with some limitations) |
| TypeORM | Using a SQL database; team prefers decorator/entity-class patterns (pairs naturally with NestJS) |
| Knex or raw SQL | Need full control over queries, complex reporting queries, or performance-critical query paths that an ORM abstracts away |

### 13.9 Hosting & Deployment

| Choose | When |
|---|---|
| Vercel or Netlify | Next.js or a static/SSG frontend; want near-zero-config CI/CD and edge functions |
| AWS / GCP / Azure (containers or Kubernetes) | Need full infrastructure control, specific compliance requirements, or a complex multi-service architecture |
| Render, Railway, or Fly.io | Small-to-mid apps wanting a simpler PaaS experience than raw cloud-provider configuration |
| Self-hosted (Docker on a VPS) | Cost-sensitive projects, need for full control, or data-residency constraints that rule out major cloud providers |

### 13.10 Decision Record Template (copy into each ADR)
```
# ADR NNNN: <Decision Title>
Status: Proposed | Accepted | Superseded
Context: What problem are we solving? What constraints exist?
Decision: What did we choose?
Alternatives Considered: What else was evaluated, and why was it rejected?
Consequences: What tradeoffs are we accepting? What does this make harder/easier later?
```


ADD TO RELEVANT PLACES:
privacy policy, terms of service, refund policy, cookie policy, cookie consent banner, check form consents, no unecessary data, audit third-party SDKs
Remove fake reviews, remove unsupported claim, accessibility alt text, age consent, unsubscribe link in emails, data deletion request
text wrapping for better interfaces