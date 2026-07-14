import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { scanReceipt } from '../lib/ocrService';
import { useAuth } from '../hooks/useAuth';

function isHeic(file) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
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

export default function ReceiptScanner({ onSaved }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [converting, setConverting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [result, setResult] = useState(null); // { extractedVendor, extractedDate, extractedAmount, confidence, rawText }

  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setResult(null);
    setError('');
    setInfo('');

    if (!isHeic(selected)) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      return;
    }

    // iPhones save photos as HEIC by default -- almost no browser (including
    // Chrome) can decode it client-side, for the preview <img> or for
    // Tesseract's canvas-based OCR. Convert to JPEG here so both work, and
    // so what ends up in storage is actually viewable later.
    setConverting(true);
    try {
      const { default: heic2any } = await import('heic2any');
      const converted = await heic2any({ blob: selected, toType: 'image/jpeg', quality: 0.9 });
      const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
      const jpegFile = new File([jpegBlob], selected.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
      setFile(jpegFile);
      setPreviewUrl(URL.createObjectURL(jpegFile));
      setConverting(false);
      return;
    } catch (clientErr) {
      // Some HEIC variants (often edited/duplicated photos) use an encoding
      // the in-browser WASM decoder doesn't support. Fall back to a
      // server-side conversion (full native decoder) before giving up.
      setInfo('This photo needs server-side conversion -- trying that next…');
    }

    try {
      const jpegFile = await convertHeicServerSide(selected);
      setFile(jpegFile);
      setPreviewUrl(URL.createObjectURL(jpegFile));
      setInfo('');
    } catch (serverErr) {
      // Both conversion paths failed. Don't block the upload -- save the
      // original file and skip straight to manual entry instead.
      setFile(selected);
      setPreviewUrl(null);
      setInfo(
        `This photo's format can't be auto-scanned or previewed (${serverErr.message || 'unsupported HEIC variant'}) -- the file will still be saved. Enter the details below manually, or re-export it as a JPEG for scanning next time.`
      );
      setResult({ extractedVendor: null, extractedDate: null, extractedAmount: null, confidence: 0, rawText: '' });
    } finally {
      setConverting(false);
    }
  };

  const handleScan = async () => {
    if (!file) return;
    setScanning(true);
    setError('');
    try {
      const extracted = await scanReceipt(file);
      setResult(extracted);
    } catch (err) {
      setError(`OCR failed: ${err.message || 'unknown error -- try a clearer photo or a JPEG/PNG.'}`);
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!file || !result) return;
    setSaving(true);
    setError('');
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file);
      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from('receipts')
        .insert({
          user_id: user.id,
          file_url: path,
          file_name: file.name,
          file_size: file.size,
          extracted_vendor: result.extractedVendor,
          extracted_date: result.extractedDate,
          extracted_amount: result.extractedAmount,
          ocr_confidence: result.confidence,
          user_review_status: 'pending_review',
        })
        .select()
        .single();
      if (insertError) throw insertError;

      setFile(null);
      setPreviewUrl(null);
      setResult(null);
      setInfo('');
      onSaved?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h3>Scan a receipt</h3>
      <div className="form-row">
        <label htmlFor="receiptFile">Receipt image</label>
        <input id="receiptFile" type="file" accept="image/*" onChange={handleFileChange} disabled={converting} />
      </div>

      {converting && <p className="tooltip-hint">Converting HEIC photo…</p>}
      {info && <p className="tooltip-hint">{info}</p>}

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Receipt preview"
          style={{ maxWidth: 220, borderRadius: 8, border: '1px solid var(--color-border)', marginBottom: 12 }}
        />
      )}

      {file && !result && (
        <button type="button" onClick={handleScan} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Scan receipt'}
        </button>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          {result.rawText && (
            <p className="tooltip-hint">
              OCR confidence: {(result.confidence * 100).toFixed(0)}%
              {result.confidence < 0.6 && ' — low confidence, double-check the fields below.'}
            </p>
          )}

          <div className="form-row">
            <label htmlFor="vendor">Vendor</label>
            <input
              id="vendor"
              type="text"
              value={result.extractedVendor ?? ''}
              onChange={(e) => setResult({ ...result, extractedVendor: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="rDate">Date</label>
            <input
              id="rDate"
              type="date"
              value={result.extractedDate ?? ''}
              onChange={(e) => setResult({ ...result, extractedDate: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="rAmount">Amount</label>
            <input
              id="rAmount"
              type="number"
              step="0.01"
              value={result.extractedAmount ?? ''}
              onChange={(e) => setResult({ ...result, extractedAmount: parseFloat(e.target.value) })}
            />
          </div>

          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Confirm & save receipt'}
          </button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
