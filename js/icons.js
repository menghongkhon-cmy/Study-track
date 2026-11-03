const svgPaths = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 5 5 5 9s-5 4-5 9m10-18c0 5-5 5-5 9s5 4 5 9"/>',
  trend: '<path d="M3 17 9 11l4 4 8-9"/><path d="M15 6h6v6"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6"/>',
  bookOpen: '<path d="M12 7v14M3 5.5 12 3l9 2.5v14L12 22l-9-2.5z"/><path d="M6 9h3m6 0h3M6 13h3m6 0h3"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9h18"/>',
  pencil: '<path d="m16 5 3 3M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.1 1.9-2 3.4-2.1-.6a8 8 0 0 1-1.5.9l-.5 2.1h-4l-.5-2.1a8 8 0 0 1-1.5-.9l-2.1.6-2-3.4 1.6-1.5a8 8 0 0 1 0-1.8l-1.6-1.5 2-3.4 2.1.6a8 8 0 0 1 1.5-.9l.5-2.1h4l.5 2.1a8 8 0 0 1 1.5.9l2.1-.6 2 3.4-1.6 1.5a8 8 0 0 1 .4 1.3Z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5m6 6-6-6 6-6"/>',
  arrowUp: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14m6-6-6 6-6-6"/>',
  upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  download: '<path d="M12 4v12m0 0 5-5m-5 5-5-5"/><path d="M5 17v3h14v-3"/>',
  refresh: '<path d="M20 7v5h-5"/><path d="M20 12a8 8 0 1 0 2 5"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  star: '<path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9z"/>',
  play: '<path d="m8 5 12 7-12 7z"/>',
  pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
  quote: '<path d="M10 11H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5v7Zm11 0h-5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5v7ZM3 11v2a5 5 0 0 0 5 5v2M14 11v2a5 5 0 0 0 5 5v2"/>',
  cloud: '<path d="M20 16.2A4.8 4.8 0 0 0 18 7h-1.2A7 7 0 0 0 3 9.3 4.5 4.5 0 0 0 4.5 18H18"/><path d="M12 12v8m-3-3 3 3 3-3"/>',
  bookMark: '<path d="M6 3h12a2 2 0 0 1 2 2v16l-8-4-8 4V5a2 2 0 0 1 2-2Z"/>',
  alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
};

const glyphs = new Map([
  ["＋", "plus"], ["✦", "sparkle"], ["✧", "sparkle"], ["✓", "check"], ["✕", "close"], ["×", "close"],
  ["◉", "target"], ["◎", "target"], ["◷", "clock"], ["⌛", "hourglass"], ["⌁", "trend"], ["▦", "grid"],
  ["▣", "folder"], ["▤", "bookOpen"], ["✎", "pencil"], ["✉", "mail"], ["⚙", "settings"], ["☰", "menu"],
  ["···", "more"], ["↗", "arrowUpRight"], ["→", "arrowRight"], ["←", "arrowLeft"], ["↑", "arrowUp"], ["↓", "arrowDown"],
  ["↥", "upload"], ["↧", "download"], ["↻", "refresh"], ["›", "chevronRight"], ["‹", "chevronLeft"], ["⌂", "home"],
  ["★", "star"], ["▶", "play"], ["Ⅱ", "pause"], ["❝", "quote"], ["!", "alert"], ["•", "list"],
]);

const leadingContexts = new Set(["BUTTON", "SUMMARY", "LABEL"]);

function iconElement(name) {
  const wrapper = document.createElement("span");
  wrapper.className = "studytrack-icon";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${svgPaths[name]}</svg>`;
  return wrapper;
}

function replaceGlyph(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest("svg,script,style,textarea,input,select,option,code,pre,[contenteditable='true'],.studytrack-icon")) return;
  const value = node.nodeValue || "";
  const trimmed = value.trim();
  if (glyphs.has(trimmed)) {
    const name = glyphs.get(trimmed);
    node.replaceWith(iconElement(name));
    return;
  }
  if (!leadingContexts.has(parent.tagName) && !parent.closest("button,[role='button'],.btn")) return;
  const start = value.match(/^\s*/)?.[0] || "";
  const remainder = value.slice(start.length);
  const token = [...glyphs.keys()].sort((a, b) => b.length - a.length).find(glyph => remainder.startsWith(glyph) && /^\s/.test(remainder.slice(glyph.length)));
  if (!token) return;
  const fragment = document.createDocumentFragment();
  if (start) fragment.append(document.createTextNode(start));
  fragment.append(iconElement(glyphs.get(token)));
  fragment.append(document.createTextNode(remainder.slice(token.length)));
  node.replaceWith(fragment);
}

function replaceExistingGlyphs(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(replaceGlyph);
}

replaceExistingGlyphs(document);
new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType === Node.TEXT_NODE) replaceGlyph(node);
      else if (node.nodeType === Node.ELEMENT_NODE) replaceExistingGlyphs(node);
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true });
