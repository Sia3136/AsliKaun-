import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Cpu } from 'lucide-react';

type Health = { status: string; timestamp?: string; summary?: string; sample_count?: number; models?: Array<{name:string; status:string; scored_sessions:number; latest_score:number|null}>; calibration?: {status:string; note:string; minimum_sessions:number}; thresholds?: {adaptive_driver_count:number; population_fallback_count:number} };

export const ModelPerformanceScreen: React.FC = () => {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true); setError('');
    try { const token=sessionStorage.getItem('tm-auth-token') || ''; const res=await fetch('/v1/ml/models/health',{headers:{Authorization:`Bearer ${token}`}}); if(!res.ok) throw new Error(`Model health request failed (HTTP ${res.status})`); setData(await res.json()); }
    catch(e:any){setError(e.message || 'Unable to load model health');} finally {setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  return <div className="space-y-6">
    <div><div className="text-[11px] font-semibold uppercase tracking-wider text-[#727785]">MODEL OBSERVABILITY / LIVE BACKEND</div><h1 className="text-2xl font-bold text-[#0b1c30] mt-1">Model Health</h1><p className="text-xs text-[#565e74] mt-1">Runtime scoring coverage and calibration readiness calculated from persisted driver sessions.</p></div>
    {loading && <p className="p-8 text-center text-sm text-[#565e74]">Loading live model health…</p>}
    {error && <div className="p-4 bg-white border rounded-xl text-sm text-red-700 flex gap-2"><AlertCircle className="w-4 h-4"/>{error}<button onClick={()=>void load()} className="underline ml-auto">Retry</button></div>}
    {data && <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border"><div className="text-[10px] uppercase font-bold text-[#727785]">Scored sessions</div><div className="text-2xl font-bold mt-2">{data.sample_count ?? 0}</div><div className="text-xs text-[#565e74]">Persisted backend evaluations</div></div>
        <div className="bg-white p-4 rounded-xl border"><div className="text-[10px] uppercase font-bold text-[#727785]">Adaptive thresholds</div><div className="text-2xl font-bold mt-2">{data.thresholds?.adaptive_driver_count ?? 0}</div><div className="text-xs text-[#565e74]">Drivers with enough history to calibrate</div></div>
        <div className="bg-white p-4 rounded-xl border"><div className="text-[10px] uppercase font-bold text-[#727785]">Calibration readiness</div><div className="text-2xl font-bold mt-2">{data.calibration?.status ?? 'Unavailable'}</div><div className="text-xs text-[#565e74]">{data.calibration?.note}</div></div>
      </div>
      <div className="bg-white p-5 rounded-xl border"><h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Cpu className="w-4 h-4"/>Live scoring components</h2>{data.models?.length ? <div className="divide-y">{data.models.map(m=><div key={m.name} className="py-3 flex flex-wrap items-center gap-4 text-sm"><strong className="min-w-36">{m.name}</strong><span className="text-[#565e74]">{m.scored_sessions} sessions</span><span className="font-mono">Latest: {m.latest_score == null ? 'No score' : m.latest_score.toFixed(3)}</span><span className="ml-auto text-xs">{m.status}</span></div>)}</div>:<p className="py-5 text-sm text-[#565e74]">No model evaluations have been recorded yet.</p>}<p className="mt-3 text-xs text-[#727785]">{data.summary} · Updated {data.timestamp ? new Date(data.timestamp).toLocaleString() : '—'}</p></div>
      <div className="bg-white p-5 rounded-xl border flex gap-3 items-start"><CheckCircle2 className="w-5 h-5 text-[#006947]"/><div><h3 className="font-bold text-sm">Calibration checks are evidence based</h3><p className="text-xs text-[#565e74] mt-1">{data.calibration?.note} Runtime conformal p-values and adaptive thresholds are only reported when sufficient driver history exists.</p></div></div>
    </>}
  </div>;
};
