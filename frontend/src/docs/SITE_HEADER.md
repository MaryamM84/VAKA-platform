# VAKA Shared Site Header — Implementation and Maintenance Guide

> **Feature:** Responsive public-site header
> **Branch:** `feat/site-header`
> **Stack:** Next.js App Router, React, TypeScript, CSS Modules
> **Primary language / direction:** Persian (`fa`), right-to-left (`rtl`)
> **Status:** Header implemented and visually checked on the task-creation page; production integrations and the complete automated test suite remain pending.

## 1. Overview

The shared VAKA site header provides consistent navigation and primary actions across public and task-related pages. Its visual treatment follows the supplied Figma reference: a pale mint gradient, translucent rounded navigation shell, decorative circular elements, VAKA branding, an illustration, and a compact set of actions.

The header is rendered **once at the application layout level**, rather than imported independently into every page. It appears on the home page, the task-creation page, and future routes by default. Authentication pages intentionally use their own layouts without the public header.

### User-facing features

- VAKA logo and bilingual brand name, linked to the home page.
- Home navigation and dropdown-style entries for services/categories and support.
- A responsive search input (currently **UI only**).
- A prominent **Create New Task** link to `/employer/tasks/create`.
- A notifications button with an informational placeholder panel (currently **UI only**).
- A signed-in profile menu when an existing auth session is present; otherwise, a login link.
- A mobile menu and mobile search layout at smaller viewport widths.

The new header is independent of the task-creation wizard. Existing task form behavior and backend APIs were not modified as part of this feature.

## 2. File map and responsibilities

All paths below are relative to the repository root.

| File | Responsibility |
| --- | --- |
| `frontend/src/components/layout/SiteHeader.tsx` | Client-side header markup, menu interactions, search UI, notifications UI, login/profile controls, and task-creation link. |
| `frontend/src/components/layout/SiteHeader.module.css` | Header-specific presentation, visual tokens, positioning, dropdowns, responsive breakpoints, and reduced-motion handling. |
| `frontend/src/components/layout/SiteHeaderGate.tsx` | Client-side route gate, deciding whether the shared header should render. |
| `frontend/src/app/layout.tsx` | Root App Router layout; includes the gate before `children`. |
| `frontend/src/app/page.tsx` | Home page; no longer renders its own `SiteHeader`, preventing duplicate headers. |
| `frontend/public/images/header-illustration.png` | Decorative header character, prepared from the approved visual reference. |
| `frontend/public/images/main logo.png` | Existing VAKA logo reused by the header. |
| `frontend/next.config.ts` | General Next.js configuration; **include only if a locally tested header-related CSS configuration fix was made**. |
| `frontend/src/docs/SITE_HEADER.md` | This documentation. |

The stepper UI is implemented in `frontend/src/components/task-creation/TaskCreationWizard.tsx`; its page-level visual styles live in `frontend/src/app/globals.css`. Those are separate from the shared-header feature and should not be staged for a header-only commit unless an explicitly reviewed fix is required.

## 3. Architecture and render flow

```text
frontend/src/app/layout.tsx (server-side root layout)
  └── SiteHeaderGate.tsx (client component; usePathname)
        ├── /login, /register, /signup, or descendants → render null
        └── every other pathname → SiteHeader.tsx
                                     ├── brand and illustration
                                     ├── desktop navigation
                                     ├── search UI
                                     ├── create-task link
                                     ├── notification placeholder
                                     └── auth-aware login/profile
  └── {children} (requested page content)
```

The route exclusions are maintained in the `HEADERLESS_ROUTES` array inside `SiteHeaderGate.tsx`:

```ts
const HEADERLESS_ROUTES = ["/login", "/register", "/signup"];
```

The gate tests both the exact route and paths below it (`pathname.startsWith(`${route}/`)`), so nested authentication routes are excluded too. To add another headerless section, update this array and verify the path behavior.

**Do not re-import `SiteHeader` into individual `page.tsx` files** when the shared layout already renders it. Doing so creates duplicated headers and unintended spacing.

## 4. Header behaviors and routing

| Item | Current behavior | Integration status |
| --- | --- | --- |
| VAKA logo / brand | `Link` to `/` | Connected |
| Home | `Link` to `/` | Connected (home content is not yet designed) |
| Create New Task | `Link` to `/employer/tasks/create` | Connected to existing frontend route |
| Services / categories | Disclosure with a task-creation shortcut and a placeholder note | Categories directory not yet connected |
| Support | Disclosure with informational copy | Support route / service not yet connected |
| Search | Controlled input and submit; displays an informative message when a nonempty query is submitted | **No search API or results navigation** |
| Notifications | Toggleable panel with informational copy | **No notification API or unread-count logic** |
| User account | Displays profile dropdown if stored session can be parsed; otherwise shows `ورود` | Uses existing client-side auth state |
| Logout | Removes `vaka.auth` from browser storage and emits a local auth-change event | No server-side token revocation in this component |

### Session handling

`SiteHeader.tsx` reads the existing `vaka.auth` payload from `localStorage` (falling back to `sessionStorage`). The implementation requires a nonempty `access` string and a `user` object; it uses `user.full_name` or `user.phone` for profile display. It subscribes to the browser `storage` event and the custom `vaka:auth-changed` event for UI updates.

The session check is a **presentation hint**, not a security boundary. Authorization for protected actions must remain enforced by the backend and any route-level controls. Do not add secrets, tokens, or real user data to this document or to sample PR descriptions.

## 5. Design system and responsiveness

The header intentionally uses its own CSS Module so that styles do not leak into login, registration, or task-creation components. The visual reference uses green `#1F6F62`, light mint backgrounds, frosted white surfaces, peach accent details, and rounded pill controls. The site already uses the Vazirmatn font and RTL direction from the application root.

Responsive behavior defined in `SiteHeader.module.css`:

| Viewport | Behavior |
| --- | --- |
| `> 1350px` | Full desktop layout, including the illustration when space allows. |
| `≤ 1350px` | Illustration hidden to protect layout width. |
| `≤ 1120px` | Desktop navigation hidden; mobile navigation toggle becomes available. |
| `≤ 790px` | Search moves to a separate mobile row; header height and spacing adjust. |
| `≤ 480px` | Brand and action controls become more compact; task CTA label shortens. |
| `≤ 360px` | Notifications button is hidden to preserve space. |

The stylesheet also includes `prefers-reduced-motion` handling for users who request reduced animation.

The decorative character is an extracted approximation of the visual reference rather than the original exported Figma illustration. Replace the asset with a transparent, high-resolution designer-provided export if exact visual fidelity is required.

## 6. Local development and verification

From the repository root in PowerShell:

```powershell
cd frontend
npm ci
npm run dev
```

Then inspect:

- `http://localhost:3000/` — header is shown once.
- `http://localhost:3000/employer/tasks/create` — header appears **above** the five-step task wizard.
- `http://localhost:3000/login` — header is absent.
- `http://localhost:3000/register` — header is absent.

Check both desktop and mobile widths, open/close the navigation disclosures, use the create-task link, verify logged-out and logged-in appearances if test sessions are available, and check for horizontal overflow or overlaps.

Before opening a Pull Request, stop the dev server if necessary and run:

```powershell
npm run lint
npm run build
```

**Verification record:** The shared header has been observed in a user-provided browser screenshot on `/employer/tasks/create`. This documentation does **not** assert that lint, production build, mobile QA, or end-to-end tests have passed; record their actual results in the Pull Request.

### Troubleshooting

- **Header markup appears without styling:** inspect `SiteHeader.module.css` import and any local changes to `frontend/next.config.ts`; restart `npm run dev`, then hard-refresh the page. Stage a configuration change only after reviewing and validating its necessity.
- **Header is duplicated:** ensure only `SiteHeaderGate` is rendered in the shared layout and remove any page-level `SiteHeader` import.
- **Header appears on login/register:** check `HEADERLESS_ROUTES` and verify that the gate is imported in the correct root layout.
- **Navbar overlaps on narrow screens:** check the CSS Module breakpoints and test real device widths before changing the layout.
- **Create Task link does not open:** verify that `/employer/tasks/create` remains a valid Next.js route.

## 7. Scope, known limitations, and next steps

**Included in this feature**

- Shared header component and scoped visual styling.
- Route-aware layout integration, with explicit authentication-page exclusions.
- Reuse of the existing logo and a dedicated illustration asset.
- Navigation and task-creation shortcut with responsive desktop/mobile layout.
- Informational placeholders for not-yet-implemented integrations.

**Not included / follow-up work**

- Real search results or a search backend connection.
- Live notifications, unread counts, or push notifications.
- Full services directory and support routes.
- Server-side session verification or token revocation.
- A complete designed home page.
- Redesign of the task wizard, stepper background, or other page content.
- Automated responsive, accessibility, or end-to-end test coverage.

**Known usability note:** The home link currently carries a static `aria-current="page"` attribute in the header markup. In a follow-up refinement, derive this state from `usePathname()` so that the active-page announcement is accurate outside `/`.

## 8. Team Git workflow and PR checklist

This change follows `docs/strategy.md`: use a dedicated `feat/` branch, descriptive lowercase English commit messages, and a Pull Request targeting `main`. Do not commit directly to `main`; request approval from at least one other team member. The author must not approve their own PR.

Recommended header-only commit message:

```text
feat: implement shared responsive site header
```

Before committing, stage only the expected header paths and this document. Keep downloaded `.patch` files, nested project copies, local environment files, and unrelated stepper/background edits out of the commit. Use `git diff --cached --name-only` and `git diff --cached` to review the exact staged changes.

Suggested PR summary:

- Add a shared responsive VAKA site header from the Figma reference.
- Render the header on application pages; exclude login and registration.
- Link the primary call-to-action to the existing task-creation flow.
- Document current client-side behaviors, limitations, and test results.

**Acceptance criteria**

- [ ] Only one header on `/` and `/employer/tasks/create`.
- [ ] No header on `/login` or `/register`.
- [ ] No regression to the five-step task-creation flow.
- [ ] Layout usable at desktop, tablet, and mobile widths.
- [ ] Search and notifications are clearly not represented as live features.
- [ ] Lint/build results recorded (or failures explained) in the PR.
- [ ] Staged files contain only approved feature changes; no secrets or environment files.
- [ ] At least one independent teammate approves the PR before merge.
