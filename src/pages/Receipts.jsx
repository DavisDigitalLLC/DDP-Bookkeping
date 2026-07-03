import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import ReceiptScanner from '../components/ReceiptScanner';

export default function Receipts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setReceipts(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createTransactionFromReceipt = (receipt) => {
    navigate('/transactions', {
      state: {
        prefill: {
          amount: receipt.extracted_amount ?? '',
          description: receipt.extracted_vendor ?? '',
          transactionDate: receipt.extracted_date ?? new Date().toISOString().slice(0, 10),
          receiptId: receipt.id,
        },
      },
    });
  };

  return (
    <div>
      <h2>Receipts</h2>
      <ReceiptScanner onSaved={refetch} />

      <div className="card">
        <h3>Uploaded receipts</h3>
        {loading ? (
          <p>Loading…</p>
        ) : receipts.length === 0 ? (
          <p className="tooltip-hint">No receipts yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Confidence</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td>{r.extracted_vendor ?? '—'}</td>
                  <td>{r.extracted_date ?? '—'}</td>
                  <td>{r.extracted_amount != null ? `$${Number(r.extracted_amount).toFixed(2)}` : '—'}</td>
                  <td>{r.user_review_status}</td>
                  <td>{r.ocr_confidence != null ? `${Math.round(r.ocr_confidence * 100)}%` : '—'}</td>
                  <td>
                    <button type="button" className="secondary" onClick={() => createTransactionFromReceipt(r)}>
                      Use for transaction
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
