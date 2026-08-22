#!/usr/bin/env python3
"""
Fetch real hourly precipitation for each Orbital CDN gateway from NASA POWER
and bake it into a static JSON trace the browser can replay.

Why baked rather than fetched at runtime: the app is a static site with no
backend, and a demo must not depend on a third-party API being up. The data is
real either way; this only moves when it is fetched.

IMPORTANT UNIT NOTE: the POWER hourly endpoint reports PRECTOTCORR in mm/day
even though the samples are hourly. It is a rate expressed in daily units, so
it must be divided by 24 to get mm/h. Getting this wrong inflates rain rates
24x and would make every fade figure nonsense.

Source: NASA POWER hourly API, https://power.larc.nasa.gov/api/temporal/hourly/point
Parameters: PRECTOTCORR (precipitation, corrected), T2M, RH2M
"""

import json
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "predict" / "weather_trace.json"

# Real teleport coordinates, matching src/network.js
SITES = [
    ("Singapore",    "Seletar Teleport",     1.3972, 103.8343),
    ("Mumbai",       "approximate",         19.1000,  72.9000),
    ("Frankfurt",    "Usingen",             50.3363,   8.5372),
    ("Virginia",     "Boydton, VA",         36.6676, -78.3904),
    ("Tokyo GW",     "Hitachinaka",         36.3967, 140.5333),
    ("Sao Paulo GW", "Santana de Parnaiba", -23.4439, -46.9178),
    ("Sydney GW",    "Belrose (Optus)",     -33.7173, 151.2115),
    ("Lagos GW",     "Lekki",                 6.4698,   3.5852),
]

START, END = "20260401", "20260731"   # 4 months of real hourly observations


def fetch(lat, lon):
    url = (
        "https://power.larc.nasa.gov/api/temporal/hourly/point"
        f"?parameters=PRECTOTCORR&community=RE"
        f"&longitude={lon}&latitude={lat}&start={START}&end={END}&format=JSON"
    )
    with urllib.request.urlopen(url, timeout=180) as r:
        return json.load(r)


def main():
    out = {
        "source": "NASA POWER hourly API (power.larc.nasa.gov)",
        "parameter": "PRECTOTCORR",
        "native_units": "mm/day sampled hourly",
        "stored_units": "mm/h (native / 24)",
        "period": f"{START}-{END}",
        "fetched": time.strftime("%Y-%m-%d"),
        "sites": {},
    }

    for name, site, lat, lon in SITES:
        print(f"  {name:14s} {site:22s} ", end="", flush=True)
        d = fetch(lat, lon)
        raw = d["properties"]["parameter"]["PRECTOTCORR"]
        keys = sorted(raw)
        # mm/day -> mm/h; POWER uses -999 for fill
        rates = [round(raw[k] / 24.0, 4) if raw[k] is not None and raw[k] > -900 else 0.0
                 for k in keys]
        nz = [r for r in rates if r >= 0.1]
        out["sites"][name] = {
            "site": site, "lat": lat, "lon": lon,
            "start_hour": keys[0], "n": len(rates),
            "wet_fraction": round(len(nz) / len(rates), 4),
            "max_mm_h": round(max(rates), 3),
            "rates_mm_h": rates,
        }
        print(f"n={len(rates)}  wet={len(nz)/len(rates)*100:4.1f}%  max={max(rates):5.2f} mm/h")
        time.sleep(1)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"\nwrote {OUT}  ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
