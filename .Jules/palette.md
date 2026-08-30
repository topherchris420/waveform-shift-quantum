# Palette's Journal

## 2026-04-16 - Header Action Feedback & Focus Accessibility in Dark Scientific Interfaces
**Learning:** Top-level navigation action buttons in dense, dark-themed scientific dashboards often lack explicit interactive feedback (e.g. toasts or smooth scroll actions) and high-contrast `focus-visible` rings, leaving keyboard users unsure if an action was received or which element currently holds focus.
**Action:** Always provide explicit `aria-label`s, distinct focus-visible rings (`focus-visible:ring-2`), and immediate feedback (e.g., via accessible toast notifications) for action buttons in header toolbars.

## 2026-05-20 - Navigation Focus & Context Accessibility in Scientific Dashboards
**Learning:** Header navigation links in complex, dark-themed scientific interfaces often lack adequate focus rings and semantic state indicators, making it hard for keyboard users to track position and active context.
**Action:** Always add high-contrast `focus-visible` styling (e.g., `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`) and use `aria-current="page"` for active navigation elements to provide clear keyboard accessibility and semantic state.
