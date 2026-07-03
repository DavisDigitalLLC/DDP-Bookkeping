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
];

export function findGuideForCategory(categoryCode) {
  return DEDUCTION_GUIDES.find((g) => g.categoryCodes.includes(categoryCode));
}
