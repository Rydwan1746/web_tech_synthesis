# Project Spec: "Atomic" — Habit Tracker

## 1. Project Overview

Build a single-page habit tracking web app inspired by the core ideas in James
Clear's *Atomic Habits*. The app lets a user define habits, log daily
completions, and see their consistency visualized as a GitHub-contribution-style
grid. The point of the app is to make **streaks and consistency visible**, not
just to store a list of checkboxes.

Core philosophy to encode into the product, not just the README:
- **"Don't break the chain"** — the visual grid is the emotional centerpiece of
  the app. Chain-breaking should feel slightly uncomfortable; chain-building
  should feel satisfying.
- **Identity-based habits** — each habit is tagged with an identity category
  (e.g., "I am someone who reads" rather than just "Read 10 pages"). The
  category should be visible, not buried.
- **1% better, not 100% better** — no guilt-based red/failure messaging. Missing
  a day is shown neutrally (an empty cell), not punitively (no red X, no
  "you failed" language anywhere in the UI or copy).
- **Habit stacking** — users can optionally link a new habit to an existing one
  ("After I [existing habit], I will [new habit]"), and the UI should visually
  indicate stacked habits are linked. Completing the anchor habit surfaces a
  low-friction, invitational prompt for the stacked habit — never a command.

---

## 2. Tech Stack

- **HTML5** — single `index.html`, semantic structure.
- **CSS3** — single `style.css`, no framework (no Bootstrap/Tailwind). Vanilla
  CSS using Grid and Flexbox.
- **JavaScript (ES6+, vanilla)** — single `app.js`, no frameworks, no build
  step, no bundler. This must run by opening `index.html` directly or via a
  simple local dev server — no npm install required.
- **Persistence:** `localStorage` only. No backend, no database, no login.
  All data is scoped to the browser.
- **No external libraries or CDNs** of any kind (no icon fonts, no date
  libraries, no chart libraries). All date math and rendering is done by hand
  — this is intentional, it's the point of the exercise.

### File structure
```
/habit-tracker
  index.html
  style.css
  app.js
```
Three files only. Do not split JS into modules — keep it in one file, organized
with clear section comments, so it stays easy to read end-to-end as a learning
artifact.

---

## 3. Data Model

Store everything in `localStorage` under a single key: `"atomicHabits"`.

The stored value is a JSON string representing an array of **habit objects**.
Each habit object has this exact shape:

```js
{
  id: "habit_1700000000000",     // string, generated via Date.now() prefixed with "habit_"
  name: "Read 10 pages",          // string, user-entered
  identity: "A reader",           // string, user-entered, the "I am someone who..." framing
  category: "Learning",           // string, one of a fixed set (see Section 4)
  color: "#4f8a5b",                // string, hex color, auto-assigned per category (see Section 6)
  createdAt: "2026-10-06",         // string, ISO date (YYYY-MM-DD), date habit was created
  stackedAfter: null,              // string or null — the id of another habit this one is stacked after
  completions: [                   // array of ISO date strings, one per day completed
    "2026-10-06",
    "2026-10-07"
  ]
}
```

**Important implementation rule:** `completions` stores ONLY the date strings
of days the habit was completed — no boolean grid, no pre-filled false values.
A day with no entry in the array is simply "not completed." This keeps the
data model small and makes streak calculation a pure function over the array.

---

## 4. Fixed Category List

Use exactly these five categories, each with a fixed accent color (do not let
the user create custom categories — this keeps the UI consistent):

| Category   | Hex color |
|------------|-----------|
| Health     | `#4f8a5b` (green) |
| Learning   | `#3b6ea5` (blue) |
| Creativity | `#9b5bb5` (purple) |
| Mindfulness| `#c7893f` (amber) |
| Connection | `#c75f6a` (rose) |

The category dropdown in the "add habit" form must list exactly these five
options, in this order.

---

## 5. Core Features (in build order — see Section 8 for phased steps)

1. **Add a habit** via a form: name, identity statement, category (dropdown),
   optional "stack after" (dropdown of existing habits, default "None").
2. **Daily check-in**: each habit card has a "Mark done today" button/checkbox.
   Clicking it adds today's date to that habit's `completions` array. Clicking
   again (toggle) removes it — the user must be able to undo an accidental
   check-in for today only (not for past days, to avoid retroactive gaming of
   streaks).
3. **Streak calculation**: for each habit, compute and display the **current
   streak** (consecutive days up to and including today or yesterday) and the
   **longest streak ever achieved**. See Section 7 for the exact algorithm —
   follow it precisely, streak logic is the trickiest part of this project and
   has real edge cases.
4. **Contribution grid**: a GitHub-style grid of small squares, one per day,
   for the last 12 weeks (84 days), per habit. Filled square = completed that
   day. Empty square = not completed. See Section 6 for exact visual spec.
5. **Habit stacking indicator**: if a habit has `stackedAfter` set, display a
   small label under its name: "After: [name of the habit it's stacked on]".
6. **Delete a habit**: a small delete control on each card, with a confirm
   step (use a native `confirm()` dialog — no need to build a custom modal for
   this).
7. **Persistence**: every mutation (add, check-in, delete) immediately writes
   the full updated array back to `localStorage`. On page load, read from
   `localStorage` first; if nothing exists, start with an empty array (not
   sample/demo data).
8. **Summary header**: at the top of the page, show total habits tracked, and
   the single longest active streak across all habits, with the habit name
   attached (e.g., "Longest active streak: 14 days — Read 10 pages").
9. **Stacking prompt dialog**: when a habit is marked done (not un-marked),
   check whether any OTHER habit in the array has `stackedAfter` set to the
   id of the habit that was just completed. If one or more matches are found,
   show a dialog prompting the user to log that stacked habit too. See
   Section 6.8 for the exact UI spec and Section 7.5 for the trigger logic.
   This must NOT fire when un-marking a habit (toggling a completion off),
   only on the transition from not-done to done.

---

## 6. Design & Layout Specification

### 6.1 Overall layout

- Single column, centered, `max-width: 760px`, with generous side padding on
  smaller viewports.
- Vertical sections, top to bottom:
  1. Page header (app name + tagline)
  2. Summary bar (stats described in Feature 8)
  3. "Add new habit" form (collapsible — starts collapsed behind a
     "+ New Habit" button to keep the page uncluttered; clicking it reveals
     the form inline, pushing content down, no modal)
  4. List of habit cards, newest first

### 6.2 Typography

- Font: system font stack — `font-family: -apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, sans-serif;` (no external font loading).
- Page title: `2rem`, weight 700.
- Habit name (on card): `1.15rem`, weight 600.
- Identity statement: `0.9rem`, italic, lighter color (`#6b7280`).
- Body/meta text (streak counts, etc.): `0.85rem`, weight 500.

### 6.3 Color system

- Background: `#f9fafb` (very light gray, not pure white — reduces harshness).
- Card background: `#ffffff`.
- Card border: `1px solid #e5e7eb`.
- Card border-radius: `10px`.
- Primary text: `#1f2937`.
- Secondary/muted text: `#6b7280`.
- Category accent colors: as defined in Section 4's table — used for the small
  category pill/tag on each card, and for the filled squares in that habit's
  contribution grid.
- **No red anywhere in the UI.** This is a deliberate design constraint tied to
  the "no guilt" philosophy in Section 1 — missed days are neutral gray, not
  red. Do not use red for the delete button either; use a neutral gray outline
  button instead.

### 6.4 Habit card layout

Each habit is a `<article class="habit-card">` containing, top to bottom:

1. **Top row** (flex, space-between): category pill (small rounded badge,
   background = category color at low opacity, text = category color) on the
   left; delete button (small, muted, top-right corner) on the right.
2. **Habit name** (heading).
3. **Identity statement**, directly under the name, in italics as specified
   above. Format: display as `"{identity}"` in quotes.
4. **Stacking label**, if applicable — small text, muted, e.g. "↳ After:
   Morning coffee".
5. **Streak row** (flex, gap between items): two small stat blocks side by
   side — "Current streak: N days" and "Longest streak: N days".
6. **Contribution grid** (see 6.5).
7. **Bottom row**: "Mark done today" button (primary, filled with the
   category's color), full width or left-aligned — your choice, but it must
   be the visually dominant action on the card. If today is already marked
   done, this button's label changes to "✓ Done today" and its style changes
   to an outlined/secondary state rather than disappearing — it should stay
   clickable (to un-mark).

### 6.5 Contribution grid spec

- Grid of squares, CSS Grid, **7 rows (days of week, Sun–Sat top to bottom)
  × 12 columns (weeks, oldest on the left, most recent on the right)**.
- Each square: `10px × 10px`, `border-radius: 2px`, `gap: 3px` between
  squares.
- Empty day: background `#ebedf0`.
- Filled day: background = that habit's category color (full opacity).
- The grid should NOT have a native HTML tooltip-free default; add a `title`
  attribute to each square showing its date (e.g., `title="Oct 6, 2026"`) so
  hovering shows the date — simple native tooltip, no custom tooltip
  component needed.
- The grid must be generated entirely by JavaScript (loop-generated squares),
  not hardcoded in HTML.

### 6.6 "Add new habit" form fields, in order

1. Habit name — text input, required.
2. Identity statement — text input, required, placeholder text: `e.g. "A
   reader" or "Someone who shows up"`.
3. Category — `<select>` dropdown, the five fixed options from Section 4,
   required.
4. Stack after (optional) — `<select>` dropdown, default option "None",
   followed by the names of all currently existing habits.
5. Submit button: "Add Habit".

Form validation: do not allow submission with an empty name or identity
field — use the native `required` attribute (this chapter's material
supports native HTML validation; no need to hand-roll JS validation for this
form specifically).

### 6.7 Responsiveness

- At viewport widths below `480px`: reduce the contribution grid square size
  to `8px` with `2px` gap, and stack the streak-row stat blocks vertically
  instead of side by side.
- Everything else uses relative/flexible sizing by default (max-width
  container, flex layouts) and should naturally adapt without an explicit
  breakpoint beyond the one above.

### 6.8 Stacking prompt dialog spec

Use the native HTML `<dialog>` element (`showModal()` / `close()`) — do not
build a custom overlay/backdrop by hand, the native element handles focus
trapping and the backdrop for free.

**Wording — this matters.** The dialog must ask, not instruct. It should
never read as a command or imply failure if dismissed. Use this exact tone
pattern:

- Title: `"Nice work on '{completed habit name}' 👍"`
- Body: `"Want to log '{stacked habit name}' too?"`
- Two buttons: **"Log it"** (primary, filled with the stacked habit's
  category color) and **"Not now"** (secondary/outlined, muted gray).

Do NOT use prescriptive/command phrasing like "You need to..." or "Don't
forget to..." — this would contradict the no-guilt design principle in
Section 1. The dialog is an invitation, not a reminder system.

**Behavior rules:**
- The dialog must be dismissible with zero friction: clicking "Not now",
  clicking outside the dialog (on the native `::backdrop`), or pressing
  Escape must all close it with no further action and no "are you sure"
  follow-up.
- Clicking "Log it" marks the stacked habit done for today (same logic as
  the "Mark done today" button) and closes the dialog immediately — no
  success message needed, the habit card re-rendering with its new filled
  square on the grid is confirmation enough.
- If MULTIPLE habits are stacked after the one just completed, show one
  dialog listing all of them as separate rows, each with its own "Log it"
  button, plus a single "Not now" to dismiss all. Do not show multiple
  dialogs in sequence.
- The dialog must never block or disable the rest of the page — it's a
  native `<dialog>` modal, so this is handled by default, but confirm the
  rest of the UI remains interactive immediately after it's dismissed.

---

## 7. Streak Calculation — Exact Algorithm (do not deviate)

This is the trickiest logic in the whole app. Implement it exactly as follows.

**Current streak** (as of "today"):
1. Sort the habit's `completions` array descending (most recent first).
2. Start a cursor at today's date.
3. Check: is today's date in `completions`?
   - If yes: streak = 1, then move the cursor back one day at a time,
     incrementing streak by 1 for each consecutive prior day found in
     `completions`, stopping at the first gap.
   - If no (today not yet marked): do NOT immediately return 0 — check
     yesterday instead, using the same logic. This matters because a user
     who completed a habit yesterday but hasn't logged today yet (it's
     still "in progress") should still see their streak intact, not reset
     to zero at midnight before they've had a chance to check in. Only if
     BOTH today and yesterday are missing does the current streak become 0.
4. Return the resulting count.

**Longest streak ever:**
1. Sort `completions` ascending (oldest first).
2. Walk through the sorted array, comparing each date to the previous one.
3. If a date is exactly one day after the previous date, extend the current
   running streak counter. If there's a gap (not exactly +1 day), reset the
   running counter to 1 (the current date starts a new streak).
4. Track and return the maximum value the running counter ever reached.

**Date comparison implementation note:** compare dates using ISO date strings
converted to actual `Date` objects at midnight local time, and compute day
differences using millisecond subtraction divided by `86400000`, rounded.
Do not compare date strings lexicographically for "is this exactly one day
later" logic — build actual `Date` objects for that comparison.

### 7.5 Stacking dialog trigger logic

Inside the "mark done today" handler, AFTER the completion has been saved
successfully, run this check:

1. Only proceed if this action was a **completion** (not-done → done). If the
   user was un-marking a habit, skip this entirely — return early.
2. Filter the full habits array for any habit where `stackedAfter === {id of
   the habit just completed}`.
3. Of those matches, further filter out any that are ALREADY marked done for
   today (`completions.includes(todayISOString)`) — no point prompting for
   something already logged.
4. If the remaining filtered list has one or more habits, open the dialog
   (Section 6.8) populated with that list. If the list is empty, do nothing
   — no dialog, no silent failure, just skip.

This logic should live as its own function (e.g. `getStackedPromptsFor(habitId,
allHabits)` returning an array, possibly empty) so it can be tested in
isolation the same way the streak functions are tested in Step 3 of Section 8.

---

## 8. Build Steps (give the agent this exact order)

1. **Scaffold the three files** (`index.html`, `style.css`, `app.js`) with
   the file structure, linking CSS and JS correctly. Empty `<body>` with just
   placeholder containers (header, summary bar, form container, habit list
   container) and IDs for JS to target.
2. **Write the data layer first, before any UI**: functions to load habits
   from `localStorage`, save habits to `localStorage`, add a habit, delete a
   habit, and toggle today's completion for a habit. Test these via the
   console before building any rendering — confirm `localStorage` is actually
   persisting correctly across a page reload before moving on.
3. **Implement the streak algorithm** (Section 7) as pure, standalone
   functions that take a `completions` array and return a number. Test them
   manually with a few hardcoded arrays (e.g., a mock array with a 3-day gap)
   before wiring them into the UI.
4. **Build the "Add new habit" form and its submit handler**, wiring it to
   the data layer functions from step 2. At this point you should be able to
   add habits and see them appear in `localStorage` (inspect via DevTools),
   even with no visual card rendering yet.
5. **Build the render function for a single habit card** (Section 6.4),
   including the contribution grid generation (Section 6.5) and the streak
   display (using the Section 7 functions).
6. **Wire up the "Mark done today" toggle** on each card to the data layer,
   and make sure re-rendering happens after every state change so the UI
   always reflects current `localStorage` state — don't try to manually patch
   the DOM in place; re-render the full habit list on every change for
   simplicity and correctness.
7. **Build the summary header** (Feature 8), computed from the full habits
   array on every render.
8. **Build the delete flow** with the `confirm()` dialog.
9. **Build the stacking prompt dialog** (Sections 6.8 and 7.5): write the
   `getStackedPromptsFor()` trigger function first and test it in isolation
   with a few hardcoded habit arrays (e.g., two habits stacked on the same
   one; a habit stacked on one already completed today), then wire the native
   `<dialog>` element and its "Log it"/"Not now" handlers into the "mark done
   today" flow.
10. **Apply full CSS styling** per Section 6, including the responsive
    breakpoint and the dialog's appearance.
11. **Final pass:** test the full flow end to end — add a habit, mark several
    days across a few different simulated dates (you can temporarily fake
    "today" in the code to test streak edge cases), test the stacking dialog
    with both single and multiple stacked habits, delete a habit, reload the
    page and confirm persistence.

---

## 9. Explicit Non-Goals (tell the agent NOT to build these)

- No user accounts, no backend, no sync across devices.
- No notifications/reminders.
- No editing an existing habit's name/category after creation (delete and
  re-add instead — keep the data model simple).
- No drag-and-drop reordering of habits.
- No animations beyond simple CSS transitions on hover/click states (nothing
  requiring a library).

This keeps the project scoped tightly enough to actually finish, while still
being substantially more complex than a basic CRUD list — the complexity
here lives entirely in the streak logic and the grid rendering, which is
exactly where we want it for this stage of learning.
