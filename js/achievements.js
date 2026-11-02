import { read, escapeHtml, todayISO } from "./storage.js";
import { calculateStreak } from "./dashboard.js";
import { isComplete } from "./goals.js";

const definitions=[
  {id:"first-session",icon:"◷",name:"First Study Session",description:"Complete your first focus timer session.",test:()=>read("sessions").some(s=>s.mode==="focus")},
  {id:"streak-7",icon:"✧",name:"7-Day Study Streak",description:"Study on seven consecutive days.",test:()=>calculateStreak()>=7},
  {id:"tasks-10",icon:"✓",name:"10 Completed Tasks",description:"Complete 10 study planner tasks.",test:()=>read("tasks").filter(t=>t.completed).length>=10},
  {id:"hours-100",icon:"⌛",name:"100 Study Hours",description:"Record 100 focus hours with the Pomodoro timer.",test:()=>read("sessions").filter(s=>s.mode==="focus").reduce((n,s)=>n+Number(s.minutes||0),0)>=6000},
  {id:"score-90",icon:"◉",name:"Score Above 90%",description:"Earn 90% or higher on an assessment.",test:()=>read("scores").some(s=>Number(s.maximum)>0&&Number(s.obtained)/Number(s.maximum)>=.9)},
  {id:"weekly-goal",icon:"◎",name:"Weekly Goal Completed",description:"Complete a goal with a weekly schedule.",test:()=>read("goals").some(g=>g.period==="weekly"&&isComplete(g))}
];
export function syncAchievements(){const current=read("achievements"),now=new Date().toISOString(),updated=definitions.map(d=>{const prior=current.find(a=>a.id===d.id);const unlocked=Boolean(prior?.unlocked)||d.test();return {id:d.id,unlocked,unlockedAt:unlocked?(prior?.unlockedAt||now):null};});localStorage.setItem("studytrack_achievements",JSON.stringify(updated));return updated;}
export function renderAchievements(){
  const earned=syncAchievements(),unlocked=earned.filter(a=>a.unlocked).length;
  const cards=definitions.map(d=>{
    const record=earned.find(a=>a.id===d.id),has=Boolean(record?.unlocked);
    const unlockedLabel=has?`Unlocked${record.unlockedAt?` · ${new Date(record.unlockedAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}`:""}`:"Locked · keep going";
    return `<article class="achievement-card ${has?"":"locked"}"><div class="achievement-icon">${d.icon}</div><div><h3>${escapeHtml(d.name)}</h3><p>${escapeHtml(d.description)}</p><span class="unlocked-pill" style="color:${has?"var(--green)":"var(--muted)"}">${unlockedLabel}</span></div></article>`;
  }).join("");
  return `<div class="page-heading"><div><div class="eyebrow">CELEBRATE YOUR PROGRESS</div><h1>Achievements</h1><p>Small wins are worth recognizing. Your badges are based on activity saved in this browser.</p></div><div class="heading-actions"><span class="local-indicator"><i></i> ${unlocked} / ${definitions.length} unlocked</span></div></div><div class="achievement-grid">${cards}</div>`;
}
