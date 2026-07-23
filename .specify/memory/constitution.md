<!--
Sync Impact Report
Version change: [TEMPLATE] → 1.0.0 (initial ratification — file previously contained only placeholder tokens)
Modified principles: n/a (first fill)
Added sections:
  - I. Real-Time State Consistency (NON-NEGOTIABLE)
  - II. Test-First for Game Logic and Flows
  - III. Type-Safe, Validated Boundaries
  - IV. Secure by Default
  - V. Minimal-Footprint, YAGNI Changes
  - Frontend & UX Standards
  - Development Workflow & Quality Gates
  - Governance
Removed sections: none (template placeholders only)
Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ no change needed (Constitution Check gate is derived dynamically from this file)
  - .specify/templates/spec-template.md — ✅ no change needed (technology-agnostic, no conflicting references)
  - .specify/templates/tasks-template.md — ✅ no change needed (generic phase structure, no conflicting references)
  - .specify/templates/checklist-template.md — ✅ no change needed
  - No command files under .specify/templates/commands/ exist in this project
Follow-up TODOs: none — no placeholders were deferred
-->

# IArdoise Constitution

## Core Principles

### I. Real-Time State Consistency (NON-NEGOTIABLE)

`SessionManager` is the single source of truth for session, player, drawing, and
score state. HTTP routes and WebSocket handlers MUST read and mutate state
through it — no handler may keep parallel or shadow state. Every mutation
that affects connected clients (join, draw, score, round advance, end) MUST
broadcast the corresponding WebSocket event as part of the same operation,
before the initiating request is reported as successful.

**Rationale**: the product's entire value is that host and players see the
same game state in real time. Divergent state between the host dashboard and
player canvases is not a cosmetic bug — it is a product failure.

### II. Test-First for Game Logic and Flows

New or changed `SessionManager` behavior (create, join, draw, score, advance
round, end) MUST have a Vitest unit test before the change is considered
done. New or changed HTTP or WebSocket contracts MUST have a backend
integration test. Any change to a user-facing flow (login → create/join
session → draw → score → end) MUST be covered by a Playwright E2E scenario
for the golden path. Where practical, write the failing test before the fix.
Tests MUST be green, not merely present, before a change is reported as done.

**Rationale**: this project already invests in Vitest (unit + integration)
and Playwright (E2E); this principle keeps that investment load-bearing
instead of decorative, and matches the standing rule that "done" requires
demonstrated proof, not a description of intent.

### III. Type-Safe, Validated Boundaries

TypeScript strict mode is mandatory in both `backend` and `frontend`
workspaces. Every HTTP endpoint and every WebSocket message handler MUST
validate its input against a schema before that input touches
`SessionManager` state or is broadcast to other clients. Host input and
player input are both untrusted external input, not internal calls.

**Rationale**: both the host and every player are independent browser
clients sending arbitrary payloads over HTTP and WebSocket. Validating at
the boundary is what prevents one malformed message from corrupting shared
game state for the whole session.

### IV. Secure by Default

Secrets (`JWT_SECRET`, `HOST_PASSWORD_HASH`, and any future credential) MUST
come from environment variables — never hardcoded, never committed. Passwords
MUST be hashed with bcryptjs; plaintext passwords MUST NOT appear in logs or
storage. Every state-changing HTTP route and WebSocket message MUST verify
the caller's JWT before acting; host-only actions (award score, advance
round, end session) MUST additionally verify the caller is the authenticated
host. Logging MUST go through the structured Fastify/pino logger
(`app.log`), never `console.*`, and log payloads MUST NOT include tokens,
password hashes, or full canvas pixel data.

**Rationale**: matches the project's existing JWT + bcrypt design
(`ARCHITECTURE.md` §Authentication) and keeps operational logs safe to share
for debugging without a redaction pass.

### V. Minimal-Footprint, YAGNI Changes

Prefer the smallest change that satisfies the current spec or bug report. Do
not introduce persistent storage, new abstractions, or configuration options
that the current feature does not need. In-memory session state is the
accepted MVP design (see `ARCHITECTURE.md` §Future Improvements); moving to a
persistent store (e.g., PostgreSQL, Redis) requires an explicit spec/plan
decision, not an incidental addition inside an unrelated change. Bug fixes
address the root cause directly, in the same change — no symptomatic patches,
no backward-compatibility shims for a pre-1.0, single-deployment project.

**Rationale**: IArdoise is an actively evolving MVP; every unrequested
abstraction or premature persistence layer is a maintenance cost paid before
it's earned.

## Frontend & UX Standards

Styling MUST use CSS custom-property (design token) values rather than
hardcoded hex/rgb/px literals scattered across components, so the PWA theme
stays consistent and themeable from one place. Canvas drawing MUST target
60fps rendering via `requestAnimationFrame`; outgoing WebSocket draw events
MUST stay throttled (~100ms), never emitted per-pixel, per the existing
architecture (`ARCHITECTURE.md` §Performance). The app MUST remain
installable and its cached static assets MUST remain usable offline per the
PWA manifest and service worker; changes that would break offline install or
asset caching require explicit review before merge.

## Development Workflow & Quality Gates

`npm run build` (both workspaces) and `npm test` (backend, Vitest) MUST pass
before a change is considered done. `npm run test:e2e` MUST pass for any
change touching a user-facing flow. Environment or configuration changes
(`.env.example`, `backend/src/config.ts`) MUST be reflected in `README.md`
and/or `DEPLOYMENT.md` within the same change. A reported bug is fixed
directly in the change that reports it, not deferred to a follow-up.

## Governance

This constitution supersedes ad-hoc practice; where this document and other
guidance conflict, this document wins. Amendments are made by editing this
file: the change MUST state its rationale, bump the version per the policy
below, and update any templates or in-flight specs/plans that reference the
changed principle(s) in the same change.

Versioning is semantic:
- **MAJOR** — a principle is removed or redefined in a backward-incompatible
  way.
- **MINOR** — a new principle or section is added, or existing guidance is
  materially expanded.
- **PATCH** — wording, clarification, or non-semantic refinement.

`/speckit.plan`'s Constitution Check gate MUST verify new work against these
principles before Phase 0 research and again after Phase 1 design. A
violation that cannot be resolved MUST be justified in the plan's Complexity
Tracking section, or the work MUST be redesigned to comply. Runtime
development guidance for AI coding agents lives in `CLAUDE.md` at the repo
root.

**Version**: 1.0.0 | **Ratified**: 2026-07-23 | **Last Amended**: 2026-07-23
