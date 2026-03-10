import { useEffect, useMemo, useState } from "react";
import bgImage from "./assets/garage-bg.jpg"; // <-- Make sure this file exists
import logo from "./assets/logo.png"; // <-- Make sure this file exists too

const API = "http://localhost:8000";

function money(n) {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  return Number.isFinite(num) ? `$${num.toLocaleString()}` : `$${n}`;
}

export default function App() {
  const [form, setForm] = useState({
    make: "Ferrari",
    model: "GTB coupe",
    year: "2018",
    zip_code: "90210",
    radius: "50",
    max_price: "300,000",
  });

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [saved, setSaved] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sort, setSort] = useState("price_asc");

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function loadSaved() {
    try {
      const r = await fetch(`${API}/api/saved`);
      const data = await r.json();
      setSaved(Array.isArray(data) ? data : []);
    } catch {
      setSaved([]);
    }
  }

  useEffect(() => {
    loadSaved();
  }, []);

  async function search() {
    setLoading(true);
    setAlerts([]);
    try {
      const cleanedForm = {
        ...form,
        max_price: form.max_price.replace(/,/g, "")
      };
      
      const qs = new URLSearchParams(form).toString();
      const r = await fetch(`${API}/api/search?${qs}`);
      const data = await r.json();
      setResults(Array.isArray(data?.listings) ? data.listings : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveSearch() {
    const name = prompt("Name this saved search:");
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
    setAlerts(Array.isArray(data?.matches) ? data.matches : []);
  }

  const sortedResults = useMemo(() => {
    const arr = [...results];
    arr.sort((a, b) => (a.price || 0) - (b.price || 0));
    return arr;
  }, [results]);

  return (
    <div>
{/* HERO */}
<div className="gg-hero text-white">
  <div className="container py-4">
    <div className="d-flex align-items-center gap-3">
      
      {/* Logo Container */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(6px)"
        }}
      >
        <img
          src={logo}
          alt="GarageGuard Logo"
          style={{
            width: 70,
            height: 70,
            objectFit: "contain"
          }}
        />
      </div>

      {/* Brand Text */}
      <h1 className="display-5 fw-bold text-white mb-0">
        GarageGuard
      </h1>

    </div>

    <div className="text-white-50 mt-2">
      Smart local car price monitoring powered by MarketCheck
    </div>

          {/* Search Card */}
          <div className="bg-white text-dark mt-4 p-4 rounded-4 shadow">
            <div className="row g-3">
              <div className="col-md-2">
                <label htmlFor="make" className="form-label fw-semibold small">Make</label>
                <input
                  className="form-control"
                  value={form.make}
                  onChange={(e) => update("make", e.target.value)} />
              </div>

              <div className="col-md-2">
                <label htmlFor="model" className="form-label fw-semibold small">Model</label>
                <input
                  className="form-control"
                  value={form.model}
                  onChange={(e) => update("model", e.target.value)} />
              </div>

              <div className="col-md-2">
                <label htmlFor="year" className="form-label fw-semibold small">Year</label>
                <input
                  className="form-control"
                  value={form.year}
                  onChange={(e) => update("year", e.target.value)} />
              </div>

              <div className="col-md-2">
                <label htmlFor="max_price" className="form-label fw-semibold small">Max Price</label>
                <input
                  type="number"
                  id = "max_price"
                  className="form-control"
                  value={form.max_price}
                  onChange={(e) => update("max_price", e.target.value)} />
              </div>

              <div className="col-md-2">
                <label htmlFor="zip_code" className="form-label fw-semibold small">ZIP Code</label>
                <input
                  className="form-control"
                  value={form.zip_code}
                  onChange={(e) => update("zip_code", e.target.value)} />
              </div>

              <div className="col-md-2">
                <label htmlFor="radius" className="form-label fw-semibold small">Radius (mi)</label>
                <input
                  className="form-control"
                  value={form.radius}
                  onChange={(e) => update("radius", e.target.value)} />
              </div>

              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" onClick={search}>
                  {loading ? "Searching..." : "Search"}
                </button>
                <button className="btn btn-outline-secondary" onClick={saveSearch}>
                  Save Alert
                </button>
                <button className="btn btn-outline-dark" onClick={runAlerts}>
                  Run Alerts
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN WITH BACKGROUND IMAGE */}
      <main
        style={{
          backgroundImage: `linear-gradient(rgba(5,10,20,0.55), rgba(5,10,20,0.55)), url(${bgImage})`,
          backgroundSize: "cover",
          backgroundColor: "#0b1220",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
          minHeight: results.length === 0 ? "calc(100vh - 300px)" : "auto",
          display: "flex",
          alignItems: results.length === 0 ? "center" : "flex-start",
          paddingTop: "60px",
          paddingBottom: "60px",
        }}
      >
        <div className="container py-5">
          <div className="row g-4">
            {sortedResults.length === 0 ? (
              <div className="text-center text-white">
                No results yet. Run a search.
              </div>
            ) : (
              sortedResults.map((r, idx) => (
                <div className="col-md-6 col-lg-4" key={idx}>
                  <div className="card shadow-sm rounded-4 h-100">
                    {r.image && (
                      <img
                        src={r.image}
                        alt="car"
                        className="card-img-top"
                        style={{ height: 200, objectFit: "cover" }}
                      />
                    )}
                    <div className="card-body">
                      <h5 className="fw-bold">
                        {r.year} {r.make} {r.model}
                      </h5>
                      <div className="text-primary fw-semibold">
                        {money(r.price)}
                      </div>
                      <div className="small text-muted mt-2">
                        {r.dealer_name || "Dealer"}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <footer className="text-center text-white mt-5 small">
            GarageGuard • Demo Project • MarketCheck API
          </footer>
        </div>
      </main>
    </div>
  );
}