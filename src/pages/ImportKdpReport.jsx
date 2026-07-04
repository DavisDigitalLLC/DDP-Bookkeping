import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useChartOfAccounts, useProductLines } from '../hooks/useChartOfAccounts';
import { useTransactions } from '../hooks/useTransactions';
import {
  aggregateKdpRows,
  descriptionFor,
  findExistingKdpTransaction,
  getOrCreatePublishingProduct,
  getOrCreateReceivableAccount,
  parseKdpWorkbook,
} from '../lib/kdpImportEngine';

const REVENUE_ACCOUNT_NUMBER = '4010';

export default function ImportKdpReport() {
  const { user } = useAuth();
  const { accounts, createAccount, refetch: refetchAccounts } = useChartOfAccounts();
  const { productLines, createProductLine, refetch: refetchProductLines } = useProductLines();
  const { postTransaction } = useTransactions();

  const [parsing, setParsing] = useState(false);
  const [groups, setGroups] = useState(null); // [{ ...group, status: 'new'|'duplicate' }]
  const [nonUsdRows, setNonUsdRows] = useState([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null); // { posted, skipped, failed: [{group, message}] }

  const revenueAccount = accounts.find((a) => a.account_number === REVENUE_ACCOUNT_NUMBER);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResults(null);
    setParsing(true);
    try {
      const rows = await parseKdpWorkbook(file);
      const { groups: parsedGroups, nonUsdRows: parsedNonUsd } = aggregateKdpRows(rows);

      const withStatus = await Promise.all(
        parsedGroups.map(async (g) => {
          const existing = await findExistingKdpTransaction(user.id, g);
          return { ...g, status: existing ? 'duplicate' : 'new' };
        })
      );

      setGroups(withStatus);
      setNonUsdRows(parsedNonUsd);
    } catch (err) {
      setError(err.message);
      setGroups(null);
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  const newGroups = (groups ?? []).filter((g) => g.status === 'new');

  const handleImport = async () => {
    if (!revenueAccount) {
      setError(`Chart of Accounts has no ${REVENUE_ACCOUNT_NUMBER} account -- add it under Manage > Chart of Accounts first.`);
      return;
    }
    setError('');
    setImporting(true);
    const outcome = { posted: 0, skipped: 0, failed: [] };
    try {
      const receivableAccount = await getOrCreateReceivableAccount(user.id, accounts, createAccount);

      let currentProductLines = productLines;
      for (const group of newGroups) {
        try {
          let product = currentProductLines.find(
            (p) => p.service_line === 'Publishing' && (p.department ?? '') === group.author && p.product_name === group.title
          );
          if (!product) {
            product = await getOrCreatePublishingProduct(group, currentProductLines, createProductLine, revenueAccount.id);
            currentProductLines = [...currentProductLines, product];
          }

          await postTransaction({
            debitAccountId: receivableAccount.id,
            creditAccountId: revenueAccount.id,
            amount: group.totalRoyalty,
            description: descriptionFor(group),
            transactionDate: group.transactionDate,
            productLineId: product.id,
          });
          outcome.posted += 1;
        } catch (err) {
          outcome.failed.push({ group, message: err.message });
        }
      }
      outcome.skipped = (groups ?? []).length - newGroups.length;
      await Promise.all([refetchAccounts(), refetchProductLines()]);
      setResults(outcome);
      // Re-check statuses so a re-run shows what's now already imported.
      const refreshed = await Promise.all(
        (groups ?? []).map(async (g) => {
          const existing = await findExistingKdpTransaction(user.id, g);
          return { ...g, status: existing ? 'duplicate' : 'new' };
        })
      );
      setGroups(refreshed);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <h2>Import KDP Royalties</h2>
      <p className="tooltip-hint" style={{ marginBottom: 16 }}>
        Upload the monthly "KDP Royalties Estimator" export from Amazon KDP. Each book title's royalty is posted as
        accrued revenue against a "KDP Royalties Receivable" asset account (since Amazon pays out ~60 days later) --
        not straight to Cash, so it won't double-count when the real deposit shows up in Bank Reconciliation. A
        Product is auto-created per book title under Publishing › author, the same way Vendors auto-create.
      </p>

      <div className="card">
        <div className="form-row">
          <label htmlFor="kdpFile">KDP Royalties Estimator (.xlsx)</label>
          <input id="kdpFile" type="file" accept=".xlsx" onChange={handleFile} disabled={parsing} />
        </div>
        {parsing && <p className="tooltip-hint">Parsing…</p>}
        {error && <p className="error-text">{error}</p>}
        {results && (
          <p className="tooltip-hint">
            Posted {results.posted} transaction(s). Skipped {results.skipped} already-imported group(s).
            {results.failed.length > 0 && ` ${results.failed.length} failed -- see below.`}
          </p>
        )}
        {results?.failed.map((f) => (
          <p key={f.group.key} className="error-text">
            {f.group.title} ({f.group.monthLabel}): {f.message}
          </p>
        ))}
      </div>

      {groups && (
        <div className="card">
          <h3>Revenue to import ({newGroups.length} new of {groups.length})</h3>
          {groups.length === 0 ? (
            <p className="tooltip-hint">No USD rows found in the Combined Sales sheet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Month</th>
                  <th>Units</th>
                  <th>Royalty</th>
                  <th>Marketplaces</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key}>
                    <td>{g.title}</td>
                    <td>{g.author || '—'}</td>
                    <td>{g.monthLabel}</td>
                    <td>{g.totalUnits}</td>
                    <td>${g.totalRoyalty.toFixed(2)}</td>
                    <td>{g.marketplaces.join(', ')}</td>
                    <td>{g.status === 'duplicate' ? 'Already imported' : 'New'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button type="button" onClick={handleImport} disabled={importing || newGroups.length === 0} style={{ marginTop: 12 }}>
            {importing ? 'Importing…' : `Import ${newGroups.length} new transaction(s)`}
          </button>
        </div>
      )}

      {nonUsdRows.length > 0 && (
        <div className="card">
          <h3>Needs manual entry ({nonUsdRows.length} non-USD row(s))</h3>
          <p className="tooltip-hint">
            These rows are in a foreign currency and weren't auto-converted or posted -- enter them manually with
            whatever exchange rate you use.
          </p>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Marketplace</th>
                <th>Currency</th>
                <th>Royalty</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {nonUsdRows.map((r, i) => (
                <tr key={i}>
                  <td>{r.title}</td>
                  <td>{r.author || '—'}</td>
                  <td>{r.marketplace}</td>
                  <td>{r.currency}</td>
                  <td>{r.royalty}</td>
                  <td>{String(r.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
