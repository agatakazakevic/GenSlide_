const hasNumeric = (text = '') => /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?/g.test(text);

export const evidenceQaAgent = ({ slotContent = {}, evidence = [] }) => {
  const issues = [];
  const numericSlots = Object.values(slotContent).filter((text) => hasNumeric(text));
  if (numericSlots.length && evidence.length === 0) {
    issues.push('Numeric claims present without evidence');
  }
  return { issues, score: Math.max(0, 100 - issues.length * 15) };
};
