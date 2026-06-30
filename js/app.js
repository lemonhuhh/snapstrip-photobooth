/* ===========================================================
   APP
   The orchestrator: screen routing, layout selection, the
   automatic multi-photo capture session, the review/reorder
   step, settings, and the final render/export actions. Talks
   to CameraController, Editor and Exporter, all defined in
   their own files.
   =========================================================== */

const AppState = {
  selectedLayout: null,
  photos: [],   // { id, src }
  settings: { countdown: 5, delay: 2, mirror: true, sound: true, flash: true },
};

let screenStack = ["landing"];
let retakeIndex = null;

const mainCamera = new CameraController(document.getElementById("camera-video"));
const retakeCamera = new CameraController(document.getElementById("retake-video"));

const mainCountdownRefs = {
  overlayEl: () => $("#countdown-overlay"),
  numberEl: () => $("#countdown-number"),
  ringEl: () => $("#countdown-ring-progress"),
};
const retakeCountdownRefs = {
  overlayEl: () => $("#retake-countdown-overlay"),
  numberEl: () => $("#retake-countdown-number"),
  ringEl: () => $("#retake-ring-progress"),
};

const SCREEN_TITLES = {
  layout: "Choose layout",
  camera: "Camera",
  review: "Review",
  editor: "Editor",
  final: "Your strip",
};

/* ---------------------------------------------------------
   SCREEN ROUTING
   --------------------------------------------------------- */
function renderScreen(id) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $(`#screen-${id}`)?.classList.add("active");
  updateAppBar(id);
  window.scrollTo(0, 0);

  if (id === "layout") syncLayoutSelectionUI();
  if (id === "camera") startCameraScreen();
  if (id === "review") renderReviewGrid();
  if (id === "editor") requestAnimationFrame(() => Editor.handleResize());
  if (id === "final") runFinalRender();
}

function updateAppBar(id) {
  const bar = $("#app-bar");
  if (id === "landing") {
    bar.dataset.visible = "false";
    return;
  }
  bar.dataset.visible = "true";
  $("#app-bar-title").textContent = SCREEN_TITLES[id] || "Snapstrip";
}

function navigateTo(id) {
  screenStack.push(id);
  renderScreen(id);
}

function goBack() {
  if (screenStack.length <= 1) return;
  const leaving = screenStack.pop();
  if (leaving === "camera") mainCamera.stop();
  renderScreen(screenStack[screenStack.length - 1]);
}

function resetApp() {
  mainCamera.stop();
  retakeCamera.stop();
  AppState.selectedLayout = null;
  AppState.photos = [];
  screenStack = ["landing"];
  syncLayoutSelectionUI();
  renderScreen("landing");
}

/* ---------------------------------------------------------
   LAYOUT SELECTION
   --------------------------------------------------------- */
function buildLayoutGrid() {
  const grid = $("#layout-grid");
  grid.innerHTML = "";
  LAYOUTS.forEach((layout) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "layout-card";
    card.dataset.id = layout.id;

    const preview = document.createElement("div");
    preview.className = "layout-preview";
    preview.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
    preview.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;
    for (let i = 0; i < layout.count; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      preview.appendChild(slot);
    }
    card.appendChild(preview);

    const label = document.createElement("div");
    label.className = "layout-card-label";
    label.textContent = layout.name;
    card.appendChild(label);

    const sub = document.createElement("div");
    sub.className = "layout-card-sub";
    sub.textContent = `${layout.count} photo${layout.count > 1 ? "s" : ""}`;
    card.appendChild(sub);

    card.addEventListener("click", () => {
      AppState.selectedLayout = layout;
      syncLayoutSelectionUI();
    });
    grid.appendChild(card);
  });
}

function syncLayoutSelectionUI() {
  $$(".layout-card", $("#layout-grid")).forEach((card) => {
    card.classList.toggle("selected", AppState.selectedLayout?.id === card.dataset.id);
  });
  $("#btn-layout-continue").disabled = !AppState.selectedLayout;
}

/* ---------------------------------------------------------
   CAMERA SCREEN
   --------------------------------------------------------- */
function describeCameraError(err) {
  const name = err?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission was denied. Please allow camera access in your browser settings and try again.";
  }
  if (name === "NotFoundError") {
    return "No camera was found on this device.";
  }
  return "We couldn't access your camera. Please check your browser permissions and try again.";
}

async function startCameraScreen() {
  $("#camera-permission-block").hidden = true;
  $("#camera-progress").hidden = true;
  setMirror(AppState.settings.mirror);

  const result = await mainCamera.start("user");
  if (!result.ok) {
    $("#camera-permission-block").hidden = false;
    $("#camera-error-text").textContent = describeCameraError(result.error);
    return;
  }
  const multi = await CameraController.hasMultipleCameras();
  $("#btn-switch-camera").hidden = !multi;
}

function setMirror(value) {
  AppState.settings.mirror = value;
  $("#camera-video").classList.toggle("mirrored", value);
  $("#btn-toggle-mirror").setAttribute("aria-pressed", String(value));
  $("#setting-mirror").checked = value;
}

function triggerFlash(flashEl) {
  if (!AppState.settings.flash) return;
  flashEl.classList.remove("flashing");
  void flashEl.offsetWidth; // restart the CSS animation
  flashEl.classList.add("flashing");
}

function showCameraMessage(text) {
  const el = $("#camera-message");
  el.textContent = text;
  el.hidden = false;
}
function hideCameraMessage() {
  $("#camera-message").hidden = true;
}

/** Runs a single visual + audible countdown using the given element
 *  refs, so the same logic can drive both the main camera screen and
 *  the single-photo retake modal. */
async function runCountdown(seconds, refs) {
  const overlay = refs.overlayEl();
  const number = refs.numberEl();
  const ring = refs.ringEl();
  overlay.hidden = false;
  for (let s = seconds; s >= 1; s--) {
    number.textContent = s;
    number.classList.remove("pop");
    void number.offsetWidth;
    number.classList.add("pop");

    ring.style.transition = "none";
    ring.style.strokeDashoffset = "326.7";
    void ring.offsetWidth;
    ring.style.transition = "stroke-dashoffset 1s linear";
    ring.style.strokeDashoffset = "0";

    if (s === 1) Sounds.tickFinal();
    else Sounds.tick();

    await wait(1000);
  }
  overlay.hidden = true;
}

async function runCaptureSession() {
  if (!AppState.selectedLayout) return;
  const count = AppState.selectedLayout.count;
  AppState.photos = [];

  $("#btn-capture").dataset.active = "true";
  $("#camera-progress").hidden = false;

  for (let i = 0; i < count; i++) {
    $("#camera-progress-text").textContent = `Photo ${i + 1} of ${count}`;
    await runCountdown(AppState.settings.countdown, mainCountdownRefs);

    triggerFlash($("#camera-flash"));
    if (AppState.settings.sound) Sounds.shutter();
    const dataUrl = mainCamera.captureFrame($("#capture-canvas"), AppState.settings.mirror);
    AppState.photos.push({ id: uid("cap"), src: dataUrl });

    if (i < count - 1) {
      showCameraMessage(`Get ready for photo ${i + 2}…`);
      await wait(AppState.settings.delay * 1000);
      hideCameraMessage();
    }
  }

  $("#btn-capture").dataset.active = "false";
  $("#camera-progress").hidden = true;
  mainCamera.stop();
  navigateTo("review");
}

/* ---------------------------------------------------------
   REVIEW SCREEN — retake single / retake all / reorder
   --------------------------------------------------------- */
let reviewDrag = null;

function renderReviewGrid() {
  const grid = $("#review-grid");
  grid.innerHTML = "";
  AppState.photos.forEach((photo, index) => {
    const card = document.createElement("div");
    card.className = "review-card";
    card.dataset.id = photo.id;
    card.innerHTML = `
      <img src="${photo.src}" alt="Photo ${index + 1}" draggable="false" />
      <span class="review-index">${index + 1}</span>
      <button class="review-retake" aria-label="Retake this photo" type="button">
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 9a8 8 0 0114-4.9M20 15a8 8 0 01-14 4.9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M4 3v5h5M20 21v-5h-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    card.querySelector(".review-retake").addEventListener("click", (e) => {
      e.stopPropagation();
      openRetake(index);
    });
    attachReviewDrag(card);
    grid.appendChild(card);
  });
}

function getCardAt(x, y, excludeId) {
  return $$(".review-card", $("#review-grid")).find((el) => {
    if (el.dataset.id === excludeId) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });
}

function attachReviewDrag(card) {
  card.addEventListener("pointerdown", (evt) => {
    if (evt.target.closest(".review-retake")) return;
    reviewDrag = { id: card.dataset.id, startX: evt.clientX, startY: evt.clientY };
    card.classList.add("dragging");
    card.style.zIndex = "10";
    card.setPointerCapture?.(evt.pointerId);
  });
  card.addEventListener("pointermove", (evt) => {
    if (!reviewDrag || reviewDrag.id !== card.dataset.id) return;
    const dx = evt.clientX - reviewDrag.startX;
    const dy = evt.clientY - reviewDrag.startY;
    card.style.transform = `translate(${dx}px, ${dy}px) scale(0.97)`;
  });
  card.addEventListener("pointerup", (evt) => {
    if (!reviewDrag || reviewDrag.id !== card.dataset.id) return;
    card.classList.remove("dragging");
    card.style.transform = "";
    card.style.zIndex = "";
    const target = getCardAt(evt.clientX, evt.clientY, card.dataset.id);
    if (target) {
      const fromIdx = AppState.photos.findIndex((p) => p.id === card.dataset.id);
      const toIdx = AppState.photos.findIndex((p) => p.id === target.dataset.id);
      const [moved] = AppState.photos.splice(fromIdx, 1);
      AppState.photos.splice(toIdx, 0, moved);
      renderReviewGrid();
    }
    reviewDrag = null;
  });
}

async function openRetake(index) {
  retakeIndex = index;
  $("#modal-retake").hidden = false;
  $("#retake-video").classList.toggle("mirrored", AppState.settings.mirror);
  const result = await retakeCamera.start(mainCamera.facingMode || "user");
  if (!result.ok) {
    showToast("Could not access the camera for a retake.");
    closeRetake();
  }
}

function closeRetake() {
  retakeCamera.stop();
  $("#modal-retake").hidden = true;
  retakeIndex = null;
}

async function captureRetake() {
  await runCountdown(AppState.settings.countdown, retakeCountdownRefs);
  triggerFlash($("#retake-flash"));
  if (AppState.settings.sound) Sounds.shutter();

  const canvas = $("#capture-canvas");
  const dataUrl = retakeCamera.captureFrame(canvas, AppState.settings.mirror);
  if (retakeIndex !== null && AppState.photos[retakeIndex]) {
    AppState.photos[retakeIndex].src = dataUrl;
  }
  closeRetake();
  renderReviewGrid();
  showToast("Photo updated", "success");
}

/* ---------------------------------------------------------
   FINAL SCREEN — developing animation + export
   --------------------------------------------------------- */
async function runFinalRender() {
  $("#developing-wrap").classList.remove("developed");
  $("#final-status").textContent = "Developing your strip…";
  try {
    const canvas = await Exporter.renderToCanvas(Editor.getState());
    const dataUrl = Exporter.canvasToDataUrl(canvas);
    await new Promise((resolve) => {
      const img = $("#final-image");
      img.onload = resolve;
      img.src = dataUrl;
      setTimeout(resolve, 400); // safety net in case onload doesn't fire
    });
    requestAnimationFrame(() => $("#developing-wrap").classList.add("developed"));
    await wait(1300);
    $("#final-status").textContent = "Your strip is ready!";
    if (AppState.settings.sound) Sounds.success();
  } catch (err) {
    console.error(err);
    $("#final-status").textContent = "Something went wrong while rendering your strip.";
    showToast("Could not generate the final image.");
  }
}

/* ---------------------------------------------------------
   GLOBAL EVENT BINDING (runs once at startup)
   --------------------------------------------------------- */
function bindGlobalEvents() {
  // Landing
  $("#btn-start").addEventListener("click", () => {
    Sounds.init();
    navigateTo("layout");
  });
  $("#btn-how-it-works").addEventListener("click", () => {
    $("#how-it-works").scrollIntoView({ behavior: "smooth" });
  });

  // App bar
  $("#btn-back").addEventListener("click", goBack);
  $("#btn-settings").addEventListener("click", () => openModal("#modal-settings"));

  // Layout screen
  $("#btn-layout-continue").addEventListener("click", () => navigateTo("camera"));

  // Camera screen
  $("#btn-toggle-mirror").addEventListener("click", () => setMirror(!AppState.settings.mirror));
  $("#btn-switch-camera").addEventListener("click", async () => {
    await mainCamera.switchFacing();
  });
  $("#btn-camera-settings").addEventListener("click", () => openModal("#modal-settings"));
  $("#btn-capture").addEventListener("click", () => {
    Sounds.init();
    if ($("#btn-capture").dataset.active === "true") return;
    runCaptureSession();
  });
  $("#btn-retry-camera").addEventListener("click", startCameraScreen);

  // Review screen
  $("#btn-retake-all").addEventListener("click", () => {
    AppState.photos = [];
    navigateTo("camera");
  });
  $("#btn-review-continue").addEventListener("click", () => {
    Editor.init(AppState.selectedLayout, AppState.photos.map((p) => p.src));
    navigateTo("editor");
  });

  // Retake modal
  $("#btn-retake-cancel").addEventListener("click", closeRetake);
  $("#btn-retake-capture").addEventListener("click", captureRetake);

  // Editor screen
  $("#btn-editor-continue").addEventListener("click", () => navigateTo("final"));

  // Final screen
  $("#btn-download-png").addEventListener("click", () => {
    Exporter.download($("#render-canvas"), "image/png", "snapstrip.png");
    showToast("Downloading PNG…");
  });
  $("#btn-download-jpg").addEventListener("click", () => {
    Exporter.download($("#render-canvas"), "image/jpeg", "snapstrip.jpg");
    showToast("Downloading JPG…");
  });
  $("#btn-print").addEventListener("click", () => Exporter.print($("#render-canvas")));
  $("#btn-back-to-edit").addEventListener("click", () => navigateTo("editor"));
  $("#btn-new-session").addEventListener("click", resetApp);

  // Settings modal
  $("#btn-close-settings").addEventListener("click", () => closeModal("#modal-settings"));
  $("#btn-save-settings").addEventListener("click", () => closeModal("#modal-settings"));
  $("#modal-settings").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal("#modal-settings");
  });
  $$("#setting-countdown .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      AppState.settings.countdown = Number(btn.dataset.value);
      $$("#setting-countdown .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });
  $("#setting-delay").addEventListener("input", (e) => {
    AppState.settings.delay = Number(e.target.value);
    $("#setting-delay-value").textContent = e.target.value;
  });
  $("#setting-mirror").addEventListener("change", (e) => setMirror(e.target.checked));
  $("#setting-sound").addEventListener("change", (e) => {
    AppState.settings.sound = e.target.checked;
    Sounds.setEnabled(e.target.checked);
  });
  $("#setting-flash").addEventListener("change", (e) => {
    AppState.settings.flash = e.target.checked;
  });
}

function openModal(sel) {
  $(sel).hidden = false;
}
function closeModal(sel) {
  $(sel).hidden = true;
}

/* ---------------------------------------------------------
   STARTUP
   --------------------------------------------------------- */
function initApp() {
  Editor.bindStaticUI();
  buildLayoutGrid();
  Sounds.setEnabled(AppState.settings.sound);
  bindGlobalEvents();
  renderScreen("landing");
}

document.addEventListener("DOMContentLoaded", initApp);
