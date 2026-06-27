// ============================================================
// Thai font embedding for jsPDF
// ------------------------------------------------------------
// jsPDF's built-in fonts (helvetica/times) do NOT support Thai glyphs.
//
// HOW TO ENABLE THAI PDFs — place THSarabunNew.ttf in:
//   training-app/client/public/fonts/THSarabunNew.ttf
//
// The app will fetch it automatically the first time a PDF is generated.
// No rebuild needed — just restart the dev server after adding the file.
//
// Font download (free, SIL OFL):
//   https://www.f0nt.com/release/th-sarabun-new/
// ============================================================

const FONT_NAME = 'THSarabunNew';
let _cached = null;   // base64 string once loaded
let _promise = null;  // in-flight fetch promise (dedupes concurrent calls)

/**
 * Fetches THSarabunNew.ttf from /fonts/ on first call, caches the result.
 * Returns true if the font is now available, false if not found.
 */
export async function ensureThaiFont() {
  if (_cached) return true;
  if (_promise) return _promise;
  _promise = fetch('/fonts/THSarabunNew.ttf')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      let binary = '';
      new Uint8Array(buf).forEach((b) => (binary += String.fromCharCode(b)));
      _cached = btoa(binary);
      return true;
    })
    .catch((e) => {
      console.warn('[thai-font] THSarabunNew.ttf not found — PDFs will use Helvetica.', e.message);
      return false;
    });
  return _promise;
}

/**
 * Registers the cached font on a jsPDF doc instance.
 * Must call ensureThaiFont() before this.
 * Returns the font family name to use ('THSarabunNew' or 'helvetica').
 */
export function registerThaiFont(doc) {
  if (!_cached) return 'helvetica';
  try {
    doc.addFileToVFS(`${FONT_NAME}.ttf`, _cached);
    doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, 'normal');
  } catch (e) {
    console.warn('[thai-font] addFont threw:', e);
    return 'helvetica';
  }

  // jsPDF's PubSub silently swallows TTFFont.open() exceptions (logs "jsPDF PubSub Error"
  // to console but never re-throws). If that happens font.metadata stays as {} with no Unicode.
  // Detect the silent failure and patch the font object so text measurement doesn't crash.
  doc.setFont(FONT_NAME, 'normal');
  const f = doc.internal.getFont();
  if (f && f.metadata && !f.metadata.Unicode) {
    f.metadata.Unicode = { encoding: {}, kerning: {}, widths: [] };
    f.metadata.glyIdsUsed = [0];
    // Provide widthOfString so getCharWidthsArray / getStringUnitWidth use it
    // instead of falling through to Unicode.widths access.
    f.metadata.widthOfString = (text, size) => text.length * size * 0.6;
    f.metadata.widthOfGlyph = () => 600;
    f.metadata.characterToGlyph = (c) => c;
    console.warn('[thai-font] TTFFont.open failed silently — patched stub metrics. Check browser console for "jsPDF PubSub Error" to see the underlying parse error.');
  }

  return FONT_NAME;
}

export const hasThaiFont = () => Boolean(_cached);
