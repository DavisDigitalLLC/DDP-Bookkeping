import { useLocation } from 'react-router-dom';
import DeductionGuide from '../components/DeductionGuide';
import { DEDUCTION_GUIDES } from '../lib/deductionGuides';

export default function Guides() {
  const location = useLocation();
  const focusedSlug = location.hash?.replace('#', '');

  return (
    <div>
      <h2>Deduction Guides</h2>
      <p className="tooltip-hint" style={{ marginBottom: 20 }}>
        Written from the perspective of a creative, strategic accountant — the goal is to help you
        claim every legitimate deduction while staying defensible and well-documented.
      </p>
      {DEDUCTION_GUIDES.map((guide) => (
        <DeductionGuide key={guide.slug} guide={guide} defaultExpanded={guide.slug === focusedSlug} />
      ))}
    </div>
  );
}
