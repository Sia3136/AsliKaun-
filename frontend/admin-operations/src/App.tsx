import { useState } from "react";

type Page = "Fleet map" | "Drift tracker" | "Review queue" | "Model health" | "Simulator";
type Driver = { id: string; name: string; x: number; y: number; state: string; color: string };

const drivers: Driver[] = [
  { id: "rider-001", name: "Rohan Mehta", x: 77, y: 80, state: "Stable", color: "green" },
  { id: "rider-002", name: "Aarav Shah", x: 67, y: 68, state: "Stable", color: "green" },
  { id: "rider-007", name: "Kabir Singh", x: 88, y: 62, state: "Stable", color: "green" },
  { id: "rider-014", name: "Neel Roy", x: 76, y: 48, state: "Stable", color: "green" },
  { id: "rider-019", name: "Ishaan Das", x: 25, y: 75, state: "Legit change", color: "blue" },
  { id: "rider-055", name: "Dev Malhotra", x: 39, y: 53, state: "Legit change", color: "blue" },
  { id: "rider-088", name: "Vihaan Rao", x: 31, y: 18, state: "Ambiguous", color: "amber" },
  { id: "rider-042", name: "Arjun Nair", x: 79, y: 14, state: "Handoff", color: "red" },
  { id: "rider-091", name: "Aditya Jain", x: 65, y: 24, state: "Handoff", color: "red" },
];

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    trend: <><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{paths[name]}</svg>;
};

const Metric = ({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) => (
  <div className="metric">
    <div className="metric-label"><span>{label}</span><span className={`pulse ${tone}`}/></div>
    <strong>{value}</strong><small>{note}</small>
  </div>
);

function FleetMap() {
  const [selected, setSelected] = useState<Driver>(drivers[7]);
  const [notice, setNotice] = useState("");
  const act = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };
  return <div className="fleet-layout">
    <section className="panel map-panel">
      <div className="panel-head">
        <div><span className="eyebrow">Live intelligence</span><h2>Continuity matrix</h2><p>Context and behavioral confidence across all active sessions</p></div>
        <div className="legend"><i className="green"/>Stable <i className="blue"/>Legit change <i className="amber"/>Ambiguous <i className="red"/>Handoff</div>
      </div>
      <div className="matrix-wrap">
        <div className="y-title">Behavior continuity <b>C<sub>b</sub></b></div>
        <div className="matrix">
          <div className="quadrant q1"><b>Legit change</b><span>New context · same person</span></div>
          <div className="quadrant q2"><b>Stable identity</b><span>Expected session behavior</span></div>
          <div className="quadrant q3"><b>Ambiguous</b><span>Multi-factor variance</span></div>
          <div className="quadrant q4"><b>Handoff signature</b><span>Same context · new person</span></div>
          <span className="threshold-x">C<sub>c</sub> 0.60</span><span className="threshold-y">C<sub>b</sub> 0.29</span>
          {drivers.map(d => <button key={d.id} onClick={() => setSelected(d)} className={`dot ${d.color} ${selected.id === d.id ? "selected" : ""}`} style={{left: `${d.x}%`, bottom: `${d.y}%`}} aria-label={d.id}><span>{d.id.replace("rider-","")}</span></button>)}
        </div>
        <div className="x-title">Context continuity <b>C<sub>c</sub></b></div>
      </div>
      <div className="map-foot"><span>0.0</span><span>Context threshold 0.60</span><span>1.0</span></div>
    </section>
    <aside className="panel inspector">
      <div className="inspector-top"><div className={`avatar ${selected.color}`}>{selected.name.split(" ").map(x=>x[0]).join("")}</div><div><span className="eyebrow">Driver inspector</span><h3>{selected.name}</h3><p>{selected.id} · Mumbai Central</p></div><span className={`status ${selected.color}`}>{selected.state}</span></div>
      <div className="facts"><div><span>Device</span><b>Samsung A54</b></div><div><span>Vehicle speed</span><b>18.4 mph</b></div><div><span>Session</span><b>#OS-8437</b></div></div>
      <div className="section-title"><span>Signal integrity</span><small>Fisher-fused</small></div>
      {[["Touch biometrics", 18, "3.2× pressure"],["Motion kinematics", 31, "recoil shifted"],["Operational timing", 14, "3,200 ms"],["GPS mobility", 82, "consistent"]].map(([l,v,n])=><div className="signal" key={l as string}><div><span>{l}</span><small>{n}</small></div><div className="bar"><i style={{width:`${v}%`}} className={Number(v)<40?"danger":""}/></div></div>)}
      <div className="reason"><span className="ai-mark">AI</span><div><b>Reason vector</b><p>Touch pressure spiked 3.2× while acceptance latency tripled. Device and route remain consistent, indicating a likely person-level handoff.</p></div></div>
      <div className="safe"><span>Safe-pause armed</span><b>Challenge at 0 mph</b></div>
      <div className="actions"><button className="primary" onClick={() => act(`Step-up queued for ${selected.id} at the next safe stop`)}>Confirm step-up</button><button className="secondary" onClick={() => act(`${selected.id} marked for baseline review`)}>Mark false alarm</button></div>
      {notice && <div className="action-toast"><span>✓</span>{notice}</div>}
    </aside>
  </div>;
}

function DriftTracker() {
  const rows = [["SES-0037","Today, 14:32","0.91","0.41","Handoff","18.4 mph"],["SES-0036","Today, 10:18","0.88","0.58","Ambiguous","0 mph"],["SES-0035","Yesterday, 19:04","0.93","0.72","Stable","12.1 mph"]];
  const exportHistory = () => downloadCsv("rider-042-session-history.csv", [
    ["Session ID","Timestamp","Context Score","Behavior Score","Quadrant","Vehicle Speed","Verdict"],
    ...rows.map((row, index) => [...row, index === 0 ? "Challenge queued" : "No action"]),
  ]);
  return <section className="panel page-panel"><div className="panel-head"><div><span className="eyebrow">Longitudinal identity</span><h2>Dual-timescale drift tracker</h2><p>rider-042 · Last 45 scored sessions</p></div><div className="alert-pill">Drift breach at session 37</div></div>
    <div className="timeline"><div className="chart-labels"><span>100</span><span>70</span><span>40</span><span>0</span></div><svg viewBox="0 0 900 240" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity=".2"/><stop offset="1" stopColor="#22d3ee" stopOpacity="0"/></linearGradient></defs><path className="gridline" d="M0 30H900M0 90H900M0 150H900M0 210H900"/><path className="anchor" d="M0 44H900"/><path className="area" d="M0 49 C150 45 220 52 310 70 S460 91 540 105 S690 165 780 170 S850 182 900 188 V220H0Z"/><path className="ewma" d="M0 49 C150 45 220 52 310 70 S460 91 540 105 S690 165 780 170 S850 182 900 188"/><circle className="breach" cx="740" cy="164" r="7"/></svg><div className="chart-bottom"><span>Session 1</span><span>Session 15</span><span>Session 30</span><span>Session 45</span></div><div className="chart-legend"><span><i className="line solid"/>Frozen anchor 94</span><span><i className="line dashed"/>Fast EWMA 72</span><span><i className="circle"/>Session score</span></div></div>
    <div className="table-title"><h3>Recent session audit</h3><button className="secondary" onClick={exportHistory}><Icon name="download"/> Export history</button></div><table><thead><tr>{["Session ID","Timestamp","Context","Behavior","Quadrant","Vehicle speed","Verdict"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r[0]}>{r.map((x,j)=><td key={`${r[0]}-${j}`}>{j===4?<span className={`status ${i===0?"red":i===1?"amber":"green"}`}>{x}</span>:x}</td>)}<td><b>{i===0?"Challenge queued":"No action"}</b></td></tr>)}</tbody></table>
  </section>;
}

const cases = [
  ["REV-1042","rider-042","Handoff signature","OPEN","Tap pressure spiked 3.2× and latency tripled."],
  ["REV-1088","rider-088","Ambiguous","OPEN","IP subnet and touch velocity diverged."],
  ["REV-1014","rider-019","Legit change","RESOLVED","Hardware changed; biometric profile remained stable."],
];
function ReviewQueue(){
  const [filter,setFilter]=useState("All");
  const [message,setMessage]=useState("");
  const [resolved,setResolved]=useState<string[]>([]);
  const shown=cases.filter((item) => {
    const status = resolved.includes(item[0]) || item[3] === "RESOLVED" ? "Resolved" : "Open";
    return filter === "All" || filter === status;
  });
  const notify=(text:string)=>{setMessage(text);window.setTimeout(()=>setMessage(""),2500)};
  const exportQueue=()=>{downloadCsv("aslikaun-review-queue.csv",[["Review ID","Driver ID","Quadrant","Status","Reason"],...cases]);notify("Audit report downloaded")};
  const resolveCase=(id:string)=>{setResolved(current=>current.includes(id)?current:[...current,id]);notify(`${id} resolved and audit trail updated`)};
  return <section className="panel page-panel"><div className="panel-head"><div><span className="eyebrow">Operations action center</span><h2>Review queue <span className="muted">(401)</span></h2><p>Prioritized by identity risk and vehicle safety state</p></div><button className="primary" onClick={exportQueue}><Icon name="download"/>Export audit CSV</button></div><div className="toolbar"><div className="chips">{["All","Open","Resolved"].map(x=><button key={x} onClick={()=>setFilter(x)} className={filter===x?"active":""}>{x}</button>)}</div><div className="search"><Icon name="search"/>Search driver or review ID</div></div>
  <div className="cases">{shown.map((c,i)=><article key={c[0]} className="case"><div className={`case-icon ${i===0?"red":i===1?"amber":"blue"}`}><Icon name="shield"/></div><div><b>#{c[0]}</b><span>{c[1]}</span></div><div><span className={`status ${resolved.includes(c[0])?"green":i===0?"red":i===1?"amber":"blue"}`}>{c[2]}</span><small>{resolved.includes(c[0])?"RESOLVED":c[3]}</small></div><p>{c[4]}</p><div className="case-actions"><button className="secondary" onClick={()=>notify(`${c[0]} opened for ${i===0?"step-up verification":"review"}`)}>{i===0?"Verify step-up":"Review"}</button><button className="more" aria-label={`Resolve ${c[0]}`} title="Resolve case" onClick={()=>resolveCase(c[0])}>✓</button></div></article>)}</div>{message&&<div className="global-toast"><span>✓</span>{message}</div>}</section>
}

function ModelHealth(){
 return <div className="model-grid"><section className="panel page-panel span"><div className="panel-head"><div><span className="eyebrow">Model assurance</span><h2>Performance & cohort fairness</h2><p>Evaluation snapshot · production calibration v2.4</p></div><span className="healthy">All models calibrated</span></div><div className="model-cards">{[["Touch triplet","0.352","0.722","Baseline"],["Motion kinematics","0.277","0.780","37% lift"],["Fisher fusion","0.158","0.921","Best model"]].map((m,i)=><div key={m[0]} className={i===2?"featured":""}><span>{m[0]}</span><b>AUC {m[2]}</b><p>EER {m[1]}</p><small>{m[3]}</small></div>)}</div></section>
 <section className="panel chart-card"><div><span className="eyebrow">Equity monitor</span><h3>False-challenge rate by cohort</h3></div><div className="bars">{[["Regular baseline",.9],["New phone upgrade",1.1],["City relocation",1.2],["Monsoon / bumpy road",1.4]].map(x=><div key={x[0]}><label><span>{x[0]}</span><b>{x[1]}%</b></label><i><em style={{width:`${Number(x[1])*55}%`}}/></i></div>)}</div><div className="takeaway"><b>0.5pp maximum variance</b><span>Environmental change has negligible impact on driver friction.</span></div></section>
 <section className="panel chart-card"><div><span className="eyebrow">Statistical calibration</span><h3>Fused p-value distribution</h3></div><div className="histogram">{[78,55,40,31,25,20,18,17,18,21,25,28,30,29,31,34,36,33,37,34].map((h,i)=><i key={`${i}-${h}`} className={i<3?"hot":""} style={{height:`${h}%`}}/>)}</div><div className="hist-label"><span>0.0 · impostor spike</span><span>Normal uniformity · 1.0</span></div><div className="takeaway"><b>KS calibration passed</b><span>Normal sessions retain a uniform p-value distribution.</span></div></section></div>
}

function Simulator(){
 const [result,setResult]=useState(""); const run=(s:string)=>setResult(s);
 const scenarios=[["Lazy renter","Immediate account handoff","Handoff signature","red"],["Slow-drift renter","60-session boiling frog attack","Drift breach","red"],["Split-shift","Alternating co-riders on login","Periodic anomaly","amber"],["Copycat attacker","Mimics schedule and zone","Touch mismatch","red"],["Legitimate phone upgrade","New device, same biometrics","Legit change","blue"],["Cold-start rider","Population conformal fallback","Observed","green"]];
 return <section className="panel page-panel"><div className="panel-head"><div><span className="eyebrow">Live demo sandbox</span><h2>Attack & scenario simulator</h2><p>Inject controlled sessions into the live scoring pipeline</p></div><span className="sandbox">Isolated sandbox</span></div>{result&&<div className="sim-result"><span>Simulation complete</span><b>{result}</b><button onClick={()=>setResult("")}>×</button></div>}<div className="scenario-heading"><span>Adversarial scenarios</span><small>4 templates</small></div><div className="scenarios">{scenarios.map((s,i)=><button key={s[0]} className={`scenario ${i>3?"honest":""}`} onClick={()=>run(`${s[0]} classified as ${s[2]}`)}><span className={`scenario-num ${s[3]}`}>0{i+1}</span><div><h3>{s[0]}</h3><p>{s[1]}</p><b>{s[2]} →</b></div></button>)}</div></section>
}

export default function App() {
 const [page,setPage]=useState<Page>("Fleet map");
 const [message,setMessage]=useState("");
 const pages: [Page,string][]=[["Fleet map","grid"],["Drift tracker","trend"],["Review queue","shield"],["Model health","chart"],["Simulator","bolt"]];
 const exportFleet=()=>{
   downloadCsv("aslikaun-live-fleet.csv",[
     ["Driver ID","Driver Name","Context Score","Behavior Score","Classification"],
     ...drivers.map(driver=>[driver.id,driver.name,driver.x/100,driver.y/100,driver.state]),
   ]);
   setMessage("Live fleet snapshot downloaded");
   window.setTimeout(()=>setMessage(""),2500);
 };
 return <div className="app">
  <header><div className="brand"><div className="brand-mark" style={{background: 'transparent', padding: '2px'}}><img src="/aslikaun-logo.png" alt="AsliKaun logo" style={{width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px'}} /></div><div><b>AsliKaun</b><span>IDENTITY INTELLIGENCE</span></div></div><nav>{pages.map(p=><button key={p[0]} className={page===p[0]?"active":""} onClick={()=>setPage(p[0])}><Icon name={p[1]}/>{p[0]}{p[0]==="Review queue"&&<i>3</i>}</button>)}</nav><div className="header-right"><span className="live"><i/>Live ingest · 84 ms</span><button className="export" onClick={exportFleet}><Icon name="download"/>Export CSV</button><div className="user">SK</div></div></header>
  <main><div className="page-title"><div><span className="eyebrow">Admin operations</span><h1>{page}</h1></div><div className="updated"><i/>Updated just now <span>IST 14:32:08</span></div></div>
  <div className="metrics"><Metric label="Active sessions" value="142" note="+8 in the last hour"/><Metric label="Handoff alerts" value="3" note="2 require review" tone="red"/><Metric label="Safe-pause queue" value="1" note="Waiting for 0 mph" tone="amber"/><Metric label="False-alarm rate" value="0.9%" note="Rolling 24 hours" tone="blue"/></div>
  <div className="page-content" key={page}>{page==="Fleet map"?<FleetMap/>:page==="Drift tracker"?<DriftTracker/>:page==="Review queue"?<ReviewQueue/>:page==="Model health"?<ModelHealth/>:<Simulator/>}</div></main>{message&&<div className="global-toast"><span>✓</span>{message}</div>}
 </div>
}
