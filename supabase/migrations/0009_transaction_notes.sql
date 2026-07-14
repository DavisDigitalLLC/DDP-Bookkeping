-- DDP Bookkeeping: free-text note per transaction -- for documenting
-- business purpose (per the deduction guides' advice: "receipt + a note
-- like 'MacBook Pro for app development'" is what makes a deduction
-- defensible). Separate from description, which is the short label shown
-- everywhere; notes are the longer justification, shown on demand.

alter table transactions add column notes text;
