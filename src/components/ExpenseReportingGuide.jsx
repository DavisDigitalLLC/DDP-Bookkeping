import { useState } from 'react';
import { Link } from 'react-router-dom';

const QUICK_REFERENCE = [
  { type: 'Software / SaaS tools', account: '6000 Operating Expenses', category: 'Software Subscriptions', line: '27a' },
  { type: 'Website hosting', account: '6000 Operating Expenses', category: 'Website Hosting', line: '27a' },
  { type: 'Domain renewals', account: '6000 Operating Expenses', category: 'Domain Registration', line: '27a' },
  { type: 'Ads, promo, sponsorships', account: '6010 Marketing', category: 'Marketing & Advertising', line: '8' },
  { type: 'Accountant, lawyer, contractor', account: '6020 Professional Services', category: 'Professional Services', line: '17' },
  { type: 'Office supplies, small equipment', account: '6030 Supplies', category: 'Office Supplies / Equipment (<$2,500)', line: '22 / 13' },
  { type: 'Flights, hotels, ground transport', account: '6000 Operating Expenses*', category: 'Travel', line: '24a' },
  { type: 'Meals while traveling or with clients', account: '6000 Operating Expenses*', category: 'Meals & Entertainment', line: '24b (50%)' },
  { type: 'Phone / internet (business %)', account: '6000 Operating Expenses', category: 'Phone & Internet', line: '27a' },
  { type: 'Personal spending (never deductible)', account: 'n/a -- don\'t post to the business', category: 'Personal Expenses', line: '—' },
];

export default function ExpenseReportingGuide() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>How to categorize an expense</h3>
          <p className="tooltip-hint" style={{ marginTop: 0 }}>
            Quick reference for the two fields every expense needs, and which one to pick for common cases.
          </p>
        </div>
        <button type="button" className="secondary" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Collapse' : 'Read guide'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <h4>Two separate choices, not one</h4>
            <ul>
              <li>
                <strong>Expense account</strong> (required) -- which GL bucket it hits on your P&amp;L and Trends,
                e.g. "6010 Marketing." This is what makes your reports show spending by category.
              </li>
              <li>
                <strong>Deduction category</strong> (optional) -- tags the transaction for tax purposes: is it
                deductible, how much (some categories, like meals, are only 50%), and which line of Schedule C it
                maps to on export.
              </li>
            </ul>
            <p className="tooltip-hint">
              You always need both to get useful reports and a clean tax export -- picking a Deduction category
              doesn't set the Expense account for you, and vice versa.
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h4>Quick reference</h4>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Expense type</th>
                    <th>Expense account (GL)</th>
                    <th>Deduction category</th>
                    <th>Schedule C line</th>
                  </tr>
                </thead>
                <tbody>
                  {QUICK_REFERENCE.map((row) => (
                    <tr key={row.type}>
                      <td>{row.type}</td>
                      <td>{row.account}</td>
                      <td>{row.category}</td>
                      <td>{row.line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tooltip-hint">
              * Travel and Meals don't have dedicated GL accounts yet in your Chart of Accounts (unlike Marketing,
              Professional Services, and Supplies, which each have their own) -- they currently land in the generic
              6000 Operating Expenses bucket. Add dedicated accounts under Manage → Chart of Accounts if you want
              them to show up as their own line in Trends instead of being lumped in with everything else.
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h4>Which entry mode to use</h4>
            <ul>
              <li>
                <strong>Single line</strong> -- the normal case: one payment, one account, one product line (or
                Unassigned/Overhead if it's not tied to a specific product).
              </li>
              <li>
                <strong>Split evenly across product lines</strong> -- one payment, one account, but the cost is
                shared across multiple products (e.g. an API bill used by three apps). Divides the amount evenly,
                to the cent.
              </li>
              <li>
                <strong>Itemize across multiple accounts</strong> -- one payment that actually covers different
                kinds of expenses with independent amounts (e.g. an LLC formation invoice covering both a filing
                fee and a domain purchase). Each line gets its own account, amount, and product.
              </li>
            </ul>
          </div>

          <div className="card" style={{ background: 'var(--ddp-soft-gray)', boxShadow: 'none' }}>
            <h4 style={{ marginTop: 0 }}>Vendor and Product line, briefly</h4>
            <ul style={{ marginBottom: 0 }}>
              <li>
                <strong>Vendor</strong> -- who you paid. Pick an existing one or type a new one; it groups spending
                by vendor in Trends and stays linked even if you rename the vendor later.
              </li>
              <li>
                <strong>Product line</strong> -- which app/book/service the cost supports. Leave it Unassigned /
                Overhead for entity-level costs (like LLC formation) that don't belong to any one product.
              </li>
            </ul>
          </div>

          <p className="tooltip-hint" style={{ marginTop: 16, marginBottom: 0 }}>
            For the tax-specific rules behind each category (what's defensible, what's a gray area, common
            strategies), see the full <Link to="/guides">Deduction Guides</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
