# CherryFlow GUI Refresh 2026

> Direction: **ops-first / daily-use-first AI operations cockpit**
>
> CherryFlow should feel like a production tool that operators, developers, analysts, and administrators can keep open all day—not a one-time AI demo page.

## 1. Product direction

The refreshed GUI is designed around five daily-use jobs:

1. **Understand system state quickly** — workflow health, schema validity, model/provider state, run status, and release state must be visible without opening several pages.
2. **Switch context quickly** — Builder, Canvas, Models, Runs, Logs, versions, and public apps should share a consistent shell and navigation model.
3. **Configure safely** — AI may propose UI and workflow changes, while CherryFlow validates and renders only allowlisted components and validated graph structures.
4. **Debug professionally** — node configuration, validation errors, run steps, outputs, and artifacts should be inspectable without leaving the current workspace.
5. **Operate repeatedly** — save, validate, run, publish, restore, import, and export should be fast, keyboard-friendly, and predictable.

The core architecture remains unchanged:

- Next.js + React
- React Flow / XYFlow for visual workflows
- constrained UI Schema
- allowlisted React components
- validated workflow graph execution
- versioned save, publish, and rollback
- local-first and OpenAI-compatible model access

## 2. Visual language

### Identity

The recommended product palette is **Graphite + Cherry + Electric Blue**:

- Cherry is the brand identity and high-level selected state.
- Electric blue is the primary action, focus, navigation, and interactive intelligence color.
- Graphite and neutral surfaces keep operational screens calm and readable.
- Semantic colors are reserved for success, warning, and failure states.

### Core tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| Brand | `#E11D48` | `#FB7185` | identity and selected product states |
| Action | `#2563EB` | `#60A5FA` | primary buttons, focus, links, active controls |
| App background | `#F4F6FB` | `#070B14` | application shell |
| Surface | `#FFFFFF` | `#111827` | cards, panels, forms |
| Raised surface | `#EEF2F7` | `#172033` | inspectors, selected panels, toolbars |
| Primary text | `#111827` | `#E5E7EB` | body and headings |
| Muted text | `#64748B` | `#94A3B8` | helper and metadata |
| Success | `#16A34A` | `#4ADE80` | healthy, completed |
| Warning | `#D97706` | `#F59E0B` | attention, queued |
| Danger | `#DC2626` | `#F87171` | failed, destructive |

### Layout rules

- 4 px spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48.
- 10 px control radius, 16 px panel radius, 20–24 px elevated/preview radius.
- Inter/system UI font for normal product text.
- Monospace font for IDs, module names, JSON, logs, metrics, environment names, and run metadata.
- Decorative glow and glass effects are limited to product identity and elevated toolbars; data-heavy surfaces prioritize hierarchy and readability.

## 3. Implemented in this refresh

### Builder cockpit

- New ops-first app shell and information hierarchy.
- Light/dark theme persisted in local storage.
- Workflow summary with node, component, and version counts.
- Generate, refine, save, publish, and public URL controls grouped by task.
- Accessible tab semantics with `tablist`, `tab`, `tabpanel`, and `aria-selected`.
- Keyboard view switching with `Ctrl/Cmd + 1–4`.
- Command palette with `Ctrl/Cmd + K`.
- Provider, schema health, component count, graph count, and validation status.
- Validation workspace with errors, safe-schema facts, and read-only JSON.
- Improved version history and restore flow.
- Browser-style runtime preview frame.
- Status/error banners with dismiss controls.
- Responsive layout for desktop, tablet, and narrow screens.

### Workflow graph preview

- Standard node card system for input, module, and output roles.
- Consistent node metadata and config-key counts.
- Graph-level node, connection, and configured-node metrics.
- Expandable graph validation issues.
- Improved React Flow controls, minimap, pan behavior, and hierarchy.
- Richer read-only node inspector.
- Smooth-step edges and clearer selected-node states.

### Editable Canvas

- Dark operator workspace with separate palette, canvas, and inspector zones.
- Searchable module palette.
- Product navigation between Builder, Canvas, and Models.
- Grouped import/export, validate, save, and run controls.
- `Ctrl/Cmd + S` to save.
- `Ctrl/Cmd + Enter` to run a valid graph.
- `Escape` to clear selection.
- Snap-to-grid, pan-on-scroll, minimap, controls, and selection behavior.
- Inline graph validation summary and expandable issue list.
- Node inspector with immediate JSON syntax state and config-key count.
- Output-node indicator and destructive delete action.
- Dismissible notices and run-result drawer.
- Responsive fallback behavior for smaller screens.

### Safe-schema public/runtime UI

- Navbar items now render as semantic links.
- CTA now renders as a real link to the workflow form.
- Notices expose suitable status/alert semantics.
- Workflow forms and outputs expose better busy/live/error states.
- Run steps use semantic time values.
- Expanded productized runtime styling for:
  - navigation
  - hero sections
  - stat cards
  - feature grids
  - steps
  - FAQ
  - CTA
  - footer
  - forms
  - run progress
  - outputs
  - report previews
- Reduced-motion support and visible focus rings.

## 4. Full component roadmap

The items below are the complete GUI proposal inventory. Items marked **Implemented** are included in this branch. Remaining items are intentionally documented as follow-up work rather than being hidden or lost.

| Component / capability | Purpose | Status |
|---|---|---|
| App shell | shared navigation and operational context | Implemented for Builder and Canvas |
| Accessible tabs | keyboard/screen-reader view switching | Implemented |
| Command palette | fast navigation and actions | Implemented in Builder |
| Page header | breadcrumb, title, status, actions | Implemented in Builder and Canvas |
| Property inspector | configure and inspect selected nodes | Implemented |
| Validation panel | schema/graph errors with clear severity | Implemented |
| Canvas node kit | consistent input/module/output cards | Implemented in graph preview; editable node renderer can be expanded |
| Canvas toolbar | validate, save, run, import, export | Implemented |
| Empty states | useful next actions instead of blank screens | Implemented in key Builder/Canvas views |
| Inline feedback | success, error, loading, validation | Implemented in key Builder/Canvas flows |
| Theme switcher | light/dark/system | Light/dark implemented in Builder; system and global persistence remain |
| Keyboard shortcuts | frequent operational actions | Implemented for Builder and Canvas core actions |
| Runs table | filter, sort, retry, inspect run history | Follow-up |
| Logs drawer | step logs, raw payload, trace metadata | Follow-up |
| Artifact viewer | file, report, markdown, image, preview metadata | Partial runtime support; dedicated viewer remains |
| Provider switcher | select and inspect local/OpenAI-compatible providers | Follow-up |
| Secrets and environment form | safe provider/connection configuration | Follow-up |
| Model health dashboard | availability, context, latency, capacity | Follow-up |
| Data tables | dense versions, runs, models, artifacts | Follow-up; TanStack Table recommended |
| Toast system | consistent transient feedback | Follow-up; current inline banners remain |
| Onboarding coachmarks | teach Builder/Canvas progressively | Follow-up |
| Shortcut overlay | searchable list of all shortcuts | Follow-up |
| Visual schema diff | compare draft/published versions | Follow-up |
| Mobile inspector drawer | usable node config on tablet/mobile | Follow-up |
| Global design-system catalog | document primitives and states | Follow-up; Storybook recommended |

## 5. Recommended technology path

Do not replace the current architecture. Evolve it incrementally.

### Keep

- Next.js and React
- TypeScript
- React Flow / XYFlow
- existing API contracts
- existing safe-schema validation and renderer
- existing workflow/version/publish behavior

### Add selectively

- **Radix primitives or React Aria** for tabs, dialogs, drawers, menus, comboboxes, tooltips, and keyboard interactions.
- **shadcn/ui-style open-code components** when a reusable primitive should remain fully owned by CherryFlow.
- **TanStack Table** for Runs, Logs, Models, Versions, and Artifacts.
- **TanStack Query** when server-state caching, polling, retries, and invalidation become broader.
- **Storybook** or an equivalent component catalog for product primitives and visual states.
- **Playwright** for end-to-end operator journeys.
- **axe** for automated accessibility checks.
- **Lighthouse CI** for landing/public applications.

Avoid importing a large visual framework across the whole codebase unless delivery speed becomes more important than product identity. CherryFlow already has an architecture suited to an owned design system.

## 6. Required production screens

### Daily operations

1. Overview / Operations dashboard
2. Workflows list
3. Builder
4. Editable Canvas
5. Runs
6. Run detail and logs
7. Artifacts
8. Models and providers
9. Secrets / environments
10. Published applications
11. Versions and visual diff
12. Settings / access control

### Runs table requirements

- workflow, status, provider, duration, started by, created time
- filter by status, workflow, provider, date
- sort and pagination
- retry/re-run from failed step where supported
- open run detail without losing table context
- copy run ID
- show queued/running/completed/failed consistently

### Logs drawer requirements

- step list and active step
- timestamped structured logs
- request and response payload tabs
- artifact metadata
- model/provider metadata
- copy/download log
- failure explanation and suggested remediation

### Provider/model requirements

- local/OpenAI-compatible endpoint status
- model name, context limit, capability tags
- latency, throughput, last health check
- fallback chain and active provider
- masked secret state
- test-connection action

## 7. Accessibility acceptance checklist

Every GUI PR should verify:

- all interactive elements are native buttons, links, inputs, or semantic primitives
- keyboard focus is visible
- keyboard order matches visual order
- dialogs trap and restore focus
- tabs expose tab semantics and arrow-key behavior when a primitive is added
- form labels are associated with inputs
- errors use `role="alert"` or an equivalent live region
- loading/running states expose `aria-busy`
- status updates use polite live regions when appropriate
- color is not the only indicator of state
- text and controls meet contrast requirements
- reduced-motion users do not receive unnecessary animation
- Canvas actions have a non-drag alternative

## 8. Test and release hardening

### Pull-request quick gate

- dependency install
- TypeScript typecheck
- unit tests
- production build

### GUI confidence layer

- component catalog build
- visual regression snapshots for Builder, Canvas, runtime templates, dialogs, and dark mode
- Playwright journeys:
  1. open Builder
  2. generate schema
  3. inspect validation
  4. open Flow
  5. save draft
  6. publish
  7. open public slug
  8. restore version
- Canvas journey:
  1. add node
  2. configure JSON
  3. connect nodes
  4. validate
  5. save
  6. run
  7. inspect result
  8. export/import
- axe checks for tabs, dialogs, forms, navigation, and public runtime
- Lighthouse CI for landing and public apps
- bundle-size budget for the web application

## 9. Migration sequence

### Phase A — foundation

- design tokens
- shared controls and feedback
- Builder shell
- Canvas shell
- semantic runtime components

**Status:** included in this refresh.

### Phase B — operations data

- Runs table
- run detail/log drawer
- Models/providers
- Secrets/environments
- Artifact viewer

### Phase C — design-system hardening

- reusable primitive package
- Storybook/catalog
- visual regression
- React Aria/Radix migration for advanced interactions
- global theme provider

### Phase D — release confidence

- Playwright operator journeys
- axe checks
- Lighthouse and bundle budgets
- feature flags and staged rollout

## 10. Non-negotiable architecture safeguards

- AI must not generate arbitrary executable browser JavaScript.
- New runtime components must be added through the allowlist and validator.
- Schema freedom must expand gradually and deliberately.
- Workflow graph validation remains authoritative.
- UI work must not silently bypass approval, secret handling, provider, or execution safeguards.
- Existing API and business logic should be reused while the presentation layer is migrated route by route.

## 11. Definition of done for the complete GUI program

The GUI program is complete when:

- Builder, Canvas, Runs, Logs, Models, Providers, Artifacts, Versions, and Published Apps share one design system.
- Every major action has loading, success, empty, warning, and failure states.
- Core daily workflows are fully keyboard accessible.
- Desktop and tablet operational use is practical; mobile has an intentional read/triage experience.
- Safe-schema runtime templates look like finished products rather than raw generated sections.
- Visual regression and end-to-end tests protect releases.
- Operators can answer “what is running, what failed, why, and what should I do next?” without leaving CherryFlow.
