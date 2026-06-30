/* ===========================================================
   UTILS
   Small, dependency-free helpers shared across the app.
   =========================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Distance between two pointer/touch points (used for pinch-to-resize/rotate). */
function pointDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointAngle(a, b) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Shows a small, auto-dismissing toast at the bottom of the screen. */
function showToast(message, variant = "default", duration = 2200) {
  const container = $("#toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast${variant === "success" ? " toast-success" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

/** Triggers a browser download for a data URL. */
function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** True on devices where touch is the primary input — used to decide
 *  whether to even attempt a front/back camera switcher, etc. */
function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/** Reads the x/y of a PointerEvent relative to the viewport. */
function pointerXY(evt) {
  return { x: evt.clientX, y: evt.clientY };
}

/** Simple linear interpolation, used by the countdown ring. */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Wait helper used by the auto-capture session loop. */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** object-fit:cover is computed against a box's own width/height, with
 *  no knowledge that a 90°/270° rotation will be applied afterwards.
 *  For a non-square box that swap reveals gaps at the corners unless
 *  we scale the already-cover-fitted image up by this extra factor. */
function extraRotationScale(rotateDeg, w, h) {
  const norm = ((rotateDeg % 360) + 360) % 360;
  if (norm === 90 || norm === 270) return Math.max(w / h, h / w);
  return 1;
}
