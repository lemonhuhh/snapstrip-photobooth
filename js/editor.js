/* ===========================================================
   EDITOR
   Owns the photo-strip composition: layout grid, per-photo
   transforms, stickers/text ("free items"), filters, frames,
   background & border colors, and slot spacing. Exposes a
   small API (init / getState / handleResize) that app.js calls
   from the screen router, and binds all of its own tool-panel
   UI once at startup.
   =========================================================== */

const Editor = (() => {
  const BORDER_W = 10; // px — outline shown when no decorative frame is chosen

  const state = {
    layout: null,
    photos: [],     // { id, src, rotate, flipH, flipV, zoom }
    filter: "original",
    frame: "none",
    background: "#1a1b35",
    borderColor: "#ffffff",
    spacing: 10,
    items: [],      // sticker/text free items
    selectedPhotoIndex: null,
    selectedItemId: null,
  };

  let els = {};
  let dragCtx = null; // active pointer interaction, if any

  function cacheEls() {
    els = {
      stage: $("#editor-stage"),
      stripRoot: $("#strip-root"),
      stripBg: $("#strip-background"),
      slots: $("#photo-slots"),
      frameOverlay: $("#frame-overlay"),
      freeLayer: $("#free-layer"),
      stickerCategories: $("#sticker-categories"),
      stickerGrid: $("#sticker-grid"),
      filterStrip: $("#filter-strip"),
      frameGrid: $("#frame-grid"),
      bgRow: $("#bg-color-row"),
      bgCustom: $("#bg-color-custom"),
      borderRow: $("#border-color-row"),
      borderCustom: $("#border-color-custom"),
      spacingInput: $("#spacing-input"),
      spacingValue: $("#spacing-value"),
      textColorRow: $("#text-color-row"),
      textCustom: $("#text-color-custom"),
      textControls: $("#text-controls"),
      textContent: $("#text-input-content"),
      textFont: $("#text-input-font"),
      textSize: $("#text-input-size"),
      textSizeValue: $("#text-size-value"),
      textRotation: $("#text-input-rotation"),
      textRotationValue: $("#text-rotation-value"),
      textShadow: $("#text-input-shadow"),
      photoPanelControls: $("#photo-panel-controls"),
      photoPanelHint: $("#photo-panel-hint"),
      photoZoom: $("#photo-zoom-input"),
      photoZoomValue: $("#photo-zoom-value"),
    };
  }

  /* ---------------------------------------------------------
     INITIALIZATION (called fresh for every new session)
     --------------------------------------------------------- */
  function init(layout, photoSrcs) {
    if (!els.stage) cacheEls();
    state.layout = layout;
    state.photos = photoSrcs.map((src) => ({ id: uid("ph"), src, rotate: 0, flipH: false, flipV: false, zoom: 100 }));
    state.items = [];
    state.filter = "original";
    state.frame = layout.polaroid ? "polaroid" : "none";
    state.background = "#1a1b35";
    state.borderColor = "#ffffff";
    state.spacing = 10;
    state.selectedPhotoIndex = null;
    state.selectedItemId = null;

    els.freeLayer.innerHTML = "";
    setActiveSwatchRow(els.bgRow, state.background);
    setActiveSwatchRow(els.borderRow, state.borderColor);
    els.spacingInput.value = state.spacing;
    els.spacingValue.textContent = state.spacing;
    setActiveFilterChip(state.filter);
    setActiveFrameCard(state.frame);
    updatePhotoPanel();

    renderStripSize();
    renderPhotoSlots();
    applyBackground();
    applyFrame();
    deselectAll();
  }

  function getState() {
    return state;
  }

  /* ---------------------------------------------------------
     STRIP SIZING — keeps the composition's aspect ratio while
     fitting whatever space the current viewport gives it.
     --------------------------------------------------------- */
  function renderStripSize() {
    if (!state.layout) return;
    const stageRect = els.stage.getBoundingClientRect();
    const maxW = Math.max(stageRect.width - 8, 160);
    const maxH = Math.max(stageRect.height - 8, 160);
    const aspect = state.layout.aspect; // width / height

    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    els.stripRoot.style.width = `${Math.round(w)}px`;
    els.stripRoot.style.height = `${Math.round(h)}px`;

    const cols = state.layout.cols;
    const rows = state.layout.rows;
    els.slots.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    els.slots.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  }

  function handleResize() {
    if (!state.layout) return;
    renderStripSize();
    // Re-apply px-based sizing for any free items, since their stored
    // ratios are relative to the stage width which may have changed.
    state.items.forEach(renderFreeItem);
    // Rotated photos depend on the slot's current pixel aspect too.
    state.photos.forEach((_, i) => applyPhotoTransform(i));
  }

  /* ---------------------------------------------------------
     PHOTO SLOTS
     --------------------------------------------------------- */
  function renderPhotoSlots() {
    els.slots.innerHTML = "";
    state.photos.forEach((photo, index) => {
      const slot = document.createElement("div");
      slot.className = "photo-slot";
      slot.dataset.index = String(index);

      const img = document.createElement("img");
      img.src = photo.src;
      img.draggable = false;
      img.alt = `Photo ${index + 1}`;
      slot.appendChild(img);

      slot.addEventListener("click", () => selectPhoto(index));
      els.slots.appendChild(slot);
    });
    applyFilterToPhotos();
    state.photos.forEach((_, i) => applyPhotoTransform(i));
  }

  function applyPhotoTransform(index) {
    const photo = state.photos[index];
    const slot = els.slots.children[index];
    if (!photo || !slot) return;
    const img = slot.querySelector("img");
    const rect = slot.getBoundingClientRect();
    const extra = extraRotationScale(photo.rotate, rect.width || 1, rect.height || 1);
    const sx = (photo.flipH ? -1 : 1) * (photo.zoom / 100) * extra;
    const sy = (photo.flipV ? -1 : 1) * (photo.zoom / 100) * extra;
    img.style.transform = `rotate(${photo.rotate}deg) scale(${sx}, ${sy})`;
  }

  function selectPhoto(index) {
    state.selectedPhotoIndex = index;
    deselectItem();
    $$(".photo-slot", els.slots).forEach((el) => el.classList.remove("selected"));
    els.slots.children[index]?.classList.add("selected");
    activateTab("photo");
    updatePhotoPanel();
  }

  function updatePhotoPanel() {
    const has = state.selectedPhotoIndex !== null;
    els.photoPanelControls.dataset.disabled = has ? "false" : "true";
    els.photoPanelHint.style.display = has ? "none" : "block";
    if (has) {
      const photo = state.photos[state.selectedPhotoIndex];
      els.photoZoom.value = photo.zoom;
      els.photoZoomValue.textContent = photo.zoom;
    }
  }

  function mutateSelectedPhoto(patch) {
    if (state.selectedPhotoIndex === null) return;
    Object.assign(state.photos[state.selectedPhotoIndex], patch);
    applyPhotoTransform(state.selectedPhotoIndex);
    updatePhotoPanel();
  }

  /* ---------------------------------------------------------
     FILTERS
     --------------------------------------------------------- */
  function applyFilterToPhotos() {
    const filter = FILTERS.find((f) => f.id === state.filter) || FILTERS[0];
    $$(".photo-slot img", els.slots).forEach((img) => {
      img.style.filter = filter.css;
    });
  }

  function setFilter(id) {
    state.filter = id;
    applyFilterToPhotos();
    setActiveFilterChip(id);
  }

  /* ---------------------------------------------------------
     FRAME / BACKGROUND / BORDER / SPACING
     --------------------------------------------------------- */
  function applyFrame() {
    els.frameOverlay.dataset.frame = state.frame;
    els.frameOverlay.style.border = state.frame === "none" ? `${BORDER_W}px solid ${state.borderColor}` : "";
    els.frameOverlay.innerHTML = "";
    const def = FRAMES.find((f) => f.id === state.frame);
    if (def && def.corner) {
      ["tl", "tr", "bl", "br"].forEach((pos) => {
        const span = document.createElement("span");
        span.className = `frame-corner ${pos}`;
        span.textContent = def.corner;
        els.frameOverlay.appendChild(span);
      });
    }
  }

  function setFrame(id) {
    state.frame = id;
    applyFrame();
    setActiveFrameCard(id);
  }

  function applyBackground() {
    els.stripBg.style.background = state.background;
    els.slots.style.background = state.background;
  }

  function setBackground(color) {
    state.background = color;
    applyBackground();
    setActiveSwatchRow(els.bgRow, color);
  }

  function setBorderColor(color) {
    state.borderColor = color;
    if (state.frame === "none") applyFrame();
    setActiveSwatchRow(els.borderRow, color);
  }

  function applySpacing() {
    els.slots.style.gap = `${state.spacing}px`;
  }

  function setSpacing(value) {
    state.spacing = Number(value);
    applySpacing();
    els.spacingValue.textContent = state.spacing;
  }

  /* ---------------------------------------------------------
     FREE ITEMS (stickers & text)
     --------------------------------------------------------- */
  function stageWidth() {
    return els.stripRoot.clientWidth || 1;
  }

  function addSticker(emoji) {
    const item = {
      id: uid("st"),
      type: "sticker",
      emoji,
      x: 50,
      y: 50,
      rotation: 0,
      sizeRatio: 0.16,
    };
    state.items.push(item);
    renderFreeItem(item);
    selectItem(item.id);
    Sounds.tap();
  }

  function addText() {
    const item = {
      id: uid("tx"),
      type: "text",
      text: "Your text",
      font: $("#text-input-font").value,
      color: "#ffffff",
      shadow: false,
      rotation: 0,
      x: 50,
      y: 50,
      fontSizeRatio: 28 / stageWidth(),
    };
    state.items.push(item);
    renderFreeItem(item);
    selectItem(item.id);
  }

  function renderFreeItem(item) {
    let el = document.getElementById(item.id);
    if (!el) {
      el = document.createElement("div");
      el.id = item.id;
      el.className = `free-item ${item.type}-item`;
      el.innerHTML = `
        <div class="item-handles">
          <span class="handle handle-rotate" data-action="rotate">↻</span>
          <span class="handle handle-delete" data-action="delete">✕</span>
          <span class="handle handle-duplicate" data-action="duplicate">⧉</span>
          <span class="handle handle-resize" data-action="resize">⤡</span>
        </div>`;
      el.addEventListener("pointerdown", (e) => onItemPointerDown(e, item));
      els.freeLayer.appendChild(el);
    }

    el.style.left = `${item.x}%`;
    el.style.top = `${item.y}%`;

    if (item.type === "sticker") {
      el.style.fontSize = `${item.sizeRatio * stageWidth()}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg)`;
      // Replace the emoji text node (first child) while leaving the
      // handles element (always present) untouched.
      if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.remove();
      el.prepend(document.createTextNode(item.emoji));
    } else {
      el.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg)`;
      el.style.fontFamily = item.font;
      el.style.color = item.color;
      el.style.fontSize = `${item.fontSizeRatio * stageWidth()}px`;
      el.style.textShadow = item.shadow ? "0 3px 10px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.8)" : "none";
      const handles = el.querySelector(".item-handles");
      Array.from(el.childNodes).forEach((node) => {
        if (node.nodeType === 3) node.remove();
      });
      el.prepend(document.createTextNode(item.text));
      el.appendChild(handles); // re-append so handles stay after the text node
    }
  }

  function findItem(id) {
    return state.items.find((i) => i.id === id);
  }

  function selectItem(id) {
    state.selectedPhotoIndex = null;
    $$(".photo-slot", els.slots).forEach((el) => el.classList.remove("selected"));
    state.selectedItemId = id;
    $$(".free-item", els.freeLayer).forEach((el) => el.classList.toggle("selected", el.id === id));
    const item = findItem(id);
    if (item && item.type === "text") {
      activateTab("text");
      syncTextPanel(item);
    }
  }

  function deselectItem() {
    state.selectedItemId = null;
    $$(".free-item", els.freeLayer).forEach((el) => el.classList.remove("selected"));
    els.textControls.dataset.disabled = "true";
  }

  function deselectAll() {
    deselectItem();
    state.selectedPhotoIndex = null;
    $$(".photo-slot", els.slots).forEach((el) => el.classList.remove("selected"));
    updatePhotoPanel();
  }

  function syncTextPanel(item) {
    els.textControls.dataset.disabled = "false";
    els.textContent.value = item.text;
    els.textFont.value = item.font;
    setActiveSwatchRow(els.textColorRow, item.color);
    els.textSize.value = Math.round(item.fontSizeRatio * stageWidth());
    els.textSizeValue.textContent = els.textSize.value;
    els.textRotation.value = item.rotation;
    els.textRotationValue.textContent = item.rotation;
    els.textShadow.checked = !!item.shadow;
  }

  function updateSelectedText(patch) {
    const item = findItem(state.selectedItemId);
    if (!item || item.type !== "text") return;
    Object.assign(item, patch);
    renderFreeItem(item);
  }

  function deleteItem(id) {
    const idx = state.items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    state.items.splice(idx, 1);
    document.getElementById(id)?.remove();
    if (state.selectedItemId === id) deselectItem();
  }

  function duplicateItem(id) {
    const item = findItem(id);
    if (!item) return;
    const copy = { ...item, id: uid(item.type === "sticker" ? "st" : "tx"), x: clamp(item.x + 6, 5, 95), y: clamp(item.y + 6, 5, 95) };
    state.items.push(copy);
    renderFreeItem(copy);
    selectItem(copy.id);
  }

  /* ---------------------------------------------------------
     POINTER INTERACTIONS — unified mouse/touch/pen via the
     Pointer Events API. Handles move / resize / rotate.
     --------------------------------------------------------- */
  function onItemPointerDown(evt, item) {
    const action = evt.target.dataset?.action;
    if (action === "delete") { deleteItem(item.id); return; }
    if (action === "duplicate") { duplicateItem(item.id); return; }

    evt.preventDefault();
    evt.stopPropagation();
    selectItem(item.id);

    const stripRect = els.stripRoot.getBoundingClientRect();
    const el = document.getElementById(item.id);
    const itemRect = el.getBoundingClientRect();
    const center = { x: itemRect.left + itemRect.width / 2, y: itemRect.top + itemRect.height / 2 };

    dragCtx = {
      mode: action === "resize" ? "resize" : action === "rotate" ? "rotate" : "move",
      pointerId: evt.pointerId,
      item,
      stripRect,
      center,
      startDist: pointDistance(center, pointerXY(evt)),
      startSizeRatio: item.type === "sticker" ? item.sizeRatio : item.fontSizeRatio,
      startRotation: item.rotation,
      startAngle: pointAngle(center, pointerXY(evt)),
    };
    el.setPointerCapture?.(evt.pointerId);
    el.style.cursor = "grabbing";
    window.addEventListener("pointermove", onItemPointerMove);
    window.addEventListener("pointerup", onItemPointerUp);
  }

  function onItemPointerMove(evt) {
    if (!dragCtx) return;
    const { mode, item, stripRect } = dragCtx;
    const pos = pointerXY(evt);

    if (mode === "move") {
      const xPct = clamp(((pos.x - stripRect.left) / stripRect.width) * 100, 0, 100);
      const yPct = clamp(((pos.y - stripRect.top) / stripRect.height) * 100, 0, 100);
      item.x = xPct;
      item.y = yPct;
      renderFreeItem(item);
    } else if (mode === "resize") {
      const dist = pointDistance(dragCtx.center, pos);
      const ratio = dist / Math.max(dragCtx.startDist, 1);
      const next = clamp(dragCtx.startSizeRatio * ratio, 0.035, 0.7);
      if (item.type === "sticker") item.sizeRatio = next;
      else item.fontSizeRatio = next;
      renderFreeItem(item);
      if (item.type === "text") syncTextPanel(item);
    } else if (mode === "rotate") {
      const angle = pointAngle(dragCtx.center, pos);
      item.rotation = Math.round(dragCtx.startRotation + (angle - dragCtx.startAngle));
      renderFreeItem(item);
      if (item.type === "text") syncTextPanel(item);
    }
  }

  function onItemPointerUp() {
    dragCtx = null;
    window.removeEventListener("pointermove", onItemPointerMove);
    window.removeEventListener("pointerup", onItemPointerUp);
  }

  /* ---------------------------------------------------------
     TOOL TABS
     --------------------------------------------------------- */
  function activateTab(tabId) {
    $$(".tool-tab", $("#tool-tabs")).forEach((btn) => {
      const active = btn.dataset.tab === tabId;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    $$(".tool-panel", $("#tool-panels")).forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${tabId}`);
    });
  }

  /* ---------------------------------------------------------
     CATALOG POPULATION (stickers / filters / frames / swatches)
     --------------------------------------------------------- */
  function buildSwatchRow(container, colors, onPick) {
    container.innerHTML = "";
    colors.forEach((color) => {
      const btn = document.createElement("button");
      btn.className = "swatch";
      btn.style.background = color;
      btn.type = "button";
      btn.dataset.color = color;
      btn.addEventListener("click", () => onPick(color));
      container.appendChild(btn);
    });
  }

  function setActiveSwatchRow(container, color) {
    $$(".swatch", container).forEach((el) => el.classList.toggle("active", el.dataset.color.toLowerCase() === String(color).toLowerCase()));
  }

  function setActiveFilterChip(id) {
    $$(".filter-chip", els.filterStrip).forEach((el) => el.classList.toggle("active", el.dataset.id === id));
  }

  function setActiveFrameCard(id) {
    $$(".frame-card", els.frameGrid).forEach((el) => el.classList.toggle("active", el.dataset.id === id));
  }

  function buildCatalogs() {
    // Stickers
    els.stickerCategories.innerHTML = "";
    els.stickerGrid.innerHTML = "";
    STICKER_CATEGORIES.forEach((cat, i) => {
      const chip = document.createElement("button");
      chip.className = "btn-chip";
      chip.textContent = cat.name;
      chip.dataset.cat = cat.id;
      if (i === 0) chip.classList.add("active-cat");
      chip.addEventListener("click", () => {
        $$(".btn-chip", els.stickerCategories).forEach((c) => c.classList.remove("active-cat"));
        chip.classList.add("active-cat");
        renderStickerGrid(cat.id);
      });
      els.stickerCategories.appendChild(chip);
    });
    renderStickerGrid(STICKER_CATEGORIES[0].id);

    // Filters
    els.filterStrip.innerHTML = "";
    FILTERS.forEach((f) => {
      const wrap = document.createElement("button");
      wrap.className = "filter-chip";
      wrap.dataset.id = f.id;
      wrap.innerHTML = `<span class="filter-thumb" style="filter:${f.css}"></span><span>${f.name}</span>`;
      wrap.addEventListener("click", () => setFilter(f.id));
      els.filterStrip.appendChild(wrap);
    });

    // Frames
    els.frameGrid.innerHTML = "";
    FRAMES.forEach((f) => {
      const card = document.createElement("button");
      card.className = "frame-card";
      card.dataset.id = f.id;
      card.innerHTML = `<span class="frame-thumb">${f.corner || ""}</span><span>${f.name}</span>`;
      card.addEventListener("click", () => setFrame(f.id));
      els.frameGrid.appendChild(card);
    });

    // Swatch rows
    buildSwatchRow(els.bgRow, SWATCHES_BACKGROUND, (c) => { setBackground(c); els.bgCustom.value = c; });
    buildSwatchRow(els.borderRow, SWATCHES_BORDER, (c) => { setBorderColor(c); els.borderCustom.value = c; });
    buildSwatchRow(els.textColorRow, SWATCHES_TEXT, (c) => { updateSelectedText({ color: c }); els.textCustom.value = c; });
  }

  function renderStickerGrid(catId) {
    const cat = STICKER_CATEGORIES.find((c) => c.id === catId);
    els.stickerGrid.innerHTML = "";
    cat.emojis.forEach((emoji) => {
      const btn = document.createElement("button");
      btn.className = "sticker-btn";
      btn.textContent = emoji;
      btn.addEventListener("click", () => addSticker(emoji));
      els.stickerGrid.appendChild(btn);
    });
  }

  /* ---------------------------------------------------------
     STATIC UI BINDING (runs once at startup)
     --------------------------------------------------------- */
  function bindStaticUI() {
    cacheEls();
    buildCatalogs();

    $$(".tool-tab", $("#tool-tabs")).forEach((btn) => {
      btn.addEventListener("click", () => activateTab(btn.dataset.tab));
    });

    // Deselect when tapping empty strip space
    els.freeLayer.addEventListener("pointerdown", (evt) => {
      if (evt.target === els.freeLayer) deselectItem();
    });

    $("#btn-add-text").addEventListener("click", addText);
    els.textContent.addEventListener("input", (e) => updateSelectedText({ text: e.target.value || " " }));
    els.textFont.addEventListener("change", (e) => updateSelectedText({ font: e.target.value }));
    els.textSize.addEventListener("input", (e) => {
      updateSelectedText({ fontSizeRatio: Number(e.target.value) / stageWidth() });
      els.textSizeValue.textContent = e.target.value;
    });
    els.textRotation.addEventListener("input", (e) => { updateSelectedText({ rotation: Number(e.target.value) }); els.textRotationValue.textContent = e.target.value; });
    els.textShadow.addEventListener("change", (e) => updateSelectedText({ shadow: e.target.checked }));
    els.textCustom.addEventListener("input", (e) => updateSelectedText({ color: e.target.value }));
    $("#btn-text-duplicate").addEventListener("click", () => state.selectedItemId && duplicateItem(state.selectedItemId));
    $("#btn-text-delete").addEventListener("click", () => state.selectedItemId && deleteItem(state.selectedItemId));

    els.bgCustom.addEventListener("input", (e) => setBackground(e.target.value));
    els.borderCustom.addEventListener("input", (e) => setBorderColor(e.target.value));
    els.spacingInput.addEventListener("input", (e) => setSpacing(e.target.value));

    els.photoZoom.addEventListener("input", (e) => {
      mutateSelectedPhoto({ zoom: Number(e.target.value) });
    });
    $("#btn-photo-rotate").addEventListener("click", () => {
      if (state.selectedPhotoIndex === null) return;
      const photo = state.photos[state.selectedPhotoIndex];
      mutateSelectedPhoto({ rotate: (photo.rotate + 90) % 360 });
    });
    $("#btn-photo-flip-h").addEventListener("click", () => {
      if (state.selectedPhotoIndex === null) return;
      mutateSelectedPhoto({ flipH: !state.photos[state.selectedPhotoIndex].flipH });
    });
    $("#btn-photo-flip-v").addEventListener("click", () => {
      if (state.selectedPhotoIndex === null) return;
      mutateSelectedPhoto({ flipV: !state.photos[state.selectedPhotoIndex].flipV });
    });
    $("#btn-photo-reset").addEventListener("click", () => mutateSelectedPhoto({ rotate: 0, flipH: false, flipV: false, zoom: 100 }));

    window.addEventListener("resize", () => handleResize());
  }

  return {
    bindStaticUI,
    init,
    getState,
    handleResize,
    deselectAll,
  };
})();
