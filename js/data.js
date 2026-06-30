/* ===========================================================
   DATA
   Static content definitions for layouts, stickers, filters,
   frames and color palettes. Kept separate from logic so the
   catalog is easy to extend without touching app behaviour.
   =========================================================== */

/** Photo layouts. `cols`/`rows` drive the CSS grid; `aspect` is
 *  the width/height ratio used both for on-screen preview sizing
 *  and for the high-resolution export canvas. */
const LAYOUTS = [
  { id: "single",   name: "Single Photo",     count: 1, cols: 1, rows: 1, aspect: 4 / 5 },
  { id: "two",       name: "2 Photos",          count: 2, cols: 1, rows: 2, aspect: 3 / 5 },
  { id: "four",      name: "4 Photos",          count: 4, cols: 2, rows: 2, aspect: 4 / 5 },
  { id: "six",       name: "6 Photos",          count: 6, cols: 2, rows: 3, aspect: 2 / 3 },
  { id: "strip",     name: "Vertical Strip",    count: 4, cols: 1, rows: 4, aspect: 2 / 7 },
  { id: "square",    name: "Square Collage",    count: 4, cols: 2, rows: 2, aspect: 1 },
  { id: "polaroid",  name: "Polaroid Style",    count: 1, cols: 1, rows: 1, aspect: 4 / 5, polaroid: true },
];

/** Sticker catalog — emoji-based by design choice: it renders
 *  crisply at any size, needs no image assets, costs no load
 *  time, and is fully touch-friendly out of the box. */
const STICKER_CATEGORIES = [
  { id: "hearts",   name: "Hearts",    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💕","💖","💗","💘"] },
  { id: "flowers",  name: "Flowers",   emojis: ["🌸","🌼","🌻","🌺","🌷","🌹","💐","🌿","🍀","🌾"] },
  { id: "stars",    name: "Stars",     emojis: ["⭐","🌟","✨","💫","🌠","🪐"] },
  { id: "balloons", name: "Balloons",  emojis: ["🎈","🎉","🎊","🪅"] },
  { id: "cakes",    name: "Cakes",     emojis: ["🎂","🧁","🍰","🍩","🍪","🍫"] },
  { id: "shades",   name: "Sunglasses", emojis: ["😎","🕶️"] },
  { id: "emojis",   name: "Emojis",    emojis: ["😂","😍","🤩","🥳","😜","🤗","😘","🙌","😇","🤪"] },
  { id: "sparkles", name: "Sparkles",  emojis: ["✨","🎇","🎆","💥","🌈"] },
  { id: "bows",     name: "Bows",      emojis: ["🎀","🪄"] },
  { id: "animals",  name: "Animals",   emojis: ["🐶","🐱","🐰","🐼","🦄","🐥","🐻","🦋","🐨","🐢"] },
  { id: "shapes",   name: "Shapes",    emojis: ["🔷","🔶","⚪","⚫","🔺","🔻","♥","★","●","▲"] },
];

/** Filters map directly to a CSS `filter` string, which is also
 *  applied to the canvas context at export time so the exported
 *  image always matches the live preview. */
const FILTERS = [
  { id: "original", name: "Original",     css: "none" },
  { id: "bw",        name: "B & W",        css: "grayscale(1) contrast(1.05)" },
  { id: "vintage",   name: "Vintage",      css: "sepia(0.35) contrast(1.1) saturate(1.3) hue-rotate(-8deg)" },
  { id: "film",      name: "Film",         css: "contrast(1.15) saturate(0.9) brightness(1.05) sepia(0.12)" },
  { id: "sepia",     name: "Sepia",        css: "sepia(0.85)" },
  { id: "warm",      name: "Warm",         css: "sepia(0.25) saturate(1.4) brightness(1.05) hue-rotate(-5deg)" },
  { id: "cool",      name: "Cool",         css: "saturate(1.2) hue-rotate(15deg) brightness(1.02)" },
  { id: "bright",    name: "Bright",       css: "brightness(1.25) saturate(1.1)" },
  { id: "soft",      name: "Soft",         css: "brightness(1.08) contrast(0.92) saturate(0.95)" },
  { id: "pastel",    name: "Pastel",       css: "saturate(0.7) brightness(1.12) contrast(0.9) sepia(0.08)" },
];

/** Frames are drawn entirely with CSS (inset borders + small
 *  corner glyphs) so they need no image assets and automatically
 *  scale to fit any chosen layout. */
const FRAMES = [
  { id: "none",     name: "None" },
  { id: "minimal",  name: "Minimal",  corner: "" },
  { id: "retro",    name: "Retro",    corner: "" },
  { id: "vintage",  name: "Vintage",  corner: "" },
  { id: "birthday", name: "Birthday", corner: "🎉" },
  { id: "wedding",  name: "Wedding",  corner: "🤍" },
  { id: "christmas",name: "Christmas",corner: "❄️" },
  { id: "cute",     name: "Cute",     corner: "🎀" },
  { id: "neon",     name: "Neon",     corner: "" },
  { id: "comic",    name: "Comic",    corner: "💥" },
  { id: "polaroid", name: "Polaroid", corner: "" },
];

const SWATCHES_BACKGROUND = ["#1a1b35", "#0b0c1e", "#ffffff", "#ffe3ef", "#fff4d6", "#dff5e8", "#e3e8ff", "#2e2a3e", "#ff5da2", "#7c5cff"];
const SWATCHES_BORDER     = ["#ffffff", "#000000", "#ff5da2", "#ffb84d", "#7c5cff", "#4ddf9b", "#1a1b35", "#ffd6e8"];
const SWATCHES_TEXT       = ["#ffffff", "#000000", "#ff5da2", "#ffb84d", "#7c5cff", "#4ddf9b", "#ff6b6b", "#fff4d6"];

/* Exposed as plain globals (no bundler / module system, per the
   "vanilla, no build step" requirement) — every other script can
   read these directly. */
