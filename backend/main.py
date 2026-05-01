import os
import sqlite3
from typing import Optional
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

#To run backend
#cd backend
#source venv/bin/activate uvicorn main:app --reload --host 0.0.0.0 --port 8000

load_dotenv()

API_KEY = os.getenv("MARKETCHECK_API_KEY")
BASE_URL = "https://api.marketcheck.com/v2"
MARKETCHECK_TERMS_URL = "https://api.marketcheck.com/v2/specs/car/terms"
VPIC_BASE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles"
VEHICLE_TYPES = ("passenger car", "truck", "multipurpose passenger vehicle")
MAX_SEARCH_RADIUS = 100

app = FastAPI(title="Car Price Checker")

# Allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "app.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
      CREATE TABLE IF NOT EXISTS saved_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        year TEXT,
        make TEXT,
        model TEXT,
        zip TEXT,
        radius INTEGER,
        max_price INTEGER
      )
    """)
    cur.execute("PRAGMA table_info(saved_searches)")
    columns = cur.fetchall()
    year_column = next((col for col in columns if col[1] == "year"), None)
    if year_column and year_column[2].upper() != "TEXT":
        cur.execute("ALTER TABLE saved_searches RENAME TO saved_searches_old")
        cur.execute("""
          CREATE TABLE saved_searches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            year TEXT,
            make TEXT,
            model TEXT,
            zip TEXT,
            radius INTEGER,
            max_price INTEGER
          )
        """)
        cur.execute("""
          INSERT INTO saved_searches (id, name, year, make, model, zip, radius, max_price)
          SELECT id, name, CAST(year AS TEXT), make, model, zip, radius, max_price
          FROM saved_searches_old
        """)
        cur.execute("DROP TABLE saved_searches_old")
    conn.commit()
    conn.close()

init_db()

def clean_make_name(name: str) -> str:
    acronym_words = {"BMW", "FIAT", "GMC", "KIA", "MINI", "RAM"}
    words = []
    for word in name.replace("-", " - ").split():
        if word == "-":
            words.append(word)
        elif word.upper() in acronym_words:
            words.append(word.upper())
        else:
            words.append(word.title())
    return " ".join(words).replace(" - ", "-").strip()

def extract_terms(data, field_name: str):
    for key in (field_name, "terms"):
        values = data.get(key)
        if isinstance(values, list):
            terms = []
            for value in values:
                if isinstance(value, str):
                    terms.append(value)
                elif isinstance(value, dict):
                    term = value.get("item") or value.get("value") or value.get("term")
                    if term:
                        terms.append(term)
            return sorted({term.strip() for term in terms if term and term.strip()})
    return []

def marketcheck_terms(field_name: str, **filters):
    if not API_KEY:
        return []

    params = {
        "api_key": API_KEY,
        "field": f"{field_name}|0|1000",
        **{key: value for key, value in filters.items() if value},
    }
    r = requests.get(MARKETCHECK_TERMS_URL, params=params, timeout=20)
    r.raise_for_status()
    return extract_terms(r.json(), field_name)

def split_year_range(year):
    if not year:
        return None, None
    value = str(year)
    if "-" not in value:
        return value, None
    start, end = value.split("-", 1)
    return start if start != "*" else None, end if end != "*" else None

@app.get("/api/vehicle-makes")
def vehicle_makes():
    try:
        makes = marketcheck_terms("make")
        if makes:
            return {"makes": makes, "source": "marketcheck"}
    except requests.RequestException:
        pass

    results = []
    for vehicle_type in VEHICLE_TYPES:
        try:
            r = requests.get(
                f"{VPIC_BASE_URL}/GetMakesForVehicleType/{quote(vehicle_type, safe='')}",
                params={"format": "json"},
                timeout=20,
            )
            r.raise_for_status()
            results.extend(r.json().get("Results", []))
        except requests.RequestException as exc:
            return JSONResponse(status_code=502, content={"error": "Vehicle make lookup failed", "detail": str(exc)})

    makes = sorted({
        clean_make_name(item.get("MakeName", item.get("Make_Name", "")).strip())
        for item in results
        if item.get("MakeName") or item.get("Make_Name")
    })
    return {"makes": makes, "source": "nhtsa"}

@app.get("/api/vehicle-models")
def vehicle_models(make: str, year: Optional[int] = None):
    quoted_make = quote(make.strip(), safe="")
    if not quoted_make:
        return {"models": []}

    try:
        models = marketcheck_terms("model", make=make, year=year)
        if models:
            return {"models": models, "source": "marketcheck"}
    except requests.RequestException:
        pass

    results = []
    for vehicle_type in VEHICLE_TYPES:
        quoted_type = quote(vehicle_type, safe="")
        if year and year > 1995:
            url = f"{VPIC_BASE_URL}/GetModelsForMakeYear/make/{quoted_make}/modelyear/{year}/vehicletype/{quoted_type}"
        else:
            url = f"{VPIC_BASE_URL}/GetModelsForMakeYear/make/{quoted_make}/vehicletype/{quoted_type}"

        try:
            r = requests.get(url, params={"format": "json"}, timeout=20)
            r.raise_for_status()
            results.extend(r.json().get("Results", []))
        except requests.RequestException as exc:
            return JSONResponse(status_code=502, content={"error": "Vehicle model lookup failed", "detail": str(exc)})

    models = sorted({
        item.get("Model_Name", "").strip()
        for item in results
        if item.get("Model_Name")
    })
    return {"models": models, "source": "nhtsa"}

@app.get("/api/search")
def search(
    year: Optional[int] = None,
    year_range: Optional[str] = None,
    make: Optional[str] = None,
    model: Optional[str] = None,
    zip: Optional[str] = Query(default=None, alias="zip_code"),
    radius: Optional[int] = 50,
    max_price: Optional[int] = None,
    car_type: str = "used",
    rows: int = 20,
    start: int = 0,
    sort_by: str = "price",
    sort_order: str = "asc",
):
    if not API_KEY:
        return {"error": "Server missing MARKETCHECK_API_KEY"}


    url = f"{BASE_URL}/search/car/active"

    params = {
        "api_key": API_KEY,
        "car_type": car_type,
        "rows": rows,
        "start": start,
        "sort_by": sort_by,
        "sort_order": sort_order,
    }

    if year: params["year"] = str(year)
    if year_range:
        params["year_range"] = year_range
    if make: params["make"] = make
    if model: params["model"] = model

    
    if zip: params["zip"] = zip
    if radius: params["radius"] = str(min(radius, MAX_SEARCH_RADIUS))


    if max_price is not None:
        params["price_range"] = f"0-{max_price}"

    print("=== /api/search called ===")
    print("params sent to MarketCheck:", params)

    r = requests.get(url, params=params, timeout=30)
    print("MarketCheck status:", r.status_code)
    print("MarketCheck body preview:", r.text[:500])

    if r.status_code != 200:
        try:
            body = r.json()
        except ValueError:
            body = {}
        return {
            "error": body.get("message") or "MarketCheck request failed",
            "status": r.status_code,
            "body": r.text,
        }

    data = r.json()
    print("MarketCheck JSON keys:", list(data.keys()) if isinstance(data, dict) else type(data))

    def _dealer(item):
        d = item.get("dealer")
        return d if isinstance(d, dict) else {}

    # Normalize to UI-friendly fields (MarketCheck returns many fields; keep what we need for list + detail)
    listings = []
    for item in data.get("listings", []) or data.get("data", []) or []:
        dealer = _dealer(item)
        media = item.get("media") if isinstance(item.get("media"), dict) else {}
        photos = media.get("photo_links") or []
        listings.append({
            "id": item.get("id") or item.get("listing_id"),
            "heading": item.get("heading"),
            "year": item.get("year"),
            "make": item.get("make"),
            "model": item.get("model"),
            "trim": item.get("trim"),
            "price": item.get("price"),
            "msrp": item.get("msrp"),
            "miles": item.get("miles"),
            "vin": item.get("vin"),
            "stock_no": item.get("stock_no"),
            "city": item.get("city"),
            "state": item.get("state"),
            "exterior_color": item.get("exterior_color") or item.get("base_ext_color"),
            "interior_color": item.get("interior_color") or item.get("base_int_color"),
            "transmission": item.get("transmission"),
            "drivetrain": item.get("drivetrain"),
            "fuel_type": item.get("fuel_type"),
            "body_type": item.get("body_style") or item.get("body_type"),
            "inventory_type": item.get("inventory_type"),
            "seller_type": item.get("seller_type"),
            "dealer_name": dealer.get("name") or item.get("dealer_name"),
            "dealer_street": dealer.get("street"),
            "dealer_city": dealer.get("city"),
            "dealer_state": dealer.get("state"),
            "dealer_zip": dealer.get("zip"),
            "dealer_phone": dealer.get("phone"),
            "dealer_website": dealer.get("website"),
            "vdp_url": item.get("vdp_url") or item.get("source_link"),
            "dist": item.get("dist"),
            "image": photos[0] if photos else None,
            "images": photos[:12],
        })

    return {
        "total": data.get("num_found") or data.get("total") or len(listings),
        "rows": rows,
        "start": start,
        "listings": listings
    }

@app.get("/api/saved")
def get_saved():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, name, year, make, model, zip, radius, max_price FROM saved_searches ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()
    return [
        {"id": r[0], "name": r[1], "year": r[2], "make": r[3], "model": r[4], "zip": r[5], "radius": r[6], "max_price": r[7]}
        for r in rows
    ]

@app.post("/api/saved")
def save_search(
    name: str,
    year: Optional[int] = None,
    make: Optional[str] = None,
    model: Optional[str] = None,
    zip: Optional[str] = None,
    radius: Optional[int] = 50,
    max_price: Optional[int] = None,
):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO saved_searches (name, year, make, model, zip, radius, max_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (name, year, make, model, zip, radius, max_price),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return {"ok": True, "id": new_id}

@app.delete("/api/saved/{id}")
def delete_saved(id: int):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("DELETE FROM saved_searches WHERE id = ?", (id,))
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    if deleted == 0:
        return JSONResponse(status_code=404, content={"error": "Not found"})
    return {"ok": True}

@app.get("/api/alerts")
def alerts():
    """
    Demo-friendly: checks saved searches and returns any listings below max_price.
    (In a real app you'd schedule this.)
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, name, year, make, model, zip, radius, max_price FROM saved_searches")
    saved = cur.fetchall()
    conn.close()

    matches = []
    for s in saved:
        _, name, year, make, model, zip, radius, max_price = s
        if not max_price:
            continue
        min_year, max_year = split_year_range(year)
        year_arg = int(min_year) if min_year and min_year == max_year else None
        year_range_arg = year if year and year_arg is None else None
        res = search(
            year=year_arg,
            year_range=year_range_arg,
            make=make,
            model=model,
            zip=zip,
            radius=radius,
            max_price=max_price,
            rows=10,
        )
        for car in res.get("listings", []):
            if car.get("price") is not None and car["price"] <= max_price:
                matches.append({"saved_search": name, "car": car})

    return {"matches": matches}
