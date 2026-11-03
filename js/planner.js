import { read, escapeHtml, todayISO, formatDate, subjectName } from "./storage.js";
import { classesApi, classDetail, classQuizzes } from "./auth.js";

let cursor = new Date();
cursor.setDate(1);
let filter = "all";
let selectedDate = "";
let classEvents = [];

export function setPlannerFilter(value) {
  filter = value;
}

export function movePlannerMonth(delta) {
  cursor.setMonth(cursor.getMonth() + delta);
  selectedDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`;
}

export function selectPlannerDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return;
  selectedDate = value;
  const [year, month] = value.split("-").map(Number);
  cursor = new Date(year, month - 1, 1);
}

export function goToPlannerToday() {
  selectedDate = todayISO();
  const now = new Date();
  cursor = new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function loadPlannerClassEvents() {
  try {
    const { classes = [] } = await classesApi();
    const results = await Promise.allSettled(classes.map(async item => {
      const [detail, { quizzes = [] }] = await Promise.all([
        classDetail(item.id),
        classQuizzes(item.id),
      ]);
      const classroom = detail.class;
      const teacher = detail.role === "teacher";
      const studentCount = (classroom.members || []).length;
      const events = [];

      for (const assignment of classroom.assignments || []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(assignment.due_date || "")) continue;
        const submission = assignment.my_submission || {};
        const submissions = assignment.submissions || [];
        events.push({
          type: "assignment",
          date: assignment.due_date,
          title: assignment.title,
          classId: classroom.id,
          className: classroom.name,
          completed: teacher
            ? studentCount > 0 && submissions.length >= studentCount && submissions.every(row => row.score !== null && row.score !== undefined)
            : Boolean(submission.submitted_at),
          status: teacher
            ? `${submissions.length} submitted · ${submissions.filter(row => row.score !== null && row.score !== undefined).length} graded`
            : submission.score !== null && submission.score !== undefined
              ? `Score ${Number(submission.score)} / ${Number(assignment.maximum)}`
              : submission.submitted_at ? "Submitted · awaiting grade" : "Work not submitted",
        });
      }

      for (const quiz of quizzes) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(quiz.due_date || "")) continue;
        const attempt = quiz.attempt;
        events.push({
          type: "quiz",
          date: quiz.due_date,
          title: quiz.title,
          classId: classroom.id,
          className: classroom.name,
          completed: teacher
            ? studentCount > 0 && Number(quiz.attempt_count) >= studentCount
            : Boolean(attempt),
          status: teacher
            ? `${Number(quiz.attempt_count) || 0} submitted`
            : attempt
              ? `${Number(attempt.correct_count)} / ${Number(attempt.question_count)} correct · ${Math.round(100 * Number(attempt.correct_count) / Math.max(1, Number(attempt.question_count)))}%`
              : "Quiz not completed",
        });
      }
      return events;
    }));

    classEvents = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  } catch {
    classEvents = [];
  }
  return classEvents;
}

export function setPlannerClassEvents(events) {
  classEvents = Array.isArray(events) ? events : [];
}

export function renderPlanner() {
  const allTasks = read("tasks");
  const tasks = allTasks
    .filter(task => filter === "all" || (filter === "pending" && !task.completed) || (filter === "completed" && task.completed))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const month = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = todayISO();
  const selected = selectedDate || today;
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const previousMonthDays = new Date(cursor.getFullYear(), cursor.getMonth(), 0).getDate();
  const cells = [];

  for (let index = 0; index < 42; index++) {
    let day;
    let monthOffset = 0;
    if (index < offset) {
      day = previousMonthDays - offset + index + 1;
      monthOffset = -1;
    } else if (index >= offset + daysInMonth) {
      day = index - (offset + daysInMonth) + 1;
      monthOffset = 1;
    } else {
      day = index - offset + 1;
    }

    const date = new Date(cursor.getFullYear(), cursor.getMonth() + monthOffset, day);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const dayTasks = allTasks.filter(task => task.date === key);
    const dayEvents = classEvents.filter(event => event.date === key);
    const label = formatDate(key, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const eventMarkup = [
      ...dayTasks.map(task => `<span class="calendar-event-chip study" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</span>`),
      ...dayEvents.map(event => `<span class="calendar-event-chip ${event.type}" title="${escapeHtml(`${event.type}: ${event.title}`)}"><i></i>${escapeHtml(event.title)}</span>`),
    ];
    const preview = eventMarkup.slice(0, 2).join("");
    const more = eventMarkup.length > 2 ? `<span class="calendar-more">+${eventMarkup.length - 2} more</span>` : "";
    const count = dayTasks.length + dayEvents.length;
    cells.push(`<button type="button" class="calendar-day ${monthOffset ? "muted-day" : ""} ${key === today ? "today" : ""} ${key === selected ? "selected" : ""} ${count ? "has-task" : ""}" data-action="planner-select-date" data-date="${key}" aria-label="${escapeHtml(label)}${count ? `, ${count} planned item${count === 1 ? "" : "s"}` : ""}" aria-pressed="${key === selected}"><span class="calendar-day-number">${day}</span><span class="calendar-day-events">${preview}${more}</span></button>`);
  }

  const selectedTasks = allTasks
    .filter(task => task.date === selected)
    .sort((a, b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed)) || priorityRank(a.priority) - priorityRank(b.priority));
  const selectedEvents = classEvents.filter(event => event.date === selected);
  const planTitle = selected === today ? "Today's plan" : "Selected day";
  const pendingCount = selectedTasks.filter(task => !task.completed).length + selectedEvents.filter(event => !event.completed).length;
  const dayContent = selectedTasks.length || selectedEvents.length
    ? `<div class="day-plan-items">${selectedTasks.map(taskRow).join("")}${selectedEvents.map(classEventRow).join("")}</div>`
    : `<div class="empty-state"><div class="empty-icon">▣</div><b>Your day is open</b><p>No study tasks or class deadlines are planned for this day.</p><button class="btn btn-small btn-soft" data-action="add-task" data-date="${selected}" style="margin-top:10px">＋ Add task to this day</button></div>`;

  return `<div class="page-heading"><div><div class="eyebrow">MAKE TIME FOR WHAT MATTERS</div><h1>Study planner</h1><p>One calendar for study plans, assignment deadlines, and class quizzes.</p></div><div class="heading-actions"><button class="btn btn-primary" data-action="add-task" data-date="${selected}">＋ Add task</button></div></div>
  <div class="grid-2 planner-layout">
    <section class="panel calendar-panel"><div class="calendar-top"><button class="icon-btn" data-action="planner-month" data-delta="-1" aria-label="Previous month">‹</button><div class="calendar-title">${month}</div><div class="calendar-controls"><button class="btn btn-small" data-action="planner-today">Today</button><button class="icon-btn" data-action="planner-month" data-delta="1" aria-label="Next month">›</button></div></div><div class="calendar-grid">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(value => `<div class="calendar-label">${value}</div>`).join("")}${cells.join("")}</div><div class="chart-legend calendar-legend"><span><i class="legend-dot"></i>Study task</span><span><i class="legend-dot blue"></i>Assignment</span><span><i class="legend-dot yellow"></i>Quiz</span><span><i class="legend-dot" style="background:#bba7ff"></i>Today</span></div></section>
    <section class="panel day-plan-panel"><div class="panel-head"><div><h2 class="panel-title">${planTitle}</h2><p class="panel-subtitle">${formatDate(selected, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</p></div><span class="priority ${pendingCount ? "high" : "low"}">${pendingCount} pending</span></div>${dayContent}</section>
  </div>
  <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Study tasks</h2><p class="panel-subtitle">A clear view of what's next</p></div><select class="select-field" id="task-filter" aria-label="Filter tasks"><option value="all" ${filter === "all" ? "selected" : ""}>All tasks</option><option value="pending" ${filter === "pending" ? "selected" : ""}>Pending</option><option value="completed" ${filter === "completed" ? "selected" : ""}>Completed</option></select></div>
    ${tasks.length ? `<div class="task-list">${tasks.map(taskRow).join("")}</div>` : `<div class="empty-state"><div class="empty-icon">✓</div><b>No tasks here</b><p>Create a study task, assignment, or exam reminder.</p></div>`}</section>`;
}

function classEventRow(event) {
  const typeLabel = event.type === "quiz" ? "Quiz" : "Assignment";
  const icon = event.type === "quiz" ? "✦" : "▤";
  return `<article class="calendar-class-event ${event.type}"><span class="calendar-class-event-icon">${icon}</span><div class="calendar-class-event-copy"><b>${escapeHtml(event.title)}</b><small>${typeLabel} · ${escapeHtml(event.className)} · ${escapeHtml(event.status)}</small></div><button class="text-action" data-action="planner-open-class" data-class-id="${escapeHtml(event.classId)}" aria-label="Open ${escapeHtml(event.className)}">Open class →</button></article>`;
}

function taskRow(task) {
  const desc = task.description ? ` · ${escapeHtml(task.description)}` : "";
  return `<div class="task-row"><button class="check-control ${task.completed ? "done" : ""}" data-action="toggle-task" data-id="${escapeHtml(task.id)}" aria-label="${task.completed ? "Reopen" : "Complete"} ${escapeHtml(task.title)}">${task.completed ? "✓" : ""}</button><div class="task-info"><b style="${task.completed ? "text-decoration:line-through;opacity:.65" : ""}">${escapeHtml(task.title)}</b><small>${formatDate(task.date, { month: "short", day: "numeric" })} · ${Number(task.duration || 0)} min${task.subjectId ? ` · ${escapeHtml(subjectName(task.subjectId))}` : ""}${desc}</small></div><span class="priority ${escapeHtml(task.priority || "medium")}">${escapeHtml(task.category || "study")}</span><button class="text-action" data-action="edit-task" data-id="${escapeHtml(task.id)}">Edit</button><button class="text-action delete" data-action="delete-task" data-id="${escapeHtml(task.id)}">Delete</button></div>`;
}

function priorityRank(priority) {
  return ({ high: 0, medium: 1, low: 2 })[priority] ?? 1;
}
