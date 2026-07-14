import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { scanReceipt } from '../lib/ocrService';
import { useAuth } from '../hooks/useAuth';

function isHeic(file) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export default function ReceiptScanner({ onSaved }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [converting, setConverting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { extractedVendor, extractedDate, extractedAmount, confidence, rawText }

  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setResult(null);
    setError('');

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
    } catch (err) {
      setError(`Couldn't convert this HEIC photo (${err.message || 'unknown error'}) -- try exporting it as a JPEG first.`);
      setFile(null);
      setPreviewUrl(null);
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
          <p className="tooltip-hint">
            OCR confidence: {(result.confidence * 100).toFixed(0)}%
            {result.confidence < 0.6 && ' — low confidence, double-check the fields below.'}
          </p>

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
