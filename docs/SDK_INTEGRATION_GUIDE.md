# AsliKaun Telemetry SDK — Developer Integration Guide

> **Continuous Behavioral Authentication for On-Demand Delivery & Gig Platforms**  
> Embed continuous biometric verification into your driver-facing apps in minutes. Drop it in like Shopify Analytics or Stripe.js.

---

## 1. Overview & Value Proposition
AsliKaun delivers background identity intelligence without disruptive, mid-ride facial recognition. When an authorized account is rented, sold, or shared with an unverified third party, AsliKaun detects the shift in behavioral biometrics (touch dynamics, order acceptance cadence, motion signatures) and alerts your operations team in real time.

```
┌─────────────────────────────────┐        ┌───────────────────────────────┐
│     Driver App (iOS/Android)    │        │      Trust Juggler API        │
│                                 │        │                               │
│  [AsliKaun Driver SDK]         │───────>│  POST /v1/sessions/ingest     │
│  - Motion & Vibration           │ Stream │  - Split-Conformal Scoring    │
│  - Touch Pressure & Cadence     │        │  - Two-Axis Matrix Evaluation │
│  - Order Latency Timers         │        │  - Dual-Timescale Baselines   │
└─────────────────────────────────┘        └──────────────┬────────────────┘
                                                          │ Real-Time
                                                          ▼
                                           ┌───────────────────────────────┐
                                           │   Admin Operations Console    │
                                           │  - Live 2D Quadrant Matrix    │
                                           │  - Rider Trust Timeline       │
                                           │  - Explainable Reason Vectors │
                                           │  - One-Click Review Actions   │
                                           └───────────────────────────────┘
```

---

## 2. Quickstart: 2-Line Embed (Shopify-Style)

Add the AsliKaun collector script to your delivery partner web or hybrid mobile view:

```html
<!-- 1. Include AsliKaun SDK -->
<script src="https://cdn.trustjuggler.com/trustmesh-sdk.js"></script>

<!-- 2. Initialize with your authenticated driver ID -->
<script>
  AsliKaun.init({
    driverId: "rider-9482",
    endpoint: "https://api.yourcompany.com",
    zone: "Mumbai-Andheri",
    autoFlushIntervalMs: 20000
  });
</script>
```

---

## 3. Order Lifecycle Hooks

For high-confidence detection, hook into your app's order dispatch and acceptance lifecycle:

```javascript
// 1. When an incoming order is displayed on the rider's screen:
AsliKaun.recordOrderOffer();

// 2. When the rider taps to accept the order:
const latencyMs = AsliKaun.recordOrderAccept();
console.log(`Accepted in ${latencyMs} ms`);

// 3. Immediately transmit telemetry on order confirmation:
await AsliKaun.flush();
```

---

## 4. Mobile Integration (React Native / Flutter)

### React Native Integration
```typescript
import { useEffect } from 'react';
import { accelerometer, gyroscope } from 'react-native-sensors';
import AsliKaun from '@trustmesh/react-native-sdk';

export function useDriverTelemetry(driverId: string) {
  useEffect(() => {
    AsliKaun.init({
      driverId,
      endpoint: 'https://api.yourcompany.com',
      autoFlushIntervalMs: 20000,
    });

    const subAccel = accelerometer.subscribe(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z);
      AsliKaun.recordTelemetry({ accel: [mag] });
    });

    return () => {
      subAccel.unsubscribe();
    };
  }, [driverId]);
}
```

---

## 5. Telemetry Signals Collected

| Signal Category | Data Points Captured | Capture Method | Privacy Preservation |
| :--- | :--- | :--- | :--- |
| **Operational Cadence** | Acceptance delay, response jitter, shift hour | Built-in reaction timers | Numerical milliseconds only |
| **Touch Dynamics** | Tap rhythm, gesture duration, contact area, pressure | Passive pointer listeners | Coordinate offsets, zero text/keystroke content |
| **Motor & Motion** | Vehicle hold angle, road vibration profile ($m/s^2$) | Accelerometer & Gyroscope | High-frequency noise filtered on-device |
| **Context Fingerprint** | Persistent device ID, IP subnet, delivery zone | Browser/OS environment | IP truncated to /24 subnet |

---

## 6. Admin API: Real-Time Fleet & Driver Analytics

Your operations dashboard and fraud-prevention systems consume these endpoints:

### A. Live Fleet Status
```http
GET /v1/fleet/scores
Authorization: Bearer <ADMIN_JWT_TOKEN>
```
**Response**:
```json
{
  "count": 1250,
  "drivers": [
    {
      "driver_id": "rider-001",
      "context_score": 0.94,
      "behavior_score": 0.92,
      "context_axis": "stable",
      "behavior_axis": "stable",
      "quadrant": "stable",
      "decision": "continue",
      "updated_at": "2026-10-18T05:00:00Z"
    },
    {
      "driver_id": "rider-042",
      "context_score": 0.92,
      "behavior_score": 0.31,
      "context_axis": "stable",
      "behavior_axis": "changed",
      "quadrant": "handoff_signature",
      "decision": "challenge_at_safe_pause",
      "updated_at": "2026-10-18T05:05:00Z"
    }
  ]
}
```

### B. Driver Review Queue & Explainable Reason Vectors
```http
GET /v1/review-queue?status=pending
Authorization: Bearer <ADMIN_JWT_TOKEN>
```
**Response**:
```json
{
  "count": 1,
  "reviews": [
    {
      "session_id": 142,
      "driver_id": "rider-042",
      "decision": "challenge_at_safe_pause",
      "quadrant": "handoff_signature",
      "reason_vector": "Same phone, but sudden high tap pressure (p=0.012) and rough throttle jerk. Potential account rental.",
      "status": "pending",
      "created_at": "2026-10-18T05:05:00Z"
    }
  ]
}
```

### C. Resolving a Flagged Driver
```http
POST /v1/review-queue/142/resolve
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{
  "resolution": "confirmed_handoff",
  "reviewer_note": "Suspicious handoff confirmed. Account temporarily paused until identity step-up check."
}
```

---

## 7. The "Fast Lane": Driver-Declared Changes
Allow riders to declare hardware upgrades or city relocations in advance to bypass false alerts:

```javascript
await AsliKaun.declareChange({
  device_id: "phone-new-iphone-15",
  zone: "Mumbai-BKC",
  reason: "Upgraded phone and moved delivery zones"
});
```
*Result*: When the new phone connects, AsliKaun verifies behavioral biometrics against the owner's profile and silently re-baselines without locking the rider out.
