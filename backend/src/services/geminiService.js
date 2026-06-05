// backend/src/services/geminiService.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

const normalizeModelName = (name) => name.replace(/^models\//, '');

const TEXT_MODEL_NAME = normalizeModelName(
  process.env.GEMINI_TEXT_MODEL || 'gemini-flash-latest'
);
const EMBEDDING_MODEL_NAME = normalizeModelName(
  process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004'
);
const FALLBACK_EMBEDDING_MODELS = ['embedding-001', 'text-embedding-004'];
const FALLBACK_EMBEDDING_DIM = Number(process.env.EMBEDDING_FALLBACK_DIM || 768);
const FALLBACK_EMBEDDING_MODE =
  String(process.env.EMBEDDING_FALLBACK || 'zeros').toLowerCase();

let client = null;
let textModel = null;
let embeddingModel = null;
let layoutCache = null;

const extractJsonObject = (text) => {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('Model did not return JSON');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  throw new Error('Model returned incomplete JSON');
};

const parseJsonFromModel = (text) => {
  const jsonText = extractJsonObject(text);
  return JSON.parse(jsonText);
};

const getClient = () => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not set');
  }
  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
};

const getTextModel = () => {
  if (!textModel) {
    textModel = getClient().getGenerativeModel({ model: TEXT_MODEL_NAME });
  }
  return textModel;
};

const getEmbeddingModel = () => {
  if (!embeddingModel) {
    embeddingModel = getClient().getGenerativeModel({ model: EMBEDDING_MODEL_NAME });
  }
  return embeddingModel;
};

const getEmbeddingModelByName = (name) =>
  getClient().getGenerativeModel({ model: normalizeModelName(name) });

const loadLayouts = async () => {
  if (layoutCache) return layoutCache;
  const layoutsPath = path.resolve(process.cwd(), 'src', 'data', 'layouts.json');
  const raw = await fs.readFile(layoutsPath, 'utf8');
  layoutCache = JSON.parse(raw);
  return layoutCache;
};

const getLayoutById = async (layoutId) => {
  if (!layoutId || layoutId === 'auto') return null;
  const data = await loadLayouts();
  return data.layouts.find((layout) => layout.id === layoutId) || null;
};

const BUSINESS_OUTLINE_TABLE = `## Presentation Outline

| Slide | Section Title | Key Bullet Points |
| :---: | :--- | :--- |
| **1** | **Company Overview** | * Mission and vision |
| **2** | **Problem & Market Need** | * Core pain point |
| **3** | **Solution & Product** | * How we solve the problem |
| **4** | **Market Opportunity** | * TAM, SAM, SOM |
| **5** | **Business Model** | * Revenue streams |
| **6** | **Go-to-Market Strategy** | * Channels and partnerships |
| **7** | **Competitive Landscape** | * Key differentiators |
| **8** | **Traction & Milestones** | * Key achievements |
| **9** | **Financial Plan** | * Revenue outlook |
| **10** | **Team** | * Leadership strengths |
| **11** | **Roadmap** | * Next 12-24 months |
| **12** | **Funding Ask** | * Use of funds |
`;

const IR_OUTLINE_TABLE = `## Presentation Outline

| Slide | Section Title | Key Bullet Points |
| :---: | :--- | :--- |
| **1** | **Market Status and Problems** | * Market Status & Problem |
| **2** | **Technology Development Summary** | * Solution |
| **3** | **Technology Development Details and Goals** | * Technology & Goal |
| **4** | **Current Status of Technology Development** | * Preparation Status |
| **5** | **Standardization Strategy** | * Standards roadmap |
| **6** | **Task Breakdown and Implementation Schedule** | * WBS & timeline |
| **7** | **Target Market and Competitor Analysis** | * Market sizing & competitors |
| **8** | **Commercialization Plan** | * Go-to-market plan |
| **9** | **Global Expansion Strategy** | * International rollout |
| **10** | **Operational Support Plan** | * Operations & support |
| **11** | **Job Creation and Expected Effects** | * Employment impact |
| **12** | **Basis for Commercialization Target Estimation** | * Target rationale |
| **13** | **Startup Company Overview** | * Company & team |
| **14** | **Safety Measures Implementation Plan** | * Safety compliance |
| **15** | **Security Measures Implementation Plan** | * Security controls |
| **16** | **Technology Leakage Prevention Measures** | * IP protection |
| **17** | **Other Related Measures Implementation Plan** | * Additional compliance |
`;

const normalizeDeckType = (deckType) => {
  const value = String(deckType || '').toLowerCase();
  if (value === 'ir' || value === 'ir-deck' || value === 'irdeck') return 'ir';
  if (value === 'business' || value === 'proposal' || value === 'business-proposal') return 'business';
  return '';
};

const getOutlineTemplate = (deckType) => {
  const normalized = normalizeDeckType(deckType);
  return normalized === 'ir' ? IR_OUTLINE_TABLE : BUSINESS_OUTLINE_TABLE;
};

const normalizeOutlineToSlideCount = (outlineText, slideCount) => {
  const count = Number(slideCount) || 0;
  if (!count) return outlineText;
  const lines = String(outlineText || '').split('\n');
  const header = [];
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.trim().startsWith('|')) {
      const parts = line.split('|').map((part) => part.trim());
      if (parts.length < 4) continue;
      const slideCell = parts[1] || '';
      const titleCell = parts[2] || '';
      const bulletCell = parts[3] || '';
      const normalizedSlide = slideCell.replace(/\*\*/g, '').trim();
      const slideNumber = normalizedSlide.replace(/[^\d]/g, '');
      if (!slideNumber || /^slide$/i.test(normalizedSlide) || slideCell.includes(':---')) {
        if (header.length < 3) header.push(line);
        continue;
      }
      rows.push({
        slide: `**${slideNumber}**`,
        title: titleCell,
        bullet: bulletCell,
      });
      continue;
    }
    if (header.length < 3) header.push(line);
  }
  if (rows.length === 0) return outlineText;
  const normalizedRows = rows.map((row, idx) => ({
    slide: `**${idx + 1}**`,
    title: row.title,
    bullet: row.bullet,
  }));

  while (normalizedRows.length > count) {
    const last = normalizedRows.pop();
    const prev = normalizedRows[normalizedRows.length - 1];
    prev.bullet = `${prev.bullet} / ${last.bullet}`;
  }

  while (normalizedRows.length < count) {
    const base = normalizedRows[normalizedRows.length - 1];
    normalizedRows.push({
      slide: `**${normalizedRows.length + 1}**`,
      title: base.title.replace(/\*\*/g, '') + ' (Part 2)',
      bullet: '* MISSING: Additional details for this section',
    });
  }

  const tableHeader = header.length
    ? header
    : [
        '| Slide | Section Title | Key Bullet Points |',
        '| :---: | :--- | :--- |',
      ];
  const body = normalizedRows
    .map((row) => `| ${row.slide} | ${row.title} | ${row.bullet} |`)
    .join('\n');
  return `${tableHeader.join('\n')}\n${body}\n`;
};

const buildMissingDataGuide = (deckType) => {
  const baseGuide = `MISSING-DATA PLACEHOLDERS (USE THESE BY SLIDE TYPE):
- title: "MISSING: Company name", "MISSING: Presentation subtitle"
- content: "MISSING: [slide topic key facts]", "MISSING: [source + year]"
- two-column: "MISSING: Left column key points", "MISSING: Right column key points"
- data (table): "MISSING: Table headers", "MISSING: Table row data with units and time period"
- chart: "MISSING: Chart title", "MISSING: Labels", "MISSING: Dataset values with units"
- image-focus: "MISSING: Product/service description", "MISSING: Key differentiators"
- comparison: "MISSING: 'Before' state facts", "MISSING: 'After' state facts"

If the slide has a specific title, tailor the MISSING placeholder to that title.`;

  const normalized = normalizeDeckType(deckType);
  if (normalized === 'ir') {
    return `${baseGuide}

IR DECK MISSING EXAMPLES (MATCH SLIDE TITLES):
- Market Status and Problems: "MISSING: Current market size and growth rate (source/year)"
- Technology Development Summary: "MISSING: Core technology description and readiness level"
- Technology Development Details and Goals: "MISSING: Development goals, KPIs, and target dates"
- Current Status of Technology Development: "MISSING: Milestones achieved and remaining gaps"
- Standardization Strategy: "MISSING: Standards bodies, roadmap dates, and compliance scope"
- Task Breakdown and Implementation Schedule: "MISSING: WBS phases, owners, and timeline"
- Target Market and Competitor Analysis: "MISSING: Target segments, key competitors, differentiation"
- Commercialization Plan: "MISSING: Go-to-market plan, channels, pricing"
- Global Expansion Strategy: "MISSING: Target countries, timeline, entry strategy"
- Operational Support Plan: "MISSING: Ops model, support structure, staffing"
- Job Creation and Expected Effects: "MISSING: Hiring plan, job counts, timelines"
- Basis for Commercialization Target Estimation: "MISSING: Revenue assumptions and calculation basis"
- Startup Company Overview: "MISSING: Company profile, founding date, team bios"
- Safety Measures Implementation Plan: "MISSING: Safety policy, audits, responsible team"
- Security Measures Implementation Plan: "MISSING: Security controls, certifications, monitoring"
- Technology Leakage Prevention Measures: "MISSING: IP protection policy, access controls"
- Other Related Measures Implementation Plan: "MISSING: Other compliance measures and owners"`;
  }

  return `${baseGuide}

BUSINESS PROPOSAL MISSING EXAMPLES (MATCH SLIDE TITLES):
- Company Overview: "MISSING: Company description, founding date, mission"
- Problem & Market Need: "MISSING: Customer pain points with evidence"
- Solution & Product: "MISSING: Product description, key features"
- Market Opportunity: "MISSING: TAM/SAM/SOM with sources"
- Business Model: "MISSING: Revenue streams, pricing model"
- Go-to-Market Strategy: "MISSING: Channels, partnerships, sales motion"
- Competitive Landscape: "MISSING: Top competitors and differentiation"
- Traction & Milestones: "MISSING: Users, revenue, pilots, key milestones"
- Financial Plan: "MISSING: Revenue projections, cost structure"
- Team: "MISSING: Leadership bios and roles"
- Roadmap: "MISSING: Upcoming milestones and timeline"
- Funding Ask: "MISSING: Funding amount, use of funds, runway"`;
};

/**
 * Generate a simple outline from document chunks.
 */
export const generateOutline = async (documentChunks, userPrompt = '', deckType = '', slideCount = 0) => {
  try {
    const outlineTemplate = getOutlineTemplate(deckType);
    if (!Array.isArray(documentChunks) || documentChunks.length === 0) {
      return normalizeOutlineToSlideCount(outlineTemplate, slideCount);
    }
    const context = documentChunks.map((chunk, idx) =>
      `[Chunk ${idx + 1}]:\n${chunk.text}\n`
    ).join('\n');

    const missingDataGuide = buildMissingDataGuide(deckType);
    const prompt = `You must use the following outline structure EXACTLY.
Do not change slide titles unless you must split or merge slides to meet the slide count requirement.
Replace the bullet points with specific content derived from the document.
If no relevant data is found for a slide, keep the original bullet or use:
"MISSING: [exact data needed]".
Return ONLY the outline in the same Markdown table format (no extra text).

Outline template:
${outlineTemplate}

${missingDataGuide}

Rules:
- One bullet per row.
- Keep bullets short and specific.
- Use ordered slide numbers (1..N).
- Do not invent numbers or facts.
${slideCount ? `- Output exactly ${slideCount} slides.` : ''}
${slideCount ? `- If the template has more slides than ${slideCount}, merge adjacent sections and keep the earliest title.
- If the template has fewer slides than ${slideCount}, split sections into "Part 1/Part 2" slides.` : ''}

${userPrompt ? `User Request: ${userPrompt}\n\n` : ''}Document Content:
${context}`;

    const result = await getTextModel().generateContent(prompt);
    const draft = result.response.text().trim();

    const reviewPrompt = `You are an editor. Fix the outline to strictly follow the required table format.
Only output the corrected Markdown table, nothing else.
Do NOT change slide order or slide titles from the template.
Ensure bullets align with slide titles.

Outline draft:
${draft}`;

    const reviewResult = await getTextModel().generateContent(reviewPrompt);
    const reviewed = reviewResult.response.text().trim();
    return normalizeOutlineToSlideCount(reviewed || draft, slideCount);
  } catch (error) {
    console.error('Outline generation error:', error);
    throw new Error(`Failed to generate outline: ${error.message}`);
  }
};

/**
 * Remix a single slide into a target layout.
 */
const forceLayoutId = (layoutId, instructions) => {
  if (!instructions || !layoutId || layoutId === 'auto') return instructions;
  return { ...instructions, layoutId };
};

const splitBulletsForColumns = (bullets) => {
  const list = Array.isArray(bullets) ? bullets.filter(Boolean) : [];
  if (list.length >= 2) {
    const splitAt = Math.ceil(list.length / 2);
    return { left: list.slice(0, splitAt), right: list.slice(splitAt) };
  }

  const text = list.join(' ').trim();
  if (!text) return { left: [], right: [] };

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= 2) {
    const mid = Math.ceil(sentences.length / 2);
    return { left: sentences.slice(0, mid), right: sentences.slice(mid) };
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return {
      left: [words.slice(0, mid).join(' ')],
      right: [words.slice(mid).join(' ')],
    };
  }

  return { left: [text], right: [] };
};

const buildTwoColumnFallback = (instructions, slide) => {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  const { left: leftBullets, right: rightBullets } = splitBulletsForColumns(bullets);

  const titleText =
    instructions?.title ||
    instructions?.elements?.find((el) => el.type === 'title')?.text ||
    slide?.title ||
    '';

  const elements = [
    {
      id: 'title',
      type: 'title',
      text: titleText,
      x: 0.08,
      y: 0.08,
      w: 0.84,
      h: 0.12,
    },
    {
      id: 'left',
      type: 'bullets',
      bullets: leftBullets,
      x: 0.08,
      y: 0.24,
      w: 0.4,
      h: 0.6,
    },
    {
      id: 'right',
      type: 'bullets',
      bullets: rightBullets,
      x: 0.52,
      y: 0.24,
      w: 0.4,
      h: 0.6,
    },
  ];

  return {
    ...instructions,
    layoutId: 'two-column',
    elements,
  };
};

const enforceLayout = (layoutId, instructions, slide) => {
  const forced = forceLayoutId(layoutId, instructions);
  if (!forced || layoutId !== 'two-column') return forced;

  const elements = Array.isArray(forced.elements) ? forced.elements : [];
  const hasTwoColumns = elements.filter((el) => el.type === 'bullets' || el.type === 'body').length >= 2;
  if (hasTwoColumns) return forced;

  return buildTwoColumnFallback(forced, slide);
};

const mapContentToLayout = (layout, content) => {
  const elements = [];
  const layoutElements = Array.isArray(layout?.elements) ? layout.elements : [];
  const bullets = Array.isArray(content?.bullets) ? content.bullets.filter(Boolean) : [];
  const maxItems =
    layoutElements.reduce((max, el) => Math.max(max, el.max_items || 0), 0) || 5;

  const { left, right } = splitBulletsForColumns(bullets.slice(0, maxItems * 2));

  layoutElements.forEach((el, idx) => {
    const base = {
      id: el.id || `${el.type}_${idx + 1}`,
      type: el.type,
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
    };

    if (el.type === 'title') {
      elements.push({ ...base, text: content.title || '' });
      return;
    }

    if (el.type === 'subtitle') {
      elements.push({ ...base, text: content.subtitle || '' });
      return;
    }

    if (el.type === 'body') {
      elements.push({ ...base, text: content.body || '' });
      return;
    }

    if (el.type === 'bullets') {
      let items = bullets;
      if (layoutElements.filter((item) => item.type === 'bullets').length > 1) {
        items = elements.filter((item) => item.type === 'bullets').length ? right : left;
      }
      elements.push({ ...base, bullets: items.slice(0, el.max_items || 5) });
      return;
    }
  });

  return elements;
};

const generateLayoutContent = async (slide, layout) => {
  const elementTypes = Array.isArray(layout?.elements)
    ? layout.elements.map((el) => el.type).join(', ')
    : '';
  const prompt = `You are a presentation editor. Rewrite the slide content to fit the target layout.
Return ONLY JSON in this schema:
{
  "title": "short title (max 8 words)",
  "subtitle": "optional subtitle (max 12 words)",
  "body": "optional body (max 25 words)",
  "bullets": ["bullet 1", "bullet 2", "bullet 3"]
}

Rules:
- Keep content concise.
- Max 5 bullets, max 10 words each.
- Do not describe images.
- Use the provided content only.

Target layout element types: ${elementTypes || 'title, body, bullets'}
Slide input:
${JSON.stringify(slide, null, 2)}
`;

  const result = await getTextModel().generateContent(prompt);
  const draft = result.response.text().trim();
  return parseJsonFromModel(draft);
};

export const remixSlideLayout = async (slide, layoutId = 'auto', templateId = '') => {
  try {
    const forcedLayout = await getLayoutById(layoutId);
    if (forcedLayout) {
      const content = await generateLayoutContent(slide, forcedLayout);
      const elements = mapContentToLayout(forcedLayout, content);
      return {
        layoutId,
        templateId: templateId || 'indigo',
        elements,
        notes: 'layout applied',
      };
    }

    const prompt = `You are a presentation designer. Rewrite and redistribute the slide content to fit the target layout.
If layoutId is "auto", choose the best layout. If layoutId is provided, you MUST use it exactly.
Return ONLY JSON with this schema:
{
  "layoutId": "${layoutId}",
  "templateId": "${templateId || 'indigo'}",
  "elements": [
    {
      "id": "title",
      "type": "title|subtitle|body|bullets|image|chart",
      "text": "Text for this box",
      "bullets": ["Optional bullet 1", "Optional bullet 2"],
      "x": 0.08,
      "y": 0.1,
      "w": 0.84,
      "h": 0.12
    }
  ],
  "notes": "Any layout notes"
}

- x, y, w, h are fractions of the slide (0..1).
- Use 2-4 elements max.
- Ensure the title is larger and near the top.
- If you include bullets, put them in a single box with bullets[].

Slide input:
${JSON.stringify(slide, null, 2)}
`;

    const result = await getTextModel().generateContent(prompt);
    const text = result.response.text().trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    const jsonText = jsonStart !== -1 && jsonEnd !== -1 ? text.slice(jsonStart, jsonEnd + 1) : text;
    const parsed = JSON.parse(jsonText);
    return enforceLayout(layoutId, parsed, slide);
  } catch (error) {
    console.error('Remix slide error:', error);
    throw new Error(`Failed to remix slide: ${error.message}`);
  }
};

/**
 * Generate a single embedding for a text.
 */
export const generateEmbedding = async (text) => {
  const tried = new Set();
  const modelCandidates = [EMBEDDING_MODEL_NAME, ...FALLBACK_EMBEDDING_MODELS].filter(
    (model) => model && !tried.has(model) && (tried.add(model) || true)
  );
  let lastError = null;

  for (const modelName of modelCandidates) {
    try {
      const model = modelName === EMBEDDING_MODEL_NAME ? getEmbeddingModel() : getEmbeddingModelByName(modelName);
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      if (!message.includes('not found') && !message.includes('not supported')) {
        break;
      }
    }
  }

  if (FALLBACK_EMBEDDING_MODE === 'zeros') {
    console.warn('Embedding fallback in use; returning zero vector.');
    return Array.from({ length: FALLBACK_EMBEDDING_DIM }).fill(0);
  }

  console.error('Embedding generation error:', lastError);
  throw new Error(`Failed to generate embedding: ${lastError?.message || 'Unknown error'}`);
};

/**
 * Generate embeddings for a batch of texts.
 */
export const generateEmbeddingsBatch = async (texts) => {
  try {
    const embeddings = [];
    for (const text of texts) {
      const embedding = await generateEmbedding(text);
      embeddings.push(embedding);
    }
    return embeddings;
  } catch (error) {
    console.error('Batch embedding error:', error);
    throw new Error(`Failed to generate embeddings batch: ${error.message}`);
  }
};

/**
 * Edit chart data based on a user prompt while preserving schema.
 */
export const editChartData = async (chartData, userPrompt, context = {}) => {
  if (!chartData) {
    throw new Error('chartData is required');
  }
  if (!userPrompt) {
    throw new Error('userPrompt is required');
  }

  try {
    const schema = `{
  "type": "bar|line|pie|doughnut",
  "title": "Chart title",
  "labels": ["Label A", "Label B"],
  "datasets": [{
    "label": "Series name",
    "data": [10, 20],
    "backgroundColor": "#3b82f6"
  }],
  "xAxisLabel": "X axis label",
  "yAxisLabel": "Y axis label",
  "showLegend": true
}`;

    const prompt = `You are a data visualization editor.
Update the chart JSON using the user's instruction.
Return ONLY valid JSON matching the schema.
If the instruction does not specify a field, keep the current value.
Do not add extra keys or commentary.
Ensure labels.length equals datasets[0].data.length.

Current chart JSON:
${JSON.stringify(chartData, null, 2)}

${context?.title ? `Slide title: ${context.title}\n` : ''}${context?.bullets?.length ? `Slide bullets: ${context.bullets.join('; ')}\n` : ''}
User instruction:
${userPrompt}

Required JSON schema:
${schema}`;

    const result = await getTextModel().generateContent(prompt);
    const updated = parseJsonFromModel(result.response.text().trim());

    const labels = Array.isArray(updated.labels)
      ? updated.labels
      : chartData.labels || [];
    const datasets = Array.isArray(updated.datasets)
      ? updated.datasets
      : chartData.datasets || [];
    const primary = datasets[0] || { label: 'Series', data: [] };
    let data = Array.isArray(primary.data) ? primary.data : [];

    if (labels.length > data.length) {
      data = data.concat(new Array(labels.length - data.length).fill(0));
    } else if (labels.length < data.length) {
      data = data.slice(0, labels.length);
    }

    const normalized = {
      ...chartData,
      ...updated,
      labels,
      datasets: [
        {
          ...primary,
          data,
          backgroundColor: primary.backgroundColor || '#3b82f6',
        },
      ],
    };

    return normalized;
  } catch (error) {
    console.error('Chart edit error:', error);
    throw new Error(`Failed to edit chart: ${error.message}`);
  }
};

/**
 * Generate chart/table candidates from document context.
 */
export const generateChartCandidates = async (documentChunks, slide, chartTypes = []) => {
  try {
    const context = documentChunks
      .slice(0, 20)
      .map((chunk, idx) => `[Chunk ${idx + 1}]: ${chunk.text}`)
      .join('\n');

    const allowedTypes = chartTypes.length
      ? chartTypes.join(', ')
      : 'bar,line,stacked,waterfall,table,comparison,metrics';

    const prompt = `You are a financial analyst. Build chart/table candidates for an IR slide.\n\n` +
      `Slide title: ${slide?.title || 'Untitled'}\n` +
      `Slide subtitle: ${slide?.subtitle || ''}\n` +
      `Allowed types: ${allowedTypes}\n\n` +
      `Return JSON only in this format:\n` +
      `{\n` +
      `  \"candidates\": [\n` +
      `    {\n` +
      `      \"type\": \"bar|line|stacked|waterfall|table|comparison|metrics\",\n` +
      `      \"title\": \"Chart title\",\n` +
      `      \"template\": \"overview|results|forecast|comparison|metrics|segment|strategy|section-divider\",\n` +
      `      \"confidence\": 0.0,\n` +
      `      \"chartData\": { \"type\": \"bar\", \"labels\": [], \"datasets\": [ { \"label\": \"\", \"data\": [], \"backgroundColor\": \"#3b82f6\" } ] },\n` +
      `      \"table\": { \"columns\": [], \"rows\": [] },\n` +
      `      \"metrics\": [ { \"label\": \"\", \"value\": \"\", \"change\": \"\", \"trend\": \"up|down\" } ],\n` +
      `      \"comparison\": { \"prevYear\": \"\", \"currentYear\": \"\", \"prevValue\": \"\", \"currentValue\": \"\", \"deltaValue\": \"\", \"deltaPercent\": \"\" },\n` +
      `      \"notes\": []\n` +
      `    }\n` +
      `  ],\n` +
      `  \"missing\": []\n` +
      `}\n\n` +
      `Rules:\n` +
      `- Use only values explicitly found in the context.\n` +
      `- If values are missing, include them in \"missing\".\n` +
      `- If table data is available, prefer table candidate.\n` +
      `- Keep labels under 12 items.\n\n` +
      `Document context:\n${context}`;

    const result = await getTextModel().generateContent(prompt);
    return parseJsonFromModel(result.response.text().trim());
  } catch (error) {
    console.error('Chart candidate generation error:', error);
    throw new Error(`Failed to generate chart candidates: ${error.message}`);
  }
};

/**
 * Generate complete presentation JSON with editable content.
 * Charts, tables, and text remain editable in PowerPoint.
 * Only images need to be generated separately.
 */
export const generateEditablePresentationJSON = async (
  documentChunks,
  userPrompt = '',
  deckType = '',
  slideCount = 0
) => {
  try {
    const context = documentChunks.map((chunk, idx) =>
      `[Chunk ${idx + 1}]:\n${chunk.text}\nPage: ${chunk.metadata.page || idx}\n`
    ).join('\n');

    const roleBlock = `SYSTEM ROLE:
You are a senior management consultant and professional presentation designer.
You specialize in executive-ready, investor-grade PowerPoint decks.
You never hallucinate data and you strictly follow provided schemas.`;

    const constraintsBlock = `NON-NEGOTIABLE CONSTRAINTS:
- Output MUST be valid JSON only
- Follow the EXACT schema provided
- Do NOT invent metrics, numbers, entities, or trends
- Do NOT write generic statements (no "market is growing" unless stated in the document)
- Do NOT use "diagram" slides unless the user explicitly requests a diagram
- Do NOT include markdown, comments, or explanations`;

    const dataPolicyBlock = `DATA POLICY (CRITICAL):
- Only use facts that appear in the document content
- Prefer exact figures from the document content
- If multiple values conflict, choose the most recent
- If no numeric data exists, do NOT create charts/tables
- Never estimate or infer missing values
- If required info is missing, include a bullet starting with "MISSING:" that states exactly what data is needed
- If a slide cannot be supported by the document, every bullet on that slide must be "MISSING:" placeholders`;

    const missingDataGuideBlock = buildMissingDataGuide(deckType);

    const selfCheckBlock = `SELF-CHECK BEFORE FINAL OUTPUT:
- Validate JSON syntax
- Ensure unique slideId values
- Charts have labels, datasets, axis labels
- Bullets <= 12 words
- Image prompts 25-40 words
- Every bullet is grounded in the document OR is a "MISSING:" placeholder`;

    const slideCountBlock = slideCount
      ? `SLIDE COUNT REQUIREMENT:
You MUST output exactly ${slideCount} slides in the "slides" array.
Do not add extra slides and do not omit slides.`
      : '';

    const prompt = `${roleBlock}

${constraintsBlock}

${dataPolicyBlock}

${missingDataGuideBlock}

${slideCountBlock}

TASK:
Create a comprehensive, professional presentation that will be exported to PowerPoint.

IMPORTANT: Generate content that will be EDITABLE in PowerPoint:
- Text as bullet points (users can edit)
- Charts with real data (users can modify chart data)
- Tables with data (users can edit cells)
- Image prompts only (images will be generated separately)
IMPORTANT: Missing info handling:
- If you need specific facts not found in the document, add a bullet like:
  "MISSING: [exact data needed, e.g., 2024 revenue in $M, source/year]"
- Also add a speakerNotes line: "Missing data: [list]"

IMPORTANT:
The example structure is illustrative. Do NOT reuse example numbers, titles, or content.

${userPrompt ? `User Request: ${userPrompt}\n\n` : ''}Document Content:
${context}

Generate a presentation JSON following this EXACT structure:

{
  "metadata": {
    "title": "Presentation Title",
    "subtitle": "Subtitle",
    "author": "Snapdeck RAG",
    "theme": "professional"
  },
  "slides": [
    {
      "slideId": "slide_001",
      "type": "title",
      "title": "Main Title",
      "subtitle": "Subtitle text",
      "backgroundColor": "#1e40af",
      "textColor": "#ffffff",
      "logo": {
        "placeholderId": "logo_brand",
        "prompt": "Company logo, flat vector, transparent background",
        "position": "left"
      },
      "image": {
        "placeholderId": "img_title",
        "prompt": "Professional corporate background image, modern office building with glass facade, blue sky, professional photography, high quality",
        "position": "center"
      }
    },
    {
      "slideId": "slide_002",
      "type": "two-column",
      "title": "Market Analysis",
      "backgroundColor": "#ffffff",
      "textColor": "#1e3a8a",
      "leftColumn": {
        "type": "text",
        "items": [
          "Market growing at 25% annually",
          "Total addressable market: $50B",
          "Key segments: Enterprise, SMB"
        ]
      },
      "rightColumn": {
        "type": "chart",
        "chartData": {
          "type": "bar",
          "title": "Market Size by Year",
          "labels": ["2022", "2023", "2024", "2025", "2026"],
          "datasets": [{
            "label": "Market Size ($B)",
            "data": [30, 37, 46, 58, 72],
            "backgroundColor": "#3b82f6"
          }],
          "xAxisLabel": "Year",
          "yAxisLabel": "Size ($B)",
          "showLegend": true
        }
      },
      "speakerNotes": "Emphasize the strong growth trajectory and market opportunity"
    },
    {
      "slideId": "slide_003",
      "type": "data",
      "title": "Financial Performance",
      "backgroundColor": "#ffffff",
      "textColor": "#1e3a8a",
      "table": {
        "headers": ["Quarter", "Revenue ($M)", "Growth (%)", "Profit ($M)", "Margin (%)"],
        "rows": [
          ["Q1 2024", "12.5", "28%", "3.2", "25.6%"],
          ["Q2 2024", "15.8", "32%", "4.1", "26.0%"],
          ["Q3 2024", "19.2", "35%", "5.3", "27.6%"],
          ["Q4 2024", "23.5", "38%", "6.8", "28.9%"]
        ],
        "headerBg": "#1e40af",
        "headerColor": "#ffffff",
        "alternateRows": true
      },
      "speakerNotes": "Highlight consistent revenue growth and improving margins"
    },
    {
      "slideId": "slide_004",
      "type": "image-focus",
      "title": "Product Innovation",
      "backgroundColor": "#ffffff",
      "textColor": "#1e3a8a",
      "image": {
        "placeholderId": "img_product",
        "prompt": "Modern AI technology interface, neural network visualization, futuristic dashboard with data analytics, clean professional design, blue and white color scheme",
        "position": "left"
      },
      "content": [
        "Advanced AI algorithms",
        "Real-time data processing",
        "Scalable cloud architecture",
        "Enterprise-grade security"
      ],
      "speakerNotes": "Demo the product interface if possible"
    },
    {
      "slideId": "slide_005",
      "type": "chart",
      "title": "Customer Growth",
      "backgroundColor": "#ffffff",
      "textColor": "#1e3a8a",
      "chartData": {
        "type": "line",
        "title": "Monthly Active Users",
        "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
        "datasets": [
          {
            "label": "Total Users",
            "data": [1200, 1900, 2800, 4200, 6100, 8500, 11200, 14500],
            "backgroundColor": "#3b82f6"
          },
          {
            "label": "Paying Customers",
            "data": [500, 750, 1100, 1650, 2400, 3200, 4100, 5300],
            "backgroundColor": "#10b981"
          }
        ],
        "xAxisLabel": "Month",
        "yAxisLabel": "Users",
        "showLegend": true
      },
      "speakerNotes": "Point out the acceleration in user growth"
    },
    {
      "slideId": "slide_006",
      "type": "comparison",
      "title": "Before vs After",
      "backgroundColor": "#ffffff",
      "textColor": "#1e3a8a",
      "leftSide": {
        "title": "Before Our Solution",
        "content": {
          "type": "text",
          "items": [
            "Manual data processing",
            "High error rates (15%)",
            "Slow turnaround (5 days)",
            "Limited scalability"
          ]
        }
      },
      "rightSide": {
        "title": "After Our Solution",
        "content": {
          "type": "text",
          "items": [
            "Automated workflows",
            "Error rate < 1%",
            "Real-time processing",
            "Unlimited scale"
          ]
        }
      },
      "speakerNotes": "Use customer testimonials if available"
    }
    ,
    {
      "slideId": "slide_007",
      "type": "diagram",
      "title": "Process Flow",
      "backgroundColor": "#ffffff",
      "textColor": "#1e3a8a",
      "diagram": {
        "mermaid": "flowchart TD; A[Input] --> B[Processing]; B --> C[Output];"
      },
      "speakerNotes": "Use a simple flowchart to explain the process."
    }
  ]
}

CRITICAL GUIDELINES:

1. **Chart Data**: Use REAL data extracted from documents. Make charts editable in PowerPoint.

2. **Table Data**: Include actual numbers from documents. Format with headers and rows.

3. **Image Prompts**:
   - Write detailed prompts (25-40 words)
   - Specify: subject, style, mood, composition, colors
   - Make prompts professional and business-appropriate
   - Example: "Modern office environment with diverse team collaborating, bright natural lighting, professional photography style, blue and white color palette, clean and minimal aesthetic"

4. **Text Content**:
   - Keep bullet points concise (8-12 words)
   - Use action-oriented language
   - Include quantifiable metrics
   - Make it editable (plain text, not embedded in images)

5. **Slide Types**:
   - title: Opening slide with title/subtitle
   - two-column: Split layout (text + chart, text + image, etc.)
   - data: Table-focused slide
   - chart: Full-size chart slide
   - diagram: Mermaid diagram slide (flowchart, sequence, gantt, etc.)
   - image-focus: Large image with supporting text
   - comparison: Side-by-side comparison
   - content: Traditional bullet point slide

6. **Speaker Notes**: Add detailed notes for presenters

7. **Color Scheme**: Use professional colors consistently

Return ONLY valid JSON. No markdown formatting.

${selfCheckBlock}`;

    const result = await getTextModel().generateContent(prompt);
    const response = result.response.text().trim();
    const cleaned = response.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
    const parsed = parseJsonFromModel(cleaned);

    if (!parsed.metadata || !Array.isArray(parsed.slides)) {
      throw new Error('Invalid JSON structure');
    }

    return parsed;
  } catch (error) {
    console.error('Editable presentation generation error:', error);
    throw new Error(`Failed to generate presentation: ${error.message}`);
  }
};

/**
 * Regenerate a single slide based on context and user prompt.
 */
export const regenerateSlideJSON = async (documentChunks, slide, userPrompt = '') => {
  try {
    const context = documentChunks.map((chunk, idx) =>
      `[Chunk ${idx + 1}]:\n${chunk.text}\nPage: ${chunk.metadata.page || idx}\n`
    ).join('\n');

    const prompt = `You are a presentation editor. Update ONE slide only.
Return valid JSON for a single slide object.
Do NOT include any extra keys outside the slide object.
Preserve slideId and type unless the user explicitly requests a different type.
Use ONLY the provided document context for factual claims.
If a fact is missing, add a bullet starting with "MISSING:" that states exactly what data is needed.

Current slide JSON:
${JSON.stringify(slide, null, 2)}

User request:
${userPrompt}

Document Context:
${context}

Return ONLY the slide JSON object.`;

    const result = await getTextModel().generateContent(prompt);
    const updated = parseJsonFromModel(result.response.text().trim());
    updated.slideId = slide.slideId;
    updated.type = slide.type;
    return updated;
  } catch (error) {
    console.error('Slide regeneration error:', error);
    throw new Error(`Failed to regenerate slide: ${error.message}`);
  }
};

/**
 * Legacy API used by pptController.
 */
export const generateComprehensiveDeck = async (
  documentChunks,
  userPrompt = '',
  deckType = '',
  slideCount = 0
) => {
  const presentation = await generateEditablePresentationJSON(documentChunks, userPrompt, deckType, slideCount);
  return { presentation };
};

/**
 * Extract image prompts from presentation JSON.
 */
export const extractImagePrompts = (presentationJSON) => {
  const imagePrompts = [];
  const maxPrompts = parseInt(process.env.MAX_IMAGE_PROMPTS || '2', 10);

  for (const slide of presentationJSON.slides) {
    if (slide.image && slide.image.prompt) {
      imagePrompts.push({
        slideId: slide.slideId,
        placeholderId: slide.image.placeholderId,
        prompt: slide.image.prompt,
        position: slide.image.position || 'center',
      });
      if (imagePrompts.length >= maxPrompts) return imagePrompts;
    }

    if (slide.backgroundImage && slide.backgroundImage.prompt) {
      imagePrompts.push({
        slideId: slide.slideId,
        placeholderId: slide.backgroundImage.placeholderId,
        prompt: slide.backgroundImage.prompt,
        position: 'background',
      });
      if (imagePrompts.length >= maxPrompts) return imagePrompts;
    }

    const checkColumn = (column) => {
      if (column && column.type === 'image' && column.prompt) {
        imagePrompts.push({
          slideId: slide.slideId,
          placeholderId: column.placeholderId,
          prompt: column.prompt,
          position: 'column',
        });
        if (imagePrompts.length >= maxPrompts) return true;
      }
      return false;
    };

    if (slide.leftColumn && checkColumn(slide.leftColumn)) return imagePrompts;
    if (slide.rightColumn && checkColumn(slide.rightColumn)) return imagePrompts;
    if (slide.leftSide && slide.leftSide.content && checkColumn(slide.leftSide.content)) {
      return imagePrompts;
    }
    if (slide.rightSide && slide.rightSide.content && checkColumn(slide.rightSide.content)) {
      return imagePrompts;
    }
  }

  return imagePrompts;
};

export default {
  generateOutline,
  generateEmbedding,
  generateEmbeddingsBatch,
  generateComprehensiveDeck,
  generateEditablePresentationJSON,
  extractImagePrompts,
};
