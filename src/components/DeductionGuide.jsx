import { useState } from 'react';

export default function DeductionGuide({ guide, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="card" id={guide.slug}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>{guide.title}</h3>
          <p className="tooltip-hint" style={{ marginTop: 0 }}>{guide.summary}</p>
        </div>
        <button type="button" className="secondary" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Collapse' : 'Read guide'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          {guide.sections.map((section) => (
            <div key={section.heading} style={{ marginBottom: 16 }}>
              <h4>{section.heading}</h4>
              <ul>
                {section.items.map((item, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>{item}</li>
                ))}
              </ul>
            </div>
          ))}

          <div style={{ marginBottom: 16 }}>
            <h4>Strategy tips</h4>
            <ul>
              {guide.strategyTips.map((tip, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ background: 'var(--ddp-soft-gray)', boxShadow: 'none' }}>
            <h4 style={{ marginTop: 0 }}>Defensibility check</h4>
            <ul>
              {guide.defensibilityChecklist.map((item, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{item}</li>
              ))}
            </ul>
            <p className="tooltip-hint" style={{ marginBottom: 0 }}>
              If yes to all: you're defensible. Document it and move on.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
