import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useChartOfAccounts, useExpenseCategories, useProductLines } from '../hooks/useChartOfAccounts';
import { useTransactions } from '../hooks/useTransactions';
import { useVendors } from '../hooks/useVendors';
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

let lineItemSeq = 0;
function blankLineItem() {
  lineItemSeq += 1;
  return { key: `line-${lineItemSeq}`, amount: '', accountId: '', productLineId: '', expenseCategoryId: '', isTaxDeductible: true };
}

export default function TransactionEntry({ onPosted, prefill, editingTransaction, onCancelEdit }) {
  const { accounts } = useChartOfAccounts();
  const { productLines } = useProductLines();
  const { categories } = useExpenseCategories();
  const { postTransaction, postSplitTransaction, postItemizedTransaction, updateTransaction, deleteTransaction } =
    useTransactions();
  const { vendors, getOrCreateVendor } = useVendors();

  const [transactionId, setTransactionId] = useState(null);
  const [entryType, setEntryType] = useState('expense'); // 'expense' | 'income'
  const [mode, setMode] = useState('single'); // 'single' | 'splitProduct' | 'itemized'
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [moneyAccountId, setMoneyAccountId] = useState(''); // cash/bank/credit card side
  const [glAccountId, setGlAccountId] = useState(''); // expense or revenue side (single mode / splitProduct mode)
  const [productLineId, setProductLineId] = useState('');
  const [splitProductLineIds, setSplitProductLineIds] = useState([]);
  const [lineItems, setLineItems] = useState(() => [blankLineItem(), blankLineItem()]);
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [receiptId, setReceiptId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isEditing = Boolean(transactionId);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.amount != null) setAmount(String(prefill.amount));
    if (prefill.description) setDescription(prefill.description);
    if (prefill.transactionDate) setTransactionDate(prefill.transactionDate);
    if (prefill.receiptId) setReceiptId(prefill.receiptId);
  }, [prefill]);

  useEffect(() => {
    if (!editingTransaction) return;
    const t = editingTransaction;
    const debitIsExpense = t.debit_account?.account_type === 'expense';
    const type = debitIsExpense ? 'expense' : 'income';

    setTransactionId(t.id);
    setEntryType(type);
    setMode('single');
    setAmount(String(t.amount));
    setTransactionDate(t.transaction_date);
    setDescription(t.description ?? '');
    setVendorName(t.vendor?.vendor_name ?? '');
    setMoneyAccountId(type === 'expense' ? t.credit_account_id : t.debit_account_id);
    setGlAccountId(type === 'expense' ? t.debit_account_id : t.credit_account_id);
    setProductLineId(t.product_line_id ?? '');
    setSplitProductLineIds([]);
    setLineItems([blankLineItem(), blankLineItem()]);
    setExpenseCategoryId(t.expense_category_id ?? '');
    setIsTaxDeductible(t.is_tax_deductible ?? true);
    setReceiptId(t.receipt_id ?? null);
    setError('');
    setSuccess('');
  }, [editingTransaction]);

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
    setTransactionId(null);
    setMode('single');
    setAmount('');
    setDescription('');
    setVendorName('');
    setMoneyAccountId('');
    setGlAccountId('');
    setProductLineId('');
    setSplitProductLineIds([]);
    setLineItems([blankLineItem(), blankLineItem()]);
    setExpenseCategoryId('');
    setIsTaxDeductible(true);
    setReceiptId(null);
  };

  const toggleSplitLine = (id) => {
    setSplitProductLineIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleProductLineChange = (id) => {
    setProductLineId(id);
    const product = productLines.find((p) => p.id === id);
    const defaultAccountId =
      entryType === 'expense' ? product?.default_expense_account_id : product?.default_revenue_account_id;
    if (defaultAccountId) setGlAccountId(defaultAccountId);
  };

  const updateLineItem = (key, patch) => {
    setLineItems((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const handleLineCategoryChange = (key, categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    updateLineItem(key, {
      expenseCategoryId: categoryId,
      isTaxDeductible: category ? category.is_tax_deductible : true,
    });
  };

  const addLineItem = () => setLineItems((prev) => [...prev, blankLineItem()]);
  const removeLineItem = (key) => setLineItems((prev) => (prev.length > 2 ? prev.filter((l) => l.key !== key) : prev));

  const lineItemsTotal = lineItems.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!moneyAccountId) {
      setError('Choose the account this was paid from / deposited to.');
      return;
    }
    if (mode === 'single' && !glAccountId) {
      setError('Choose both accounts for this transaction.');
      return;
    }
    if (mode === 'splitProduct') {
      if (!glAccountId) {
        setError('Choose both accounts for this transaction.');
        return;
      }
      if (splitProductLineIds.length < 2) {
        setError('Select at least two product lines to split across.');
        return;
      }
    }
    if (mode === 'itemized') {
      if (lineItems.length < 2) {
        setError('Add at least two line items.');
        return;
      }
      if (lineItems.some((l) => !l.accountId || !(Number(l.amount) > 0))) {
        setError('Every line item needs an account and a positive amount.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const vendor = entryType === 'expense' && vendorName.trim() ? await getOrCreateVendor(vendorName) : null;

      if (mode === 'itemized') {
        const itemizedParams = {
          moneyAccountId,
          entryType,
          transactionDate,
          description,
          vendorId: vendor?.id ?? null,
          lineItems: lineItems.map((l) => ({
            amount: Number(l.amount),
            accountId: l.accountId,
            productLineId: l.productLineId || null,
            expenseCategoryId: entryType === 'expense' ? l.expenseCategoryId || null : null,
            isTaxDeductible: entryType === 'expense' ? l.isTaxDeductible : null,
          })),
        };

        if (isEditing) {
          // Itemizing is really N separate rows -- post the new lines
          // first, and only remove the original once that succeeds, so a
          // failure here never loses the original transaction.
          const posted = await postItemizedTransaction(itemizedParams);
          await deleteTransaction(transactionId);
          setSuccess(`Replaced with ${posted.length} itemized line(s).`);
        } else {
          const posted = await postItemizedTransaction({ ...itemizedParams, receiptId: receiptId || null });
          setSuccess(`Posted ${posted.length} itemized line(s).`);
        }
        resetForm();
        onPosted?.();
        return;
      }

      const debitAccountId = entryType === 'expense' ? glAccountId : moneyAccountId;
      const creditAccountId = entryType === 'expense' ? moneyAccountId : glAccountId;
      const payload = {
        debitAccountId,
        creditAccountId,
        amount: Number(amount),
        description,
        transactionDate,
        expenseCategoryId: entryType === 'expense' ? expenseCategoryId || null : null,
        isTaxDeductible: entryType === 'expense' ? isTaxDeductible : null,
        vendorId: vendor?.id ?? null,
      };

      if (isEditing && mode === 'splitProduct') {
        // Same reasoning as itemized: post the split rows first, then
        // remove the original once that succeeds.
        const productLineLabelsById = Object.fromEntries(productLines.map((p) => [p.id, p.product_name]));
        const posted = await postSplitTransaction({
          ...payload,
          productLineIds: splitProductLineIds,
          productLineLabelsById,
        });
        await deleteTransaction(transactionId);
        setSuccess(`Replaced with a split across ${posted.length} product lines.`);
      } else if (isEditing) {
        await updateTransaction({ transactionId, ...payload, productLineId: productLineId || null });
        setSuccess('Transaction updated.');
      } else if (mode === 'splitProduct') {
        const productLineLabelsById = Object.fromEntries(productLines.map((p) => [p.id, p.product_name]));
        const posted = await postSplitTransaction({
          ...payload,
          productLineIds: splitProductLineIds,
          productLineLabelsById,
          receiptId: receiptId || null,
        });
        setSuccess(`Transaction split across ${posted.length} product lines.`);
      } else {
        await postTransaction({ ...payload, productLineId: productLineId || null, receiptId: receiptId || null });
        setSuccess('Transaction posted.');
      }
      resetForm();
      onPosted?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    resetForm();
    setError('');
    setSuccess('');
    onCancelEdit?.();
  };

  const submitLabel = submitting
    ? 'Saving…'
    : isEditing && mode !== 'single'
      ? mode === 'itemized'
        ? 'Replace with itemized lines'
        : 'Replace with split'
      : isEditing
        ? 'Update transaction'
        : mode === 'itemized'
          ? 'Post itemized lines'
          : mode === 'splitProduct'
            ? 'Post split transaction'
            : 'Post transaction';

  return (
    <div className="card">
      <h3>{isEditing ? 'Edit' : 'New'} {entryType === 'expense' ? 'Expense' : 'Income'}</h3>
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
          <label htmlFor="entryMode">Entry mode</label>
          <select
            id="entryMode"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setSplitProductLineIds([]);
              setProductLineId('');
            }}
          >
            <option value="single">Single line</option>
            <option value="splitProduct">Split evenly across product lines (one account)</option>
            <option value="itemized">Itemize across multiple accounts</option>
          </select>
          {mode === 'itemized' && (
            <p className="tooltip-hint">
              For one payment that covers genuinely different expense categories -- e.g. an invoice covering both an
              LLC filing fee and a domain purchase -- each with its own account and amount.
            </p>
          )}
          {isEditing && mode !== 'single' && (
            <p className="tooltip-hint">This will replace the original transaction with the new rows below.</p>
          )}
        </div>

        {mode !== 'itemized' && (
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
        )}

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

        {entryType === 'expense' && (
          <div className="form-row">
            <label htmlFor="vendor">Vendor</label>
            <input
              id="vendor"
              type="text"
              list="vendor-options"
              placeholder="e.g. OpenAI, Adobe, Google Ads"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />
            <datalist id="vendor-options">
              {vendors.map((v) => (
                <option key={v.id} value={v.vendor_name} />
              ))}
            </datalist>
            <p className="tooltip-hint">
              Pick an existing vendor or type a new one — used to group this expense account by vendor in Trends.
            </p>
          </div>
        )}

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

        {mode !== 'itemized' && (
          <div className="form-row">
            <label htmlFor="glAccount">{entryType === 'expense' ? 'Expense account' : 'Revenue account'}</label>
            <select id="glAccount" required value={glAccountId} onChange={(e) => setGlAccountId(e.target.value)}>
              <option value="">Select account…</option>
              {glAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_number} — {a.account_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'single' && (
          <div className="form-row">
            <label htmlFor="productLine">Product line</label>
            <select id="productLine" value={productLineId} onChange={(e) => handleProductLineChange(e.target.value)}>
              <option value="">Unassigned / Overhead</option>
              {productLines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.service_line} {p.department ? `› ${p.department}` : ''} › {p.product_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'splitProduct' && (
          <div className="form-row">
            <label>Split across these product lines</label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: 10,
              }}
            >
              {productLines.map((p) => (
                <label key={p.id} style={{ fontWeight: 400, display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={splitProductLineIds.includes(p.id)}
                    onChange={() => toggleSplitLine(p.id)}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  {p.service_line} {p.department ? `› ${p.department}` : ''} › {p.product_name}
                </label>
              ))}
            </div>
            {splitProductLineIds.length >= 2 && Number(amount) > 0 && (
              <p className="tooltip-hint">
                ${(Number(amount) / splitProductLineIds.length).toFixed(2)} each across {splitProductLineIds.length}{' '}
                product lines.
              </p>
            )}
          </div>
        )}

        {mode === 'itemized' && (
          <div className="form-row">
            <label>Line items</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lineItems.map((line, i) => (
                <div
                  key={line.key}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: '0.85rem' }}>Line {i + 1}</strong>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => removeLineItem(line.key)}
                      disabled={lineItems.length <= 2}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="form-row">
                    <label htmlFor={`${line.key}-amount`}>Amount</label>
                    <input
                      id={`${line.key}-amount`}
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={line.amount}
                      onChange={(e) => updateLineItem(line.key, { amount: e.target.value })}
                    />
                  </div>

                  <div className="form-row">
                    <label htmlFor={`${line.key}-account`}>{entryType === 'expense' ? 'Expense account' : 'Revenue account'}</label>
                    <select
                      id={`${line.key}-account`}
                      value={line.accountId}
                      onChange={(e) => updateLineItem(line.key, { accountId: e.target.value })}
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
                    <label htmlFor={`${line.key}-product`}>Product line</label>
                    <select
                      id={`${line.key}-product`}
                      value={line.productLineId}
                      onChange={(e) => updateLineItem(line.key, { productLineId: e.target.value })}
                    >
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
                        <label htmlFor={`${line.key}-category`}>Deduction category</label>
                        <select
                          id={`${line.key}-category`}
                          value={line.expenseCategoryId}
                          onChange={(e) => handleLineCategoryChange(line.key, e.target.value)}
                        >
                          <option value="">None</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.category_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label style={{ fontWeight: 400, fontSize: '0.85rem' }}>
                        <input
                          type="checkbox"
                          checked={line.isTaxDeductible}
                          onChange={(e) => updateLineItem(line.key, { isTaxDeductible: e.target.checked })}
                          style={{ width: 'auto', marginRight: 6 }}
                        />
                        Tax deductible
                      </label>
                    </>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="secondary" style={{ marginTop: 8, width: 'fit-content' }} onClick={addLineItem}>
              + Add line
            </button>
            <p className="tooltip-hint">Total: ${lineItemsTotal.toFixed(2)}</p>
          </div>
        )}

        {mode !== 'itemized' && entryType === 'expense' && (
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

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={submitting}>
            {submitLabel}
          </button>
          {isEditing && (
            <button type="button" className="secondary" onClick={handleCancelEdit} disabled={submitting}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
