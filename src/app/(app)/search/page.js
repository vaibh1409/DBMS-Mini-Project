'use client';
// Similar cases (Owner, Vet): vector similarity search over vet notes.
// Describe symptoms in any words; the closest past notes and their likely
// conditions are shown. Each result's vector can be read, re-created
// after editing the note, removed from search and added back.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { RoleGate } from '@/components/AppShell.js';
import { api, useApi } from '@/lib/apiClient.js';
import { EarTag, PageHeader, Notice, Field, Empty, formatDate } from '@/components/ui.js';

const EXAMPLES = [
  'inflamed udder and lumpy discoloured milk',
  'cow cannot get up after giving birth, trembling',
  'animal coughing with runny nose and breathing fast',
  'belly swollen on the left after eating fresh clover',
];

const MODES = [
  ['semantic', 'Similar meaning'],
  ['keyword', 'Exact words'],
  ['both', 'Compare both'],
];

export default function SearchPage() {
  return <RoleGate allow={['Owner', 'Vet']}><Search /></RoleGate>;
}

function Search() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('semantic');
  const [k, setK] = useState('5');
  const [condition, setCondition] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ kind: 'info', text: '' });

  const records = useApi('/api/health-records');
  const conditions = useMemo(
    () => [...new Set((records.data?.records ?? []).map((r) => r.suspected_condition).filter(Boolean))].sort(),
    [records.data],
  );

  async function search(event, query = text) {
    event?.preventDefault();
    if (query.trim().length < 3) return;
    setBusy(true);
    setError('');
    try {
      setResult(await api('/api/notes/search', { method: 'POST', body: { text: query, mode, k: Number(k), condition: condition || null } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function tryExample(example) {
    setText(example);
    search(null, example);
  }

  function changed(text) {
    setMessage({ kind: 'success', text });
    search();
  }

  return (
    <>
      <PageHeader
        title="Similar cases"
        description="Describe what you see in your own words. Past vet notes with the same meaning are found even when they use different words, along with the conditions they turned out to be."
      />

      <form className="panel stack" onSubmit={search}>
        <Field label="Symptoms">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: quarter feels hard and hot, milk has flakes" required minLength={3} />
        </Field>
        <div className="examples">
          <span className="muted">Try:</span>
          {EXAMPLES.map((ex) => <button type="button" key={ex} className="example" onClick={() => tryExample(ex)}>{ex}</button>)}
        </div>
        <div className="row">
          <div className="segmented" role="group" aria-label="Search by">
            {MODES.map(([value, label]) => (
              <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>
            ))}
          </div>
          <Field label="Results">
            <select value={k} onChange={(e) => setK(e.target.value)} style={{ width: '6rem' }}><option>3</option><option>5</option><option>10</option></select>
          </Field>
          <Field label="Only this condition">
            <select value={condition} onChange={(e) => setCondition(e.target.value)} disabled={mode === 'keyword'}>
              <option value="">Any condition</option>{conditions.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <button type="submit" className="button" disabled={busy}>{busy ? 'Searching…' : 'Find similar cases'}</button>
        </div>
      </form>

      <Notice kind="error">{error}</Notice>
      <div style={{ marginTop: '1rem' }}><Notice kind={message.kind}>{message.text}</Notice></div>

      {result && (
        <>
          {result.fallback && <div className="section"><Notice kind="info">The similarity model could not be loaded, so these results come from matching exact words.</Notice></div>}

          {result.mode === 'both' ? (
            <div className="split section">
              <div>
                <h2>Exact words</h2>
                <p className="muted" style={{ margin: '0.25rem 0 0.75rem' }}>PostgreSQL full-text search: notes must contain the words you typed.</p>
                <Results rows={result.keyword} kind="keyword" onChanged={changed} />
              </div>
              <div>
                <h2>Similar meaning</h2>
                <p className="muted" style={{ margin: '0.25rem 0 0.75rem' }}>Vector search: notes closest in meaning, by cosine similarity.</p>
                <Results rows={result.semantic} kind="semantic" onChanged={changed} />
              </div>
            </div>
          ) : (
            <div className="split section" style={{ gridTemplateColumns: result.suggestedConditions ? 'minmax(0, 2fr) minmax(14rem, 1fr)' : '1fr' }}>
              <div>
                <h2>{result.semantic ? 'Closest past cases' : 'Notes containing these words'}</h2>
                <div style={{ marginTop: '0.75rem' }}>
                  <Results rows={result.semantic ?? result.keyword} kind={result.semantic ? 'semantic' : 'keyword'} onChanged={changed} />
                </div>
              </div>
              {result.suggestedConditions && (
                <aside className="panel">
                  <h2>Likely conditions</h2>
                  <p className="muted" style={{ margin: '0.25rem 0 0.75rem' }}>From the closest cases.</p>
                  {result.suggestedConditions.length === 0 ? <p className="muted">None of the closest cases had a condition recorded.</p> : (
                    <ul className="likely">
                      {result.suggestedConditions.map((s) => (
                        <li key={s.condition}>
                          <span className="likely-name">{s.condition}</span>
                          <span className="muted num">{s.matches} {s.matches === 1 ? 'case' : 'cases'}, {Math.round(s.avg_similarity * 100)}% similar</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

function Results({ rows, kind, onChanged }) {
  if (!rows || rows.length === 0) {
    return <Empty>{kind === 'keyword' ? 'No note contains all of these words.' : 'No similar notes found.'}</Empty>;
  }
  return (
    <ul className="results">
      {rows.map((r) => <Result key={r.health_id} r={r} kind={kind} onChanged={onChanged} />)}
    </ul>
  );
}

function Result({ r, kind, onChanged }) {
  const [panel, setPanel] = useState(null);       // null | 'vector' | 'edit'
  const [vector, setVector] = useState(null);
  const [notes, setNotes] = useState(r.vet_notes);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function act(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const showVector = () => act(async () => {
    try {
      setVector((await api(`/api/notes/${r.health_id}/embedding`)).embedding);
    } catch (err) {
      if (err.status !== 404) throw err;
      setVector(false);   // no vector stored
    }
    setPanel('vector');
  });

  const removeVector = () => act(async () => {
    await api(`/api/notes/${r.health_id}/embedding`, { method: 'DELETE' });
    setVector(false);
    onChanged(`Record ${r.health_id} was removed from similar-case search. Its health record is kept.`);
  });

  const addVector = () => act(async () => {
    const { embedding } = await api(`/api/notes/${r.health_id}/embedding`, { method: 'POST' });
    setVector(embedding);
    onChanged(`Record ${r.health_id} is back in similar-case search.`);
  });

  const saveNotes = (event) => {
    event.preventDefault();
    act(async () => {
      await api(`/api/health-records/${r.health_id}`, { method: 'PATCH', body: { vetNotes: notes } });
      setPanel(null);
      onChanged(`Record ${r.health_id}'s note was changed and its vector re-created. The results below are updated.`);
    });
  };

  const similarity = Number(r.similarity);
  return (
    <li className="result">
      <div className="result-head">
        <EarTag>{r.tag_number}</EarTag>
        <Link href={`/cattle/${r.cattle_id}`}><strong>{r.name}</strong></Link>
        <span className="muted">{formatDate(r.note_date)}</span>
        <span>{r.suspected_condition ?? 'No condition recorded'}</span>
        <span className="spacer" />
        {kind === 'semantic' ? (
          <span className="meter" title="Cosine similarity">
            <span className="meter-track"><span className="meter-fill" style={{ width: `${Math.max(0, similarity) * 100}%`, display: 'block' }} /></span>
            {Math.round(similarity * 100)}%
          </span>
        ) : (
          <span className="muted num">rank {Number(r.rank).toFixed(3)}</span>
        )}
      </div>
      <p className="result-notes">{r.vet_notes}</p>
      {r.treatment && <p className="result-meta">Treatment: {r.treatment}</p>}

      <div className="form-actions">
        <button type="button" className="button button-small button-quiet" onClick={panel === 'vector' ? () => setPanel(null) : showVector} disabled={busy}>
          {panel === 'vector' ? 'Hide vector' : 'Show vector'}
        </button>
        <button type="button" className="button button-small button-quiet" onClick={() => { setNotes(r.vet_notes); setPanel(panel === 'edit' ? null : 'edit'); }}>
          {panel === 'edit' ? 'Cancel edit' : 'Edit note'}
        </button>
      </div>

      {panel === 'vector' && (
        <div className="stack">
          {vector ? (
            <div className="vector-facts">
              <span><strong>{vector.dimensions}</strong> dimensions</span>
              <span>length <strong>{Number(vector.norm).toFixed(2)}</strong></span>
              <span>condition <strong>{vector.suspected_condition ?? 'none'}</strong></span>
              <span>date <strong>{formatDate(vector.note_date)}</strong></span>
              <span>vector id <strong>{vector.embedding_id}</strong></span>
            </div>
          ) : <p className="muted">This note has no vector, so it is not included in similar-case search.</p>}
          <div className="form-actions">
            {vector
              ? <button type="button" className="button button-small button-quiet" onClick={removeVector} disabled={busy}>Remove from search</button>
              : <button type="button" className="button button-small" onClick={addVector} disabled={busy}>Add back to search</button>}
          </div>
        </div>
      )}

      {panel === 'edit' && (
        <form className="stack" onSubmit={saveNotes}>
          <Field label="Vet notes" hint="Saving re-creates this note's vector, so searches reflect the new wording.">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} required />
          </Field>
          <div className="form-actions"><button type="submit" className="button button-small" disabled={busy}>{busy ? 'Saving…' : 'Save and re-embed'}</button></div>
        </form>
      )}
      <Notice kind="error">{error}</Notice>
    </li>
  );
}
