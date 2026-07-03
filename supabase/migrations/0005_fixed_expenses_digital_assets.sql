-- DDP Bookkeeping: expense restructure for the Trends report.
-- Adds a "Digital Assets / SaaS" account, a "Payroll" account, and
-- reclassifies Taxes into a new 'fixed_expense' account_class so Trends can
-- report Operating Expenses and Fixed Expenses as separate sections.

-- ---------------------------------------------------------------------------
-- Backfill for users who already signed up before this migration
-- ---------------------------------------------------------------------------
insert into chart_of_accounts (user_id, account_number, account_name, account_type, account_class, normal_balance)
select id, '6011', 'Digital Assets / SaaS', 'expense', 'operating_expense', 'debit' from users
on conflict (user_id, account_number) do nothing;

insert into chart_of_accounts (user_id, account_number, account_name, account_type, account_class, normal_balance)
select id, '6050', 'Payroll', 'expense', 'fixed_expense', 'debit' from users
on conflict (user_id, account_number) do nothing;

update chart_of_accounts set account_class = 'fixed_expense' where account_number = '6040';

insert into expense_categories (user_id, category_name, category_code, is_tax_deductible, tax_line_item, description)
select id, 'Digital Assets / SaaS', 'digital_assets_saas', true, '27a. Other expenses',
  'Cloud infrastructure and dev-tool subscriptions that run the business -- Supabase, GitHub, OpenAI API, Vercel, etc.'
from users
on conflict (user_id, category_code) do nothing;

-- ---------------------------------------------------------------------------
-- Update the signup seed so future users get this template from day one
-- ---------------------------------------------------------------------------
create or replace function seed_new_user_defaults(p_user_id uuid)
returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into product_lines (user_id, service_line, department, product_name, product_slug)
  values
    (p_user_id, 'Digital', 'Mobile Applications', 'DinkUp', 'dinkup'),
    (p_user_id, 'Digital', 'Mobile Applications', 'EverydayBible', 'everydaybible'),
    (p_user_id, 'Digital', 'Mobile Applications', 'AppealPath', 'appealpath'),
    (p_user_id, 'Digital', 'Web Based', 'DDP Bookkeeping', 'ddp-bookkeeping'),
    (p_user_id, 'Publishing', null, 'KDP Publishing', 'kdp-publishing');

  insert into chart_of_accounts (user_id, account_number, account_name, account_type, account_class, normal_balance)
  values
    -- Assets
    (p_user_id, '1000', 'Cash in Bank', 'asset', 'current_asset', 'debit'),
    (p_user_id, '1010', 'Accounts Receivable', 'asset', 'current_asset', 'debit'),
    (p_user_id, '1500', 'Equipment', 'asset', 'fixed_asset', 'debit'),
    -- Liabilities
    (p_user_id, '2000', 'Accounts Payable', 'liability', 'current_liability', 'credit'),
    (p_user_id, '2010', 'Credit Card', 'liability', 'current_liability', 'credit'),
    (p_user_id, '2500', 'Loans', 'liability', 'long_term_liability', 'credit'),
    -- Equity
    (p_user_id, '3000', 'Owner''s Capital', 'equity', 'equity', 'credit'),
    (p_user_id, '3010', 'Retained Earnings', 'equity', 'equity', 'credit'),
    -- Revenue
    (p_user_id, '4000', 'Product Sales (Digital)', 'revenue', 'operating_revenue', 'credit'),
    (p_user_id, '4010', 'Product Sales (Publishing)', 'revenue', 'operating_revenue', 'credit'),
    (p_user_id, '4020', 'Services', 'revenue', 'operating_revenue', 'credit'),
    (p_user_id, '4900', 'Other Income', 'revenue', 'other_revenue', 'credit'),
    -- Expenses: operating
    (p_user_id, '5000', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', 'debit'),
    (p_user_id, '6000', 'Operating Expenses', 'expense', 'operating_expense', 'debit'),
    (p_user_id, '6010', 'Marketing', 'expense', 'operating_expense', 'debit'),
    (p_user_id, '6011', 'Digital Assets / SaaS', 'expense', 'operating_expense', 'debit'),
    (p_user_id, '6020', 'Professional Services', 'expense', 'operating_expense', 'debit'),
    (p_user_id, '6030', 'Supplies', 'expense', 'operating_expense', 'debit'),
    -- Expenses: fixed
    (p_user_id, '6040', 'Taxes', 'expense', 'fixed_expense', 'debit'),
    (p_user_id, '6050', 'Payroll', 'expense', 'fixed_expense', 'debit');

  insert into expense_categories (user_id, category_name, category_code, is_tax_deductible, tax_line_item, description)
  values
    (p_user_id, 'Office Supplies', 'office_supplies', true, '22. Supplies',
      'Items under $500 that enable your work -- pens, ink, software, monitors, desk organizers. The IRS does not scrutinize this category if you have receipts.'),
    (p_user_id, 'Software Subscriptions', 'software_subscriptions', true, '27a. Other expenses',
      'SaaS tools, design software, AI tools -- anything you pay monthly/annually to run the business.'),
    (p_user_id, 'Digital Assets / SaaS', 'digital_assets_saas', true, '27a. Other expenses',
      'Cloud infrastructure and dev-tool subscriptions that run the business -- Supabase, GitHub, OpenAI API, Vercel, etc.'),
    (p_user_id, 'Website Hosting', 'website_hosting', true, '27a. Other expenses',
      'Hosting, CDN, and server costs for business sites and apps.'),
    (p_user_id, 'Domain Registration', 'domain_registration', true, '27a. Other expenses',
      'Domain name purchases and renewals.'),
    (p_user_id, 'Marketing & Advertising', 'marketing_advertising', true, '8. Advertising',
      'Ads, promo, sponsorships, and anything spent to acquire customers.'),
    (p_user_id, 'Professional Services', 'professional_services', true, '17. Legal and professional services',
      'Accountants, lawyers, consultants, contractors.'),
    (p_user_id, 'Equipment (< $2,500)', 'equipment_under_2500', true, '13. Depreciation and section 179 expense deduction',
      'Most solo self-employed deduct equipment under $2,500 fully in the year purchased (Section 179) -- defensible with a receipt and business-purpose note.'),
    (p_user_id, 'Meals & Entertainment', 'meals_entertainment', true, '24b. Deductible meals',
      '50% deductible by default -- flagged for manual review since the exact business-meal rules vary by situation.'),
    (p_user_id, 'Travel', 'travel', true, '24a. Travel',
      'Flights, hotels, and transportation for business purposes.'),
    (p_user_id, 'Phone & Internet', 'phone_internet', true, '27a. Other expenses',
      'Deduct the business-use percentage of your phone and internet bill.'),
    (p_user_id, 'Personal Expenses', 'personal_expenses', false, null,
      'Not deductible. Use this category to explicitly mark personal spending so it never leaks into your P&L.');
end;
$$;
