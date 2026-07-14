import ExcelJS from 'exceljs';
import { supabase } from './supabaseClient';
import { addBrandedHeader, BRAND, downloadWorkbook, FONT, loadLogoBuffer, setWorkbookMeta, styleTableHeaderRow, zebraStripe } from './xlsxBranding';

/**
 * Pull every transaction in [startDate, endDate] with its related account,
 * product line, and vendor labels already joined -- the raw material for
 * the custom report builder. Filtering by category (account type, service
 * line, department, product, vendor) happens client-side in
 * applyReportFilters, since the combinations are too open-ended to encode
 * as a single Postgres query.
 */
export async function fetchReportData(userId, { startDate, endDate }) {
  const [{ data: transactions, error: txError }, { data: productLines, error: plError }, { data: vendors, error: vError }] =
    await Promise.all([
      supabase
        .from('transactions')
        .select(
          `*,
           debit_account:chart_of_accounts!transactions_debit_account_id_fkey(account_number, account_name, account_type),
           credit_account:chart_of_accounts!transactions_credit_account_id_fkey(account_number, account_name, account_type),
           product_line:product_lines(service_line, department, product_name),
           vendor:vendors(vendor_name)`
        )
        .eq('user_id', userId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date'),
      supabase.from('product_lines').select('id, service_line, department, product_name').eq('user_id', userId),
      supabase.from('vendors').select('id, vendor_name').eq('user_id', userId),
    ]);
  if (txError) throw txError;
  if (plError) throw plError;
  if (vError) throw vError;

  return { transactions, productLines, vendors };
}

/**
 * filters: { accountType: 'all'|'revenue'|'expense'|'asset'|'liability'|'equity',
 *            serviceLines: string[], productLineIds: string[], vendorIds: string[] }
 * Empty arrays mean "no restriction" for that dimension.
 */
export function applyReportFilters(transactions, filters) {
  return transactions.filter((t) => {
    if (filters.accountType && filters.accountType !== 'all') {
      const matches = t.debit_account?.account_type === filters.accountType || t.credit_account?.account_type === filters.accountType;
      if (!matches) return false;
    }
    if (filters.serviceLines?.length) {
      if (!t.product_line || !filters.serviceLines.includes(t.product_line.service_line)) return false;
    }
    if (filters.productLineIds?.length && !filters.productLineIds.includes(t.product_line_id)) return false;
    if (filters.vendorIds?.length && !filters.vendorIds.includes(t.vendor_id)) return false;
    return true;
  });
}

function currencyCol(header, key, width = 14) {
  return { header, key, width, style: { numFmt: '$#,##0.00' } };
}

const DEBIT_NORMAL_TYPES = new Set(['asset', 'expense']);

/**
 * Builds a branded, formatted .xlsx (Summary + Detail sheets) from an
 * already date-and-filter-scoped transaction list, and triggers a browser
 * download. (Not a true macro-enabled .xlsm -- there's no macro content to
 * justify one; this gives the same formatting and opens identically in
 * Excel.)
 */
export async function exportReportToXlsx(transactions, { startDate, endDate, filenamePrefix = 'DDP-Custom-Report' } = {}) {
  const workbook = new ExcelJS.Workbook();
  setWorkbookMeta(workbook);
  const logoBuffer = await loadLogoBuffer();
  const logoImageId = logoBuffer ? workbook.addImage({ buffer: logoBuffer, extension: 'png' }) : null;

  // -----------------------------------------------------------------
  // Summary sheet: totals by account, by service line/product, by vendor
  // -----------------------------------------------------------------
  const summarySheet = workbook.addWorksheet('Summary');
  let cursor = addBrandedHeader(summarySheet, {
    title: 'Custom Report',
    subtitle: `Period: ${startDate} through ${endDate}`,
    logoImageId,
  });

  const byAccount = new Map();
  const byProduct = new Map();
  const byVendor = new Map();

  for (const t of transactions) {
    const amount = Number(t.amount);

    // Signed so a debit-normal account (asset/expense) shows a debit as
    // positive, and a credit-normal account (revenue/liability/equity)
    // shows a credit as positive -- i.e. every total reads as "the normal,
    // expected direction of activity for that account."
    if (t.debit_account) {
      const key = `${t.debit_account.account_number} — ${t.debit_account.account_name}`;
      const sign = DEBIT_NORMAL_TYPES.has(t.debit_account.account_type) ? 1 : -1;
      byAccount.set(key, (byAccount.get(key) ?? 0) + amount * sign);
    }
    if (t.credit_account) {
      const key = `${t.credit_account.account_number} — ${t.credit_account.account_name}`;
      const sign = DEBIT_NORMAL_TYPES.has(t.credit_account.account_type) ? -1 : 1;
      byAccount.set(key, (byAccount.get(key) ?? 0) + amount * sign);
    }

    const productLabel = t.product_line
      ? `${t.product_line.service_line}${t.product_line.department ? ` › ${t.product_line.department}` : ''} › ${t.product_line.product_name}`
      : 'Unassigned / Overhead';
    byProduct.set(productLabel, (byProduct.get(productLabel) ?? 0) + amount);

    if (t.vendor?.vendor_name) {
      byVendor.set(t.vendor.vendor_name, (byVendor.get(t.vendor.vendor_name) ?? 0) + amount);
    }
  }

  const addSummaryTable = (title, entries, labelHeader) => {
    const titleRow = summarySheet.getRow(cursor);
    titleRow.getCell(1).value = title;
    titleRow.getCell(1).font = { name: FONT, size: 13, bold: true, color: { argb: BRAND.deepEvergreen } };
    cursor += 1;

    const headerRowNum = cursor;
    const headerRow = summarySheet.getRow(headerRowNum);
    headerRow.getCell(1).value = labelHeader;
    headerRow.getCell(2).value = 'Total';
    styleTableHeaderRow(summarySheet, headerRowNum);
    cursor += 1;

    const firstDataRow = cursor;
    for (const [label, total] of [...entries.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
      const row = summarySheet.getRow(cursor);
      row.getCell(1).value = label;
      row.getCell(2).value = total;
      row.getCell(2).numFmt = '$#,##0.00;[RED]($#,##0.00)';
      row.getCell(1).font = { name: FONT, size: 10 };
      row.getCell(2).font = { name: FONT, size: 10 };
      cursor += 1;
    }
    zebraStripe(summarySheet, firstDataRow, cursor - 1, 2);
    cursor += 1; // spacer
  };

  addSummaryTable('By Account', byAccount, 'Account');
  addSummaryTable('By Product Line', byProduct, 'Service Line › Department › Product');
  if (byVendor.size) addSummaryTable('By Vendor', byVendor, 'Vendor');

  summarySheet.getColumn(1).width = 44;
  summarySheet.getColumn(2).width = 18;

  // -----------------------------------------------------------------
  // Detail sheet: every matching transaction, one row each
  // -----------------------------------------------------------------
  const detailSheet = workbook.addWorksheet('Detail');
  const detailStartRow = addBrandedHeader(detailSheet, {
    title: 'Custom Report — Detail',
    subtitle: `Period: ${startDate} through ${endDate} · ${transactions.length} transaction(s)`,
    logoImageId,
    endCol: 12,
  });

  const columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Description', key: 'description', width: 32 },
    { header: 'Notes', key: 'notes', width: 32 },
    { header: 'Debit Account', key: 'debit', width: 26 },
    { header: 'Credit Account', key: 'credit', width: 26 },
    currencyCol('Amount', 'amount'),
    { header: 'Service Line', key: 'serviceLine', width: 16 },
    { header: 'Department', key: 'department', width: 16 },
    { header: 'Product', key: 'product', width: 20 },
    { header: 'Vendor', key: 'vendor', width: 20 },
    { header: 'Tax Deductible', key: 'deductible', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  columns.forEach((c, i) => {
    detailSheet.getColumn(i + 1).width = c.width;
    detailSheet.getColumn(i + 1).key = c.key;
    if (c.style) detailSheet.getColumn(i + 1).numFmt = c.style.numFmt;
  });
  const headerRow = detailSheet.getRow(detailStartRow);
  columns.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
  });
  styleTableHeaderRow(detailSheet, detailStartRow);

  let r = detailStartRow + 1;
  for (const t of transactions) {
    const row = detailSheet.getRow(r);
    row.values = {
      date: t.transaction_date,
      description: t.description ?? '',
      notes: t.notes ?? '',
      debit: t.debit_account ? `${t.debit_account.account_number} — ${t.debit_account.account_name}` : '',
      credit: t.credit_account ? `${t.credit_account.account_number} — ${t.credit_account.account_name}` : '',
      amount: Number(t.amount),
      serviceLine: t.product_line?.service_line ?? '',
      department: t.product_line?.department ?? '',
      product: t.product_line?.product_name ?? '',
      vendor: t.vendor?.vendor_name ?? '',
      deductible: t.is_tax_deductible === null ? '' : t.is_tax_deductible ? 'Yes' : 'No',
      status: t.status,
    };
    row.getCell('amount').numFmt = '$#,##0.00';
    row.getCell('amount').font = { name: FONT, size: 10 };
    r += 1;
  }
  zebraStripe(detailSheet, detailStartRow + 1, r - 1, columns.length);

  await downloadWorkbook(workbook, `${filenamePrefix}-${startDate}-to-${endDate}.xlsx`);
}
