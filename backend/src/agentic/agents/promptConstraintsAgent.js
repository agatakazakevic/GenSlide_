const DEFAULT_CONSTRAINTS = {
  audience: 'exec',
  tone: 'neutral',
  slide_count: 10,
  brand: { fonts: [], colors: [], logo: '' },
  style_rules: {
    no_bullets_default: true,
    max_text_chars: 450,
  },
};

const extractSlideCount = (prompt = '') => {
  const match = prompt.match(/(\d+)\s*slides?/i) || prompt.match(/slides?\s*(\d+)/i);
  if (match) return Number(match[1]);
  return null;
};

const inferAudience = (prompt = '') => {
  const lower = prompt.toLowerCase();
  if (lower.includes('technical') || lower.includes('engineer')) return 'technical';
  if (lower.includes('sales') || lower.includes('revenue')) return 'sales';
  if (lower.includes('exec') || lower.includes('board')) return 'exec';
  return 'exec';
};

const inferTone = (prompt = '') => {
  const lower = prompt.toLowerCase();
  if (lower.includes('bold')) return 'bold';
  if (lower.includes('formal')) return 'formal';
  return 'neutral';
};

export const promptConstraintsAgent = (payload = {}) => {
  const prompt = payload.userPrompt || '';
  const inferredCount = extractSlideCount(prompt);
  const slideCount = Number(payload.slideCount || inferredCount || DEFAULT_CONSTRAINTS.slide_count);

  return {
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      audience: payload.audience || inferAudience(prompt),
      tone: payload.tone || inferTone(prompt),
      slide_count: slideCount,
      brand: payload.brand || DEFAULT_CONSTRAINTS.brand,
      style_rules: {
        ...DEFAULT_CONSTRAINTS.style_rules,
        ...(payload.style_rules || {}),
      },
    },
  };
};
