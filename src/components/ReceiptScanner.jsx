import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { scanReceipt } from '../lib/ocrService';
import { useAuth } from '../hooks/useAuth';
import { isHeic, isPdf, normalizeReceiptFile } from '../lib/fileConversion';

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

    if (!isHeic(selected) && !isPdf(selected)) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      return;
    }

    // HEIC (iPhone photos) and PDF both need converting to a plain JPEG
    // before the browser can preview them or Tesseract can OCR them.
    setConverting(true);
    if (isPdf(selected)) setInfo('Rendering PDF page 1…');
    try {
      const { file: converted, note, unsupported, error: convertError } = await normalizeReceiptFile(selected, {
        onStatus: setInfo,
      });
      if (unsupported) {
        // Conversion failed entirely -- don't block the upload. Save the
        // original file and skip straight to manual entry.
        setFile(selected);
        setPreviewUrl(null);
        setInfo(
          `This file's format can't be auto-scanned or previewed (${convertError}) -- the file will still be saved. Enter the details below manually.`
        );
        setResult({ extractedVendor: null, extractedDate: null, extractedAmount: null, confidence: 0, rawText: '' });
      } else {
        setFile(converted);
        setPreviewUrl(URL.createObjectURL(converted));
        setInfo(note ?? '');
      }
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
        <label htmlFor="receiptFile">Receipt file (image, HEIC, or PDF)</label>
        <input
          id="receiptFile"
          type="file"
          accept="image/*,.heic,.heif,application/pdf,.pdf"
          onChange={handleFileChange}
          disabled={converting}
        />
      </div>

      {converting && <p className="tooltip-hint">{info || 'Converting…'}</p>}
      {!converting && info && <p className="tooltip-hint">{info}</p>}

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
