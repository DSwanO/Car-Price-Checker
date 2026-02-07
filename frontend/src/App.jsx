import { useEffect, useState } from "react";

const API = "http://localhost:8000";

export default function App() {
  const [form, setForm] = useState({
    make: "toyota",
    model: "camry",
    year: "2020",
    zip_code: "90007",
    radius: "50",
    max_price: "20000",
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [saved, setSaved] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function loadSaved() {
    const r = await fetch(`${API}/api/saved`);
    setSaved(await r.json());
  }

  useEffect(() => {
    loadSaved();
  }, []);

  async function search() {
    setLoading(true);
    setResults([]);
    const qs = new URLSearchParams(form).toString();
    const r = await fetch(`${API}/api/search?${qs}`);
    const data = await r.json();
    setResults(data.listings || []);
    setLoading(false);
  }

  async function saveSearch() {
    const name = prompt("Name this alert/search (e.g., 'Camry under 20k near USC'):");
    if (!name) return;

    const body = new URLSearchParams({
      name,
      year: form.year || "",
      make: form.make || "",
      model: form.model || "",
      zip: form.zip_code || "",
      radius: form.radius || "50",
      max_price: form.max_price || "",
    });

    await fetch(`${API}/api/saved?${body.toString()}`, { method: "POST" });
    await loadSaved();
  }

  async function runAlerts() {
    const r = await fetch(`${API}/api/alerts`);
    const data = await r.json();
    setAlerts(data.matches || []);
  }

  return (
    <div>
      <header className="bg-dark text-white py-4">
        <div className="container">
          <h1 className="h3 mb-1">Car Price Checker</h1>
          <p className="mb-0 text-white-50">
            Search listings by make/model/year + ZIP/radius + price threshold.
          </p>
        </div>
      </header>

      <main className="container my-4">
        <div className="row g-4">
          <div className="col-lg-4">
            <div className="card shadow-sm">
              <div className="card-body">
                <h2 className="h5">Search</h2>

                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label">Make</label>
                    <input className="form-control" value={form.make} onChange={(e) => update("make", e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Model</label>
                    <input className="form-control" value={form.model} onChange={(e) => update("model", e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Year</label>
                    <input className="form-control" value={form.year} onChange={(e) => update("year", e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Max Price</label>
                    <input className="form-control" value={form.max_price} onChange={(e) => update("max_price", e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">ZIP</label>
                    <input className="form-control" value={form.zip_code} onChange={(e) => update("zip_code", e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Radius (mi)</label>
                    <input className="form-control" value={form.radius} onChange={(e) => update("radius", e.target.value)} />
                  </div>
                </div>

                <div className="d-grid gap-2 mt-3">
                  <button className="btn btn-primary" onClick={search} disabled={loading}>
                    {loading ? "Searching..." : "Search Listings"}
                  </button>
                  <button className="btn btn-outline-secondary" onClick={saveSearch}>
                    Save Search / Alert
                  </button>
                  <button className="btn btn-outline-dark" onClick={runAlerts}>
                    Run Alerts (Demo)
                  </button>
                </div>
              </div>
            </div>

            <div className="card shadow-sm mt-4">
              <div className="card-body">
                <h2 className="h6 mb-3">Saved Searches</h2>
                {saved.length === 0 ? (
                  <div className="text-muted">None yet.</div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {saved.map((s) => (
                      <li key={s.id} className="list-group-item px-0">
                        <div className="fw-semibold">{s.name}</div>
                        <div className="small text-muted">
                          {s.year} {s.make} {s.model} • ZIP {s.zip} • {s.radius}mi • ≤ ${s.max_price}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {alerts.length > 0 && (
              <div className="alert alert-success mt-4">
                <div className="fw-semibold">Alerts Found</div>
                <div className="small">{alerts.length} matches under your thresholds.</div>
              </div>
            )}
          </div>

          <div className="col-lg-8">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h5 mb-0">Results</h2>
              <div className="text-muted small">{results.length} shown</div>
            </div>

            {results.length === 0 ? (
              <div className="card shadow-sm">
                <div className="card-body text-muted">
                  Run a search to see listings.
                </div>
              </div>
            ) : (
              <div className="row g-3">
                {results.map((r, idx) => (
                  <div className="col-md-6" key={r.id || idx}>
                    <div className="card h-100 shadow-sm">
                      {r.image && (
                        <img src={r.image} className="card-img-top" alt="car" style={{ objectFit: "cover", height: 180 }} />
                      )}
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-semibold">
                              {r.year} {r.make} {r.model}
                            </div>
                            <div className="text-muted small">{r.trim || ""}</div>
                          </div>
                          <div className="fw-bold">${r.price?.toLocaleString?.() ?? r.price}</div>
                        </div>

                        <div className="small mt-2 text-muted">
                          {r.dealer_name || "Dealer"} • {r.city || ""} {r.state || ""}{r.dist ? ` • ${Math.round(r.dist)} mi` : ""}
                        </div>

                        <div className="small mt-1">
                          {r.miles ? `${r.miles.toLocaleString?.() ?? r.miles} miles` : ""}
                        </div>
                      </div>
                      <div className="card-footer bg-white">
                        {r.vdp_url ? (
                          <a className="btn btn-sm btn-outline-primary w-100" href={r.vdp_url} target="_blank" rel="noreferrer">
                            View Listing
                          </a>
                        ) : (
                          <button className="btn btn-sm btn-outline-secondary w-100" disabled>
                            No link available
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {alerts.length > 0 && (
              <div className="card shadow-sm mt-4">
                <div className="card-body">
                  <h3 className="h6">Alert Matches</h3>
                  <ul className="mb-0">
                    {alerts.slice(0, 6).map((a, i) => (
                      <li key={i}>
                        <span className="fw-semibold">{a.saved_search}:</span>{" "}
                        {a.car.year} {a.car.make} {a.car.model} — ${a.car.price}
                      </li>
                    ))}
                  </ul>
                  {alerts.length > 6 && <div className="small text-muted mt-2">Showing first 6…</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-top py-4">
        <div className="container small text-muted">
          Demo app • Backend: FastAPI • Data: MarketCheck Inventory Search
        </div>
      </footer>
    </div>
  );
}
