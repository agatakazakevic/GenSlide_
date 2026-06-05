const countChars = (value) => (value ? String(value).length : 0);

export const layoutQaAgent = ({ layoutPlan, slotContent, constraints, slideIntent }) => {
  const issues = [];
  if (!layoutPlan?.dominant?.type && slideIntent !== 'title') {
    issues.push('Missing dominant visual');
  }

  let totalChars = 0;
  layoutPlan.slots.forEach((slot) => {
    const text = slotContent?.[slot.id];
    if (typeof slot.maxChars === 'number' && text && text.length > slot.maxChars) {
      issues.push(`Slot ${slot.id} exceeds budget`);
    }
    totalChars += countChars(text);
  });

  if (constraints?.style_rules?.max_text_chars && totalChars > constraints.style_rules.max_text_chars) {
    issues.push('Slide text density too high');
  }

  return { issues, score: Math.max(0, 100 - issues.length * 10) };
};
