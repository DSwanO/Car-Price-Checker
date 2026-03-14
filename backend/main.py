import os
import sqlite3
from typing import Optional

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

API_KEY = os.getenv("MARKETCHECK_API_KEY")
BASE_URL = "https://api.marketcheck.com/v2"

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
        year INTEGER,
        make TEXT,
        model TEXT,
        zip TEXT,
        radius INTEGER,
        max_price INTEGER
      )
    """)
    conn.commit()
    conn.close()

init_db()

@app.get("/api/search")
def search(
    year: Optional[int] = None,
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
    if make: params["make"] = make
    if model: params["model"] = model

    
    if zip: params["zip"] = zip
    if radius: params["radius"] = str(radius)


    if max_price is not None:
        params["price_range"] = f"0-{max_price}"

    print("=== /api/search called ===")
    print("params sent to MarketCheck:", params)

    r = requests.get(url, params=params, timeout=30)
    print("MarketCheck status:", r.status_code)
    print("MarketCheck body preview:", r.text[:500])

    if r.status_code != 200:
        return {"error": "MarketCheck request failed", "status": r.status_code, "body": r.text}

    data = r.json()
    print("MarketCheck JSON keys:", list(data.keys()) if isinstance(data, dict) else type(data))

    # Normalize to UI-friendly fields (MarketCheck returns many fields; keep just what we need)
    listings = []
    for item in data.get("listings", []) or data.get("data", []) or []:
        listings.append({
            "id": item.get("id") or item.get("listing_id"),
            "year": item.get("year"),
            "make": item.get("make"),
            "model": item.get("model"),
            "trim": item.get("trim"),
            "price": item.get("price"),
            "miles": item.get("miles"),
            "city": item.get("city"),
            "state": item.get("state"),
            "dealer_name": (item.get("dealer") or {}).get("name") if isinstance(item.get("dealer"), dict) else item.get("dealer_name"),
            "vdp_url": item.get("vdp_url") or item.get("source_link"),
            "dist": item.get("dist"),  # distance (if returned)
            "image": (item.get("media") or {}).get("photo_links", [None])[0] if isinstance(item.get("media"), dict) else None
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
        res = search(year=year, make=make, model=model, zip=zip, radius=radius, max_price=max_price, rows=10)
        for car in res.get("listings", []):
            if car.get("price") is not None and car["price"] <= max_price:
                matches.append({"saved_search": name, "car": car})

    return {"matches": matches}
