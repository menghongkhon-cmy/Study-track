import { read, escapeHtml, percent } from "./storage.js";

export function renderSubjects(){
  const subjects=read("subjects"),scores=read("scores"),tasks=read("tasks");
  return `<div class="page-heading"><div><div class="eyebrow">YOUR LEARNING MAP</div><h1>Subjects</h1><p>Keep your classes, skills, and learning goals organized.</p></div><div class="heading-actions"><button class="btn btn-primary" data-action="add-subject">＋ Add subject</button></div></div>
  <div class="toolbar"><span class="muted" style="font-size:10px">${subjects.length} subject${subjects.length===1?"":"s"} in your workspace</span></div>
  ${subjects.length?`<div class="section-grid">${subjects.map(subject=>{
    const own=scores.filter(s=>s.subjectId===subject.id),obt=own.reduce((n,s)=>n+Number(s.obtained||0),0),max=own.reduce((n,s)=>n+Number(s.maximum||0),0),avg=max?Math.round(obt/max*100):null;
    const pending=tasks.filter(t=>t.subjectId===subject.id&&!t.completed).length;
    const target=Number(subject.targetScore)||0;const progress=avg===null?0:target?Math.min(100,avg/target*100):avg;
    const color=safeColor(subject.color);return `<article class="subject-card"><div class="subject-card-top"><div class="subject-color" style="background:${color}">${escapeHtml((subject.name||"?").slice(0,1).toUpperCase())}</div><div><button class="card-menu" aria-label="Edit ${escapeHtml(subject.name)}" data-action="edit-subject" data-id="${escapeHtml(subject.id)}">···</button></div></div><h3>${escapeHtml(subject.name)}</h3><p>${escapeHtml(subject.description||"No description added yet.")}</p><div class="subject-metrics"><span>${own.length} assessment${own.length===1?"":"s"}</span><span>${avg===null?"No scores":`${avg}% average`}</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%;background:linear-gradient(90deg,${color},#5799ff)"></div></div><div class="subject-metrics"><span>${pending} pending task${pending===1?"":"s"}</span><span>${target?`Target ${target}%`:"Score progress"}</span></div><div style="display:flex;gap:6px;margin-top:13px"><button class="btn btn-small btn-soft" data-action="add-score" data-subject="${escapeHtml(subject.id)}">＋ Score</button><button class="btn btn-small" data-action="edit-subject" data-id="${escapeHtml(subject.id)}">Edit</button><button class="btn btn-small btn-danger" data-action="delete-subject" data-id="${escapeHtml(subject.id)}">Delete</button></div></article>`;
  }).join("")}</div>`:`<div class="panel">${emptySubjects()}</div>`}`;
}
function safeColor(value){return /^#[0-9a-f]{6}$/i.test(value||"")?value:"#8b5cf6";}
function emptySubjects(){return `<div class="empty-state"><div class="empty-icon">▦</div><b>No subjects yet</b><p>Add subjects like English, JavaScript, or MySQL to track your learning in one place.</p><button class="btn btn-primary btn-small" style="margin-top:12px" data-action="add-subject">＋ Add your first subject</button></div>`;}
