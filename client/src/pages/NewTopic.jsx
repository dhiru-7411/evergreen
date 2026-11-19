import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ErrorBox } from '../components/Status';
import { useFetch } from '../hooks/useFetch';

const splitPackages = (text) =>
  text
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const NewTopic = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: categories } = useFetch('/topics/categories');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [keywords, setKeywords] = useState('');
  const [summary, setSummary] = useState('');
  const [packages, setPackages] = useState('');
  const [alternatives, setAlternatives] = useState([{ name: '', note: '' }]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user?.role !== 'admin') return <ErrorBox>Only admins can create topics.</ErrorBox>;

  const updateAlt = (idx, key, value) =>
    setAlternatives((alts) => alts.map((a, i) => (i === idx ? { ...a, [key]: value } : a)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/topics', {
        name,
        category,
        summary,
        keywords: keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        packages: splitPackages(packages),
        alternatives: alternatives
          .filter((a) => a.name.trim())
          .map((a) => ({ name: a.name.trim().toLowerCase(), note: a.note })),
      });
      navigate(`/learn/${res.data.slug}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not create topic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>New topic</h1>
      <p className="muted">
        Name the topic and the npm package it's about. Versions, downloads, release dates and deprecation notices are
        fetched from npm automatically and kept up to date.
      </p>
      <form className="editor" onSubmit={handleSubmit}>
        {error && <ErrorBox>{error}</ErrorBox>}

        <label className="field">
          <span>Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="React"
            required
          />
        </label>

        <label className="field">
          <span>Category</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="" disabled>
              Choose a knowledge area…
            </option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}: {c.blurb}
              </option>
            ))}
          </select>
          <span className="hint">
            Evergreen only covers these core areas, to keep every topic accurate and current.
          </span>
        </label>

        <label className="field">
          <span>npm packages</span>
          <input
            className="input mono"
            value={packages}
            onChange={(e) => setPackages(e.target.value)}
            placeholder="react, react-dom"
            required
          />
          <span className="hint">The first one is the main package the page leads with.</span>
        </label>

        <label className="field">
          <span>Summary (optional)</span>
          <input
            className="input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={400}
            placeholder="Leave blank to use the package's npm description"
          />
        </label>

        <label className="field">
          <span>Keywords (optional)</span>
          <input
            className="input"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Claude, Anthropic"
          />
          <span className="hint">
            Comma-separated words that mean a page is about this topic. Used to check community suggestions are
            relevant.
          </span>
        </label>

        <fieldset className="field alt-editor">
          <span>Alternatives</span>
          {alternatives.map((alt, idx) => (
            <div className="alt-row" key={idx}>
              <input
                className="input mono"
                placeholder="vue"
                aria-label="Alternative package"
                value={alt.name}
                onChange={(e) => updateAlt(idx, 'name', e.target.value)}
              />
              <input
                className="input"
                placeholder="Pick this if…"
                aria-label="When to pick it"
                maxLength={200}
                value={alt.note}
                onChange={(e) => updateAlt(idx, 'note', e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Remove alternative"
                onClick={() => setAlternatives((alts) => alts.filter((_, i) => i !== idx))}
              >
                ✕
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn btn-sm"
              disabled={alternatives.length >= 8}
              onClick={() => setAlternatives((alts) => [...alts, { name: '', note: '' }])}
            >
              + Add alternative
            </button>
          </div>
        </fieldset>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Checking npm…' : 'Create topic'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewTopic;
