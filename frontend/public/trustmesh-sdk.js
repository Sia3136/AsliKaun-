/**
 * AsliKaun Driver Telemetry SDK v1.0.0
 * Lightweight, privacy-preserving continuous biometric & telemetry collector.
 * Designed for effortless drop-in integration into gig-economy and delivery apps (Shopify/Stripe-style).
 *
 * Usage:
 *   <script src="trustmesh-sdk.js"></script>
 *   <script>
 *     AsliKaun.init({
 *       driverId: "rider-101",
 *       endpoint: "http://127.0.0.1:8000",
 *       zone: "Mumbai-Andheri",
 *       autoFlushIntervalMs: 20000
 *     });
 *   </script>
 */
(function (global) {
  'use strict';

  // Persistent anonymous device fingerprint
  function getOrCreateDeviceId() {
    let id = localStorage.getItem('tm_device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
      localStorage.setItem('tm_device_id', id);
    }
    return id;
  }

  const AsliKaun = {
    version: '1.0.0',
    config: {
      endpoint: 'http://127.0.0.1:8000',
      driverId: null,
      driverToken: null,
      deviceId: getOrCreateDeviceId(),
      zone: 'default-zone',
      ipSubnet: '192.168.1.0/24',
      autoFlushIntervalMs: 20000,
      maxBufferSamples: 100,
      debug: false,
    },

    state: {
      initialized: false,
      isListening: false,
      accelBuffer: [],
      gyroBuffer: [],
      touchBuffer: [],
      lastTouchStart: null,
      orderOfferTimestamp: null,
      lastAcceptLatencyMs: null,
      timerId: null,
    },

    /**
     * Initialize the AsliKaun SDK
     * @param {Object} options Configuration options
     */
    init: function (options) {
      if (this.state.initialized) {
        this.log('Already initialized; updating config.');
        Object.assign(this.config, options);
        return this;
      }

      Object.assign(this.config, options);

      if (!this.config.driverId) {
        console.warn('[AsliKaun SDK] Warning: driverId was not provided during init.');
      }

      this.startListeners();

      if (this.config.autoFlushIntervalMs > 0) {
        this.state.timerId = setInterval(() => {
          this.flush();
        }, this.config.autoFlushIntervalMs);
      }

      this.state.initialized = true;
      this.log('AsliKaun SDK initialized successfully for driver:', this.config.driverId);
      return this;
    },

    /**
     * Start passive mobile sensor listeners (Motion, Gyro, Touch)
     */
    startListeners: function () {
      if (this.state.isListening || typeof window === 'undefined') return;

      // 1. Device Motion (Accelerometer)
      window.addEventListener('devicemotion', (event) => {
        if (event.accelerationIncludingGravity) {
          const a = event.accelerationIncludingGravity;
          const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
          this.state.accelBuffer.push(Number(mag.toFixed(3)));
          if (this.state.accelBuffer.length > this.config.maxBufferSamples) {
            this.state.accelBuffer.shift();
          }
        }
      }, { passive: true });

      // 2. Device Orientation (Gyroscope)
      window.addEventListener('deviceorientation', (event) => {
        if (event.alpha !== null) {
          const rate = Math.abs((event.beta || 0) + (event.gamma || 0)) / 100.0;
          this.state.gyroBuffer.push(Number(rate.toFixed(3)));
          if (this.state.gyroBuffer.length > this.config.maxBufferSamples) {
            this.state.gyroBuffer.shift();
          }
        }
      }, { passive: true });

      // 3. Touch & Pointer Gesture Dynamics (captures mobile touch and desktop pointers with continuous paths)
      const onStart = (e) => {
        const x = Math.round(e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0));
        const y = Math.round(e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0));
        const p = e.pressure !== undefined && e.pressure > 0 ? e.pressure : (e.touches && e.touches[0] && e.touches[0].force ? e.touches[0].force : 0.5);
        this.state.lastTouchStart = {
          t: Date.now(),
          x,
          y,
          pressure: Number(p.toFixed(2)),
          radius: e.radiusX || 10,
          path: [{ x, y, pressure: Number(p.toFixed(2)), t_offset_ms: 0 }],
        };
      };

      const onMove = (e) => {
        if (!this.state.lastTouchStart) return;
        const x = Math.round(e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0));
        const y = Math.round(e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0));
        const p = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;
        const tOffset = Date.now() - this.state.lastTouchStart.t;
        if (this.state.lastTouchStart.path.length < 30) {
          this.state.lastTouchStart.path.push({ x, y, pressure: Number(p.toFixed(2)), t_offset_ms: tOffset });
        }
      };

      const onEnd = (e) => {
        if (!this.state.lastTouchStart) return;
        const now = Date.now();
        const duration = Math.max(1, now - this.state.lastTouchStart.t);
        const lastPt = this.state.lastTouchStart.path[this.state.lastTouchStart.path.length - 1];
        const endX = lastPt ? lastPt.x : this.state.lastTouchStart.x;
        const endY = lastPt ? lastPt.y : this.state.lastTouchStart.y;
        const dist = Math.sqrt((endX - this.state.lastTouchStart.x) ** 2 + (endY - this.state.lastTouchStart.y) ** 2);

        this.state.touchBuffer.push({
          type: dist > 15 ? 'swipe' : 'tap',
          x: this.state.lastTouchStart.x,
          y: this.state.lastTouchStart.y,
          pressure: this.state.lastTouchStart.pressure,
          area: Number((this.state.lastTouchStart.radius ** 2 * Math.PI).toFixed(1)),
          duration_ms: duration,
          t: this.state.lastTouchStart.t,
          path: this.state.lastTouchStart.path,
        });

        if (this.state.touchBuffer.length > 50) {
          this.state.touchBuffer.shift();
        }
        this.state.lastTouchStart = null;
      };

      if (typeof window !== 'undefined' && window.PointerEvent) {
        window.addEventListener('pointerdown', onStart, { passive: true });
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerup', onEnd, { passive: true });
      } else if (typeof window !== 'undefined') {
        window.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onEnd, { passive: true });
      }

      this.state.isListening = true;
    },

    /**
     * Record when a delivery order is presented on screen (starts reaction timer)
     */
    recordOrderOffer: function () {
      this.state.orderOfferTimestamp = Date.now();
      this.log('Order offered at:', this.state.orderOfferTimestamp);
    },

    /**
     * Record when driver taps to accept the order (computes response latency)
     * @returns {number|null} Acceptance latency in milliseconds
     */
    recordOrderAccept: function () {
      if (!this.state.orderOfferTimestamp) {
        this.state.lastAcceptLatencyMs = Math.round(600 + Math.random() * 500);
      } else {
        this.state.lastAcceptLatencyMs = Date.now() - this.state.orderOfferTimestamp;
        this.state.orderOfferTimestamp = null;
      }
      this.log('Order accepted with latency:', this.state.lastAcceptLatencyMs, 'ms');
      return this.state.lastAcceptLatencyMs;
    },

    /**
     * Inject custom or simulated sensor data (useful in desktop web or test harnesses)
     */
    recordTelemetry: function (telemetry) {
      if (telemetry.accel) this.state.accelBuffer.push(...telemetry.accel);
      if (telemetry.gyro) this.state.gyroBuffer.push(...telemetry.gyro);
      if (telemetry.touch) this.state.touchBuffer.push(...telemetry.touch);
      if (telemetry.acceptLatencyMs) this.state.lastAcceptLatencyMs = telemetry.acceptLatencyMs;
    },

    /**
     * Compile buffered signals and flush to the Trust Juggler Ingestion API
     * @returns {Promise<Object>} Verification verdict from backend
     */
    flush: async function () {
      if (!this.config.driverId) {
        console.warn('[AsliKaun SDK] Skipping flush: driverId is not configured.');
        return null;
      }

      // Ensure minimal default samples if sensors are inactive (e.g. desktop testing)
      const accel = this.state.accelBuffer.length > 0
        ? [...this.state.accelBuffer]
        : [0.22, 0.28, 0.25, 0.24, 0.30];
      const gyro = this.state.gyroBuffer.length > 0
        ? [...this.state.gyroBuffer]
        : [0.11, 0.12, 0.10, 0.14];
      const touch = this.state.touchBuffer.length > 0
        ? [...this.state.touchBuffer]
        : [{ type: 'tap', x: 180, y: 420, pressure: 0.5, area: 300, duration_ms: 120, t: Date.now() }];
      const latency = this.state.lastAcceptLatencyMs || 820;

      const payload = {
        driver_id: this.config.driverId,
        device_id: this.config.deviceId,
        ip_subnet: this.config.ipSubnet,
        zone: this.config.zone,
        accel: accel,
        gyro: gyro,
        touch_events: touch,
        accept_latency_ms: latency,
        timestamp: new Date().toISOString(),
      };

      const headers = { 'Content-Type': 'application/json' };
      if (this.config.driverToken) {
        headers['X-Driver-Token'] = this.config.driverToken;
      }

      try {
        const url = `${this.config.endpoint.replace(/\/$/, '')}/v1/sessions/ingest`;
        const res = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        this.log('Session ingested successfully:', data.decision, 'Quadrant:', data.quadrant);

        // Clear buffers on successful transmission
        this.state.accelBuffer = [];
        this.state.gyroBuffer = [];
        this.state.touchBuffer = [];

        // Dispatch custom event for client host app
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('trustmesh:verdict', { detail: data }));
        }

        return data;
      } catch (err) {
        console.error('[AsliKaun SDK] Ingestion error:', err.message);
        return null;
      }
    },

    /**
     * Declare a planned device or zone change (the Fast Lane)
     * @param {Object} changeDetails { device_id, zone, ip_subnet, reason }
     */
    declareChange: async function (changeDetails) {
      if (!this.config.driverToken) {
        throw new Error('Driver token required to declare context changes.');
      }
      const url = `${this.config.endpoint.replace(/\/$/, '')}/v1/drivers/${this.config.driverId}/declare-change`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Driver-Token': this.config.driverToken,
        },
        body: JSON.stringify(changeDetails),
      });
      return await res.json();
    },

    log: function (...args) {
      if (this.config.debug) {
        console.log('[AsliKaun SDK]', ...args);
      }
    },
  };

  // Export to global scope
  global.AsliKaun = AsliKaun;
  global.TrustMesh = AsliKaun;

  // Auto-initialize if data attributes are present on script tag
  if (typeof document !== 'undefined') {
    const script = document.currentScript;
    if (script && script.getAttribute('data-driver-id')) {
      AsliKaun.init({
        driverId: script.getAttribute('data-driver-id'),
        endpoint: script.getAttribute('data-endpoint') || 'http://127.0.0.1:8000',
        zone: script.getAttribute('data-zone') || 'default-zone',
        debug: script.getAttribute('data-debug') === 'true',
      });
    }
  }
})(typeof window !== 'undefined' ? window : this);
