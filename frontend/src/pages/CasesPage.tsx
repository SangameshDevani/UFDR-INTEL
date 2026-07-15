import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Case } from "../api/client";

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseNumber, setCaseNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    api.listCases().then(setCases).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filteredCases = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter((c) => [c.case_number, c.title, c.description].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [cases, filter]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createCase({ case_number: caseNumber, title, description: description || undefined });
      setCaseNumber(""); setTitle(""); setDescription(""); setShowCreate(false); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to create case"); }
  };

  const totalExtractions = cases.reduce((sum, c) => sum + c.extraction_count, 0);
  return <>
    <section className="page-heading dashboard-heading">
      <div><p className="eyebrow">Evidence management</p><h1>Investigation cases</h1><p>Review device extractions, search artifacts, and build cited findings.</p></div>
      <button className="btn" type="button" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Close form" : "+ New case"}</button>
    </section>
    <section className="metric-grid" aria-label="Case overview">
      <div className="metric-card"><span>Active cases</span><strong>{cases.length}</strong><small>Available in this workspace</small></div>
      <div className="metric-card"><span>UFDR extractions</span><strong>{totalExtractions}</strong><small>Across all cases</small></div>
      <div className="metric-card"><span>Review status</span><strong>{totalExtractions ? "Ready" : "Awaiting"}</strong><small>{totalExtractions ? "Evidence can be searched" : "Ingest a UFDR to begin"}</small></div>
    </section>
    {showCreate && <section className="panel create-panel"><div className="panel-title"><div><p className="eyebrow">New investigation</p><h2>Create a case</h2></div><p>Start a workspace before adding UFDR evidence.</p></div>
      <form onSubmit={onCreate}><div className="form-grid"><div className="form-row"><label htmlFor="case-number">Case number</label><input id="case-number" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} required placeholder="FIR-2026-001" /></div><div className="form-row"><label htmlFor="case-title">Case title</label><input id="case-title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Device seizure — suspect A" /></div></div><div className="form-row"><label htmlFor="case-description">Description <span>optional</span></label><textarea id="case-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief investigation context" /></div><button type="submit" className="btn">Create investigation case</button></form>
    </section>}
    <section className="panel cases-panel"><div className="panel-toolbar"><div><p className="eyebrow">Case directory</p><h2>All cases <span className="count-pill">{filteredCases.length}</span></h2></div><div className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Filter cases" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by case number or title" /></div></div>
      {error && <div className="alert error"><strong>Unable to load cases.</strong> {error}</div>}
      {loading ? <div className="case-grid">{[1, 2, 3].map((i) => <div className="case-card skeleton" key={i}><div /><div /><div /></div>)}</div> : filteredCases.length === 0 ? <div className="empty-state"><span>⌕</span><h3>{filter ? "No matching cases" : "No investigation cases yet"}</h3><p>{filter ? "Try a different case number, title, or description." : "Create a case to ingest a UFDR report and begin reviewing evidence."}</p>{!filter && <button type="button" className="btn secondary" onClick={() => setShowCreate(true)}>Create your first case</button>}</div> : <div className="case-grid">{filteredCases.map((c) => <article className="case-card" key={c.id}><div className="case-card-top"><span className="case-id">{c.case_number}</span><span className={c.extraction_count ? "status ready" : "status pending"}>{c.extraction_count ? "Evidence ready" : "No extraction"}</span></div><h3>{c.title}</h3><p>{c.description || "No description provided for this investigation."}</p><footer><span>{c.extraction_count} UFDR {c.extraction_count === 1 ? "extraction" : "extractions"}</span><Link to={`/cases/${c.id}`} className="text-action">Open workspace <b>→</b></Link></footer></article>)}</div>}
    </section>
  </>;
}
