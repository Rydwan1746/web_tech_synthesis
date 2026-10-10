# Spec compliance notes — Atomic Habit Tracker

This file records mismatches found against `habit-tracker-spec.md`, what was changed to fix them, and how the project stands now.

## Mismatches found

### 1. Native form validation was disabled

**Spec (Section 6.6):** empty name and identity must be blocked with the native HTML `required` attribute. Do not hand-roll JavaScript validation for this form.

**What was wrong:** `#add-habit-form` had `novalidate`, so the browser never showed native validity messages. Submit was handled in JavaScript, which returned silently when name or identity was empty — no feedback.

**Fix:**

- Removed `novalidate` from the form in `index.html`.
- Removed the JavaScript empty-field guard in `handleAddHabit`. Empty required fields never reach that handler; the browser blocks submit first.
- Values are still trimmed when the habit is saved (`addHabit` already called `.trim()`).

### 2. “Log it” closed the whole stacking dialog

**Spec (Section 6.8):** if several habits are stacked after the one just completed, show **one** dialog with a **Log it** button per row and a single **Not now**. Each stacked habit should be loggable independently.

**What was wrong:** every **Log it** click marked that habit done, then immediately called `stackingDialog.close()`. A second stacked habit on the same parent was never offered in that session.

**Fix:**

- **Log it** still marks the stacked habit done and re-renders the cards (the filled grid square is the confirmation).
- That row is removed from the dialog.
- The dialog stays open while other stacked rows remain.
- The dialog closes when the last remaining stacked habit is logged, or when the user chooses **Not now**, Escape, or the backdrop.

### 3. “Log it” did not use the same path as “Mark done today”

**Spec (Sections 6.8 and 7.5):** logging a stacked habit should use the same completion logic as the card button. The card path, after a not-done → done transition, runs `getStackedPromptsFor()` and may open the stacking dialog.

**What was wrong:** **Log it** only called `toggleHabitCompletion()` and closed the dialog. It never ran the stacking trigger. A chain such as A → B → C would prompt for B after completing A, but logging B from the dialog would not prompt for C.

**Fix:**

- Card check-in and **Log it** both go through `toggleCheckinAndPrompt()`, which toggles today’s completion, re-renders, and on a new completion calls `getStackedPromptsFor()`.
- If a stacking dialog is already open (siblings stacked on the same parent), nested prompts are queued instead of replacing the current rows.
- When the current dialog closes, queued nested prompts are shown (after dropping any habits already logged for today).

This keeps “multiple habits stacked on the same parent” in a single dialog, and still prompts for a further stacked habit after the user logs its anchor — the same as tapping **Mark done today** on that card.

---

## Current state of the project

The app is a vanilla HTML/CSS/JS habit tracker that follows `habit-tracker-spec.md` on the features that matter for the assignment.

**In place**

- Single page: `index.html`, `style.css`, `app.js`. No frameworks, CDNs, or build step.
- Persistence under the `atomicHabits` `localStorage` key. Habit objects match the specified shape. Completions are ISO date strings only.
- Five fixed categories and colors, in the specified dropdown order.
- Add habit (collapsible form), daily check-in for today only (toggle undo), delete with `confirm()`, newest-first cards.
- Current streak (today or yesterday still counts) and longest streak, using date objects and millisecond day diffs as specified.
- 12-week GitHub-style contribution grid (Sun–Sat rows, oldest week on the left), generated in JavaScript, with native `title` tooltips.
- Summary bar: total habits and longest *active* streak with the habit name.
- Stacking label on cards; invitational native `<dialog>` (not a command, no guilt/red UI).
- Layout, typography, colors, and the 480px grid/streak breakpoint match Section 6.

**Intentionally extra (not forbidden by the spec)**

- Cancel button on the add-habit form.
- Empty state when there are no habits.
- Identity line inside the stacking dialog (in addition to the required title/body copy).
- The “+ New Habit” button is hidden while the form is open.

**How to confirm the three fixes**

1. Open the add-habit form and submit with an empty name or identity — the browser should show native required messages, not a silent no-op.
2. Stack two habits on the same parent, mark the parent done, tap **Log it** on one row — the other row should still be there until logged or dismissed.
3. Stack B after A and C after B. Mark A done, **Log it** for B — after that dialog finishes, you should be invited to log C.
