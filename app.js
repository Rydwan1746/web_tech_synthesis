/* ==========================================================================
   Atomic Habit Tracker — Application Logic (app.js)
   Single-page vanilla JS implementation of Atomic Habits tracker
   ========================================================================== */

// ==========================================================================
// 1. CONSTANTS & CONFIGURATION
// ==========================================================================

const STORAGE_KEY = 'atomicHabits';

const CATEGORIES = {
  Health: '#4f8a5b',
  Learning: '#3b6ea5',
  Creativity: '#9b5bb5',
  Mindfulness: '#c7893f',
  Connection: '#c75f6a',
};

// ==========================================================================
// 2. DATE UTILITIES (Local time / Pure calculations)
// ==========================================================================

/**
 * Format a Date object to an ISO date string "YYYY-MM-DD" in local time.
 * @param {Date|string|number} date
 * @returns {string} "YYYY-MM-DD"
 */
function toISODateString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse an ISO date string "YYYY-MM-DD" to a Date object at local midnight.
 * @param {string} dateStr
 * @returns {Date}
 */
function parseISODate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Calculate the difference in whole calendar days between two ISO date strings (B - A).
 * @param {string} dateStrA
 * @param {string} dateStrB
 * @returns {number}
 */
function getDaysDifference(dateStrA, dateStrB) {
  const dateA = parseISODate(dateStrA);
  const dateB = parseISODate(dateStrB);
  return Math.round((dateB.getTime() - dateA.getTime()) / 86400000);
}

/**
 * Shift an ISO date string by a number of days (+/-).
 * @param {string} dateStr
 * @param {number} dayDelta
 * @returns {string} "YYYY-MM-DD"
 */
function shiftDate(dateStr, dayDelta) {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + dayDelta);
  return toISODateString(d);
}

/**
 * Format an ISO date string for tooltip display (e.g. "Oct 6, 2026").
 * @param {string} dateStr
 * @returns {string}
 */
function formatTooltipDate(dateStr) {
  const d = parseISODate(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// ==========================================================================
// 3. STREAK ALGORITHMS (Section 7 Specification)
// ==========================================================================

/**
 * Calculate the current active streak for a habit.
 * Streak continues if completed today, or if completed yesterday (in progress).
 * Only returns 0 if both today and yesterday are missing.
 *
 * @param {string[]} completions - Array of "YYYY-MM-DD" strings
 * @param {string} [todayStr] - Optional reference date for testing
 * @returns {number} Current streak count
 */
function calculateCurrentStreak(completions, todayStr = toISODateString(new Date())) {
  if (!completions || completions.length === 0) {
    return 0;
  }

  const completionSet = new Set(completions);
  let streak = 0;
  let cursor = todayStr;

  // Check if today is completed
  if (completionSet.has(todayStr)) {
    streak = 1;
    cursor = shiftDate(cursor, -1);
    while (completionSet.has(cursor)) {
      streak += 1;
      cursor = shiftDate(cursor, -1);
    }
    return streak;
  }

  // If today is not marked, check yesterday
  const yesterdayStr = shiftDate(todayStr, -1);
  if (completionSet.has(yesterdayStr)) {
    streak = 1;
    cursor = shiftDate(yesterdayStr, -1);
    while (completionSet.has(cursor)) {
      streak += 1;
      cursor = shiftDate(cursor, -1);
    }
    return streak;
  }

  return 0;
}

/**
 * Calculate the longest streak ever achieved for a habit.
 *
 * @param {string[]} completions - Array of "YYYY-MM-DD" strings
 * @returns {number} Longest streak count
 */
function calculateLongestStreak(completions) {
  if (!completions || completions.length === 0) {
    return 0;
  }

  // Deduplicate and sort ascending (oldest first)
  const sorted = Array.from(new Set(completions)).sort();
  if (sorted.length === 1) {
    return 1;
  }

  let maxStreak = 1;
  let runningStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diff = getDaysDifference(sorted[i - 1], sorted[i]);
    if (diff === 1) {
      runningStreak += 1;
      if (runningStreak > maxStreak) {
        maxStreak = runningStreak;
      }
    } else if (diff > 1) {
      runningStreak = 1;
    }
    // If diff === 0 (duplicate), ignore and keep current streak
  }

  return maxStreak;
}

// ==========================================================================
// 4. HABIT STACKING TRIGGER LOGIC (Section 7.5 Specification)
// ==========================================================================

/**
 * Find all habits that are stacked after a given habit and not yet completed today.
 *
 * @param {string} habitId - ID of the habit just completed
 * @param {Array<Object>} allHabits - All habit objects
 * @param {string} [todayStr] - Today's date string
 * @returns {Array<Object>} Array of stacked habit objects eligible for prompt
 */
function getStackedPromptsFor(habitId, allHabits, todayStr = toISODateString(new Date())) {
  if (!habitId || !Array.isArray(allHabits)) {
    return [];
  }

  return allHabits.filter(habit =>
    habit.stackedAfter === habitId &&
    (!habit.completions || !habit.completions.includes(todayStr))
  );
}

// ==========================================================================
// 5. DATA LAYER / LOCALSTORAGE
// ==========================================================================

/**
 * Load all habits from localStorage.
 * @returns {Array<Object>}
 */
function loadHabits() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load habits from localStorage:', err);
    return [];
  }
}

/**
 * Persist habits array to localStorage.
 * @param {Array<Object>} habits
 */
function saveHabits(habits) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  } catch (err) {
    console.error('Failed to save habits to localStorage:', err);
  }
}

/**
 * Add a new habit to the collection.
 * @param {Object} habitData - { name, identity, category, stackedAfter }
 * @returns {Object} Newly created habit object
 */
function addHabit({ name, identity, category, stackedAfter }) {
  const habits = loadHabits();
  const newHabit = {
    id: `habit_${Date.now()}`,
    name: name.trim(),
    identity: identity.trim(),
    category,
    color: CATEGORIES[category] || '#4f8a5b',
    createdAt: toISODateString(new Date()),
    stackedAfter: stackedAfter && stackedAfter !== '' ? stackedAfter : null,
    completions: []
  };

  // Add newest first
  habits.unshift(newHabit);
  saveHabits(habits);
  return newHabit;
}

/**
 * Delete a habit and unstack any habits referencing it.
 * @param {string} habitId
 */
function deleteHabit(habitId) {
  let habits = loadHabits();
  habits = habits.filter(h => h.id !== habitId);

  // Clean up references to the deleted habit in other stacked habits
  habits.forEach(h => {
    if (h.stackedAfter === habitId) {
      h.stackedAfter = null;
    }
  });

  saveHabits(habits);
}

/**
 * Toggle completion of a habit for a given date (defaults to today).
 * @param {string} habitId
 * @param {string} [dateStr]
 * @returns {{ completedNow: boolean, habit: Object|null }}
 */
function toggleHabitCompletion(habitId, dateStr = toISODateString(new Date())) {
  const habits = loadHabits();
  const habit = habits.find(h => h.id === habitId);
  if (!habit) {
    return { completedNow: false, habit: null };
  }

  if (!Array.isArray(habit.completions)) {
    habit.completions = [];
  }

  const index = habit.completions.indexOf(dateStr);
  let completedNow = false;

  if (index > -1) {
    habit.completions.splice(index, 1);
    completedNow = false;
  } else {
    habit.completions.push(dateStr);
    completedNow = true;
  }

  saveHabits(habits);
  return { completedNow, habit };
}

// ==========================================================================
// 6. DOM RENDERING & UI GENERATION
// ==========================================================================

// DOM Element References
const habitsListEl = document.getElementById('habits-list');
const emptyStateEl = document.getElementById('empty-state');
const totalHabitsCountEl = document.getElementById('total-habits-count');
const longestActiveStreakEl = document.getElementById('longest-active-streak');
const toggleFormBtn = document.getElementById('toggle-form-btn');
const habitFormContainer = document.getElementById('habit-form-container');
const addHabitForm = document.getElementById('add-habit-form');
const cancelFormBtn = document.getElementById('cancel-form-btn');
const habitStackSelect = document.getElementById('habit-stack');
const stackingDialog = document.getElementById('stacking-dialog');
const dialogContentEl = document.getElementById('dialog-content');

// Nested stacking prompts queued while another stacking dialog is already open.
let pendingStackingPrompts = [];

/**
 * Render the Summary Bar stats at the top of the page.
 * @param {Array<Object>} habits
 */
function renderSummary(habits) {
  const total = habits.length;
  totalHabitsCountEl.textContent = total;

  if (total === 0) {
    longestActiveStreakEl.textContent = '0 days';
    return;
  }

  let bestStreak = 0;
  let bestHabitName = '';

  habits.forEach(habit => {
    const currentStreak = calculateCurrentStreak(habit.completions);
    if (currentStreak > bestStreak) {
      bestStreak = currentStreak;
      bestHabitName = habit.name;
    }
  });

  if (bestStreak > 0) {
    longestActiveStreakEl.textContent = `${bestStreak} ${bestStreak === 1 ? 'day' : 'days'} — ${bestHabitName}`;
  } else {
    longestActiveStreakEl.textContent = '0 days';
  }
}

/**
 * Populate the "Stack After" dropdown with current habits.
 * @param {Array<Object>} habits
 */
function updateStackOptions(habits) {
  const currentVal = habitStackSelect.value;
  habitStackSelect.innerHTML = '<option value="">None</option>';

  habits.forEach(habit => {
    const option = document.createElement('option');
    option.value = habit.id;
    option.textContent = habit.name;
    habitStackSelect.appendChild(option);
  });

  // Preserve previous selection if still valid
  if (currentVal && habits.some(h => h.id === currentVal)) {
    habitStackSelect.value = currentVal;
  } else {
    habitStackSelect.value = '';
  }
}

/**
 * Generate the 84-day (12 weeks x 7 days) contribution grid element for a habit.
 * 7 rows (Sunday - Saturday) x 12 columns (oldest to most recent).
 *
 * @param {Object} habit
 * @param {string} todayStr
 * @returns {HTMLElement}
 */
function createContributionGrid(habit, todayStr) {
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';

  const grid = document.createElement('div');
  grid.className = 'contribution-grid';
  grid.setAttribute('role', 'img');
  grid.setAttribute('aria-label', `Consistency grid for ${habit.name}`);

  const today = parseISODate(todayStr);
  const currentDayOfWeek = today.getDay(); // 0 = Sun, 6 = Sat

  // Determine Sunday of the current week (col index 11)
  const sundayOfCurrentWeek = new Date(today);
  sundayOfCurrentWeek.setDate(today.getDate() - currentDayOfWeek);
  sundayOfCurrentWeek.setHours(0, 0, 0, 0);

  // Grid start date: 11 weeks prior to Sunday of current week (Col 0, Row 0)
  const gridStartDate = new Date(sundayOfCurrentWeek);
  gridStartDate.setDate(sundayOfCurrentWeek.getDate() - (11 * 7));

  const completionsSet = new Set(habit.completions || []);

  // 12 columns, 7 rows. CSS grid-auto-flow: column will place items top-to-bottom, left-to-right.
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 7; row++) {
      const dayOffset = (col * 7) + row;
      const cellDate = new Date(gridStartDate);
      cellDate.setDate(gridStartDate.getDate() + dayOffset);
      const cellDateStr = toISODateString(cellDate);

      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.setAttribute('title', formatTooltipDate(cellDateStr));

      if (completionsSet.has(cellDateStr)) {
        cell.classList.add('completed');
        cell.style.backgroundColor = habit.color;
      }

      grid.appendChild(cell);
    }
  }

  gridContainer.appendChild(grid);
  return gridContainer;
}

/**
 * Create a DOM element for a single habit card.
 * @param {Object} habit
 * @param {Array<Object>} allHabits
 * @param {string} todayStr
 * @returns {HTMLElement}
 */
function createHabitCard(habit, allHabits, todayStr) {
  const card = document.createElement('article');
  card.className = 'habit-card';
  card.dataset.habitId = habit.id;

  // 1. Top Row: Category Pill & Delete Button
  const headerRow = document.createElement('div');
  headerRow.className = 'card-header-row';

  const categoryPill = document.createElement('span');
  categoryPill.className = 'category-pill';
  categoryPill.textContent = habit.category;
  categoryPill.style.color = habit.color;
  categoryPill.style.backgroundColor = `${habit.color}1f`; // ~12% opacity hex

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-delete';
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Delete';
  deleteBtn.setAttribute('aria-label', `Delete habit: ${habit.name}`);
  deleteBtn.addEventListener('click', () => handleDeleteHabit(habit.id, habit.name));

  headerRow.appendChild(categoryPill);
  headerRow.appendChild(deleteBtn);
  card.appendChild(headerRow);

  // 2. Habit Name
  const nameHeading = document.createElement('h2');
  nameHeading.className = 'habit-name';
  nameHeading.textContent = habit.name;
  card.appendChild(nameHeading);

  // 3. Identity Statement
  const identityPara = document.createElement('p');
  identityPara.className = 'habit-identity';
  identityPara.textContent = `"${habit.identity}"`;
  card.appendChild(identityPara);

  // 4. Stacking Label (if applicable)
  if (habit.stackedAfter) {
    const parentHabit = allHabits.find(h => h.id === habit.stackedAfter);
    if (parentHabit) {
      const stackLabel = document.createElement('div');
      stackLabel.className = 'habit-stack-label';
      stackLabel.textContent = `↳ After: ${parentHabit.name}`;
      card.appendChild(stackLabel);
    }
  }

  // 5. Streak Row
  const streakRow = document.createElement('div');
  streakRow.className = 'streak-row';

  const currentStreakCount = calculateCurrentStreak(habit.completions, todayStr);
  const longestStreakCount = calculateLongestStreak(habit.completions);

  const currentStreakBlock = document.createElement('div');
  currentStreakBlock.className = 'streak-stat-item';
  currentStreakBlock.innerHTML = `Current streak: <strong>${currentStreakCount} ${currentStreakCount === 1 ? 'day' : 'days'}</strong>`;

  const longestStreakBlock = document.createElement('div');
  longestStreakBlock.className = 'streak-stat-item';
  longestStreakBlock.innerHTML = `Longest streak: <strong>${longestStreakCount} ${longestStreakCount === 1 ? 'day' : 'days'}</strong>`;

  streakRow.appendChild(currentStreakBlock);
  streakRow.appendChild(longestStreakBlock);
  card.appendChild(streakRow);

  // 6. Contribution Grid
  const gridEl = createContributionGrid(habit, todayStr);
  card.appendChild(gridEl);

  // 7. Bottom Row: Check-in Button
  const actionRow = document.createElement('div');
  actionRow.className = 'card-action-row';

  const isDoneToday = Array.isArray(habit.completions) && habit.completions.includes(todayStr);
  const checkinBtn = document.createElement('button');
  checkinBtn.type = 'button';
  checkinBtn.className = `btn-checkin ${isDoneToday ? 'completed' : 'uncompleted'}`;

  if (isDoneToday) {
    checkinBtn.textContent = '✓ Done today';
    checkinBtn.style.borderColor = habit.color;
    checkinBtn.style.color = habit.color;
  } else {
    checkinBtn.textContent = 'Mark done today';
    checkinBtn.style.backgroundColor = habit.color;
  }

  checkinBtn.addEventListener('click', () => handleToggleCheckin(habit.id));
  actionRow.appendChild(checkinBtn);
  card.appendChild(actionRow);

  return card;
}

/**
 * Render all habits to the DOM.
 */
function renderApp() {
  const habits = loadHabits();
  const todayStr = toISODateString(new Date());

  // Update Summary and Stack Dropdown
  renderSummary(habits);
  updateStackOptions(habits);

  // Render Habits List
  habitsListEl.innerHTML = '';
  if (habits.length === 0) {
    emptyStateEl.classList.remove('hidden');
  } else {
    emptyStateEl.classList.add('hidden');
    habits.forEach(habit => {
      const card = createHabitCard(habit, habits, todayStr);
      habitsListEl.appendChild(card);
    });
  }
}

// ==========================================================================
// 7. EVENT HANDLERS & USER INTERACTIONS
// ==========================================================================

/**
 * Handle form toggle (+ New Habit button)
 */
function toggleForm(open) {
  const isCurrentlyCollapsed = habitFormContainer.classList.contains('collapsed');
  const shouldOpen = open !== undefined ? open : isCurrentlyCollapsed;

  if (shouldOpen) {
    habitFormContainer.classList.remove('collapsed');
    habitFormContainer.setAttribute('aria-hidden', 'false');
    toggleFormBtn.setAttribute('aria-expanded', 'true');
    toggleFormBtn.style.display = 'none';
    document.getElementById('habit-name').focus();
  } else {
    habitFormContainer.classList.add('collapsed');
    habitFormContainer.setAttribute('aria-hidden', 'true');
    toggleFormBtn.setAttribute('aria-expanded', 'false');
    toggleFormBtn.style.display = 'inline-flex';
    addHabitForm.reset();
  }
}

/**
 * Handle new habit submission.
 */
function handleAddHabit(event) {
  event.preventDefault();

  const nameInput = document.getElementById('habit-name');
  const identityInput = document.getElementById('habit-identity');
  const categoryInput = document.getElementById('habit-category');
  const stackInput = document.getElementById('habit-stack');

  // Native `required` already blocked empty fields before this handler ran.
  addHabit({
    name: nameInput.value,
    identity: identityInput.value,
    category: categoryInput.value,
    stackedAfter: stackInput.value
  });
  toggleForm(false);
  renderApp();
}

/**
 * Handle habit deletion with native confirm dialog.
 */
function handleDeleteHabit(habitId, habitName) {
  const confirmed = window.confirm(`Are you sure you want to delete "${habitName}"?`);
  if (confirmed) {
    deleteHabit(habitId);
    renderApp();
  }
}

/**
 * After a habit is marked done, prompt for any unfinished habits stacked on it.
 * If a stacking dialog is already open (multiple siblings), queue nested
 * prompts so they appear after this dialog closes — never replace live rows.
 * @param {Object} completedHabit
 * @param {Array<Object>} stackedPrompts
 */
function enqueueOrShowStackingPrompt(completedHabit, stackedPrompts) {
  if (!stackedPrompts || stackedPrompts.length === 0) {
    return;
  }

  if (stackingDialog.open) {
    pendingStackingPrompts.push({ completedHabit, stackedPrompts });
    return;
  }

  showStackingPromptDialog(completedHabit, stackedPrompts);
}

/**
 * Drop habits that were logged while a nested prompt was queued.
 * @param {Array<Object>} stackedPrompts
 * @returns {Array<Object>}
 */
function filterStillPendingPrompts(stackedPrompts) {
  const allHabits = loadHabits();
  const todayStr = toISODateString(new Date());
  return stackedPrompts.filter(promptHabit => {
    const latest = allHabits.find(h => h.id === promptHabit.id);
    return latest && (!latest.completions || !latest.completions.includes(todayStr));
  });
}

/**
 * Show the next queued stacking dialog after the current one closes.
 */
function showNextQueuedStackingPrompt() {
  while (pendingStackingPrompts.length > 0) {
    const next = pendingStackingPrompts.shift();
    const stillPending = filterStillPendingPrompts(next.stackedPrompts);
    if (stillPending.length > 0) {
      showStackingPromptDialog(next.completedHabit, stillPending);
      return;
    }
  }
}

/**
 * Mark a habit done (or undone) for today, re-render, and prompt stacked habits
 * on the not-done → done transition. Shared by the card button and "Log it".
 * @param {string} habitId
 * @returns {{ completedNow: boolean, habit: Object|null }}
 */
function toggleCheckinAndPrompt(habitId) {
  const result = toggleHabitCompletion(habitId);
  renderApp();

  if (result.completedNow && result.habit) {
    const stackedPrompts = getStackedPromptsFor(habitId, loadHabits());
    enqueueOrShowStackingPrompt(result.habit, stackedPrompts);
  }

  return result;
}

/**
 * Show the native <dialog> for habit stacking prompt.
 * @param {Object} completedHabit
 * @param {Array<Object>} stackedPrompts
 */
function showStackingPromptDialog(completedHabit, stackedPrompts) {
  if (!stackedPrompts || stackedPrompts.length === 0) {
    return;
  }

  dialogContentEl.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'dialog-header';

  const title = document.createElement('h3');
  title.id = 'dialog-title';
  title.className = 'dialog-title';
  title.textContent = `Nice work on '${completedHabit.name}' 👍`;

  header.appendChild(title);
  dialogContentEl.appendChild(header);

  const listContainer = document.createElement('div');
  listContainer.className = 'dialog-stacked-list';

  stackedPrompts.forEach(stackedHabit => {
    const item = document.createElement('div');
    item.className = 'dialog-stacked-item';

    const info = document.createElement('div');
    info.className = 'dialog-stacked-info';

    const promptBody = document.createElement('div');
    promptBody.className = 'dialog-body';
    promptBody.textContent = `Want to log '${stackedHabit.name}' too?`;

    const identitySpan = document.createElement('span');
    identitySpan.className = 'dialog-stacked-identity';
    identitySpan.textContent = `"${stackedHabit.identity}"`;

    info.appendChild(promptBody);
    info.appendChild(identitySpan);

    const logBtn = document.createElement('button');
    logBtn.type = 'button';
    logBtn.className = 'btn-dialog-log';
    logBtn.textContent = 'Log it';
    logBtn.style.backgroundColor = stackedHabit.color;
    logBtn.addEventListener('click', () => {
      toggleCheckinAndPrompt(stackedHabit.id);
      item.remove();

      const remaining = listContainer.querySelectorAll('.dialog-stacked-item');
      if (remaining.length === 0) {
        stackingDialog.close();
      }
    });

    item.appendChild(info);
    item.appendChild(logBtn);
    listContainer.appendChild(item);
  });

  dialogContentEl.appendChild(listContainer);

  const actions = document.createElement('div');
  actions.className = 'dialog-actions';

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'btn-dialog-dismiss';
  dismissBtn.textContent = 'Not now';
  dismissBtn.addEventListener('click', () => {
    stackingDialog.close();
  });

  actions.appendChild(dismissBtn);
  dialogContentEl.appendChild(actions);

  stackingDialog.showModal();
}

/**
 * Handle toggle check-in button click.
 */
function handleToggleCheckin(habitId) {
  toggleCheckinAndPrompt(habitId);
}

// Close dialog when clicking on backdrop
stackingDialog.addEventListener('click', (event) => {
  const rect = stackingDialog.getBoundingClientRect();
  const isInDialog = (
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width
  );
  if (!isInDialog) {
    stackingDialog.close();
  }
});

// After dismiss, show any nested stacking prompts that were queued from "Log it".
stackingDialog.addEventListener('close', () => {
  window.setTimeout(showNextQueuedStackingPrompt, 0);
});

// ==========================================================================
// 8. INITIALIZATION
// ==========================================================================

function init() {
  // Event Listeners
  toggleFormBtn.addEventListener('click', () => toggleForm(true));
  cancelFormBtn.addEventListener('click', () => toggleForm(false));
  addHabitForm.addEventListener('submit', handleAddHabit);

  // Initial render
  renderApp();
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export functions for testing if running in module/test environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toISODateString,
    parseISODate,
    getDaysDifference,
    shiftDate,
    calculateCurrentStreak,
    calculateLongestStreak,
    getStackedPromptsFor,
    CATEGORIES,
    STORAGE_KEY
  };
}
