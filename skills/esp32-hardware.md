---
name: esp32-hardware
description: ESP32/Arduino sketches that survive real hardware
triggers: esp32, arduino, sensor, servo, ble, gpio, microcontroller, iot, esp8266
---
Write embedded sketches that handle the messy reality of hardware.

STRUCTURE: constants and pin defines at top (with a comment naming the physical wiring), setup() initializes Serial FIRST (115200) and prints a boot banner, loop() stays non-blocking — millis() timing patterns, NEVER delay() except tiny debounce waits.

NON-BLOCKING PATTERN: unsigned long lastX = 0; if (millis() - lastX >= INTERVAL_MS) { lastX = millis(); ... } — one per periodic task.

HARDWARE REALITY RULES:
- Debounce every button: 30-50ms guard, track lastState.
- WiFi: connect with a timeout loop (~15s), print progress dots, and RECONNECT automatically in loop() when WiFi.status() != WL_CONNECTED — networks drop.
- Servos on ESP32: use the ESP32Servo library, power servos from external 5V (not the 3V3 pin), common ground mandatory.
- ADC on ESP32 is noisy: average 8-16 readings.
- Strings: prefer char buffers / snprintf on long-running sketches — heap fragmentation from String concat causes mystery crashes after hours.
- BLE and WiFi together eat RAM — if both needed, warn and keep payloads small.
- Watch GPIO quirks: pins 34-39 input-only, 6-11 reserved for flash, strapping pins (0, 2, 12, 15) can block boot if pulled wrong.
- Print state changes to Serial — debugging headless hardware without logs is misery.

HTTP calls from ESP32: HTTPClient with 5-10s timeout, check httpCode before reading body, always http.end().
ALWAYS end with: board/library list to install, wiring summary table (pin → component), and expected Serial output.
