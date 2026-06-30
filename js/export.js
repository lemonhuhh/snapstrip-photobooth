/* ===========================================================
   EXPORT
   Re-draws the full composition (background, photos with their
   filter/rotate/flip/zoom, frame decoration, stickers and text)
   onto a single high-resolution <canvas>, independent of however
   big the on-screen editor happened to be. This is what actually
   produces the downloadable / printable image.
   =========================================================== */

const Exporter = (() => {
  const EXPORT_WIDTH = 1400; // logical px — keeps file size sane while staying crisp

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /** Draws one photo into its slot rect, replicating the live CSS
   *  preview: object-fit:cover, then the user's rotate/flip/zoom,
   *  clipped to the slot bounds, with the active filter applied. */
  function drawPhoto(ctx, img, rect, photo, filterCss) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    if (filterCss && filterCss !== "none" && "filter" in ctx) {
      ctx.filter = filterCss;
    }

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((photo.rotate * Math.PI) / 180);
    const flipX = photo.flipH ? -1 : 1;
    const flipY = photo.flipV ? -1 : 1;
    const extra = extraRotationScale(photo.rotate, rect.w, rect.h);
    const zoom = (photo.zoom / 100) * extra;
    ctx.scale(flipX * zoom, flipY * zoom);

    const coverScale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const dw = img.naturalWidth * coverScale;
    const dh = img.naturalHeight * coverScale;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  /** Computes the grid rects for every slot, matching the CSS grid
   *  used in the live editor (equal fr columns/rows + gap). */
  function computeSlotRects(layout, w, h, gap) {
    const rects = [];
    const colW = (w - gap * (layout.cols - 1)) / layout.cols;
    const rowH = (h - gap * (layout.rows - 1)) / layout.rows;
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        if (rects.length >= layout.count) break;
        rects.push({
          x: c * (colW + gap),
          y: r * (rowH + gap),
          w: colW,
          h: rowH,
        });
      }
    }
    return rects;
  }

  /** Approximates each CSS frame style directly on the canvas. Not a
   *  pixel-perfect match to the live DOM/CSS rendering, but visually
   *  consistent with it, scaled to fit any layout's exported size. */
  function drawFrame(ctx, frameId, w, h, borderColor) {
    const corner = (FRAMES.find((f) => f.id === frameId) || {}).corner;

    if (frameId === "none") {
      ctx.lineWidth = 10;
      ctx.strokeStyle = borderColor;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      return;
    }
    if (frameId === "minimal") {
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.strokeRect(4, 4, w - 8, h - 8);
    } else if (frameId === "retro") {
      ctx.lineWidth = 6; ctx.strokeStyle = "#1a1b35"; ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.lineWidth = 6; ctx.strokeStyle = "#ffb84d"; ctx.strokeRect(11, 11, w - 22, h - 22);
    } else if (frameId === "vintage") {
      ctx.lineWidth = 16; ctx.strokeStyle = "rgba(214,188,140,0.9)"; ctx.strokeRect(8, 8, w - 16, h - 16);
      const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.6);
      grad.addColorStop(0, "rgba(60,40,10,0)");
      grad.addColorStop(1, "rgba(60,40,10,0.35)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (frameId === "birthday" || frameId === "christmas") {
      const colors = frameId === "birthday" ? ["#ff5da2", "#ffb84d", "#7c5cff"] : ["#e6473d", "#2e8b57", "#ffffff"];
      ctx.lineWidth = 10;
      ctx.setLineDash([14, 10]);
      colors.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.lineDashOffset = i * 8;
        ctx.strokeRect(5, 5, w - 10, h - 10);
      });
      ctx.setLineDash([]);
    } else if (frameId === "wedding") {
      ctx.lineWidth = 4; ctx.strokeStyle = "#d8b46a"; ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.lineWidth = 8; ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.lineWidth = 4; ctx.strokeStyle = "#d8b46a"; ctx.strokeRect(13, 13, w - 26, h - 26);
    } else if (frameId === "cute") {
      ctx.lineWidth = 12; ctx.strokeStyle = "#ffd6e8"; ctx.strokeRect(6, 6, w - 12, h - 12);
    } else if (frameId === "neon") {
      ctx.save();
      ctx.shadowColor = "#ff5da2";
      ctx.shadowBlur = 24;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ff5da2";
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.shadowColor = "#7c5cff";
      ctx.shadowBlur = 32;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.restore();
    } else if (frameId === "comic") {
      ctx.lineWidth = 8; ctx.strokeStyle = "#0b0c1e"; ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      for (let y = 0; y < h; y += 10) {
        for (let x = 0; x < w; x += 10) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (frameId === "polaroid") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, 16);
      ctx.fillRect(0, h - 56, w, 56);
      ctx.fillRect(0, 0, 16, h);
      ctx.fillRect(w - 16, 0, 16, h);
    }

    if (corner) {
      ctx.font = `${Math.max(20, w * 0.045)}px sans-serif`;
      ctx.textBaseline = "top";
      const pad = w * 0.02 + 8;
      ctx.fillText(corner, pad, pad);
      ctx.textAlign = "right";
      ctx.fillText(corner, w - pad, pad);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(corner, pad, h - pad);
      ctx.textAlign = "right";
      ctx.fillText(corner, w - pad, h - pad);
      ctx.textAlign = "left";
    }
  }

  function drawFreeItem(ctx, item, w, h) {
    const cx = (item.x / 100) * w;
    const cy = (item.y / 100) * h;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((item.rotation * Math.PI) / 180);
    if (item.type === "sticker") {
      const size = item.sizeRatio * w;
      ctx.font = `${size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.emoji, 0, 0);
    } else {
      const size = item.fontSizeRatio * w;
      ctx.font = `${size}px ${item.font}`;
      ctx.fillStyle = item.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (item.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.65)";
        ctx.shadowBlur = size * 0.18;
        ctx.shadowOffsetY = size * 0.06;
      }
      ctx.fillText(item.text, 0, 0);
    }
    ctx.restore();
  }

  /** Builds the final composite canvas at export resolution. */
  async function renderToCanvas(state) {
    const canvas = $("#render-canvas");
    const aspect = state.layout.aspect;
    const w = EXPORT_WIDTH;
    const h = Math.round(w / aspect);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = state.background;
    ctx.fillRect(0, 0, w, h);

    const gap = (state.spacing / 320) * w; // scale the on-screen gap proportionally
    const rects = computeSlotRects(state.layout, w, h, gap);
    const filterDef = FILTERS.find((f) => f.id === state.filter) || FILTERS[0];

    const images = await Promise.all(state.photos.map((p) => loadImage(p.src)));
    rects.forEach((rect, i) => {
      if (!images[i]) return;
      drawPhoto(ctx, images[i], rect, state.photos[i], filterDef.css);
    });

    drawFrame(ctx, state.frame, w, h, state.borderColor);

    state.items.forEach((item) => drawFreeItem(ctx, item, w, h));

    return canvas;
  }

  function canvasToDataUrl(canvas, type = "image/png", quality = 0.95) {
    return canvas.toDataURL(type, quality);
  }

  function download(canvas, type, filename) {
    const dataUrl = canvasToDataUrl(canvas, type, 0.95);
    downloadDataUrl(dataUrl, filename);
  }

  function print(canvas) {
    const dataUrl = canvasToDataUrl(canvas, "image/png");
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Please allow pop-ups to print your strip.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Print your photo strip</title>
      <style>
        @page { margin: 0.4in; }
        html, body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100%; background:#fff; }
        img { max-width: 100%; max-height: 100vh; }
      </style></head>
      <body><img src="${dataUrl}" onload="window.focus(); window.print();" /></body></html>
    `);
    printWindow.document.close();
  }

  return { renderToCanvas, canvasToDataUrl, download, print };
})();
