// Deduction guides written in the "creative, strategic accountant" voice from
// the project spec (Section 3): help solo self-employed users maximize
// legitimate deductions while staying defensible and well-documented.

export const DEDUCTION_GUIDES = [
  {
    slug: 'office-supplies',
    title: 'Office Supplies & Equipment',
    categoryCodes: ['office_supplies', 'equipment_under_2500', 'software_subscriptions'],
    summary:
      'Most day-to-day tools of the trade are clearly deductible. The gray area is bigger-ticket furniture and equipment — and it is more defensible than you might think.',
    sections: [
      {
        heading: 'Clearly deductible',
        items: [
          'Pens, paper, notebooks, printer ink',
          'Desk lamp, monitor, keyboard, mouse (~$200-500 items)',
          'Software subscriptions (Adobe, Figma, Notion, ChatGPT, design tools)',
          'Website hosting, domain names',
          'Cloud storage used for business',
          'USB drives, cables, desk organizers',
        ],
      },
      {
        heading: 'Gray area (context-dependent)',
        items: [
          'Furniture ($300-1500 desk or chair) — Conservative: classify as equipment, depreciate over years. Creative: bundle as "office setup," deduct in one year if under $2,500. Defensible if you have a receipt, a clear business purpose, and consistent treatment year over year.',
          'Standing desk ($600) — Conservative: equipment, depreciate. Creative: office ergonomic expense for home-office health/productivity. Reality: the IRS rarely scrutinizes purchases under $500 if receipts exist.',
          'New computer/tablet ($1,500) — Under $2,500: can be immediately expensed (Section 179) or depreciated. Over $2,500: depreciate over 5 years. Most solo self-employed deduct fully if under $2,500 — defensible.',
        ],
      },
      {
        heading: 'Not deductible',
        items: [
          'Personal furniture (couch, bed) unless in a dedicated office',
          'Decorations, artwork',
          'Anything already deducted elsewhere — don’t double-dip',
        ],
      },
    ],
    strategyTips: [
      'Bundle purchases: desk ($800) + monitor ($400) + keyboard ($200) + light ($150) + storage ($450) = call it "office equipment setup" ($2,000), not a list of individual big purchases. Keeps each item defensibly small; the total is reasonable for a business investment.',
      'Document purpose and amount: receipt + a note like "MacBook Pro for app development (DDP Bookkeeping + AppealPath)." Specificity is what makes something defensible.',
      'Consistency over time: whatever method you use in year one, use it in year two unless circumstances genuinely change. The IRS wants to see a coherent system, not random swings.',
    ],
    defensibilityChecklist: [
      'Is there a business purpose? (Can you explain why you need this?)',
      'Do you have a receipt? (A screenshot or saved email is fine.)',
      'Is the amount reasonable relative to your revenue?',
      'Is it consistent with how you treated similar items last year?',
    ],
  },
  {
    slug: 'home-office',
    title: 'Home Office',
    categoryCodes: ['phone_internet'],
    summary:
      'The strict textbook rule ("a dedicated, isolated room") is more conservative than what actually holds up. A consistently-used corner of a room is defensible.',
    sections: [
      {
        heading: 'Clearly deductible',
        items: [
          'A room used exclusively and regularly for business',
          'The business-use percentage of internet and phone service',
        ],
      },
      {
        heading: 'Gray area (context-dependent)',
        items: [
          'A dedicated corner of a bedroom or living room used exclusively for work — technically not a "separate room," but defensible if the space is consistently used only for business and you can show it (a photo helps).',
          'Simplified method ($5/sq ft, up to 300 sq ft) requires zero receipts. Actual-expense method requires documentation but can save more if your utilities/rent are high — run both once and pick whichever wins, then stay consistent.',
        ],
      },
      {
        heading: 'Not deductible',
        items: [
          'Shared spaces used for both personal and business purposes without a consistent, exclusive-use pattern',
          'A home office deduction claimed against W-2 employment (self-employment only)',
        ],
      },
    ],
    strategyTips: [
      'Pick a method (simplified or actual) in year one and stick with it — switching every year is the pattern that draws scrutiny, not the deduction itself.',
      'If you use actual expenses, keep utility bills and a simple square-footage calculation on file. That is the whole audit trail.',
      'A quick dated photo of the workspace costs nothing and is strong evidence of exclusive use if it is ever questioned.',
    ],
    defensibilityChecklist: [
      'Is the space used regularly and (as much as practical) exclusively for business?',
      'Have you picked one calculation method and used it consistently?',
      'Do you have the underlying numbers on file (square footage, or utility bills for actual-expense)?',
      'Is the deduction proportional to your home and your business size?',
    ],
  },
  {
    slug: 'vehicle-mileage',
    title: 'Vehicle Mileage',
    categoryCodes: ['travel'],
    summary:
      'Client meetings and business travel are clearly deductible. The edge cases (coffee shops, supply runs) sort themselves out if your overall mileage pattern is reasonable and logged.',
    sections: [
      {
        heading: 'Clearly deductible',
        items: [
          'Driving to client meetings, conferences, or business-related appointments',
          'Supply runs and business errands',
          'Standard mileage rate ($0.67/mile for 2024) or actual vehicle expenses — pick whichever method is better and stay consistent',
        ],
      },
      {
        heading: 'Gray area (context-dependent)',
        items: [
          'Home office to a coffee shop to work — defensible if you are meeting a client or working a specific client project there. If it is just "working nearby" with no client tie, that is a commute, not a deduction.',
          'Mixed-purpose trips (business errand + personal stop) — deduct only the business-mileage portion; a simple log note is enough.',
        ],
      },
      {
        heading: 'Not deductible',
        items: [
          'Regular commuting between home and a fixed place of business',
          'Personal errands with no business purpose, even if done "while out" for work',
        ],
      },
    ],
    strategyTips: [
      'Keep a simple mileage log (date, destination, business purpose, miles) — an app or even a spreadsheet is fine. This is the single biggest factor in whether mileage deductions survive scrutiny.',
      'Run both the standard mileage rate and actual expense method once to see which is better for your situation, then commit to one method for that vehicle going forward.',
      'Log the clear-cut trips diligently; do not stress over the rare ambiguous one — a reasonable overall pattern is what matters, not perfection on every entry.',
    ],
    defensibilityChecklist: [
      'Do you have a contemporaneous log (date, purpose, miles) rather than a year-end estimate?',
      'Is each trip tied to an identifiable business purpose?',
      'Have you picked one calculation method (standard or actual) for the year?',
      'Is your total business-mileage percentage reasonable for the type of work you do?',
    ],
  },
  {
    slug: 'business-travel',
    title: `Business Travel (Flights, Hotels, Meals on the Road)`,
    categoryCodes: ['travel'],
    summary: `Overnight and out-of-town trips are a different animal than local mileage -- the deductibility test is whether the trip's primary purpose is business, not whether every minute of it was.`,
    sections: [
      {
        heading: `Clearly deductible`,
        items: [
          `Airfare, train, or other transportation to a business destination`,
          `Lodging for the nights required by the business purpose`,
          `Meals while traveling for business -- deductible at 50% (not 100%, unlike some in-town client meals in certain years)`,
          `Conference/event registration fees, taxis or rideshares at the destination`,
          `Baggage fees, wifi on the plane, parking at the airport`,
        ],
      },
      {
        heading: `Gray area (context-dependent)`,
        items: [
          `Extending a business trip for a few personal days -- the transportation cost (flight) is still fully deductible if the trip's primary purpose was business; lodging/meals for the personal extension days are not. Split the invoice, don't guess.`,
          `Bringing a spouse or family member -- their travel/lodging costs are not deductible unless they have an independent, bona fide business purpose for being there (rare). Yours still is.`,
          `A trip that mixes client visits with scouting future business opportunities -- defensible as long as the primary purpose (the majority of days/activity) is business, documented with a simple itinerary.`,
        ],
      },
      {
        heading: `Not deductible`,
        items: [
          `A vacation with a token, unrelated "business call" squeezed in`,
          `Lodging/meals for days with no business activity, tacked onto a work trip`,
          `Any portion of travel that is primarily for personal enjoyment`,
        ],
      },
    ],
    strategyTips: [
      `Keep the itinerary: dates, destination, and the specific business purpose of each day. This one document is what separates a defensible trip from a red flag.`,
      `If a trip is mixed business/personal, allocate transportation by the "primary purpose" test (was more than half the trip business?) and allocate lodging/meals day-by-day rather than trying to average it.`,
      `Book the business and personal legs as separate line items when possible (e.g. a side excursion) so the receipt itself already shows the split.`,
    ],
    defensibilityChecklist: [
      `Was the primary purpose of the trip business, not personal?`,
      `Do you have an itinerary or calendar showing what business happened on each day?`,
      `Have you excluded lodging/meals for purely personal days within a mixed trip?`,
      `Are meals logged at 50%, not 100%?`,
    ],
  },
  {
    slug: 'vehicles',
    title: `Vehicles (Buying, Leasing, and Depreciation)`,
    categoryCodes: ['travel'],
    summary: `Different from day-to-day mileage logging -- this is about the vehicle itself: how you deduct the cost of owning or leasing the car you use for business.`,
    sections: [
      {
        heading: `Clearly deductible`,
        items: [
          `The business-use percentage of a vehicle's costs, whichever method you choose: standard mileage rate, or actual expenses (gas, insurance, repairs, depreciation) prorated by business-use %`,
          `Lease payments, prorated by business-use %, if you lease rather than buy`,
          `Section 179 / bonus depreciation on a vehicle purchase, up to IRS luxury-auto limits, in the year placed in service -- if you use actual expenses (not standard mileage)`,
        ],
      },
      {
        heading: `Gray area (context-dependent)`,
        items: [
          `Buying a heavier vehicle (SUV/truck over 6,000 lbs GVWR) -- these are exempt from the stricter "luxury auto" depreciation caps and can often be expensed much more aggressively in year one. Legitimate and common, but the vehicle needs a real, substantiated business-use percentage, not just a technicality.`,
          `Switching from standard mileage to actual expenses (or vice versa) between vehicles or years -- allowed, but once you've used actual-expense depreciation on a specific vehicle, you generally can't go back to standard mileage for that same vehicle. Decide once, per vehicle, on purpose.`,
          `Business-use percentage below 50% -- still deductible proportionally, but locks you out of Section 179 and accelerated depreciation on that vehicle; only straight-line depreciation applies.`,
        ],
      },
      {
        heading: `Not deductible`,
        items: [
          `The personal-use percentage of any vehicle expense, full stop`,
          `A vehicle bought primarily for personal use with occasional business trips claimed at an inflated business-use percentage`,
        ],
      },
    ],
    strategyTips: [
      `Decide standard-mileage vs. actual-expenses per vehicle in the first year you use it for business, and treat that as a one-way door -- switching later (especially away from actual expenses once you've depreciated it) is where deductions get disallowed.`,
      `A written, contemporaneous business-use percentage (from your mileage log, not a year-end guess) is what makes vehicle depreciation defensible -- it is one of the most-scrutinized areas in a solo-business audit.`,
      `If a vehicle purchase is large and business-use is genuinely high, talk through Section 179 vs. bonus depreciation vs. standard mileage with a CPA before filing -- the right call depends on this year's income and next year's plans, not just this year's tax bill.`,
    ],
    defensibilityChecklist: [
      `Do you have a real, logged business-use percentage for this vehicle (not an estimate)?`,
      `Have you picked one method (standard mileage or actual expenses) for this vehicle and stuck with it?`,
      `If you used Section 179 or bonus depreciation, is the business-use percentage over 50% and documented?`,
      `Are personal miles/costs clearly excluded, not blended in?`,
    ],
  },
  {
    slug: 'filing-llc-taxes',
    title: `Filing Taxes for Your LLC -- The Complete Picture`,
    categoryCodes: [],
    summary: `A single-member LLC is taxed as a sole proprietorship by default (Schedule C on your personal return) unless you've elected S-corp or C-corp treatment. This is the checklist-level view of what filing actually involves, not just the deductions.`,
    sections: [
      {
        heading: `What you need before you file`,
        items: [
          `Your EIN (even though a single-member LLC can technically use your SSN, most banks and 1099 issuers will have used the EIN -- make sure it matches everywhere)`,
          `Every 1099-NEC and 1099-K you received (Amazon KDP, payment processors, clients) -- the IRS gets copies too, so your reported revenue needs to reconcile against them, not just against your own books`,
          `A complete profit & loss for the year -- this is exactly what the Tax Export in this app is built to produce, pulling from every posted transaction`,
          `Your mileage log, if you're deducting vehicle use`,
          `Home-office square footage (or your prior simplified-method election) if claiming that deduction`,
          `Total self-employed health insurance premiums paid for the year, if applicable -- this is an adjustment to income, not a Schedule C line item`,
          `Retirement contributions made as the business owner (SEP-IRA, Solo 401(k)) -- also an above-the-line adjustment`,
          `Last year's return, for consistency on depreciation methods, carryforward losses, and estimated-payment history`,
        ],
      },
      {
        heading: `Best practices`,
        items: [
          `Pay quarterly estimated taxes (this app's Trends/Dashboard already estimates them) -- underpayment penalties are calculated quarter by quarter, not smoothed out at year-end, so "I'll just pay it all in April" costs real money.`,
          `Keep business and personal banking completely separate -- mixing them is the single biggest reason a legitimate LLC deduction gets challenged (it becomes a documentation problem, not a legality problem).`,
          `Reconcile monthly (Bank Reconciliation + Month-End Close in this app), not once a year -- errors and missing receipts are exponentially easier to fix within 30 days than within 11 months.`,
          `Keep records for at least 3 years (the standard audit window), 6 years if you might have understated income by 25%+, indefinitely if a loss/carryforward is involved.`,
          `File on time even if you can't pay in full -- the failure-to-file penalty is much steeper than the failure-to-pay penalty.`,
        ],
      },
      {
        heading: `Claiming a loss`,
        items: [
          `A loss is completely normal in a startup or slow year and is not, by itself, an audit trigger -- but claiming a loss year after year (3+ consecutive years) invites the IRS "hobby loss" test: are you running this to make a profit, or is it a hobby with a tax write-off attached?`,
          `The 9-factor hobby-loss test looks at things like: do you keep real books (yes, if you're using this app), have you changed methods to improve profitability, do you have relevant expertise, and how much time do you put in. No single factor is disqualifying -- the pattern matters.`,
          `A Schedule C loss generally offsets other income (a spouse's W-2 wages, investment income) on your personal return in the year it happens -- that is the main benefit of the sole-proprietor / LLC structure over a C-corp.`,
          `If losses exceed other income for the year, the excess becomes a Net Operating Loss (NOL) that can carry forward to offset future years' income (current law: no carryback, limited to 80% of future taxable income per year) -- worth tracking even if it doesn't help you this year.`,
        ],
      },
      {
        heading: `Gray areas and common strategies (legitimate, IRS-recognized)`,
        items: [
          `Augusta Rule (Section 280A(g)): rent your own home to your LLC for up to 14 days a year (board meetings, planning retreats) at a documented fair-market rate -- the LLC deducts it as a business expense, and you personally don't report the rental income at all. Needs a real rental agreement and a real business purpose (an actual meeting, not a formality).`,
          `Retirement contributions (SEP-IRA or Solo 401(k)): both reduce your taxable income and, notably, a Solo 401(k) can shelter significantly more than a SEP-IRA at the same income level once you count both the "employee" and "employer" sides of the contribution.`,
          `Self-employed health insurance deduction: premiums you pay for yourself (and family) reduce your income directly, separate from itemizing -- easy to miss since it isn't a Schedule C line item.`,
          `Hiring your own minor children: wages paid to your child for real work in the business are deductible to the LLC and, under certain thresholds, can be tax-free or very lightly taxed to the child -- but the work and pay must be real and reasonable for a child that age, with actual records (timesheets, a W-2 for them).`,
          `S-corp election once profit is consistently high: once net self-employment profit clears roughly $60-80k/year (rule of thumb, not a hard line), electing S-corp tax treatment can reduce self-employment tax by splitting income into a reasonable W-2 salary plus distributions not subject to SE tax. This is a real strategy, not a loophole, but it adds payroll complexity and needs a CPA to set the salary defensibly.`,
        ],
      },
      {
        heading: `Red flags to actively avoid`,
        items: [
          `Round-number expenses across the board (every category ending in 00) -- looks estimated, not tracked`,
          `Deductions that consistently exceed revenue by a large margin, with no plan or path to profitability`,
          `Claiming 100% business use on a vehicle or home office with no logged support`,
          `Reported revenue that doesn't reconcile against the 1099s issued to you`,
        ],
      },
    ],
    strategyTips: [
      `Run the Tax Export in this app before you file, not after -- it's built to hand your CPA (or you) a clean, reconciled P&L instead of a shoebox of receipts.`,
      `If you're close to the S-corp election threshold, have that conversation with a CPA in Q3 or Q4, not in March -- the election has deadlines and the salary-setting decision takes real analysis.`,
      `Treat quarterly estimated payments as a real bill, not optional -- underpayment penalties compound the same way credit card interest does.`,
    ],
    defensibilityChecklist: [
      `Does your reported revenue reconcile against every 1099 you received?`,
      `Is your business banking separate from personal, with a reconciled monthly close?`,
      `If claiming a loss, can you show real effort toward profitability (books, changed strategy, time invested)?`,
      `Are any "gray area" strategies (Augusta Rule, hiring family, S-corp) backed by real documentation, not just the tax benefit?`,
    ],
  },
];

export function findGuideForCategory(categoryCode) {
  return DEDUCTION_GUIDES.find((g) => g.categoryCodes.includes(categoryCode));
}
