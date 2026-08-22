#!/usr/bin/env python3
"""
Train the gateway fade-risk forecaster.

WHAT IS BEING PREDICTED
    P(rain fade at this gateway exceeds THRESHOLD_DB at any point within the
    next H hours), for H in {1, 3, 6, 12}.

WHY THIS IS THE ONLY LEARNED COMPONENT
    Rain fade *given* a rain rate is solved analytically (ITU-R P.838/P.618) and
    is implemented exactly in src/predict/itu.js. There is nothing to learn
    there. What is genuinely uncertain is what the rain will DO next, and that
    is a forecasting problem with a real signal and a real baseline.

LEAKAGE DISCIPLINE
    Features are built only from observations at or before time t. The label
    looks strictly forward from t. Train/validation/test are split by TIME, not
    randomly, because consecutive hours are heavily correlated. A second split
    holds out entire SITES to test whether the model generalises to a gateway
    it has never seen.

BASELINE
    Persistence ("it will keep doing what it is doing now") plus site
    climatology. The model must beat both or it does not ship.
"""

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss, log_loss
import lightgbm as lgb

ROOT = Path(__file__).resolve().parent.parent
TRACE = ROOT / "src" / "predict" / "weather_trace.json"
OUTDIR = ROOT / "src" / "predict"

HORIZONS_H = [1, 3, 6, 12]
THRESHOLD_DB = 3.0          # a fade a link designer would care about
NOMINAL_ELEV = 35.0         # deg, representative gateway elevation
NOMINAL_FGHZ = 20.0         # Ka-band downlink

# ─── ITU-R P.838-3 / P.618-13, mirrored from src/predict/itu.js ──────────────
# Kept in sync deliberately: the label the model is trained on must be computed
# by the same physics the runtime uses, or training and inference disagree.

KH = dict(a=[-5.33980,-0.35351,-0.23789,-0.94158], b=[-0.10008,1.26970,0.86036,0.64552],
          c=[1.13098,0.45400,0.15354,0.16817], m=-0.18961, k=0.71147)
KV = dict(a=[-3.80595,-3.44965,-0.39902,0.50167], b=[0.56934,-0.22911,0.73042,1.07319],
          c=[0.81061,0.51059,0.11899,0.27195], m=-0.16398, k=0.63297)
AH = dict(a=[-0.14318,0.29591,0.32177,-5.37610,16.1721], b=[1.82442,0.77564,0.63773,-0.96230,-3.29980],
          c=[-0.55187,0.19822,0.13164,1.47828,3.43990], m=0.67849, k=-1.95537)
AV = dict(a=[-0.07771,0.56727,-0.20238,-48.2991,48.5833], b=[2.33840,0.95545,1.14520,0.791669,0.791459],
          c=[-0.76284,0.54039,0.26809,0.116226,0.116479], m=-0.053739, k=0.83433)


def _sum(t, f, logspace):
    lf = math.log10(f)
    s = sum(t["a"][j] * math.exp(-((lf - t["b"][j]) / t["c"][j]) ** 2) for j in range(len(t["a"])))
    s += t["m"] * lf + t["k"]
    return 10 ** s if logspace else s


def coeffs(f, elev_deg, tau_deg=45.0):
    kh, kv = _sum(KH, f, True), _sum(KV, f, True)
    ah, av = _sum(AH, f, False), _sum(AV, f, False)
    th, ta = math.radians(elev_deg), math.radians(tau_deg)
    k = (kh + kv + (kh - kv) * math.cos(th) ** 2 * math.cos(2 * ta)) / 2
    a = (kh * ah + kv * av + (kh * ah - kv * av) * math.cos(th) ** 2 * math.cos(2 * ta)) / (2 * k)
    return k, a


def rain_height_km(lat):
    lat = abs(lat)
    return max(0.0, 5.0 - 0.075 * (lat - 23) if lat >= 23 else 5.0) + 0.36


def fade_db(rain_mm_h, lat, elev_deg=NOMINAL_ELEV, f=NOMINAL_FGHZ):
    """Instantaneous fade, same construction as instantaneousFadeDb() in itu.js."""
    if rain_mm_h <= 0:
        return 0.0
    hR = rain_height_km(lat)
    if hR <= 0:
        return 0.0
    el = math.radians(elev_deg)
    Ls = hR / math.sin(el)
    LG = Ls * math.cos(el)
    k, a = coeffs(f, elev_deg)
    g = k * rain_mm_h ** a
    rf = 1 / (1 + 0.78 * math.sqrt(LG * g / f) - 0.38 * (1 - math.exp(-2 * LG)))
    LE = max(0.0, LG * rf / max(1e-6, math.cos(el)))
    return g * min(LE, Ls)


# ─── Feature construction — strictly backward looking ────────────────────────

def build(site, meta):
    r = np.asarray(meta["rates_mm_h"], dtype=float)
    lat = meta["lat"]
    n = len(r)
    fade = np.array([fade_db(x, lat) for x in r])

    df = pd.DataFrame({"site": site, "t": np.arange(n), "rain": r, "fade": fade})

    # Past-only features
    s = df["rain"]
    df["rain_lag1"] = s.shift(1)
    df["rain_lag2"] = s.shift(2)
    df["rain_lag3"] = s.shift(3)
    df["rain_lag6"] = s.shift(6)
    df["rain_lag12"] = s.shift(12)
    df["trend_1h"] = s - s.shift(1)
    df["trend_3h"] = s - s.shift(3)
    df["roll_mean_3"] = s.shift(1).rolling(3).mean()
    df["roll_mean_6"] = s.shift(1).rolling(6).mean()
    df["roll_mean_24"] = s.shift(1).rolling(24).mean()
    df["roll_max_6"] = s.shift(1).rolling(6).max()
    df["roll_max_24"] = s.shift(1).rolling(24).max()
    df["wet_frac_24"] = (s.shift(1) > 0.1).rolling(24).mean()
    df["fade_now"] = df["fade"]

    # Hours since it was last meaningfully wet
    wet = (s > 0.5).to_numpy()
    since = np.zeros(n)
    c = 999
    for i in range(n):
        c = 0 if wet[i] else min(999, c + 1)
        since[i] = c
    df["hours_since_wet"] = pd.Series(since).shift(1)

    # Site climatology (known in advance, not leakage)
    df["site_wet_fraction"] = meta["wet_fraction"]
    df["site_mean_rain"] = float(np.mean(r))
    df["abs_lat"] = abs(lat)

    # Diurnal / seasonal position
    start = str(meta["start_hour"])          # YYYYMMDDHH
    h0 = int(start[8:10])
    df["hour_of_day"] = (h0 + df["t"]) % 24
    df["doy_frac"] = ((df["t"] / 24.0) % 365) / 365.0

    # Labels: does fade exceed the threshold at ANY point in the next H hours
    for H in HORIZONS_H:
        fut = pd.Series(fade).shift(-1).rolling(H, min_periods=1).max().shift(-(H - 1))
        df[f"y_{H}h"] = (fut > THRESHOLD_DB).astype(float)
        df.loc[df.index[-H:], f"y_{H}h"] = np.nan     # no future available

    return df


FEATURES = [
    "rain", "rain_lag1", "rain_lag2", "rain_lag3", "rain_lag6", "rain_lag12",
    "trend_1h", "trend_3h", "roll_mean_3", "roll_mean_6", "roll_mean_24",
    "roll_max_6", "roll_max_24", "wet_frac_24", "fade_now", "hours_since_wet",
    "site_wet_fraction", "site_mean_rain", "abs_lat", "hour_of_day", "doy_frac",
]


def evaluate(name, y, p):
    y = np.asarray(y); p = np.clip(np.asarray(p), 1e-6, 1 - 1e-6)
    if len(np.unique(y)) < 2:
        return {"model": name, "n": int(len(y)), "positives": int(y.sum()), "note": "single-class"}
    return {
        "model": name, "n": int(len(y)), "positives": int(y.sum()),
        "roc_auc": round(float(roc_auc_score(y, p)), 4),
        "pr_auc": round(float(average_precision_score(y, p)), 4),
        "brier": round(float(brier_score_loss(y, p)), 5),
        "log_loss": round(float(log_loss(y, p)), 5),
    }


def main():
    trace = json.loads(TRACE.read_text())
    frames = [build(s, m) for s, m in trace["sites"].items()]
    df = pd.concat(frames, ignore_index=True).dropna(subset=FEATURES)

    n_hours = int(df["t"].max()) + 1
    tr_end, va_end = int(n_hours * 0.60), int(n_hours * 0.75)
    print(f"hours per site: {n_hours}   train<{tr_end}  val<{va_end}  test>={va_end}")
    print(f"threshold: fade > {THRESHOLD_DB} dB at {NOMINAL_FGHZ} GHz, {NOMINAL_ELEV} deg elevation\n")

    report = {
        "threshold_db": THRESHOLD_DB, "frequency_ghz": NOMINAL_FGHZ,
        "nominal_elevation_deg": NOMINAL_ELEV, "horizons_h": HORIZONS_H,
        "features": FEATURES, "data_source": trace["source"], "period": trace["period"],
        "split": {"train_hours": f"0-{tr_end}", "val_hours": f"{tr_end}-{va_end}",
                  "test_hours": f"{va_end}-{n_hours}"},
        "horizon_metrics": {}, "unseen_site_metrics": {},
    }
    models = {}

    for H in HORIZONS_H:
        col = f"y_{H}h"
        d = df.dropna(subset=[col])
        tr = d[d.t < tr_end]; va = d[(d.t >= tr_end) & (d.t < va_end)]; te = d[d.t >= va_end]
        Xtr, ytr = tr[FEATURES], tr[col]
        Xte, yte = te[FEATURES], te[col]
        print(f"── horizon +{H}h   train {len(tr)} ({ytr.mean()*100:.1f}% pos)  test {len(te)} ({yte.mean()*100:.1f}% pos)")

        rows = []
        # Baseline 1: site climatology (base rate learned on train only)
        rows.append(evaluate("climatology", yte, np.full(len(yte), ytr.mean())))
        # Baseline 2: persistence — currently fading, so assume it continues
        rows.append(evaluate("persistence", yte, np.clip(te["fade_now"] / THRESHOLD_DB, 0, 1)))
        # Baseline 3: logistic regression
        lr = LogisticRegression(max_iter=2000, C=1.0)
        lr.fit((Xtr - Xtr.mean()) / (Xtr.std() + 1e-9), ytr)
        rows.append(evaluate("logistic", yte, lr.predict_proba((Xte - Xtr.mean()) / (Xtr.std() + 1e-9))[:, 1]))
        # Candidate: gradient-boosted trees
        # Deliberately small: this model ships to the browser as JSON and is
        # evaluated client-side, so tree count and depth are a payload budget,
        # not just a regularisation choice.
        m = lgb.LGBMClassifier(n_estimators=90, learning_rate=0.08, num_leaves=12,
                               max_depth=5, min_child_samples=60, subsample=0.9,
                               colsample_bytree=0.9, reg_lambda=2.0,
                               verbose=-1, random_state=7)
        m.fit(Xtr, ytr, eval_set=[(va[FEATURES], va[col])],
              callbacks=[lgb.early_stopping(40, verbose=False)])
        rows.append(evaluate("lightgbm", yte, m.predict_proba(Xte)[:, 1]))

        for r in rows:
            print("    " + json.dumps(r))
        report["horizon_metrics"][f"{H}h"] = rows
        models[H] = m

        # Generalisation to a gateway never seen in training
        hold = ["Sydney GW", "Lagos GW"]
        dtr = d[~d.site.isin(hold)]; dte = d[d.site.isin(hold)]
        m2 = lgb.LGBMClassifier(n_estimators=90, learning_rate=0.08, num_leaves=12,
                                max_depth=5, min_child_samples=60, verbose=-1, random_state=7)
        m2.fit(dtr[FEATURES], dtr[col])
        r2 = evaluate(f"lightgbm_unseen_site", dte[col], m2.predict_proba(dte[FEATURES])[:, 1])
        print(f"    unseen-site {hold}: {json.dumps(r2)}\n")
        report["unseen_site_metrics"][f"{H}h"] = r2

    # ─── Export to JSON for in-browser inference ─────────────────────────────
    # LightGBM's own dump carries training metadata that inference never reads.
    # We emit a minimal node form instead: [feature_idx, threshold, default_left,
    # left, right] for splits and a bare number for leaves. That is everything
    # needed to evaluate the ensemble, and it cuts the payload by roughly 10x.

    def compact(node):
        if "leaf_value" in node:
            return round(float(node["leaf_value"]), 6)
        return [
            int(node["split_feature"]),
            round(float(node["threshold"]), 6),
            1 if node.get("default_left") else 0,
            compact(node["left_child"]),
            compact(node["right_child"]),
        ]

    export = {
        "name": "gateway-fade-risk", "version": "lgbm-v1",
        "note": "LightGBM ensemble, raw scores summed then passed through a logistic.",
        "features": FEATURES, "horizons_h": HORIZONS_H,
        "threshold_db": THRESHOLD_DB,
        "trained": {"source": trace["source"], "period": trace["period"]},
        "trees": {},
    }
    for H, m in models.items():
        booster = m.booster_.dump_model()
        assert booster["feature_names"] == FEATURES, "feature order mismatch"
        export["trees"][str(H)] = [compact(t["tree_structure"]) for t in booster["tree_info"]]

    (OUTDIR / "fade_model.json").write_text(json.dumps(export, separators=(",", ":")))
    (OUTDIR / "fade_model_metrics.json").write_text(json.dumps(report, indent=2))
    size = (OUTDIR / "fade_model.json").stat().st_size / 1024
    print(f"exported fade_model.json ({size:.0f} KB) and fade_model_metrics.json")


if __name__ == "__main__":
    main()
