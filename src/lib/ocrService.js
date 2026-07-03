import { createWorker } from 'tesseract.js';

const AMOUNT_LINE_RE = /(?:total|amount due|balance due|grand total|amount)[^\d$]{0,15}\$?\s?(\d{1,6}(?:,\d{3})*\.\d{2})/i;
const ANY_AMOUNT_RE = /\$\s?(\d{1,6}(?:,\d{3})*\.\d{2})/g;
const DATE_RE =
  /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})\b/i;

function parseAmount(text) {
  const labeled = text.match(AMOUNT_LINE_RE);
  if (labeled) return parseFloat(labeled[1].replace(/,/g, ''));

  const all = [...text.matchAll(ANY_AMOUNT_RE)].map((m) => parseFloat(m[1].replace(/,/g, '')));
  if (all.length === 0) return null;
  return Math.max(...all);
}

function parseDate(text) {
  const match = text.match(DATE_RE);
  if (!match) return null;
  const parsed = new Date(match[1]);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseVendor(text) {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length >= 3 && /[a-zA-Z]/.test(l) && !/^\d+$/.test(l));
  return line ?? null;
}

/**
 * Run OCR on a receipt image and best-effort extract vendor/date/amount.
 * Confidence is Tesseract's average word confidence, normalized to 0-1.
 */
export async function scanReceipt(imageFileOrBlob) {
  const worker = await createWorker('eng');
  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(imageFileOrBlob);

    return {
      rawText: text,
      confidence: Math.round(confidence) / 100,
      extractedVendor: parseVendor(text),
      extractedDate: parseDate(text),
      extractedAmount: parseAmount(text),
    };
  } finally {
    await worker.terminate();
  }
}
