"use client";
/* eslint-disable react/no-unescaped-entities -- design prototype */

import { useState, useRef, useEffect } from "react";

// ══════════════════════════════════════════════════════════════
//  MOCK DATA
// ══════════════════════════════════════════════════════════════

const TEAM = [
  { id:"u1", name:"Matt Giblin",  initials:"MG", color:"#6366f1", role:"Lead Dev",  online:true  },
  { id:"u2", name:"Alex Chen",    initials:"AC", color:"#16a34a", role:"Developer", online:true  },
  { id:"u3", name:"Sarah Kim",    initials:"SK", color:"#ec4899", role:"Designer",  online:false },
  { id:"u4", name:"Jordan Lee",   initials:"JL", color:"#d97706", role:"Product",   online:true  },
  { id:"u5", name:"Casey Park",   initials:"CP", color:"#7c3aed", role:"Developer", online:false },
  { id:"u6", name:"Dana Walsh",   initials:"DW", color:"#0891b2", role:"QA Eng",    online:true  },
];
const teamById = Object.fromEntries(TEAM.map(m=>[m.id,m])) as Record<string,typeof TEAM[0]>;

type IssueStatus   = "backlog"|"todo"|"in_progress"|"in_review"|"done"|"blocked";
type IssuePriority = "urgent"|"high"|"medium"|"low";
type IssueType     = "bug"|"feature"|"task"|"chore";

type Issue = {
  id:string; key:string; title:string;
  status:IssueStatus; priority:IssuePriority; type:IssueType;
  assigneeId:string|null; project:string; projectName:string;
  sprint:string|null; labels:string[];
  blockedBy?:string; blocks?:string;
  daysOld:number; comments:number;
  description:string; estimate?:number;
  prRef?:string; thinkTank?:string;
};

const ALL_ISSUES: Issue[] = [
  { id:"i1",  key:"FORGE-45", title:"Migrate rate limiter to Redis/Upstash",          status:"blocked",     priority:"urgent", type:"chore",   assigneeId:"u1", project:"FORGE", projectName:"Forge Issue Tracker", sprint:"Sprint 6", labels:["infra","security"], blockedBy:"INFRA-15", daysOld:5,  comments:8,  estimate:3, description:"The in-memory rate limiter resets on every deploy and won't survive multi-instance production. Risk: it's security theater — trivially bypassed by hitting a different pod.", prRef:"PR #87", thinkTank:"Security Hardening Initiative" },
  { id:"i2",  key:"FORGE-46", title:"Add Stripe webhook retry handler",                status:"in_review",   priority:"high",   type:"feature", assigneeId:"u2", project:"FORGE", projectName:"Forge Issue Tracker", sprint:"Sprint 6", labels:["billing"], daysOld:3, comments:4, estimate:5, description:"Stripe webhooks can fail transiently. Need idempotent retry with exponential backoff so billing events are never silently lost.", prRef:"PR #89", thinkTank:"Billing Hardening" },
  { id:"i3",  key:"WEB-204",  title:"Fix destination picker on mobile Safari",        status:"in_progress", priority:"high",   type:"bug",     assigneeId:"u1", project:"WEB",   projectName:"Travli Web App",       sprint:"Sprint 6", labels:["mobile","ux"], daysOld:2, comments:2, estimate:2, description:"City autocomplete renders off-screen on iOS Safari due to a 100vh viewport bug. Fix: use window.visualViewport.height." },
  { id:"i4",  key:"FORGE-47", title:"Issue export to CSV",                             status:"todo",        priority:"medium", type:"feature", assigneeId:"u1", project:"FORGE", projectName:"Forge Issue Tracker", sprint:"Sprint 6", labels:[], daysOld:1, comments:0, estimate:3, description:"Allow project owners to export all issues to CSV. Columns: key, title, status, priority, type, assignee, labels, created, updated." },
  { id:"i5",  key:"FORGE-48", title:"Fix flaky isolation test for idea_signoffs",     status:"todo",        priority:"medium", type:"bug",     assigneeId:null, project:"FORGE", projectName:"Forge Issue Tracker", sprint:null,       labels:["testing"], daysOld:4, comments:1, estimate:2, description:"The test intermittently fails due to race conditions in the sign-off RLS check. Good first issue — isolated scope, clear failure steps." },
  { id:"i6",  key:"WEB-211",  title:"Group expense re-split on amount edit",          status:"backlog",     priority:"medium", type:"feature", assigneeId:null, project:"WEB",   projectName:"Travli Web App",       sprint:null,       labels:["budget"], daysOld:6, comments:3, estimate:5, description:"When a group expense amount is edited, the split amounts should recalculate automatically." },
  { id:"i7",  key:"WEB-212",  title:"Add cruise itinerary port-stop markers",         status:"backlog",     priority:"low",    type:"feature", assigneeId:null, project:"WEB",   projectName:"Travli Web App",       sprint:null,       labels:["cruises"], daysOld:8, comments:0, estimate:8, description:"Port stops on cruise itineraries should show as map markers with local time and all-aboard times." },
  { id:"i8",  key:"MOB-23",   title:"Push notification deep-links broken on Android", status:"done",        priority:"urgent", type:"bug",     assigneeId:"u5", project:"MOB",   projectName:"Travli Mobile",        sprint:"Sprint 6", labels:["android","critical"], daysOld:3, comments:7, estimate:3, description:"Deep link routing fails on Android 12+ when app is backgrounded. Fixed in PR #91." },
  { id:"i9",  key:"FORGE-49", title:"IP extraction wrong behind reverse proxy",       status:"backlog",     priority:"high",   type:"bug",     assigneeId:null, project:"FORGE", projectName:"Forge Issue Tracker", sprint:null,       labels:["security"], daysOld:7, comments:2, estimate:2, description:"X-Forwarded-For header parsing is wrong behind Nginx — extracts the wrong IP for rate limiting.", thinkTank:"Security Hardening Initiative" },
  { id:"i10", key:"FORGE-50", title:"Realtime board event fan-out at scale",          status:"backlog",     priority:"medium", type:"feature", assigneeId:null, project:"FORGE", projectName:"Forge Issue Tracker", sprint:null,       labels:[], daysOld:2, comments:0, estimate:13, description:"Supabase realtime subscriptions need to be scoped per-project to avoid broadcasting all events to all clients." },
  { id:"i11", key:"WEB-220",  title:"Advisor booking — calendar integration",         status:"backlog",     priority:"high",   type:"feature", assigneeId:null, project:"WEB",   projectName:"Travli Web App",       sprint:null,       labels:["advisor","booking"], daysOld:10, comments:5, estimate:13, description:"Advisors need to connect their Google/Outlook calendar so travelers can book available slots." },
  { id:"i12", key:"INFRA-15", title:"Provision Upstash Redis + wire env vars",        status:"in_progress", priority:"urgent", type:"chore",   assigneeId:"u2", project:"INFRA", projectName:"Platform Infra",       sprint:"Sprint 6", labels:["infra","blocking"], blocks:"FORGE-45", daysOld:1, comments:3, estimate:1, description:"Provision the Upstash Redis instance and add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to Vercel env." },
  { id:"i13", key:"FORGE-51", title:"Tenant invite email — branded template",         status:"backlog",     priority:"low",    type:"feature", assigneeId:null, project:"FORGE", projectName:"Forge Issue Tracker", sprint:null,       labels:["email"], daysOld:5, comments:0, estimate:3, description:"Invite emails currently use the Supabase default template. Need Forge branding with the tenant's logo." },
  { id:"i14", key:"WEB-198",  title:"Dark mode — full design system pass",            status:"in_progress", priority:"high",   type:"feature", assigneeId:"u3", project:"WEB",   projectName:"Travli Web App",       sprint:"Sprint 6", labels:["design","ux"], daysOld:4, comments:12, estimate:8, description:"Full dark mode audit across all components. Sarah is leading this with the updated design tokens." },
  { id:"i15", key:"FORGE-52", title:"SEC-05: Make IMPERSONATION_SECRET mandatory",    status:"in_progress", priority:"high",   type:"chore",   assigneeId:"u1", project:"FORGE", projectName:"Forge Issue Tracker", sprint:"Sprint 6", labels:["security","hardening"], daysOld:1, comments:0, estimate:1, description:"IMPERSONATION_SECRET is currently optional — app starts without it and silently disables impersonation. Must throw on startup if absent.", thinkTank:"Security Hardening Initiative" },
];

const STATUS_CFG: Record<IssueStatus, {label:string;dot:string;bg:string;text:string;border:string}> = {
  backlog:     {label:"Backlog",     dot:"bg-neutral-400",  bg:"bg-neutral-50",   text:"text-neutral-600",  border:"border-neutral-200"},
  todo:        {label:"Todo",        dot:"bg-sky-400",      bg:"bg-sky-50",       text:"text-sky-700",      border:"border-sky-200"},
  in_progress: {label:"In Progress", dot:"bg-indigo-500",   bg:"bg-indigo-50",    text:"text-indigo-700",   border:"border-indigo-200"},
  in_review:   {label:"In Review",   dot:"bg-amber-400",    bg:"bg-amber-50",     text:"text-amber-700",    border:"border-amber-200"},
  done:        {label:"Done",        dot:"bg-emerald-500",  bg:"bg-emerald-50",   text:"text-emerald-700",  border:"border-emerald-200"},
  blocked:     {label:"Blocked",     dot:"bg-red-500",      bg:"bg-red-50",       text:"text-red-700",      border:"border-red-200"},
};
const PRIORITY_CFG: Record<IssuePriority,{label:string;dot:string;text:string}> = {
  urgent:{label:"Urgent",dot:"bg-red-500",    text:"text-red-600"},
  high:  {label:"High",  dot:"bg-orange-400", text:"text-orange-600"},
  medium:{label:"Medium",dot:"bg-yellow-400", text:"text-yellow-600"},
  low:   {label:"Low",   dot:"bg-sky-400",    text:"text-sky-600"},
};
const TYPE_CFG: Record<IssueType,{icon:string;color:string}> = {
  bug:    {icon:"⬤",color:"text-red-400"},
  feature:{icon:"◆",color:"text-indigo-400"},
  task:   {icon:"◻",color:"text-sky-400"},
  chore:  {icon:"⚙",color:"text-neutral-400"},
};

// ══════════════════════════════════════════════════════════════
//  PRIMITIVES
// ══════════════════════════════════════════════════════════════

function Av({id,size="sm"}:{id:string;size?:"xs"|"sm"|"md"|"lg"}) {
  const m = teamById[id]; if(!m) return null;
  const cls = size==="xs"?"w-5 h-5 text-[9px]":size==="sm"?"w-7 h-7 text-xs":size==="md"?"w-9 h-9 text-sm":"w-11 h-11 text-base";
  return (
    <div className="relative inline-flex shrink-0">
      <span className={`inline-flex items-center justify-center rounded-full font-bold text-white ${cls}`} style={{background:m.color}}>{m.initials}</span>
      {m.online && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border-2 border-white rounded-full"/>}
    </div>
  );
}

function StatusBadge({status}:{status:IssueStatus}) {
  const c = STATUS_CFG[status];
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${c.bg} ${c.text} ${c.border}`}><span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>{c.label}</span>;
}

function PriorityBadge({p}:{p:IssuePriority}) {
  const c = PRIORITY_CFG[p];
  return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${c.text}`}><span className={`w-2 h-2 rounded-sm ${c.dot}`}/>{c.label}</span>;
}

function TypeIcon({t}:{t:IssueType}) {
  const c = TYPE_CFG[t]; return <span className={`text-xs ${c.color}`}>{c.icon}</span>;
}

function Label({text}:{text:string}) {
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">{text}</span>;
}

// ══════════════════════════════════════════════════════════════
//  NOTIFICATIONS DATA (role-filtered)
// ══════════════════════════════════════════════════════════════

type Notif = {id:number;role:string[];icon:string;title:string;detail:string;time:string;read:boolean;key?:string;actionable?:boolean};
const ALL_NOTIFS: Notif[] = [
  {id:1, role:["developer","pm"],       icon:"💬", title:"Alex Chen mentioned you",          detail:"@Matt — sharing Redis env vars via 1Password. Check Forge Staging vault.",              time:"2h ago",   read:false, key:"FORGE-45", actionable:true},
  {id:2, role:["developer","pm","collaborator"], icon:"💡", title:"New decision on FORGE-45", detail:"Matt posted: Use Upstash Redis with @upstash/ratelimit. Feature flag defaults OFF.",  time:"2d ago",   read:false, key:"FORGE-45", actionable:false},
  {id:3, role:["developer"],            icon:"📌", title:"FORGE-52 assigned to you",          detail:"Jordan Lee assigned SEC-05: Make IMPERSONATION_SECRET mandatory.",                     time:"1d ago",   read:false, key:"FORGE-52", actionable:true},
  {id:4, role:["pm"],                   icon:"🏃", title:"Sprint 6 is 68% complete",          detail:"4 days left. 2 issues blocked, 3 in review. FORGE-45 is on the critical path.",       time:"6h ago",   read:true,  actionable:false},
  {id:5, role:["collaborator","pm"],    icon:"💬", title:"Jordan Lee mentioned you",           detail:"@Dana — can you do a QA pass on WEB-204 before we ship to prod?",                    time:"1h ago",   read:false, key:"WEB-204",  actionable:true},
  {id:6, role:["developer","pm"],       icon:"✅", title:"INFRA-15 moved to In Progress",     detail:"Alex Chen started provisioning Upstash Redis. FORGE-45 unblock expected today.",      time:"30m ago",  read:false, key:"INFRA-15", actionable:false},
  {id:7, role:["admin"],                icon:"🔒", title:"New member joined workspace",        detail:"Dana Walsh accepted the invite and joined as QA Engineer.",                           time:"3h ago",   read:false, actionable:true},
  {id:8, role:["admin"],                icon:"⚠️", title:"Security: 3 issues flagged",        detail:"Think Tank Security Hardening has 3 open issues. FORGE-45 blocked 5 days.",           time:"1d ago",   read:false, actionable:true},
  {id:9, role:["collaborator"],         icon:"👀", title:"WEB-198 needs your review",          detail:"Sarah Kim finished dark mode pass. Marked in_review — your sign-off is needed.",      time:"4h ago",   read:false, key:"WEB-198",  actionable:true},
  {id:10,role:["pm","admin"],           icon:"📊", title:"Sprint close approaching",           detail:"Sprint 6 closes Friday. 2 items have no recent activity — consider reassigning.",     time:"5h ago",   read:true,  actionable:false},
];

// ══════════════════════════════════════════════════════════════
//  COMMAND PALETTE
// ══════════════════════════════════════════════════════════════

function CommandPalette({open,onClose,role}:{open:boolean;onClose:()=>void;role:string}) {
  const [q,setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(()=>{ if(open){ setQ(""); setTimeout(()=>ref.current?.focus(),50); } },[open]);
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==="Escape") onClose(); if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();} };
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h);
  },[onClose]);
  if(!open) return null;

  const actions:{icon:string;label:string;shortcut:string;roles:string[]}[] = [
    {icon:"➕",label:"Create new issue",    shortcut:"C",   roles:["developer","pm","collaborator","admin"]},
    {icon:"📋",label:"My issues",           shortcut:"M",   roles:["developer","collaborator"]},
    {icon:"🏃",label:"Sprint board",        shortcut:"S B", roles:["developer","pm"]},
    {icon:"💡",label:"New Think Tank idea", shortcut:"T",   roles:["pm","developer"]},
    {icon:"📊",label:"Sprint health",       shortcut:"S H", roles:["pm","admin"]},
    {icon:"👥",label:"Team members",        shortcut:"⌥M",  roles:["admin","pm"]},
    {icon:"⚙️",label:"Workspace settings", shortcut:"⌥S",  roles:["admin"]},
    {icon:"🗺️",label:"Roadmap view",       shortcut:"R",   roles:["pm"]},
  ].filter(a=>a.roles.includes(role));

  const filtered = q ? ALL_ISSUES.filter(i=>i.title.toLowerCase().includes(q.toLowerCase())||i.key.toLowerCase().includes(q.toLowerCase())).slice(0,5) : ALL_ISSUES.slice(0,4);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24" onClick={onClose}>
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"/>
      <div className="relative w-full max-w-[600px] bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-100">
          <span className="text-neutral-400">🔍</span>
          <input ref={ref} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search issues, jump to view, run action..." className="flex-1 text-sm text-neutral-900 placeholder-neutral-400 outline-none bg-transparent"/>
          <kbd className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-[11px] text-neutral-500 font-mono cursor-pointer" onClick={onClose}>Esc</kbd>
        </div>
        {!q && (
          <div className="px-3 py-2 border-b border-neutral-50">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 px-2 mb-1.5">Quick Actions</div>
            {actions.map((a,i)=>(
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-100 cursor-pointer transition ${i===0?"bg-indigo-50":""}`}>
                <span>{a.icon}</span>
                <span className="text-sm text-neutral-800 flex-1">{a.label}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[10px] font-mono text-neutral-500">{a.shortcut}</kbd>
              </div>
            ))}
          </div>
        )}
        <div className="px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 px-2 mb-1.5">{q?`Results for "${q}"`:"Recent Issues"}</div>
          {filtered.map((issue,i)=>(
            <div key={issue.id} onClick={onClose} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-100 cursor-pointer transition ${i===0&&q?"bg-indigo-50":""}`}>
              <TypeIcon t={issue.type}/>
              <span className="text-[11px] font-mono text-neutral-400 w-[76px] shrink-0">{issue.key}</span>
              <span className="text-sm text-neutral-800 flex-1 truncate">{issue.title}</span>
              <StatusBadge status={issue.status}/>
            </div>
          ))}
          {q && filtered.length===0 && <div className="px-3 py-4 text-sm text-neutral-400 text-center">No results for "{q}"</div>}
        </div>
        <div className="px-4 py-2 border-t border-neutral-100 flex gap-5 text-[10px] text-neutral-400 bg-neutral-50">
          <span><kbd className="px-1 py-0.5 rounded border border-neutral-200 bg-white text-neutral-500 font-mono text-[10px]">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 rounded border border-neutral-200 bg-white text-neutral-500 font-mono text-[10px]">↵</kbd> Select</span>
          <span><kbd className="px-1 py-0.5 rounded border border-neutral-200 bg-white text-neutral-500 font-mono text-[10px]">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  NOTIFICATION SLIDE-IN
// ══════════════════════════════════════════════════════════════

function NotificationPanel({open,onClose,role}:{open:boolean;onClose:()=>void;role:string}) {
  const mine = ALL_NOTIFS.filter(n=>n.role.includes(role));
  const [read,setRead] = useState<Set<number>>(new Set(mine.filter(n=>n.read).map(n=>n.id)));
  const unread = mine.filter(n=>!read.has(n.id)).length;
  const markAll = ()=>setRead(new Set(mine.map(n=>n.id)));

  return (
    <>
      {open && <div className="fixed inset-0 z-[60]" onClick={onClose}/>}
      <div className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl border-l border-neutral-200 z-[70] flex flex-col transition-transform duration-300 ${open?"translate-x-0":"translate-x-full"}`}>
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <div>
            <div className="text-sm font-bold text-neutral-900 flex items-center gap-2">Notifications {unread>0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{unread}</span>}</div>
            <div className="text-[11px] text-neutral-400 mt-0.5">{unread} unread</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={markAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Mark all read</button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition text-sm">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-50">
          {mine.map(n=>(
            <div key={n.id} onClick={()=>setRead(r=>new Set([...r,n.id]))}
              className={`px-5 py-4 hover:bg-neutral-50 transition cursor-pointer flex gap-3 ${!read.has(n.id)?"bg-indigo-50/40":""}`}>
              <div className="w-9 h-9 rounded-full bg-white border border-neutral-100 flex items-center justify-center text-base shrink-0 shadow-sm">{n.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-800 leading-snug">{n.title}</span>
                  {!read.has(n.id) && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1"/>}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{n.detail}</div>
                <div className="flex items-center gap-3 mt-1.5">
                  {n.key && <span className="text-[10px] text-neutral-400 font-mono">{n.key}</span>}
                  <span className="text-[10px] text-neutral-400">{n.time}</span>
                  {n.actionable && <button className="ml-auto text-[10px] px-2 py-0.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition" onClick={e=>{e.stopPropagation();onClose();}}>View</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
//  THINK TANK MODAL
// ══════════════════════════════════════════════════════════════

function ThinkTankModal({ideaName,onClose}:{ideaName:string;onClose:()=>void}) {
  const timeline = [
    {icon:"💡",label:"Idea Submitted",   date:"Jun 7",  by:"u1", note:"\"Our rate limiter is in-memory and resets on every deploy. Multi-pod prod = security theater.\"",  color:"bg-violet-500"},
    {icon:"👍",label:"Team Vote",         date:"Jun 8",  by:null, note:"4 of 6 team members agreed. Alex: \"Confirmed — hit this bug in staging.\" Casey: \"Should be infra, not app-level.\"", color:"bg-indigo-500"},
    {icon:"✅",label:"Founder Sign-off",  date:"Jun 9",  by:"u1", note:"\"Approve. This is a production risk — prioritize above new features. Fix before public beta.\"",  color:"bg-emerald-500"},
    {icon:"📋",label:"Promoted to Project",date:"Jun 10",by:"u4", note:"Jordan created \"Security Hardening Sprint\" and scoped 3 issues from this idea.",                  color:"bg-amber-500"},
    {icon:"🎯",label:"Issues Created",    date:"Jun 10", by:"u4", note:"FORGE-45 · INFRA-15 · FORGE-52 — all linked to this Think Tank decision.",                         color:"bg-sky-500"},
    {icon:"🏃",label:"Sprint 6 Started",  date:"Jun 14", by:null, note:"All 3 issues entered Sprint 6. INFRA-15 is the dependency chain root.",                              color:"bg-neutral-400"},
  ];

  const linkedIssues = ALL_ISSUES.filter(i=>i.thinkTank===ideaName);

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-neutral-900/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="fixed inset-y-0 right-0 w-[560px] bg-white z-[85] shadow-2xl border-l border-neutral-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-3 shrink-0 bg-violet-50">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white text-lg shrink-0">💡</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-0.5">Think Tank · Origin Idea</div>
            <div className="text-sm font-bold text-violet-900 truncate">{ideaName}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white border border-violet-200 flex items-center justify-center text-violet-500 hover:bg-violet-100 transition text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* What is Think Tank — one liner */}
          <div className="text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2 border border-neutral-200">
            Think Tank is where every piece of work begins. Ideas are submitted, voted on, and signed off — then promoted into projects and issues. This is the <strong className="text-neutral-700">why</strong> behind every ticket in Forge.
          </div>

          {/* Provenance timeline */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Provenance Timeline</div>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-neutral-200"/>
              <div className="space-y-4">
                {timeline.map((t,i)=>(
                  <div key={i} className="flex gap-4 relative">
                    <div className={`w-8 h-8 rounded-full ${t.color} flex items-center justify-center text-white text-sm shrink-0 z-10 shadow-sm`}>{t.icon}</div>
                    <div className="flex-1 pt-0.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-neutral-800">{t.label}</span>
                        <span className="text-[10px] text-neutral-400">{t.date}</span>
                        {t.by && <Av id={t.by} size="xs"/>}
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed bg-white border border-neutral-100 rounded-lg px-3 py-2">{t.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Linked issues */}
          {linkedIssues.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Issues Spawned from This Idea</div>
              <div className="space-y-1.5">
                {linkedIssues.map(iss=>(
                  <div key={iss.id} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-neutral-200 rounded-lg hover:border-violet-300 transition cursor-pointer">
                    <TypeIcon t={iss.type}/>
                    <span className="text-[11px] font-mono text-neutral-400 w-[76px] shrink-0">{iss.key}</span>
                    <span className="text-xs text-neutral-800 flex-1 truncate">{iss.title}</span>
                    <StatusBadge status={iss.status}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Forge advantage callout */}
          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
            <div className="text-xs font-bold text-emerald-800 mb-1">✅ Only Forge Has This</div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              In Linear, Jira, GitHub Issues — you can see <em>what</em> a ticket is. In Forge, you see <em>why</em> it exists, who decided it, and what was debated before a line of code was written. This is the full provenance chain — from raw idea to shipped code.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
//  THINK TANK VIEW (standalone pipeline view)
// ══════════════════════════════════════════════════════════════

function ThinkTankView() {
  const [stage,setStage] = useState("all");
  const [selectedIdea,setSelectedIdea] = useState<string|null>(null);

  const ideas = [
    {id:"tt1",title:"Security Hardening Initiative — Rate Limiting",  submitter:"u1",votes:4,stage:"in_sprint",  sprint:"Sprint 6",issues:3, summary:"In-memory rate limiter is security theater in multi-pod prod.",                            date:"Jun 7"},
    {id:"tt2",title:"Billing Hardening — Stripe Webhook Retry",       submitter:"u4",votes:5,stage:"in_sprint",  sprint:"Sprint 6",issues:1, summary:"Webhooks fail transiently with no retry. Billing events lost silently.",                   date:"Jun 5"},
    {id:"tt3",title:"Advisor Calendar Integration for Travli",         submitter:"u3",votes:3,stage:"approved",   sprint:null,      issues:0, summary:"Advisors can't connect calendars. Travelers can't self-book — all calls are manual.",     date:"Jun 12"},
    {id:"tt4",title:"Cruise Itinerary Port-Stop Markers on Map",       submitter:"u4",votes:2,stage:"approved",   sprint:null,      issues:0, summary:"Port stops show as a plain list. Visual map markers would 10x discoverability.",          date:"Jun 10"},
    {id:"tt5",title:"Morning Digest — AI Daily Brief for Developers",  submitter:"u2",votes:6,stage:"voting",     sprint:null,      issues:0, summary:"No daily summary. Devs must manually check what changed — Linear Pulse already does this.",date:"Jun 18"},
    {id:"tt6",title:"Command Palette (⌘K) for Keyboard-First Nav",     submitter:"u1",votes:5,stage:"voting",     sprint:null,      issues:0, summary:"No keyboard shortcuts. Competitor table-stakes — every dev tool has ⌘K.",               date:"Jun 17"},
    {id:"tt7",title:"Notification Center — Bell + Inbox Model",        submitter:"u4",votes:4,stage:"voting",     sprint:null,      issues:0, summary:"No bell icon, no notification center. Urgent issues go unseen until user opens Forge.",   date:"Jun 16"},
    {id:"tt8",title:"Dark Mode Theming System",                        submitter:"u3",votes:3,stage:"new",        sprint:null,      issues:0, summary:"No dark mode. Sarah flagged 12 component gaps. Essential for developer tools.",           date:"Jun 19"},
    {id:"tt9",title:"Guest / Stakeholder View for Execs",             submitter:"u4",votes:2,stage:"new",        sprint:null,      issues:0, summary:"Non-technical stakeholders can't follow project health without learning Forge.",          date:"Jun 20"},
  ];

  const stages = [
    {id:"all",     label:"All Ideas",   color:"text-neutral-600"},
    {id:"new",     label:"New",         color:"text-sky-600"},
    {id:"voting",  label:"Voting",      color:"text-amber-600"},
    {id:"approved",label:"Approved",    color:"text-indigo-600"},
    {id:"in_sprint",label:"In Sprint",  color:"text-emerald-600"},
  ];

  const stageCfg: Record<string,{label:string;dot:string;bg:string;text:string;border:string}> = {
    new:      {label:"New",       dot:"bg-sky-400",     bg:"bg-sky-50",     text:"text-sky-700",     border:"border-sky-200"},
    voting:   {label:"Voting",    dot:"bg-amber-400",   bg:"bg-amber-50",   text:"text-amber-700",   border:"border-amber-200"},
    approved: {label:"Approved",  dot:"bg-indigo-500",  bg:"bg-indigo-50",  text:"text-indigo-700",  border:"border-indigo-200"},
    in_sprint:{label:"In Sprint", dot:"bg-emerald-500", bg:"bg-emerald-50", text:"text-emerald-700", border:"border-emerald-200"},
  };

  const visible = stage === "all" ? ideas : ideas.filter(i=>i.stage===stage);

  return (
    <div className="p-4 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">💡 Think Tank</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Where every feature begins — ideas, votes, decisions, provenance</p>
        </div>
        <button className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition">+ Submit Idea</button>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          {label:"New",       count:2, color:"bg-sky-500"},
          {label:"Voting",    count:3, color:"bg-amber-500"},
          {label:"Approved",  count:2, color:"bg-indigo-500"},
          {label:"In Sprint", count:2, color:"bg-emerald-500"},
        ].map(s=>(
          <div key={s.label} className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
            <div className={`text-2xl font-bold text-neutral-900`}>{s.count}</div>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${s.color}`}/>
              <span className="text-xs text-neutral-500">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-3">
        {stages.map(s=>(
          <button key={s.id} onClick={()=>setStage(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${stage===s.id?"bg-neutral-900 text-white border-neutral-900":"bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Ideas list */}
      <div className="space-y-2">
        {visible.map(idea=>{
          const sc = stageCfg[idea.stage];
          return (
            <div key={idea.id} onClick={()=>setSelectedIdea(idea.id===selectedIdea?null:idea.id)}
              className={`bg-white rounded-xl border hover:border-violet-300 transition cursor-pointer overflow-hidden ${idea.id===selectedIdea?"border-violet-400 shadow-sm":"border-neutral-200"}`}>
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 text-lg shrink-0 mt-0.5">💡</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-neutral-900 flex-1 min-w-0 leading-snug">{idea.title}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${sc.bg} ${sc.text} ${sc.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{idea.summary}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Av id={idea.submitter} size="xs"/>
                    <span className="text-[10px] text-neutral-400">{idea.date}</span>
                    <span className="text-[10px] text-neutral-500">👍 {idea.votes} votes</span>
                    {idea.issues>0 && <span className="text-[10px] text-neutral-500">🎯 {idea.issues} issues</span>}
                    {idea.sprint && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">{idea.sprint}</span>}
                  </div>
                </div>
              </div>
              {idea.id===selectedIdea && (
                <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50 flex gap-2">
                  <button className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition">View Full Provenance</button>
                  {idea.stage==="voting" && <button className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition">👍 Vote ({idea.votes})</button>}
                  {idea.stage==="voting" && <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition">✅ Sign Off</button>}
                  {idea.stage==="approved" && <button className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition">→ Promote to Project</button>}
                  <button className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition">💬 Discuss</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedIdea && (
        <ThinkTankModal ideaName={ideas.find(i=>i.id===selectedIdea)?.title||""} onClose={()=>setSelectedIdea(null)}/>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ISSUE DETAIL PANEL — two-column layout
// ══════════════════════════════════════════════════════════════

type CommentT = {id:number;author:string;type:"comment"|"decision"|"activity";text:string;time:string;reactions:{emoji:string;count:number;mine?:boolean}[]};

function IssueDetail({issue,onClose,role}:{issue:Issue;onClose:()=>void;role:string}) {
  const [status,setStatus]         = useState<IssueStatus>(issue.status);
  const [priority,setPriority]     = useState<IssuePriority>(issue.priority);
  const [statusOpen,setStatusOpen]     = useState(false);
  const [priorityOpen,setPriorityOpen] = useState(false);
  const [watching,setWatching]     = useState(false);
  const [draft,setDraft]           = useState("");
  const [postAs,setPostAs]         = useState<"comment"|"decision">("comment");
  const [ttOpen,setTtOpen]         = useState(false);
  const canDecide = role==="developer"||role==="pm";

  const [comments,setComments] = useState<CommentT[]>([
    {id:1,author:"u4",type:"comment",  text:"Is there a rollback plan if this breaks the auth flow? We had an incident last quarter where a rate-limit bug took down logins for 20 minutes.", time:"3 days ago", reactions:[{emoji:"👍",count:3,mine:true},{emoji:"🎯",count:1}]},
    {id:2,author:"u2",type:"comment",  text:"Good point — adding feature flag `RATE_LIMITER_ENABLED` so we can disable instantly. Flag defaults OFF in prod until we verify.",                time:"3 days ago", reactions:[{emoji:"💯",count:2}]},
    {id:3,author:"u1",type:"decision", text:"Decision: Use Upstash Redis + @upstash/ratelimit SDK. Flag defaults OFF in prod until verified. INFRA-15 is the dependency — will unblock as soon as Alex provisions.", time:"2 days ago", reactions:[{emoji:"✅",count:4,mine:true}]},
    {id:4,author:"u5",type:"activity", text:"Casey changed status from Todo → Blocked · waiting on INFRA-15",  time:"1 day ago", reactions:[]},
    {id:5,author:"u2",type:"comment",  text:"Update: INFRA-15 is now In Progress. I've provisioned the test cluster in staging. Sharing env vars via 1Password — check the Forge Staging vault.", time:"2h ago", reactions:[{emoji:"🚀",count:2}]},
  ]);

  const [reacted,setReacted] = useState<Record<number,Record<string,boolean>>>(
    Object.fromEntries(comments.map(c=>[c.id, Object.fromEntries(c.reactions.map(r=>[r.emoji,r.mine??false]))]))
  );

  const postComment = () => {
    if(!draft.trim()) return;
    setComments(prev=>[...prev,{id:prev.length+1,author:"u1",type:postAs,text:draft,time:"just now",reactions:[]}]);
    setDraft("");
  };

  const sc = STATUS_CFG[status];
  const pc = PRIORITY_CFG[priority];

  return (
    <>
      <div className="fixed inset-0 z-[50] bg-neutral-900/20" onClick={onClose}/>
      {/* Panel — wider for two-column layout */}
      <div className="fixed top-0 right-0 h-full w-[860px] bg-white shadow-2xl border-l border-neutral-200 z-[55] flex flex-col overflow-hidden">

        {/* ── Top bar ── */}
        <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-3 shrink-0 bg-white">
          <TypeIcon t={issue.type}/>
          <span className="text-xs font-mono text-neutral-400 font-semibold">{issue.key}</span>
          <span className="text-neutral-200">·</span>
          <span className="text-xs text-neutral-400">{issue.projectName}</span>
          <div className="flex-1"/>
          <button onClick={()=>setWatching(w=>!w)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${watching?"bg-indigo-50 border-indigo-200 text-indigo-700":"bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}>
            👁 {watching?"Watching":"Watch"}
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition text-sm">✕</button>
        </div>

        {/* ── Two-column body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — title, description, discussion */}
          <div className="flex-1 overflow-y-auto border-r border-neutral-100">

            {/* Title */}
            <div className="px-6 pt-5 pb-4 border-b border-neutral-100">
              <h2 className="text-xl font-bold text-neutral-900 leading-snug">{issue.title}</h2>

              {/* Blocker alert — inline, prominent */}
              {issue.blockedBy && (
                <div className="mt-3 flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  <span className="text-base">⛔</span>
                  <div>
                    <div className="text-xs font-bold text-red-700">Blocked</div>
                    <div className="text-xs text-red-600">Waiting on <span className="font-mono font-semibold">{issue.blockedBy}</span> — {ALL_ISSUES.find(i=>i.key===issue.blockedBy)?.title}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="px-6 py-4 border-b border-neutral-100">
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Description</div>
              <p className="text-sm text-neutral-700 leading-relaxed">{issue.description}</p>
              {issue.prRef && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5">
                  <span className="text-neutral-400">🔗</span>
                  <span className="font-mono text-neutral-700">{issue.prRef}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-semibold">Draft</span>
                </div>
              )}
            </div>

            {/* Discussion */}
            <div className="px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4">
                Discussion <span className="text-neutral-300 font-normal ml-1">({comments.length})</span>
              </div>

              <div className="space-y-5">
                {comments.map(c=>(
                  <div key={c.id} className="flex gap-3">
                    {c.type==="activity"
                      ? <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs shrink-0 mt-0.5 text-neutral-400">⚡</div>
                      : <Av id={c.author} size="sm"/>}
                    <div className="flex-1 min-w-0">
                      {c.type==="activity" ? (
                        <p className="text-xs text-neutral-400 italic pt-1.5">{c.text}</p>
                      ) : (
                        <div className={`rounded-xl border px-4 py-3 ${c.type==="decision"?"bg-violet-50 border-violet-200":"bg-neutral-50 border-neutral-200"}`}>
                          {/* Comment header */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-neutral-900">{teamById[c.author]?.name}</span>
                            {c.type==="decision" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold border border-violet-200">💡 Decision</span>
                            )}
                            <span className="text-[10px] text-neutral-400 ml-auto">{c.time}</span>
                          </div>
                          {/* Comment body */}
                          <p className="text-sm text-neutral-700 leading-relaxed">{c.text}</p>
                          {/* Reactions */}
                          {c.reactions.length>0 && (
                            <div className="flex gap-1.5 flex-wrap mt-2.5 pt-2.5 border-t border-neutral-200/60">
                              {c.reactions.map(r=>(
                                <button key={r.emoji}
                                  onClick={()=>setReacted(prev=>({...prev,[c.id]:{...prev[c.id],[r.emoji]:!prev[c.id]?.[r.emoji]}}))}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition ${reacted[c.id]?.[r.emoji]?"bg-indigo-50 border-indigo-300 text-indigo-700":"bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}>
                                  {r.emoji} <span className="font-medium">{r.count+(reacted[c.id]?.[r.emoji]&&!r.mine?1:!reacted[c.id]?.[r.emoji]&&r.mine?-1:0)}</span>
                                </button>
                              ))}
                              <button className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-neutral-300 text-neutral-400 hover:border-neutral-400 transition">+ React</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Compose */}
              <div className="mt-5 pt-4 border-t border-neutral-100">
                <div className="flex gap-3">
                  <Av id="u1" size="sm"/>
                  <div className="flex-1">
                    <textarea value={draft} onChange={e=>setDraft(e.target.value)}
                      placeholder={canDecide?"Add a comment or post a decision… @mention to notify someone":"Add a comment… @mention to notify someone"}
                      className="w-full text-sm border border-neutral-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition bg-neutral-50 focus:bg-white" rows={3}/>
                    <div className="flex items-center gap-2 mt-2">
                      {canDecide && (
                        <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden text-xs">
                          <button onClick={()=>setPostAs("comment")} className={`px-3 py-1.5 font-medium transition ${postAs==="comment"?"bg-neutral-900 text-white":"text-neutral-600 hover:bg-neutral-50"}`}>💬 Comment</button>
                          <button onClick={()=>setPostAs("decision")} className={`px-3 py-1.5 font-medium transition ${postAs==="decision"?"bg-violet-600 text-white":"text-neutral-600 hover:bg-neutral-50"}`}>💡 Decision</button>
                        </div>
                      )}
                      <button onClick={postComment} className="ml-auto px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition">Post</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — metadata sidebar */}
          <div className="w-[240px] shrink-0 overflow-y-auto bg-neutral-50 p-4 space-y-4">

            {/* Status */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Status</div>
              <div className="relative">
                <button onClick={()=>{setStatusOpen(o=>!o);setPriorityOpen(false);}}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer hover:opacity-80 transition ${sc.bg} ${sc.text} ${sc.border}`}>
                  <span className={`w-2 h-2 rounded-full ${sc.dot}`}/>{sc.label}<span className="ml-auto opacity-50">▾</span>
                </button>
                {statusOpen && (
                  <div className="absolute top-10 left-0 right-0 z-20 bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden">
                    {(Object.keys(STATUS_CFG) as IssueStatus[]).map(s=>(
                      <button key={s} onClick={()=>{setStatus(s);setStatusOpen(false);}}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-neutral-50 transition ${s===status?"font-bold bg-neutral-50":""}`}>
                        <span className={`w-2 h-2 rounded-full ${STATUS_CFG[s].dot}`}/>{STATUS_CFG[s].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Priority */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Priority</div>
              <div className="relative">
                <button onClick={()=>{setPriorityOpen(o=>!o);setStatusOpen(false);}}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-white text-xs font-semibold cursor-pointer hover:bg-neutral-50 transition ${pc.text}`}>
                  <span className={`w-2.5 h-2.5 rounded-sm ${pc.dot}`}/>{pc.label}<span className="ml-auto opacity-40">▾</span>
                </button>
                {priorityOpen && (
                  <div className="absolute top-10 left-0 right-0 z-20 bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden">
                    {(Object.keys(PRIORITY_CFG) as IssuePriority[]).map(p=>(
                      <button key={p} onClick={()=>{setPriority(p);setPriorityOpen(false);}}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-neutral-50 transition ${p===priority?"font-bold bg-neutral-50":""}`}>
                        <span className={`w-2.5 h-2.5 rounded-sm ${PRIORITY_CFG[p].dot}`}/>{PRIORITY_CFG[p].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Assignee */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Assignee</div>
              {issue.assigneeId ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-lg">
                  <Av id={issue.assigneeId} size="xs"/>
                  <span className="text-xs font-medium text-neutral-800">{teamById[issue.assigneeId]?.name}</span>
                </div>
              ) : (
                <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-400 hover:border-neutral-400 transition">
                  + Assign someone
                </button>
              )}
            </div>

            {/* Sprint + Estimate */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Sprint</div>
                <div className="px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 font-medium">{issue.sprint||"—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Estimate</div>
                <div className="px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 font-medium">{issue.estimate ? `${issue.estimate}h` : "—"}</div>
              </div>
            </div>

            {/* Labels */}
            {issue.labels.length>0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Labels</div>
                <div className="flex flex-wrap gap-1">
                  {issue.labels.map(l=><Label key={l} text={l}/>)}
                </div>
              </div>
            )}

            {/* Watchers */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Watching</div>
              <div className="flex gap-1 flex-wrap">
                {["u1","u4","u2"].map(id=><Av key={id} id={id} size="xs"/>)}
                <button onClick={()=>setWatching(w=>!w)}
                  className={`w-5 h-5 rounded-full border text-[9px] flex items-center justify-center transition ${watching?"bg-indigo-50 border-indigo-300 text-indigo-600":"border-dashed border-neutral-300 text-neutral-400 hover:border-neutral-400"}`}>
                  {watching?"✓":"+"}
                </button>
              </div>
            </div>

            {/* Think Tank provenance — PROMINENT CARD */}
            {issue.thinkTank && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Origin · Think Tank</div>
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-base shrink-0">💡</span>
                    <span className="text-xs font-semibold text-violet-900 leading-snug">{issue.thinkTank}</span>
                  </div>
                  <div className="text-[10px] text-violet-600 mb-1">Signed off · Matt Giblin · Jun 9</div>
                  <div className="text-[10px] text-violet-600 mb-3">4 votes · 3 issues spawned</div>
                  <button onClick={()=>setTtOpen(true)}
                    className="w-full py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 transition text-center">
                    View Full Provenance →
                  </button>
                </div>
              </div>
            )}

            {/* Created / updated */}
            <div className="pt-2 border-t border-neutral-200">
              <div className="text-[10px] text-neutral-400 space-y-1">
                <div className="flex justify-between"><span>Created</span><span>{issue.daysOld}d ago</span></div>
                <div className="flex justify-between"><span>Updated</span><span>2h ago</span></div>
                <div className="flex justify-between"><span>Comments</span><span>{comments.length}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Think Tank drill-down */}
      {ttOpen && issue.thinkTank && <ThinkTankModal ideaName={issue.thinkTank} onClose={()=>setTtOpen(false)}/>}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
//  DEVELOPER SHELL
// ══════════════════════════════════════════════════════════════

function DeveloperShell({onCmdK}:{onCmdK:()=>void}) {
  const [view,setView] = useState("morning");
  const [activeIssue,setActiveIssue] = useState<Issue|null>(null);
  const [pickedId,setPickedId] = useState<string|null>(null);

  const myIssues = ALL_ISSUES.filter(i=>i.assigneeId==="u1");
  const sprintIssues = ALL_ISSUES.filter(i=>i.sprint==="Sprint 6");
  const digest = [
    {icon:"🚀",text:"Sprint 6 is 68% complete — on track for Friday close"},
    {icon:"🔴",text:"FORGE-45 has been blocked for 5 days. INFRA-15 just moved to In Progress — unblock expected today"},
    {icon:"💬",text:"3 issues have unread comments that mention you"},
    {icon:"⚡",text:"Casey merged PR #91 — MOB-23 Android push deep-links fixed"},
  ];

  const navItems = [
    {id:"morning",    icon:"🌅", label:"Morning"},
    {id:"myissues",   icon:"📋", label:"My Issues"},
    {id:"inbox",      icon:"📥", label:"Inbox"},
    {id:"board",      icon:"🏃", label:"Sprint Board"},
    {id:"thinktank",  icon:"💡", label:"Think Tank"},
  ];

  // Board columns state
  const [boardStatuses,setBoardStatuses] = useState<Record<string,IssueStatus>>(
    Object.fromEntries(sprintIssues.map(i=>[i.id,i.status]))
  );
  const cols: {status:IssueStatus;label:string}[] = [
    {status:"todo",label:"Todo"},
    {status:"in_progress",label:"In Progress"},
    {status:"in_review",label:"In Review"},
    {status:"done",label:"Done"},
  ];

  return (
    <div className="flex h-[calc(100vh-112px)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-52 shrink-0 bg-white border-r border-neutral-200 flex flex-col">
        <div className="px-3 py-3 border-b border-neutral-100">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Developer</div>
          <div className="flex items-center gap-2 mt-2">
            <Av id="u1" size="sm"/>
            <div>
              <div className="text-xs font-semibold text-neutral-900">Matt Giblin</div>
              <div className="text-[10px] text-neutral-400">Lead Developer</div>
            </div>
          </div>
        </div>
        <nav className="p-2 flex-1">
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition mb-0.5 text-left ${view===n.id?"bg-neutral-900 text-white":"text-neutral-600 hover:bg-neutral-100"}`}>
              <span>{n.icon}</span>{n.label}
              {n.id==="inbox" && <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5">3</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-neutral-100">
          <button onClick={onCmdK} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 transition">
            <span>🔍</span><span className="flex-1 text-left">Search</span><kbd className="text-[10px] font-mono bg-neutral-100 border border-neutral-200 px-1 rounded">⌘K</kbd>
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto bg-neutral-50 p-4">
        {/* MORNING VIEW */}
        {view==="morning" && (
          <div className="space-y-4 max-w-[1100px]">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">Good morning, Matt 👋</h1>
                <p className="text-sm text-neutral-500">Saturday, June 21 · Here's your day</p>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1.4fr] gap-4">
              {/* Left column */}
              <div className="space-y-3">
                {/* AI Digest */}
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">✨</span>
                    <div className="text-sm font-semibold text-neutral-900">AI Digest</div>
                    <span className="text-[10px] text-neutral-400 ml-auto">Updated 6:00am</span>
                  </div>
                  <div className="space-y-2">
                    {digest.map((d,i)=>(
                      <div key={i} className="flex gap-2 items-start text-sm">
                        <span className="shrink-0 mt-0.5">{d.icon}</span>
                        <span className="text-neutral-700 leading-snug">{d.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* My Work */}
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                    <div className="text-sm font-semibold text-neutral-900">My Work</div>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{myIssues.length}</span>
                  </div>
                  <div className="divide-y divide-neutral-50">
                    {myIssues.map(issue=>(
                      <div key={issue.id} className="p-3 hover:bg-neutral-50 transition cursor-pointer" onClick={()=>setPickedId(pickedId===issue.id?null:issue.id)}>
                        <div className="flex items-start gap-2">
                          <TypeIcon t={issue.type}/>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-neutral-900 leading-snug truncate">{issue.title}</div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <StatusBadge status={issue.status}/>
                              <PriorityBadge p={issue.priority}/>
                              {issue.status==="blocked" && <span className="text-[10px] text-red-600 font-medium">⛔ {issue.blockedBy}</span>}
                            </div>
                          </div>
                        </div>
                        {pickedId===issue.id && (
                          <div className="mt-2 pt-2 border-t border-neutral-100 flex gap-1.5 flex-wrap">
                            <button onClick={e=>{e.stopPropagation();setActiveIssue(issue);}} className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 transition">Open</button>
                            <button className="px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-600 text-[11px] font-medium hover:bg-neutral-50 transition">Branch</button>
                            <button className="px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-600 text-[11px] font-medium hover:bg-neutral-50 transition">Timer</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Right column */}
              <div className="space-y-3">
                {/* Sprint health */}
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-neutral-900">Sprint 6 Health</div>
                    <span className="text-xs text-neutral-400">Closes Friday · 4 days left</span>
                  </div>
                  <div className="flex gap-4 mb-3">
                    {[{v:"68%",l:"Done",c:"text-emerald-600"},{v:"2",l:"Blocked",c:"text-red-600"},{v:"3",l:"In Review",c:"text-amber-600"}].map(s=>(
                      <div key={s.l} className="text-center"><div className={`text-xl font-bold ${s.c}`}>{s.v}</div><div className="text-[10px] text-neutral-400">{s.l}</div></div>
                    ))}
                  </div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{width:"68%"}}/>
                  </div>
                </div>
                {/* Sprint issues */}
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-100 text-sm font-semibold text-neutral-900">Sprint 6 Issues</div>
                  <div className="divide-y divide-neutral-50">
                    {sprintIssues.map(issue=>(
                      <div key={issue.id} onClick={()=>setActiveIssue(issue)} className="flex items-center gap-2 px-3 py-2.5 hover:bg-neutral-50 transition cursor-pointer">
                        <Av id={issue.assigneeId||"u1"} size="xs"/>
                        <TypeIcon t={issue.type}/>
                        <span className="text-[11px] font-mono text-neutral-400 shrink-0">{issue.key}</span>
                        <span className="text-xs text-neutral-800 flex-1 truncate">{issue.title}</span>
                        <StatusBadge status={issue.status}/>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MY ISSUES VIEW */}
        {view==="myissues" && (
          <div className="max-w-[800px] space-y-2">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-bold text-neutral-900">My Issues</h1>
              <div className="flex gap-2">
                {["All","In Progress","Blocked","Todo"].map(f=>(
                  <button key={f} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${f==="All"?"bg-neutral-900 text-white border-neutral-900":"bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}>{f}</button>
                ))}
              </div>
            </div>
            {myIssues.map(issue=>(
              <div key={issue.id} onClick={()=>setActiveIssue(issue)} className="bg-white rounded-xl border border-neutral-200 px-4 py-3 hover:border-indigo-300 hover:shadow-sm transition cursor-pointer flex items-center gap-3">
                <TypeIcon t={issue.type}/>
                <span className="text-[11px] font-mono text-neutral-400 shrink-0 w-[80px]">{issue.key}</span>
                <span className="text-sm font-medium text-neutral-900 flex-1 truncate">{issue.title}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={issue.status}/>
                  <PriorityBadge p={issue.priority}/>
                  {issue.comments>0 && <span className="text-xs text-neutral-400">💬{issue.comments}</span>}
                </div>
              </div>
            ))}
            <div className="mt-2 opacity-50">
              {ALL_ISSUES.filter(i=>!i.assigneeId).slice(0,3).map(issue=>(
                <div key={issue.id} onClick={()=>setActiveIssue(issue)} className="bg-white rounded-xl border border-dashed border-neutral-200 px-4 py-2.5 hover:border-neutral-300 transition cursor-pointer flex items-center gap-3 mb-2">
                  <TypeIcon t={issue.type}/>
                  <span className="text-[11px] font-mono text-neutral-400 shrink-0 w-[80px]">{issue.key}</span>
                  <span className="text-xs text-neutral-600 flex-1 truncate">{issue.title}</span>
                  <span className="text-[10px] text-neutral-400">Unassigned</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INBOX VIEW */}
        {view==="inbox" && (
          <div className="max-w-[700px] space-y-2">
            <h1 className="text-lg font-bold text-neutral-900 mb-4">Inbox</h1>
            {ALL_NOTIFS.filter(n=>n.role.includes("developer")).map(n=>(
              <div key={n.id} className={`bg-white rounded-xl border px-4 py-3 hover:border-indigo-200 transition cursor-pointer flex gap-3 ${!n.read?"border-indigo-200 bg-indigo-50/20":"border-neutral-200"}`}>
                <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-base shrink-0">{n.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-neutral-800">{n.title}</div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5"/>}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">{n.detail}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {n.key && <span className="text-[10px] font-mono text-neutral-400">{n.key}</span>}
                    <span className="text-[10px] text-neutral-400">{n.time}</span>
                    {n.actionable && <button onClick={()=>{ const iss=ALL_ISSUES.find(i=>i.key===n.key); if(iss) setActiveIssue(iss); }} className="ml-auto text-[10px] px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition">View</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SPRINT BOARD */}
        {view==="board" && (
          <div>
            <h1 className="text-lg font-bold text-neutral-900 mb-4">Sprint 6 Board</h1>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {cols.map(col=>{
                const colIssues = sprintIssues.filter(i=>(boardStatuses[i.id]||i.status)===col.status);
                return (
                  <div key={col.status} className="w-[260px] shrink-0">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className={`w-2 h-2 rounded-full ${STATUS_CFG[col.status].dot}`}/>
                      <span className="text-xs font-semibold text-neutral-700">{col.label}</span>
                      <span className="text-[10px] text-neutral-400 ml-1">{colIssues.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colIssues.map(issue=>(
                        <div key={issue.id} onClick={()=>setActiveIssue(issue)} className="bg-white rounded-xl border border-neutral-200 p-3 hover:border-indigo-300 hover:shadow-sm transition cursor-pointer">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <TypeIcon t={issue.type}/>
                            <span className="text-[10px] font-mono text-neutral-400">{issue.key}</span>
                            <PriorityBadge p={issue.priority}/>
                          </div>
                          <div className="text-xs font-medium text-neutral-900 leading-snug mb-2">{issue.title}</div>
                          <div className="flex items-center justify-between">
                            {issue.assigneeId?<Av id={issue.assigneeId} size="xs"/>:<div/>}
                            {issue.estimate && <span className="text-[10px] text-neutral-400">{issue.estimate}h</span>}
                          </div>
                          {/* Quick move buttons */}
                          <div className="mt-2 pt-2 border-t border-neutral-50 flex gap-1">
                            {cols.filter(c=>c.status!==col.status).slice(0,2).map(c=>(
                              <button key={c.status} onClick={e=>{e.stopPropagation();setBoardStatuses(prev=>({...prev,[issue.id]:c.status}));}}
                                className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition">→ {c.label}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {view==="thinktank" && <ThinkTankView/>}
      </div>

      {activeIssue && <IssueDetail issue={activeIssue} onClose={()=>setActiveIssue(null)} role="developer"/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  PM SHELL
// ══════════════════════════════════════════════════════════════

function PMShell({onCmdK}:{onCmdK:()=>void}) {
  const [view,setView] = useState("morning");
  const [activeIssue,setActiveIssue] = useState<Issue|null>(null);
  const sprintIssues = ALL_ISSUES.filter(i=>i.sprint==="Sprint 6");
  const backlog = ALL_ISSUES.filter(i=>!i.sprint);
  const [sprintSet,setSprintSet] = useState(new Set(sprintIssues.map(i=>i.id)));

  const navItems = [
    {id:"morning",   icon:"📊", label:"Overview"},
    {id:"sprint",    icon:"🏃", label:"Sprint Plan"},
    {id:"board",     icon:"🗂",  label:"Board"},
    {id:"roadmap",   icon:"🗺️", label:"Roadmap"},
    {id:"reports",   icon:"📈", label:"Reports"},
    {id:"thinktank", icon:"💡", label:"Think Tank"},
  ];

  const [boardStatuses,setBoardStatuses] = useState<Record<string,IssueStatus>>(
    Object.fromEntries(sprintIssues.map(i=>[i.id,i.status]))
  );
  const cols: {status:IssueStatus;label:string}[] = [
    {status:"todo",label:"Todo"},{status:"in_progress",label:"In Progress"},{status:"in_review",label:"In Review"},{status:"done",label:"Done"},
  ];

  // ── Roadmap drag state ──
  type RoadmapItem = {name:string;start:number;width:number;color:string;status:string;dependsOn?:number};
  const [roadmap,setRoadmap] = useState<RoadmapItem[]>([
    {name:"Security Hardening Sprint",    start:0,  width:18, color:"bg-red-400",    status:"in_progress"},
    {name:"Billing & Stripe Hardening",   start:12, width:16, color:"bg-amber-400",  status:"in_progress", dependsOn:0},
    {name:"Mobile Push Fix",              start:4,  width:8,  color:"bg-emerald-400",status:"done"},
    {name:"Dark Mode System Pass",        start:8,  width:20, color:"bg-indigo-400", status:"in_progress"},
    {name:"Cruise Itinerary v1",          start:28, width:30, color:"bg-sky-400",    status:"backlog",     dependsOn:3},
    {name:"Advisor Calendar Integration", start:32, width:24, color:"bg-violet-400", status:"backlog"},
  ]);
  const ganttRef = useRef<HTMLDivElement>(null);
  const [dragState,setDragState] = useState<{idx:number;startX:number;origStart:number}|null>(null);
  const [dragPreview,setDragPreview] = useState<Record<number,number>>({});
  const [cascadeConfirm,setCascadeConfirm] = useState<{shift:number;dependents:{idx:number;name:string}[]}|null>(null);

  useEffect(()=>{
    if(!dragState) return;
    const onMove = (e:MouseEvent)=>{
      if(!ganttRef.current) return;
      const trackW = ganttRef.current.getBoundingClientRect().width;
      const pxPerUnit = trackW / 60;
      const deltaUnits = Math.round((e.clientX - dragState.startX) / pxPerUnit);
      const newStart = Math.max(0, Math.min(55, dragState.origStart + deltaUnits));
      setRoadmap(prev=>prev.map((item,i)=>i===dragState.idx?{...item,start:newStart}:item));
      // compute which items depend on this one
      const preview: Record<number,number> = {};
      roadmap.forEach((item,i)=>{ if(item.dependsOn===dragState.idx) preview[i]=deltaUnits; });
      setDragPreview(preview);
    };
    const onUp = ()=>{
      const dependents = roadmap.map((item,i)=>({idx:i,name:item.name,depends:item.dependsOn===dragState.idx})).filter(d=>d.depends);
      const shift = roadmap[dragState.idx].start - dragState.origStart;
      if(dependents.length>0 && shift!==0){
        setCascadeConfirm({shift, dependents: dependents.map(d=>({idx:d.idx,name:d.name}))});
      }
      setDragState(null);
      setDragPreview({});
    };
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[dragState,roadmap]);

  const applyCascade = ()=>{
    if(!cascadeConfirm) return;
    setRoadmap(prev=>prev.map((item,i)=>{
      const dep = cascadeConfirm.dependents.find(d=>d.idx===i);
      if(dep) return {...item, start: Math.max(0,item.start+cascadeConfirm.shift)};
      return item;
    }));
    setCascadeConfirm(null);
  };

  // ── Reports drill-down state ──
  const [drillWidget,setDrillWidget] = useState<string|null>(null);

  return (
    <div className="flex h-[calc(100vh-112px)] overflow-hidden">
      <div className="w-52 shrink-0 bg-white border-r border-neutral-200 flex flex-col">
        <div className="px-3 py-3 border-b border-neutral-100">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Project Manager</div>
          <div className="flex items-center gap-2 mt-2">
            <Av id="u4" size="sm"/>
            <div>
              <div className="text-xs font-semibold text-neutral-900">Jordan Lee</div>
              <div className="text-[10px] text-neutral-400">Product</div>
            </div>
          </div>
        </div>
        <nav className="p-2 flex-1">
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition mb-0.5 text-left ${view===n.id?"bg-neutral-900 text-white":"text-neutral-600 hover:bg-neutral-100"}`}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-neutral-100">
          <button onClick={onCmdK} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 transition">
            <span>🔍</span><span className="flex-1 text-left">Search</span><kbd className="text-[10px] font-mono bg-neutral-100 border border-neutral-200 px-1 rounded">⌘K</kbd>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-neutral-50 p-4">
        {/* PM OVERVIEW */}
        {view==="morning" && (
          <div className="space-y-4 max-w-[1100px]">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">Sprint Overview</h1>
                <p className="text-sm text-neutral-500">Sprint 6 · Closes Friday · 4 days remaining</p>
              </div>
              <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition">Export Report</button>
            </div>
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3">
              {[
                {v:"68%",  l:"Completion", sub:"10 of 15 done",     c:"text-emerald-600"},
                {v:"2",    l:"Blocked",    sub:"5+ days no movement",c:"text-red-600"},
                {v:"3",    l:"In Review",  sub:"Awaiting sign-off",  c:"text-amber-600"},
                {v:"↗ On Track",l:"Forecast",sub:"Velocity looks good",c:"text-indigo-600"},
              ].map(k=>(
                <div key={k.l} className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className={`text-2xl font-bold ${k.c}`}>{k.v}</div>
                  <div className="text-xs font-semibold text-neutral-700 mt-1">{k.l}</div>
                  <div className="text-[11px] text-neutral-400">{k.sub}</div>
                </div>
              ))}
            </div>
            {/* Team workload */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-sm font-semibold text-neutral-900 mb-3">Team Workload</div>
              <div className="space-y-3">
                {TEAM.slice(0,5).map(m=>{
                  const assigned = ALL_ISSUES.filter(i=>i.assigneeId===m.id&&i.sprint==="Sprint 6");
                  const done = assigned.filter(i=>i.status==="done").length;
                  const pct = assigned.length ? Math.round((done/assigned.length)*100) : 0;
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <Av id={m.id} size="sm"/>
                      <div className="w-24 text-xs font-medium text-neutral-700 truncate">{m.name}</div>
                      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{width:`${pct||20}%`}}/>
                      </div>
                      <div className="text-xs text-neutral-500 w-20 text-right">{done}/{assigned.length} issues</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Blockers */}
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <div className="text-sm font-semibold text-red-700 mb-3">⛔ Active Blockers</div>
              {ALL_ISSUES.filter(i=>i.status==="blocked").map(issue=>(
                <div key={issue.id} onClick={()=>setActiveIssue(issue)} className="flex items-center gap-3 py-2 hover:bg-red-50 rounded-lg px-2 cursor-pointer transition">
                  <span className="text-[11px] font-mono text-neutral-400 w-[80px]">{issue.key}</span>
                  <span className="text-sm text-neutral-800 flex-1">{issue.title}</span>
                  <span className="text-xs text-red-600">Blocked by {issue.blockedBy}</span>
                  <Av id={issue.assigneeId||"u1"} size="xs"/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SPRINT PLAN */}
        {view==="sprint" && (
          <div className="max-w-[1000px]">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-bold text-neutral-900">Sprint Planning</h1>
              <div className="text-sm text-neutral-500">Sprint 6 · {[...sprintSet].length} issues · {[...sprintSet].reduce((a,id)=>a+(ALL_ISSUES.find(i=>i.id===id)?.estimate||0),0)}h estimated</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* In Sprint */}
              <div>
                <div className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-2">
                  Sprint 6
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{[...sprintSet].length}</span>
                </div>
                <div className="space-y-1.5">
                  {ALL_ISSUES.filter(i=>sprintSet.has(i.id)).map(issue=>(
                    <div key={issue.id} onClick={()=>setActiveIssue(issue)} className="bg-white rounded-lg border border-neutral-200 px-3 py-2.5 hover:border-indigo-200 transition cursor-pointer flex items-center gap-2">
                      <TypeIcon t={issue.type}/>
                      <span className="text-[10px] font-mono text-neutral-400 w-[76px] shrink-0">{issue.key}</span>
                      <span className="text-xs text-neutral-800 flex-1 truncate">{issue.title}</span>
                      <StatusBadge status={issue.status}/>
                      <button onClick={e=>{e.stopPropagation();setSprintSet(prev=>{const n=new Set(prev);n.delete(issue.id);return n;});}}
                        className="text-[10px] text-neutral-400 hover:text-red-500 transition px-1">← Out</button>
                    </div>
                  ))}
                </div>
              </div>
              {/* Backlog */}
              <div>
                <div className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-2">
                  Backlog
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{backlog.filter(i=>!sprintSet.has(i.id)).length}</span>
                </div>
                <div className="space-y-1.5">
                  {backlog.filter(i=>!sprintSet.has(i.id)).map(issue=>(
                    <div key={issue.id} onClick={()=>setActiveIssue(issue)} className="bg-white rounded-lg border border-dashed border-neutral-200 px-3 py-2.5 hover:border-neutral-300 transition cursor-pointer flex items-center gap-2">
                      <TypeIcon t={issue.type}/>
                      <span className="text-[10px] font-mono text-neutral-400 w-[76px] shrink-0">{issue.key}</span>
                      <span className="text-xs text-neutral-600 flex-1 truncate">{issue.title}</span>
                      <PriorityBadge p={issue.priority}/>
                      <button onClick={e=>{e.stopPropagation();setSprintSet(prev=>new Set([...prev,issue.id]));}}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 transition px-1 font-medium">→ Sprint</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOARD */}
        {view==="board" && (
          <div>
            <h1 className="text-lg font-bold text-neutral-900 mb-4">Sprint 6 Board</h1>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {cols.map(col=>{
                const colIssues = sprintIssues.filter(i=>(boardStatuses[i.id]||i.status)===col.status);
                return (
                  <div key={col.status} className="w-[260px] shrink-0">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className={`w-2 h-2 rounded-full ${STATUS_CFG[col.status].dot}`}/>
                      <span className="text-xs font-semibold text-neutral-700">{col.label}</span>
                      <span className="text-[10px] text-neutral-400 ml-1">{colIssues.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colIssues.map(issue=>(
                        <div key={issue.id} onClick={()=>setActiveIssue(issue)} className="bg-white rounded-xl border border-neutral-200 p-3 hover:border-indigo-300 hover:shadow-sm transition cursor-pointer">
                          <div className="flex items-center gap-1.5 mb-1.5"><TypeIcon t={issue.type}/><span className="text-[10px] font-mono text-neutral-400">{issue.key}</span><PriorityBadge p={issue.priority}/></div>
                          <div className="text-xs font-medium text-neutral-900 leading-snug mb-2">{issue.title}</div>
                          <div className="flex items-center justify-between">
                            {issue.assigneeId?<Av id={issue.assigneeId} size="xs"/>:<div/>}
                            {issue.estimate && <span className="text-[10px] text-neutral-400">{issue.estimate}h</span>}
                          </div>
                          <div className="mt-2 pt-2 border-t border-neutral-50 flex gap-1">
                            {cols.filter(c=>c.status!==col.status).slice(0,2).map(c=>(
                              <button key={c.status} onClick={e=>{e.stopPropagation();setBoardStatuses(prev=>({...prev,[issue.id]:c.status}));}}
                                className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition">→ {c.label}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ROADMAP — drag-to-move with cascade preview */}
        {view==="roadmap" && (
          <div className="max-w-[960px]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-lg font-bold text-neutral-900">Roadmap</h1>
                <p className="text-xs text-neutral-500 mt-0.5">Drag bars to reschedule · Dependent projects preview in real-time</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-lg border border-neutral-200 bg-white text-neutral-600">Q2 2026</span>
                <span className="px-2 py-1 rounded-lg border border-neutral-200 bg-white text-neutral-600">Q3 2026</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden select-none">
              {/* Week headers */}
              <div className="flex border-b border-neutral-100 bg-neutral-50">
                <div className="w-52 shrink-0 px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Project</div>
                <div className="flex-1 flex" ref={ganttRef}>
                  {["Jun 14","Jun 21","Jun 28","Jul 5","Jul 12","Jul 19","Jul 26","Aug 2"].map(w=>(
                    <div key={w} className="flex-1 px-1 py-2 text-[10px] text-neutral-400 text-center border-l border-neutral-100">{w}</div>
                  ))}
                </div>
              </div>

              {roadmap.map((item,i)=>{
                const isDragging = dragState?.idx===i;
                const isDependent = dragPreview[i]!==undefined;
                const ghostStart = isDependent ? Math.max(0,item.start+dragPreview[i]) : null;
                return (
                  <div key={i} className={`flex items-center border-b border-neutral-50 last:border-0 transition ${isDragging?"bg-indigo-50":isDependent?"bg-amber-50":"hover:bg-neutral-50"}`}>
                    <div className="w-52 shrink-0 px-4 py-3">
                      <div className="text-xs font-medium text-neutral-800 truncate">{item.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StatusBadge status={item.status as IssueStatus}/>
                        {item.dependsOn!==undefined && (
                          <span className="text-[9px] text-neutral-400">↳ depends on {roadmap[item.dependsOn].name.split(" ").slice(0,2).join(" ")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 relative h-12 py-2">
                      {/* Grid lines */}
                      {[0,1,2,3,4,5,6,7].map(g=>(
                        <div key={g} className="absolute top-0 bottom-0 border-l border-neutral-100" style={{left:`${(g/8)*100}%`}}/>
                      ))}
                      {/* Ghost bar for dependent cascade preview */}
                      {ghostStart!==null && (
                        <div className="absolute top-2 h-5 rounded-full border-2 border-dashed border-amber-400 bg-amber-100 opacity-60 flex items-center px-2 transition-all duration-75"
                          style={{left:`${(ghostStart/60)*100}%`,width:`${(item.width/60)*100}%`}}>
                          <span className="text-amber-700 text-[9px] font-semibold truncate">will shift →</span>
                        </div>
                      )}
                      {/* Actual bar */}
                      <div
                        onMouseDown={e=>{ setDragState({idx:i,startX:e.clientX,origStart:item.start}); e.preventDefault(); }}
                        className={`absolute top-2 h-5 rounded-full flex items-center px-2.5 transition-all duration-75 ${isDragging?"cursor-grabbing shadow-lg ring-2 ring-indigo-400 ring-offset-1 opacity-90":"cursor-grab hover:opacity-90 hover:shadow-sm"} ${item.color}`}
                        style={{left:`${(item.start/60)*100}%`,width:`${(item.width/60)*100}%`}}>
                        <span className="text-white text-[10px] font-semibold truncate">{item.name}</span>
                        {isDragging && <span className="ml-auto text-white/80 text-[9px] shrink-0">⟷</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cascade confirm dialog */}
            {cascadeConfirm && (
              <div className="mt-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
                <div className="text-sm font-bold text-amber-900 mb-1">
                  ⚡ Cascade Impact — {cascadeConfirm.shift>0?"Pushed forward":"Pulled back"} by {Math.abs(cascadeConfirm.shift)} {Math.abs(cascadeConfirm.shift)===1?"unit":"units"}
                </div>
                <p className="text-xs text-amber-800 mb-3">
                  Moving this project affects <strong>{cascadeConfirm.dependents.length} dependent project{cascadeConfirm.dependents.length>1?"s":""}</strong>:
                  {cascadeConfirm.dependents.map(d=><span key={d.idx} className="ml-1 font-semibold">"{d.name}"</span>)}. Apply the same shift to all of them?
                </p>
                <div className="flex gap-2">
                  <button onClick={applyCascade} className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition">
                    ✓ Move Dependents Too
                  </button>
                  <button onClick={()=>setCascadeConfirm(null)} className="px-4 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-semibold hover:bg-amber-50 transition">
                    Leave Dependents in Place
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-500">
              💡 <strong className="text-neutral-700">How it works:</strong> Drag any bar left or right. Projects with dependencies show a ghost preview. Release to confirm — Forge asks whether to cascade the shift to dependent projects.
            </div>
          </div>
        )}

        {/* REPORTS — widget dashboard with drill-down */}
        {view==="reports" && (
          <div className="max-w-[1100px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-lg font-bold text-neutral-900">Reports</h1>
                <p className="text-xs text-neutral-500 mt-0.5">Click any widget to drill into the underlying data</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="text-xs border border-neutral-200 rounded-lg px-3 py-1.5 bg-white text-neutral-700">
                  <option>Sprint 6</option><option>Sprint 5</option><option>Sprint 4</option>
                </select>
                <button className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition">Export PDF</button>
              </div>
            </div>

            {/* Widget grid */}
            <div className="grid grid-cols-3 gap-3">

              {/* 1 — Velocity */}
              <div onClick={()=>setDrillWidget(drillWidget==="velocity"?null:"velocity")}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition ${drillWidget==="velocity"?"border-indigo-400 ring-1 ring-indigo-200":"border-neutral-200 hover:border-indigo-300"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-neutral-900">Velocity</div>
                  <span className="text-[10px] text-neutral-400">pts/sprint</span>
                </div>
                <div className="flex items-end gap-1.5 h-20 mb-2">
                  {[22,18,28,24,31,null].map((v,i)=>(
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      {v!=null ? (
                        <div className={`w-full rounded-t ${i===5?"bg-indigo-200 border-2 border-dashed border-indigo-400":"bg-indigo-500"}`} style={{height:`${(v/35)*68}px`}}/>
                      ) : (
                        <div className="w-full rounded-t bg-neutral-100 border-2 border-dashed border-neutral-300" style={{height:`${(28/35)*68}px`}}/>
                      )}
                      <span className="text-[9px] text-neutral-400">{v!=null?`S${i+1}`:"S6▸"}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-neutral-500">Avg <strong className="text-neutral-800">24.6</strong> pts · trending ↗</div>
              </div>

              {/* 2 — Cycle Time */}
              <div onClick={()=>setDrillWidget(drillWidget==="cycletime"?null:"cycletime")}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition ${drillWidget==="cycletime"?"border-amber-400 ring-1 ring-amber-200":"border-neutral-200 hover:border-amber-300"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-neutral-900">Cycle Time</div>
                  <span className="text-[10px] text-neutral-400">avg days per stage</span>
                </div>
                <div className="space-y-2">
                  {[
                    {label:"Todo → In Progress", days:1.2, max:5, color:"bg-sky-400"},
                    {label:"In Progress → Review", days:3.8, max:5, color:"bg-amber-400"},
                    {label:"Review → Done",        days:1.1, max:5, color:"bg-emerald-400"},
                  ].map(s=>(
                    <div key={s.label}>
                      <div className="flex justify-between text-[10px] text-neutral-500 mb-0.5">
                        <span>{s.label}</span><strong className="text-neutral-800">{s.days}d</strong>
                      </div>
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.color}`} style={{width:`${(s.days/s.max)*100}%`}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-amber-700 font-medium">⚠ Review stage is the bottleneck</div>
              </div>

              {/* 3 — Scope Creep */}
              <div onClick={()=>setDrillWidget(drillWidget==="scope"?null:"scope")}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition ${drillWidget==="scope"?"border-red-400 ring-1 ring-red-200":"border-neutral-200 hover:border-red-300"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-neutral-900">Scope Creep</div>
                  <span className="text-[10px] text-neutral-400">issues added mid-sprint</span>
                </div>
                <div className="flex items-center justify-center h-20">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-500">+3</div>
                    <div className="text-xs text-neutral-500 mt-1">issues added after sprint start</div>
                    <div className="text-[10px] text-neutral-400">vs. original 12 planned</div>
                  </div>
                </div>
                <div className="text-[11px] text-red-700 font-medium">25% scope expansion this sprint</div>
              </div>

              {/* 4 — Assignee Load */}
              <div onClick={()=>setDrillWidget(drillWidget==="load"?null:"load")}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition ${drillWidget==="load"?"border-indigo-400 ring-1 ring-indigo-200":"border-neutral-200 hover:border-indigo-300"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-neutral-900">Assignee Load</div>
                  <span className="text-[10px] text-neutral-400">open issues in sprint</span>
                </div>
                <div className="space-y-2">
                  {TEAM.slice(0,5).map(m=>{
                    const open = ALL_ISSUES.filter(i=>i.assigneeId===m.id&&i.sprint==="Sprint 6"&&i.status!=="done").length;
                    const done = ALL_ISSUES.filter(i=>i.assigneeId===m.id&&i.sprint==="Sprint 6"&&i.status==="done").length;
                    return (
                      <div key={m.id} className="flex items-center gap-2">
                        <Av id={m.id} size="xs"/>
                        <div className="w-20 text-[10px] text-neutral-700 truncate">{m.name.split(" ")[0]}</div>
                        <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full" style={{width:`${Math.min(100,((open+done)/4)*100)}%`}}/>
                        </div>
                        <span className="text-[10px] text-neutral-500 w-8 text-right">{open} open</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5 — Blocked Time */}
              <div onClick={()=>setDrillWidget(drillWidget==="blocked"?null:"blocked")}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition ${drillWidget==="blocked"?"border-red-400 ring-1 ring-red-200":"border-neutral-200 hover:border-red-300"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-neutral-900">Blocked Time</div>
                  <span className="text-[10px] text-neutral-400">days issues sat blocked</span>
                </div>
                <div className="space-y-1.5">
                  {ALL_ISSUES.filter(i=>i.status==="blocked"||i.daysOld>3).slice(0,4).map(issue=>(
                    <div key={issue.id} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-neutral-400 w-[60px] shrink-0">{issue.key}</span>
                      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{width:`${Math.min(100,(issue.daysOld/10)*100)}%`}}/>
                      </div>
                      <span className="text-[10px] text-red-600 w-8 text-right font-medium">{issue.daysOld}d</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-neutral-500">Total blocked days: <strong className="text-red-600">26d</strong> this sprint</div>
              </div>

              {/* 6 — Bug vs Feature */}
              <div onClick={()=>setDrillWidget(drillWidget==="bugvsfeat"?null:"bugvsfeat")}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition ${drillWidget==="bugvsfeat"?"border-emerald-400 ring-1 ring-emerald-200":"border-neutral-200 hover:border-emerald-300"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-neutral-900">Bug vs Feature</div>
                  <span className="text-[10px] text-neutral-400">by issue type</span>
                </div>
                {(()=>{
                  const bugs     = ALL_ISSUES.filter(i=>i.type==="bug").length;
                  const features = ALL_ISSUES.filter(i=>i.type==="feature").length;
                  const chores   = ALL_ISSUES.filter(i=>i.type==="chore").length;
                  const total    = bugs+features+chores||1;
                  return (
                    <div>
                      <div className="flex h-6 rounded-full overflow-hidden mb-3">
                        <div className="bg-red-400 flex items-center justify-center text-[9px] text-white font-bold" style={{width:`${(bugs/total)*100}%`}}>{bugs}</div>
                        <div className="bg-indigo-400 flex items-center justify-center text-[9px] text-white font-bold" style={{width:`${(features/total)*100}%`}}>{features}</div>
                        <div className="bg-neutral-300 flex items-center justify-center text-[9px] text-white font-bold" style={{width:`${(chores/total)*100}%`}}>{chores}</div>
                      </div>
                      <div className="flex gap-3 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Bugs {Math.round((bugs/total)*100)}%</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"/>Features {Math.round((features/total)*100)}%</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-300 inline-block"/>Chores {Math.round((chores/total)*100)}%</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="mt-2 text-[11px] text-emerald-700 font-medium">⚡ This sprint is bug-heavy</div>
              </div>

              {/* 7 — Throughput */}
              <div onClick={()=>setDrillWidget(drillWidget==="throughput"?null:"throughput")}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition col-span-2 ${drillWidget==="throughput"?"border-sky-400 ring-1 ring-sky-200":"border-neutral-200 hover:border-sky-300"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-neutral-900">Weekly Throughput</div>
                  <span className="text-[10px] text-neutral-400">issues closed per week</span>
                </div>
                <div className="flex items-end gap-2 h-16">
                  {[
                    {w:"Jun 1",  n:4},{w:"Jun 8",  n:7},{w:"Jun 15", n:5},{w:"Jun 22", n:null},
                  ].map((w,i)=>(
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      {w.n!=null ? (
                        <><div className="w-full rounded-t bg-sky-400 hover:bg-sky-500 transition" style={{height:`${(w.n/10)*52}px`}}/>
                        <span className="text-[9px] text-neutral-400">{w.n}</span></>
                      ):(
                        <><div className="w-full rounded-t bg-neutral-100 border-2 border-dashed border-neutral-300" style={{height:`${(6/10)*52}px`}}/>
                        <span className="text-[9px] text-indigo-400">est</span></>
                      )}
                      <span className="text-[9px] text-neutral-400">{w.w}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 8 — Open vs Closed */}
              <div onClick={()=>setDrillWidget(drillWidget==="openclosed"?null:"openclosed")}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition ${drillWidget==="openclosed"?"border-violet-400 ring-1 ring-violet-200":"border-neutral-200 hover:border-violet-300"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-neutral-900">Open vs Closed</div>
                  <span className="text-[10px] text-neutral-400">cumulative</span>
                </div>
                {(()=>{
                  const open   = ALL_ISSUES.filter(i=>i.status!=="done").length;
                  const closed = ALL_ISSUES.filter(i=>i.status==="done").length;
                  const total  = open+closed||1;
                  return (
                    <div className="flex flex-col items-center justify-center h-20 gap-2">
                      <div className="flex w-full h-4 rounded-full overflow-hidden">
                        <div className="bg-emerald-400" style={{width:`${(closed/total)*100}%`}}/>
                        <div className="bg-red-300" style={{width:`${(open/total)*100}%`}}/>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1 text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-400"/>Closed {closed}</span>
                        <span className="flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-300"/>Open {open}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Drill-down panel */}
            {drillWidget && (
              <div className="mt-4 bg-white rounded-xl border-2 border-indigo-300 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-bold text-neutral-900">
                    {drillWidget==="velocity"   && "🔍 Velocity Drill-down — Sprint-by-Sprint Issues"}
                    {drillWidget==="cycletime"  && "🔍 Cycle Time — Issues Stuck in Review"}
                    {drillWidget==="scope"      && "🔍 Scope Creep — Issues Added After Sprint Start"}
                    {drillWidget==="load"       && "🔍 Assignee Load — Open Issues by Person"}
                    {drillWidget==="blocked"    && "🔍 Blocked Time — Issue-by-Issue Breakdown"}
                    {drillWidget==="bugvsfeat"  && "🔍 Bug vs Feature — Full Issue List by Type"}
                    {drillWidget==="throughput" && "🔍 Throughput — Issues Closed This Week"}
                    {drillWidget==="openclosed" && "🔍 Open Issues — What Remains to Close"}
                  </div>
                  <button onClick={()=>setDrillWidget(null)} className="text-neutral-400 hover:text-neutral-700 text-xs transition">✕ Close</button>
                </div>
                <div className="space-y-1.5">
                  {(drillWidget==="load"
                    ? ALL_ISSUES.filter(i=>i.sprint==="Sprint 6"&&i.status!=="done")
                    : drillWidget==="blocked"
                    ? ALL_ISSUES.filter(i=>i.status==="blocked"||i.daysOld>3)
                    : drillWidget==="bugvsfeat"
                    ? ALL_ISSUES.filter(i=>i.type==="bug")
                    : drillWidget==="throughput"||drillWidget==="openclosed"
                    ? ALL_ISSUES.filter(i=>i.status!=="done")
                    : drillWidget==="scope"
                    ? ALL_ISSUES.filter(i=>!i.sprint).slice(0,4)
                    : ALL_ISSUES.slice(0,8)
                  ).map(issue=>(
                    <div key={issue.id} onClick={()=>setActiveIssue(issue)}
                      className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 rounded-lg hover:bg-indigo-50 cursor-pointer border border-transparent hover:border-indigo-200 transition">
                      <TypeIcon t={issue.type}/>
                      <span className="text-[10px] font-mono text-neutral-400 w-[76px] shrink-0">{issue.key}</span>
                      <span className="text-xs text-neutral-800 flex-1 truncate">{issue.title}</span>
                      <StatusBadge status={issue.status}/>
                      {issue.assigneeId && <Av id={issue.assigneeId} size="xs"/>}
                      <span className="text-[10px] text-neutral-400 w-8 text-right">{issue.daysOld}d</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-neutral-400 text-center">Click any issue to open its full detail →</div>
              </div>
            )}
          </div>
        )}
        {view==="thinktank" && <ThinkTankView/>}
      </div>
      {activeIssue && <IssueDetail issue={activeIssue} onClose={()=>setActiveIssue(null)} role="pm"/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  COLLABORATOR SHELL
// ══════════════════════════════════════════════════════════════

function CollaboratorShell({onCmdK}:{onCmdK:()=>void}) {
  const [view,setView] = useState("feed");
  const [activeIssue,setActiveIssue] = useState<Issue|null>(null);
  const [watching,setWatching] = useState(new Set(["i1","i2","i14"]));

  const navItems = [
    {id:"feed",     icon:"📥", label:"My Feed",   badge:3},
    {id:"assigned", icon:"📌", label:"Assigned",  badge:0},
    {id:"watching", icon:"👁",  label:"Watching",  badge:0},
    {id:"projects", icon:"🗂",  label:"Projects",  badge:0},
  ];

  const feedItems = ALL_NOTIFS.filter(n=>n.role.includes("collaborator"));
  const assignedIssues = ALL_ISSUES.filter(i=>i.assigneeId==="u6");
  const watchingIssues = ALL_ISSUES.filter(i=>watching.has(i.id));

  return (
    <div className="flex h-[calc(100vh-112px)] overflow-hidden">
      <div className="w-52 shrink-0 bg-white border-r border-neutral-200 flex flex-col">
        <div className="px-3 py-3 border-b border-neutral-100">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Collaborator</div>
          <div className="flex items-center gap-2 mt-2">
            <Av id="u6" size="sm"/>
            <div>
              <div className="text-xs font-semibold text-neutral-900">Dana Walsh</div>
              <div className="text-[10px] text-neutral-400">QA Engineer</div>
            </div>
          </div>
        </div>
        <nav className="p-2 flex-1">
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition mb-0.5 text-left ${view===n.id?"bg-neutral-900 text-white":"text-neutral-600 hover:bg-neutral-100"}`}>
              <span>{n.icon}</span>{n.label}
              {n.badge>0 && <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5">{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-neutral-100">
          <button onClick={onCmdK} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 transition">
            <span>🔍</span><span className="flex-1 text-left">Search</span><kbd className="text-[10px] font-mono bg-neutral-100 border border-neutral-200 px-1 rounded">⌘K</kbd>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-neutral-50 p-4">
        {/* FEED */}
        {view==="feed" && (
          <div className="max-w-[700px] space-y-3">
            <h1 className="text-lg font-bold text-neutral-900">My Feed</h1>
            <p className="text-sm text-neutral-500">Things that need your attention today</p>
            {feedItems.map(n=>(
              <div key={n.id} className={`bg-white rounded-xl border px-4 py-3 flex gap-3 hover:border-indigo-200 transition cursor-pointer ${!n.read?"border-indigo-200 bg-indigo-50/20":"border-neutral-200"}`}>
                <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-base shrink-0">{n.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-neutral-800">{n.title}</div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5"/>}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">{n.detail}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {n.key && <span className="text-[10px] font-mono text-neutral-400">{n.key}</span>}
                    <span className="text-[10px] text-neutral-400">{n.time}</span>
                    {n.actionable && (
                      <button onClick={()=>{const iss=ALL_ISSUES.find(i=>i.key===n.key);if(iss)setActiveIssue(iss);}}
                        className="ml-auto text-[10px] px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition">View & Comment</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ASSIGNED */}
        {view==="assigned" && (
          <div className="max-w-[700px]">
            <h1 className="text-lg font-bold text-neutral-900 mb-4">Assigned to Me</h1>
            {assignedIssues.length===0 ? (
              <div className="bg-white rounded-xl border border-dashed border-neutral-200 p-8 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <div className="text-sm text-neutral-600">No issues assigned to you right now.</div>
              </div>
            ) : assignedIssues.map(issue=>(
              <div key={issue.id} onClick={()=>setActiveIssue(issue)} className="bg-white rounded-xl border border-neutral-200 px-4 py-3 hover:border-indigo-200 transition cursor-pointer flex items-center gap-3 mb-2">
                <TypeIcon t={issue.type}/>
                <span className="text-[11px] font-mono text-neutral-400 w-[76px]">{issue.key}</span>
                <span className="text-sm font-medium text-neutral-900 flex-1 truncate">{issue.title}</span>
                <StatusBadge status={issue.status}/>
              </div>
            ))}
          </div>
        )}

        {/* WATCHING */}
        {view==="watching" && (
          <div className="max-w-[700px]">
            <h1 className="text-lg font-bold text-neutral-900 mb-4">Watching</h1>
            <p className="text-sm text-neutral-500 mb-4">Issues you're subscribed to — you'll be notified of any changes.</p>
            {watchingIssues.map(issue=>(
              <div key={issue.id} className="bg-white rounded-xl border border-neutral-200 px-4 py-3 mb-2 hover:border-indigo-200 transition flex items-center gap-3">
                <div className="cursor-pointer flex-1 flex items-center gap-3 min-w-0" onClick={()=>setActiveIssue(issue)}>
                  <TypeIcon t={issue.type}/>
                  <span className="text-[11px] font-mono text-neutral-400 w-[76px]">{issue.key}</span>
                  <span className="text-sm font-medium text-neutral-900 flex-1 truncate">{issue.title}</span>
                  <StatusBadge status={issue.status}/>
                </div>
                <button onClick={()=>setWatching(prev=>{const n=new Set(prev);n.delete(issue.id);return n;})}
                  className="text-xs text-neutral-400 hover:text-red-500 transition px-2">Unwatch</button>
              </div>
            ))}
            <div className="mt-4 text-xs text-neutral-400">Click "Watch" on any issue to add it here. You'll get notified on status changes, decisions, and @mentions.</div>
          </div>
        )}

        {/* PROJECTS */}
        {view==="projects" && (
          <div className="max-w-[700px]">
            <h1 className="text-lg font-bold text-neutral-900 mb-4">Projects</h1>
            {[
              {key:"FORGE",name:"Forge Issue Tracker",open:12,color:"bg-indigo-500",access:"Member"},
              {key:"WEB",  name:"Travli Web App",      open:8, color:"bg-emerald-500",access:"Member"},
              {key:"MOB",  name:"Travli Mobile",       open:3, color:"bg-violet-500", access:"Viewer"},
            ].map(p=>(
              <div key={p.key} className="bg-white rounded-xl border border-neutral-200 px-4 py-4 mb-3 hover:border-indigo-200 transition cursor-pointer flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg ${p.color} flex items-center justify-center text-white font-bold text-sm`}>{p.key[0]}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-neutral-900">{p.name}</div>
                  <div className="text-xs text-neutral-500">{p.open} open issues · Sprint 6</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">{p.access}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {activeIssue && <IssueDetail issue={activeIssue} onClose={()=>setActiveIssue(null)} role="collaborator"/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ADMIN SHELL — Two design concepts for admin navigation
// ══════════════════════════════════════════════════════════════

const ADMIN_GROUPS = [
  {
    id:"overview", label:"Overview", icon:"◈",
    items:[
      {id:"workspace",   label:"Workspace",   icon:"🏢", badge:0,  desc:"General settings, branding, billing"},
      {id:"audit",       label:"Audit Log",   icon:"📋", badge:2,  desc:"All admin actions, security events"},
      {id:"ai_usage",    label:"AI Usage",    icon:"✦",  badge:0,  desc:"Token consumption, cost breakdown"},
    ]
  },
  {
    id:"team", label:"Team", icon:"◈",
    items:[
      {id:"members",     label:"Members",     icon:"👥", badge:1,  desc:"Invite, manage roles, remove"},
      {id:"roles",       label:"Roles",       icon:"🔐", badge:0,  desc:"Custom roles & permission sets"},
      {id:"sso",         label:"SSO / Login", icon:"🔑", badge:0,  desc:"SAML, Google Workspace, Okta"},
      {id:"security",    label:"Security",    icon:"🛡️", badge:1,  desc:"2FA enforcement, IP allowlist"},
    ]
  },
  {
    id:"projects", label:"Projects & Work", icon:"◈",
    items:[
      {id:"projects",    label:"Projects",    icon:"📁", badge:0,  desc:"Create, archive, transfer"},
      {id:"fields",      label:"Fields",      icon:"🗂️", badge:0,  desc:"Custom fields & categories"},
      {id:"sla",         label:"SLA",         icon:"⏱️", badge:0,  desc:"Response & resolution policies"},
    ]
  },
  {
    id:"integrations", label:"Integrations", icon:"◈",
    items:[
      {id:"github",      label:"GitHub",      icon:"🐙", badge:0,  desc:"Commits, PRs linked to issues"},
      {id:"webhooks",    label:"Webhooks",    icon:"⚡", badge:0,  desc:"Outbound event streams"},
      {id:"chat",        label:"Slack / Teams",icon:"💬",badge:0,  desc:"Notifications & slash commands"},
      {id:"sdk",         label:"SDK & Import", icon:"📦",badge:0,  desc:"JS SDK, CSV import, Jira migration"},
    ]
  },
  {
    id:"automation", label:"Automation", icon:"◈",
    items:[
      {id:"automations", label:"Automations", icon:"⚙️", badge:0, desc:"Auto-assign, close, label rules"},
      {id:"notifications",label:"Notifications",icon:"🔔",badge:0, desc:"Digests, @mentions, watchers"},
      {id:"ai",          label:"AI Settings", icon:"🤖", badge:0, desc:"Grok model, context window, tone"},
    ]
  },
  {
    id:"developer", label:"Developer", icon:"◈",
    items:[
      {id:"api_keys",    label:"API Keys",    icon:"🗝️", badge:0,  desc:"Create & rotate service tokens"},
      {id:"think_tank",  label:"Think Tank",  icon:"💡", badge:0,  desc:"Roadmap ideation & AI synthesis"},
      {id:"changelog",   label:"Changelog",   icon:"📣", badge:0,  desc:"Release notes & version history"},
    ]
  },
];

const ALL_ADMIN_ITEMS = ADMIN_GROUPS.flatMap(g=>g.items);

const statusCfg = {
  on_track:{label:"On Track",bg:"bg-emerald-50",text:"text-emerald-700",border:"border-emerald-200",dot:"bg-emerald-500"},
  at_risk: {label:"At Risk", bg:"bg-amber-50",  text:"text-amber-700",  border:"border-amber-200",  dot:"bg-amber-400"},
  blocked: {label:"Blocked", bg:"bg-red-50",    text:"text-red-700",    border:"border-red-200",    dot:"bg-red-500"},
} as Record<string,{label:string;bg:string;text:string;border:string;dot:string}>;

const PROJECTS = [
  {key:"FORGE",name:"Forge Issue Tracker",status:"on_track",health:68,open:12},
  {key:"WEB",  name:"Travli Web App",      status:"at_risk", health:52,open:8},
  {key:"MOB",  name:"Travli Mobile",       status:"on_track",health:81,open:3},
  {key:"INFRA",name:"Platform Infra",      status:"blocked", health:34,open:4},
];

const AUDIT_LOG = [
  {icon:"🔒",text:"FORGE-52 created — SEC-05 Make IMPERSONATION_SECRET mandatory",user:"u1",time:"1h ago",   sev:"high"},
  {icon:"👤",text:"Dana Walsh joined workspace as QA Engineer",                    user:"u4",time:"3h ago",   sev:"info"},
  {icon:"🛡️",text:"Failed login attempt from IP 185.220.101.47 (Tor exit node)",   user:"u1",time:"5h ago",   sev:"high"},
  {icon:"⚙️",text:"Feature flag think_tank enabled for all users",                 user:"u1",time:"2d ago",   sev:"info"},
  {icon:"🔑",text:"API key rotated — FORGE project (reason: quarterly rotation)",  user:"u1",time:"3d ago",   sev:"info"},
  {icon:"📧",text:"5 workspace invitations sent",                                  user:"u4",time:"4d ago",   sev:"info"},
  {icon:"🛡️",text:"RLS policies updated — isolation test passed 33/33",            user:"u2",time:"5d ago",   sev:"info"},
  {icon:"🔐",text:"SSO configuration updated — Okta SAML endpoint changed",       user:"u1",time:"6d ago",   sev:"medium"},
];

const FEATURES = [
  {key:"think_tank",     label:"Think Tank",      desc:"AI idea capture + provenance tracking", on:true},
  {key:"ai_copilot",     label:"AI Co-pilot",     desc:"Issue suggestions + auto-summaries",    on:true},
  {key:"rbac",           label:"Custom Roles",    desc:"Granular permission sets per member",   on:false},
  {key:"dashboards",     label:"Dashboards",      desc:"Cross-project analytics & charts",      on:false},
  {key:"stakeholder",    label:"Stakeholder View",desc:"Read-only embed for external viewers",  on:false},
];

function Toggle({on,onToggle}:{on:boolean;onToggle:()=>void}) {
  return (
    <button onClick={onToggle} className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${on?"bg-indigo-500":"bg-neutral-200"}`}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on?"left-5":"left-0.5"}`}/>
    </button>
  );
}

function AdminContent({view}:{view:string}) {
  const [memberRole,setMemberRole] = useState<Record<string,string>>(Object.fromEntries(TEAM.map(m=>[m.id,m.role])));
  const [featureState,setFeatureState] = useState(Object.fromEntries(FEATURES.map(f=>[f.key,f.on])));

  if(view==="workspace") return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-neutral-900">Workspace Settings</h2>
        <p className="text-sm text-neutral-500 mt-0.5">General configuration for the Travli workspace</p>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
        <div className="p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Identity</div>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg font-bold shrink-0">T</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-neutral-900">Travli</div>
                <div className="text-xs text-neutral-400">travli.forge.app · Slug: travli</div>
              </div>
              <button className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition">Change logo</button>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Feature Flags</div>
          <div className="space-y-4">
            {FEATURES.map(f=>(
              <div key={f.key} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-800">{f.label}</div>
                  <div className="text-xs text-neutral-400">{f.desc}</div>
                </div>
                <Toggle on={featureState[f.key]} onToggle={()=>setFeatureState(p=>({...p,[f.key]:!p[f.key]}))}/>
              </div>
            ))}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">Danger Zone</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-800">Delete workspace</div>
              <div className="text-xs text-neutral-400">Permanently removes all data. Cannot be undone.</div>
            </div>
            <button className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition">Delete workspace</button>
          </div>
        </div>
      </div>
    </div>
  );

  if(view==="members") return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Members</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{TEAM.length} members · 1 pending invite</p>
        </div>
        <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition">+ Invite member</button>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-amber-500 text-base">⏳</span>
        <div className="flex-1 text-sm text-amber-800">
          <span className="font-semibold">1 pending invite</span> — riley@acme.io was invited 2 days ago
        </div>
        <button className="text-xs font-semibold text-amber-700 hover:text-amber-900">Resend</button>
        <button className="text-xs font-semibold text-red-500 hover:text-red-700 ml-2">Cancel</button>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_80px_90px] gap-3 px-5 py-2.5 border-b border-neutral-100 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          <div>Member</div><div>Role</div><div>Last seen</div><div></div>
        </div>
        {TEAM.map(m=>(
          <div key={m.id} className="grid grid-cols-[2fr_1fr_80px_90px] gap-3 items-center px-5 py-3 border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition">
            <div className="flex items-center gap-3">
              <Av id={m.id} size="sm"/>
              <div>
                <div className="text-sm font-medium text-neutral-900">{m.name}</div>
                <div className="text-[11px] text-neutral-400">{m.role.toLowerCase()}@travli.io</div>
              </div>
            </div>
            <select value={memberRole[m.id]} onChange={e=>setMemberRole(p=>({...p,[m.id]:e.target.value}))}
              className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white text-neutral-700 focus:outline-none focus:border-indigo-400">
              {["Lead Dev","Developer","Designer","Product","QA Eng","Admin"].map(r=><option key={r}>{r}</option>)}
            </select>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold w-fit ${m.online?"bg-emerald-100 text-emerald-700":"bg-neutral-100 text-neutral-500"}`}>
              {m.online?"Now":"3d ago"}
            </span>
            <div className="flex gap-1">
              <button className="text-xs text-neutral-500 hover:text-neutral-800 px-2 py-1 rounded hover:bg-neutral-100 transition">Edit</button>
              <button className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if(view==="audit") return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Audit Log</h2>
          <p className="text-sm text-neutral-500 mt-0.5">All admin actions and security events</p>
        </div>
        <button className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition">Export CSV</button>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-red-500">🛡️</span>
        <div className="text-sm text-red-800 flex-1"><span className="font-semibold">2 high-severity events</span> in the last 24 hours</div>
        <button className="text-xs font-semibold text-red-700 hover:text-red-900">Review</button>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {AUDIT_LOG.map((e,i)=>(
          <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${e.sev==="high"?"bg-red-100":e.sev==="medium"?"bg-amber-100":"bg-neutral-100"}`}>{e.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-neutral-800 leading-snug">{e.text}</div>
              <div className="flex items-center gap-2 mt-1">
                <Av id={e.user} size="xs"/>
                <span className="text-[10px] text-neutral-400">{teamById[e.user]?.name} · {e.time}</span>
                {e.sev==="high" && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">HIGH</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if(view==="github") return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-bold text-neutral-900">GitHub Integration</h2>
      <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
        <div className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center text-xl">🐙</div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-neutral-900">acme-corp / forge</div>
            <div className="text-xs text-neutral-400">Connected · 2 repos syncing</div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Connected</span>
          <button className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition">Disconnect</button>
        </div>
        <div className="p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">Linked Repositories</div>
          {["acme-corp/forge","acme-corp/travli-web"].map(r=>(
            <div key={r} className="flex items-center gap-3 py-2">
              <span className="text-neutral-400">📂</span>
              <span className="text-sm text-neutral-700 flex-1">{r}</span>
              <button className="text-xs text-neutral-400 hover:text-red-500 transition">Remove</button>
            </div>
          ))}
          <button className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add repository</button>
        </div>
        <div className="p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">Sync Settings</div>
          {[
            {label:"Auto-link commits to issues by key (e.g. FORGE-45)",on:true},
            {label:"Auto-close issue when PR merges to main",on:true},
            {label:"Post PR status to issue comments",on:false},
          ].map((s,i)=>{
            const [on,setOn] = useState(s.on);
            return (
              <div key={i} className="flex items-center gap-4 py-2">
                <div className="text-sm text-neutral-700 flex-1">{s.label}</div>
                <Toggle on={on} onToggle={()=>setOn(p=>!p)}/>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if(view==="api_keys") return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">API Keys</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Service tokens for external access</p>
        </div>
        <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition">+ New key</button>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {[
          {name:"Forge Self (dogfood)",key:"fk_prod_••••••••4f2a",project:"FORGE",created:"2026-01-15",last:"2 min ago",active:true},
          {name:"CI/CD Pipeline",      key:"fk_prod_••••••••8b91",project:"ALL",  created:"2026-03-02",last:"14h ago",  active:true},
          {name:"Old Zapier (unused)", key:"fk_prod_••••••••c3e7",project:"WEB",  created:"2025-11-12",last:"47d ago",  active:false},
        ].map((k,i)=>(
          <div key={i} className="px-5 py-3.5 border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900">{k.name}</span>
                  {!k.active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-400">INACTIVE</span>}
                </div>
                <div className="text-xs text-neutral-400 font-mono mt-0.5">{k.key} · project: {k.project}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-neutral-500">Last used {k.last}</div>
                <div className="text-[10px] text-neutral-400">Created {k.created}</div>
              </div>
              <button className="text-xs text-neutral-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition ml-2">Revoke</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if(view==="security") return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-bold text-neutral-900">Security</h2>
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-red-500">⚠️</span>
        <div className="text-sm text-red-800 flex-1"><span className="font-semibold">Action needed:</span> 2FA is not enforced — 2 members have it disabled</div>
        <button className="text-xs font-semibold text-red-700 hover:text-red-900 underline">Enforce now</button>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
        <div className="p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Authentication</div>
          {[
            {label:"Require 2FA for all members",desc:"Members without 2FA will be locked out",on:false},
            {label:"Session timeout after 8 hours of inactivity",desc:"Users will need to re-authenticate",on:true},
            {label:"Restrict login to SSO only",desc:"Disables email/password login entirely",on:false},
          ].map((s,i)=>{
            const [on,setOn]=useState(s.on);
            return (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-50 last:border-0">
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-800">{s.label}</div>
                  <div className="text-xs text-neutral-400">{s.desc}</div>
                </div>
                <Toggle on={on} onToggle={()=>setOn(p=>!p)}/>
              </div>
            );
          })}
        </div>
        <div className="p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">IP Allowlist</div>
          <div className="text-sm text-neutral-500 mb-3">No IP restrictions configured — all IPs are allowed</div>
          <button className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add IP range</button>
        </div>
      </div>
    </div>
  );

  // Default for any other view
  const item = ALL_ADMIN_ITEMS.find(i=>i.id===view);
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-bold text-neutral-900">{item?.label ?? view}</h2>
      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
        <div className="text-4xl mb-3">{item?.icon ?? "⚙️"}</div>
        <div className="text-sm font-medium text-neutral-700 mb-1">{item?.label} settings</div>
        <div className="text-xs text-neutral-400">{item?.desc}</div>
      </div>
    </div>
  );
}

// ── CONCEPT A: Grouped Left Sidebar ──────────────────────────

function ConceptA({onCmdK}:{onCmdK:()=>void}) {
  const [view,setView] = useState("workspace");
  const [collapsed,setCollapsed] = useState<Record<string,boolean>>({});

  const activeGroup = ADMIN_GROUPS.find(g=>g.items.some(i=>i.id===view));

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 shrink-0 bg-white border-r border-neutral-200 flex flex-col">
        {/* User header */}
        <div className="px-4 py-3.5 border-b border-neutral-100 flex items-center gap-2.5">
          <Av id="u1" size="sm"/>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-neutral-900 truncate">Matt Giblin</div>
            <div className="text-[10px] text-indigo-600 font-semibold">Super Admin</div>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-900 text-white">ADMIN</span>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {ADMIN_GROUPS.map(g=>{
            const isCollapsed = collapsed[g.id];
            const groupActive = g.items.some(i=>i.id===view);
            const totalBadge = g.items.reduce((s,i)=>s+i.badge,0);
            return (
              <div key={g.id} className="mb-1">
                <button
                  onClick={()=>setCollapsed(p=>({...p,[g.id]:!p[g.id]}))}
                  className="w-full flex items-center gap-1 px-2 py-1 mb-0.5 group"
                >
                  <span className={`text-[9px] font-bold uppercase tracking-widest transition ${groupActive?"text-indigo-600":"text-neutral-400 group-hover:text-neutral-600"}`}>
                    {g.label}
                  </span>
                  <div className="flex-1"/>
                  {totalBadge>0 && !isCollapsed && <span className="text-[9px] font-bold bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">{totalBadge}</span>}
                  <span className={`text-neutral-400 text-[10px] transition ${isCollapsed?"rotate-0":"rotate-90"}`}>›</span>
                </button>

                {!isCollapsed && g.items.map(item=>{
                  const active = view===item.id;
                  return (
                    <button key={item.id} onClick={()=>setView(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition mb-0.5 text-left ${
                        active
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      }`}>
                      <span className="w-4 text-center">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge>0 && (
                        <span className={`text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ${active?"bg-white/20 text-white":"bg-red-500 text-white"}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Search footer */}
        <div className="p-2 border-t border-neutral-100">
          <button onClick={onCmdK} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-neutral-200 text-xs text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 hover:bg-neutral-50 transition">
            <span>🔍</span><span className="flex-1 text-left">Search settings</span>
            <kbd className="text-[9px] font-mono bg-neutral-100 border border-neutral-200 px-1 rounded">⌘K</kbd>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-neutral-50">
        {/* Breadcrumb */}
        <div className="px-6 py-3 border-b border-neutral-200 bg-white flex items-center gap-2 text-xs text-neutral-400">
          <span className="font-medium text-neutral-600">Settings</span>
          <span>›</span>
          <span className="text-neutral-400">{activeGroup?.label}</span>
          <span>›</span>
          <span className="font-semibold text-neutral-900">{ALL_ADMIN_ITEMS.find(i=>i.id===view)?.label}</span>
        </div>
        <div className="p-6">
          <AdminContent view={view}/>
        </div>
      </div>
    </div>
  );
}

// ── CONCEPT B: Settings Hub + Drill-down ─────────────────────

const GROUP_ILLUSTRATIONS: Record<string,string> = {
  overview:"◈", team:"◉", projects:"◧", integrations:"⬡", automation:"◎", developer:"◆"
};
const GROUP_COLORS: Record<string,string> = {
  overview:"from-indigo-500 to-indigo-600",
  team:     "from-violet-500 to-violet-600",
  projects: "from-blue-500 to-blue-600",
  integrations:"from-cyan-500 to-cyan-600",
  automation:"from-emerald-500 to-emerald-600",
  developer:"from-amber-500 to-amber-600",
};
const GROUP_LIGHT: Record<string,string> = {
  overview:"bg-indigo-50 border-indigo-100",
  team:     "bg-violet-50 border-violet-100",
  projects: "bg-blue-50 border-blue-100",
  integrations:"bg-cyan-50 border-cyan-100",
  automation:"bg-emerald-50 border-emerald-100",
  developer:"bg-amber-50 border-amber-100",
};
const GROUP_TEXT: Record<string,string> = {
  overview:"text-indigo-700",
  team:     "text-violet-700",
  projects: "text-blue-700",
  integrations:"text-cyan-700",
  automation:"text-emerald-700",
  developer:"text-amber-700",
};

function ConceptB({onCmdK}:{onCmdK:()=>void}) {
  const [activeGroup,setActiveGroup] = useState<string|null>(null);
  const [view,setView] = useState<string|null>(null);
  const [recentViews] = useState(["members","api_keys","github","audit"]);

  const group = ADMIN_GROUPS.find(g=>g.id===activeGroup);

  // Hub screen
  if(!activeGroup) return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Settings</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Travli workspace · Super Admin</p>
          </div>
          <button onClick={onCmdK} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:border-neutral-300 hover:bg-white transition">
            🔍 Search settings <kbd className="text-[9px] font-mono bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded ml-1">⌘K</kbd>
          </button>
        </div>

        {/* Alerts */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {icon:"🛡️",color:"bg-red-50 border-red-200 text-red-800",msg:"Security: 2FA not enforced for 2 members",target:"team"},
            {icon:"👤",color:"bg-amber-50 border-amber-200 text-amber-800",msg:"1 pending invite — riley@acme.io",target:"team"},
          ].map((a,i)=>(
            <button key={i} onClick={()=>{setActiveGroup(a.target);setView(a.target==="team"?i===0?"security":"members":a.target);}}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm font-medium transition hover:opacity-90 ${a.color}`}>
              <span className="text-base">{a.icon}</span>
              <span className="flex-1">{a.msg}</span>
              <span className="text-xs opacity-60">→</span>
            </button>
          ))}
        </div>

        {/* Recently visited */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Recently visited</div>
          <div className="flex gap-2 flex-wrap">
            {recentViews.map(v=>{
              const item = ALL_ADMIN_ITEMS.find(i=>i.id===v);
              const grp = ADMIN_GROUPS.find(g=>g.items.some(i=>i.id===v));
              return item && grp ? (
                <button key={v} onClick={()=>{setActiveGroup(grp.id);setView(v);}}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs font-medium text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 transition">
                  <span>{item.icon}</span>{item.label}
                </button>
              ) : null;
            })}
          </div>
        </div>

        {/* Category cards */}
        <div className="grid grid-cols-3 gap-4">
          {ADMIN_GROUPS.map(g=>{
            const totalBadge = g.items.reduce((s,i)=>s+i.badge,0);
            return (
              <button key={g.id} onClick={()=>{setActiveGroup(g.id);setView(g.items[0].id);}}
                className="bg-white rounded-2xl border border-neutral-200 p-5 text-left hover:border-neutral-300 hover:shadow-md transition-all group">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${GROUP_COLORS[g.id]} flex items-center justify-center text-white text-xl mb-4 group-hover:scale-105 transition-transform`}>
                  {GROUP_ILLUSTRATIONS[g.id]}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-neutral-900">{g.label}</span>
                  {totalBadge>0 && <span className="text-[9px] font-bold bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">{totalBadge}</span>}
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{g.items.map(i=>i.label).join(" · ")}</p>
                <div className="mt-3 text-[10px] font-semibold text-neutral-400 group-hover:text-indigo-600 transition">
                  {g.items.length} settings →
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Drill-down: show group sidebar + content
  return (
    <div className="flex h-full overflow-hidden">
      {/* Contextual mini sidebar */}
      <div className="w-52 shrink-0 bg-white border-r border-neutral-200 flex flex-col">
        {/* Back to hub */}
        <button onClick={()=>{setActiveGroup(null);setView(null);}}
          className="flex items-center gap-2 px-4 py-3.5 border-b border-neutral-100 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition">
          <span>←</span> All settings
        </button>

        {/* Group identity */}
        <div className="px-4 py-3 border-b border-neutral-100">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${GROUP_COLORS[group?.id??""]} flex items-center justify-center text-white text-base mb-2`}>
            {GROUP_ILLUSTRATIONS[group?.id??""]}
          </div>
          <div className="text-sm font-bold text-neutral-900">{group?.label}</div>
        </div>

        {/* Group items */}
        <nav className="flex-1 p-2">
          {group?.items.map(item=>{
            const active = view===item.id;
            return (
              <button key={item.id} onClick={()=>setView(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition mb-0.5 text-left ${
                  active
                    ? `${GROUP_LIGHT[group.id]} ${GROUP_TEXT[group.id]} border font-semibold`
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}>
                <span className="w-4 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge>0 && <span className="text-[9px] font-bold bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">{item.badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-neutral-50">
        {/* Breadcrumb */}
        <div className="px-6 py-3 border-b border-neutral-200 bg-white flex items-center gap-2 text-xs text-neutral-400">
          <button onClick={()=>{setActiveGroup(null);setView(null);}} className="hover:text-neutral-700 transition">Settings</button>
          <span>›</span>
          <button onClick={()=>setView(group?.items[0].id??null)} className="hover:text-neutral-700 transition">{group?.label}</button>
          <span>›</span>
          <span className="font-semibold text-neutral-900">{ALL_ADMIN_ITEMS.find(i=>i.id===view)?.label}</span>
        </div>
        <div className="p-6">
          <AdminContent view={view??""} />
        </div>
      </div>
    </div>
  );
}

function AdminShell({onCmdK}:{onCmdK:()=>void}) {
  const [concept,setConcept] = useState<"A"|"B">("A");

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] overflow-hidden">
      {/* Concept switcher bar */}
      <div className="shrink-0 flex items-center gap-4 px-5 py-2.5 bg-neutral-900 border-b border-neutral-800">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Admin Nav Design</span>
        <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-0.5">
          {(["A","B"] as const).map(c=>(
            <button key={c} onClick={()=>setConcept(c)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${concept===c?"bg-white text-neutral-900 shadow":"text-neutral-400 hover:text-white"}`}>
              {c==="A"?"A · Grouped Sidebar":"B · Settings Hub"}
            </button>
          ))}
        </div>
        <div className="text-xs text-neutral-500">
          {concept==="A"
            ? "Persistent grouped sidebar — GitHub / Linear / Stripe pattern"
            : "Card hub + drill-down — Stripe dashboard / Intercom pattern"}
        </div>
      </div>

      {/* Concept renders */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {concept==="A" && <ConceptA onCmdK={onCmdK}/>}
        {concept==="B" && <ConceptB onCmdK={onCmdK}/>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MAIN DESIGN PAGE
// ══════════════════════════════════════════════════════════════

type Role = "developer"|"pm"|"collaborator"|"admin";

const ROLE_CFG: Record<Role,{label:string;emoji:string;user:string;color:string;desc:string}> = {
  developer:   {label:"Developer",   emoji:"💻", user:"u1", color:"bg-indigo-600",  desc:"Matt Giblin — Lead Dev"},
  pm:          {label:"PM",          emoji:"📊", user:"u4", color:"bg-amber-600",   desc:"Jordan Lee — Product"},
  collaborator:{label:"Collaborator",emoji:"🤝", user:"u6", color:"bg-teal-600",    desc:"Dana Walsh — QA Eng"},
  admin:       {label:"Admin",       emoji:"⚙️", user:"u1", color:"bg-neutral-800", desc:"Matt Giblin — Super Admin"},
};

const UNREAD: Record<Role,number> = {developer:5,pm:3,collaborator:3,admin:4};

export default function DesignPage() {
  const [role,setRole]       = useState<Role>("developer");
  const [notifOpen,setNotifOpen] = useState(false);
  const [cmdOpen,setCmdOpen]     = useState(false);

  // ⌘K shortcut
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setCmdOpen(true);} };
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h);
  },[]);

  const cfg = ROLE_CFG[role];
  const unread = UNREAD[role];

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col">
      {/* ── TOP NAV ── */}
      <div className="h-14 bg-white border-b border-neutral-200 flex items-center px-4 gap-3 shrink-0 z-30 sticky top-0">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center text-white text-sm font-bold">F</div>
          <span className="text-sm font-bold text-neutral-900 hidden sm:block">Forge</span>
        </div>

        {/* Role switcher */}
        <div className="flex items-center gap-1 bg-neutral-100 rounded-xl p-1">
          {(Object.entries(ROLE_CFG) as [Role,typeof ROLE_CFG[Role]][]).map(([r,c])=>(
            <button key={r} onClick={()=>setRole(r)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${role===r?`${c.color} text-white shadow-sm`:"text-neutral-500 hover:text-neutral-800 hover:bg-white"}`}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <div className="flex-1"/>

        {/* ⌘K */}
        <button onClick={()=>setCmdOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:border-neutral-400 hover:bg-neutral-50 transition">
          <span>🔍</span>
          <span>Search</span>
          <kbd className="text-[10px] font-mono bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>

        {/* Bell */}
        <button onClick={()=>setNotifOpen(o=>!o)}
          className="relative w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 transition">
          🔔
          {unread>0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">{unread}</span>
          )}
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-neutral-100">
          <Av id={cfg.user} size="sm"/>
          <div className="hidden md:block">
            <div className="text-xs font-semibold text-neutral-900">{teamById[cfg.user]?.name}</div>
            <div className="text-[10px] text-neutral-400">{role === "admin" ? "Super Admin" : teamById[cfg.user]?.role}</div>
          </div>
        </div>
      </div>

      {/* ── ROLE DESCRIPTION STRIP ── */}
      <div className={`px-4 py-1.5 text-xs flex items-center gap-2 text-white ${cfg.color}`}>
        <span className="font-semibold">{cfg.emoji} {cfg.label} View:</span>
        <span className="opacity-90">{cfg.desc}</span>
        <span className="ml-2 opacity-70">·</span>
        <span className="opacity-90">Click 🔔 to see your notifications · Press <kbd className="bg-white/20 px-1 rounded font-mono">⌘K</kbd> for command palette · Click any issue to open full detail</span>
        <span className="ml-auto opacity-70">Switch roles using the tabs in the nav ↑</span>
      </div>

      {/* ── SHELL ── */}
      <div className="flex-1 overflow-hidden">
        {role==="developer"    && <DeveloperShell    onCmdK={()=>setCmdOpen(true)}/>}
        {role==="pm"           && <PMShell           onCmdK={()=>setCmdOpen(true)}/>}
        {role==="collaborator" && <CollaboratorShell onCmdK={()=>setCmdOpen(true)}/>}
        {role==="admin"        && <AdminShell        onCmdK={()=>setCmdOpen(true)}/>}
      </div>

      {/* ── GLOBAL OVERLAYS ── */}
      <CommandPalette   open={cmdOpen}   onClose={()=>setCmdOpen(false)}   role={role}/>
      <NotificationPanel open={notifOpen} onClose={()=>setNotifOpen(false)} role={role}/>
    </div>
  );
}
