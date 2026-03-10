# GarageGuard (Car Price Checker)

GarageGuard is a full-stack web app that searches for car listings by **make, model, year, zip code, radius**, and **max price**. Users can save searches and run a demo “alert” check to find listings below their price threshold.

> Status: Demo-ready. MarketCheck integration can be enabled via API key (or the app can run in mock/demo mode).

---

## Features

- Search listings by make/model/year, price cap, and distance radius
- Results displayed as cards (image, dealer, price, etc.)
- Save searches to SQLite
- “Run Alerts” simulation: checks saved searches and returns matches under max price

---

## Tech Stack

**Frontend**
- React + Vite
- Bootstrap

**Backend**
- Python + FastAPI
- SQLite (saved searches)
- Requests (MarketCheck API calls)

---

## Project Structure
