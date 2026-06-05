export const PATTERN_LIBRARY = {
  title_hero: {
    id: 'title_hero',
    dominant: { type: 'title', area: 0.6 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'subtitle', type: 'subtitle', maxChars: 90 },
      { id: 'caption', type: 'caption', maxChars: 80 },
    ],
  },
  section_divider: {
    id: 'section_divider',
    dominant: { type: 'title', area: 0.6 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'subtitle', type: 'subtitle', maxChars: 90 },
    ],
  },
  chart_full_with_callouts: {
    id: 'chart_full_with_callouts',
    dominant: { type: 'chart', area: 0.7 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'chart', type: 'chart', chartType: 'bar' },
      { id: 'callout1', type: 'callout', maxChars: 110 },
      { id: 'callout2', type: 'callout', maxChars: 110 },
    ],
  },
  chart_left_insights_right: {
    id: 'chart_left_insights_right',
    dominant: { type: 'chart', area: 0.6 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'chart', type: 'chart', chartType: 'line' },
      { id: 'insight1', type: 'callout', maxChars: 110 },
      { id: 'insight2', type: 'callout', maxChars: 110 },
      { id: 'insight3', type: 'callout', maxChars: 110 },
    ],
  },
  table_full_emphasis_column: {
    id: 'table_full_emphasis_column',
    dominant: { type: 'table', area: 0.7 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'table', type: 'table' },
      { id: 'caption', type: 'caption', maxChars: 80 },
    ],
  },
  process_flow_horizontal_5_steps: {
    id: 'process_flow_horizontal_5_steps',
    dominant: { type: 'diagram', area: 0.65 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'step1', type: 'step', maxChars: 60 },
      { id: 'step2', type: 'step', maxChars: 60 },
      { id: 'step3', type: 'step', maxChars: 60 },
      { id: 'step4', type: 'step', maxChars: 60 },
      { id: 'step5', type: 'step', maxChars: 60 },
    ],
  },
  roadmap_timeline_3_phases: {
    id: 'roadmap_timeline_3_phases',
    dominant: { type: 'timeline', area: 0.65 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'phase1', type: 'phase', maxChars: 80 },
      { id: 'phase2', type: 'phase', maxChars: 80 },
      { id: 'phase3', type: 'phase', maxChars: 80 },
    ],
  },
  kpi_cards_3up: {
    id: 'kpi_cards_3up',
    dominant: { type: 'metric_cards', area: 0.6 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'kpi1', type: 'kpi', maxChars: 40 },
      { id: 'kpi2', type: 'kpi', maxChars: 40 },
      { id: 'kpi3', type: 'kpi', maxChars: 40 },
    ],
  },
  comparison_matrix_2x3: {
    id: 'comparison_matrix_2x3',
    dominant: { type: 'comparison', area: 0.65 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'left_header', type: 'label', maxChars: 30 },
      { id: 'right_header', type: 'label', maxChars: 30 },
      { id: 'row1_left', type: 'compare_cell', maxChars: 70 },
      { id: 'row1_right', type: 'compare_cell', maxChars: 70 },
      { id: 'row2_left', type: 'compare_cell', maxChars: 70 },
      { id: 'row2_right', type: 'compare_cell', maxChars: 70 },
      { id: 'row3_left', type: 'compare_cell', maxChars: 70 },
      { id: 'row3_right', type: 'compare_cell', maxChars: 70 },
    ],
  },
  icon_row_3to5_features: {
    id: 'icon_row_3to5_features',
    dominant: { type: 'icon_row', area: 0.55 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'feature1', type: 'feature', maxChars: 60 },
      { id: 'feature2', type: 'feature', maxChars: 60 },
      { id: 'feature3', type: 'feature', maxChars: 60 },
      { id: 'feature4', type: 'feature', maxChars: 60 },
      { id: 'feature5', type: 'feature', maxChars: 60 },
    ],
  },
  two_column_image_left_text_right: {
    id: 'two_column_image_left_text_right',
    dominant: { type: 'image', area: 0.55 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'image', type: 'image' },
      { id: 'body', type: 'body', maxChars: 140 },
    ],
  },
  two_column_text_left_image_right: {
    id: 'two_column_text_left_image_right',
    dominant: { type: 'image', area: 0.55 },
    slots: [
      { id: 'title', type: 'title', maxChars: 60 },
      { id: 'body', type: 'body', maxChars: 140 },
      { id: 'image', type: 'image' },
    ],
  },
};

export const INTENT_TO_PATTERN = {
  title: 'title_hero',
  section: 'section_divider',
  market: 'chart_full_with_callouts',
  compare: 'comparison_matrix_2x3',
  proof: 'chart_left_insights_right',
  roadmap: 'roadmap_timeline_3_phases',
  workflow: 'process_flow_horizontal_5_steps',
  metrics: 'kpi_cards_3up',
  overview: 'icon_row_3to5_features',
  problem: 'two_column_text_left_image_right',
  solution: 'two_column_image_left_text_right',
  data: 'table_full_emphasis_column',
};

export const getPatternById = (id) => PATTERN_LIBRARY[id] || null;

export const getPatternForIntent = (intent) => {
  const key = String(intent || '').toLowerCase();
  return PATTERN_LIBRARY[INTENT_TO_PATTERN[key]] || PATTERN_LIBRARY.title_hero;
};
