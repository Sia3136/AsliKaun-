"""
Live Data Seeder & Simulator for AsliKaun
Populates drivers, sessions, and review_queue using the actual schema.
"""

import sqlite3
import time
import random
import json
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "aslikaun.db"

def seed_live_data():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    drivers_data = [
        ("drv_live_101", 0.94, 0.91, "Quadrant 1", "continue", "DL-01-AB-1234", "Aarav Sharma"),
        ("drv_live_102", 0.88, 0.89, "Quadrant 1", "continue", "MH-02-CD-5678", "Priya Verma"),
        ("drv_live_103", 0.32, 0.92, "Quadrant 2", "rebaseline", "KA-03-EF-9012", "Rohan Mehta"),
        ("drv_live_104", 0.91, 0.28, "Quadrant 3", "escalate", "HR-26-GH-3456", "Vikram Singh"),
        ("drv_live_105", 0.87, 0.31, "Quadrant 3", "escalate", "UP-16-JK-7890", "Neha Gupta"),
        ("drv_live_106", 0.19, 0.22, "Quadrant 4", "step_up", "DL-04-LM-2345", "Suresh Kumar"),
    ]

    now = int(time.time())

    for drv_id, c_ctx, c_b, quad, dec, plate, name in drivers_data:
        latest_res = {
            "driver_id": drv_id,
            "name": name,
            "vehicle_plate": plate,
            "context_score": c_ctx,
            "behavior_score": c_b,
            "quadrant": quad,
            "decision": dec,
            "safe_pause_recommended": True if dec == "escalate" else False,
            "confidence": 0.95,
            "timestamp": now - random.randint(5, 30),
            "reasons": [
                f"Continuous biometrics score: {c_b:.2f}",
                f"Context score: {c_ctx:.2f}",
                f"Assigned state: {quad}"
            ]
        }

        cur.execute("""
            INSERT OR REPLACE INTO drivers (
                driver_id, anchor_json, fast_json, latest_json, 
                latest_result_json, updated_at, timeseries_json, threshold_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            drv_id,
            json.dumps({"touch_pressure_mean": 0.52, "speed_mean": 24.5}),
            json.dumps({"touch_pressure_mean": 0.50 if c_b > 0.5 else 0.82}),
            json.dumps({"device_id": f"dev_{drv_id}", "plate": plate}),
            json.dumps(latest_res),
            now - random.randint(5, 30),
            json.dumps({"driver_id": drv_id, "rolling_mean_behavior": c_b, "drift_state": "stable"}),
            json.dumps({"behavior_threshold": 0.65, "context_threshold": 0.60})
        ))

        # Insert live session record
        cur.execute("""
            INSERT INTO sessions (
                driver_id, timestamp, payload_json,
                context_score, behavior_score, context_axis, behavior_axis,
                quadrant, decision, reasons_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            drv_id, now - random.randint(5, 60),
            json.dumps({"speed_mph": 0.0 if dec == "escalate" else 22.0, "device_model": "Phone"}),
            c_ctx, c_b, "high" if c_ctx >= 0.5 else "low", "high" if c_b >= 0.5 else "low",
            quad, dec, json.dumps(latest_res["reasons"])
        ))
        session_id = cur.lastrowid

        # For Q3 and Q4, insert into review queue
        if quad in ("Quadrant 3", "Quadrant 4"):
            cur.execute("""
                INSERT INTO review_queue (
                    session_id, driver_id, decision, status, created_at, reviewer_note
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                session_id, drv_id, dec, "open", now - random.randint(60, 600),
                f"Automated risk detection: {quad} detected. Motor dynamics deviated from baseline."
            ))

    conn.commit()
    conn.close()
    print("Successfully seeded live drivers, sessions, and review tickets into aslikaun.db!")

if __name__ == "__main__":
    seed_live_data()
