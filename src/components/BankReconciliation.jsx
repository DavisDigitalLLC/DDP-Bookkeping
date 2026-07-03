import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import {
  findSuggestedMatches,
  importBankTransactions,
  matchBankTransaction,
  parseBankCsv,
  reconcileMatchedTransactions,
  unmatchBankTransaction,
} from '../lib/bankReconciliation';

function MatchRow({ bankTx, glAccountId, userId, onMatched }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSuggestions = async () => {
    setLoading(true);
    setError('');
    try {
      const matches = await findSuggestedMatches({ userId, glAccountId, bankTransaction: bankTx });
      setSuggestions(matches);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async (glTransactionId) => {
    try {
      await matchBankTransaction({ bankTransactionId: bankTx.id, glTransactionId });
      onMatched();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <tr>
      <td>{bankTx.transaction_date}</td>
      <td>{bankTx.description}</td>
      <td>${Number(bankTx.amount).toFixed(2)}</td>
      <td>
        {suggestions === null ? (
          <button type="button" className="secondary" onClick={loadSuggestions} disabled={loading}>
            {loading ? 'Searching…' : 'Find matches'}
          </button>
        ) : suggestions.length === 0 ? (
          <span className="tooltip-hint">No matching GL transaction found.</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {suggestions.map((s) => (
              <button key={s.id} type="button" className="secondary" onClick={() => handleMatch(s.id)}>
                Match: {s.transaction_date} — {s.description} (${Number(s.amount).toFixed(2)})
              </button>
            ))}
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
      </td>
    </tr>
  );
}

export default function BankReconciliation({ bankAccount }) {
  const { user } = useAuth();
  const [bankTransactions, setBankTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [throughDate, setThroughDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusMessage, setStatusMessage] = useState('');

  const refetch = useCallback(async () => {
    if (!user || !bankAccount) return;
    setLoading(true);
    const { data } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('bank_account_id', bankAccount.id)
      .order('transaction_date', { ascending: false });
    setBankTransactions(data ?? []);
    setLoading(false);
  }, [user, bankAccount]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseBankCsv(text);
      await importBankTransactions({ userId: user.id, bankAccountId: bankAccount.id, rows });
      await refetch();
      setStatusMessage(`Imported ${rows.length} row(s).`);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleUnmatch = async (id) => {
    await unmatchBankTransaction(id);
    await refetch();
  };

  const handleReconcile = async () => {
    setReconciling(true);
    setStatusMessage('');
    try {
      const count = await reconcileMatchedTransactions({
        userId: user.id,
        bankAccountId: bankAccount.id,
        throughDate,
      });
      setStatusMessage(`Reconciled ${count} matched transaction(s) through ${throughDate}.`);
      await refetch();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setReconciling(false);
    }
  };

  const pending = bankTransactions.filter((t) => t.status === 'pending');
  const matched = bankTransactions.filter((t) => t.status === 'matched');
  const reconciled = bankTransactions.filter((t) => t.status === 'reconciled');

  return (
    <div className="card">
      <h3>{bankAccount.account_name}</h3>

      <div className="form-row">
        <label htmlFor="csvFile">Import bank transactions (CSV with date, description, amount)</label>
        <input id="csvFile" type="file" accept=".csv,text/csv" onChange={handleCsvUpload} disabled={importing} />
      </div>
      {importError && <p className="error-text">{importError}</p>}
      {statusMessage && <p className="tooltip-hint">{statusMessage}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <h4>Pending ({pending.length})</h4>
          {pending.length === 0 ? (
            <p className="tooltip-hint">Nothing pending — import a CSV to get started.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((bt) => (
                  <MatchRow
                    key={bt.id}
                    bankTx={bt}
                    glAccountId={bankAccount.gl_account_id}
                    userId={user.id}
                    onMatched={refetch}
                  />
                ))}
              </tbody>
            </table>
          )}

          <h4 style={{ marginTop: 20 }}>Matched, awaiting reconciliation ({matched.length})</h4>
          {matched.length === 0 ? (
            <p className="tooltip-hint">Nothing matched yet.</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {matched.map((bt) => (
                    <tr key={bt.id}>
                      <td>{bt.transaction_date}</td>
                      <td>{bt.description}</td>
                      <td>${Number(bt.amount).toFixed(2)}</td>
                      <td>
                        <button type="button" className="secondary" onClick={() => handleUnmatch(bt.id)}>
                          Unmatch
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="form-row" style={{ marginTop: 12 }}>
                <label htmlFor="throughDate">Reconcile matched transactions through</label>
                <input
                  id="throughDate"
                  type="date"
                  value={throughDate}
                  onChange={(e) => setThroughDate(e.target.value)}
                />
              </div>
              <button type="button" onClick={handleReconcile} disabled={reconciling}>
                {reconciling ? 'Reconciling…' : 'Close month / reconcile'}
              </button>
            </>
          )}

          <h4 style={{ marginTop: 20 }}>Reconciled ({reconciled.length})</h4>
          {reconciled.length === 0 ? (
            <p className="tooltip-hint">Nothing reconciled yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {reconciled.map((bt) => (
                  <tr key={bt.id}>
                    <td>{bt.transaction_date}</td>
                    <td>{bt.description}</td>
                    <td>${Number(bt.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
