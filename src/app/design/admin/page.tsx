"use client";
/* eslint-disable react/no-unescaped-entities -- design prototype */

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────

type Plan   = "basic" | "premium" | "pro" | "enterprise";
type Status = "trialing" | "active" | "expired" | "cancelled";
type View   = "dashboard" | "tenants" | "flags" | "detail" | "ai";
type DTab   = "overview" | "features" | "billing" | "members" | "audit" | "ai";

interface AIComponent {
  name: string;
  calls: number;
  tokens: number;
  spend: number;
  trend: "up" | "down" | "flat";
}

interface TenantAI {
  totalCalls: number;
  totalTokens: number;
  totalSpend: number;
  components: AIComponent[];
  dailyTrend: number[];  // 7-day call counts
  topUser: string;
}

interface Tenant {
  id: string; name: string; slug: string; plan: Plan; status: Status;
  health: number; seats: number; seatLimit: number; lastActive: string;
  aiCalls: number; trialDays: number | null; mrr: number;
  overrides: Record<string, boolean>;
  ai: TenantAI;
}

// ── Mock Data ──────────────────────────────────────────────────

const TENANTS: Tenant[] = [
  {
    id:"1", name:"Acme Engineering", slug:"acme-engineering", plan:"premium", status:"trialing",
    health:28, seats:1, seatLimit:5, lastActive:"8d ago", aiCalls:0, trialDays:2, mrr:0,
    overrides:{ reports: true },
    ai:{ totalCalls:0, totalTokens:0, totalSpend:0, components:[], dailyTrend:[0,0,0,0,0,0,0], topUser:"—" },
  },
  {
    id:"2", name:"Beta Tester Co", slug:"beta-tester", plan:"basic", status:"expired",
    health:12, seats:0, seatLimit:1, lastActive:"22d ago", aiCalls:0, trialDays:null, mrr:0,
    overrides:{},
    ai:{ totalCalls:0, totalTokens:0, totalSpend:0, components:[], dailyTrend:[0,0,0,0,0,0,0], topUser:"—" },
  },
  {
    id:"3", name:"Northfield Team", slug:"northfield", plan:"premium", status:"trialing",
    health:52, seats:2, seatLimit:5, lastActive:"3d ago", aiCalls:3, trialDays:6, mrr:0,
    overrides:{},
    ai:{
      totalCalls:21, totalTokens:44200, totalSpend:0.18,
      dailyTrend:[2,4,1,5,3,4,2],
      topUser:"alex@northfield.io",
      components:[
        { name:"AI Sprint Intelligence", calls:14, tokens:31000, spend:0.12, trend:"up"   },
        { name:"Think Tank",             calls:7,  tokens:13200, spend:0.06, trend:"flat" },
      ],
    },
  },
  {
    id:"4", name:"Travli", slug:"travli", plan:"premium", status:"active",
    health:61, seats:3, seatLimit:10, lastActive:"1d ago", aiCalls:14, trialDays:null, mrr:57,
    overrides:{ thinktank: false },
    ai:{
      totalCalls:98, totalTokens:201000, totalSpend:0.81,
      dailyTrend:[12,18,11,14,16,15,12],
      topUser:"jane@travli.com",
      components:[
        { name:"AI Sprint Intelligence", calls:52, tokens:108000, spend:0.43, trend:"up"   },
        { name:"Think Tank",             calls:31, tokens:67000,  spend:0.27, trend:"flat" },
        { name:"Sounding Board",         calls:15, tokens:26000,  spend:0.11, trend:"down" },
      ],
    },
  },
  {
    id:"5", name:"DevOps Corp", slug:"devops-corp", plan:"premium", status:"active",
    health:84, seats:8, seatLimit:10, lastActive:"Today", aiCalls:31, trialDays:null, mrr:152,
    overrides:{},
    ai:{
      totalCalls:217, totalTokens:445000, totalSpend:1.78,
      dailyTrend:[28,34,29,31,33,30,32],
      topUser:"cto@devopscorp.io",
      components:[
        { name:"AI Sprint Intelligence", calls:104, tokens:214000, spend:0.86, trend:"up"   },
        { name:"Think Tank",             calls:68,  tokens:139000, spend:0.56, trend:"up"   },
        { name:"Sounding Board",         calls:45,  tokens:92000,  spend:0.36, trend:"flat" },
      ],
    },
  },
  {
    id:"6", name:"Westbrook Studio", slug:"westbrook", plan:"premium", status:"active",
    health:91, seats:5, seatLimit:10, lastActive:"Today", aiCalls:22, trialDays:null, mrr:95,
    overrides:{},
    ai:{
      totalCalls:154, totalTokens:316000, totalSpend:1.26,
      dailyTrend:[20,22,19,24,21,23,25],
      topUser:"lead@westbrook.io",
      components:[
        { name:"AI Sprint Intelligence", calls:89,  tokens:183000, spend:0.73, trend:"up"   },
        { name:"Think Tank",             calls:65,  tokens:133000, spend:0.53, trend:"up"   },
      ],
    },
  },
  {
    id:"7", name:"Lakeside Products", slug:"lakeside", plan:"basic", status:"active",
    health:74, seats:3, seatLimit:5, lastActive:"2d ago", aiCalls:0, trialDays:null, mrr:27,
    overrides:{ mission: true },
    ai:{ totalCalls:0, totalTokens:0, totalSpend:0, components:[], dailyTrend:[0,0,0,0,0,0,0], topUser:"—" },
  },
  {
    id:"8", name:"Alpine Dev Group", slug:"alpine-dev", plan:"premium", status:"trialing",
    health:45, seats:4, seatLimit:5, lastActive:"4d ago", aiCalls:8, trialDays:11, mrr:0,
    overrides:{},
    ai:{
      totalCalls:56, totalTokens:115000, totalSpend:0.46,
      dailyTrend:[6,9,7,8,10,8,8],
      topUser:"dev@alpinedev.io",
      components:[
        { name:"AI Sprint Intelligence", calls:38, tokens:78000,  spend:0.31, trend:"up"   },
        { name:"Think Tank",             calls:18, tokens:37000,  spend:0.15, trend:"flat" },
      ],
    },
  },
];

// Plan defaults
const PLAN_DEFAULTS: Record<string, Record<Plan, boolean | null>> = {
  kanban:    { basic:true,  premium:true,  pro:true,  enterprise:true  },
  sprints:   { basic:true,  premium:true,  pro:true,  enterprise:true  },
  burndown:  { basic:true,  premium:true,  pro:true,  enterprise:true  },
  mission:   { basic:false, premium:true,  pro:true,  enterprise:true  },
  portal:    { basic:false, premium:true,  pro:true,  enterprise:true  },
  reports:   { basic:false, premium:true,  pro:true,  enterprise:true  },
  ai_sprint: { basic:false, premium:true,  pro:true,  enterprise:true  },
  thinktank: { basic:false, premium:true,  pro:true,  enterprise:true  },
  sso:       { basic:false, premium:false, pro:null,  enterprise:null  },
  adv_ai:    { basic:false, premium:false, pro:null,  enterprise:null  },
  webhooks:  { basic:false, premium:false, pro:null,  enterprise:null  },
};

const FEATURE_LABELS: Record<string, string> = {
  kanban:    "Kanban Board + Issues",
  sprints:   "Sprint Planning",
  burndown:  "Burndown / Velocity Charts",
  mission:   "Mission Control Dashboards",
  portal:    "Project Portal (Timeline + Costs)",
  reports:   "Custom Report Builder",
  ai_sprint: "AI Sprint Intelligence",
  thinktank: "Think Tank (Ideas)",
  sso:       "SSO / SAML",
  adv_ai:    "Advanced AI Assistant",
  webhooks:  "Custom Webhooks",
};

const AUDIT_LOG = [
  { time:"Jun 20 · 9:12am", type:"tenant.provisioned", color:"#6366f1", msg:"Tenant created via admin portal", actor:"Matt G." },
  { time:"Jun 20 · 9:13am", type:"trial.started",      color:"#059669", msg:"14-day Premium trial activated",  actor:"System"  },
  { time:"Jun 21 · 2:44pm", type:"flag.override",      color:"#d97706", msg:"Custom Report Builder enabled (override)", actor:"Matt G." },
  { time:"Jun 28 · 8:00am", type:"health.alert",       color:"#dc2626", msg:"Health score dropped below 30 — no activity in 8 days", actor:"System" },
];

// ── Helpers ────────────────────────────────────────────────────

function hc(h: number) {
  if (h >= 70) return { dot:"#10b981", text:"#059669", bg:"#f0fdf4", border:"#bbf7d0" };
  if (h >= 40) return { dot:"#f59e0b", text:"#d97706", bg:"#fffbeb", border:"#fde68a" };
  return { dot:"#ef4444", text:"#dc2626", bg:"#fef2f2", border:"#fecaca" };
}

function planLabel(t: Tenant) {
  if (t.status === "expired")  return { label:"Expired",    cls:"badge-red"    };
  if (t.status === "trialing") return { label:"Trial",      cls:"badge-amber"  };
  if (t.plan === "premium")    return { label:"Premium",    cls:"badge-indigo" };
  if (t.plan === "pro")        return { label:"Pro",        cls:"badge-green"  };
  if (t.plan === "enterprise") return { label:"Enterprise", cls:"badge-purple" };
  return { label:"Basic", cls:"badge-gray" };
}

function featureAccess(t: Tenant, key: string) {
  const planVal = PLAN_DEFAULTS[key]?.[t.plan];
  if (planVal === null) return { enabled:false, source:"locked" as const };
  if (key in t.overrides) return { enabled:t.overrides[key], source:(t.overrides[key] ? "override-on" as const : "override-off" as const) };
  return { enabled:planVal, source:"plan" as const };
}

function fmt$(n: number) { return n < 1 ? `${(n*100).toFixed(0)}¢` : `$${n.toFixed(2)}`; }
function fmtK(n: number) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n); }

// ── Micro sparkline ────────────────────────────────────────────

function Spark({ data, color = "#6366f1" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const W = 80, H = 28, pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - (v / max) * (H - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={W} height={H} style={{ display:"block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Bar chart (horizontal) ─────────────────────────────────────

function HBar({ value, max, color = "#6366f1" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:6, background:"#f1f5f9", borderRadius:9 }}>
        <div style={{ height:6, width:`${pct}%`, background:color, borderRadius:9, transition:"width .3s" }} />
      </div>
      <span style={{ fontSize:11, color:"#6b7280", width:32, textAlign:"right" }}>{pct}%</span>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function PlanBadge({ t }: { t: Tenant }) {
  const { label, cls } = planLabel(t);
  return <span className={`badge ${cls}`}>{label}</span>;
}

function HealthPill({ h }: { h: number }) {
  const c = hc(h);
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontWeight:700, fontSize:13 }}>
      <span style={{ width:8, height:8, borderRadius:"50%", background:c.dot, display:"inline-block" }} />
      <span style={{ color:c.text }}>{h}</span>
    </span>
  );
}

// ── Platform AI View ───────────────────────────────────────────

function PlatformAI({ tenants, onView }: { tenants: Tenant[]; onView: (id: string, tab: DTab) => void }) {
  const totalCalls  = tenants.reduce((s, t) => s + t.ai.totalCalls, 0);
  const totalTokens = tenants.reduce((s, t) => s + t.ai.totalTokens, 0);
  const totalSpend  = tenants.reduce((s, t) => s + t.ai.totalSpend, 0);
  const byTenant    = [...tenants].sort((a, b) => b.ai.totalCalls - a.ai.totalCalls).filter(t => t.ai.totalCalls > 0);

  // Component totals across all tenants
  const compMap: Record<string, { calls:number; spend:number }> = {};
  tenants.forEach(t => t.ai.components.forEach(c => {
    if (!compMap[c.name]) compMap[c.name] = { calls:0, spend:0 };
    compMap[c.name].calls += c.calls;
    compMap[c.name].spend += c.spend;
  }));
  const compTotals = Object.entries(compMap).sort((a, b) => b[1].calls - a[1].calls);
  const maxCalls = byTenant[0]?.ai.totalCalls ?? 1;
  const maxComp  = compTotals[0]?.[1].calls ?? 1;

  // Platform 7-day combined trend
  const platformTrend = Array.from({ length:7 }, (_, i) =>
    tenants.reduce((s, t) => s + (t.ai.dailyTrend[i] ?? 0), 0)
  );

  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <div className="content-scroll">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Analytics</h1>
          <p className="page-sub">Platform-wide AI usage across all tenants. Click any tenant to drill into component-level detail.</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <select className="sel">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>This month</option>
          </select>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          { label:"Total AI Calls",    val:fmtK(totalCalls),           sub:"across all tenants",         color:"#6366f1" },
          { label:"Total Tokens Used", val:fmtK(totalTokens),          sub:"input + output tokens",      color:"#0891b2" },
          { label:"Est. AI Spend",     val:fmt$(totalSpend),           sub:"Grok API cost this period",  color:"#059669" },
          { label:"Cost / Call",       val:totalCalls > 0 ? fmt$(totalSpend/totalCalls) : "—", sub:"average across all calls", color:"#d97706" },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-val" style={{ color:k.color }}>{k.val}</div>
            <div className="kpi-delta muted">{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>

        {/* Platform trend chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Daily AI Calls — Platform Total</span>
            <span style={{ fontSize:11, color:"#94a3b8" }}>Last 7 days</span>
          </div>
          <div style={{ padding:"16px 20px" }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80 }}>
              {platformTrend.map((v, i) => {
                const maxV = Math.max(...platformTrend, 1);
                const h = Math.round((v / maxV) * 72);
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:10, color:"#94a3b8" }}>{v}</span>
                    <div style={{ width:"100%", height:h, background:"#6366f1", borderRadius:"3px 3px 0 0", minHeight:3, opacity:.85 }} />
                    <span style={{ fontSize:9, color:"#cbd5e1" }}>{days[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* By component */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">AI Calls by Feature / Component</span>
            <span style={{ fontSize:11, color:"#94a3b8" }}>All tenants combined</span>
          </div>
          <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
            {compTotals.map(([name, data]) => (
              <div key={name}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{name}</span>
                  <span style={{ fontSize:11, color:"#6b7280" }}>{data.calls} calls · {fmt$(data.spend)}</span>
                </div>
                <HBar value={data.calls} max={maxComp} />
              </div>
            ))}
            {compTotals.length === 0 && <p style={{ fontSize:12, color:"#94a3b8" }}>No AI usage recorded yet.</p>}
          </div>
        </div>
      </div>

      {/* Tenant leaderboard */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">AI Usage by Tenant</span>
          <span style={{ fontSize:11, color:"#94a3b8" }}>Click a tenant to see component breakdown</span>
        </div>
        <table className="tbl">
          <thead><tr>
            <th>Tenant</th>
            <th>Plan</th>
            <th>Total Calls</th>
            <th>Tokens Used</th>
            <th>Est. Spend</th>
            <th>Top Feature</th>
            <th>7-Day Trend</th>
            <th>Top User</th>
            <th></th>
          </tr></thead>
          <tbody>
            {byTenant.map(t => {
              const top = t.ai.components.sort((a, b) => b.calls - a.calls)[0];
              return (
                <tr key={t.id} className="tbl-row" onClick={() => onView(t.id, "ai")}>
                  <td>
                    <div className="t-name">{t.name}</div>
                    <div className="t-slug">{t.slug}</div>
                  </td>
                  <td><PlanBadge t={t} /></td>
                  <td>
                    <div style={{ fontWeight:700, fontSize:14, color:"#111827" }}>{t.ai.totalCalls}</div>
                    <HBar value={t.ai.totalCalls} max={maxCalls} color="#6366f1" />
                  </td>
                  <td className="td-m">{fmtK(t.ai.totalTokens)}</td>
                  <td style={{ fontWeight:600, color:"#059669" }}>{fmt$(t.ai.totalSpend)}</td>
                  <td style={{ fontSize:11, color:"#374151" }}>{top?.name ?? "—"}</td>
                  <td><Spark data={t.ai.dailyTrend} /></td>
                  <td style={{ fontSize:11, color:"#6b7280", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.ai.topUser}</td>
                  <td><span className="view-lnk">Drill in →</span></td>
                </tr>
              );
            })}
            {byTenant.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign:"center", color:"#94a3b8", padding:24 }}>No AI usage recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────

function Dashboard({ tenants, onView, onAI }: { tenants: Tenant[]; onView: (id: string) => void; onAI: () => void }) {
  const healthy  = tenants.filter(t => t.health >= 70).length;
  const watch    = tenants.filter(t => t.health >= 40 && t.health < 70).length;
  const atRisk   = tenants.filter(t => t.health < 40).length;
  const trialing = tenants.filter(t => t.status === "trialing").length;
  const paid     = tenants.filter(t => t.status === "active").length;
  const aiTotal  = tenants.reduce((s, t) => s + t.ai.totalCalls, 0);
  const aiSpend  = tenants.reduce((s, t) => s + t.ai.totalSpend, 0);
  const sorted   = [...tenants].sort((a, b) => a.health - b.health);
  const topAI    = [...tenants].sort((a, b) => b.ai.totalCalls - a.ai.totalCalls).slice(0, 3);

  return (
    <div className="content-scroll">
      {atRisk > 0 && (
        <div className="alert-banner">
          <span className="alert-icon">⚠</span>
          <span><strong>{atRisk} tenant{atRisk > 1 ? "s" : ""} at risk</strong> — health below 40. Review and intervene before trial expires.</span>
          <button className="alert-btn" onClick={() => onView(sorted[0].id)}>Review now →</button>
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-row">
        {[
          { label:"Total Tenants",  val:tenants.length, delta:"↑ 3 this month",      dc:"green" },
          { label:"Active Trials",  val:trialing,       delta:"4 expire in ≤7 days", dc:"amber" },
          { label:"Paid Tenants",   val:paid,           delta:"↑ 2 converted",       dc:"green" },
          { label:"MRR",            val:"—",            delta:"Stripe pending",       dc:"muted" },
          { label:"AI Calls / Day", val:aiTotal,        delta:"↑ 12% this week",     dc:"green" },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-val">{k.val}</div>
            <div className={`kpi-delta ${k.dc}`}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Health strip — compact inline pills */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[
          { n:healthy, label:"Healthy",  sub:"70–100", bg:"#f0fdf4", border:"#bbf7d0", col:"#059669" },
          { n:watch,   label:"Watch",    sub:"40–69",  bg:"#fffbeb", border:"#fde68a", col:"#d97706" },
          { n:atRisk,  label:"At Risk",  sub:"<40",    bg:"#fef2f2", border:"#fecaca", col:"#dc2626" },
        ].map(s => (
          <div key={s.label} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", background:s.bg, border:`1px solid ${s.border}`, borderRadius:9, flex:1 }}>
            <span style={{ fontSize:22, fontWeight:900, color:s.col, lineHeight:1 }}>{s.n}</span>
            <span style={{ fontSize:12, fontWeight:600, color:s.col }}>{s.label}</span>
            <span style={{ fontSize:11, color:"#94a3b8", marginLeft:"auto" }}>{s.sub}</span>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:14, marginBottom:14 }}>
        {/* AI spend card */}
        <div className="card" style={{ marginBottom:0 }}>
          <div className="card-header" style={{ paddingBottom:10 }}>
            <span className="card-title">AI Spend This Week</span>
            <button onClick={onAI} className="view-lnk" style={{ background:"none", border:"none", cursor:"pointer", fontSize:12 }}>Full analytics →</button>
          </div>
          <div style={{ padding:"12px 16px" }}>
            <div style={{ fontSize:28, fontWeight:900, color:"#059669", marginBottom:2 }}>{fmt$(aiSpend)}</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginBottom:12 }}>{fmtK(aiTotal)} total calls · Grok API</div>
            {topAI.filter(t => t.ai.totalCalls > 0).map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <span style={{ fontSize:11, color:"#374151", flex:1, cursor:"pointer", fontWeight:500 }} onClick={() => onView(t.id)}>{t.name}</span>
                <Spark data={t.ai.dailyTrend} color="#6366f1" />
                <span style={{ fontSize:11, fontWeight:600, color:"#6366f1", width:36, textAlign:"right" }}>{t.ai.totalCalls}</span>
              </div>
            ))}
            <button onClick={onAI} style={{ marginTop:8, width:"100%", padding:"7px 0", background:"#f5f3ff", border:"1px solid #e0e7ff", borderRadius:7, color:"#4f46e5", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              View AI analytics →
            </button>
          </div>
        </div>
      </div>

      {/* Tenant table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Tenants</span>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <select className="sel"><option>All plans</option><option>Trial</option><option>Premium</option><option>Basic</option></select>
            <select className="sel"><option>All health</option><option>At Risk</option><option>Watch</option><option>Healthy</option></select>
          </div>
        </div>
        <table className="tbl">
          <thead><tr>
            <th>Tenant</th><th>Plan</th><th>Health</th><th>Seats</th>
            <th>Last Active</th><th>AI Calls</th><th>Trial / Status</th><th></th>
          </tr></thead>
          <tbody>
            {sorted.map(t => (
              <tr key={t.id} className="tbl-row" onClick={() => onView(t.id)}>
                <td>
                  <div className="t-name">{t.name}</div>
                  <div className="t-slug">{t.slug}</div>
                </td>
                <td><PlanBadge t={t} /></td>
                <td><HealthPill h={t.health} /></td>
                <td className="td-m">{t.seats}/{t.seatLimit}</td>
                <td className="td-m">{t.lastActive}</td>
                <td>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontWeight:600, color: t.ai.totalCalls > 0 ? "#6366f1" : "#94a3b8" }}>{t.ai.totalCalls}</span>
                    {t.ai.totalCalls > 0 && <Spark data={t.ai.dailyTrend} color="#6366f1" />}
                  </div>
                </td>
                <td>
                  {t.status === "trialing" && t.trialDays !== null && <span style={{ fontSize:11, fontWeight:600, color: t.trialDays <= 3 ? "#dc2626" : "#d97706" }}>{t.trialDays}d left</span>}
                  {t.status === "expired"  && <span style={{ fontSize:11, fontWeight:600, color:"#dc2626" }}>Expired</span>}
                  {t.status === "active"   && <span style={{ fontSize:11, fontWeight:500, color:"#059669" }}>Active</span>}
                </td>
                <td><span className="view-lnk">View →</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Feature Matrix ─────────────────────────────────────────────

function FeatureMatrix() {
  const plans: Plan[] = ["basic","premium","pro","enterprise"];
  const planMeta = {
    basic:      { color:"#64748b", price:"$9/seat"  },
    premium:    { color:"#6366f1", price:"$19/seat" },
    pro:        { color:"#059669", price:"Coming"   },
    enterprise: { color:"#d97706", price:"Custom"   },
  };
  const Cell = ({ val }: { val: boolean | null }) => {
    if (val === null) return <span style={{ fontSize:10, color:"#94a3b8" }}>Soon</span>;
    if (val) return <span style={{ color:"#059669", fontSize:15, fontWeight:700 }}>✓</span>;
    return <span style={{ color:"#e2e8f0", fontSize:18 }}>—</span>;
  };
  return (
    <div className="content-scroll">
      <div className="page-header">
        <div>
          <h1 className="page-title">Feature Access</h1>
          <p className="page-sub">Define what each plan includes. Assign a plan to a tenant and features flow automatically. Use Tenant Detail for individual overrides.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Plan Matrix — What Each Plan Includes</span>
          <span style={{ fontSize:11, color:"#94a3b8" }}>Set defaults once · override per-tenant on the Tenant page</span>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table className="tbl">
            <thead><tr>
              <th style={{ textAlign:"left", width:260 }}>Feature</th>
              {plans.map(p => (
                <th key={p} style={{ textAlign:"center" }}>
                  <span style={{ color:planMeta[p].color, fontWeight:700 }}>{p.charAt(0).toUpperCase()+p.slice(1)}</span>
                  <div style={{ fontSize:10, fontWeight:400, color:"#94a3b8", marginTop:2 }}>{planMeta[p].price}</div>
                </th>
              ))}
            </tr></thead>
            <tbody>
              {Object.keys(FEATURE_LABELS).map(key => (
                <tr key={key}>
                  <td style={{ textAlign:"left", fontSize:13, color:"#374151", fontWeight:500 }}>{FEATURE_LABELS[key]}</td>
                  {plans.map(p => (
                    <td key={p} style={{ textAlign:"center" }}><Cell val={PLAN_DEFAULTS[key]?.[p] ?? false} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="info-box">
        <strong>How it works:</strong> Assign a tenant to Premium → every ✓ in the Premium column is automatically enabled. No manual flag toggling needed.
        To give a Basic tenant access to a Premium feature, or lock something off for a specific tenant, use the <strong>Feature Access tab</strong> on their Tenant Detail page.
      </div>
    </div>
  );
}

// ── Tenant Detail ──────────────────────────────────────────────

function TenantDetail({ tenants, id, onBack, initialTab = "overview" }: { tenants: Tenant[]; id: string; onBack: () => void; initialTab?: DTab }) {
  const [tab, setTab] = useState<DTab>(initialTab);
  const t = tenants.find(x => x.id === id) ?? tenants[0];
  const c = hc(t.health);

  const TABS: { key: DTab; label: string }[] = [
    { key:"overview",  label:"Overview"       },
    { key:"ai",        label:"AI Usage"       },
    { key:"features",  label:"Feature Access" },
    { key:"billing",   label:"Billing / Plan" },
    { key:"members",   label:"Members"        },
    { key:"audit",     label:"Audit Log"      },
  ];

  const compMax = Math.max(...t.ai.components.map(c => c.calls), 1);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div className="detail-hdr">
        <button className="back-btn" onClick={onBack}>← All Tenants</button>
        <div>
          <div className="detail-title">{t.name}</div>
          <div className="detail-sub">
            {t.slug} · <PlanBadge t={t} />
            {t.status === "trialing" && t.trialDays !== null && (
              <span style={{ color:"#d97706", fontWeight:600, marginLeft:6 }}>Trial — {t.trialDays} days left</span>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:"auto" }}>
          <button className="btn-sm btn-ghost">👁 View As Tenant</button>
          <button className="btn-sm btn-ghost">📧 Email</button>
          {t.status === "trialing" && <button className="btn-sm btn-primary">⚡ Extend Trial</button>}
          {t.status !== "active"   && <button className="btn-sm btn-green">✓ Activate</button>}
        </div>
      </div>

      <div className="dtab-bar">
        {TABS.map(tb => (
          <button key={tb.key} className={`dtab ${tab === tb.key ? "active" : ""}`} onClick={() => setTab(tb.key)}>
            {tb.label}
          </button>
        ))}
      </div>

      <div className="content-scroll">

        {/* ── Overview ── */}
        {tab === "overview" && (
          <>
            <div className="ov-grid">
              <div className="ov-card" style={{ borderTop:`3px solid ${c.dot}` }}>
                <div className="ov-label">Health Score</div>
                <div className="ov-val" style={{ color:c.text }}>{t.health}<span style={{ fontSize:13, color:"#94a3b8", fontWeight:400 }}> / 100</span></div>
                <div style={{ fontSize:11, color:c.text, marginTop:3, fontWeight:600 }}>
                  {t.health >= 70 ? "✓ Healthy" : t.health >= 40 ? "⚠ Needs attention" : "✗ At risk"}
                </div>
                <div style={{ marginTop:8, height:4, background:"#f1f5f9", borderRadius:9 }}>
                  <div style={{ height:4, width:`${t.health}%`, background:c.dot, borderRadius:9 }} />
                </div>
              </div>
              <div className="ov-card">
                <div className="ov-label">Plan</div>
                <div className="ov-val" style={{ fontSize:17, marginTop:8 }}>{t.plan.charAt(0).toUpperCase()+t.plan.slice(1)} {t.status === "trialing" ? "Trial" : ""}</div>
                {t.trialDays !== null && <div style={{ fontSize:11, color:"#d97706", marginTop:3, fontWeight:600 }}>Expires in {t.trialDays} days</div>}
              </div>
              <div className="ov-card">
                <div className="ov-label">Seat Utilization</div>
                <div className="ov-val">{t.seats}<span style={{ fontSize:13, color:"#94a3b8", fontWeight:400 }}> / {t.seatLimit}</span></div>
                <div style={{ marginTop:8, height:4, background:"#f1f5f9", borderRadius:9 }}>
                  <div style={{ height:4, width:`${Math.round(t.seats/t.seatLimit*100)}%`, background: t.seats/t.seatLimit < 0.3 ? "#ef4444" : "#6366f1", borderRadius:9 }} />
                </div>
              </div>
              <div className="ov-card">
                <div className="ov-label">AI Calls This Week</div>
                <div className="ov-val" style={{ color: t.ai.totalCalls > 0 ? "#6366f1" : "#94a3b8" }}>{t.ai.totalCalls}</div>
                <div style={{ fontSize:11, color:"#94a3b8", marginTop:3 }}>Est. spend: {fmt$(t.ai.totalSpend)}</div>
              </div>
            </div>

            <div className="section-label">Health Signal Breakdown</div>
            <div className="hb-row" style={{ marginBottom:20 }}>
              {[
                { val: t.health < 40 ? "0" : "3",  label:"Issues (7d)",   bad: t.health < 40 },
                { val: t.health < 40 ? "0" : "1",  label:"Sprints (30d)", bad: t.health < 40 },
                { val: t.lastActive,                 label:"Last Login",    bad: t.lastActive.includes("d ago") && parseInt(t.lastActive) > 5 },
                { val: String(t.ai.totalCalls),      label:"AI Calls/wk",  bad: t.ai.totalCalls === 0 },
                { val: Math.round(t.seats/t.seatLimit*100)+"%", label:"Seat Usage", bad: t.seats/t.seatLimit < 0.3 },
              ].map(s => (
                <div key={s.label} className="hb-stat">
                  <div className="hb-stat-val" style={{ color: s.bad ? "#dc2626" : "#111827" }}>{s.val}</div>
                  <div className="hb-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="section-label">Actions</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {t.status === "trialing" && <>
                <button className="btn btn-primary">Upgrade → Premium</button>
                <button className="btn btn-outline">Extend Trial 7d</button>
                <button className="btn btn-outline">Extend Trial 14d</button>
                <button className="btn btn-outline">Extend Trial 30d</button>
              </>}
              {t.status === "active" && <>
                <button className="btn btn-primary">Change Plan</button>
                <button className="btn btn-outline">Adjust Seat Limit</button>
              </>}
              {t.status === "expired" && <button className="btn btn-primary">Reactivate</button>}
              <button className="btn btn-danger">Suspend Account</button>
            </div>
          </>
        )}

        {/* ── AI Usage ── */}
        {tab === "ai" && (
          <>
            {t.ai.totalCalls === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 0", color:"#94a3b8" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🤖</div>
                <p style={{ fontSize:14, fontWeight:600, color:"#374151" }}>No AI usage recorded</p>
                <p style={{ fontSize:12, marginTop:4 }}>This tenant hasn't used any AI features yet.</p>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
                  <div className="ov-card"><div className="ov-label">Total Calls</div><div className="ov-val" style={{ color:"#6366f1" }}>{t.ai.totalCalls}</div></div>
                  <div className="ov-card"><div className="ov-label">Tokens Used</div><div className="ov-val" style={{ fontSize:18, marginTop:6 }}>{fmtK(t.ai.totalTokens)}</div></div>
                  <div className="ov-card"><div className="ov-label">Est. Spend</div><div className="ov-val" style={{ color:"#059669" }}>{fmt$(t.ai.totalSpend)}</div></div>
                  <div className="ov-card"><div className="ov-label">Top User</div><div style={{ fontSize:12, fontWeight:600, color:"#374151", marginTop:8, wordBreak:"break-all" }}>{t.ai.topUser}</div></div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                  {/* Sparkline */}
                  <div className="card" style={{ marginBottom:0 }}>
                    <div className="card-header"><span className="card-title">Daily Calls — Last 7 Days</span></div>
                    <div style={{ padding:"16px 20px" }}>
                      <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80 }}>
                        {t.ai.dailyTrend.map((v, i) => {
                          const maxV = Math.max(...t.ai.dailyTrend, 1);
                          const h = Math.round((v / maxV) * 72);
                          const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
                          return (
                            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                              <span style={{ fontSize:10, color:"#94a3b8" }}>{v}</span>
                              <div style={{ width:"100%", height:h, background:"#6366f1", borderRadius:"3px 3px 0 0", minHeight:3, opacity:.85 }} />
                              <span style={{ fontSize:9, color:"#cbd5e1" }}>{days[i]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Component pie-ish */}
                  <div className="card" style={{ marginBottom:0 }}>
                    <div className="card-header"><span className="card-title">Calls by Component</span></div>
                    <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
                      {t.ai.components.map(comp => (
                        <div key={comp.name}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                            <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{comp.name}</span>
                            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                              <span style={{ fontSize:11, color:"#6b7280" }}>{comp.calls} calls</span>
                              <span style={{ fontSize:11, fontWeight:600, color:"#059669" }}>{fmt$(comp.spend)}</span>
                              <span style={{ fontSize:10, color: comp.trend === "up" ? "#059669" : comp.trend === "down" ? "#dc2626" : "#94a3b8" }}>
                                {comp.trend === "up" ? "↑" : comp.trend === "down" ? "↓" : "→"}
                              </span>
                            </div>
                          </div>
                          <HBar value={comp.calls} max={compMax} color="#6366f1" />
                          <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                            <span style={{ fontSize:10, color:"#94a3b8" }}>{fmtK(comp.tokens)} tokens</span>
                            <span style={{ fontSize:10, color:"#94a3b8" }}>{Math.round(comp.calls/t.ai.totalCalls*100)}% of usage</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Detail table */}
                <div className="card">
                  <div className="card-header"><span className="card-title">Feature-Level AI Detail</span></div>
                  <table className="tbl">
                    <thead><tr>
                      <th>Feature / Component</th>
                      <th>Calls</th>
                      <th>Tokens</th>
                      <th>Est. Spend</th>
                      <th>% of Total</th>
                      <th>Trend</th>
                      <th>Avg tokens / call</th>
                    </tr></thead>
                    <tbody>
                      {t.ai.components.map(comp => (
                        <tr key={comp.name}>
                          <td style={{ fontWeight:600, color:"#374151" }}>{comp.name}</td>
                          <td style={{ fontWeight:700, color:"#6366f1" }}>{comp.calls}</td>
                          <td className="td-m">{fmtK(comp.tokens)}</td>
                          <td style={{ fontWeight:600, color:"#059669" }}>{fmt$(comp.spend)}</td>
                          <td className="td-m">{Math.round(comp.calls/t.ai.totalCalls*100)}%</td>
                          <td>
                            <span style={{ fontSize:12, fontWeight:700, color: comp.trend === "up" ? "#059669" : comp.trend === "down" ? "#dc2626" : "#94a3b8" }}>
                              {comp.trend === "up" ? "↑ Growing" : comp.trend === "down" ? "↓ Declining" : "→ Stable"}
                            </span>
                          </td>
                          <td className="td-m">{Math.round(comp.tokens / comp.calls)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Feature Access ── */}
        {tab === "features" && (
          <>
            <div className="info-box" style={{ marginBottom:16 }}>
              <strong>Plan: {t.plan.charAt(0).toUpperCase()+t.plan.slice(1)}</strong> — Features marked "Plan Default" are set by the plan matrix. Use the toggles to grant or revoke individual features for this specific tenant.
            </div>
            <div className="feat-grid-header">
              <span style={{ flex:1, fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:".07em" }}>Feature</span>
              <span style={{ width:160, textAlign:"center", fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:".07em" }}>Plan Default</span>
              <span style={{ width:160, textAlign:"center", fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:".07em" }}>This Tenant</span>
              <span style={{ width:80, textAlign:"center", fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:".07em" }}>Status</span>
            </div>
            {Object.keys(FEATURE_LABELS).map(key => {
              const access = featureAccess(t, key);
              const planDefault = PLAN_DEFAULTS[key]?.[t.plan];
              return (
                <div key={key} className="feat-row">
                  <span style={{ flex:1, fontSize:13, fontWeight:500, color:"#374151" }}>{FEATURE_LABELS[key]}</span>
                  <span style={{ width:160, textAlign:"center" }}>
                    {planDefault === null ? <span style={{ fontSize:11, color:"#94a3b8" }}>Pro+ only</span>
                     : planDefault ? <span style={{ color:"#059669", fontWeight:600, fontSize:12 }}>✓ Included</span>
                     : <span style={{ color:"#94a3b8", fontSize:12 }}>— Not included</span>}
                  </span>
                  <span style={{ width:160, textAlign:"center" }}>
                    <div className={`toggle-pill ${access.enabled ? "on" : "off"}`}><div className="toggle-knob" /></div>
                  </span>
                  <span style={{ width:80, textAlign:"center" }}>
                    {access.source === "override-on"  && <span className="badge badge-indigo" style={{ fontSize:9 }}>Override ON</span>}
                    {access.source === "override-off" && <span className="badge badge-red"    style={{ fontSize:9 }}>Override OFF</span>}
                    {access.source === "plan"         && <span className="badge badge-gray"   style={{ fontSize:9 }}>Plan</span>}
                    {access.source === "locked"       && <span className="badge badge-gray"   style={{ fontSize:9 }}>Locked</span>}
                  </span>
                </div>
              );
            })}
          </>
        )}

        {/* ── Billing ── */}
        {tab === "billing" && (
          <>
            <div className="ov-grid" style={{ marginBottom:24 }}>
              <div className="ov-card"><div className="ov-label">Plan</div><div className="ov-val" style={{ fontSize:17, marginTop:8 }}>{t.plan.charAt(0).toUpperCase()+t.plan.slice(1)}</div></div>
              <div className="ov-card"><div className="ov-label">Status</div><div className="ov-val" style={{ fontSize:17, marginTop:8 }}><PlanBadge t={t} /></div></div>
              <div className="ov-card"><div className="ov-label">Seat Limit</div><div className="ov-val">{t.seatLimit}</div></div>
              <div className="ov-card"><div className="ov-label">MRR</div><div className="ov-val">${t.mrr}</div><div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{t.mrr === 0 ? "Trial / not billing" : "Active"}</div></div>
            </div>
            <div className="section-label">Change Plan</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
              {(["basic","premium","pro","enterprise"] as Plan[]).map(p => {
                const meta = { basic:{color:"#64748b",price:"$9",sub:"per seat / mo",coming:false}, premium:{color:"#6366f1",price:"$19",sub:"per seat / mo",coming:false}, pro:{color:"#059669",price:"$39",sub:"per seat / mo",coming:true}, enterprise:{color:"#d97706",price:"Custom",sub:"annual contract",coming:true} }[p];
                const current = t.plan === p;
                return (
                  <div key={p} className={`plan-card ${current ? "plan-card-active" : ""} ${meta.coming ? "plan-card-dim" : ""}`}>
                    <div style={{ fontSize:12, fontWeight:700, color:meta.color }}>{p.charAt(0).toUpperCase()+p.slice(1)} {current ? "✓" : ""}</div>
                    <div style={{ fontSize:24, fontWeight:900, color:"#111827", margin:"6px 0 2px" }}>{meta.price}</div>
                    <div style={{ fontSize:10, color:"#94a3b8" }}>{meta.sub}</div>
                    <button className={`btn ${current ? "btn-primary" : "btn-outline"}`} style={{ width:"100%", marginTop:12 }} disabled={meta.coming}>
                      {meta.coming ? "Coming Soon" : current ? "Current Plan" : `Switch to ${p.charAt(0).toUpperCase()+p.slice(1)}`}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="section-label">Seat Limit</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {[1,5,10,25,50].map(n => (
                <button key={n} className={`btn ${t.seatLimit === n ? "btn-primary" : "btn-outline"}`}>{n} seats</button>
              ))}
              <input type="number" placeholder="Custom" className="input-sm" style={{ width:80 }} />
              <button className="btn btn-outline">Set</button>
            </div>
          </>
        )}

        {/* ── Members ── */}
        {tab === "members" && (
          <>
            <table className="tbl" style={{ marginBottom:12 }}>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th></tr></thead>
              <tbody>
                <tr>
                  <td><div className="t-name">Sarah Chen</div></td>
                  <td className="td-m">sarah@{t.slug}.io</td>
                  <td><span className="badge badge-indigo">OWNER</span></td>
                  <td className="td-m">{t.lastActive}</td>
                  <td><span style={{ fontSize:11, fontWeight:600, color: t.lastActive.includes("d ago") && parseInt(t.lastActive) > 5 ? "#dc2626" : "#059669" }}>{t.lastActive.includes("d ago") && parseInt(t.lastActive) > 5 ? "Inactive" : "Active"}</span></td>
                </tr>
                {t.seats > 1 && Array.from({ length: t.seats - 1 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className="t-name">Team Member {i+2}</div></td>
                    <td className="td-m">member{i+2}@{t.slug}.io</td>
                    <td><span className="badge badge-gray">MEMBER</span></td>
                    <td className="td-m">2d ago</td>
                    <td><span style={{ fontSize:11, fontWeight:600, color:"#059669" }}>Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="info-box">{t.seats} of {t.seatLimit} seats used.</div>
          </>
        )}

        {/* ── Audit ── */}
        {tab === "audit" && (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {AUDIT_LOG.map((e, i) => (
              <div key={i} className="audit-row">
                <span className="audit-time">{e.time}</span>
                <span className="audit-type" style={{ color:e.color }}>{e.type}</span>
                <span className="audit-msg">{e.msg}</span>
                <span className="audit-actor">{e.actor}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────

export default function AdminMockup() {
  const [view, setView]       = useState<View>("dashboard");
  const [tenantId, setId]     = useState<string | null>(null);
  const [initialTab, setITab] = useState<DTab>("overview");
  const [tenants]             = useState<Tenant[]>(TENANTS);

  function goTenant(id: string, tab: DTab = "overview") { setId(id); setITab(tab); setView("detail"); }
  function goBack()  { setId(null); setView("dashboard"); }
  function goAI()    { setView("ai"); setId(null); }

  const NAV = [
    { id:"dashboard", icon:"▤",  label:"Dashboard",     section:"overview"    },
    { id:"tenants",   icon:"⬡",  label:"Tenants",        section:"overview"    },
    { id:"ai",        icon:"✦",  label:"AI Analytics",   section:"overview"    },
    { id:"flags",     icon:"⚑",  label:"Feature Access", section:"management"  },
    { id:"subs",      icon:"◎",  label:"Subscriptions",  section:"management"  },
    { id:"support",   icon:"✉",  label:"Support",         section:"management", badge:3 },
    { id:"kills",     icon:"⊘",  label:"Kill Switches",  section:"platform"    },
    { id:"audit",     icon:"◷",  label:"Audit Log",       section:"platform"    },
    { id:"comply",    icon:"☰",  label:"Compliance",      section:"platform"    },
    { id:"admins",    icon:"◉",  label:"Admins",          section:"platform"    },
  ];

  const active = view === "detail" ? "tenants" : view;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body { height:100%; background:#f8fafc; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#111827; font-size:13px; overflow:hidden; }
        .shell { display:flex; height:100vh; overflow:hidden; }
        .sidebar { width:218px; background:#fff; border-right:1px solid #e5e7eb; display:flex; flex-direction:column; flex-shrink:0; }
        .sb-logo { padding:16px 16px 12px; border-bottom:1px solid #f1f5f9; }
        .sb-brand { font-size:14px; font-weight:800; color:#4f46e5; display:flex; align-items:center; gap:6px; }
        .sb-badge-wrap { background:#4f46e5; color:#fff; font-size:8px; font-weight:800; padding:2px 5px; border-radius:4px; }
        .sb-sub { font-size:10px; color:#94a3b8; margin-top:3px; }
        .sb-section { padding:12px 8px 2px; }
        .sb-sec-label { font-size:9px; font-weight:700; color:#cbd5e1; letter-spacing:.1em; text-transform:uppercase; padding:0 8px; margin-bottom:3px; }
        .sb-item { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:7px; cursor:pointer; color:#6b7280; font-size:12px; font-weight:500; margin-bottom:1px; border:none; background:none; width:100%; text-align:left; transition:all .12s; }
        .sb-item:hover { background:#f8fafc; color:#374151; }
        .sb-item.active { background:#ede9fe; color:#4f46e5; font-weight:600; }
        .sb-icon { width:16px; text-align:center; font-size:14px; flex-shrink:0; }
        .sb-count { margin-left:auto; background:#ef4444; color:#fff; font-size:9px; font-weight:700; padding:1px 5px; border-radius:9px; }
        .sb-bottom { margin-top:auto; padding:12px 8px; border-top:1px solid #f1f5f9; }
        .sb-user { display:flex; align-items:center; gap:9px; padding:6px 10px; }
        .sb-av { width:28px; height:28px; border-radius:50%; background:#4f46e5; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#fff; flex-shrink:0; }
        .sb-name { font-size:12px; font-weight:600; color:#374151; }
        .sb-role { font-size:10px; color:#94a3b8; }
        .main { flex:1; display:flex; flex-direction:column; overflow:hidden; background:#f8fafc; }
        .topbar { display:flex; align-items:center; gap:12px; padding:10px 20px; border-bottom:1px solid #e5e7eb; background:#fff; flex-shrink:0; }
        .search { flex:1; max-width:400px; display:flex; align-items:center; gap:8px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px; padding:7px 12px; }
        .search input { background:none; border:none; outline:none; color:#374151; font-size:12px; width:100%; }
        .search input::placeholder { color:#94a3b8; }
        .kbd { font-size:10px; color:#94a3b8; background:#f1f5f9; border:1px solid #e5e7eb; border-radius:3px; padding:1px 5px; }
        .tb-right { margin-left:auto; display:flex; gap:8px; align-items:center; }
        .btn { padding:7px 14px; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; border:none; transition:all .12s; display:inline-flex; align-items:center; gap:5px; }
        .btn-primary { background:#4f46e5; color:#fff; }
        .btn-primary:hover { background:#4338ca; }
        .btn-outline { background:#fff; color:#374151; border:1px solid #e5e7eb; }
        .btn-outline:hover { background:#f8fafc; }
        .btn-green { background:#059669; color:#fff; }
        .btn-danger { background:#fff; color:#dc2626; border:1px solid #fecaca; }
        .btn-kill { background:#fff; color:#dc2626; border:1px solid #fecaca; font-size:11px; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:600; }
        .btn-sm { padding:5px 11px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; border:none; }
        .btn-sm.btn-primary { background:#4f46e5; color:#fff; }
        .btn-sm.btn-ghost { background:#f8fafc; color:#374151; border:1px solid #e5e7eb; }
        .btn-sm.btn-green { background:#059669; color:#fff; }
        .content-scroll { flex:1; overflow-y:auto; padding:20px 24px; }
        .alert-banner { display:flex; align-items:center; gap:12px; padding:12px 16px; background:#fef2f2; border:1px solid #fecaca; border-radius:9px; margin-bottom:18px; font-size:12px; color:#991b1b; }
        .alert-icon { font-size:16px; flex-shrink:0; }
        .alert-btn { margin-left:auto; padding:5px 12px; border-radius:6px; background:#dc2626; color:#fff; border:none; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap; }
        .kpi-row { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:16px; }
        .kpi-card { background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; }
        .kpi-label { font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:.07em; }
        .kpi-val { font-size:26px; font-weight:900; color:#111827; margin:4px 0 2px; line-height:1; }
        .kpi-delta { font-size:11px; }
        .kpi-delta.green { color:#059669; }
        .kpi-delta.amber { color:#d97706; }
        .kpi-delta.muted { color:#94a3b8; }
        .health-band { display:grid; grid-template-columns:repeat(3,1fr); border-radius:10px; overflow:hidden; border:1px solid #e5e7eb; }
        .hb { padding:9px 14px; display:flex; align-items:center; gap:10px; }
        .hb.green { background:#f0fdf4; border-right:1px solid #e5e7eb; }
        .hb.yellow { background:#fffbeb; border-right:1px solid #e5e7eb; }
        .hb.red { background:#fef2f2; }
        .hb-n { font-size:20px; font-weight:900; line-height:1; }
        .hb-n.green { color:#059669; }
        .hb-n.amber { color:#d97706; }
        .hb-n.red { color:#dc2626; }
        .hb-label { font-size:11px; color:#6b7280; }
        .card { background:#fff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:14px; }
        .card-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid #f1f5f9; }
        .card-title { font-size:13px; font-weight:700; color:#111827; }
        .tbl { width:100%; border-collapse:collapse; }
        .tbl th { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.07em; padding:9px 14px; text-align:left; border-bottom:1px solid #f1f5f9; }
        .tbl td { padding:10px 14px; border-bottom:1px solid #f8fafc; font-size:12px; vertical-align:middle; }
        .tbl tbody tr:last-child td { border-bottom:none; }
        .tbl-row:hover td { background:#fafafa; cursor:pointer; }
        .t-name { font-weight:600; color:#111827; }
        .t-slug { font-size:10px; color:#94a3b8; margin-top:1px; }
        .td-m { color:#6b7280; }
        .view-lnk { color:#4f46e5; font-size:12px; font-weight:600; }
        .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:9px; font-size:10px; font-weight:700; }
        .badge-indigo { background:#ede9fe; color:#4f46e5; }
        .badge-amber  { background:#fef3c7; color:#d97706; }
        .badge-green  { background:#d1fae5; color:#059669; }
        .badge-red    { background:#fee2e2; color:#dc2626; }
        .badge-gray   { background:#f1f5f9; color:#64748b; }
        .badge-purple { background:#fae8ff; color:#9333ea; }
        .section-label { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.08em; margin-bottom:10px; }
        .sel { background:#fff; border:1px solid #e5e7eb; color:#374151; font-size:11px; padding:5px 8px; border-radius:6px; outline:none; }
        .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
        .page-title { font-size:18px; font-weight:800; color:#111827; }
        .page-sub { font-size:12px; color:#6b7280; margin-top:4px; max-width:600px; }
        .info-box { padding:12px 14px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; font-size:12px; color:#0369a1; line-height:1.6; }
        .detail-hdr { display:flex; align-items:center; gap:14px; padding:13px 20px; border-bottom:1px solid #e5e7eb; background:#fff; flex-shrink:0; }
        .back-btn { padding:5px 11px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; border:1px solid #e5e7eb; background:#f8fafc; color:#6b7280; }
        .detail-title { font-size:16px; font-weight:800; color:#111827; }
        .detail-sub { font-size:12px; color:#6b7280; margin-top:2px; display:flex; align-items:center; gap:6px; }
        .dtab-bar { display:flex; border-bottom:1px solid #e5e7eb; padding:0 20px; background:#fff; flex-shrink:0; }
        .dtab { padding:10px 16px; font-size:12px; font-weight:600; color:#6b7280; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; border-top:none; border-left:none; border-right:none; background:none; transition:all .12s; }
        .dtab:hover { color:#374151; }
        .dtab.active { color:#4f46e5; border-bottom-color:#4f46e5; }
        .ov-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px; }
        .ov-card { background:#fff; border:1px solid #e5e7eb; border-radius:9px; padding:14px 16px; }
        .ov-label { font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:.07em; }
        .ov-val { font-size:24px; font-weight:900; color:#111827; margin-top:5px; }
        .hb-row { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; }
        .hb-stat { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; text-align:center; }
        .hb-stat-val { font-size:20px; font-weight:900; }
        .hb-stat-label { font-size:10px; color:#94a3b8; margin-top:3px; }
        .feat-grid-header { display:flex; align-items:center; padding:8px 14px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px 8px 0 0; }
        .feat-row { display:flex; align-items:center; padding:11px 14px; border:1px solid #e5e7eb; border-top:none; background:#fff; }
        .feat-row:last-child { border-radius:0 0 8px 8px; }
        .feat-row:hover { background:#fafafa; }
        .toggle-pill { width:36px; height:20px; border-radius:10px; position:relative; display:inline-block; }
        .toggle-pill.on { background:#4f46e5; }
        .toggle-pill.off { background:#e5e7eb; }
        .toggle-knob { width:16px; height:16px; border-radius:50%; background:#fff; position:absolute; top:2px; box-shadow:0 1px 2px rgba(0,0,0,.15); }
        .toggle-pill.on .toggle-knob { left:18px; }
        .toggle-pill.off .toggle-knob { left:2px; }
        .plan-card { background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:16px; }
        .plan-card-active { border:2px solid #4f46e5; background:#fafaff; }
        .plan-card-dim { opacity:.5; }
        .input-sm { padding:6px 10px; border:1px solid #e5e7eb; border-radius:6px; font-size:12px; color:#374151; outline:none; background:#fff; }
        .audit-row { display:flex; gap:14px; align-items:center; padding:11px 14px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:4px; }
        .audit-time { font-size:10px; color:#94a3b8; width:110px; flex-shrink:0; }
        .audit-type { font-size:11px; font-weight:700; width:160px; flex-shrink:0; }
        .audit-msg { font-size:12px; color:#374151; flex:1; }
        .audit-actor { font-size:10px; color:#94a3b8; flex-shrink:0; }
      `}</style>

      <div className="shell">
        <div className="sidebar">
          <div className="sb-logo">
            <div className="sb-brand"><span className="sb-badge-wrap">FORGE</span>Worx Admin</div>
            <div className="sb-sub">Platform Operations</div>
          </div>
          {["overview","management","platform"].map(sec => (
            <div key={sec} className="sb-section">
              <div className="sb-sec-label">{sec}</div>
              {NAV.filter(n => n.section === sec).map(n => (
                <button key={n.id} className={`sb-item ${active === n.id ? "active" : ""}`}
                  onClick={() => {
                    setId(null);
                    if (n.id === "flags") setView("flags");
                    else if (n.id === "ai") setView("ai");
                    else setView("dashboard");
                  }}>
                  <span className="sb-icon">{n.icon}</span>
                  {n.label}
                  {n.badge && <span className="sb-count">{n.badge}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="sb-bottom">
            <div className="sb-user">
              <div className="sb-av">MG</div>
              <div><div className="sb-name">Matt G.</div><div className="sb-role">Super Admin</div></div>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="topbar">
            <div className="search">
              <span style={{ color:"#94a3b8", fontSize:16 }}>⌕</span>
              <input placeholder="Search tenants by name, email, or slug…" />
              <span className="kbd">⌘K</span>
            </div>
            <div className="tb-right">
              <button className="btn-kill">🔴 Kill Switches</button>
              <button className="btn btn-primary" onClick={() => goTenant("1")}>＋ Provision Tenant</button>
            </div>
          </div>

          {view === "dashboard" && <Dashboard tenants={tenants} onView={goTenant} onAI={goAI} />}
          {view === "tenants"   && <Dashboard tenants={tenants} onView={goTenant} onAI={goAI} />}
          {view === "ai"        && <PlatformAI tenants={tenants} onView={goTenant} />}
          {view === "flags"     && <FeatureMatrix />}
          {view === "detail" && tenantId && (
            <TenantDetail tenants={tenants} id={tenantId} onBack={goBack} initialTab={initialTab} />
          )}
        </div>
      </div>
    </>
  );
}
