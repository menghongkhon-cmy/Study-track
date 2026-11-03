export const KEYS = {
  profile: "studytrack_profile", subjects: "studytrack_subjects", scores: "studytrack_scores",
  tasks: "studytrack_tasks", sessions: "studytrack_sessions", notes: "studytrack_notes",
  goals: "studytrack_goals", achievements: "studytrack_achievements", settings: "studytrack_settings"
};

const defaults = {
  profile: { name: "Student", avatar: "S", photo: "", role: "student" }, subjects: [], scores: [], tasks: [], sessions: [], notes: [], goals: [],
  achievements: [], settings: { theme: "light", focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, pinEnabled: false, pinHash: "", timer: { mode: "focus", remaining: 1500, running: false, endsAt: null } }
};

export function read(name) {
  const key = KEYS[name] || name;
  const fallback = defaults[name] ?? null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return structuredClone(fallback);
    const value = JSON.parse(raw);
    if (name !== "profile" && name !== "settings" && !Array.isArray(value)) return structuredClone(fallback);
    if ((name === "profile" || name === "settings") && (!value || typeof value !== "object" || Array.isArray(value))) return structuredClone(fallback);
    return value;
  } catch {
    return structuredClone(fallback);
  }
}

export function write(name, value) {
  const key = KEYS[name] || name;
  localStorage.setItem(key, JSON.stringify(value));
  const auth = globalThis.StudyTrackAuth;
  if (auth?.active && !auth.suppressSync && typeof auth.saveData === "function" && KEYS[name]) auth.saveData(name, value);
  return value;
}

export function update(name, updater) { return write(name, updater(read(name))); }
export function id() { return globalThis.crypto?.randomUUID?.() || `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`; }
export function todayISO() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
export function dateKey(date = new Date()) { const d = new Date(date); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
export function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }
const NOTE_TAGS = new Set(["P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "H2", "H3", "BLOCKQUOTE", "CODE", "PRE", "HR"]);
const NOTE_DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH", "TEMPLATE"]);
export function sanitizeNoteHtml(value = "") {
  const input = String(value).slice(0, 40000);
  if (!/[<>]/.test(input)) return escapeHtml(input).replace(/\r?\n/g, "<br>");
  const parsed = new DOMParser().parseFromString(`<body>${input}</body>`, "text/html");
  const clean = node => [...node.childNodes].map(child => {
    if (child.nodeType === Node.TEXT_NODE) return escapeHtml(child.textContent || "");
    if (child.nodeType !== Node.ELEMENT_NODE) return "";
    if (NOTE_DROP.has(child.tagName)) return "";
    const contents = clean(child);
    return NOTE_TAGS.has(child.tagName) ? `<${child.tagName.toLowerCase()}>${contents}</${child.tagName.toLowerCase()}>` : contents;
  }).join("");
  return clean(parsed.body).slice(0, 30000);
}
export function noteContentHtml(value = "") { return sanitizeNoteHtml(value) || "<span class=\"note-empty-line\">No content yet</span>"; }
export function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(document.documentElement.lang === "km" ? "km-KH" : undefined, options);
}
export function percent(obtained, maximum) { return maximum > 0 ? Math.max(0, Math.min(100, (Number(obtained) / Number(maximum)) * 100)) : 0; }
export function getSettings() {
  const base = defaults.settings;
  const current = read("settings") || {};
  return { ...base, ...current, timer: { ...base.timer, ...(current.timer || {}) } };
}
export function saveSettings(value) { return write("settings", value); }
export function subjectName(subjectId) { return read("subjects").find(s => s.id === subjectId)?.name || "Unassigned"; }
export function daysAgoISO(offset) { const date = new Date(); date.setDate(date.getDate() - offset); return dateKey(date); }
export function localTimeLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function allData() {
  return Object.fromEntries(Object.entries(KEYS).map(([name]) => [name, read(name)]));
}

export function replaceDataFromServer(data = {}) {
  for (const [name, key] of Object.entries(KEYS)) {
    const value = data[name] ?? structuredClone(defaults[name]);
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export function clearAll() {
  Object.values(KEYS).forEach(key => localStorage.removeItem(key));
}

export function importData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("This backup is not a valid StudyTrack data object.");
  const allowedArrays = ["subjects", "scores", "tasks", "sessions", "notes", "goals", "achievements"];
  for (const name of allowedArrays) if (data[name] !== undefined && !Array.isArray(data[name])) throw new Error(`The ${name} section must be a list.`);
  for (const name of allowedArrays) if (data[name] !== undefined) {
    const seen = new Set(), clean = [];
    for (const item of data[name]) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const recordId = typeof item.id === "string" && item.id.trim() ? item.id.trim() : id();
      if (seen.has(recordId)) continue;
      seen.add(recordId); clean.push({ ...item, id: recordId });
    }
    write(name, clean);
  }
  if (data.profile && typeof data.profile === "object" && !Array.isArray(data.profile)) write("profile", { ...defaults.profile, ...data.profile });
  if (data.settings && typeof data.settings === "object" && !Array.isArray(data.settings)) {
    const current = getSettings();
    write("settings", { ...current, ...data.settings, timer: { ...current.timer, ...(data.settings.timer || {}) } });
  }
}

// Create missing keys at first launch, without overwriting existing data.
for (const [name, fallback] of Object.entries(defaults)) {
  if (localStorage.getItem(KEYS[name]) === null) write(name, structuredClone(fallback));
}
