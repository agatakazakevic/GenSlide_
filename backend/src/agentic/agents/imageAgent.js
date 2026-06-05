export const imageAgent = ({ slide, layoutPlan }) => {
  const imageSlots = layoutPlan.slots.filter((slot) => slot.type === 'image');
  return imageSlots.map((slot) => ({
    slotId: slot.id,
    brief: `Image for ${slide.intent} slide`,
    status: 'placeholder',
  }));
};
