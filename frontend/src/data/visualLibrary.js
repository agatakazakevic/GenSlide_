export const visualTemplates = [
  {
    id: 'cover-title-ntt',
    name: 'Cover Title (IR)',
    category: 'Cover',
    description: 'Minimal IR cover with logo, date, and large title.',
    fields: [
      { key: 'company', label: 'Company name', default: 'NTT' },
      { key: 'title', label: 'Main title', default: 'IR Presentation' },
      { key: 'date', label: 'Date', default: 'November, 2025' },
      { key: 'version', label: 'Version', default: 'Ver.2501101' },
      { key: 'footer', label: 'Footer text', default: '© Company, Inc. 2025' },
    ],
    prompt: `Create a minimal IR cover slide, 16:9, white background.
Top-left: company logo text "{{company}}" in blue.
Top-right: small date "{{date}}" on one line, version "{{version}}" below in blue.
Center-left: large bold title "{{title}}" in blue.
Bottom-left: small footer "{{footer}}" in light gray.
Add subtle large blue circular arc outlines in the bottom-right corner as a background motif.
Do not add any other text.`,
    previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#ffffff"/>
  <text x="16" y="24" font-family="Arial" font-size="14" fill="#0077c8">LOGO</text>
  <text x="240" y="18" font-family="Arial" font-size="8" fill="#0077c8">Nov 2025</text>
  <text x="240" y="30" font-family="Arial" font-size="8" fill="#0077c8">Ver.1</text>
  <text x="16" y="96" font-family="Arial" font-size="22" fill="#0077c8">IR Presentation</text>
  <text x="16" y="168" font-family="Arial" font-size="8" fill="#9ca3af">© Company</text>
  <circle cx="280" cy="150" r="80" fill="none" stroke="#cfe8f7" stroke-width="2"/>
  <circle cx="300" cy="170" r="80" fill="none" stroke="#dff0fb" stroke-width="2"/>
</svg>`,
  },
  {
    id: 'disclaimer-box',
    name: 'Disclaimer Box',
    category: 'Legal',
    description: 'Large light-blue disclaimer panel with logo at top-right.',
    fields: [
      { key: 'company', label: 'Company name', default: 'NTT' },
      { key: 'body', label: 'Disclaimer text', type: 'list', default: 'This document is a translation of the Japanese original.\nForward-looking statements involve risks and uncertainties.\nActual results may differ materially from forecasts.' },
      { key: 'footnotes', label: 'Footnotes (one per line)', type: 'list', default: '* “E” represents plan/projection.\n** “FY” ends March 31 of the succeeding year.' },
      { key: 'footer', label: 'Footer text', default: '© Company, Inc. 2025' },
      { key: 'page', label: 'Page number', default: '1' },
    ],
    prompt: `Create a disclaimer slide, 16:9, white background.
Top-right: small logo text "{{company}}" in blue.
Center: a large light-blue rectangular panel with rounded corners.
Inside the panel: multiline disclaimer text from "{{body}}".
Bottom-left inside panel: footnotes from "{{footnotes}}".
Bottom-left of slide: small footer "{{footer}}".
Bottom-right: page number "{{page}}" in blue.
Use clean, readable typography. No other elements.`,
    previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#ffffff"/>
  <text x="270" y="18" font-family="Arial" font-size="10" fill="#0077c8">LOGO</text>
  <rect x="28" y="34" width="264" height="110" rx="8" fill="#cfe2f7"/>
  <rect x="38" y="44" width="240" height="8" fill="#9bbfe8"/>
  <rect x="38" y="58" width="240" height="8" fill="#9bbfe8"/>
  <rect x="38" y="72" width="220" height="8" fill="#9bbfe8"/>
  <rect x="38" y="120" width="200" height="6" fill="#9bbfe8"/>
  <text x="16" y="170" font-family="Arial" font-size="8" fill="#9ca3af">© Company</text>
  <text x="300" y="170" font-family="Arial" font-size="10" fill="#0077c8">1</text>
</svg>`,
  },
  {
    id: 'contents-list',
    name: 'Contents List',
    category: 'Agenda',
    description: 'Two-column contents with blue section bars.',
    fields: [
      { key: 'company', label: 'Company name', default: 'NTT' },
      {
        key: 'leftSections',
        label: 'Left column sections (one per line, format: Section Title | Items)',
        type: 'list',
        default: 'Overview | Overview of Consolidated Results; Status of Results\nIntegrated ICT Business | Results Overview; Consumer Communications; Enterprise\nGlobal Solutions Business | Results Summary; Data Center Business; Expansion',
      },
      {
        key: 'rightSections',
        label: 'Right column sections (one per line, format: Section Title | Items)',
        type: 'list',
        default: 'AI | Toward Orders Exceeding 500 Billion; Full-stack AI offerings\nShareholder Returns | Shareholder Returns; Record of Share Buybacks\nFinancial Data | Consolidated Financial Results; Balance Sheet; Debt',
      },
      { key: 'footer', label: 'Footer text', default: '© Company, Inc. 2025' },
      { key: 'page', label: 'Page number', default: '2' },
    ],
    prompt: `Create a contents slide, 16:9, white background.
Top-left: heading "Contents" in blue.
Top-right: small logo text "{{company}}" in blue.
Two columns of sections. Each section has a blue horizontal bar with section title in white.
Under each bar list the items in smaller black text.
Left column uses "{{leftSections}}" and right column uses "{{rightSections}}".
Bottom-left: footer "{{footer}}". Bottom-right: page number "{{page}}" in blue.
Keep spacing tight but readable.`,
    previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#ffffff"/>
  <text x="16" y="24" font-family="Arial" font-size="16" fill="#0077c8">Contents</text>
  <text x="270" y="20" font-family="Arial" font-size="10" fill="#0077c8">LOGO</text>
  <rect x="16" y="36" width="140" height="10" fill="#0077c8"/>
  <rect x="16" y="60" width="140" height="10" fill="#0077c8"/>
  <rect x="16" y="84" width="140" height="10" fill="#0077c8"/>
  <rect x="164" y="36" width="140" height="10" fill="#0077c8"/>
  <rect x="164" y="60" width="140" height="10" fill="#0077c8"/>
  <rect x="164" y="84" width="140" height="10" fill="#0077c8"/>
  <text x="16" y="170" font-family="Arial" font-size="8" fill="#9ca3af">© Company</text>
  <text x="300" y="170" font-family="Arial" font-size="10" fill="#0077c8">2</text>
</svg>`,
  },
  {
    id: 'section-divider-arc',
    name: 'Section Divider (Arc)',
    category: 'Section',
    description: 'Large title with subtle arc background on the right.',
    fields: [
      { key: 'company', label: 'Company name', default: 'NTT' },
      { key: 'title', label: 'Section title', default: 'Overview of Consolidated Results for the Six Months Ended September 30, 2025' },
      { key: 'footer', label: 'Footer text', default: '© Company, Inc. 2025' },
    ],
    prompt: `Create a section divider slide, 16:9, white background.
Top-left: company logo text "{{company}}" in blue.
Left side: large multi-line title "{{title}}" in blue.
Right side: large subtle blue arc outlines in the background.
Bottom-left: footer "{{footer}}" in light gray.
No page number.`,
    previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#ffffff"/>
  <text x="16" y="24" font-family="Arial" font-size="12" fill="#0077c8">LOGO</text>
  <text x="16" y="90" font-family="Arial" font-size="20" fill="#0077c8">Section Title</text>
  <circle cx="300" cy="90" r="90" fill="none" stroke="#cfe8f7" stroke-width="2"/>
  <circle cx="320" cy="110" r="90" fill="none" stroke="#dff0fb" stroke-width="2"/>
  <text x="16" y="170" font-family="Arial" font-size="8" fill="#9ca3af">© Company</text>
</svg>`,
  },
  {
    id: 'highlights-box',
    name: 'Highlights Box',
    category: 'Highlights',
    description: 'Headline + light blue highlight banner + key metrics box.',
    fields: [
      { key: 'company', label: 'Company name', default: 'NTT' },
      { key: 'title', label: 'Slide title', default: 'Status of Consolidated Results for FY2025.2Q' },
      { key: 'bullets', label: 'Highlight bullets (one per line)', type: 'list', default: 'Operating Revenues, Operating Profit and Profit all increased year-over-year\nOperating Revenues reached new record-high levels' },
      { key: 'metrics', label: 'Metric rows (one per line, format: Label | Value | Delta)', type: 'list', default: 'Operating Revenues | ¥6,772.7B | +¥182.1B (+2.8%)\nEBITDA | ¥1,740.5B | +¥54.9B (+3.3%)\nOperating Profit | ¥945.0B | +¥24.8B (+2.7%)\nProfit | ¥595.7B | +¥40.9B (+7.4%)' },
      { key: 'footnotes', label: 'Footnotes (one per line)', type: 'list', default: '(1) EBITDA excludes depreciation and amortization of right-of-use assets.\n(2) Profit excludes noncontrolling interests.' },
      { key: 'page', label: 'Page number', default: '4' },
    ],
    prompt: `Create a results highlight slide, 16:9, white background.
Top-left: slide title "{{title}}" in blue. Top-right: logo text "{{company}}" in blue.
Below title: a light blue banner with bullet text from "{{bullets}}".
Below banner: a bordered white box with blue header bar reading "Status of Consolidated Results".
Inside the box: metric rows from "{{metrics}}" with bold labels and values.
Bottom-left: footnotes from "{{footnotes}}". Bottom-right: page number "{{page}}" in blue.
Clean corporate IR style, aligned text, no extra elements.`,
    previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#ffffff"/>
  <text x="16" y="22" font-family="Arial" font-size="12" fill="#0077c8">Results Title</text>
  <text x="270" y="20" font-family="Arial" font-size="10" fill="#0077c8">LOGO</text>
  <rect x="16" y="32" width="288" height="22" fill="#cfe2f7"/>
  <rect x="16" y="60" width="288" height="80" rx="6" fill="#ffffff" stroke="#0077c8" stroke-width="2"/>
  <rect x="16" y="60" width="288" height="14" fill="#0077c8"/>
  <rect x="24" y="82" width="260" height="6" fill="#c7d7ec"/>
  <rect x="24" y="94" width="260" height="6" fill="#c7d7ec"/>
  <rect x="24" y="106" width="260" height="6" fill="#c7d7ec"/>
  <text x="16" y="170" font-family="Arial" font-size="8" fill="#9ca3af">(1) Note</text>
  <text x="300" y="170" font-family="Arial" font-size="10" fill="#0077c8">4</text>
</svg>`,
  },
  {
    id: 'segment-contribution',
    name: 'Segment Contribution (Stacked Bars)',
    category: 'Charts',
    description: 'Two stacked bar charts showing segment contributions (revenues + profit).',
    fields: [
      { key: 'title', label: 'Slide title', default: 'Contributing Factors by Segment for FY2025.2Q' },
      { key: 'leftChartTitle', label: 'Left chart title', default: 'Operating Revenues (Billions of yen)' },
      { key: 'rightChartTitle', label: 'Right chart title', default: 'Operating Profit' },
      { key: 'year1', label: 'Prior year label', default: 'FY2024.2Q' },
      { key: 'year2', label: 'Current year label', default: 'FY2025.2Q' },
      { key: 'yoyRevenue', label: 'Revenue YoY delta', default: '+182.1' },
      { key: 'yoyProfit', label: 'Profit YoY delta', default: '+24.8' },
      {
        key: 'segments',
        label: 'Segment labels (one per line, order matches stacks)',
        type: 'list',
        default:
          'Integrated ICT Business Segment\nRegional Communications Business Segment\nGlobal Solutions Business Segment\nOthers (Real Estate, Energy and Others)\nElimination of Inter-Segment Transactions',
      },
      {
        key: 'revenueYear1',
        label: 'Revenue year1 values (one per line, align with segments)',
        type: 'list',
        default: '3,032.7\n1,535.4\n2,360.5\n812.3\n-1,150.3',
      },
      {
        key: 'revenueYear2',
        label: 'Revenue year2 values (one per line, align with segments)',
        type: 'list',
        default: '3,071.6\n1,570.0\n2,480.9\n833.8\n-1,183.6',
      },
      {
        key: 'profitYear1',
        label: 'Profit year1 values (one per line, align with segments)',
        type: 'list',
        default: '474.7\n187.5\n269.0\n34.9\n-45.8',
      },
      {
        key: 'profitYear2',
        label: 'Profit year2 values (one per line, align with segments)',
        type: 'list',
        default: '396.1\n191.2\n389.0\n37.5\n-68.8',
      },
      { key: 'page', label: 'Page number', default: '5' },
      { key: 'company', label: 'Company name', default: 'NTT' },
    ],
    prompt: `Create a 16:9 IR slide with two stacked bar charts side-by-side.
Title at top-left: "{{title}}". Top-right: logo text "{{company}}" in blue.
Left chart: "{{leftChartTitle}}" comparing {{year1}} vs {{year2}} stacked by segments.
Right chart: "{{rightChartTitle}}" comparing {{year1}} vs {{year2}} stacked by segments.
Segments order (top-to-bottom in legend): {{segments}}.
Left chart values {{year1}}: {{revenueYear1}}. Left chart values {{year2}}: {{revenueYear2}}.
Right chart values {{year1}}: {{profitYear1}}. Right chart values {{year2}}: {{profitYear2}}.
Annotate YoY deltas near chart titles: Revenue {{yoyRevenue}}, Profit {{yoyProfit}}.
Use clean corporate colors, stacked bars with labels, right-aligned legend.
Bottom-right page number "{{page}}".`,
    previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#ffffff"/>
  <text x="16" y="20" font-family="Arial" font-size="12" fill="#0077c8">Segment Contribution</text>
  <text x="270" y="18" font-family="Arial" font-size="10" fill="#0077c8">LOGO</text>
  <rect x="20" y="40" width="120" height="90" fill="#f3f4f6" stroke="#d1d5db"/>
  <rect x="30" y="100" width="20" height="30" fill="#2563eb"/>
  <rect x="30" y="70" width="20" height="30" fill="#10b981"/>
  <rect x="30" y="55" width="20" height="15" fill="#f59e0b"/>
  <rect x="90" y="90" width="20" height="40" fill="#2563eb"/>
  <rect x="90" y="70" width="20" height="20" fill="#10b981"/>
  <rect x="90" y="58" width="20" height="12" fill="#f59e0b"/>
  <rect x="180" y="40" width="120" height="90" fill="#f3f4f6" stroke="#d1d5db"/>
  <rect x="190" y="110" width="20" height="20" fill="#2563eb"/>
  <rect x="190" y="88" width="20" height="22" fill="#10b981"/>
  <rect x="190" y="74" width="20" height="14" fill="#f59e0b"/>
  <rect x="250" y="100" width="20" height="30" fill="#2563eb"/>
  <rect x="250" y="82" width="20" height="18" fill="#10b981"/>
  <rect x="250" y="70" width="20" height="12" fill="#f59e0b"/>
  <text x="300" y="170" font-family="Arial" font-size="10" fill="#0077c8">5</text>
</svg>`,
  },
  {
    id: 'dual-ecosystem',
    name: 'Dual Ecosystem Diagram',
    category: 'Strategy diagram',
    description: 'Two linked ecosystems with a joint development connector.',
    fields: [
      { key: 'title', label: 'Top title', default: 'IOWN Digital Twin' },
      { key: 'leftTheme', label: 'Left theme label', default: 'Domestic Industries' },
      { key: 'rightTheme', label: 'Right theme label', default: 'Global Digital Business' },
      { key: 'leftCenter', label: 'Left center text', default: 'Enhancement of AI/Robots' },
      { key: 'rightCenter', label: 'Right center text', default: 'Enhancement of AI/Robots' },
      {
        key: 'leftLabels',
        label: 'Left labels (one per line)',
        type: 'list',
        default: 'Manufacturing Industry\nFinance/Insurance\nMedical/Healthcare\nUrban Development (Smart Cities)\nCulture/Education\nGovernment Services',
      },
      {
        key: 'rightLabels',
        label: 'Right labels (one per line)',
        type: 'list',
        default: 'Manufacturing Industry\nFinance/Insurance\nMedical/Healthcare\nUrban Development (Smart Cities)\nStreaming/Media\nGovernment Services',
      },
      { key: 'connectorLabel', label: 'Connector label', default: 'Joint Development' },
      { key: 'leftCaption', label: 'Left caption', default: 'Advancement of DX and Data Utilization in Domestic Industries' },
      { key: 'rightCaption', label: 'Right caption', default: 'Global Digital Business Innovation' },
    ],
    prompt: `Create a clean, executive diagram in 16:9 on white background.
Top center: blue rounded title pill with white text "{{title}}".
Two large horizontal ovals: left in warm light peach with red text theme, right in light teal with green text theme.
Center text: left "{{leftCenter}}", right "{{rightCenter}}", with subtle outline.
Around left oval place icons with labels (red): {{leftLabels}}.
Around right oval place icons with labels (green): {{rightLabels}}.
Between ovals: blue chevron/hex connector labeled "{{connectorLabel}}".
Bottom captions: left red "{{leftCaption}}", right green "{{rightCaption}}".
Use flat simple icons, balanced spacing, no overlap, corporate IR style. Do not add extra text.`,
  },
  {
    id: 'pillar-strategy',
    name: 'Strategic Pillars',
    category: 'Strategy diagram',
    description: 'Three to five pillars with short supporting bullets.',
    fields: [
      { key: 'title', label: 'Title', default: 'Strategic Priorities' },
      {
        key: 'pillars',
        label: 'Pillars (one per line, format: Title - Short detail)',
        type: 'list',
        default: 'Digital Transformation - Cloud-first delivery\nOperational Excellence - Automation and AI\nSustainability - Net-zero roadmap',
      },
    ],
    prompt: `Create a clean IR slide with title "{{title}}". Show 3-5 vertical pillars with icons and short labels.
Use each pillar from: {{pillars}}.
Style: minimal, corporate, strong hierarchy, plenty of white space. No extra text.`,
  },
  {
    id: 'roadmap-phases',
    name: 'Roadmap With Phases',
    category: 'Timeline',
    description: 'Phase-based roadmap with milestones.',
    fields: [
      { key: 'title', label: 'Title', default: 'R&D Roadmap' },
      {
        key: 'phases',
        label: 'Phases (one per line, format: Phase - Date range - Milestone)',
        type: 'list',
        default: 'R&D - 2024 H1-H2 - Prototype\nPilot - 2025 H1 - Pilot launch\nScale - 2025 H2 - Commercial rollout',
      },
    ],
    prompt: `Create a horizontal roadmap diagram titled "{{title}}".
Use phases: {{phases}}.
Show each phase as a block with the date range and a milestone marker.
Style: executive, clean, readable, corporate IR.`,
  },
  {
    id: 'kpi-strip',
    name: 'KPI Summary Strip',
    category: 'KPI',
    description: 'A row of KPI cards with values and deltas.',
    fields: [
      { key: 'title', label: 'Title', default: 'Key Metrics' },
      {
        key: 'kpis',
        label: 'KPIs (one per line, format: Label - Value - Delta)',
        type: 'list',
        default: 'Revenue - $240M - +23% YoY\nEBITDA - $72M - +33% YoY\nCustomers - 12.5K - +35% YoY',
      },
    ],
    prompt: `Create a clean KPI strip titled "{{title}}".
Use KPI cards: {{kpis}}.
Each card shows label, value, and delta. Use subtle color for positive deltas.
Style: minimal, IR-grade, white background.`,
  },
  {
    id: 'segment-comparison',
    name: 'Segment Comparison Table',
    category: 'Table',
    description: 'Two-side comparison table for segments.',
    fields: [
      { key: 'title', label: 'Title', default: 'Segment Performance' },
      {
        key: 'leftTitle',
        label: 'Left table title',
        default: 'Operating Revenues by Segment',
      },
      {
        key: 'rightTitle',
        label: 'Right table title',
        default: 'Operating Profit by Segment',
      },
      {
        key: 'leftRows',
        label: 'Left rows (one per line, format: Segment | Value | YoY)',
        type: 'list',
        default: 'Integrated ICT | 3,032.7 | +38.9\nRegional Comm. | 1,535.4 | +34.6\nGlobal Solutions | 2,360.5 | +120.4',
      },
      {
        key: 'rightRows',
        label: 'Right rows (one per line, format: Segment | Value | YoY)',
        type: 'list',
        default: 'Integrated ICT | 474.7 | -78.6\nRegional Comm. | 187.5 | +3.7\nGlobal Solutions | 269.0 | +120.0',
      },
    ],
    prompt: `Create a two-column slide titled "{{title}}".
Left table title "{{leftTitle}}" with rows: {{leftRows}}.
Right table title "{{rightTitle}}" with rows: {{rightRows}}.
Use clean table styling with header row, right-aligned numbers, and subtle separators.`,
  },
];

export const buildVisualPrompt = (template, fields) => {
  if (!template) return '';
  let prompt = template.prompt;
  const replacements = { ...fields };
  Object.entries(replacements).forEach(([key, value]) => {
    let replacement = value ?? '';
    if (Array.isArray(replacement)) {
      replacement = replacement.join(', ');
    }
    const normalized = String(replacement).trim();
    prompt = prompt.split(`{{${key}}}`).join(normalized);
  });
  return prompt;
};
