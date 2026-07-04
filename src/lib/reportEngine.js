import ExcelJS from 'exceljs';
import { supabase } from './supabaseClient';

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

function styleHeaderRow(sheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F6F4F' } };
  row.alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Builds a formatted .xlsx (Summary + Detail sheets) from an already
 * date-and-filter-scoped transaction list, and triggers a browser download.
 * (Not a true macro-enabled .xlsm -- there's no macro content to justify
 * one; this gives the same formatting and opens identically in Excel.)
 */
export async function exportReportToXlsx(transactions, { startDate, endDate, filenamePrefix = 'DDP-Custom-Report' } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DDP Bookkeeping';
  workbook.created = new Date();

  // -----------------------------------------------------------------
  // Summary sheet: totals by account, by service line/product, by vendor
  // -----------------------------------------------------------------
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow([`DDP Bookkeeping -- Custom Report`]).font = { bold: true, size: 14 };
  summarySheet.addRow([`Period: ${startDate} through ${endDate}`]);
  summarySheet.addRow([`Generated: ${new Date().toLocaleString()}`]);
  summarySheet.addRow([]);

  const byAccount = new Map();
  const byProduct = new Map();
  const byVendor = new Map();

  const DEBIT_NORMAL_TYPES = new Set(['asset', 'expense']);

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
    const headerRow = summarySheet.addRow([title]);
    headerRow.font = { bold: true, size: 12 };
    const colHeaderRow = summarySheet.addRow([labelHeader, 'Total']);
    colHeaderRow.font = { bold: true };
    for (const [label, total] of [...entries.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
      const row = summarySheet.addRow([label, total]);
      row.getCell(2).numFmt = '$#,##0.00';
    }
    summarySheet.addRow([]);
  };

  addSummaryTable('By Account', byAccount, 'Account');
  addSummaryTable('By Product Line', byProduct, 'Service Line › Department › Product');
  if (byVendor.size) addSummaryTable('By Vendor', byVendor, 'Vendor');

  summarySheet.columns.forEach((col, i) => {
    col.width = i === 0 ? 40 : 16;
  });

  // -----------------------------------------------------------------
  // Detail sheet: every matching transaction, one row each
  // -----------------------------------------------------------------
  const detailSheet = workbook.addWorksheet('Detail');
  detailSheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Description', key: 'description', width: 32 },
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
  styleHeaderRow(detailSheet);

  for (const t of transactions) {
    detailSheet.addRow({
      date: t.transaction_date,
      description: t.description ?? '',
      debit: t.debit_account ? `${t.debit_account.account_number} — ${t.debit_account.account_name}` : '',
      credit: t.credit_account ? `${t.credit_account.account_number} — ${t.credit_account.account_name}` : '',
      amount: Number(t.amount),
      serviceLine: t.product_line?.service_line ?? '',
      department: t.product_line?.department ?? '',
      product: t.product_line?.product_name ?? '',
      vendor: t.vendor?.vendor_name ?? '',
      deductible: t.is_tax_deductible === null ? '' : t.is_tax_deductible ? 'Yes' : 'No',
      status: t.status,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${startDate}-to-${endDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
