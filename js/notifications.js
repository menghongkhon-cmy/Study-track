import { getNotifications, updateNotificationsRead } from "./auth.js";

let pollTimer = null;
let pollBusy = false;
let firstPoll = true;
let activeUserId = "";
let knownIds = new Set();
let items = [];
let unreadCount = 0;
let changeHandler = () => {};
let loadError = false;
let generation = 0;

function preferenceKey() {
  return `studytrack_desktop_alerts:${activeUserId}`;
}

function desktopSupported() {
  return Boolean(window.isSecureContext && "Notification" in window);
}

function desktopEnabled() {
  try { return localStorage.getItem(preferenceKey()) === "on"; }
  catch { return false; }
}

export function notificationSnapshot() {
  return {
    notifications: items,
    unreadCount,
    desktopEnabled: desktopEnabled(),
    desktopSupported: desktopSupported(),
    desktopPermission: desktopSupported() ? Notification.permission : "unsupported",
    loadError,
  };
}

function showDesktopNotifications(newItems) {
  if (!desktopEnabled() || Notification.permission !== "granted" || !document.hidden) return;
  const item = newItems[0];
  if (!item) return;
  let title = "New StudyTrack activity";
  if (newItems.length === 1 && item.kind === "direct_chat") title = "New private message";
  else if (newItems.length === 1 && item.kind === "class_chat") title = "New class chat message";
  const body = newItems.length === 1
    ? `${item.title} · Open StudyTrack to review it.`
    : `${newItems.length} new messages and class updates. Open StudyTrack to review them.`;
  try {
    const notice = new Notification(title, { body, icon: "/assets/images/studytrack-icon.png", tag: "studytrack-activity", renotify: false });
    notice.onclick = () => {
      window.focus();
      window.dispatchEvent(new CustomEvent("studytrack:open-notification", { detail: { notification: item } }));
      notice.close();
    };
  } catch {}
}

async function pollNotifications() {
  if (pollBusy || !activeUserId) return;
  pollBusy = true;
  const pollGeneration = generation;
  try {
    const result = await getNotifications();
    if (pollGeneration !== generation) return;
    const nextItems = Array.isArray(result.notifications) ? result.notifications : [];
    const freshItems = firstPoll ? [] : nextItems.filter(item => !knownIds.has(String(item.id)));
    for (const item of nextItems) knownIds.add(String(item.id));
    if (knownIds.size > 240) knownIds = new Set([...knownIds].slice(-180));
    firstPoll = false;
    items = nextItems;
    unreadCount = Math.max(0, Number(result.unread_count) || 0);
    loadError = false;
    changeHandler(notificationSnapshot());
    showDesktopNotifications(freshItems);
  } catch {
    if (pollGeneration !== generation) return;
    loadError = true;
    changeHandler(notificationSnapshot());
  } finally {
    if (pollGeneration === generation) pollBusy = false;
  }
}

export function startNotificationPolling(userId, onChange = () => {}) {
  stopNotificationPolling();
  activeUserId = String(userId || "");
  changeHandler = onChange;
  firstPoll = true;
  knownIds = new Set();
  items = [];
  unreadCount = 0;
  loadError = false;
  if (!activeUserId) return;
  pollNotifications();
  pollTimer = setInterval(pollNotifications, 12_000);
}

export function stopNotificationPolling() {
  generation += 1;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  activeUserId = "";
  pollBusy = false;
  firstPoll = true;
  knownIds = new Set();
  items = [];
  unreadCount = 0;
  loadError = false;
}

export async function markAllNotificationsRead() {
  await updateNotificationsRead({ all: true });
  await pollNotifications();
}

export async function markNotificationRead(id) {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId < 1) return;
  await updateNotificationsRead({ ids: [numericId] });
  await pollNotifications();
}

export async function toggleDesktopAlerts() {
  if (!desktopSupported()) return notificationSnapshot();
  if (desktopEnabled()) {
    try { localStorage.removeItem(preferenceKey()); } catch {}
    changeHandler(notificationSnapshot());
    return notificationSnapshot();
  }
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission === "granted") {
    try { localStorage.setItem(preferenceKey(), "on"); } catch {}
  }
  changeHandler(notificationSnapshot());
  return notificationSnapshot();
}
