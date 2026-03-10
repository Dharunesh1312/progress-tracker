/* =============================================
   STORAGE KEYS
============================================= */
const TASKS_KEY  = 'dailyTasks_v2';
const HOURS_KEY  = 'learningHours_v1';  // { "YYYY-MM-DD": number }
const STREAK_KEY = 'streakData_v1';     // { lastDate, streak, totalCompleted }
const THEME_KEY  = 'themePreference';   // "light" | "dark"

/* =============================================
   CONSTANTS
============================================= */
// r=40 → circumference = 2π×40 ≈ 251.3
const CIRC       = 2 * Math.PI * 40;
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const MOTIVATIONS = [
  '🎉 Everything done! You crushed it today.',
  '✨ 100% complete — brilliant work!',
  '🏆 All tasks finished. Take a well-earned break.',
  '🌟 Full house! You\'re on fire today.',
  '💪 Every single task done. That\'s impressive!',
];

/* =============================================
   HELPERS
============================================= */

/** Safely escape HTML to prevent XSS */
const escapeHTML = (str) => {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
};

/** Returns "YYYY-MM-DD" string for a given Date (default: today) */
const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

/** Returns array of 7 Date objects for Mon–Sun of the current ISO week */
const currentWeekDays = () => {
  const today = new Date();
  const diff  = (today.getDay() + 6) % 7;   // days since Monday
  const mon   = new Date(today);
  mon.setDate(today.getDate() - diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
};

/** Returns the "YYYY-MM-DD" of yesterday */
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
};

/* =============================================
   STATE — load from localStorage
============================================= */
const loadTasks = () => {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; } catch { return []; }
};
const loadHours = () => {
  try { return JSON.parse(localStorage.getItem(HOURS_KEY)) || {}; } catch { return {}; }
};
const loadStreak = () => {
  try {
    return JSON.parse(localStorage.getItem(STREAK_KEY)) || { lastDate: null, streak: 0, totalCompleted: 0 };
  } catch { return { lastDate: null, streak: 0, totalCompleted: 0 }; }
};

let tasks      = loadTasks();
let hoursMap   = loadHours();
let streakData = loadStreak();

const saveTasks      = () => localStorage.setItem(TASKS_KEY,  JSON.stringify(tasks));
const saveHoursMap   = () => localStorage.setItem(HOURS_KEY,  JSON.stringify(hoursMap));
const saveStreakData  = () => localStorage.setItem(STREAK_KEY, JSON.stringify(streakData));

/* =============================================
   THEME — dark / light
============================================= */
const htmlEl      = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeLabel  = document.getElementById('themeLabel');
const toggleThumb = document.getElementById('toggleThumb');

/** Apply a theme ('light' | 'dark') and persist the preference */
const applyTheme = (theme) => {
  htmlEl.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  themeLabel.textContent  = theme === 'dark' ? 'Dark' : 'Light';
  toggleThumb.textContent = theme === 'dark' ? '🌙' : '☀️';
};

/** Toggle between light and dark */
const toggleTheme = () => {
  const current = htmlEl.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
};

// Restore saved theme on startup
applyTheme(localStorage.getItem(THEME_KEY) || 'light');
themeToggle.addEventListener('click', toggleTheme);

/* =============================================
   DOM REFERENCES
============================================= */
const taskInput    = document.getElementById('taskInput');
const addBtn       = document.getElementById('addBtn');
const taskListEl   = document.getElementById('taskList');
const pieDoneEl    = document.getElementById('pieDone');
const piePctEl     = document.getElementById('piePct');
const pieSubEl     = document.getElementById('pieSub');
const motivationEl = document.getElementById('motivationBanner');
const hoursInput   = document.getElementById('hoursInput');
const hoursBtn     = document.getElementById('hoursBtn');
const todayHoursEl = document.getElementById('todayHoursVal');
const weekHoursEl  = document.getElementById('weekHoursVal');
const avgHoursEl   = document.getElementById('avgHoursVal');
const weekChartEl  = document.getElementById('weekChart');
const dateLabelEl  = document.getElementById('dateLabel');
const dashToday    = document.getElementById('dashToday');
const dashStreak   = document.getElementById('dashStreak');
const dashTotal    = document.getElementById('dashTotal');
const streakIcon   = document.getElementById('streakIcon');

// Set the date header
dateLabelEl.textContent = new Date().toLocaleDateString('en-US',
  { weekday:'long', month:'long', day:'numeric' });

/* =============================================
   STREAK LOGIC
   Rules:
     - Completing a task   → increment totalCompleted, advance streak if new day
     - Un-completing a task → decrement totalCompleted (floor 0), streak unchanged
     - Streak advances at most once per calendar day (tracked via lastDate)
============================================= */
const updateStreak = (completing) => {
  if (completing) {
    streakData.totalCompleted += 1;

    // Only advance streak counter once per calendar day
    const today = dateKey();
    if (streakData.lastDate !== today) {
      streakData.streak   = (streakData.lastDate === yesterday()) ? streakData.streak + 1 : 1;
      streakData.lastDate = today;
    }
  } else {
    // Un-completing: subtract from total, never go below 0
    streakData.totalCompleted = Math.max(0, streakData.totalCompleted - 1);
    // Streak is intentionally left unchanged when unchecking
  }
  saveStreakData();
};

/* =============================================
   DASHBOARD RENDER
============================================= */
const renderDashboard = () => {
  dashToday.textContent  = tasks.filter(t => t.completed).length;
  dashStreak.textContent = streakData.streak;
  dashTotal.textContent  = streakData.totalCompleted;

  // Animate the flame emoji when streak is more than 1 day
  streakIcon.classList.toggle('streak-active', streakData.streak > 1);
};

/* =============================================
   DONUT CHART UPDATE
============================================= */
const updateDonut = (pct) => {
  // Adjust stroke-dashoffset to reveal the arc proportionally
  pieDoneEl.style.strokeDashoffset = CIRC - (pct / 100) * CIRC;
  piePctEl.textContent = `${pct}%`;

  const doneCount = tasks.filter(t => t.completed).length;
  pieSubEl.textContent = `${doneCount} / ${tasks.length} tasks`;

  const allDone = pct === 100 && tasks.length > 0;
  piePctEl.classList.toggle('done', allDone);

  if (allDone) {
    motivationEl.textContent = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
    motivationEl.classList.add('visible');
  } else {
    motivationEl.classList.remove('visible');
  }
};

/* =============================================
   RENDER TASK LIST
============================================= */
const render = () => {
  taskListEl.innerHTML = '';

  if (tasks.length === 0) {
    taskListEl.innerHTML = `
      <li class="empty-state">
        <span class="empty-icon">📋</span>
        No tasks yet.<br>Add something to accomplish!
      </li>`;
    updateDonut(0);
    renderDashboard();
    return;
  }

  // Sort: pending first, completed last
  const sorted = [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed));

  sorted.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.dataset.id = task.id;

    li.innerHTML = `
      <input type="checkbox" class="task-check"
        aria-label="Mark '${escapeHTML(task.text)}' complete"
        ${task.completed ? 'checked' : ''}/>
      <div class="task-body">
        <div class="task-text">${escapeHTML(task.text)}</div>
        <!-- Mini per-task progress bar: 0% when pending, 100% when done -->
        <div class="task-mini-bar-wrap">
          <div class="task-mini-bar" style="width:${task.completed ? 100 : 0}%"></div>
        </div>
      </div>
      <span class="task-badge ${task.completed ? 'badge-done' : 'badge-pending'}">
        ${task.completed ? '✓ done' : 'pending'}
      </span>
      <button class="delete-btn" title="Delete" aria-label="Delete task">✕</button>
    `;

    li.querySelector('.task-check').addEventListener('change', () => toggleTask(task.id));
    li.querySelector('.delete-btn').addEventListener('click',  () => deleteTask(task.id));
    taskListEl.appendChild(li);
  });

  const doneCount = tasks.filter(t => t.completed).length;
  updateDonut(Math.round((doneCount / tasks.length) * 100));
  renderDashboard();
};

/* =============================================
   TASK ACTIONS
============================================= */
const addTask = () => {
  const text = taskInput.value.trim();
  if (!text) { taskInput.focus(); return; }

  tasks.push({ id: Date.now().toString(), text, completed: false });
  saveTasks();
  render();
  taskInput.value = '';
  taskInput.focus();
};

const toggleTask = (id) => {
  const prev = tasks.find(t => t.id === id);
  tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);

  // Pass true when marking complete, false when un-completing
  updateStreak(!prev.completed);

  saveTasks();
  render();
};

const deleteTask = (id) => {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
};

/* =============================================
   LEARNING HOURS — save today's entry
============================================= */
const saveTodayHours = () => {
  const val = parseFloat(hoursInput.value);

  // Validate: must be a number between 0 and 24
  if (isNaN(val) || val < 0 || val > 24) {
    hoursInput.style.borderColor = 'var(--accent)';
    hoursInput.focus();
    setTimeout(() => { hoursInput.style.borderColor = ''; }, 900);
    return;
  }

  hoursMap[dateKey()] = val;   // stored under today's YYYY-MM-DD key
  saveHoursMap();
  renderHours();

  // Brief confirmation feedback on the button
  hoursInput.value = '';
  hoursBtn.textContent = '✓ Saved';
  hoursBtn.style.background = 'var(--green)';
  setTimeout(() => { hoursBtn.textContent = 'Save'; hoursBtn.style.background = ''; }, 1200);
};

/* =============================================
   LEARNING HOURS — render stats + weekly bar chart
============================================= */
const renderHours = () => {
  const todayStr = dateKey();
  const weekDays = currentWeekDays();
  const weekData = weekDays.map((d, i) => ({
    key:     dateKey(d),
    label:   DAY_LABELS[i],
    hours:   hoursMap[dateKey(d)] || 0,
    isToday: dateKey(d) === todayStr,
  }));

  const todayHrs  = hoursMap[todayStr] || 0;
  const weekTotal = weekData.reduce((s, d) => s + d.hours, 0);
  const active    = weekData.filter(d => d.hours > 0).length;
  const avg       = active > 0 ? weekTotal / active : 0;

  const fmt = (n) => n % 1 === 0 ? `${n}h` : `${n.toFixed(1)}h`;
  todayHoursEl.textContent = fmt(todayHrs);
  weekHoursEl.textContent  = fmt(weekTotal);
  avgHoursEl.textContent   = fmt(avg);
  hoursInput.placeholder   = todayHrs > 0 ? `${todayHrs}h today` : 'e.g. 2.5';

  // Build the weekly bar chart
  const maxHrs = Math.max(...weekData.map(d => d.hours), 0.5);  // avoid ÷0
  const MAX_PX = 60;   // max bar fill height in pixels
  weekChartEl.innerHTML = '';

  weekData.forEach(day => {
    const fillH  = Math.round((day.hours / maxHrs) * MAX_PX);
    const outerH = day.hours > 0 ? Math.max(fillH, 8) : 5;

    const col = document.createElement('div');
    col.className = `day-col${day.isToday ? ' today' : ''}`;
    col.title     = `${day.label}: ${day.hours}h`;

    col.innerHTML = `
      <span class="day-hrs-label">${day.hours > 0 ? day.hours + 'h' : ''}</span>
      <div class="day-bar-outer" style="height:${outerH}px">
        <div class="day-bar-fill" style="height:${fillH}px"></div>
      </div>
      <span class="day-name">${day.label}</span>
    `;
    weekChartEl.appendChild(col);
  });
};

/* =============================================
   EVENT LISTENERS
============================================= */
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown',  e => { if (e.key === 'Enter') addTask(); });
hoursBtn.addEventListener('click', saveTodayHours);
hoursInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveTodayHours(); });

/* =============================================
   INITIAL RENDER
============================================= */
render();
renderHours();
