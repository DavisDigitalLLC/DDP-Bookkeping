// Normalizes whatever a user uploads (HEIC photo, PDF, or a regular image)
// into a plain JPEG File that both the <img> preview and Tesseract's
// canvas-based OCR can work with directly.

export function isHeic(file) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function isPdf(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** Server-side fallback via /api/convert-heic (CloudConvert) for HEIC
 * variants the browser's WASM decoder can't handle. */
async function convertHeicServerSide(file) {
  const resp = await fetch('/api/convert-heic', {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': file.name },
    body: file,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Server conversion failed (${resp.status})`);
  }
  const jpegBlob = await resp.blob();
  return new File([jpegBlob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
}

/**
 * Converts a HEIC file to JPEG, trying the fast client-side WASM decoder
 * first and falling back to a server-side conversion (CloudConvert, full
 * native decoder) for variants the WASM build can't handle.
 */
export async function convertHeic(file, { onStatus } = {}) {
  try {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
    return new File([jpegBlob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
  } catch (clientErr) {
    onStatus?.('This photo needs server-side conversion -- trying that next…');
    return convertHeicServerSide(file);
  }
}

/**
 * Renders the first page of a PDF to a JPEG File via pdf.js. Receipts are
 * almost always single-page; if there's more than one page, the filename
 * notes it so the info isn't silently dropped.
 */
export async function convertPdfFirstPage(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 2 }); // higher scale = sharper OCR input
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext('2d');
  await page.render({ canvasContext: context, viewport }).promise;

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  const suffix = pdf.numPages > 1 ? ` (page 1 of ${pdf.numPages})` : '';
  const jpegFile = new File([blob], file.name.replace(/\.pdf$/i, '.jpg'), { type: 'image/jpeg' });
  return { file: jpegFile, note: pdf.numPages > 1 ? `Only page 1 was scanned${suffix} -- the rest of the PDF is still saved.` : null };
}

/**
 * Normalizes any accepted upload (HEIC, PDF, or a browser-native image
 * format) into a JPEG File ready for preview + OCR. Returns
 * { file, note, unsupported } -- `unsupported` is set (with the original
 * file passed through unmodified) when conversion fails entirely, so the
 * caller can still save the file and fall back to manual entry.
 */
export async function normalizeReceiptFile(file, { onStatus } = {}) {
  if (isHeic(file)) {
    try {
      const jpegFile = await convertHeic(file, { onStatus });
      return { file: jpegFile, note: null, unsupported: false };
    } catch (err) {
      return { file, note: null, unsupported: true, error: err.message || 'unsupported HEIC variant' };
    }
  }

  if (isPdf(file)) {
    try {
      const { file: jpegFile, note } = await convertPdfFirstPage(file);
      return { file: jpegFile, note, unsupported: false };
    } catch (err) {
      return { file, note: null, unsupported: true, error: err.message || 'could not render PDF' };
    }
  }

  return { file, note: null, unsupported: false };
}
