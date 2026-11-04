import { read, escapeHtml, percent, todayISO, daysAgoISO, formatDate, subjectName } from "./storage.js";
import { iconMarkup } from "./icons.js";

export function dashboardStats() {
  const subjects = read("subjects"), scores = read("scores"), tasks = read("tasks"), sessions = read("sessions");
  const totalObtained = scores.reduce((sum, s) => sum + Number(s.obtained || 0), 0);
  const totalMaximum = scores.reduce((sum, s) => sum + Number(s.maximum || 0), 0);
  const completed = tasks.filter(t => t.completed).length;
  const today = todayISO();
  const focusToday = sessions.filter(s => s.date === today && s.mode === "focus").reduce((sum, s) => sum + Number(s.minutes || 0), 0);
  const totalFocus = sessions.filter(s => s.mode === "focus").reduce((sum, s) => sum + Number(s.minutes || 0), 0);
  const streak = calculateStreak(sessions);
  const upcoming = tasks.filter(t => t.category === "exam" && !t.completed && t.date >= today).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 3);
  return { subjects: subjects.length, avg: totalMaximum ? Math.round(totalObtained / totalMaximum * 100) : null, completed, focusToday, totalFocus, streak, upcoming };
}

export function calculateStreak(sessions = read("sessions")) {
  const focusDates = new Set(sessions.filter(s => s.mode === "focus" && Number(s.minutes) > 0).map(s => s.date));
  let streak = 0;
  const cursor = new Date(); cursor.setHours(12,0,0,0);
  if (!focusDates.has(todayISO())) cursor.setDate(cursor.getDate() - 1);
  while (focusDates.has(localDate(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
function localDate(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0,10); }

export function renderDashboard() {
  const profile = read("profile"), stats = dashboardStats(), scores = read("scores"), tasks = read("tasks"), sessions = read("sessions");
  const today = todayISO();
  const todaysTasks = tasks.filter(t => t.date === today && !t.completed).slice(0, 5);
  const recent = [
    ...scores.map(s => ({ icon: "◉", title: `Added score: ${s.title}`, detail: `${subjectName(s.subjectId)} · ${Math.round(percent(s.obtained,s.maximum))}%`, date: s.createdAt || `${s.date}T12:00:00` })),
    ...tasks.filter(t=>t.completed).map(t=>({icon:"✓",title:`Completed ${t.title}`,detail:"Study task",date:t.completedAt||`${t.date}T12:00:00`})),
    ...sessions.filter(s=>s.mode==="focus").map(s=>({icon:"◷",title:"Study session completed",detail:`${s.minutes} minutes of focus`,date:s.createdAt||`${s.date}T12:00:00`}))
  ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  const name = escapeHtml(profile.name || "Student");
  return `<section class="welcome-card"><div class="welcome-orb"></div><div class="welcome-copy"><div class="eyebrow"><span class="eyebrow-spark">✦</span> YOUR PERSONAL STUDY SPACE</div><h2>Good ${getGreeting()}, ${name}</h2><p>Every focused session brings you closer to your goals. Make today count, one small step at a time.</p><div class="welcome-actions"><button class="btn btn-primary" data-page="planner">Plan your day <span aria-hidden="true">↗</span></button><button class="hero-link" data-page="timer"><span class="hero-play">▶</span> Open focus timer</button></div></div><div class="welcome-art" aria-hidden="true"><div class="art-orbit art-orbit-one"></div><div class="art-orbit art-orbit-two"></div><div class="hero-study-card"><div class="hero-study-head"><span class="hero-book-icon"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6"/></svg></span><span>YOUR LEARNING SPACE</span><i></i></div><div class="hero-progress-lines"><b></b><i></i><i></i></div><div class="hero-study-foot"><span class="hero-check">✓</span><span><b>Keep showing up</b><small>Progress takes practice</small></span></div></div><span class="hero-spark hero-spark-one">✦</span><span class="hero-spark hero-spark-two">✧</span><span class="hero-orbit-dot"></span></div><div class="date-pill"><span>✦</span> ${new Date().toLocaleDateString(document.documentElement.lang === "km" ? "km-KH" : undefined,{weekday:"long",month:"long",day:"numeric"})}</div></section>
  <div class="stats-grid dashboard-stats">
    ${stat("Subjects",stats.subjects,"In your learning space","grid","")}
    ${stat("Overall average",stats.avg===null?"—":`${stats.avg}%`,scores.length?`${scores.length} assessment${scores.length===1?"":"s"} recorded`:"Add scores to see your average","target","blue")}
    ${stat("Total study hours",formatMinutes(stats.totalFocus),`Today · ${formatMinutes(stats.focusToday)}`,"clock","green")}
    ${stat("Completed tasks",stats.completed,`${tasks.length} task${tasks.length===1?"":"s"} created`,"listCheck","")}
    ${stat("Study streak",`${stats.streak} day${stats.streak===1?"":"s"}`,stats.streak?"You're building a habit":"Start a session to begin","sparkle","yellow")}
    ${stat("Upcoming exams",stats.upcoming.length,stats.upcoming.length?"Scheduled in your planner":"Add exam dates in planner","trend","blue")}
  </div>
  <div class="grid-2">
    <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Study activity</h2><p class="panel-subtitle">Focus time over the past 7 days</p></div><button class="panel-action" data-page="analytics">View analytics ↗</button></div><div class="chart-box"><canvas id="dashboard-study-chart" aria-label="Study time chart"></canvas></div><div class="chart-legend"><span><i class="legend-dot"></i>Focus minutes</span></div></section>
    <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Score performance</h2><p class="panel-subtitle">Recent assessment percentages</p></div><button class="panel-action" data-page="scores">All scores ↗</button></div><div class="chart-box"><canvas id="dashboard-score-chart" aria-label="Score performance chart"></canvas></div><div class="chart-legend"><span><i class="legend-dot blue"></i>Assessment score</span></div></section>
  </div>
  <div class="grid-2 equal">
    <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Today's focus</h2><p class="panel-subtitle">Your next steps for ${formatDate(today,{weekday:"long",month:"short",day:"numeric"})}</p></div><button class="panel-action" data-page="planner">Open planner ↗</button></div>
      ${todaysTasks.length?`<div class="task-list">${todaysTasks.map(t=>`<div class="task-row"><button class="check-control" data-action="toggle-task" data-id="${escapeHtml(t.id)}" aria-label="Complete ${escapeHtml(t.title)}"></button><div class="task-info"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.duration||0)} min${t.subjectId?` · ${escapeHtml(subjectName(t.subjectId))}`:""}</small></div><span class="priority ${escapeHtml(t.priority||"medium")}">${escapeHtml(t.priority||"medium")}</span></div>`).join("")}</div>`:empty("No study tasks for today yet.","Add a task in your planner to get started.","▣")}
    </section>
    <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Upcoming exams</h2><p class="panel-subtitle">Plan ahead and feel prepared</p></div><button class="panel-action" data-page="planner">Planner ↗</button></div>
      ${stats.upcoming.length?`<div class="activity-list">${stats.upcoming.map(t=>`<div class="activity-row"><div class="activity-marker">✎</div><div class="activity-text"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(subjectName(t.subjectId))}</small></div><div class="activity-time">${formatDate(t.date,{month:"short",day:"numeric"})}</div></div>`).join("")}</div>`:empty("No upcoming exams added.","Add an exam task to see it here.","◷")}
    </section>
  </div>
  <section class="panel" style="margin-top:14px"><div class="panel-head"><div><h2 class="panel-title">Learning progress</h2><p class="panel-subtitle">Score progress by subject</p></div><button class="panel-action" data-page="subjects">Manage subjects ↗</button></div>${renderSubjectProgress()}</section>
  <section class="panel" style="margin-top:14px"><div class="panel-head"><div><h2 class="panel-title">Recent activity</h2><p class="panel-subtitle">Your latest study updates</p></div><button class="panel-action" data-page="analytics">Your progress ↗</button></div>
    ${recent.length?`<div class="activity-list">${recent.map(a=>`<div class="activity-row"><div class="activity-marker">${a.icon}</div><div class="activity-text"><b>${escapeHtml(a.title)}</b><small>${escapeHtml(a.detail)}</small></div><div class="activity-time">${formatDate(a.date,{month:"short",day:"numeric"})}</div></div>`).join("")}</div>`:empty("Your learning journey starts here.","Add a subject, plan a task, or start a focus session.","✧")}
  </section>`;
}

function getGreeting(){const h=new Date().getHours();return h<12?"morning":h<18?"afternoon":"evening";}
function formatMinutes(min){return `${Math.floor(min/60)}h ${min%60}m`;}
function stat(title,value,foot,icon,tone){return `<article class="stat-card"><div class="stat-top"><span>${title}</span><span class="stat-icon ${tone}">${iconMarkup(icon)}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`;}
function empty(title,description,icon){return `<div class="empty-state"><div class="empty-icon">${icon}</div><b>${title}</b><p>${description}</p></div>`;}
function renderSubjectProgress(){const subjects=read("subjects");if(!subjects.length)return `<div class="empty-state"><div class="empty-icon">▦</div><b>Your subjects will appear here</b><p>Add a subject and assessments to see your progress.</p><button class="btn btn-primary btn-small" style="margin-top:12px" data-action="add-subject">＋ Add subject</button></div>`;return `<div class="activity-list">${subjects.slice(0,6).map(s=>{const scores=read("scores").filter(x=>x.subjectId===s.id),max=scores.reduce((n,x)=>n+Number(x.maximum||0),0),got=scores.reduce((n,x)=>n+Number(x.obtained||0),0),avg=max?Math.round(got/max*100):0,target=Math.max(0,Math.min(100,Number(s.targetScore)||0)),color=/^#[0-9a-f]{6}$/i.test(s.color||"")?s.color:"#8b5cf6";return `<div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:10px;font-weight:600">${escapeHtml(s.name)}</span><span style="font-size:9px;color:var(--muted)">${max?`${avg}% average`:"No scores yet"}${target?` · ${target}% target`:""}</span></div><div class="progress-track"><div class="progress-fill" style="width:${target?Math.min(100,avg/target*100):avg}%;background:linear-gradient(90deg,${color},#5799ff)"></div></div></div>`;}).join("")}</div>`;}

export function drawDashboardCharts(){
  const sessions=read("sessions"), scores=read("scores");
  const days=Array.from({length:7},(_,i)=>6-i).map(offset=>{const date=daysAgoISO(offset);return {label:new Date(`${date}T12:00:00`).toLocaleDateString(document.documentElement.lang === "km" ? "km-KH" : undefined,{weekday:"short"}),value:sessions.filter(s=>s.date===date&&s.mode==="focus").reduce((sum,s)=>sum+Number(s.minutes||0),0)}});
  const recentScores=[...scores].sort((a,b)=>a.date.localeCompare(b.date)).slice(-7).map(s=>({label:new Date(`${s.date}T12:00:00`).toLocaleDateString(document.documentElement.lang === "km" ? "km-KH" : undefined,{month:"numeric",day:"numeric"}),value:percent(s.obtained,s.maximum)}));
  drawLine(document.getElementById("dashboard-study-chart"),days,"#9a79ff","min");
  drawLine(document.getElementById("dashboard-score-chart"),recentScores,"#55a4ff","%");
}

export function drawLine(canvas, data, color, unit=""){
  if(!canvas)return; const rect=canvas.getBoundingClientRect(),ctx=canvas.getContext("2d"); if(!ctx)return;
  const w=Math.max(1,rect.width),h=Math.max(1,rect.height),dpr=window.devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const pad={l:29,r:10,t:10,b:26},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  ctx.font="9px Inter,system-ui,sans-serif";ctx.fillStyle="#71819a";ctx.strokeStyle="rgba(148,163,184,.13)";ctx.lineWidth=1;
  if(!data.length||data.every(d=>!Number(d.value))){for(let i=0;i<4;i++){const y=pad.t+(ch*i/3);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();}ctx.fillStyle="#71819a";ctx.textAlign="center";ctx.fillText("Add activity to see your chart",w/2,h/2);return;}
  let max=Math.max(...data.map(d=>Number(d.value)),unit==="%"?100:20); max=unit==="%"?100:Math.ceil(max/10)*10;
  for(let i=0;i<4;i++){const val=max-(max*i/3),y=pad.t+(ch*i/3);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.textAlign="right";ctx.fillText(`${Math.round(val)}${unit}`,pad.l-6,y+3);}
  const points=data.map((d,i)=>({x:pad.l+(data.length===1?cw/2:cw*i/(data.length-1)),y:pad.t+ch-(Number(d.value)/max)*ch,label:d.label}));
  if(points.length>1){const grad=ctx.createLinearGradient(0,pad.t,0,h);grad.addColorStop(0,color+"42");grad.addColorStop(1,color+"00");ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(points.at(-1).x,pad.t+ch);ctx.lineTo(points[0].x,pad.t+ch);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin="round";ctx.stroke();}
  points.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle="#17243a";ctx.lineWidth=2;ctx.stroke();ctx.textAlign="center";ctx.fillStyle="#7888a1";ctx.fillText(p.label,p.x,h-5);});
}
