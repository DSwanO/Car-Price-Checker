import { useEffect, useMemo, useState } from "react";
import logo from "./assets/GarageGuard.png";

const API = "http://localhost:8000";
const HTTP_URL_RE = /^https?:\/\//i;

function money(n) {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  return Number.isFinite(num) ? `$${num.toLocaleString()}` : `$${n}`;
}

function DetailRow({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="d-flex justify-content-between gap-3 py-2 border-bottom border-secondary-subtle">
      <span className="text-muted small">{label}</span>
      <span className="text-end small fw-medium">{String(value)}</span>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState({
    make: "Ferrari",
    model: "GTB coupe",
    year: "2018",
    zip_code: "90210",
    radius: "50",
    max_price: "300000",
  });

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [saved, setSaved] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sort, setSort] = useState("price_asc");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

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

  useEffect(() => {
    if (!selectedListing) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (lightboxUrl) setLightboxUrl(null);
        else setSelectedListing(null);
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selectedListing, lightboxUrl]);

  useEffect(() => {
    if (!selectedListing) setLightboxUrl(null);
  }, [selectedListing]);

  async function search() {
  setLoading(true);
  setAlerts([]);
  setErrorMsg("");

  try {
    const cleanedForm = {
      ...form,
      max_price: (form.max_price || "").replace(/,/g, ""),
    };

    const qs = new URLSearchParams(cleanedForm).toString();
    console.log("Calling:", `${API}/api/search?${qs}`);

    const r = await fetch(`${API}/api/search?${qs}`);
    const data = await r.json();

    console.log("search status:", r.status);
    console.log("search response:", data);

    if (!r.ok || data?.error) {
      setResults([]);
      setErrorMsg(data?.error ? `${data.error}${data.status ? ` (${data.status})` : ""}` : `Request failed (${r.status})`);
      return;
    }

    const listings = Array.isArray(data?.listings) ? data.listings : [];
    setResults(listings);

    if (listings.length === 0) {
      setErrorMsg("Search worked, but no vehicles matched that search.");
    }
  } catch (err) {
    console.error("search failed:", err);
    setResults([]);
    setErrorMsg(`Search failed: ${err.message}`);
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
      max_price: (form.max_price || "").replace(/,/g, ""),
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
    <div className="gg-hero text-white" style={{ minHeight: "100vh" }}>
{/* HERO */}
<div>
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

      {/* HOW GARAGEGUARD WORKS */}
      <section className="gg-how-it-works py-5 mt-5">
        <div className="container">
          <h2 className="text-center fw-bold mb-3" style={{ color: "#1e293b" }}>
            How GarageGuard Works
          </h2>
          <p className="text-center mx-auto mb-5" style={{ maxWidth: 640, color: "#64748b" }}>
            GarageGuard aggregates car listings from dealers nationwide. Search by make, model, year, and location—then save your searches and run alerts to find deals below your target price. One search, all the results you need.
          </p>
          <div className="row g-4 justify-content-center">
            <div className="col-md-6 col-lg-4">
              <div className="gg-feature-card text-center p-4">
                <div className="gg-feature-icon mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </div>
                <h5 className="fw-bold mb-2" style={{ color: "#1e293b" }}>Just the Cars You Want</h5>
                <p className="mb-0 small" style={{ color: "#64748b" }}>
                  Filter by make, model, year, price range, and ZIP code. Cast your net locally or expand your radius to find the best deals.
                </p>
              </div>
            </div>
            <div className="col-md-6 col-lg-4">
              <div className="gg-feature-card text-center p-4">
                <div className="gg-feature-icon mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.777.416L8 13.101l-5.223 2.815A.5.5 0 0 1 2 15.5V2zm2-1a1 1 0 0 0-1 1v12.566l4.723-2.482a.5.5 0 0 1 .554 0L13 14.566V2a1 1 0 0 0-1-1H4z"/>
                  </svg>
                </div>
                <h5 className="fw-bold mb-2" style={{ color: "#1e293b" }}>Save & Run Alerts</h5>
                <p className="mb-0 small" style={{ color: "#64748b" }}>
                  Save your favorite searches and run alerts to see listings below your max price. Never miss a deal on the car you want.
                </p>
              </div>
            </div>
            <div className="col-md-6 col-lg-4">
              <div className="gg-feature-card text-center p-4">
                <div className="gg-feature-icon mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3zm2-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H2z"/>
                    <path d="M5 5.5A.5.5 0 0 1 5.5 5h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 5.5zm0 2A.5.5 0 0 1 5.5 8h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 7.5zm0 2A.5.5 0 0 1 5.5 10h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 5 9.5z"/>
                  </svg>
                </div>
                <h5 className="fw-bold mb-2" style={{ color: "#1e293b" }}>Powered by MarketCheck</h5>
                <p className="mb-0 small" style={{ color: "#64748b" }}>
                  Real-time inventory data from dealers across the country. Fresh listings and accurate prices, all in one place.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <main
        style={{
          minHeight: results.length === 0 ? "calc(100vh - 300px)" : "auto",
          display: "flex",
          alignItems: results.length === 0 ? "center" : "flex-start",
          paddingTop: "60px",
          paddingBottom: "60px",
        }}
      >
        <div className="container py-5">
          {errorMsg && (<div className="alert alert-warning mb-4" role="alert">
            {errorMsg}
            </div>
          )}
          
          <div className="row g-4">
            {sortedResults.length === 0 ? null : (
              sortedResults.map((r, idx) => (
                <div className="col-md-6 col-lg-4" key={r.id ?? idx}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="card shadow-sm rounded-4 h-100 text-start border-0 gg-listing-card"
                    onClick={() => setSelectedListing(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedListing(r);
                      }
                    }}
                  >
                    {r.image && (
                      <img
                        src={r.image}
                        alt=""
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
                      {r.vdp_url && HTTP_URL_RE.test(r.vdp_url) && (
                        <a
                          className="small text-secondary text-decoration-none"
                          href={r.vdp_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          style={{ display: "block" }}
                        >
                          View on dealer site ↗
                        </a>
                      )}
                      <div className="small text-primary mt-2">Click for details →</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedListing && (
            <div
              className="modal fade show d-block"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
              onClick={() => {
                setLightboxUrl(null);
                setSelectedListing(null);
              }}
            >
              <div
                className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-content rounded-4 text-dark">
                  <div className="modal-header border-0 pb-0">
                    <div>
                      <h5 className="modal-title fw-bold">
                        {selectedListing.heading ||
                          `${selectedListing.year} ${selectedListing.make} ${selectedListing.model}`}
                      </h5>
                      {selectedListing.trim && (
                        <div className="small text-muted">{selectedListing.trim}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={() => {
                        setLightboxUrl(null);
                        setSelectedListing(null);
                      }}
                    />
                  </div>
                  <div className="modal-body pt-2">
                    {Array.isArray(selectedListing.images) && selectedListing.images.length > 0 && (
                      <div className="row g-2 mb-3">
                        {selectedListing.images.slice(0, 6).map((url, i) => (
                          <div className="col-6 col-md-4" key={i}>
                            <img
                              src={url}
                              alt="Car photo thumbnail"
                              className="img-fluid rounded-3 w-100"
                              style={{ height: 120, objectFit: "cover", cursor: "zoom-in" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxUrl(url);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    {lightboxUrl && (
                      <div
                        style={{
                          position: "fixed",
                          inset: 0,
                          backgroundColor: "rgba(0,0,0,0.75)",
                          zIndex: 2000,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 20,
                        }}
                        onClick={() => setLightboxUrl(null)}
                      >
                        <div
                          style={{
                            position: "relative",
                            maxWidth: 1100,
                            width: "100%",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn-close"
                            aria-label="Close photo"
                            style={{ position: "absolute", top: -10, right: -10 }}
                            onClick={() => setLightboxUrl(null)}
                          />
                          <img
                            src={lightboxUrl}
                            alt="Car photo"
                            className="img-fluid rounded-4 w-100"
                            style={{ maxHeight: "80vh", objectFit: "contain" }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="fw-semibold text-primary mb-2 fs-5">
                      {money(selectedListing.price)}
                      {selectedListing.msrp != null && selectedListing.msrp !== "" && (
                        <span className="text-muted small ms-2 fw-normal">
                          MSRP {money(selectedListing.msrp)}
                        </span>
                      )}
                    </div>
                    <DetailRow label="Mileage" value={selectedListing.miles != null ? `${Number(selectedListing.miles).toLocaleString()} mi` : null} />
                    <DetailRow label="VIN" value={selectedListing.vin} />
                    <DetailRow label="Stock #" value={selectedListing.stock_no} />
                    <DetailRow label="Exterior" value={selectedListing.exterior_color} />
                    <DetailRow label="Interior" value={selectedListing.interior_color} />
                    <DetailRow label="Transmission" value={selectedListing.transmission} />
                    <DetailRow label="Drivetrain" value={selectedListing.drivetrain} />
                    <DetailRow label="Fuel" value={selectedListing.fuel_type} />
                    <DetailRow label="Body" value={selectedListing.body_type} />
                    <DetailRow label="Inventory" value={selectedListing.inventory_type} />
                    <DetailRow label="Seller" value={selectedListing.seller_type} />
                    <DetailRow
                      label="Location"
                      value={
                        [selectedListing.city, selectedListing.state].filter(Boolean).join(", ") ||
                        null
                      }
                    />
                    {selectedListing.dist != null && selectedListing.dist !== "" && (
                      <DetailRow label="Distance" value={`${selectedListing.dist} mi`} />
                    )}
                    <div className="mt-3 pt-2 border-top border-secondary-subtle">
                      <div className="small text-muted mb-1">Dealer</div>
                      <div className="fw-semibold">{selectedListing.dealer_name || "—"}</div>
                      <DetailRow
                        label="Address"
                        value={
                          [
                            selectedListing.dealer_street,
                            [selectedListing.dealer_city, selectedListing.dealer_state, selectedListing.dealer_zip]
                              .filter(Boolean)
                              .join(" "),
                          ]
                            .filter(Boolean)
                            .join(", ") || null
                        }
                      />
                      <DetailRow label="Phone" value={selectedListing.dealer_phone} />
                      {selectedListing.dealer_website && (
                        <div className="small mt-2">
                          <a
                            href={selectedListing.dealer_website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Dealer website
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0">
                    {selectedListing.vdp_url && HTTP_URL_RE.test(selectedListing.vdp_url) && (
                      <a
                        className="btn btn-primary"
                        href={selectedListing.vdp_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View full listing
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setLightboxUrl(null);
                        setSelectedListing(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <footer className="text-center text-white mt-5 small">
            GarageGuard • Demo Project • MarketCheck API
          </footer>
        </div>
      </main>
    </div>
  );
}