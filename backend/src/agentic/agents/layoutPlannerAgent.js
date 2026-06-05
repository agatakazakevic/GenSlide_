import { getPatternForIntent } from '../data/patternLibrary.js';

export const layoutPlannerAgent = ({ slide }) => {
  const pattern = getPatternForIntent(slide.intent);
  const slots = pattern.slots.map((slot) => ({ ...slot }));
  const dominant = pattern.dominant || { type: 'structure', area: 0.6 };
  const textBudget = slots
    .filter((slot) => typeof slot.maxChars === 'number')
    .reduce((sum, slot) => sum + slot.maxChars, 0);

  return {
    slide_id: slide.id,
    layout_pattern_id: pattern.id,
    dominant,
    slots,
    text_budget: textBudget,
  };
};
