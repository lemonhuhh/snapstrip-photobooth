# Assets

This project intentionally ships **without binary asset files** in most
of these folders. That's a deliberate engineering choice, not an
oversight — here's the reasoning for each one:

### stickers/
Stickers are rendered as **emoji glyphs** (`js/data.js` →
`STICKER_CATEGORIES`), not image files. Emoji render crisply at any
size on every platform, need zero load time, work fully offline, and
are naturally touch-friendly — no sprite sheets to manage or license.

### frames/
Decorative frames are built entirely with **CSS** (`css/frames.css`)
applied to the `#frame-overlay` layer, plus a tiny bit of JS to inject
corner glyphs (`js/editor.js`). Because they're just borders, gradients
and dashed `border-image`s, they scale to *any* chosen layout
automatically instead of needing a pre-rendered frame image per
layout/aspect-ratio combination.

### sounds/
The shutter click, countdown ticks and success chime are **synthesized
in real time** with the Web Audio API (`js/sounds.js`) — short noise
bursts and oscillator tones. No `.mp3`/`.wav` files to fetch, decode,
or have go missing; sound is available the instant the app loads.

### fonts/
The UI intentionally uses the **system font stack** (`-apple-system`,
`Segoe UI`, `Roboto`, etc. — see `css/variables.css`) rather than a
bundled web font. That keeps the app's first paint instant and fully
offline-capable, with zero external requests and no FOUT/FOIT flash.
The in-editor "Font" dropdown for text layers offers a small set of
generic font families (serif / mono / cursive) that every browser
already ships with its own version of.

### icons/
`favicon.svg` is the one real asset here — a small inline-friendly SVG.
Every other icon in the UI (back arrow, settings gear, shutter, etc.)
is hand-drawn inline SVG directly in `index.html`, so there are no
extra image requests for UI chrome either.

---

If you'd rather use real artwork (e.g. hand-illustrated sticker PNGs or
photographic frame overlays), drop files into the matching folder and
swap the relevant entry in `js/data.js` / `css/frames.css` — the rest
of the app's logic doesn't need to change.
