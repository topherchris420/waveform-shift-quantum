# Palette's Journal

## 2026-04-16 - Header Action Feedback & Focus Accessibility in Dark Scientific Interfaces
**Learning:** Top-level navigation action buttons in dense, dark-themed scientific dashboards often lack explicit interactive feedback (e.g. toasts or smooth scroll actions) and high-contrast `focus-visible` rings, leaving keyboard users unsure if an action was received or which element currently holds focus.
**Action:** Always provide explicit `aria-label`s, distinct focus-visible rings (`focus-visible:ring-2`), and immediate feedback (e.g., via accessible toast notifications) for action buttons in header toolbars.

## 2026-05-20 - Navigation Focus & Context Accessibility in Scientific Dashboards
**Learning:** Header navigation links in complex, dark-themed scientific interfaces often lack adequate focus rings and semantic state indicators, making it hard for keyboard users to track position and active context.
**Action:** Always add high-contrast `focus-visible` styling (e.g., `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`) and use `aria-current="page"` for active navigation elements to provide clear keyboard accessibility and semantic state.

## 2026-06-12 - Mobile Layout Responsiveness & Text Containment in Dense Data Dashboards
**Learning:** Fixed grid layouts (`grid-cols-3`/`grid-cols-4`), unbounded LaTeX/math strings, and explicit width SVG containers cause severe clipping and horizontal overflow on mobile viewports (<380px).
**Action:** Use responsive grid classes (`grid-cols-1 sm:grid-cols-2 md:grid-cols-N`), wrap complex math/LaTeX in horizontal scroll containers (`overflow-x-auto max-w-full`), apply `break-words`/`truncate` to dense metrics text, and set responsive viewBox/dimensions on canvas/SVG containers with mobile swipe indicators.

## 2026-09-05 - Viewport Overflow Containment on Mobile Touch Viewports
**Learning:** In modern mobile browsers (WebKit/Blink), `overflow-x: hidden` on `body` alone can be bypassed if `html` and `#root` lack viewport containment or if flex/grid items default to `min-width: auto`. This allows touch panning that shifts page content off-screen to the left, cutting off words.
**Action:** Always set `max-width: 100vw`, `width: 100%`, and `overflow-x: hidden` on `html`, `body`, and `#root` in global CSS, and apply `min-w-0 max-w-full` to flex and grid child containers containing wide scrollable children (such as tables or bit strings).
