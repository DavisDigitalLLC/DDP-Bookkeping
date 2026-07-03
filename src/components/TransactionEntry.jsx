import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useChartOfAccounts, useExpenseCategories, useProductLines } from '../hooks/useChartOfAccounts';
import { useTransactions } from '../hooks/useTransactions';
import { findGuideForCategory } from '../lib/deductionGuides';

const DEDUCTION_TOOLTIPS = {
  office_supplies:
    'Items under $500 that enable your work — pens, ink, software, monitors, desk organizers. The IRS rarely scrutinizes this category if you keep receipts.',
  software_subscriptions: 'SaaS tools, design software, AI tools — anything you pay to run the business.',
  equipment_under_2500:
    'Most solo self-employed deduct equipment under $2,500 fully in the year purchased (Section 179) — defensible with a receipt and a business-purpose note.',
  meals_entertainment: '50% deductible by default. Flag it for review — business-meal rules are context-dependent.',
  travel: 'Flights, hotels, and transportation for business purposes are fully deductible.',
  phone_internet: 'Deduct the business-use percentage of your phone and internet bill.',
  personal_expenses: 'Not deductible. Use this to keep personal spending out of your P&L, on purpose.',
};

export default function TransactionEntry({ onPosted, prefill }) {
  const { accounts } = useChartOfAccounts();
  const { productLines } = useProductLines();
  const { categories } = useExpenseCategories();
  const { postTransaction } = useTransactions();

  const [entryType, setEntryType] = useState('expense'); // 'expense' | 'income'
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [moneyAccountId, setMoneyAccountId] = useState(''); // cash/bank/credit card side
  const [glAccountId, setGlAccountId] = useState(''); // expense or revenue side
  const [productLineId, setProductLineId] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [receiptId, setReceiptId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!prefill) return;
    if (prefill.amount != null) setAmount(String(prefill.amount));
    if (prefill.description) setDescription(prefill.description);
    if (prefill.transactionDate) setTransactionDate(prefill.transactionDate);
    if (prefill.receiptId) setReceiptId(prefill.receiptId);
  }, [prefill]);

  const moneyAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'asset' || a.account_type === 'liability'),
    [accounts]
  );
  const glAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === (entryType === 'expense' ? 'expense' : 'revenue')),
    [accounts, entryType]
  );

  const selectedCategory = categories.find((c) => c.id === expenseCategoryId);

  const handleCategoryChange = (id) => {
    setExpenseCategoryId(id);
    const category = categories.find((c) => c.id === id);
    if (category) setIsTaxDeductible(category.is_tax_deductible);
  };

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setGlAccountId('');
    setProductLineId('');
    setExpenseCategoryId('');
    setIsTaxDeductible(true);
    setReceiptId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!moneyAccountId || !glAccountId) {
      setError('Choose both accounts for this transaction.');
      return;
    }

    setSubmitting(true);
    try {
      const debitAccountId = entryType === 'expense' ? glAccountId : moneyAccountId;
      const creditAccountId = entryType === 'expense' ? moneyAccountId : glAccountId;

      await postTransaction({
        debitAccountId,
        creditAccountId,
        amount: Number(amount),
        description,
        transactionDate,
        productLineId: productLineId || null,
        expenseCategoryId: entryType === 'expense' ? expenseCategoryId || null : null,
        isTaxDeductible: entryType === 'expense' ? isTaxDeductible : null,
        receiptId: receiptId || null,
      });

      setSuccess('Transaction posted.');
      resetForm();
      onPosted?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h3>New {entryType === 'expense' ? 'Expense' : 'Income'}</h3>
      {receiptId && <p className="tooltip-hint">Attached to scanned receipt.</p>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className={entryType === 'expense' ? '' : 'secondary'}
          onClick={() => {
            setEntryType('expense');
            setGlAccountId('');
          }}
        >
          Expense
        </button>
        <button
          type="button"
          className={entryType === 'income' ? '' : 'secondary'}
          onClick={() => {
            setEntryType('income');
            setGlAccountId('');
          }}
        >
          Income
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="txDate">Date</label>
          <input
            id="txDate"
            type="date"
            required
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="description">Description</label>
          <input
            id="description"
            type="text"
            placeholder={entryType === 'expense' ? 'e.g. Adobe Creative Cloud subscription' : 'e.g. AppealPath subscription revenue'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="moneyAccount">{entryType === 'expense' ? 'Paid from' : 'Deposited to'}</label>
          <select
            id="moneyAccount"
            required
            value={moneyAccountId}
            onChange={(e) => setMoneyAccountId(e.target.value)}
          >
            <option value="">Select account…</option>
            {moneyAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_number} — {a.account_name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="glAccount">{entryType === 'expense' ? 'Expense account' : 'Revenue account'}</label>
          <select
            id="glAccount"
            required
            value={glAccountId}
            onChange={(e) => setGlAccountId(e.target.value)}
          >
            <option value="">Select account…</option>
            {glAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_number} — {a.account_name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="productLine">Product line</label>
          <select id="productLine" value={productLineId} onChange={(e) => setProductLineId(e.target.value)}>
            <option value="">Unassigned / Overhead</option>
            {productLines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.service_line} {p.department ? `› ${p.department}` : ''} › {p.product_name}
              </option>
            ))}
          </select>
        </div>

        {entryType === 'expense' && (
          <>
            <div className="form-row">
              <label htmlFor="category">Deduction category</label>
              <select id="category" value={expenseCategoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
              {selectedCategory && DEDUCTION_TOOLTIPS[selectedCategory.category_code] && (
                <p className="tooltip-hint">
                  {DEDUCTION_TOOLTIPS[selectedCategory.category_code]}
                  {findGuideForCategory(selectedCategory.category_code) && (
                    <>
                      {' '}
                      <Link to={`/guides#${findGuideForCategory(selectedCategory.category_code).slug}`}>
                        Read the full guide →
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="form-row">
              <label>
                <input
                  type="checkbox"
                  checked={isTaxDeductible}
                  onChange={(e) => setIsTaxDeductible(e.target.checked)}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                Tax deductible
              </label>
            </div>
          </>
        )}

        {error && <p className="error-text">{error}</p>}
        {success && <p className="tooltip-hint">{success}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Posting…' : 'Post transaction'}
        </button>
      </form>
    </div>
  );
}
