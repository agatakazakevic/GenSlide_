import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  GripVertical,
  Loader,
  Plus,
  Presentation,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
} from 'lucide-react';

import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css'; // or black, simple, serif
import ChartBuilder from './components/ChartBuilder.jsx';
import ChartBuilderPanel from './components/ChartBuilderPanel.jsx';
import { buildVisualPrompt, visualTemplates } from './data/visualLibrary.js';
import ChartPreview from './components/ChartPreview.jsx';
import IrSlide from './components/IrSlide.jsx';
import IRDeckTemplateSystem, { IRDeckSlide } from './components/IRDeckTemplateSystem.jsx';
import AgenticSlideEditor from './components/AgenticSlideEditor.jsx';
import SlideEditor from './components/SlideEditor.jsx';
import './styles/ir-theme.css';
import mermaid from 'mermaid';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const MULTI_AGENT_API_BASE =
  import.meta.env.VITE_MULTI_AGENT_API_URL || 'http://localhost:8000';
const USER_ID = import.meta.env.VITE_USER_ID;
const AGENTIC_BASE_WIDTH = 1920;
const AGENTIC_BASE_HEIGHT = 1080;

const withUserId = (headers = {}) =>
  USER_ID ? { ...headers, 'X-User-ID': String(USER_ID) } : headers;
const DEMO_MODE = ['true', '1', 'yes'].includes(
  String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase()
);

const demoDocumentsStore = [
  { id: 'demo-1', filename: 'Investor Brief.pdf', numPages: 18 },
  { id: 'demo-2', filename: 'Market Research.pdf', numPages: 24 },
];

const demoOutlineText = `## Presentation Outline

| Slide | Section Title | Key Bullet Points |
| :---: | :--- | :--- |
| **1** | **New Business Opportunity** | * Executive summary and key themes |
|  |  | * Market tailwinds and timing |
| **2** | **The Gap We Solve** | * Fragmented access to tools |
|  |  | * Cost and complexity barriers |
| **3** | **Solution Overview** | * Unified platform + services |
|  |  | * Clear value across segments |
| **4** | **Go-to-Market Plan** | * Channel strategy + partnerships |
|  |  | * 12-month milestones |
| **5** | **Financial Outlook** | * Revenue trajectory |
|  |  | * EBITDA expansion |
| **6** | **Next Steps** | * Pilot launch and KPI targets |`;

const IR_OUTLINE_TEMPLATE = `## Table of Contents

I. Market Status and Problems (Market Status & Problem)
II. Solutions and Detailed Contents (Solution & Technology)
III. Commercialization Strategy (Scale-up)
IV. Startup Company Overview
V. R&D Safety and Security Measures Implementation Plan

Slides per section (one slide per item):
- Market Status and Problems
- Technology Development Summary (Solution)
- Technology Development Details and Goals (Technology & Goal)
- Current Status of Technology Development (Preparation Status)
- Standardization Strategy
- Task Breakdown and Implementation Schedule
- Target Market and Competitor Analysis
- Commercialization Plan
- Global Expansion Strategy
- Operational Support Plan
- Job Creation and Expected Effects
- Basis for Commercialization Target Estimation
- Startup Company Overview
- Safety Measures Implementation Plan
- Security Measures Implementation Plan
- Technology Leakage Prevention Measures
- Other Related Measures Implementation Plan`;

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
| **17** | **Other Related Measures Implementation Plan** | * Additional compliance |`;

const createDemoPresentation = () => ({
  metadata: {
    title: 'Snapdeck Demo',
    subtitle: 'IR-grade storytelling',
    author: 'Snapdeck',
    theme: 'modern',
  },
  slides: [
    {
      slideId: 'slide_001',
      type: 'title',
      title: 'New Business Opportunity',
      subtitle: 'Revolutionizing Access to Ideas and Technology',
    },
    {
      slideId: 'slide_002',
      type: 'content',
      title: 'The Gap We Solve',
      subtitle: 'Why now, why us',
      content: [
        'Fragmented access to creative tools',
        'Cost and complexity block adoption',
        'Demand for unified platforms is accelerating',
      ],
    },
    {
      slideId: 'slide_003',
      type: 'two-column',
      title: 'Solution Overview',
      subtitle: 'Two-sided value creation',
      leftColumn: {
        type: 'text',
        items: ['Servicing', 'Simplifying', 'Solving', 'Innovating'],
      },
      rightColumn: {
        type: 'text',
        items: ['Creative industries focus', 'Tech-led enablement', 'Affordability first', 'Creative finance'],
      },
    },
    {
      slideId: 'slide_004',
      type: 'content',
      title: 'Go-to-Market Plan',
      subtitle: 'Year 1 milestones',
      content: ['Pilot launches with 3 partners', 'Channel strategy + enterprise motion', 'Global rollout roadmap'],
      image: {
        placeholderId: 'img_slide_004',
        prompt: 'A clean timeline graphic with milestones and dates.',
        frame: { x: 58, y: 22, w: 32, h: 40 },
      },
    },
    {
      slideId: 'slide_005',
      type: 'content',
      title: 'Financial Outlook',
      subtitle: 'Growth trajectory',
      content: ['Revenue accelerates as adoption scales', 'Margin expansion through automation'],
      chartData: {
        type: 'bar',
        title: 'Revenue ($M)',
        labels: ['2023', '2024', '2025E', '2026E'],
        datasets: [
          {
            label: 'Revenue',
            data: [85, 120, 165, 230],
            backgroundColor: '#3b82f6',
          },
        ],
        showLegend: true,
      },
    },
    {
      slideId: 'slide_006',
      type: 'content',
      title: 'Next Steps',
      subtitle: 'Focus for the next 90 days',
      content: ['Finalize pilot scope', 'Activate GTM assets', 'Track KPI milestones weekly'],
    },
  ],
});

const demoApi = {
  uploadDocument: async (file) => {
    const doc = {
      id: `demo-${Date.now()}`,
      filename: file?.name || 'Uploaded.pdf',
      numPages: Math.max(8, Math.round((file?.size || 640000) / 35000)),
    };
    demoDocumentsStore.push(doc);
    return { document: doc };
  },
  listDocuments: async () => ({ documents: [...demoDocumentsStore] }),
  deleteDocument: async (id) => {
    const idx = demoDocumentsStore.findIndex((doc) => doc.id === id);
    if (idx >= 0) demoDocumentsStore.splice(idx, 1);
    return { ok: true };
  },
  getDocumentPreview: async (documentId) => ({
    success: true,
    preview: {
      filename: `Demo_${documentId || 'Document'}.pdf`,
      preview: 'Demo preview content.',
    },
  }),
  generateOutline: async () => ({ outline: demoOutlineText }),
  slidespeakGenerate: async () => ({ data: { task_id: 'demo-task' } }),
  slidespeakStatus: async () => ({ data: { task_status: 'SUCCESS', request_id: 'demo-request' } }),
  slidespeakImport: async () => ({ presentation: createDemoPresentation(), downloadUrl: '' }),
  slidespeakTemplates: async () => ({
    templates: [
      {
        name: 'default',
        images: {
          cover: 'https://app.slidespeak.co/images/themes/default-cover.jpg',
          content: 'https://app.slidespeak.co/images/themes/default-content.jpg',
        },
      },
      {
        name: 'gradient',
        images: {
          cover: 'https://app.slidespeak.co/images/themes/gradient-cover.jpg',
          content: 'https://app.slidespeak.co/images/themes/gradient-content.jpg',
        },
      },
    ],
  }),
  editChart: async (chartData) => ({ chartData: chartData || {} }),
  autoGenerateCharts: async () => ({
    candidates: [
      {
        type: 'table',
        title: 'Consolidated Results',
        template: 'results',
        confidence: 0.62,
        table: {
          columns: ['Item', 'FY2025.2Q', 'FY2026.2Q', 'YoY'],
          rows: [
            ['Operating Revenues', '¥6,590.6B', '¥6,772.7B', '+¥182.1B'],
            ['EBITDA', '¥1,685.6B', '¥1,740.5B', '+¥54.9B'],
          ],
        },
      },
    ],
    missing: [],
  }),
  agenticGetStatus: async (presentationId) => ({
    id: presentationId,
    status: 'completed',
    progress: 100,
    message: 'Demo presentation ready.',
    download_url: '/demo-download',
  }),
  agenticGetJson: async () => JSON.stringify(createDemoPresentation(), null, 2),
  agenticSaveHtml: async () => ({ status: 'ok' }),
};

const api = DEMO_MODE
  ? demoApi
  : {
  uploadDocument: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },
  listDocuments: async () => {
    const response = await fetch(`${API_BASE}/documents`);
    if (!response.ok) throw new Error('Failed to fetch documents');
    return response.json();
  },
  deleteDocument: async (id) => {
    const response = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete document');
    return response.json();
  },
  generateOutline: async (documentIds, userPrompt = '', deckType = '', slideCount = 0) => {
    const response = await fetch(`${API_BASE}/generate/outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds, userPrompt, deckType, slideCount }),
    });
    if (!response.ok) throw new Error('Analysis failed');
    return response.json();
  },
  slidespeakGenerate: async (payload) => {
    const response = await fetch(`${API_BASE}/slidespeak/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('SlideSpeak generation failed');
    return response.json();
  },
  slidespeakStatus: async (taskId) => {
    const response = await fetch(`${API_BASE}/slidespeak/status/${taskId}`);
    if (!response.ok) throw new Error('SlideSpeak status check failed');
    return response.json();
  },
  slidespeakImport: async (requestId) => {
    const response = await fetch(`${API_BASE}/slidespeak/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    });
    if (!response.ok) throw new Error('SlideSpeak import failed');
    return response.json();
  },
  slidespeakTemplates: async () => {
    const response = await fetch(`${API_BASE}/slidespeak/templates`);
    if (!response.ok) throw new Error('SlideSpeak template fetch failed');
    return response.json();
  },
  slidespeakInsertChart: async ({ filename, slideIndex, imageData, frame }) => {
    const response = await fetch(`${API_BASE}/slidespeak/insert-chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, slideIndex, imageData, frame }),
    });
    if (!response.ok) throw new Error('SlideSpeak chart insert failed');
    return response.json();
  },
  slidespeakPreviewImages: async (filename) => {
    const response = await fetch(`${API_BASE}/slidespeak/preview-images/${filename}`);
    if (!response.ok) throw new Error('SlideSpeak preview failed');
    return response.json();
  },
  slidespeakKnowledge: async ({ query, documentIds, maxTokens }) => {
    const response = await fetch(`${API_BASE}/slidespeak/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, documentIds, maxTokens }),
    });
    if (!response.ok) throw new Error('SlideSpeak knowledge fetch failed');
    return response.json();
  },
  slidespeakKnowledgeKv: async ({ query, documentIds, maxTokens }) => {
    const response = await fetch(`${API_BASE}/slidespeak/knowledge-kv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, documentIds, maxTokens }),
    });
    if (!response.ok) throw new Error('SlideSpeak KV extraction failed');
    return response.json();
  },
  getDocumentPreview: async (documentId) => {
    const response = await fetch(`${API_BASE}/documents/${documentId}/preview`);
    if (!response.ok) throw new Error('Failed to fetch document preview');
    return response.json();
  },
  editChart: async (chartData, prompt, context = {}) => {
    const response = await fetch(`${API_BASE}/generate/chart-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chartData, prompt, context }),
    });
    if (!response.ok) throw new Error('Chart edit failed');
    return response.json();
  },
  autoGenerateCharts: async (slide, documentIds, chartTypes = []) => {
    const response = await fetch(`${API_BASE}/generate/auto-chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slide, documentIds, chartTypes }),
    });
    if (!response.ok) throw new Error('Auto chart generation failed');
    return response.json();
  },
  agenticGenerateHtml: async (payload) => {
    const response = await fetch(`${MULTI_AGENT_API_BASE}/api/presentations/create-html`, {
      method: 'POST',
      headers: withUserId({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        topic: payload.userPrompt || payload.topic || 'Presentation',
        num_slides: payload.slideCount || 10,
        template_style: payload.style || 'auto',
        tone: payload.tone || 'professional',
        use_real_ai: payload.use_real_ai ?? true,
        template_id: payload.templateId || null,
        template_hint: payload.templateHint || null,
        logo_path: payload.logoPath || null,
      }),
    });
    if (!response.ok) throw new Error('Agentic HTML generation failed');
    return response.json();
  },
  uploadAgenticLogo: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${MULTI_AGENT_API_BASE}/api/assets/logo`, {
      method: 'POST',
      headers: withUserId({}),
      body: formData,
    });
    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json();
        detail = payload?.detail || '';
      } catch (err) {
        try {
          detail = await response.text();
        } catch {
          detail = '';
        }
      }
      throw new Error(detail || 'Logo upload failed');
    }
    return response.json();
  },
  agenticGetStatus: async (presentationId) => {
    const response = await fetch(
      `${MULTI_AGENT_API_BASE}/api/presentations/${presentationId}/status`,
      { headers: withUserId() }
    );
    if (!response.ok) throw new Error('Agentic status fetch failed');
    return response.json();
  },
  agenticGetJson: async (presentationId) => {
    const response = await fetch(
      `${MULTI_AGENT_API_BASE}/api/presentations/${presentationId}/download-json`,
      { headers: withUserId() }
    );
    if (!response.ok) throw new Error('Agentic JSON fetch failed');
    const text = await response.text();
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  },
  agenticSaveHtml: async (presentationId, html) => {
    const response = await fetch(
      `${MULTI_AGENT_API_BASE}/api/presentations/${presentationId}/save-html`,
      {
        method: 'POST',
        headers: withUserId({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ html }),
      }
    );
    if (!response.ok) throw new Error('Agentic HTML save failed');
    return response.json();
  },
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[•·]/g, '')
    .trim();
const normalizeSlidespeakTemplates = (templates) =>
  ensureArray(templates).filter((template) => template && template.name);
const splitItemsToColumns = (items = []) => {
  const list = ensureArray(items).filter(Boolean);
  if (!list.length) return { left: [], right: [] };
  const mid = Math.ceil(list.length / 2);
  return { left: list.slice(0, mid), right: list.slice(mid) };
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const themeFallbacks = {
  'ir-deck': {
    bg: '#F5FAFF',
    text: '#0F172A',
  },
};

const splitBulletsEvenly = (bullets, parts) => {
  const list = ensureArray(bullets).filter(Boolean);
  if (!list.length || parts <= 1) return [list];
  const per = Math.ceil(list.length / parts);
  return Array.from({ length: parts }).map((_, idx) =>
    list.slice(idx * per, idx * per + per)
  );
};

const trimText = (value, maxLen) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
};

const clampItems = (items, maxCount, maxLen) =>
  ensureArray(items)
    .filter(Boolean)
    .slice(0, maxCount)
    .map((item) => trimText(item, maxLen));

const toProblemItems = (bullets = []) =>
  clampItems(bullets, 4, 120).map((item) => {
    const text = String(item);
    const [title, ...rest] = text.split(':');
    const description = trimText(rest.join(':').trim() || text, 120);
    return { title: trimText(title.trim() || text, 40), description };
  });

const toFeatureItems = (bullets = []) =>
  clampItems(bullets, 3, 120).map((item) => {
    const text = String(item);
    const [title, ...rest] = text.split(':');
    const description = trimText(rest.join(':').trim() || text, 120);
    return { title: trimText(title.trim() || text, 40), description };
  });

const toMetrics = (bullets = []) =>
  clampItems(bullets, 3, 80).map((item) => {
    const text = String(item);
    const match = text.match(/([0-9]+[0-9.,%$]*[A-Za-z%]*)/);
    const value = match ? match[1] : text;
    const label = match ? text.replace(match[1], '').trim() || 'Metric' : 'Metric';
    return { value: trimText(value, 12), label: trimText(label, 50) };
  });

const applyIrDeckTemplateData = (presentation) => {
  if (!presentation?.slides) return presentation;
  const templates = [
    'cover',
    'market',
    'solution',
    'commercialization',
    'team',
    'security',
    'competitive',
    'financials',
    'roadmap',
    'businessModel',
    'marketSize',
  ];
  const inferTemplateFromTitle = (slideItem) => {
    const title = String(slideItem?.title || '').toLowerCase();
    if (!title) return '';
    if (title.includes('competitive') || title.includes('competitor')) return 'competitive';
    if (title.includes('market size') || title.includes('tam') || title.includes('sam') || title.includes('som'))
      return 'marketSize';
    if (title.includes('financial') || title.includes('revenue') || title.includes('projection'))
      return 'financials';
    if (title.includes('roadmap') || title.includes('timeline') || title.includes('schedule') || title.includes('task'))
      return 'roadmap';
    if (title.includes('business model')) return 'businessModel';
    if (title.includes('team') || title.includes('leadership')) return 'team';
    if (title.includes('security') || title.includes('safety') || title.includes('compliance'))
      return 'security';
    if (title.includes('commercial') || title.includes('go-to-market') || title.includes('gtm'))
      return 'commercialization';
    if (title.includes('solution') || title.includes('technology') || title.includes('development'))
      return 'solution';
    if (title.includes('market status') || title.includes('problem')) return 'market';
    return '';
  };

  const company = presentation.metadata?.title || 'Company';
  const presenter = presentation.metadata?.author || 'Presenter';
  const date = new Date().toLocaleDateString();

  const slides = presentation.slides.map((slideItem, idx) => {
    const inferredTemplate = inferTemplateFromTitle(slideItem);
    const templateId = slideItem.irTemplate || inferredTemplate || templates[idx] || 'content';
    const bullets =
      slideItem.content ||
      slideItem.leftColumn?.items ||
      slideItem.rightColumn?.items ||
      slideItem.leftSide?.content?.items ||
      slideItem.rightSide?.content?.items ||
      [];

    let irData = { title: slideItem.title || 'Slide Title' };

    if (templateId === 'cover') {
      irData = {
        category: 'IR Deck',
        title: trimText(slideItem.title || 'Investor Relations Presentation', 80),
        subtitle: trimText(slideItem.subtitle || (bullets[0] ? String(bullets[0]) : ''), 100),
        company,
        date,
        presenter,
      };
    } else if (templateId === 'market') {
      const [left, right] = splitBulletsEvenly(bullets, 2);
      irData = {
        title: trimText(slideItem.title || 'Market Status & Key Problems', 60),
        marketPoints: clampItems(left, 4, 120),
        problems: toProblemItems(right).slice(0, 3),
      };
    } else if (templateId === 'solution') {
      irData = {
        title: trimText(slideItem.title || 'Our Solution & Technology', 60),
        features: toFeatureItems(bullets).map((feature) => ({
          ...feature,
          description: trimText(feature.description, 90),
        })),
        developmentStages: [
          { name: 'Core Technology', progress: 90 },
          { name: 'Standardization', progress: 70 },
          { name: 'Commercialization', progress: 60 },
          { name: 'Market Validation', progress: 45 },
        ],
      };
    } else if (templateId === 'commercialization') {
      const metrics = toMetrics(bullets);
      const strategy = clampItems(bullets.slice(2), 3, 120).map((item, strategyIdx) => ({
        phase: `Phase ${strategyIdx + 1}`,
        description: String(item),
      }));
      irData = {
        title: trimText(slideItem.title || 'Commercialization Strategy', 70),
        metrics: metrics.slice(0, 2),
        strategy,
        marketData: [
          { year: '2024', value: 100 },
          { year: '2025', value: 250 },
          { year: '2026', value: 450 },
          { year: '2027', value: 750 },
        ],
      };
    } else if (templateId === 'team') {
      const members = clampItems(bullets, 4, 120).map((item, memberIdx) => ({
        name: `Leader ${memberIdx + 1}`,
        role: 'Executive',
        bio: trimText(item, 80),
      }));
      irData = {
        title: trimText(slideItem.title || 'Leadership Team', 60),
        subtitle: trimText(slideItem.subtitle || 'World-class team with proven track record', 70),
        members,
      };
    } else if (templateId === 'security') {
      const groups = splitBulletsEvenly(bullets, 4);
      irData = {
        title: trimText(slideItem.title || 'Safety & Security Compliance', 70),
        sections: [
          { title: 'Safety Measures', measures: clampItems(groups[0] || [], 3, 100) },
          { title: 'Security Implementation', measures: clampItems(groups[1] || [], 3, 100) },
          { title: 'IP Protection', measures: clampItems(groups[2] || [], 3, 100) },
          { title: 'Compliance Measures', measures: clampItems(groups[3] || [], 3, 100) },
        ],
      };
    } else if (templateId === 'competitive') {
      irData = {
        title: trimText(slideItem.title || 'Competitive Landscape', 70),
        competitors: [
          { name: 'Us', x: 75, y: 70, isUs: true },
          { name: 'Comp A', x: 50, y: 60, isUs: false },
          { name: 'Comp B', x: 40, y: 40, isUs: false },
          { name: 'Comp C', x: 60, y: 30, isUs: false },
          { name: 'Comp D', x: 30, y: 50, isUs: false },
        ],
        advantages: toMetrics(bullets)
          .slice(0, 3)
          .map((metric) => ({
            metric: metric.value || '1x',
            description: metric.label || 'Advantage',
          })),
      };
    } else if (templateId === 'financials') {
      irData = {
        title: trimText(slideItem.title || 'Financial Projections', 70),
        projections: [
          { year: '2024', revenue: 2, expenses: 1.5 },
          { year: '2025', revenue: 8, expenses: 4 },
          { year: '2026', revenue: 25, expenses: 10 },
          { year: '2027', revenue: 60, expenses: 20 },
          { year: '2028', revenue: 120, expenses: 35 },
        ],
        metrics: toMetrics(bullets)
          .slice(0, 3)
          .map((metric) => ({
            label: metric.label || 'Metric',
            value: metric.value || '0',
            subtitle: '',
          })),
        unitEconomics: [
          { label: 'Customer LTV', value: '$125K' },
          { label: 'CAC', value: '$18K' },
          { label: 'LTV:CAC Ratio', value: '7:1' },
          { label: 'Churn Rate', value: '<5%' },
        ],
      };
    } else if (templateId === 'roadmap') {
      irData = {
        title: trimText(slideItem.title || 'Product Roadmap', 70),
        phases: [
          {
            quarter: 'Q1 2026',
            title: 'MVP Launch',
            completed: true,
            milestones: clampItems(bullets.slice(0, 3), 3, 80),
          },
          {
            quarter: 'Q2 2026',
            title: 'Enterprise Features',
            completed: true,
            milestones: clampItems(bullets.slice(3, 6), 3, 80),
          },
          {
            quarter: 'Q3 2026',
            title: 'Scale & Optimize',
            completed: false,
            milestones: clampItems(bullets.slice(6, 9), 3, 80),
          },
          {
            quarter: 'Q4 2026',
            title: 'Market Expansion',
            completed: false,
            milestones: clampItems(bullets.slice(9, 12), 3, 80),
          },
        ],
      };
    } else if (templateId === 'businessModel') {
      irData = {
        title: trimText(slideItem.title || 'Business Model Canvas', 70),
        keyPartners: clampItems(bullets.slice(0, 3), 3, 60),
        keyActivities: clampItems(bullets.slice(3, 6), 3, 60),
        keyResources: clampItems(bullets.slice(6, 9), 3, 60),
        valueProposition: clampItems(bullets.slice(9, 13), 4, 60),
        customerRelations: clampItems(bullets.slice(13, 15), 2, 60),
        channels: clampItems(bullets.slice(15, 17), 2, 60),
        customerSegments: clampItems(bullets.slice(17, 20), 3, 60),
        costStructure: clampItems(bullets.slice(20, 23), 3, 60),
        revenueStreams: clampItems(bullets.slice(23, 26), 3, 60),
      };
    } else if (templateId === 'marketSize') {
      irData = {
        title: trimText(slideItem.title || 'Market Size & Opportunity', 70),
        tam: '500',
        sam: '150',
        som: '15',
        segments: [
          { name: 'Enterprise', value: 45, color: '#3B82F6' },
          { name: 'SMB', value: 30, color: '#60A5FA' },
          { name: 'Government', value: 15, color: '#93C5FD' },
          { name: 'Other', value: 10, color: '#94A3B8' },
        ],
      };
    }

    return {
      ...slideItem,
      irTemplate: templateId,
      irData,
    };
  });

  return { ...presentation, slides };
};
const allowedDocExtensions = ['.pdf', '.csv', '.tsv', '.xls', '.xlsx'];
const isAllowedDocument = (file) => {
  if (!file) return false;
  const name = file.name?.toLowerCase() || '';
  const ext = name.slice(name.lastIndexOf('.'));
  if (allowedDocExtensions.includes(ext)) return true;
  return file.type === 'application/pdf' || file.type === 'text/csv';
};

const ensureTextItems = (slide) =>
  ensureArray(
    slide?.content ||
      slide?.leftColumn?.items ||
      slide?.rightColumn?.items ||
      slide?.leftSide?.content?.items ||
      slide?.rightSide?.content?.items
  );

const mergeImportedSlide = (base, incoming) => {
  if (!base) return incoming;
  if (!incoming) return base;

  const merged = { ...base };
  if (incoming.title) merged.title = incoming.title;
  if (incoming.subtitle !== undefined) merged.subtitle = incoming.subtitle;
  if (incoming.irTemplate) merged.irTemplate = incoming.irTemplate;
  if (incoming.irData) merged.irData = incoming.irData;

  const incomingItems = ensureTextItems(incoming);

  if (base.type === 'two-column' && base.leftColumn?.type === 'text') {
    merged.leftColumn = { ...base.leftColumn, items: incoming.leftColumn?.items || incomingItems };
    if (incoming.chartData && base.rightColumn?.type === 'chart') {
      merged.rightColumn = { ...base.rightColumn, chartData: incoming.chartData };
    }
  } else if (base.type === 'comparison') {
    merged.leftSide = {
      ...base.leftSide,
      content: {
        ...base.leftSide?.content,
        items: incomingItems.length ? incomingItems : base.leftSide?.content?.items || [],
      },
    };
  } else if (base.content) {
    merged.content = incomingItems.length ? incomingItems : base.content;
  } else if (base.leftColumn?.type === 'text') {
    merged.leftColumn = {
      ...base.leftColumn,
      items: incomingItems.length ? incomingItems : base.leftColumn.items,
    };
  }

  if (incoming.chartData) {
    if (base.chartData) merged.chartData = incoming.chartData;
    if (base.rightColumn?.type === 'chart') {
      merged.rightColumn = { ...base.rightColumn, chartData: incoming.chartData };
    }
  }

  if (incoming.table && base.table) {
    merged.table = incoming.table;
  }

  return merged;
};

const mergeImportedPresentation = (base, incoming) => {
  if (!base) return incoming;
  if (!incoming) return base;
  const baseSlides = base.slides || [];
  const incomingSlides = incoming.slides || [];
  const maxSlides = Math.max(baseSlides.length, incomingSlides.length);
  const slides = Array.from({ length: maxSlides }).map((_, idx) =>
    mergeImportedSlide(baseSlides[idx], incomingSlides[idx])
  );
  const metadata = { ...base.metadata, ...incoming.metadata };
  if (base.metadata?.theme === 'ir-deck') {
    metadata.theme = base.metadata.theme;
  } else if (base.metadata?.theme && !incoming.metadata?.theme) {
    metadata.theme = base.metadata.theme;
  }
  return {
    ...base,
    metadata,
    slides,
  };
};

const parseOutline = (text) => {
  const lines = text.split('\n');
  const slides = [];
  let currentSlide = null;
  const splitBulletsFromCell = (value) => {
    const cleaned = value.replace(/^\*\s?/, '').trim();
    if (!cleaned) return [];
    const parts = cleaned
      .split(/\s*\/\s*|\s*;\s*|\s*•\s*/g)
      .map((item) => item.trim())
      .filter(Boolean);
    return parts.length ? parts : [cleaned];
  };

  const pushCurrent = () => {
    if (currentSlide) slides.push(currentSlide);
    currentSlide = null;
  };

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.trim().startsWith('|')) {
      const parts = line.split('|').map((part) => part.trim());
      if (parts.length < 4) continue;
      const slideCol = parts[1];
      const titleCol = parts[2];
      const bulletCol = parts[3];

      if (slideCol && slideCol !== ':---:' && slideCol !== 'Slide') {
        pushCurrent();
        currentSlide = {
          number: slideCol.replace(/\*\*/g, '').trim(),
          title: titleCol.replace(/\*\*/g, '').trim(),
          bullets: [],
        };
      }

      if (currentSlide && bulletCol && !bulletCol.includes('Key Bullet Points')) {
        const bullets = splitBulletsFromCell(bulletCol);
        bullets.forEach((bullet) => {
          if (bullet) currentSlide.bullets.push(bullet);
        });
      }
    }
  }

  pushCurrent();
  return slides;
};

const buildVisualPreference = (visuals) => {
  if (!visuals) return '';
  const parts = [];
  if (visuals.image) parts.push('image');
  if (visuals.table) parts.push('table');
  if (!parts.length) return '';
  return `Visual preference: ${parts.join(', ')}`;
};

const serializeOutline = (slides, heading = 'Presentation Outline') => {
  const rows = slides.flatMap((slide, idx) => {
    const slideNumber = slide.number || String(idx + 1);
    const title = slide.title || `Slide ${slideNumber}`;
    const bullets = slide.bullets.length ? slide.bullets : ['(Add key points)'];
    const visualPreference = buildVisualPreference(slide.visuals);
    const allBullets = visualPreference ? [...bullets, visualPreference] : bullets;
    return allBullets.map((bullet, bulletIdx) => [
      bulletIdx === 0 ? `**${slideNumber}**` : '',
      bulletIdx === 0 ? `**${title}**` : '',
      `* ${bullet}`,
    ]);
  });

  return [
    `## ${heading}`,
    '',
    '| Slide | Section Title | Key Bullet Points |',
    '| :---: | :--- | :--- |',
    ...rows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`),
  ].join('\n');
};

const IR_DEFAULT_BRAND = '#0077c8';

const applyDefaults = (target, defaults) => {
  const next = { ...target };
  Object.entries(defaults).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = applyDefaults(target?.[key] || {}, value);
      return;
    }
    if (next[key] === undefined) {
      next[key] = value;
    }
  });
  return next;
};

const getIrTemplateDefaults = (templateId, fallbackTitle = 'Slide title') => {
  const baseTitle = fallbackTitle || 'Slide title';
  switch (templateId) {
    case 'section-divider':
      return {
        sectionNumber: '01',
        title: baseTitle,
        subtitle: 'Section description',
      };
    case 'overview':
      return {
        title: baseTitle,
        subtitle: 'Financial Performance Highlights',
        metrics: [
          { label: 'Operating Revenues', value: '¥6,772.7B', change: '+2.8% YoY', trend: 'up' },
          { label: 'Operating Profit', value: '¥945.0B', change: '+2.7% YoY', trend: 'up' },
          { label: 'Net Profit', value: '¥595.7B', change: '+7.4% YoY', trend: 'up' },
        ],
        highlights: [
          'Operating Revenues, Operating Profit and Profit all increased year-over-year',
          'Operating Revenues reached new record-high levels',
          'Growth driven by all major segments',
        ],
      };
    case 'results':
      return {
        title: baseTitle,
        subtitle: 'Six Months Ended',
        table: {
          columns: ['Item', 'FY2025.2Q', 'FY2026.2Q', 'Year-on-Year', 'Change %'],
          rows: [
            ['Operating Revenues', '¥6,590.6B', '¥6,772.7B', '+¥182.1B', '+2.8%'],
            ['EBITDA', '¥1,685.6B', '¥1,740.5B', '+¥54.9B', '+3.3%'],
            ['Operating Profit', '¥920.2B', '¥945.0B', '+¥24.8B', '+2.7%'],
          ],
        },
        highlights: [
          'EBITDA excludes depreciation and amortization related to right-of-use assets.',
        ],
      };
    case 'comparison':
      return {
        title: baseTitle,
        subtitle: 'Growth driven by all major segments',
        comparison: {
          prevYear: 'FY2025.2Q',
          currentYear: 'FY2026.2Q',
          prevValue: '¥6,590.6B',
          currentValue: '¥6,772.7B',
          deltaValue: '+¥182.1B',
          deltaPercent: '(+2.8% YoY)',
        },
        cards: [
          { title: 'Growth Drivers', body: 'Explain key segment drivers and wins.' },
          { title: 'Market Conditions', body: 'Describe external factors and demand trends.' },
        ],
      };
    case 'strategy':
      return {
        title: baseTitle,
        subtitle: 'Key pillars driving sustainable value creation',
        content: [
          'Digital transformation acceleration across industries',
          'Data center infrastructure enhancement',
          'Enterprise solutions expansion',
        ],
      };
    case 'forecast':
      return {
        title: baseTitle,
        subtitle: 'Full-year forecast',
        table: {
          columns: ['Item', 'FY2025 Results', 'FY2026 Forecast', 'Year-on-Year'],
          rows: [
            ['Operating Revenues', '¥13,704.7B', '¥14,190.0B', '+¥485.3B'],
            ['EBITDA', '¥3,239.3B', '¥3,390.0B', '+¥150.7B'],
          ],
        },
        highlights: [
          'Operating Revenues, EBITDA, Operating Profit and Profit will all increase year-over-year',
        ],
      };
    case 'segment':
      return {
        title: baseTitle,
        subtitle: 'Operating revenues and profit by business segment',
        leftTable: {
          title: 'Operating Revenues by Segment',
          columns: ['Segment', 'Amount (¥B)', 'YoY'],
          rows: [
            ['Integrated ICT', '3,032.7', '+38.9'],
            ['Regional Comm.', '1,535.4', '+34.6'],
          ],
        },
        rightTable: {
          title: 'Operating Profit by Segment',
          columns: ['Segment', 'Amount (¥B)', 'YoY'],
          rows: [
            ['Integrated ICT', '474.7', '-78.6'],
            ['Regional Comm.', '187.5', '+3.7'],
          ],
        },
      };
    case 'metrics':
      return {
        title: baseTitle,
        subtitle: 'Critical metrics for the quarter',
        metrics: [
          { label: 'Revenue Growth', value: '2.8%', change: 'Year-over-Year', trend: 'up' },
          { label: 'Operating Margin', value: '14.0%', change: '+0.1pt YoY', trend: 'up' },
          { label: 'ROIC', value: '8.5%', change: '+0.3pt YoY', trend: 'up' },
        ],
        cards: [
          { title: 'Financial Health', body: 'Strong balance sheet and cash generation.' },
          { title: 'Profitability Trends', body: 'Margins expanding with higher mix services.' },
        ],
      };
    default:
      return {
        title: baseTitle,
        subtitle: 'Slide subtitle',
      };
  }
};

const DraggableImageBox = ({
  frame,
  prompt,
  onUpdate,
  onPromptChange,
  containerRef,
}) => {
  const dragStateRef = useRef(null);
  const boxRef = useRef(null);
  const [localFrame, setLocalFrame] = useState(frame);
  const localFrameRef = useRef(frame);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const isEditingPromptRef = useRef(false);
  const [localPrompt, setLocalPrompt] = useState(prompt || '');

  useEffect(() => {
    setLocalFrame(frame);
    localFrameRef.current = frame;
  }, [frame.x, frame.y, frame.w, frame.h]);

  useEffect(() => {
    setLocalPrompt(prompt || '');
  }, [prompt]);

  useEffect(() => {
    const applyDelta = (clientX, clientY) => {
      if (!dragStateRef.current) return;
      const { mode, startFrame, bounds, startLeftPx, startTopPx } = dragStateRef.current;
      const dxPx = clientX - startLeftPx;
      const dyPx = clientY - startTopPx;

      const startXpx = (startFrame.x / 100) * bounds.width;
      const startYpx = (startFrame.y / 100) * bounds.height;
      const startWpx = (startFrame.w / 100) * bounds.width;
      const startHpx = (startFrame.h / 100) * bounds.height;

      if (mode === 'move') {
        const nextXpx = clamp(startXpx + dxPx, 0, bounds.width - startWpx);
        const nextYpx = clamp(startYpx + dyPx, 0, bounds.height - startHpx);
        const nextFrame = {
          ...startFrame,
          x: (nextXpx / bounds.width) * 100,
          y: (nextYpx / bounds.height) * 100,
        };
        localFrameRef.current = nextFrame;
        setLocalFrame(nextFrame);
      }

      if (mode === 'resize') {
        const minSizePx = 40;
        const nextWpx = clamp(startWpx + dxPx, minSizePx, bounds.width - startXpx);
        const nextHpx = clamp(startHpx + dyPx, minSizePx, bounds.height - startYpx);
        const nextFrame = {
          ...startFrame,
          w: (nextWpx / bounds.width) * 100,
          h: (nextHpx / bounds.height) * 100,
        };
        localFrameRef.current = nextFrame;
        setLocalFrame(nextFrame);
      }
    };

    const handlePointerMove = (event) => applyDelta(event.clientX, event.clientY);
    const handleMouseMove = (event) => applyDelta(event.clientX, event.clientY);
    const handleTouchMove = (event) => {
      if (!event.touches?.length) return;
      applyDelta(event.touches[0].clientX, event.touches[0].clientY);
    };

    const handleUp = () => {
      if (dragStateRef.current) {
        onUpdate(localFrameRef.current);
        dragStateRef.current = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [onUpdate]);

  const startDrag = (event, mode) => {
    event.preventDefault();
    event.stopPropagation();
    if (isEditingPromptRef.current) return;
    const pointerId = event.pointerId;
    const bounds =
      containerRef?.current?.getBoundingClientRect() ||
      boxRef.current?.offsetParent?.getBoundingClientRect() ||
      event.currentTarget.getBoundingClientRect();
    const startLeftPx = event.clientX;
    const startTopPx = event.clientY;
    dragStateRef.current = {
      mode,
      startLeftPx,
      startTopPx,
      startFrame: localFrameRef.current,
      pointerId,
      bounds,
    };
    event.currentTarget.setPointerCapture?.(pointerId);
  };

  return (
    <div
      ref={boxRef}
      className="absolute z-10 border-2 border-dashed border-indigo-400 bg-indigo-50/40 rounded-lg text-xs text-indigo-700 flex items-center justify-center"
      style={{
        left: `${localFrame.x}%`,
        top: `${localFrame.y}%`,
        width: `${localFrame.w}%`,
        height: `${localFrame.h}%`,
        touchAction: 'none',
      }}
    >
      <div
        role="button"
        className="absolute inset-x-2 top-2 flex items-center gap-2 text-[11px] text-indigo-600 bg-white/80 rounded-md px-2 py-1 cursor-move"
        onPointerDown={(event) => startDrag(event, 'move')}
        onMouseDown={(event) => startDrag(event, 'move')}
        onTouchStart={(event) => startDrag(event, 'move')}
      >
        <ImageIcon className="w-4 h-4" />
        Image prompt
      </div>
      <textarea
        value={localPrompt}
        onChange={(event) => setLocalPrompt(event.target.value)}
        onFocus={() => {
          isEditingPromptRef.current = true;
          setIsEditingPrompt(true);
        }}
        onBlur={() => {
          isEditingPromptRef.current = false;
          setIsEditingPrompt(false);
          if (localPrompt !== prompt) {
            onPromptChange(localPrompt);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        className="w-full h-full bg-transparent p-4 pt-8 text-xs text-indigo-900 outline-none resize-none"
        placeholder="Describe the image to generate..."
      />
      <div
        className="absolute -bottom-3 -right-3 w-8 h-8 bg-indigo-500/90 border-2 border-white rounded-full cursor-nwse-resize shadow"
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => startDrag(event, 'resize')}
        onMouseDown={(event) => startDrag(event, 'resize')}
        onTouchStart={(event) => startDrag(event, 'resize')}
      />
    </div>
  );
};

const DraggableLogoBox = ({ frame, dataUrl, onUpdate, containerRef }) => {
  const dragStateRef = useRef(null);
  const [localFrame, setLocalFrame] = useState(frame);
  const localFrameRef = useRef(frame);

  useEffect(() => {
    setLocalFrame(frame);
    localFrameRef.current = frame;
  }, [frame.x, frame.y, frame.w, frame.h]);

  useEffect(() => {
    const applyDelta = (clientX, clientY) => {
      if (!dragStateRef.current) return;
      const { mode, startFrame, bounds, startLeftPx, startTopPx } = dragStateRef.current;
      const dxPx = clientX - startLeftPx;
      const dyPx = clientY - startTopPx;

      const startXpx = (startFrame.x / 100) * bounds.width;
      const startYpx = (startFrame.y / 100) * bounds.height;
      const startWpx = (startFrame.w / 100) * bounds.width;
      const startHpx = (startFrame.h / 100) * bounds.height;

      if (mode === 'move') {
        const nextXpx = clamp(startXpx + dxPx, 0, bounds.width - startWpx);
        const nextYpx = clamp(startYpx + dyPx, 0, bounds.height - startHpx);
        const nextFrame = {
          ...startFrame,
          x: (nextXpx / bounds.width) * 100,
          y: (nextYpx / bounds.height) * 100,
        };
        localFrameRef.current = nextFrame;
        setLocalFrame(nextFrame);
      }

      if (mode === 'resize') {
        const minSizePx = 30;
        const nextWpx = clamp(startWpx + dxPx, minSizePx, bounds.width - startXpx);
        const nextHpx = clamp(startHpx + dyPx, minSizePx, bounds.height - startYpx);
        const nextFrame = {
          ...startFrame,
          w: (nextWpx / bounds.width) * 100,
          h: (nextHpx / bounds.height) * 100,
        };
        localFrameRef.current = nextFrame;
        setLocalFrame(nextFrame);
      }
    };

    const handlePointerMove = (event) => applyDelta(event.clientX, event.clientY);
    const handlePointerUp = () => {
      if (dragStateRef.current) {
        onUpdate?.(localFrameRef.current);
      }
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onUpdate]);

  const startDrag = (event, mode) => {
    if (!containerRef?.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    dragStateRef.current = {
      mode,
      startFrame: localFrameRef.current,
      bounds,
      startLeftPx: event.clientX,
      startTopPx: event.clientY,
    };
    event.stopPropagation();
  };

  if (!dataUrl) return null;

  return (
    <div
      className="absolute border border-dashed border-blue-400 rounded-xl bg-white/90 shadow-sm"
      style={{
        left: `${localFrame.x}%`,
        top: `${localFrame.y}%`,
        width: `${localFrame.w}%`,
        height: `${localFrame.h}%`,
      }}
      onPointerDown={(event) => startDrag(event, 'move')}
    >
      <img src={dataUrl} alt="Logo" className="w-full h-full object-contain p-2" />
      <div
        className="absolute -right-2 -bottom-2 w-4 h-4 bg-blue-500 rounded-full border border-white cursor-nwse-resize"
        onPointerDown={(event) => startDrag(event, 'resize')}
      />
    </div>
  );
};

let mermaidInitialized = false;
const MermaidPreview = ({ code }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!code || !containerRef.current) return;
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'strict',
        fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
        themeVariables: {
          primaryColor: '#EAF2FF',
          primaryTextColor: '#0F172A',
          primaryBorderColor: '#3B82F6',
          lineColor: '#93C5FD',
          secondaryColor: '#DBEAFE',
          tertiaryColor: '#F8FBFF',
        },
      });
      mermaidInitialized = true;
    }

    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        containerRef.current.innerHTML = svg;
      })
      .catch(() => {
        containerRef.current.textContent = 'Diagram render failed';
      });
  }, [code]);

  return (
    <div className="w-full h-full flex items-center justify-center" ref={containerRef} />
  );
};

const DraggableChartBox = ({ frame, dataUrl, onUpdate, containerRef }) => {
  const dragStateRef = useRef(null);
  const boxRef = useRef(null);
  const [localFrame, setLocalFrame] = useState(frame);
  const localFrameRef = useRef(frame);

  useEffect(() => {
    setLocalFrame(frame);
    localFrameRef.current = frame;
  }, [frame.x, frame.y, frame.w, frame.h]);

  useEffect(() => {
    const applyDelta = (clientX, clientY) => {
      if (!dragStateRef.current) return;
      const { mode, startFrame, bounds, startLeftPx, startTopPx } = dragStateRef.current;
      const dxPx = clientX - startLeftPx;
      const dyPx = clientY - startTopPx;

      const startXpx = (startFrame.x / 100) * bounds.width;
      const startYpx = (startFrame.y / 100) * bounds.height;
      const startWpx = (startFrame.w / 100) * bounds.width;
      const startHpx = (startFrame.h / 100) * bounds.height;

      if (mode === 'move') {
        const nextXpx = clamp(startXpx + dxPx, 0, bounds.width - startWpx);
        const nextYpx = clamp(startYpx + dyPx, 0, bounds.height - startHpx);
        const nextFrame = {
          ...startFrame,
          x: (nextXpx / bounds.width) * 100,
          y: (nextYpx / bounds.height) * 100,
        };
        localFrameRef.current = nextFrame;
        setLocalFrame(nextFrame);
      }

      if (mode === 'resize') {
        const minSizePx = 40;
        const nextWpx = clamp(startWpx + dxPx, minSizePx, bounds.width - startXpx);
        const nextHpx = clamp(startHpx + dyPx, minSizePx, bounds.height - startYpx);
        const nextFrame = {
          ...startFrame,
          w: (nextWpx / bounds.width) * 100,
          h: (nextHpx / bounds.height) * 100,
        };
        localFrameRef.current = nextFrame;
        setLocalFrame(nextFrame);
      }
    };

    const handlePointerMove = (event) => applyDelta(event.clientX, event.clientY);
    const handleMouseMove = (event) => applyDelta(event.clientX, event.clientY);
    const handleTouchMove = (event) => {
      if (!event.touches?.length) return;
      applyDelta(event.touches[0].clientX, event.touches[0].clientY);
    };

    const handleUp = () => {
      if (dragStateRef.current) {
        onUpdate(localFrameRef.current);
        dragStateRef.current = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [onUpdate]);

  const startDrag = (event, mode) => {
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const bounds =
      containerRef?.current?.getBoundingClientRect() ||
      boxRef.current?.offsetParent?.getBoundingClientRect() ||
      event.currentTarget.getBoundingClientRect();
    const startLeftPx = event.clientX;
    const startTopPx = event.clientY;
    dragStateRef.current = {
      mode,
      startLeftPx,
      startTopPx,
      startFrame: localFrameRef.current,
      pointerId,
      bounds,
    };
    event.currentTarget.setPointerCapture?.(pointerId);
  };

  return (
    <div
      ref={boxRef}
      className="absolute z-10 border-2 border-dashed border-emerald-400 bg-white rounded-lg shadow-sm overflow-hidden"
      style={{
        left: `${localFrame.x}%`,
        top: `${localFrame.y}%`,
        width: `${localFrame.w}%`,
        height: `${localFrame.h}%`,
        touchAction: 'none',
      }}
      onPointerDown={(event) => startDrag(event, 'move')}
      onMouseDown={(event) => startDrag(event, 'move')}
      onTouchStart={(event) => startDrag(event, 'move')}
    >
      {dataUrl && (
        <img src={dataUrl} alt="Chart" className="w-full h-full object-contain bg-white" />
      )}
      <div
        className="absolute -bottom-2 -right-2 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full cursor-nwse-resize"
        onPointerDown={(event) => startDrag(event, 'resize')}
        onMouseDown={(event) => startDrag(event, 'resize')}
        onTouchStart={(event) => startDrag(event, 'resize')}
      />
    </div>
  );
};

const SimpleTablePreview = ({ table }) => {
  if (!table) return null;
  const headers = Array.isArray(table.headers) ? table.headers : table.columns || [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  if (!headers.length || !rows.length) return null;
  return (
    <div className="mt-4 overflow-auto border border-gray-200 rounded-lg bg-white">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            {headers.map((header, idx) => (
              <th key={`header-${idx}`} className="px-3 py-2 text-left font-semibold border-b border-gray-200">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={`row-${rowIdx}`} className="odd:bg-white even:bg-slate-50">
              {row.map((cell, cellIdx) => (
                <td key={`cell-${rowIdx}-${cellIdx}`} className="px-3 py-2 border-b border-gray-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState('home');
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  const [prompt, setPrompt] = useState('');
  const promptInputRef = useRef('');
  const promptTextareaRef = useRef(null);
  const [generationMode, setGenerationMode] = useState('outline');
  const [generationProfile, setGenerationProfile] = useState('business');
  const [isIrOutline, setIsIrOutline] = useState(false);
  const [slideCount, setSlideCount] = useState(12);
  const [theme, setTheme] = useState('modern');
  const [brandColor, setBrandColor] = useState(IR_DEFAULT_BRAND);
  const [templateId, setTemplateId] = useState('default');
  const [slidespeakUseAutoLength, setSlidespeakUseAutoLength] = useState(false);
  const [consistentMode, setConsistentMode] = useState(false);
  const [consistentPresentation, setConsistentPresentation] = useState(null);
  const [consistentMetrics, setConsistentMetrics] = useState(null);
  const [consistentPdfPath, setConsistentPdfPath] = useState('');
  const [pptxPreviewFilename, setPptxPreviewFilename] = useState('');
  const [pptxPreviewError, setPptxPreviewError] = useState('');
  const [pptxPreviewImages, setPptxPreviewImages] = useState([]);
  const [slidespeakLanguage, setSlidespeakLanguage] = useState('ORIGINAL');
  const [slidespeakTone, setSlidespeakTone] = useState('default');
  const [slidespeakVerbosity, setSlidespeakVerbosity] = useState('standard');
  const [slidespeakCustomInstructions, setSlidespeakCustomInstructions] = useState('');
  const [slidespeakFetchImages, setSlidespeakFetchImages] = useState(true);
  const [slidespeakUseDocumentImages, setSlidespeakUseDocumentImages] = useState(true);
  const [slidespeakUseKnowledge, setSlidespeakUseKnowledge] = useState(false);
  const [slidespeakKnowledgeMaxTokens, setSlidespeakKnowledgeMaxTokens] = useState(1200);
  const [slidespeakKvDownloadUrl, setSlidespeakKvDownloadUrl] = useState('');
  const [slidespeakIncludeCover, setSlidespeakIncludeCover] = useState(true);
  const [slidespeakIncludeToc, setSlidespeakIncludeToc] = useState(true);
  const [slidespeakAddSpeakerNotes, setSlidespeakAddSpeakerNotes] = useState(false);
  const [slidespeakUseGeneralKnowledge, setSlidespeakUseGeneralKnowledge] = useState(false);
  const [slidespeakUseWordingFromDocument, setSlidespeakUseWordingFromDocument] = useState(false);
  const [slidespeakUseBrandingLogo, setSlidespeakUseBrandingLogo] = useState(false);
  const [slidespeakUseBrandingFonts, setSlidespeakUseBrandingFonts] = useState(false);
  const [slidespeakUseBrandingColor, setSlidespeakUseBrandingColor] = useState(false);
  const [slidespeakBrandingLogo, setSlidespeakBrandingLogo] = useState('');
  const [slidespeakBrandingTitleFont, setSlidespeakBrandingTitleFont] = useState('');
  const [slidespeakBrandingBodyFont, setSlidespeakBrandingBodyFont] = useState('');
  const [slidespeakBrandingColor, setSlidespeakBrandingColor] = useState('');
  const [slidespeakRunSync, setSlidespeakRunSync] = useState(false);
  const [slidespeakResponseFormat, setSlidespeakResponseFormat] = useState('powerpoint');
  const [slidespeakTemplates, setSlidespeakTemplates] = useState([]);
  const [isSlidespeakTemplatesLoading, setIsSlidespeakTemplatesLoading] = useState(false);
  const [slidespeakTemplatesError, setSlidespeakTemplatesError] = useState('');
  const [agenticTemplateId, setAgenticTemplateId] = useState('');
  const [agenticThemeId, setAgenticThemeId] = useState('auto');
  const [agenticLogoPath, setAgenticLogoPath] = useState('');
  const [agenticLogoName, setAgenticLogoName] = useState('');
  const [agenticLogoUploading, setAgenticLogoUploading] = useState(false);
  const [showIrOnboarding, setShowIrOnboarding] = useState(false);
  const IR_ONBOARDING_SAMPLE = {
    market_definition:
      'AI-enabled cybersecurity and IT operations platforms for mid-to-large enterprises, focused on detection, response, and operational efficiency.',
    geography_scope: 'Primary: Japan, North America, EMEA. Secondary expansion: APAC.',
    customer_type:
      'B2B - regulated and data-intensive enterprises (telecom, finance, manufacturing, public sector) plus mid-market firms without in-house security expertise.',
    why_now_drivers:
      'Explosion of AI workloads increases attack surface.\nSecurity talent shortage worsens year over year.\nRegulatory pressure on data protection intensifies.\nCloud + hybrid architectures outgrow legacy SOC tools.\nEnterprises demand automation, not more dashboards.',
    problems_unmet:
      'Who: enterprise IT & security teams; CIO/CISO orgs; mid-market firms without SOC scale.\nProblems: alert fatigue from fragmented tools; slow MTTD/MTTR; shortage of skilled analysts; rising compliance and audit requirements.\nImpact: increased breach risk, higher operating costs, slower incident recovery, regulatory and reputational exposure.\nEvidence (directional): enterprises run 10-30+ security tools per environment; analyst shortage 20-30% of required headcount.',
    tam_sam_som_basis:
      'TAM: global cybersecurity + AI-ops software spend, ~$350-400B annually.\nSAM: AI-driven security operations for enterprises in target geographies, ~$120-150B.\nSOM: 3-5 year penetration via enterprise platform adoption, ~$1-2B.\nDirectional estimates based on public benchmarks and internal assumptions.',
    market_sizing_dataset: 'TAM/SAM/SOM directional sizing with global-to-target-geo split.',
    segmentation: 'Primary verticals: telecommunications, financial services, manufacturing, public/regulated industries.',
    unmet_needs_quant:
      '10-30+ security tools per enterprise environment; analyst shortage 20-30% of required headcount.',
    solution_statement:
      'An AI-driven security and operations platform that automates threat detection, response, and compliance for enterprise IT teams, reducing incident response time and operational cost.',
    differentiators:
      'AI agents for automated detection and response; integrated platform vs point solutions; enterprise-grade reliability and scalability; embedded compliance and auditability; proven operational expertise in large-scale environments.',
    tech_objectives:
      'Reduce MTTR by >50%; increase detection precision by >30%; automate >40% of routine SOC workflows; maintain enterprise-grade uptime >99.9%.',
    current_status:
      'Core AI detection modules TRL 7-8; agent orchestration and workflow automation TRL 6-7; pilot deployments in enterprise environments; internal benchmarks and early customer pilots.',
    standardization_strategy:
      'Align with ISO 27001 and SOC2; modular APIs for interoperability; cloud-agnostic deployment; compliance certification roadmap.',
    wbs:
      'Work packages: core AI engine development; agent orchestration layer; compliance & audit module; enterprise integration & deployment; go-to-market enablement.\nDeliverables: production platform release; enterprise deployment playbooks; compliance documentation.\nOwners: Product & Engineering; Security & Compliance; GTM/Enterprise Sales.',
    timeline_data: 'Pilot customers -> paid rollout -> vertical expansion -> international scaling.',
    target_market:
      'Enterprises with complex hybrid/cloud environments in regulated industries. Use cases: threat detection & response, security operations automation, compliance reporting. Buyers: CIO, CISO, Head of IT Operations.',
    competition:
      'Legacy SIEM/SOAR vendors; cloud-native security platforms; managed security service providers. Differentiation: AI-first automation; unified platform vs fragmented tools; enterprise operational scale.',
    gtm_plan:
      'Direct enterprise sales; strategic partners & integrators; pilot-to-expand motion; subscription + usage-based tiers; milestones: pilot customers -> paid rollout, vertical expansion, international scaling.',
    global_entry:
      'Start with domestic anchor customers; expand via existing enterprise networks; adapt compliance per region.',
    ops_support: '24/7 enterprise support; SLA-backed operations; continuous model monitoring and updates.',
    job_creation:
      'High-skill AI and security roles; productivity gains for customer IT teams; reduced operational burden.',
    targets_rationale:
      'KPIs: ARR growth, customer retention, MTTR reduction, automation rate. Rationale: enterprise adoption driven by automation ROI and compliance pressure.',
    company_intro:
      'TBD - add legal name, founding date, locations, mission, traction, team.',
    safety_measures: 'Secure-by-design architecture; continuous monitoring; fail-safe automation controls.',
    security_measures: 'Encryption at rest and in transit; role-based access control; continuous vulnerability testing.',
    leakage_prevention: 'Data isolation per tenant; no model training on customer data; strict access logging.',
    other_compliance:
      'ISO 27001 planned/in progress; SOC 2 Type II planned; GDPR and local data protection compliance.'
  };
  const [irOnboarding, setIrOnboarding] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ir_onboarding_v1') || '{}');
    } catch {
      return {};
    }
  });
  const [irOnboardingComplete, setIrOnboardingComplete] = useState(() => {
    return localStorage.getItem('ir_onboarding_complete') === 'true';
  });
  const [chartTypes, setChartTypes] = useState(['bar']);
  const [chartEditPrompt, setChartEditPrompt] = useState('');
  const [isChartEditing, setIsChartEditing] = useState(false);
  const [chartDraft, setChartDraft] = useState(null);
  const [isAutoCharting, setIsAutoCharting] = useState(false);
  const [autoChartCandidates, setAutoChartCandidates] = useState([]);
  const [autoChartMissing, setAutoChartMissing] = useState([]);
  const [autoChartError, setAutoChartError] = useState('');
  const [isAutoChartModalOpen, setIsAutoChartModalOpen] = useState(false);
  const [deckLogoEnabled, setDeckLogoEnabled] = useState(false);
  const [deckLogoData, setDeckLogoData] = useState('');
  const [deckLogoName, setDeckLogoName] = useState('');
  const [deckLogoPosition, setDeckLogoPosition] = useState('left');
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const loadIrOnboardingSample = () => {
    setIrOnboarding(IR_ONBOARDING_SAMPLE);
    localStorage.setItem('ir_onboarding_v1', JSON.stringify(IR_ONBOARDING_SAMPLE));
  };

  const parseAgenticSlideCount = (jsonText) => {
    if (!jsonText) return 0;
    try {
      const data = JSON.parse(jsonText);
      return (
        data?.slides?.length ||
        data?.presentation?.slides?.length ||
        data?.deck?.slides?.length ||
        data?.content_structure?.slides?.length ||
        0
      );
    } catch {
      return 0;
    }
  };

  const parseAgenticDeckFromJson = (jsonText) => {
    if (!jsonText) return null;
    try {
      const data = JSON.parse(jsonText);
      const deck =
        data?.content_structure ||
        data?.presentation ||
        data?.deck ||
        (data?.slides ? data : null);
      if (!deck || !deck.slides) return null;
      return deck;
    } catch {
      return null;
    }
  };

  const jumpToAgenticSlide = (nextIndex) => {
    const safeIndex = Math.max(1, Math.min(agenticHtmlSlideCount || 1, nextIndex));
    setAgenticHtmlSlideIndex(safeIndex);
    const hash = `slide-${safeIndex}`;
    if (agenticHtmlIframeRef.current?.contentWindow) {
      try {
        agenticHtmlIframeRef.current.contentWindow.location.hash = hash;
        return;
      } catch {
        /* fallback to src update */
      }
    }
    if (agenticHtmlBaseUrl) {
      setAgenticHtmlPreviewUrl(`${agenticHtmlBaseUrl}?t=${Date.now()}#${hash}`);
    }
  };

  const openIrOnboarding = () => {
    setShowIrOnboarding(true);
  };

  const [currentOutlineText, setCurrentOutlineText] = useState('');
  const [currentDeck, setCurrentDeck] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [thumbnailPage, setThumbnailPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [templateDownloadUrl, setTemplateDownloadUrl] = useState('');
  const [agenticHtmlStatus, setAgenticHtmlStatus] = useState('');
  const [agenticHtmlProgress, setAgenticHtmlProgress] = useState(0);
  const [agenticHtmlPresentationId, setAgenticHtmlPresentationId] = useState('');
  const [agenticHtmlDownloadUrl, setAgenticHtmlDownloadUrl] = useState('');
  const [agenticHtmlPreviewUrl, setAgenticHtmlPreviewUrl] = useState('');
  const [agenticHtmlBaseUrl, setAgenticHtmlBaseUrl] = useState('');
  const [agenticHtmlSlideCount, setAgenticHtmlSlideCount] = useState(0);
  const [agenticHtmlSlideIndex, setAgenticHtmlSlideIndex] = useState(1);
  const [showAgenticHtmlFullPreview, setShowAgenticHtmlFullPreview] = useState(false);
  const [agenticHtmlJson, setAgenticHtmlJson] = useState('');
  const [showAgenticHtmlJson, setShowAgenticHtmlJson] = useState(false);
  const [isAgenticHtmlGenerating, setIsAgenticHtmlGenerating] = useState(false);
  const [showAgenticHtmlPreview, setShowAgenticHtmlPreview] = useState(false);
  const [showAgenticHtmlInline, setShowAgenticHtmlInline] = useState(false);
  const [agenticHtmlEdited, setAgenticHtmlEdited] = useState('');
  const [agenticHtmlLocalUrl, setAgenticHtmlLocalUrl] = useState('');
  const [agenticChartEditorOpen, setAgenticChartEditorOpen] = useState(false);
  const [agenticHtmlSaving, setAgenticHtmlSaving] = useState(false);
  const [agenticHtmlCanUndo, setAgenticHtmlCanUndo] = useState(false);
  const agenticHtmlSaveTimerRef = useRef(null);
  const lastSavedAgenticHtmlRef = useRef('');
  const agenticHtmlHistoryRef = useRef([]);
  const agenticHtmlHistoryLockRef = useRef(false);
  const agenticPdfDownloadUrl = useMemo(
    () =>
      agenticHtmlPresentationId
        ? `${MULTI_AGENT_API_BASE}/api/presentations/${agenticHtmlPresentationId}/download-pdf`
        : '',
    [agenticHtmlPresentationId]
  );

  const [generatedImages, setGeneratedImages] = useState({});

  const thumbnailPageSize = 6;
  const totalThumbnailPages = Math.max(
    1,
    Math.ceil((currentDeck?.slides?.length || 0) / thumbnailPageSize)
  );
  const thumbnailStart = thumbnailPage * thumbnailPageSize;
  const thumbnailSlides =
    currentDeck?.slides?.slice(thumbnailStart, thumbnailStart + thumbnailPageSize) || [];

  useEffect(() => {
    const targetPage = Math.floor(currentSlide / thumbnailPageSize);
    if (!Number.isNaN(targetPage)) {
      setThumbnailPage(targetPage);
    }
  }, [currentSlide, currentDeck?.slides?.length]);

  useEffect(() => {
    if (thumbnailPage >= totalThumbnailPages) {
      setThumbnailPage(Math.max(0, totalThumbnailPages - 1));
    }
  }, [thumbnailPage, totalThumbnailPages]);

  useEffect(() => {
    if (!agenticHtmlPreviewUrl) return;
    setAgenticHtmlSlideIndex(currentSlide + 1);
  }, [agenticHtmlPreviewUrl, currentSlide]);

  useEffect(() => {
    setShowAgenticHtmlInline(Boolean(agenticHtmlPreviewUrl));
  }, [agenticHtmlPreviewUrl]);

  useEffect(() => {
    return () => {
      if (agenticHtmlLocalUrl) {
        URL.revokeObjectURL(agenticHtmlLocalUrl);
      }
    };
  }, [agenticHtmlLocalUrl]);

  useEffect(() => {
    if (!agenticHtmlPresentationId) return;
    if (!agenticHtmlEdited) return;
    if (agenticHtmlEdited === lastSavedAgenticHtmlRef.current) return;
    if (agenticHtmlSaveTimerRef.current) {
      clearTimeout(agenticHtmlSaveTimerRef.current);
    }
    agenticHtmlSaveTimerRef.current = setTimeout(async () => {
      setAgenticHtmlSaving(true);
      try {
        await api.agenticSaveHtml(agenticHtmlPresentationId, agenticHtmlEdited);
        lastSavedAgenticHtmlRef.current = agenticHtmlEdited;
      } catch (err) {
        setError(`Auto-save failed: ${err.message}`);
      } finally {
        setAgenticHtmlSaving(false);
      }
    }, 900);
    return () => {
      if (agenticHtmlSaveTimerRef.current) {
        clearTimeout(agenticHtmlSaveTimerRef.current);
      }
    };
  }, [agenticHtmlEdited, agenticHtmlPresentationId]);
  const [isChartBuilderOpen, setIsChartBuilderOpen] = useState(false);
  const [chartBuilderSeed, setChartBuilderSeed] = useState(null);
  const [chartBuilderTarget, setChartBuilderTarget] = useState(null);
  const [isVisualLibraryOpen, setIsVisualLibraryOpen] = useState(false);
  const [visualTemplateId, setVisualTemplateId] = useState(visualTemplates[0]?.id || '');
  const [visualTemplateFields, setVisualTemplateFields] = useState({});
  const [visualPromptOverride, setVisualPromptOverride] = useState('');
  const [visualPromptManual, setVisualPromptManual] = useState(false);
  const [visualTemplateTouched, setVisualTemplateTouched] = useState(false);
  const [visualImageUrl, setVisualImageUrl] = useState('');
  const [visualImageError, setVisualImageError] = useState('');
  const [isVisualGenerating, setIsVisualGenerating] = useState(false);
  const agenticHtmlIframeRef = useRef(null);
  const agenticHtmlFileInputRef = useRef(null);
  const [visualLibraryTarget, setVisualLibraryTarget] = useState(null);
  const visualTemplateDraftRef = useRef({});
  const slideContainerRef = useRef(null);
  const slideViewportRef = useRef(null);
  // Start small so the first render doesn't flash at full 1920x1080
  const [slidePreviewScale, setSlidePreviewScale] = useState(0.4);

  useEffect(() => {
    if (!slideViewportRef.current) return;
    const baseWidth = showAgenticHtmlInline ? AGENTIC_BASE_WIDTH : 960;
    const baseHeight = showAgenticHtmlInline ? AGENTIC_BASE_HEIGHT : 540;
    const viewport = slideViewportRef.current;
    const computeScale = () => {
      const w = viewport.clientWidth || 0;
      const h = viewport.clientHeight || 0;
      if (!w || !h) return;
      // Reserve padding so the slide doesn't touch viewport edges
      const fitScale = Math.max(0.15, Math.min((w - 48) / baseWidth, (h - 24) / baseHeight));
      const manualScale = zoom / 100;
      // Treat 100% as "fit" for editor; zoom scales relative to fit.
      const nextScale = fitScale * manualScale;
      setSlidePreviewScale(nextScale > 0.05 ? nextScale : 0.4);
    };
    computeScale();
    const observer = new ResizeObserver(computeScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [zoom, showAgenticHtmlInline]);

  useEffect(() => {
    window.__currentDeck = currentDeck;
  }, [currentDeck]);

  useEffect(() => {
    let mounted = true;
    const loadTemplates = async () => {
      setIsSlidespeakTemplatesLoading(true);
      setSlidespeakTemplatesError('');
      try {
        const response = await api.slidespeakTemplates();
        const templates = normalizeSlidespeakTemplates(response?.templates || response);
        if (!mounted) return;
        setSlidespeakTemplates(templates);
      } catch (err) {
        if (!mounted) return;
        setSlidespeakTemplatesError(err.message || 'Failed to load SlideSpeak templates.');
      } finally {
        if (mounted) setIsSlidespeakTemplatesLoading(false);
      }
    };

    loadTemplates();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!slidespeakTemplates.length) return;
    if (slidespeakTemplates.some((item) => item.name === templateId)) return;
    setTemplateId(slidespeakTemplates[0].name);
  }, [slidespeakTemplates, templateId]);

  useEffect(() => {
    if (!agenticTemplateId && visualTemplates.length) {
      setAgenticTemplateId(visualTemplates[0].id);
    }
  }, [agenticTemplateId]);

  const agenticThemes = [
    { id: 'auto', name: 'AI Auto', note: 'Generated palette' },
    { id: 'modern', name: 'Modern', note: 'Clean tech' },
    { id: 'minimal', name: 'Minimal', note: 'Light, airy' },
    { id: 'bold', name: 'Bold', note: 'High contrast' },
    { id: 'black-elegant', name: 'Black Elegant', note: 'Minimal luxury' },
    { id: 'full-styled-ir', name: 'Full Styled IR', note: 'Navy + yellow' },
    { id: 'corporate', name: 'Corporate', note: 'Executive' },
    { id: 'editorial', name: 'Editorial', note: 'Warm print' },
    { id: 'wecommit', name: 'WeCommit', note: 'Blue gradient' },
    { id: 'simple-business', name: 'Simple Business', note: 'Clean blue' },
    { id: 'ir-deck', name: 'IR Deck', note: 'Light blue' },
  ];

  const mapAgenticThemeToStyle = (themeId) => {
    switch (themeId) {
      case 'auto':
        return 'auto';
      case 'modern':
        return 'modern';
      case 'minimal':
        return 'minimal';
      case 'bold':
        return 'bold';
      case 'black-elegant':
        return 'black-elegant';
      case 'full-styled-ir':
        return 'full-styled-ir';
      case 'corporate':
        return 'corporate';
      case 'editorial':
        return 'editorial';
      case 'wecommit':
        return 'wecommit';
      case 'simple-business':
        return 'simple-business';
      case 'ir-deck':
        return 'ir-deck';
      default:
        return 'auto';
    }
  };

  const themeOptions = [
    {
      id: 'modern',
      label: 'Modern',
      note: 'Clean tech',
      swatch: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700',
      accent: 'bg-blue-500',
    },
    {
      id: 'minimal',
      label: 'Minimal',
      note: 'Light, airy',
      swatch: 'bg-gradient-to-br from-white via-slate-50 to-slate-100',
      accent: 'bg-slate-700',
    },
    {
      id: 'bold',
      label: 'Bold',
      note: 'High contrast',
      swatch: 'bg-gradient-to-br from-black via-gray-900 to-orange-900',
      accent: 'bg-orange-500',
    },
    {
      id: 'black-elegant',
      label: 'Black Elegant',
      note: 'Minimal luxury',
      swatch: 'bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800',
      accent: 'bg-yellow-400',
    },
    {
      id: 'full-styled-ir',
      label: 'Full Styled IR',
      note: 'Navy + yellow',
      swatch: 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800',
      accent: 'bg-yellow-400',
    },
    {
      id: 'corporate',
      label: 'Corporate',
      note: 'Executive',
      swatch: 'bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200',
      accent: 'bg-blue-800',
    },
    {
      id: 'editorial',
      label: 'Editorial',
      note: 'Warm print',
      swatch: 'bg-gradient-to-br from-amber-50 via-orange-100 to-amber-200',
      accent: 'bg-amber-700',
    },
    {
      id: 'wecommit',
      label: 'WeCommit',
      note: 'Blue gradient',
      swatch: 'bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400',
      accent: 'bg-white',
    },
    {
      id: 'simple-business',
      label: 'Simple Business',
      note: 'Clean blue',
      swatch: 'bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100',
      accent: 'bg-blue-700',
    },
    {
      id: 'ir-deck',
      label: 'IR Deck',
      note: 'Light blue',
      swatch: 'bg-gradient-to-br from-sky-50 via-blue-50 to-sky-100',
      accent: 'bg-blue-500',
    },
  ];
  const irTemplateOptions = [
    { id: 'section-divider', label: 'Section Divider' },
    { id: 'overview', label: 'Financial Overview' },
    { id: 'results', label: 'Quarterly Results' },
    { id: 'comparison', label: 'YoY Comparison' },
    { id: 'strategy', label: 'Strategic Initiatives' },
    { id: 'forecast', label: 'Financial Forecast' },
    { id: 'segment', label: 'Segment Performance' },
    { id: 'metrics', label: 'Key Metrics Dashboard' },
  ];

  const slide = currentDeck?.slides?.[currentSlide];
  const slideBullets = useMemo(() => {
    if (!slide) return [];
    return (
      slide.content ||
      slide.leftColumn?.items ||
      slide.rightColumn?.items ||
      slide.leftSide?.content?.items ||
      slide.rightSide?.content?.items ||
      []
    );
  }, [slide]);
  const isTwoColumnLayout = useMemo(() => {
    if (!slide) return false;
    return slide.layoutId === 'two-column' || slide.type === 'two-column';
  }, [slide]);
  const twoColumnContent = useMemo(() => {
    if (!slide || !isTwoColumnLayout) return null;
    const resolveColumn = (column) => {
      if (!column) return null;
      if (column.type === 'chart' && column.chartData) return { type: 'chart', data: column.chartData };
      if (column.type === 'image') return { type: 'image' };
      const items = column.items || column.content?.items;
      if (Array.isArray(items)) return { type: 'bullets', items };
      return null;
    };

    let left = resolveColumn(slide.leftColumn || slide.content?.leftColumn);
    let right = resolveColumn(slide.rightColumn || slide.content?.rightColumn);

    if (!left && !right) {
      const items = Array.isArray(slide.content) ? slide.content : [];
      const { left: leftItems, right: rightItems } = splitItemsToColumns(items);
      if (leftItems.length) left = { type: 'bullets', items: leftItems };
      if (rightItems.length) right = { type: 'bullets', items: rightItems };
      if (!left && !right && slide.chartData) {
        right = { type: 'chart', data: slide.chartData };
      }
      if (!left && !right && slide.image) {
        right = { type: 'image' };
      }
    }

    return { left, right };
  }, [slide, isTwoColumnLayout]);
  const showSubtitle = useMemo(() => {
    if (!slide?.subtitle) return false;
    if (!isTwoColumnLayout) return true;
    const leftItems = ensureArray(twoColumnContent?.left?.items);
    const rightItems = ensureArray(twoColumnContent?.right?.items);
    const allItems = [...leftItems, ...rightItems].filter(Boolean);
    if (!allItems.length) return true;
    const subtitleText = normalizeText(slide.subtitle);
    const firstItem = normalizeText(allItems[0]);
    const joinedItems = normalizeText(allItems.join(' '));
    if (!subtitleText) return false;
    return !(subtitleText === firstItem || subtitleText === joinedItems);
  }, [slide, isTwoColumnLayout, twoColumnContent]);
  const isDiagramSlide = Boolean(slide?.diagram?.mermaid || (slide?.type === 'diagram' && slide?.mermaid));
  const activeThemeId = currentDeck?.metadata?.theme || theme;
  const isIrTheme = activeThemeId === 'ntt';
  const isIrDeckTheme = activeThemeId === 'ir-deck';
  const brandColorValue = currentDeck?.metadata?.brandColor || brandColor || IR_DEFAULT_BRAND;
  const themeFallback = themeFallbacks[activeThemeId] || {};
  const currentVisualTemplate = useMemo(
    () => visualTemplates.find((template) => template.id === visualTemplateId),
    [visualTemplateId]
  );
  const visualPreviewSrc = useMemo(() => {
    if (!currentVisualTemplate?.previewSvg) return '';
    return `data:image/svg+xml;utf8,${encodeURIComponent(currentVisualTemplate.previewSvg)}`;
  }, [currentVisualTemplate]);

  const applyDeckLogo = (presentation) => {
    if (!deckLogoEnabled || !deckLogoData || !presentation?.slides) return presentation;
    const slides = presentation.slides.map((slideItem) => ({
      ...slideItem,
      logo: {
        placeholderId: `logo_${slideItem.slideId || 'deck'}`,
        position: deckLogoPosition,
        data: deckLogoData,
      },
    }));
    return { ...presentation, slides };
  };

  useEffect(() => {
    if (!currentDeck) return;
    if (!deckLogoEnabled || !deckLogoData) return;
    setCurrentDeck((prev) => (prev ? applyDeckLogo(prev) : prev));
  }, [deckLogoEnabled, deckLogoData, deckLogoPosition]);

  const applyPresentationMeta = (presentation) => {
    if (!presentation) return presentation;
    let next = {
      ...presentation,
      metadata: {
        ...presentation.metadata,
        theme,
        templateId: templateId === 'default' ? '' : templateId,
        brandColor: theme === 'ntt' ? brandColor : presentation?.metadata?.brandColor,
      },
    };
    if (theme === 'ir-deck') {
      next = applyIrDeckTemplateData(next);
      next.slides = (next.slides || []).map((slideItem) => ({
        ...slideItem,
        backgroundColor: '#F5FAFF',
        textColor: '#0F172A',
      }));
    }
    return next;
  };

  useEffect(() => {
    setChartEditPrompt('');
    setChartDraft(null);
  }, [currentSlide]);

  useEffect(() => {
    if (!currentVisualTemplate) return;
    const defaults = {};
    currentVisualTemplate.fields.forEach((field) => {
      defaults[field.key] = field.default ?? '';
    });
    visualTemplateDraftRef.current = defaults;
    setVisualTemplateTouched(false);
    setVisualTemplateFields(defaults);
    setVisualPromptManual(false);
    setVisualPromptOverride(buildVisualPrompt(currentVisualTemplate, defaults));
  }, [visualTemplateId]);

  const getVisualFieldValues = () => ({
    ...visualTemplateFields,
    ...visualTemplateDraftRef.current,
  });

  useEffect(() => {
    if (!currentDeck) return;
    setCurrentDeck((deck) => {
      if (!deck) return deck;
      const nextMeta = {
        ...(deck.metadata || {}),
        theme,
        ...(theme === 'ntt' ? { brandColor } : {}),
      };
      return { ...deck, metadata: nextMeta };
    });
  }, [theme, brandColor]);

  useEffect(() => {
    loadDocuments();
    try {
      const storedDeck = localStorage.getItem('snapdeck.currentDeck');
      if (storedDeck) {
        setCurrentDeck(JSON.parse(storedDeck));
      }
    } catch (err) {
      console.warn('Failed to restore saved deck', err);
    }
  }, []);

  useEffect(() => {
    if (!currentDeck) return;
    try {
      localStorage.setItem('snapdeck.currentDeck', JSON.stringify(currentDeck));
    } catch (err) {
      console.warn('Failed to persist deck', err);
    }
  }, [currentDeck]);

  const loadDocuments = async () => {
    try {
      const response = await api.listDocuments();
      setDocuments(response.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const handleFileUpload = async (files) => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      for (let i = 0; i < files.length; i += 1) {
        setUploadProgress(((i + 1) / files.length) * 100);
        const response = await api.uploadDocument(files[i]);
        setDocuments((prev) => [...prev, response.document]);
      }
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      setSelectedDocs((prev) => prev.filter((id) => id !== docId));
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    }
  };

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter(isAllowedDocument);
    if (files.length > 0) handleFileUpload(files);
  }, []);

  const onDragOver = (event) => {
    event.preventDefault();
    event.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
  };

  const onDragLeave = (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const buildSlidespeakPlainText = (baseText, profile) => {
    const parts = [
      `Deck type: ${profile === 'ir' ? 'IR deck' : 'Business proposal'}`,
      `Theme: ${theme}`,
    ];
    if (templateId && templateId !== 'default') {
      parts.push(`Template: ${templateId}`);
    }
    return `${parts.join('. ')}.\n${baseText}`.trim();
  };

  const buildIrOnboardingAppendix = (data) => {
    if (!data || !Object.keys(data).length) return '';
    const lines = ['IR ONBOARDING DATA (use as source-of-truth):'];
    const add = (label, value) => {
      if (!value) return;
      lines.push(`- ${label}: ${value}`);
    };
    add('Market definition', data.market_definition);
    add('Geography scope', data.geography_scope);
    add('Customer type', data.customer_type);
    add('Why now drivers', data.why_now_drivers);
    add('Problems & unmet needs', data.problems_unmet);
    add('TAM/SAM/SOM basis', data.tam_sam_som_basis);
    add('Market sizing dataset', data.market_sizing_dataset);
    add('Segmentation', data.segmentation);
    add('Unmet needs quant', data.unmet_needs_quant);
    add('Solution statement', data.solution_statement);
    add('Differentiators', data.differentiators);
    add('Technology objectives', data.tech_objectives);
    add('Current status', data.current_status);
    add('Standardization strategy', data.standardization_strategy);
    add('WBS', data.wbs);
    add('Architecture / components', data.architecture_inventory);
    add('Timeline data', data.timeline_data);
    add('Resource plan', data.resource_plan);
    add('Target market', data.target_market);
    add('Competition', data.competition);
    add('Go-to-market plan', data.gtm_plan);
    add('Global entry', data.global_entry);
    add('Operations & support', data.ops_support);
    add('Job creation & outcomes', data.job_creation);
    add('Targets & rationale', data.targets_rationale);
    add('Commercial KPI dataset', data.commercial_kpi_dataset);
    add('Competitive dataset', data.competitive_dataset);
    add('Geographic dataset', data.geographic_dataset);
    add('Ops dataset', data.ops_dataset);
    add('Jobs dataset', data.jobs_dataset);
    add('Company introduction', data.company_intro);
    add('Safety measures', data.safety_measures);
    add('Security measures', data.security_measures);
    add('Leakage prevention', data.leakage_prevention);
    add('Other compliance', data.other_compliance);
    return lines.join('\n');
  };

  const validateIrOnboarding = (data) => {
    const required = [
      'market_definition',
      'geography_scope',
      'customer_type',
      'why_now_drivers',
      'problems_unmet',
      'tam_sam_som_basis',
      'solution_statement',
      'differentiators',
      'tech_objectives',
      'current_status',
      'standardization_strategy',
      'wbs',
      'target_market',
      'competition',
      'gtm_plan',
      'global_entry',
      'ops_support',
      'job_creation',
      'targets_rationale',
      'company_intro',
      'safety_measures',
      'security_measures',
      'leakage_prevention',
      'other_compliance',
    ];
    return required.filter((key) => !String(data[key] || '').trim());
  };

  const handleSaveIrOnboarding = () => {
    const missing = validateIrOnboarding(irOnboarding);
    if (missing.length) {
      setError(`IR onboarding missing ${missing.length} fields. Proceeding anyway.`);
    }
    localStorage.setItem('ir_onboarding_v1', JSON.stringify(irOnboarding));
    localStorage.setItem('ir_onboarding_complete', 'true');
    setIrOnboardingComplete(true);
    setShowIrOnboarding(false);
  };

  const buildSlidespeakPrompt = async (baseText, profile) => {
    let promptText = buildSlidespeakPlainText(baseText, profile);
    if (slidespeakUseKnowledge) {
      if (!selectedDocs.length) {
        throw new Error('Select documents to use knowledge context.');
      }
      setSlidespeakKvDownloadUrl('');
      const knowledge = await api.slidespeakKnowledge({
        query: baseText,
        documentIds: selectedDocs,
        maxTokens: slidespeakKnowledgeMaxTokens,
      });
      const chunks = (knowledge?.chunks || [])
        .map((chunk) => chunk.text || chunk.content || '')
        .filter(Boolean);
      if (chunks.length) {
        promptText = `${promptText}\n\nContext from documents:\n${chunks
          .map((chunk, idx) => `${idx + 1}. ${chunk}`)
          .join('\n')}`.trim();
      }
    }
    if (profile === 'ir') {
      const appendix = buildIrOnboardingAppendix(irOnboarding);
      if (appendix) {
        promptText = `${promptText}\n\n${appendix}`;
      }
    }
    return promptText;
  };

  const buildAgenticPrompt = async (baseText, profile) => {
    let promptText = baseText;
    let ragUsed = false;
    let chunkCount = 0;
    if (slidespeakUseKnowledge) {
      if (!selectedDocs.length) {
        throw new Error('Select documents to use knowledge context.');
      }
      setSlidespeakKvDownloadUrl('');
      const knowledge = await api.slidespeakKnowledge({
        query: baseText,
        documentIds: selectedDocs,
        maxTokens: slidespeakKnowledgeMaxTokens,
      });
      const chunks = (knowledge?.chunks || [])
        .map((chunk) => chunk.text || chunk.content || '')
        .filter(Boolean);
      chunkCount = chunks.length;
      if (chunks.length) {
        ragUsed = true;
        promptText = `${promptText}\n\nContext from documents:\n${chunks
          .map((chunk, idx) => `${idx + 1}. ${chunk}`)
          .join('\n')}`.trim();
      }
    }
    if (profile === 'ir') {
      const appendix = buildIrOnboardingAppendix(irOnboarding);
      if (appendix) {
        promptText = `${promptText}\n\n${appendix}`;
      }
    }
    return { promptText, ragUsed, chunkCount };
  };

  const handleDownloadKnowledgeKVs = async () => {
    const promptText = (promptInputRef.current || prompt).trim();
    if (!promptText) {
      setError('Enter a prompt to extract key-value pairs.');
      return;
    }
    if (!selectedDocs.length) {
      setError('Select documents to extract key-value pairs.');
      return;
    }
    setError(null);
    try {
      const response = await api.slidespeakKnowledgeKv({
        query: promptText,
        documentIds: selectedDocs,
        maxTokens: slidespeakKnowledgeMaxTokens,
      });
      if (response.downloadUrl) {
        setSlidespeakKvDownloadUrl(response.downloadUrl);
        const anchor = document.createElement('a');
        anchor.href = `${API_BASE.replace('/api', '')}${response.downloadUrl}`;
        anchor.download = response.filename || 'rag_kv.json';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
    } catch (err) {
      setError(`KV extraction failed: ${err.message}`);
    }
  };

  const extractSlidespeakTaskId = (payload) => payload?.task_id || payload?.taskId || '';
  const extractSlidespeakStatus = (payload) => payload?.task_status || payload?.taskStatus || '';
  const extractSlidespeakRequestId = (payload) =>
    payload?.request_id ||
    payload?.requestId ||
    payload?.task_result?.request_id ||
    payload?.task_info?.request_id ||
    '';

  const pollSlidespeakTask = async (taskId) => {
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const statusResponse = await api.slidespeakStatus(taskId);
      const payload = statusResponse?.data || statusResponse;
      const status = extractSlidespeakStatus(payload);
      if (status === 'SUCCESS') return payload;
      if (status === 'FAILURE' || status === 'REVOKED') {
        throw new Error('SlideSpeak generation failed.');
      }
      await wait(2000);
    }
    throw new Error('SlideSpeak generation timed out.');
  };

  const generateSlidespeakDeck = async (plainText, profile) => {
    setPptxPreviewFilename('');
    setPptxPreviewError('');
    setPptxPreviewImages([]);
    const brandingFonts =
      slidespeakBrandingTitleFont || slidespeakBrandingBodyFont
        ? {
            title: slidespeakBrandingTitleFont || undefined,
            body: slidespeakBrandingBodyFont || undefined,
          }
        : undefined;
    const startResponse = await api.slidespeakGenerate({
      plainText,
      length: slidespeakUseAutoLength ? undefined : slideCount,
      template: templateId || 'default',
      language: slidespeakLanguage || 'ORIGINAL',
      fetch_images: slidespeakFetchImages,
      use_document_images: false,
      tone: slidespeakTone,
      verbosity: slidespeakVerbosity,
      custom_user_instructions: slidespeakCustomInstructions || undefined,
      include_cover: slidespeakIncludeCover,
      include_table_of_contents: slidespeakIncludeToc,
      add_speaker_notes: slidespeakAddSpeakerNotes,
      use_general_knowledge: slidespeakUseGeneralKnowledge,
      use_wording_from_document: false,
      use_branding_logo: slidespeakUseBrandingLogo,
      use_branding_fonts: slidespeakUseBrandingFonts,
      use_branding_color: slidespeakUseBrandingColor,
      branding_logo: slidespeakBrandingLogo || undefined,
      branding_fonts: brandingFonts,
      branding_color: slidespeakBrandingColor || undefined,
      run_sync: slidespeakRunSync,
      response_format: slidespeakResponseFormat,
    });
    const startPayload = startResponse?.data || startResponse;
    const taskId = extractSlidespeakTaskId(startPayload);
    let requestId = extractSlidespeakRequestId(startPayload);
    if (!taskId && !requestId) {
      throw new Error('SlideSpeak did not return a task id.');
    }
    if (!requestId && taskId) {
      const statusPayload = await pollSlidespeakTask(taskId);
      requestId = extractSlidespeakRequestId(statusPayload);
    }
    if (!requestId) {
      throw new Error('SlideSpeak did not return a request id.');
    }

    const importResponse = await api.slidespeakImport(requestId);
    if (!importResponse?.filename) {
      throw new Error('SlideSpeak import failed.');
    }

    setDownloadUrl(importResponse.downloadUrl || '');
    setPptxPreviewFilename(importResponse.filename || '');
    if (importResponse.filename) {
      try {
        const previewResponse = await api.slidespeakPreviewImages(importResponse.filename);
        setPptxPreviewImages(previewResponse.images || []);
      } catch (err) {
        setPptxPreviewError('Could not load PPTX preview images.');
      }
    }
    setCurrentDeck(null);
    setCurrentSlide(0);
    setView('editor');
  };

  const insertChartIntoPptx = async (imageData, frame, slideIndex) => {
    if (!pptxPreviewFilename || !imageData) return;
    try {
      const response = await api.slidespeakInsertChart({
        filename: pptxPreviewFilename,
        slideIndex,
        imageData,
        frame,
      });
      if (response?.filename) {
        setPptxPreviewFilename(response.filename);
        setDownloadUrl(response.downloadUrl || '');
        try {
          const previewResponse = await api.slidespeakPreviewImages(response.filename);
          setPptxPreviewImages(previewResponse.images || []);
        } catch (err) {
          setPptxPreviewError('Could not refresh PPTX preview images.');
        }
      }
    } catch (err) {
      setError(`PPTX update failed: ${err.message}`);
    }
  };

  const handleGenerateFromPrompt = async (profile = generationProfile) => {
    const promptText = (promptInputRef.current || prompt).trim();
    if (!promptText) return;
    if (profile === 'ir') {
      const missing = validateIrOnboarding(irOnboarding);
      if (missing.length) {
        setError(`IR onboarding missing ${missing.length} fields. Proceeding anyway.`);
      }
    }
    if (consistentMode) {
      return handleGenerateConsistent(promptText, profile);
    }
    setIsGenerating(true);
    setError(null);
    setTemplateDownloadUrl('');
    try {
      const plainText = await buildSlidespeakPrompt(promptText, profile);
      await generateSlidespeakDeck(plainText, profile);
    } catch (err) {
      setError(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAgenticLogoUpload = async (file) => {
    if (!file) return;
    setAgenticLogoUploading(true);
    setAgenticLogoName(file.name);
    try {
      const response = await api.uploadAgenticLogo(file);
      setAgenticLogoPath(response?.logo_path || '');
    } catch (err) {
      setAgenticLogoPath('');
      setAgenticLogoName('');
      setError(`Logo upload failed: ${err.message}`);
    } finally {
      setAgenticLogoUploading(false);
    }
  };

  const handleGenerateAgenticHtml = async () => {
    let promptText = (promptInputRef.current || prompt).trim();
    if (!promptText) return;
    setError(null);
    if (generationProfile === 'ir') {
      const missing = validateIrOnboarding(irOnboarding);
      if (missing.length) {
        setError(`IR onboarding missing ${missing.length} fields. Proceeding anyway.`);
      }
    }
    setIsAgenticHtmlGenerating(true);
    setAgenticHtmlStatus('starting');
    setAgenticHtmlProgress(0);
    setAgenticHtmlPresentationId('');
    setAgenticHtmlDownloadUrl('');
    setAgenticHtmlPreviewUrl('');
    setAgenticHtmlJson('');
    setAgenticHtmlEdited('');
    setShowAgenticHtmlJson(false);
    try {
      const ragResult = await buildAgenticPrompt(promptText, generationProfile);
      promptText = ragResult.promptText;
      console.info(
        '[agentic-html] RAG used:',
        ragResult.ragUsed,
        '| chunks:',
        ragResult.chunkCount,
        '| docs:',
        selectedDocs.length
      );
      const response = await api.agenticGenerateHtml({
        userPrompt: promptText,
        slideCount,
        documentIds: selectedDocs,
        audience: generationProfile === 'ir' ? 'exec' : 'sales',
        tone: generationProfile === 'ir' ? 'formal' : 'bold',
        theme,
        style: mapAgenticThemeToStyle(agenticThemeId),
        templateId: agenticTemplateId || undefined,
        templateHint: visualTemplates.find((t) => t.id === agenticTemplateId)?.description,
        logoPath: agenticLogoPath || undefined,
      });
      const presentationId = response?.id || response?.presentation_id || '';
      if (!presentationId) {
        throw new Error('Agentic HTML generation returned no presentation id.');
      }
      setAgenticHtmlPresentationId(presentationId);
      setAgenticHtmlStatus(response.status || 'processing');
      setAgenticHtmlProgress(response.progress || 0);

      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      let status = response.status || 'processing';
      let progress = response.progress || 0;
      let lastPayload = null;

      for (let attempt = 0; attempt < 180; attempt += 1) {
        if (status === 'completed' || status === 'failed') break;
        await wait(2000);
        const statusResponse = await api.agenticGetStatus(presentationId);
        lastPayload = statusResponse;
        status = statusResponse.status;
        progress = statusResponse.progress ?? progress;
        setAgenticHtmlStatus(status);
        setAgenticHtmlProgress(progress);
        if (statusResponse.download_url) {
          setAgenticHtmlDownloadUrl(`${MULTI_AGENT_API_BASE}${statusResponse.download_url}`);
        }
      }

      if (status !== 'completed') {
        throw new Error(
          lastPayload?.error ||
            lastPayload?.message ||
            'Agentic HTML generation did not complete.'
        );
      }

      const finalDownloadUrl = lastPayload?.download_url
        ? `${MULTI_AGENT_API_BASE}${lastPayload.download_url}`
        : `${MULTI_AGENT_API_BASE}/api/presentations/${presentationId}/download-html`;
      const finalPreviewUrl = `${MULTI_AGENT_API_BASE}/api/presentations/${presentationId}/view-html`;
      setAgenticHtmlDownloadUrl(finalDownloadUrl);
      setAgenticHtmlBaseUrl(finalPreviewUrl);
      setAgenticHtmlSlideIndex(1);
      setAgenticHtmlPreviewUrl(`${finalPreviewUrl}?t=${Date.now()}#slide-1`);
      setShowAgenticHtmlInline(true);
      setShowAgenticHtmlPreview(true);
      setView('editor');
      try {
        const jsonText = await api.agenticGetJson(presentationId);
        setAgenticHtmlJson(jsonText);
        const count = parseAgenticSlideCount(jsonText);
        if (count) {
          setAgenticHtmlSlideCount(count);
        }
        const deck = parseAgenticDeckFromJson(jsonText);
        if (deck?.slides?.length) {
          setCurrentDeck((prev) => ({
            ...deck,
            metadata: {
              ...(deck.metadata || {}),
              theme: prev?.metadata?.theme || theme,
            },
          }));
          setCurrentSlide(0);
        }
      } catch (jsonErr) {
        console.warn('Agentic JSON fetch failed:', jsonErr?.message || jsonErr);
      }
    } catch (err) {
      setError(`Agentic HTML generation failed: ${err.message}`);
    } finally {
      setIsAgenticHtmlGenerating(false);
    }
  };

  const handleSaveAgenticHtmlEdits = async () => {
    if (!agenticHtmlPresentationId) return;
    let htmlContent = agenticHtmlEdited;
    if (!htmlContent && agenticHtmlPreviewUrl) {
      const response = await fetch(agenticHtmlPreviewUrl.split('?')[0]);
      if (response.ok) {
        htmlContent = await response.text();
      }
    }
    if (!htmlContent) return;
    setAgenticHtmlSaving(true);
    try {
      await api.agenticSaveHtml(agenticHtmlPresentationId, htmlContent);
      lastSavedAgenticHtmlRef.current = htmlContent;
      setAgenticHtmlEdited('');
      if (agenticHtmlBaseUrl && !showAgenticHtmlInline) {
        const hash = `slide-${agenticHtmlSlideIndex || 1}`;
        setAgenticHtmlPreviewUrl(`${agenticHtmlBaseUrl}?t=${Date.now()}#${hash}`);
      }
    } catch (err) {
      setError(`Save edits failed: ${err.message}`);
    } finally {
      setAgenticHtmlSaving(false);
    }
  };

  const applyChartImageToHtml = (htmlContent, slideZeroIndex, imageData, frame) => {
    if (!htmlContent || !imageData) return htmlContent;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const slides = doc.querySelectorAll('section.slide');
    const idx = Math.max(0, Math.min(slideZeroIndex ?? 0, Math.max(0, slides.length - 1)));
    const slide = slides.length ? slides[idx] : doc.body;
    if (!slide) return htmlContent;

    // Ensure slide is positioning context for absolute elements
    if (!slide.style.position || slide.style.position === 'static') {
      slide.style.position = 'relative';
    }

    // Prefer existing chart slot/container
    let target = slide.querySelector('.chart-slot') || slide.querySelector('.chart-container');
    if (target && target.classList.contains('chart-container')) {
      const innerSlot = target.querySelector('.chart-slot');
      if (innerSlot) {
        target = innerSlot;
      }
    }

    const createChartImage = () => {
      const img = doc.createElement('img');
      img.src = imageData;
      img.alt = 'Chart';
      img.setAttribute('data-chart-image', 'true');
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.pointerEvents = 'none';
      img.style.display = 'block';
      return img;
    };

    const baseWidth = AGENTIC_BASE_WIDTH;
    const baseHeight = AGENTIC_BASE_HEIGHT;
    const safeFrame = frame || { x: 8, y: 28, w: 84, h: 50 };
    const left = (safeFrame.x / 100) * baseWidth;
    const top = (safeFrame.y / 100) * baseHeight;
    const width = (safeFrame.w / 100) * baseWidth;
    const height = (safeFrame.h / 100) * baseHeight;

    if (target) {
      target.removeAttribute('data-chart-id');
      target.setAttribute('data-editable', 'shape');
      target.setAttribute('data-chart-box', 'true');
      target.style.position = 'absolute';
      target.style.left = `${left}px`;
      target.style.top = `${top}px`;
      target.style.width = `${width}px`;
      target.style.height = `${height}px`;
      if (!target.style.overflow) target.style.overflow = 'hidden';
      target.innerHTML = '';
      target.appendChild(createChartImage());
    } else {
      const container = doc.createElement('div');
      container.className = 'chart-container';
      container.setAttribute('data-chart-box', 'true');
      container.setAttribute('data-editable', 'shape');
      container.style.position = 'absolute';
      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.overflow = 'hidden';
      container.appendChild(createChartImage());
      slide.appendChild(container);
    }

    return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  };

  const applyImageFrameToHtml = (htmlContent, slideZeroIndex, frame) => {
    if (!htmlContent || !frame) return htmlContent;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const slides = doc.querySelectorAll('section.slide');
    const idx = Math.max(0, Math.min(slideZeroIndex ?? 0, Math.max(0, slides.length - 1)));
    const slide = slides.length ? slides[idx] : doc.body;
    if (!slide) return htmlContent;

    if (!slide.style.position || slide.style.position === 'static') {
      slide.style.position = 'relative';
    }

    const baseWidth = AGENTIC_BASE_WIDTH;
    const baseHeight = AGENTIC_BASE_HEIGHT;
    const left = (frame.x / 100) * baseWidth;
    const top = (frame.y / 100) * baseHeight;
    const width = (frame.w / 100) * baseWidth;
    const height = (frame.h / 100) * baseHeight;

    let box = slide.querySelector('[data-image-box="true"]');
    if (!box) {
      box = doc.createElement('div');
      box.className = 'image-box';
      box.setAttribute('data-image-box', 'true');
      box.setAttribute('data-editable', 'shape');
      const label = doc.createElement('div');
      label.className = 'image-box__label';
      label.textContent = 'Image';
      box.appendChild(label);
      slide.appendChild(box);
    }

    box.style.position = 'absolute';
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.display = 'flex';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'center';
    box.style.border = '2px dashed rgba(99, 102, 241, 0.6)';
    box.style.background = 'rgba(99, 102, 241, 0.08)';
    box.style.color = '#4f46e5';
    box.style.fontSize = '12px';
    box.style.textTransform = 'uppercase';
    box.style.letterSpacing = '0.08em';

    return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  };

  const saveAgenticHtmlContent = async (htmlContent, slideZeroIndex) => {
    if (!agenticHtmlPresentationId || !htmlContent) return false;
    setAgenticHtmlSaving(true);
    try {
      await api.agenticSaveHtml(agenticHtmlPresentationId, htmlContent);
      lastSavedAgenticHtmlRef.current = htmlContent;
      setAgenticHtmlEdited('');
      if (agenticHtmlBaseUrl) {
        const slideHash = `slide-${(slideZeroIndex ?? 0) + 1}`;
        setAgenticHtmlPreviewUrl(`${agenticHtmlBaseUrl}?t=${Date.now()}#${slideHash}`);
      }
      return true;
    } catch (err) {
      setError(`Save HTML failed: ${err.message}`);
      return false;
    } finally {
      setAgenticHtmlSaving(false);
    }
  };

  // Download the HTML (with edits if available)
  const handleDownloadAgenticHtml = async () => {
    try {
      let htmlContent = agenticHtmlEdited;

      // If no local edits, fetch from server
      if (!htmlContent && agenticHtmlPreviewUrl) {
        const response = await fetch(agenticHtmlPreviewUrl.split('?')[0]);
        if (response.ok) {
          htmlContent = await response.text();
        }
      }

      if (!htmlContent) {
        setError('No HTML content to download');
        return;
      }

      // Create and download the file
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `presentation-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    }
  };

  // Download as PDF using print functionality
  const handleDownloadAgenticPdf = async () => {
    try {
      let htmlContent = agenticHtmlEdited;

      // If no local edits, fetch from server
      if (!htmlContent && agenticHtmlPreviewUrl) {
        const response = await fetch(agenticHtmlPreviewUrl.split('?')[0]);
        if (response.ok) {
          htmlContent = await response.text();
        }
      }

      if (!htmlContent) {
        setError('No HTML content to convert to PDF');
        return;
      }

      // The HTML already contains @media print styles from the backend renderer.
      // Open in a new window and trigger print.
      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for resources and scripts (Chart.js) to settle, then print.
        printWindow.onload = () => {
          Promise.resolve(printWindow.document?.fonts?.ready)
            .catch(() => null)
            .finally(() => {
              setTimeout(() => {
                printWindow.focus();
                printWindow.print();
              }, 1200);
            });
        };
      } else {
        setError('Pop-up blocked. Please allow pop-ups to download PDF.');
      }
    } catch (err) {
      setError(`PDF generation failed: ${err.message}`);
    }
  };

  const handleAgenticHtmlChange = useCallback((html) => {
    if (typeof html !== 'string') return;
    setAgenticHtmlEdited((prev) => {
      if (agenticHtmlHistoryLockRef.current) {
        return html;
      }
      if (html !== prev) {
        if (typeof prev === 'string' && prev.length) {
          agenticHtmlHistoryRef.current.push(prev);
          if (agenticHtmlHistoryRef.current.length > 50) {
            agenticHtmlHistoryRef.current.shift();
          }
          setAgenticHtmlCanUndo(true);
        }
      }
      return html;
    });
  }, []);

  const handleUndoAgenticHtmlEdit = () => {
    const history = agenticHtmlHistoryRef.current;
    if (!history.length) return;
    const previous = history.pop();
    agenticHtmlHistoryLockRef.current = true;
    setAgenticHtmlEdited(previous || '');
    setAgenticChartEditorOpen(false);
    setAgenticHtmlCanUndo(history.length > 0);
    setTimeout(() => {
      agenticHtmlHistoryLockRef.current = false;
    }, 0);
  };

  const handleRevertAgenticHtmlEdits = () => {
    const fallback = lastSavedAgenticHtmlRef.current || '';
    agenticHtmlHistoryRef.current = [];
    setAgenticHtmlCanUndo(false);
    setAgenticHtmlEdited(fallback);
    setAgenticChartEditorOpen(false);
  };

  const handlePickLocalHtml = () => {
    if (agenticHtmlFileInputRef.current) {
      agenticHtmlFileInputRef.current.click();
    }
  };

  const handleLoadLocalHtml = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    try {
      const htmlContent = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const slideCount = doc.querySelectorAll('section.slide').length || 1;

      if (agenticHtmlLocalUrl) {
        URL.revokeObjectURL(agenticHtmlLocalUrl);
      }
      const blobUrl = URL.createObjectURL(new Blob([htmlContent], { type: 'text/html' }));

      setAgenticHtmlLocalUrl(blobUrl);
      setAgenticHtmlPreviewUrl(blobUrl);
      setAgenticHtmlBaseUrl('');
      setAgenticHtmlPresentationId('');
      setAgenticHtmlDownloadUrl('');
      setAgenticHtmlStatus(`Loaded local HTML: ${file.name}`);
      setAgenticHtmlSlideCount(slideCount);
      setAgenticHtmlSlideIndex(1);
      setAgenticHtmlEdited(htmlContent);
      agenticHtmlHistoryRef.current = [];
      setAgenticHtmlCanUndo(false);
      setShowAgenticHtmlFullPreview(false);
      setView('editor');
    } catch (err) {
      setError(`Failed to load HTML: ${err.message}`);
    } finally {
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleOpenAgenticHtmlPreview = () => {
    if (!agenticHtmlPreviewUrl) return;
    setShowAgenticHtmlFullPreview(true);
    setView('editor');
  };

  const handleGenerateTemplateFromPrompt = async () => {
    const promptText = (promptInputRef.current || prompt).trim();
    if (!promptText) return;
    if (templateId === 'default') {
      setError('Select a template to use AI template generation.');
      return;
    }
    if (selectedDocs.length === 0) {
      setError('Select at least one document to use PDF knowledge.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      setPptxPreviewFilename('');
      setPptxPreviewError('');
      const outlineResponse = await api.generateOutline(
        selectedDocs,
        `Create an outline with about ${slideCount} slides. Theme: ${theme}. Template: ${templateId}. ` +
          `Use the user prompt as guidance: ${promptText}`,
        generationProfile,
        slideCount
      );
      const outlineText = outlineResponse.outline || '';
      if (!outlineText.trim()) {
        throw new Error('Outline generation returned empty text.');
      }
      const response = await api.generateTemplateFromTopic(templateId, outlineText, {
        theme,
        slideCount,
        chartTypes,
      });
      if (response.downloadUrl) {
        setTemplateDownloadUrl(response.downloadUrl);
      }
      if (response.filename) {
        const importResponse = await api.importTemplatePptx(response.filename);
        if (!importResponse.presentation) {
          throw new Error('Failed to import generated template');
        }
        const presentation = applyPresentationMeta(importResponse.presentation);
        setCurrentDeck(applyDeckLogo(presentation));
        setCurrentSlide(0);
        setView('editor');
      }
    } catch (err) {
      setError(`Template generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseIrOutlineTemplate = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await api.generateOutline([], '', 'ir', slideCount);
      setCurrentOutlineText(response.outline || '');
      setGenerationMode('outline');
      setIsIrOutline(true);
      setView('outline');
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (view !== 'outline' || !isIrOutline) return;
    let cancelled = false;
    const refreshOutline = async () => {
      setIsAnalyzing(true);
      setError(null);
      try {
        const response = await api.generateOutline([], '', 'ir', slideCount);
        if (!cancelled) setCurrentOutlineText(response.outline || '');
      } catch (err) {
        if (!cancelled) setError(`Analysis failed: ${err.message}`);
      } finally {
        if (!cancelled) setIsAnalyzing(false);
      }
    };
    refreshOutline();
    return () => {
      cancelled = true;
    };
  }, [slideCount, view, isIrOutline]);

  const handleAnalyzeOutline = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      setIsIrOutline(false);
      const response = await api.generateOutline(
        selectedDocs,
        `Create an outline with about ${slideCount} slides. Theme: ${theme}. Template: ${templateId}.`,
        generationProfile,
        slideCount
      );
      setCurrentOutlineText(response.outline || '');
      setView('outline');
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateFromOutline = async (outlineText) => {
    if (!outlineText.trim()) return;
    if (consistentMode) {
      return handleGenerateConsistent(outlineText, generationProfile, true);
    }
    setIsGenerating(true);
    setError(null);
    try {
      const prefix = 'Use this outline as the slide plan. Preserve section order and slide titles.';
      const plainText = await buildSlidespeakPrompt(`${prefix}\n${outlineText}`, generationProfile);
      await generateSlidespeakDeck(plainText, generationProfile);
    } catch (err) {
      setError(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTemplateFromOutline = async (outlineText) => {
    if (!outlineText.trim()) return;
    if (templateId === 'default') {
      setError('Select a template to use AI template generation.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      setPptxPreviewFilename('');
      setPptxPreviewError('');
      const detailInstruction = isIrOutline
        ? 'Use the uploaded documents to fill each slide with detailed content (3-5 bullets), including numbers when available.'
        : '';
      const response = await api.generateTemplateFromTopic(templateId, outlineText, {
        theme,
        slideCount,
        detailInstruction,
      });
      if (response.downloadUrl) {
        setTemplateDownloadUrl(response.downloadUrl);
      }
      if (response.filename) {
        const importResponse = await api.importTemplatePptx(response.filename);
        if (!importResponse.presentation) {
          throw new Error('Failed to import generated template');
        }
        const presentation = applyPresentationMeta(importResponse.presentation);
        setCurrentDeck(applyDeckLogo(presentation));
        setCurrentSlide(0);
        setView('editor');
      }
    } catch (err) {
      setError(`Template generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateConsistent = async (requirementsText, profile = generationProfile, fromOutline = false) => {
    const base = requirementsText.trim();
    if (!base) return;
    setIsGenerating(true);
    setError(null);
    try {
      setPptxPreviewFilename('');
      setPptxPreviewError('');
      const prefix = fromOutline
        ? 'Use this outline exactly as the slide plan.'
        : 'Use this prompt as the slide plan.';
      const requirements = `${prefix}\nTarget slide count: ${slideCount}. Theme: ${theme}. Deck type: ${profile}.\n${base}`;
      const response = await api.consistentGenerate(requirements, consistentPdfPath, {
        documentIds: selectedDocs,
        slideCount,
        deckType: profile,
        theme,
        strictMissing: true,
      });
      if (!response?.slides) {
        throw new Error('Consistent mode returned no slides.');
      }
      setConsistentPresentation(response);
      setConsistentMetrics(response.metrics || null);
      setCurrentDeck(null);
      setView('consistent');
    } catch (err) {
      setError(`Consistent generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!currentDeck) return;
    const promptsFromDeck = currentDeck.slides
      .map((slideItem) => {
        if (!slideItem.image || !slideItem.image.placeholderId) return null;
        const placeholderId = slideItem.image.placeholderId;
        if (generatedImages[placeholderId]) return null;
        const promptText =
          slideItem.image.prompt ||
          `Create a professional slide image. Title: ${slideItem.title || 'Untitled'}. ` +
            `Key points: ${ensureArray(
              slideItem.content ||
                slideItem.leftColumn?.items ||
                slideItem.rightColumn?.items ||
                slideItem.leftSide?.content?.items ||
                slideItem.rightSide?.content?.items
            ).join('; ')}`;
        return {
          slideId: slideItem.slideId,
          placeholderId,
          prompt: promptText,
        };
      })
      .filter(Boolean);

    if (!promptsFromDeck.length) return;
    setIsGenerating(true);
    setError(null);
    try {
      const response = await api.generateImages(promptsFromDeck);
      setGeneratedImages((prev) => ({ ...prev, ...(response.images || {}) }));
    } catch (err) {
      setError(`Image generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    setError(null);
    try {
      if (!agenticHtmlPresentationId) {
        // Fallback to browser print if no backend presentation ID
        await handleDownloadAgenticPdf();
        return;
      }

      // Save any pending edits so the backend renders the latest version
      if (agenticHtmlEdited) {
        await api.agenticSaveHtml(agenticHtmlPresentationId, agenticHtmlEdited);
        lastSavedAgenticHtmlRef.current = agenticHtmlEdited;
        setAgenticHtmlEdited('');
      }

      // Call the Playwright backend and download as a file
      const pdfUrl = `${MULTI_AGENT_API_BASE}/api/presentations/${agenticHtmlPresentationId}/download-pdf`;
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `PDF generation failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `presentation-${agenticHtmlPresentationId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`PDF export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };


  const handleRegenerateSlide = async () => {
    if (!currentDeck || !slide) return;
    if (!regeneratePrompt.trim()) return;
    setIsRegenerating(true);
    setError(null);
    try {
      const response = await api.regenerateSlide(slide, selectedDocs, regeneratePrompt);
      if (!response.slide) {
        throw new Error('No slide returned');
      }
      updateCurrentSlide(() => response.slide);
      setRegeneratePrompt('');
    } catch (err) {
      setError(`Regenerate failed: ${err.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  const updateCurrentSlide = (updater) => {
    setCurrentDeck((deck) => {
      if (!deck) return deck;
      const slides = [...deck.slides];
      slides[currentSlide] = updater({ ...slides[currentSlide] });
      return { ...deck, slides };
    });
  };

  // Handler for inline editing in IrSlide - updates a specific field by path
  const handleSlideFieldUpdate = (slideIndex, path, value) => {
    setCurrentDeck((deck) => {
      if (!deck) return deck;
      const slides = [...deck.slides];
      const slide = { ...slides[slideIndex] };

      // Handle nested paths like 'comparison.prevValue' or 'leftTable.title'
      const pathParts = path.split('.');
      if (pathParts.length === 1) {
        slide[path] = value;
      } else {
        let current = slide;
        for (let i = 0; i < pathParts.length - 1; i++) {
          const key = pathParts[i];
          current[key] = current[key] ? { ...current[key] } : {};
          current = current[key];
        }
        current[pathParts[pathParts.length - 1]] = value;
      }

      slides[slideIndex] = slide;
      return { ...deck, slides };
    });
  };

  const updateSlideByTarget = (target, updater) => {
    if (!target) return;
    setCurrentDeck((deck) => {
      if (!deck) return deck;
      const slides = [...deck.slides];
      const targetIndex =
        target.slideId != null
          ? slides.findIndex((item) => item.slideId === target.slideId)
          : -1;
      const index = targetIndex >= 0 ? targetIndex : target.index;
      if (index == null || index < 0 || index >= slides.length) return deck;
      slides[index] = updater({ ...slides[index] });
      return { ...deck, slides };
    });
  };

  const updateBullets = (items) => {
    updateCurrentSlide((current) => {
      if (Array.isArray(current.content)) {
        current.content = items;
        return current;
      }
      if (current.leftColumn?.items) {
        current.leftColumn = { ...current.leftColumn, items };
        return current;
      }
      if (current.rightColumn?.items) {
        current.rightColumn = { ...current.rightColumn, items };
        return current;
      }
      if (current.leftSide?.content?.items) {
        current.leftSide = {
          ...current.leftSide,
          content: { ...current.leftSide.content, items },
        };
        return current;
      }
      if (current.rightSide?.content?.items) {
        current.rightSide = {
          ...current.rightSide,
          content: { ...current.rightSide.content, items },
        };
        return current;
      }
      current.content = items;
      return current;
    });
  };

  const chartContext = useMemo(() => {
    if (!slide) return null;
    if (slide.chartData) {
      return {
        chartData: slide.chartData,
        update: (next) =>
          updateCurrentSlide((current) => ({
            ...current,
            chartData: next,
          })),
      };
    }
    if (slide.leftColumn?.type === 'chart') {
      return {
        chartData: slide.leftColumn.chartData || {},
        update: (next) =>
          updateCurrentSlide((current) => ({
            ...current,
            leftColumn: {
              ...current.leftColumn,
              type: 'chart',
              chartData: next,
            },
          })),
      };
    }
    if (slide.rightColumn?.type === 'chart') {
      return {
        chartData: slide.rightColumn.chartData || {},
        update: (next) =>
          updateCurrentSlide((current) => ({
            ...current,
            rightColumn: {
              ...current.rightColumn,
              type: 'chart',
              chartData: next,
            },
          })),
      };
    }
    if (slide.content?.type === 'chart') {
      return {
        chartData: slide.content.chartData || {},
        update: (next) =>
          updateCurrentSlide((current) => ({
            ...current,
            content: {
              ...current.content,
              type: 'chart',
              chartData: next,
            },
          })),
      };
    }
    if (slide.content?.leftColumn?.type === 'chart') {
      return {
        chartData: slide.content.leftColumn.chartData || {},
        update: (next) =>
          updateCurrentSlide((current) => ({
            ...current,
            content: {
              ...current.content,
              leftColumn: {
                ...current.content.leftColumn,
                type: 'chart',
                chartData: next,
              },
            },
          })),
      };
    }
    if (slide.content?.rightColumn?.type === 'chart') {
      return {
        chartData: slide.content.rightColumn.chartData || {},
        update: (next) =>
          updateCurrentSlide((current) => ({
            ...current,
            content: {
              ...current.content,
              rightColumn: {
                ...current.content.rightColumn,
                type: 'chart',
                chartData: next,
              },
            },
          })),
      };
    }
    return null;
  }, [slide]);

  const slideChartData = chartContext?.chartData || null;
  const activeChartContext = chartDraft
    ? { chartData: chartDraft, update: setChartDraft }
    : chartContext;
  const activeChartData = activeChartContext?.chartData || null;
  const [chartForm, setChartForm] = useState(null);

  useEffect(() => {
    if (!activeChartData) {
      setChartForm(null);
      return;
    }
    const labels = ensureArray(activeChartData.labels);
    const values = ensureArray(activeChartData.datasets?.[0]?.data);
    const rows = labels.map((label, idx) => ({
      label,
      value: values[idx] ?? 0,
    }));
    setChartForm({
      type: activeChartData.type || 'bar',
      title: activeChartData.title || '',
      seriesLabel: activeChartData.datasets?.[0]?.label || 'Series',
      backgroundColor: activeChartData.datasets?.[0]?.backgroundColor || '#3b82f6',
      labelsInput: labels.join(', '),
      valuesInput: values.join(', '),
      rows,
    });
  }, [currentSlide, activeChartData]);

  const commitChartForm = (nextForm) => {
    if (!activeChartContext) return;
    const form = nextForm || chartForm;
    if (!form) return;
    const labels = form.rows.map((row) => row.label);
    const values = form.rows.map((row) => {
      const numeric = Number(row.value);
      return Number.isNaN(numeric) ? 0 : numeric;
    });
    activeChartContext.update({
      ...activeChartData,
      type: form.type,
      title: form.title,
      labels,
      datasets: [
        {
          ...(activeChartData?.datasets?.[0] || { label: 'Series' }),
          label: form.seriesLabel || 'Series',
          data: values,
          backgroundColor: form.backgroundColor || '#3b82f6',
        },
      ],
      showLegend: activeChartData?.showLegend ?? true,
    });
  };

  const updateChartField = (field, value) => {
    setChartForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  };

  const updateChartLabels = (value) => {
    setChartForm((prev) => {
      if (!prev) return prev;
      return { ...prev, labelsInput: value };
    });
  };

  const updateChartSeriesLabel = (value) => {
    updateChartField('seriesLabel', value);
  };

  const updateChartDataValues = (value) => {
    setChartForm((prev) => {
      if (!prev) return prev;
      return { ...prev, valuesInput: value };
    });
  };

  const updateChartRow = (index, field, value) => {
    setChartForm((prev) => {
      if (!prev) return prev;
      const rows = [...prev.rows];
      const row = { ...rows[index] };
      row[field] = value;
      rows[index] = row;
      return { ...prev, rows };
    });
  };

  const addChartRow = () => {
    setChartForm((prev) => {
      if (!prev) return prev;
      const rows = [...prev.rows, { label: `Item ${prev.rows.length + 1}`, value: 0 }];
      const next = { ...prev, rows };
      commitChartForm(next);
      return next;
    });
  };

  const removeChartRow = (index) => {
    setChartForm((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.filter((_, idx) => idx !== index);
      const next = { ...prev, rows };
      commitChartForm(next);
      return next;
    });
  };

  const handleChartEdit = async () => {
    if (!activeChartContext || !chartEditPrompt.trim()) return;
    setIsChartEditing(true);
    setError(null);
    try {
      const response = await api.editChart(activeChartData, chartEditPrompt, {
        title: slide?.title,
        bullets: ensureArray(slideBullets),
      });
      if (!response?.chartData) {
        throw new Error('No chart data returned');
      }
      activeChartContext.update(response.chartData);
      const labels = ensureArray(response.chartData.labels);
      const values = ensureArray(response.chartData.datasets?.[0]?.data);
      const rows = labels.map((label, idx) => ({
        label,
        value: values[idx] ?? 0,
      }));
      setChartForm({
        type: response.chartData.type || 'bar',
        title: response.chartData.title || '',
        seriesLabel: response.chartData.datasets?.[0]?.label || 'Series',
        backgroundColor: response.chartData.datasets?.[0]?.backgroundColor || '#3b82f6',
        labelsInput: labels.join(', '),
        valuesInput: values.join(', '),
        rows,
      });
      setChartEditPrompt('');
    } catch (err) {
      setError(`Chart edit failed: ${err.message}`);
    } finally {
      setIsChartEditing(false);
    }
  };

  const applyAutoChartCandidate = (candidate) => {
    if (!candidate) return;
    if (!candidate.chartData && !candidate.table && !candidate.metrics) {
      setAutoChartError('No chart data returned for this candidate.');
      return;
    }
    setAutoChartError('');
    setChartBuilderSeed(candidate);
    setChartBuilderTarget({ slideId: slide?.slideId, index: currentSlide });
    setIsAutoChartModalOpen(false);
    setIsChartBuilderOpen(true);
  };

  const openVisualLibrary = () => {
    setVisualLibraryTarget({ slideId: slide?.slideId, index: currentSlide });
    setVisualImageUrl('');
    setVisualImageError('');
    setVisualTemplateTouched(false);
    setIsVisualLibraryOpen(true);
  };

  const handleGenerateVisual = async () => {
    if (!currentVisualTemplate) return;
    if (isVisualGenerating) return;
    setIsVisualGenerating(true);
    setVisualImageError('');
    const placeholderId = `visual_${Date.now()}`;
    try {
      const fields = getVisualFieldValues();
      const prompt = visualPromptOverride || buildVisualPrompt(currentVisualTemplate, fields);
      const response = await api.generateImages([{ placeholderId, prompt }]);
      const image = response.images?.[placeholderId];
      if (!image?.data) {
        throw new Error('No image data returned');
      }
      setVisualImageUrl(image.data);
    } catch (err) {
      setVisualImageError(err.message || 'Failed to generate visual');
    } finally {
      setIsVisualGenerating(false);
    }
  };

  const handleAutoGenerateCharts = async () => {
    if (!slide) return;
    if (!selectedDocs.length) {
      setError('Select documents to generate charts.');
      return;
    }
    setIsAutoCharting(true);
    setAutoChartError('');
    setAutoChartCandidates([]);
    setAutoChartMissing([]);
    try {
      const response = await api.autoGenerateCharts(slide, selectedDocs, chartTypes);
      setAutoChartCandidates(response.candidates || []);
      setAutoChartMissing(response.missing || []);
      setIsAutoChartModalOpen(true);
    } catch (err) {
      setAutoChartError(err.message);
    } finally {
      setIsAutoCharting(false);
    }
  };

  const imageFrame = slide?.image?.frame || { x: 58, y: 22, w: 32, h: 40 };
  const chartImageFrame = slide?.chartImage?.frame || { x: 8, y: 28, w: 84, h: 50 };
  const logoFrame = slide?.logo?.frame || { x: 3.5, y: 4.5, w: 18, h: 12 };

  const updateImageFrame = (nextFrame) => {
    updateCurrentSlide((current) => {
      const image = current.image || {
        placeholderId: `img_${current.slideId || currentSlide}`,
        prompt: '',
      };
      current.image = { ...image, frame: nextFrame };
      return current;
    });
    if (showAgenticHtmlInline && agenticHtmlPreviewUrl) {
      const targetIndex = agenticHtmlSlideIndex ? agenticHtmlSlideIndex - 1 : currentSlide;
      (async () => {
        let html = agenticHtmlEdited || lastSavedAgenticHtmlRef.current;
        if (!html) {
          try {
            const response = await fetch(agenticHtmlPreviewUrl.split('?')[0]);
            if (response.ok) html = await response.text();
          } catch {}
        }
        if (!html) return;
        const updated = applyImageFrameToHtml(html, targetIndex, nextFrame);
        if (updated) {
          setAgenticHtmlEdited(updated);
        }
      })();
    }
  };

  const updateChartImageFrame = (nextFrame) => {
    const imageData = slide?.chartImage?.data;
    updateCurrentSlide((current) => {
      const chartImage = current.chartImage || {
        data: '',
      };
      current.chartImage = { ...chartImage, frame: nextFrame };
      return current;
    });
    if (showAgenticHtmlInline && agenticHtmlPreviewUrl && imageData) {
      const targetIndex = agenticHtmlSlideIndex ? agenticHtmlSlideIndex - 1 : currentSlide;
      (async () => {
        let html = agenticHtmlEdited || lastSavedAgenticHtmlRef.current;
        if (!html) {
          try {
            const response = await fetch(agenticHtmlPreviewUrl.split('?')[0]);
            if (response.ok) html = await response.text();
          } catch {}
        }
        if (!html) return;
        const updated = applyChartImageToHtml(html, targetIndex, imageData, nextFrame);
        if (updated) {
          setAgenticHtmlEdited(updated);
        }
      })();
    }
  };

  const updateLogoFrame = (nextFrame) => {
    updateCurrentSlide((current) => {
      const logo = current.logo || {
        placeholderId: `logo_${current.slideId || currentSlide}`,
        position: deckLogoPosition,
        data: deckLogoData,
      };
      current.logo = { ...logo, frame: nextFrame };
      return current;
    });
  };

  const updateImagePrompt = (nextPrompt) => {
    updateCurrentSlide((current) => {
      const image = current.image || {
        placeholderId: `img_${current.slideId || currentSlide}`,
        frame: imageFrame,
      };
      current.image = { ...image, prompt: nextPrompt };
      return current;
    });
  };

  const handleLogoUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateCurrentSlide((current) => {
        const logo = current.logo || {
          placeholderId: `logo_${current.slideId || currentSlide}`,
          position: 'left',
        };
        current.logo = { ...logo, data: reader.result };
        return current;
      });
    };
    reader.readAsDataURL(file);
  };

  const HomeView = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Presentation className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Presentation Studio
            </span>
          </div>
          <button
            onClick={() => setView('documents')}
            className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium"
          >
            Documents ({documents.length})
          </button>
          <button
            onClick={() => setView('charts')}
            className="px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition font-medium"
          >
            Chart Builder
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            AI presentations built from your PDFs
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload PDFs, run RAG, edit slides visually, and export HTML/PDF decks
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div
          className="bg-white rounded-2xl shadow-2xl p-8 mb-8 border-2 border-dashed border-gray-300 hover:border-blue-500 transition cursor-pointer"
          onDrop={(event) => {
            onDrop(event);
            event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <input
            id="fileInput"
            type="file"
            accept=".pdf,.csv,.tsv,.xls,.xlsx"
            multiple
            className="hidden"
            onChange={(event) => handleFileUpload(Array.from(event.target.files))}
          />

          <div className="text-center">
            <Upload className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Upload PDF / CSV / Excel documents</h3>
            <p className="text-gray-600 mb-4">Drag & drop or click to select PDF files</p>
            {isUploading && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  Uploading and indexing... {Math.round(uploadProgress)}%
                </p>
              </div>
            )}
          </div>
        </div>

        {documents.length > 0 && (
          <div className="text-center space-y-4">
            <button
              onClick={() => setView('documents')}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition shadow-lg text-lg"
            >
              Continue with {documents.length} document{documents.length > 1 ? 's' : ''} →
            </button>
            {currentDeck && (
              <button
                onClick={() => setView('editor')}
                className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-white transition"
              >
                Resume last deck
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const DocumentsView = () => (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('home')} className="text-gray-600 hover:text-gray-900">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold">Your Documents</h2>
          </div>
          <div className="flex items-center gap-4">
            {currentDeck && (
              <button
                onClick={() => setView('editor')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Resume deck
              </button>
            )}
            <button
              onClick={() => setView('charts')}
              className="text-sm text-emerald-600 hover:text-emerald-800 font-medium"
            >
              Chart Builder
            </button>
            <button
              onClick={() => setView('home')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Upload More
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {documents.map((doc) => {
            const selected = selectedDocs.includes(doc.id);
            return (
              <div
                key={doc.id}
                onClick={() =>
                  setSelectedDocs((prev) =>
                    selected
                      ? prev.filter((id) => id !== doc.id)
                      : [...prev, doc.id]
                  )
                }
                className={`bg-white rounded-xl shadow-sm border p-4 cursor-pointer transition ${
                  selected
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900 truncate max-w-[180px]">
                        {doc.filename || 'Untitled PDF'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {doc.fileType === 'tabular'
                          ? `${doc.rowCount || 0} rows`
                          : doc.numPages
                          ? `${doc.numPages} pages`
                          : 'PDF'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteDocument(doc.id);
                    }}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {selected && (
                  <div className="mt-3 flex items-center gap-2 text-blue-600 text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Selected
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-3">Presentation options</h3>

          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setGenerationProfile('business')}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                generationProfile === 'business'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Business Proposal
            </button>
            <button
              onClick={() => {
                setGenerationProfile('ir');
              }}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                generationProfile === 'ir'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              IR Deck
            </button>
          </div>

          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setGenerationMode('outline')}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                generationMode === 'outline'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 Outline first
            </button>
            <button
              onClick={() => setGenerationMode('prompt')}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                generationMode === 'prompt'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✨ Prompt only
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
            <label className="flex items-center gap-2">
              Slides
              <input
                type="number"
                min={3}
                max={30}
                value={slideCount}
                onChange={(event) => setSlideCount(Number(event.target.value))}
                className="w-20 border border-gray-300 rounded px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2 text-gray-600">
              <input
                type="checkbox"
                checked={slidespeakUseAutoLength}
                onChange={(event) => setSlidespeakUseAutoLength(event.target.checked)}
              />
              Auto slide count (AI)
            </label>
            <label className="flex items-center gap-2 text-gray-600">
              <input
                type="checkbox"
                checked={consistentMode}
                onChange={(event) => {
                  const next = event.target.checked;
                  setConsistentMode(next);
                  if (!next) {
                    setConsistentPresentation(null);
                    setConsistentMetrics(null);
                  }
                }}
              />
              Consistent JSON mode (Python)
            </label>
            {consistentMode && (
              <label className="flex items-center gap-2 text-gray-600">
                PDF for consistent mode
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      const response = await api.consistentUploadPdf(file);
                      setConsistentPdfPath(response.path || '');
                    } catch (err) {
                      setError(`Consistent PDF upload failed: ${err.message}`);
                    }
                  }}
                  className="text-sm"
                />
              </label>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 p-4 mb-4 bg-gray-50">
            <div className="text-sm font-semibold text-gray-700 mb-3">SlideSpeak options</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <label className="flex flex-col gap-1 text-gray-600">
                Language
                <input
                  type="text"
                  value={slidespeakLanguage}
                  onChange={(event) => setSlidespeakLanguage(event.target.value)}
                  placeholder="ORIGINAL, English, French..."
                  className="border border-gray-300 rounded px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1 text-gray-600">
                Tone
                <select
                  value={slidespeakTone}
                  onChange={(event) => setSlidespeakTone(event.target.value)}
                  className="border border-gray-300 rounded px-2 py-1"
                >
                  <option value="default">default</option>
                  <option value="casual">casual</option>
                  <option value="professional">professional</option>
                  <option value="funny">funny</option>
                  <option value="educational">educational</option>
                  <option value="sales_pitch">sales_pitch</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-gray-600">
                Verbosity
                <select
                  value={slidespeakVerbosity}
                  onChange={(event) => setSlidespeakVerbosity(event.target.value)}
                  className="border border-gray-300 rounded px-2 py-1"
                >
                  <option value="concise">concise</option>
                  <option value="standard">standard</option>
                  <option value="text-heavy">text-heavy</option>
                </select>
              </label>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakFetchImages}
                  onChange={(event) => setSlidespeakFetchImages(event.target.checked)}
                />
                Fetch images
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakUseDocumentImages}
                  onChange={(event) => setSlidespeakUseDocumentImages(event.target.checked)}
                  disabled
                />
                Use document images (requires document UUIDs)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakUseKnowledge}
                  onChange={(event) => setSlidespeakUseKnowledge(event.target.checked)}
                />
                Use knowledge from selected docs
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakUseWordingFromDocument}
                  onChange={(event) => setSlidespeakUseWordingFromDocument(event.target.checked)}
                  disabled
                />
                Use wording from document (requires document UUIDs)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakIncludeCover}
                  onChange={(event) => setSlidespeakIncludeCover(event.target.checked)}
                />
                Include cover
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakIncludeToc}
                  onChange={(event) => setSlidespeakIncludeToc(event.target.checked)}
                />
                Include table of contents
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakAddSpeakerNotes}
                  onChange={(event) => setSlidespeakAddSpeakerNotes(event.target.checked)}
                />
                Add speaker notes
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakUseGeneralKnowledge}
                  onChange={(event) => setSlidespeakUseGeneralKnowledge(event.target.checked)}
                />
                Use general knowledge
              </label>
            </div>
            {slidespeakUseKnowledge && (
              <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                Max knowledge tokens
                <input
                  type="number"
                  min={200}
                  max={4000}
                  value={slidespeakKnowledgeMaxTokens}
                  onChange={(event) =>
                    setSlidespeakKnowledgeMaxTokens(Number(event.target.value))
                  }
                  className="w-24 border border-gray-300 rounded px-2 py-1"
                />
                <button
                  type="button"
                  onClick={handleDownloadKnowledgeKVs}
                  className="ml-2 px-3 py-1 border border-blue-200 text-blue-700 rounded-lg text-xs hover:bg-blue-50"
                >
                  Download KV JSON
                </button>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col gap-1 text-gray-600">
                Custom instructions
                <textarea
                  value={slidespeakCustomInstructions}
                  onChange={(event) => setSlidespeakCustomInstructions(event.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 h-20"
                />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakUseBrandingLogo}
                  onChange={(event) => setSlidespeakUseBrandingLogo(event.target.checked)}
                />
                Use branding logo
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakUseBrandingFonts}
                  onChange={(event) => setSlidespeakUseBrandingFonts(event.target.checked)}
                />
                Use branding fonts
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakUseBrandingColor}
                  onChange={(event) => setSlidespeakUseBrandingColor(event.target.checked)}
                />
                Use branding color
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                Branding logo URL
                <input
                  type="text"
                  value={slidespeakBrandingLogo}
                  onChange={(event) => setSlidespeakBrandingLogo(event.target.value)}
                  className="border border-gray-300 rounded px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                Branding color (hex)
                <input
                  type="text"
                  value={slidespeakBrandingColor}
                  onChange={(event) => setSlidespeakBrandingColor(event.target.value)}
                  placeholder="#000000"
                  className="border border-gray-300 rounded px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                Title font
                <input
                  type="text"
                  value={slidespeakBrandingTitleFont}
                  onChange={(event) => setSlidespeakBrandingTitleFont(event.target.value)}
                  className="border border-gray-300 rounded px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                Body font
                <input
                  type="text"
                  value={slidespeakBrandingBodyFont}
                  onChange={(event) => setSlidespeakBrandingBodyFont(event.target.value)}
                  className="border border-gray-300 rounded px-2 py-1"
                />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slidespeakRunSync}
                  onChange={(event) => setSlidespeakRunSync(event.target.checked)}
                />
                Run sync
              </label>
              <label className="flex flex-col gap-1">
                Response format
                <select
                  value={slidespeakResponseFormat}
                  onChange={(event) => setSlidespeakResponseFormat(event.target.value)}
                  className="border border-gray-300 rounded px-2 py-1"
                >
                  <option value="powerpoint">powerpoint</option>
                  <option value="pdf">pdf</option>
                </select>
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <span className="text-gray-600">Theme</span>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {themeOptions.map((option) => (
                <button
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    className={`group rounded-xl border p-3 text-left transition ${
                      theme === option.id
                        ? 'border-blue-600 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <div className={`h-16 rounded-lg ${option.swatch} relative mb-3`}>
                      <div className={`absolute top-2 left-2 h-2 w-6 rounded-full ${option.accent}`} />
                    </div>
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.note}</div>
                  </button>
                ))}
              </div>
              {theme === 'ntt' && (
                <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
                  Brand color
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(event) => setBrandColor(event.target.value)}
                    className="h-8 w-12 rounded border border-gray-300"
                  />
                </div>
              )}
              {theme === 'ir-deck' && (
                <div className="mt-6 rounded-2xl border border-gray-200 overflow-hidden">
                  <IRDeckTemplateSystem />
                </div>
              )}
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                  <span>SlideSpeak templates</span>
                  {isSlidespeakTemplatesLoading && (
                    <span className="text-xs text-gray-400">Loading...</span>
                  )}
                </div>
                {slidespeakTemplatesError && (
                  <div className="mb-3 text-xs text-red-600">{slidespeakTemplatesError}</div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {slidespeakTemplates.length === 0 && !isSlidespeakTemplatesLoading ? (
                    <div className="text-xs text-gray-500">No templates available.</div>
                  ) : (
                    slidespeakTemplates.map((template) => {
                      const cover = template.images?.cover || template.images?.content || '';
                      return (
                        <button
                          key={template.name}
                          type="button"
                          onClick={() => setTemplateId(template.name)}
                          className={`rounded-xl border text-left transition ${
                            templateId === template.name
                              ? 'border-blue-600 ring-2 ring-blue-200'
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <div className="h-20 rounded-t-xl overflow-hidden bg-slate-100">
                            {cover ? (
                              <img
                                src={cover}
                                alt={`${template.name} cover`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                No preview
                              </div>
                            )}
                          </div>
                          <div className="px-3 py-2 text-xs font-semibold text-gray-700">
                            {template.name}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full">
              <label className="flex items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={deckLogoEnabled}
                  onChange={(event) => setDeckLogoEnabled(event.target.checked)}
                />
                Apply logo to every slide
              </label>
              {deckLogoEnabled && (
                <>
                  <select
                    value={deckLogoPosition}
                    onChange={(event) => setDeckLogoPosition(event.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="left">left</option>
                    <option value="right">right</option>
                  </select>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setDeckLogoName(file.name);
                      const reader = new FileReader();
                      reader.onload = () => setDeckLogoData(reader.result);
                      reader.readAsDataURL(file);
                    }}
                    className="text-sm"
                  />
                  <span className="text-xs text-gray-500">
                    {deckLogoName || 'No file selected'}
                  </span>
                </>
              )}
            </div>
          </div>

          {generationMode === 'outline' ? (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                {generationProfile === 'ir'
                  ? 'Load the IR contents template, then refine the outline as needed.'
                  : 'Gemini will analyze your PDFs and return an outline you can edit.'}
              </p>
              <button
                onClick={() => {
                  if (generationProfile !== 'ir' && selectedDocs.length === 0) {
                    setError('Please select a document first.');
                    return;
                  }
                  (generationProfile === 'ir' ? handleUseIrOutlineTemplate : handleAnalyzeOutline)();
                }}
                disabled={isAnalyzing}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-semibold flex items-center justify-center gap-2"
              >
                {generationProfile === 'ir' ? (
                  <>
                    <Sparkles className="w-5 h-5"/>
                    Use IR Contents Template
                  </>
                ) : isAnalyzing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Analyzing documents...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Analyze & create outline
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              <textarea
                ref={promptTextareaRef}
                defaultValue={prompt}
                onChange={(event) => {
                  promptInputRef.current = event.target.value;
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Tab') return;
                  if (promptInputRef.current.trim()) return;
                  event.preventDefault();
                  const suggestion =
                    generationProfile === 'ir'
                      ? 'Create a detailed IR grant deck using the uploaded documents, focusing on market status, technology readiness, commercialization strategy, and compliance.'
                      : 'Create an investor pitch highlighting market size, product advantages, and financial projections.';
                  promptInputRef.current = suggestion;
                  if (promptTextareaRef.current) {
                    promptTextareaRef.current.value = suggestion;
                    promptTextareaRef.current.focus();
                  }
                }}
                placeholder={
                  generationProfile === 'ir'
                    ? 'e.g. Create a detailed IR grant deck using the uploaded documents, focusing on market status, technology readiness, commercialization strategy, and compliance.'
                    : 'e.g. Create an investor pitch highlighting market size, product advantages, and financial projections'
                }
                rows={4}
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex flex-wrap justify-end gap-3 mt-4">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Agentic theme
                  </label>
                  <select
                    value={agenticThemeId}
                    onChange={(event) => setAgenticThemeId(event.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {agenticThemes.map((themeOption) => (
                      <option key={themeOption.id} value={themeOption.id}>
                        {themeOption.name} — {themeOption.note}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Agentic template
                  </label>
                  <select
                    value={agenticTemplateId}
                    onChange={(event) => setAgenticTemplateId(event.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {visualTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Agentic logo (optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleAgenticLogoUpload(event.target.files?.[0])}
                      className="text-sm"
                    />
                    <span className="text-[11px] text-gray-500">
                      {agenticLogoUploading
                        ? 'Uploading…'
                        : agenticLogoName || 'No file'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openIrOnboarding}
                  className={`px-5 py-3 border rounded-lg font-semibold transition ${
                    irOnboardingComplete
                      ? 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'
                      : 'border-amber-500 text-amber-700 hover:bg-amber-50'
                  }`}
                  title={
                    irOnboardingComplete
                      ? 'IR onboarding complete'
                      : 'IR onboarding recommended for IR decks'
                  }
                >
                  IR onboarding {irOnboardingComplete ? '✓' : '⚠'}
                </button>
                <button
                  disabled={isAgenticHtmlGenerating}
                  onClick={handleGenerateAgenticHtml}
                  className="px-6 py-3 border border-indigo-700 text-indigo-700 rounded-lg font-semibold hover:bg-indigo-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAgenticHtmlGenerating ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Agentic HTML…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Agentic HTML
                    </>
                  )}
                </button>
                <button
                  disabled={isGenerating}
                  onClick={() => handleGenerateFromPrompt(generationProfile)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {generationProfile === 'ir' ? 'Generate IR Deck' : 'Generate Business Proposal'}
                    </>
                  )}
                </button>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <div className="font-semibold">Agentic HTML tools</div>
                {(agenticHtmlStatus || agenticHtmlDownloadUrl) && (
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
                    {agenticHtmlStatus && <span>Status: {agenticHtmlStatus}</span>}
                    {agenticHtmlStatus && <span>Progress: {agenticHtmlProgress}%</span>}
                    {agenticHtmlPresentationId ? <span>ID: {agenticHtmlPresentationId}</span> : null}
                  </div>
                )}
                <div className="mt-2 text-xs text-slate-500">
                  Load a local HTML file to preview and edit without regenerating a deck.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAgenticHtmlPreview}
                    disabled={!agenticHtmlDownloadUrl && !agenticHtmlPreviewUrl}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Open HTML
                  </button>
                  <input
                    ref={agenticHtmlFileInputRef}
                    type="file"
                    accept=".html,text/html"
                    className="hidden"
                    onChange={handleLoadLocalHtml}
                  />
                  <button
                    type="button"
                    onClick={handlePickLocalHtml}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Load local HTML
                  </button>
                  {agenticHtmlDownloadUrl && (
                    <a
                      className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      href={agenticHtmlDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download HTML
                    </a>
                  )}
                </div>
              </div>
              {templateDownloadUrl && (
                <div className="mt-3 text-sm text-blue-700">
                  Template deck ready:{' '}
                  <a
                    className="underline"
                    href={`${API_BASE.replace('/api', '')}${templateDownloadUrl}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {templateDownloadUrl}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );

  const OutlineView = () => {
    const splitLongBullet = (bullet) => {
      const trimmed = String(bullet || '').trim();
      if (!trimmed) return [];
      if (trimmed.length < 140 || !trimmed.includes('. ')) return [trimmed];
      const parts = trimmed
        .split('. ')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (part.endsWith('.') ? part : `${part}.`));
      if (parts.length <= 1) return [trimmed];
      return parts.slice(0, 6);
    };

    const normalizeSlidesToCount = (slides) => {
      const target = Number(slideCount) || 0;
      if (!target || slides.length === target) return slides;
      const normalized = slides.map((slide) => ({ ...slide }));

      while (normalized.length > target) {
        const extra = normalized.pop();
        const last = normalized[normalized.length - 1];
        if (extra?.bullets?.length) {
          last.bullets = [...(last.bullets || []), ...extra.bullets];
        }
      }

      while (normalized.length < target) {
        normalized.push({
          number: String(normalized.length + 1),
          title: `Slide ${normalized.length + 1}`,
          bullets: ['MISSING: Additional details for this section'],
          visuals: {},
        });
      }

      return normalized;
    };

    const attachDefaults = (slides) =>
      normalizeSlidesToCount(slides).map((slideItem, idx) => {
        const visuals = slideItem.visuals || {};
        const bullets = slideItem.bullets?.length ? slideItem.bullets : ['Key point'];
        const splitBullets = bullets.flatMap(splitLongBullet);
        return {
          number: slideItem.number || String(idx + 1),
          title: slideItem.title || `Slide ${idx + 1}`,
          bullets: splitBullets.length ? splitBullets : ['Key point'],
          visuals: {
            image: Boolean(visuals.image),
            table: Boolean(visuals.table),
          },
        };
      });

    const [outlineSlides, setOutlineSlides] = useState(
      attachDefaults(parseOutline(currentOutlineText))
    );
    const [outlineTitle, setOutlineTitle] = useState('Presentation Outline');

    useEffect(() => {
      setOutlineSlides(attachDefaults(parseOutline(currentOutlineText)));
    }, [currentOutlineText]);

    const updateSlide = (index, updater) => {
      setOutlineSlides((prev) =>
        prev.map((slideItem, idx) => (idx === index ? updater({ ...slideItem }) : slideItem))
      );
    };

    return (
      <div className="min-h-screen bg-white text-gray-900">
        <div className="flex items-center gap-4 p-4 border-b border-gray-200">
          <button
            onClick={() => setView('documents')}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-medium">Edit outline</h1>
        </div>

        <div className="max-w-6xl mx-auto p-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
            <h2 className="text-2xl font-semibold mb-2">Contents structure</h2>
            <p className="text-gray-500 mb-8">Edit the slide below to customize your presentation</p>

            <div className="mb-6">
              <label className="block text-sm text-gray-500 mb-2">Title</label>
              <input
                type="text"
                value={outlineTitle}
                onChange={(event) => setOutlineTitle(event.target.value)}
                className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-gray-300"
              />
            </div>

            <label className="block text-sm text-gray-500 mb-4">Content</label>

            <div className="space-y-4">
              {outlineSlides.map((slideItem, idx) => (
                <div key={`slide-${idx}`} className="bg-white rounded-xl p-6 relative group border border-gray-200">
                  <button
                    onClick={() => setOutlineSlides((prev) => prev.filter((_, sIdx) => sIdx !== idx))}
                    className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>

                  <div className="flex gap-4">
                    <div className="flex items-start gap-3">
                      <button className="p-2 hover:bg-gray-100 rounded cursor-move">
                        <GripVertical className="w-5 h-5 text-gray-400" />
                      </button>
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium mt-1">
                        {idx + 1}
                      </div>
                    </div>

                    <div className="flex-1">
                      <input
                        type="text"
                        value={slideItem.title}
                        onChange={(event) =>
                          updateSlide(idx, (current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        className="w-full bg-transparent text-xl font-semibold mb-3 focus:outline-none focus:bg-gray-50 px-2 py-1 rounded"
                      />

                      {slideItem.subtitle && (
                        <input
                          type="text"
                          value={slideItem.subtitle}
                          onChange={(event) =>
                            updateSlide(idx, (current) => ({
                              ...current,
                              subtitle: event.target.value,
                            }))
                          }
                          className="w-full bg-transparent text-gray-500 focus:outline-none focus:bg-gray-50 px-2 py-1 rounded"
                        />
                      )}

                      {slideItem.bullets && (
                        <ul className="mt-4 space-y-3">
                          {slideItem.bullets.map((bullet, bulletIdx) => (
                            <li key={`slide-${idx}-bullet-${bulletIdx}`} className="flex gap-3">
                              <span className="text-gray-400 mt-1">•</span>
                              <input
                                type="text"
                                value={bullet}
                                onChange={(event) =>
                                  updateSlide(idx, (current) => {
                                    const bullets = [...current.bullets];
                                    bullets[bulletIdx] = event.target.value;
                                    return { ...current, bullets };
                                  })
                                }
                                className="flex-1 bg-transparent text-gray-600 focus:outline-none focus:bg-gray-50 px-2 py-1 rounded"
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() =>
              setOutlineSlides((prev) => [
                ...prev,
                {
                  number: String(prev.length + 1),
                  title: 'New Slide',
                  bullets: ['Key point'],
                  visuals: {
                    image: false,
                    table: false,
                  },
                },
              ])
            }
            className="w-full bg-white text-gray-900 py-4 rounded-full text-lg font-medium hover:bg-gray-100 transition-colors border border-gray-200"
          >
            + Add slide
          </button>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => {
                const outlineText = serializeOutline(outlineSlides, outlineTitle);
                setCurrentOutlineText(outlineText);
                handleGenerateFromOutline(outlineText);
              }}
              disabled={isGenerating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Generate slides →</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ConsistentView = () => {
    const slides = consistentPresentation?.slides || [];
    const metrics = consistentMetrics || consistentPresentation?.metrics || {};

    return (
      <div className="min-h-screen bg-white text-gray-900">
        <div className="flex items-center gap-4 p-4 border-b border-gray-200">
          <button
            onClick={() => setView('documents')}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-medium">Consistent JSON Preview</h1>
        </div>

        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <div className="rounded-2xl border border-gray-200 p-6 bg-white">
            <h2 className="text-lg font-semibold mb-4">Generation Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-gray-500">Slides</div>
                <div className="text-xl font-semibold">{metrics.total_slides ?? slides.length}</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-gray-500">Duration</div>
                <div className="text-xl font-semibold">
                  {metrics.duration ? `${Math.round(metrics.duration)}s` : '—'}
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-gray-500">AI Calls</div>
                <div className="text-xl font-semibold">{metrics.api_calls ?? '—'}</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-gray-500">Auto-Fixed</div>
                <div className="text-xl font-semibold">{metrics.slides_fixed ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {slides.map((slideItem, idx) => (
              <div key={`consistent-${idx}`} className="rounded-2xl border border-gray-200 p-6 bg-white">
                <div className="text-sm text-gray-400 mb-2">Slide {idx + 1}</div>
                <div className="text-lg font-semibold mb-3">
                  {slideItem.title || slideItem?.content?.section_title || slideItem.type}
                </div>
                {Array.isArray(slideItem.content) && slideItem.content.length > 0 && (
                  <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
                    {slideItem.content.map((point, pIdx) => (
                      <li key={`pt-${idx}-${pIdx}`}>{point}</li>
                    ))}
                  </ul>
                )}
                {slideItem.left_content && (
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                    <ul className="list-disc pl-5 space-y-2">
                      {slideItem.left_content.map((point, pIdx) => (
                        <li key={`left-${idx}-${pIdx}`}>{point}</li>
                      ))}
                    </ul>
                    <ul className="list-disc pl-5 space-y-2">
                      {slideItem.right_content?.map((point, pIdx) => (
                        <li key={`right-${idx}-${pIdx}`}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {slideItem.timeline && (
                  <div className="space-y-2 text-sm text-gray-700">
                    {slideItem.timeline.map((item, tIdx) => (
                      <div key={`tl-${idx}-${tIdx}`}>
                        <span className="font-semibold text-gray-600">{item.period}</span>
                        <span className="ml-2">{item.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                {slideItem.members && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-700">
                    {slideItem.members.map((member, mIdx) => (
                      <div key={`m-${idx}-${mIdx}`} className="rounded-lg bg-gray-50 p-3">
                        <div className="font-semibold">{member.name}</div>
                        <div className="text-xs text-gray-500">{member.role}</div>
                        {member.description && (
                          <div className="text-xs text-gray-500 mt-2">{member.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {slideItem.needs_chart && (
                  <div className="mt-3 text-xs text-blue-600">Chart included</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const EditorView = () => {
    if (agenticHtmlPreviewUrl && showAgenticHtmlFullPreview) {
      return (
        <div
          className="h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col"
          style={{ position: 'fixed', inset: 0 }}
        >
          <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowAgenticHtmlFullPreview(false);
                  }}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h2 className="font-semibold">Agentic HTML Preview</h2>
              </div>
              <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.open(agenticHtmlPreviewUrl, '_blank', 'noopener')}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Open in new tab
                  </button>
                  <button
                    onClick={handleDownloadAgenticHtml}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Download HTML
                  </button>
                  {agenticHtmlPreviewUrl && (
                    <a
                      href={agenticHtmlPreviewUrl.replace('view-html', 'download-html')}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Direct download
                    </a>
                  )}
                  {agenticPdfDownloadUrl ? (
                    <a
                      href={agenticPdfDownloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Download PDF
                    </a>
                  ) : (
                    <button
                      onClick={handleDownloadAgenticPdf}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Download PDF
                    </button>
                  )}
              </div>
            </div>
          </nav>

              <div className="flex-1 px-4 pb-6">
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col min-h-[70vh]">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-600 uppercase">
                      Slide {agenticHtmlSlideIndex} / {agenticHtmlSlideCount || 1}
                    </span>
                    {agenticHtmlSlideCount > 1 && (
                      <input
                        type="range"
                        min={1}
                        max={agenticHtmlSlideCount}
                        value={agenticHtmlSlideIndex}
                        onChange={(event) => jumpToAgenticSlide(Number(event.target.value))}
                        className="flex-1"
                      />
                    )}
                    <button
                      type="button"
                      onClick={handleSaveAgenticHtmlEdits}
                      disabled={!agenticHtmlEdited || agenticHtmlSaving || !agenticHtmlPresentationId}
                      className={`px-3 py-1.5 text-xs rounded-lg disabled:opacity-50 ${
                        agenticHtmlEdited
                          ? 'bg-green-600 text-white hover:bg-green-700 border border-green-600'
                          : 'border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {agenticHtmlSaving ? 'Saving…' : agenticHtmlEdited ? '● Save Changes' : 'No changes'}
                    </button>
                  </div>
                  <div className="flex-1 min-h-[500px]">
                    <AgenticSlideEditor
                      slideUrl={agenticHtmlPreviewUrl}
                      slideIndex={agenticHtmlSlideIndex}
                      enableChartDataEditor={true}
                      showChartEditorToggle={true}
                      chartEditorOpen={agenticChartEditorOpen}
                      onChartEditorOpenChange={setAgenticChartEditorOpen}
                      htmlOverride={agenticHtmlEdited || ''}
                      onSlideChange={(html) => {
                        console.log('Slide changed:', html.substring(0, 100) + '...');
                        // TODO: Implement save to backend
                      }}
                      onHtmlChange={handleAgenticHtmlChange}
                    />
                  </div>
                </div>
              </div>
        </div>
      );
    }

    if (pptxPreviewFilename) {
      const totalSlides = pptxPreviewImages.length;
      const currentImage = pptxPreviewImages[currentSlide] || '';
      return (
        <div
          className="h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col"
          style={{ position: 'fixed', inset: 0 }}
        >
          <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setView('documents')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h2 className="font-semibold">PPTX Preview</h2>
                {totalSlides > 0 && (
                  <span className="text-xs uppercase tracking-wide bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Slide {currentSlide + 1} of {totalSlides}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setChartBuilderSeed(null);
                    setChartBuilderTarget({ slideId: pptxPreviewFilename, index: currentSlide });
                    setIsChartBuilderOpen(true);
                  }}
                  className="px-3 py-2 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 text-sm"
                >
                  Chart Builder
                </button>
                {downloadUrl && (
                  <a
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                    href={`${API_BASE.replace('/api', '')}${downloadUrl}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download PPTX
                  </a>
                )}
                <button
                  onClick={async () => {
                    try {
                      if (!api.getCollaboraUrl) {
                        setPptxPreviewError('Collabora integration is not configured.');
                        return;
                      }
                      const response = await api.getCollaboraUrl(pptxPreviewFilename);
                      window.open(response.url, '_blank', 'noopener,noreferrer');
                    } catch (err) {
                      setPptxPreviewError('Could not open Collabora.');
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Edit in Collabora
                </button>
              </div>
            </div>
          </nav>

          {pptxPreviewError && (
            <div className="max-w-7xl mx-auto px-4 py-2 text-sm text-amber-700">
              {pptxPreviewError}
            </div>
          )}

          <div className="flex-1 px-4 pb-6">
            <div className="h-full min-h-[70vh] bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {currentImage ? (
                <div className="h-full w-full flex items-center justify-center bg-slate-50">
                  <img
                    src={`${API_BASE.replace('/api', '')}${currentImage}`}
                    alt={`Slide ${currentSlide + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">
                  PPTX preview images are not available.
                </div>
              )}
            </div>
          </div>

          {totalSlides > 0 && (
            <div className="max-w-6xl mx-auto px-4 pb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentSlide === 0}
                    onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))}
                    className="px-2 py-1 border rounded-full disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                    {currentSlide + 1} of {totalSlides}
                  </span>
                  <button
                    disabled={currentSlide >= totalSlides - 1}
                    onClick={() => setCurrentSlide((s) => Math.min(totalSlides - 1, s + 1))}
                    className="px-2 py-1 border rounded-full disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs uppercase tracking-wide text-gray-500">Slides</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-3">
                {pptxPreviewImages.map((img, idx) => (
                  <button
                    key={`pptx-thumb-${idx}`}
                    onClick={() => setCurrentSlide(idx)}
                    className={`w-full text-left rounded-lg border p-2 transition ${
                      idx === currentSlide
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="h-20 rounded-md mb-2 border border-gray-200 bg-white overflow-hidden">
                      <img
                        src={`${API_BASE.replace('/api', '')}${img}`}
                        alt={`Slide ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-xs text-gray-500">Slide {absoluteIndex + 1}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (!slide) return null;
    const shouldRenderIrDeck = isIrDeckTheme && slide?.irTemplate;

    return (
      <div
        className="h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col overflow-hidden"
        style={{ position: 'fixed', inset: 0 }}
      >
        <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('documents')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-semibold">
                Slide {currentSlide + 1} of {currentDeck.slides.length}
              </h2>
              <span className="text-xs uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full" title="Changes are automatically saved">
                Auto-saved
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('charts')}
                className="px-3 py-2 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50"
              >
                Chart Builder
              </button>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-2 py-1">
                <button
                  onClick={() => setZoom((z) => Math.max(50, z - 10))}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs w-10 text-center">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(150, z + 10))}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleGenerateImages}
                disabled={isGenerating}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {isGenerating ? 'Generating...' : 'Generate images'}
              </button>

              {agenticHtmlPreviewUrl && (
                <button
                  onClick={handleSaveAgenticHtmlEdits}
                  disabled={agenticHtmlSaving || !agenticHtmlPresentationId}
                  className="px-4 py-2 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                >
                  {agenticHtmlSaving ? 'Saving…' : 'Save HTML'}
                </button>
              )}

              {(agenticHtmlPreviewUrl || agenticHtmlEdited) && (
                  <button
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    className="ml-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isExporting ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Download PDF
                  </button>
                )}
            </div>
          </div>
        </nav>

        {downloadUrl && (
          <div className="max-w-7xl mx-auto px-4 py-2 text-sm text-blue-700">
            Download ready:{' '}
            <a
              className="underline"
              href={`${API_BASE.replace('/api', '')}${downloadUrl}`}
              target="_blank"
              rel="noreferrer"
            >
              {downloadUrl}
            </a>
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-start pt-2 pb-2 px-6 gap-2 min-h-0 overflow-hidden">
            <div
              ref={slideViewportRef}
              className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden"
            >
              <div
                ref={slideContainerRef}
                className={`${showAgenticHtmlInline ? '' : 'bg-white'} shadow-[0_30px_80px_rgba(15,23,42,0.2)] rounded-2xl relative border border-gray-100 ${
                  showAgenticHtmlInline ? 'overflow-hidden' : (isIrTheme || shouldRenderIrDeck) ? 'overflow-visible' : 'overflow-hidden'
                }`}
                style={{
                  width: showAgenticHtmlInline
                    ? `${Math.round(AGENTIC_BASE_WIDTH * slidePreviewScale)}px`
                    : `${Math.round(960 * slidePreviewScale)}px`,
                  height: showAgenticHtmlInline
                    ? `${Math.round(AGENTIC_BASE_HEIGHT * slidePreviewScale)}px`
                    : `${Math.round(540 * slidePreviewScale)}px`,
                  backgroundColor: showAgenticHtmlInline ? 'transparent' : (slide.backgroundColor || themeFallback.bg || '#ffffff'),
                  color: showAgenticHtmlInline ? undefined : (slide.textColor || themeFallback.text || '#111827'),
                  display: showAgenticHtmlInline ? 'block' : undefined,
                }}
              >
                {agenticHtmlPreviewUrl && showAgenticHtmlInline ? (
                  <div className="h-full w-full overflow-hidden">
                    <AgenticSlideEditor
                      slideUrl={agenticHtmlPreviewUrl}
                      slideIndex={agenticHtmlSlideIndex}
                      enableChartDataEditor={true}
                      showChartEditorToggle={false}
                      chartEditorOpen={agenticChartEditorOpen}
                      onChartEditorOpenChange={setAgenticChartEditorOpen}
                      htmlOverride={agenticHtmlEdited || ''}
                      scaleOverride={slidePreviewScale}
                      onSlideChange={() => {}}
                      onHtmlChange={handleAgenticHtmlChange}
                    />
                  </div>
                ) : isIrTheme ? (
                  <SlideEditor enabled={true}>
                    <IrSlide
                      slide={slide}
                      index={currentSlide}
                      chartData={slideChartData}
                      brandColor={brandColorValue}
                      logoData={slide.logo?.data || deckLogoData}
                      companyShort={currentDeck?.metadata?.companyShort || currentDeck?.metadata?.title || 'Company'}
                      companyLegal={currentDeck?.metadata?.companyLegal || currentDeck?.metadata?.title || 'Company Inc.'}
                      year={currentDeck?.metadata?.year || new Date().getFullYear()}
                      pageNo={currentSlide + 1}
                      className="h-full w-full"
                      onSlideUpdate={handleSlideFieldUpdate}
                      editable={true}
                    />
                  </SlideEditor>
                ) : shouldRenderIrDeck ? (
                  <SlideEditor enabled={true}>
                    <div className="h-full w-full">
                      <IRDeckSlide slide={slide} />
                    </div>
                  </SlideEditor>
                ) : (
                  <div className="absolute inset-0 p-10">
                    <h1 className="text-4xl font-bold mb-4">{slide.title}</h1>
                    {showSubtitle && <p className="text-lg opacity-70 mb-4">{slide.subtitle}</p>}

                  {isDiagramSlide ? (
                    <div className="w-full h-[360px]">
                      <MermaidPreview code={slide.diagram?.mermaid || slide.mermaid} />
                    </div>
                  ) : isTwoColumnLayout ? (
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        {twoColumnContent?.left?.type === 'chart' ? (
                          <ChartPreview chartData={twoColumnContent.left.data} showTitle />
                        ) : twoColumnContent?.left?.type === 'image' ? (
                          <div className="h-48 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                            Image placeholder
                          </div>
                        ) : (
                          ensureArray(twoColumnContent?.left?.items).map((bullet, i) => (
                            <p key={i} className="text-base text-gray-700 mb-2">
                              • {bullet}
                            </p>
                          ))
                        )}
                      </div>
                      <div>
                        {twoColumnContent?.right?.type === 'chart' ? (
                          <ChartPreview chartData={twoColumnContent.right.data} showTitle />
                        ) : twoColumnContent?.right?.type === 'image' ? (
                          <div className="h-48 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                            Image placeholder
                          </div>
                        ) : (
                          ensureArray(twoColumnContent?.right?.items).map((bullet, i) => (
                            <p key={i} className="text-base text-gray-700 mb-2">
                              • {bullet}
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    ensureArray(slideBullets).map((bullet, i) => (
                      <p key={i} className="text-base text-gray-700 mb-2">
                        • {bullet}
                      </p>
                    ))
                  )}

                  {!isDiagramSlide && !isTwoColumnLayout && (slide.table || slide.content?.type === 'table') && (
                    <SimpleTablePreview table={slide.table || slide.content} />
                  )}

                  {!isDiagramSlide && !isTwoColumnLayout && slideChartData && slide?.type !== 'chart' && (
                    <div className="mt-6">
                      <ChartPreview chartData={slideChartData} showTitle />
                    </div>
                  )}

                  {(slide.logo?.data || deckLogoData) && (
                    <DraggableLogoBox
                      frame={logoFrame}
                      dataUrl={slide.logo?.data || deckLogoData}
                      onUpdate={updateLogoFrame}
                      containerRef={slideContainerRef}
                    />
                  )}
                </div>
              )}

                {!showAgenticHtmlInline &&
                  !isIrTheme &&
                  !shouldRenderIrDeck &&
                  slide?.type === 'chart' &&
                  slideChartData &&
                  !slide.chartImage && (
                    <div
                      className="absolute z-5"
                      style={{
                        left: `${chartImageFrame.x}%`,
                        top: `${chartImageFrame.y}%`,
                        width: `${chartImageFrame.w}%`,
                        height: `${chartImageFrame.h}%`,
                      }}
                    >
                      <ChartPreview chartData={slideChartData} height={240} showTitle />
                    </div>
                  )}

                {slide.chartImage?.data && (
                  <DraggableChartBox
                    frame={chartImageFrame}
                    dataUrl={slide.chartImage.data}
                    onUpdate={updateChartImageFrame}
                    containerRef={slideContainerRef}
                  />
                )}

                {slide.image && (
                  <DraggableImageBox
                    frame={imageFrame}
                    onUpdate={updateImageFrame}
                    prompt={slide.image.prompt || ''}
                    onPromptChange={updateImagePrompt}
                    containerRef={slideContainerRef}
                  />
                )}
              </div>
            </div>

            <div className="w-full max-w-5xl flex-shrink-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentSlide === 0}
                    onClick={() => setCurrentSlide((s) => s - 1)}
                    className="px-2 py-1 border rounded-full disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                    {currentSlide + 1} of {currentDeck.slides.length}
                  </span>
                  <button
                    disabled={currentSlide === currentDeck.slides.length - 1}
                    onClick={() => setCurrentSlide((s) => s + 1)}
                    className="px-2 py-1 border rounded-full disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {totalThumbnailPages > 1 && (
                    <button
                      className="p-1 border rounded-full disabled:opacity-50"
                      disabled={thumbnailPage === 0}
                      onClick={() => setThumbnailPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-xs uppercase tracking-wide text-gray-500">Slides</span>
                  {totalThumbnailPages > 1 && (
                    <>
                      <span className="text-[10px] text-gray-400">
                        {thumbnailPage + 1}/{totalThumbnailPages}
                      </span>
                      <button
                        className="p-1 border rounded-full disabled:opacity-50"
                        disabled={thumbnailPage >= totalThumbnailPages - 1}
                        onClick={() =>
                          setThumbnailPage((p) => Math.min(totalThumbnailPages - 1, p + 1))
                        }
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pb-2 overflow-x-auto">
                {thumbnailSlides.map((slideItem, idx) => {
                  const absoluteIndex = thumbnailStart + idx;
                  return (
                  <button
                    key={`${slideItem.slideId || absoluteIndex}`}
                    onClick={() => setCurrentSlide(absoluteIndex)}
                    className={`flex-shrink-0 w-[120px] text-left rounded-lg border p-1.5 transition ${
                      absoluteIndex === currentSlide
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="h-14 rounded-md mb-1 border border-gray-200 p-1.5 overflow-hidden"
                      style={{ backgroundColor: slideItem.backgroundColor || themeFallback.bg || '#ffffff' }}
                    >
                      <div className="text-[8px] font-semibold text-gray-800 truncate">
                        {slideItem.title || 'Untitled'}
                      </div>
                      <div className="mt-0.5 space-y-0.5">
                        {ensureArray(
                          slideItem.content ||
                            slideItem.leftColumn?.items ||
                            slideItem.rightColumn?.items ||
                            slideItem.leftSide?.content?.items ||
                            slideItem.rightSide?.content?.items
                        )
                          .slice(0, 2)
                          .map((item, itemIdx) => (
                            <div key={`${idx}-thumb-${itemIdx}`} className="text-[7px] text-gray-500 truncate">
                              • {item}
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="text-[10px] font-medium text-gray-800 truncate">
                      {absoluteIndex + 1}. {slideItem.title || 'Untitled'}
                    </div>
                  </button>
                );
              })}
              </div>
            </div>
          </div>

          <div className="w-80 bg-white/80 backdrop-blur-sm border-l p-4 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Slide settings</h3>
            <div className="space-y-4">
              {isIrTheme && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">IR template</h4>
                  </div>
                  <select
                    value={slide?.template || 'overview'}
                    onChange={(event) => {
                      const templateId = event.target.value;
                      updateCurrentSlide((current) =>
                        applyDefaults(
                          { ...current, template: templateId },
                          getIrTemplateDefaults(templateId, current.title || 'Slide title')
                        )
                      );
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {irTemplateOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-gray-500">
                    Template controls layout only. Edit text in your JSON/content fields.
                  </p>
                </div>
              )}
              {agenticHtmlPreviewUrl && showAgenticHtmlInline && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Charts</h4>
                  </div>
                  <button
                    onClick={() => setAgenticChartEditorOpen((prev) => !prev)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {agenticChartEditorOpen ? 'Close chart editor' : 'Edit chart data'}
                  </button>
                  <p className="mt-2 text-xs text-gray-500">
                    Only slides with chart slots can be edited.
                  </p>
                </div>
              )}
              {agenticHtmlPreviewUrl && showAgenticHtmlInline && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Edits</h4>
                  </div>
                  <button
                    onClick={handleRevertAgenticHtmlEdits}
                    disabled={!agenticHtmlEdited}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Revert changes
                  </button>
                  <button
                    onClick={handleUndoAgenticHtmlEdit}
                    disabled={!agenticHtmlCanUndo}
                    className="mt-2 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Undo last change
                  </button>
                  <p className="mt-2 text-xs text-gray-500">
                    Reverts to the last saved or original HTML.
                  </p>
                </div>
              )}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Regenerate slide</h4>
                </div>
                <textarea
                  value={regeneratePrompt}
                  onChange={(event) => setRegeneratePrompt(event.target.value)}
                  placeholder="Describe changes for this slide only..."
                  className="w-full h-20 border border-gray-200 rounded p-2 text-xs"
                />
                <button
                  onClick={handleRegenerateSlide}
                  disabled={!regeneratePrompt.trim() || isRegenerating}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                >
                  {isRegenerating ? 'Regenerating...' : 'Regenerate this slide'}
                </button>
              </div>


              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Image box</h4>
                  <button
                    onClick={() =>
                      updateCurrentSlide((current) => ({
                        ...current,
                        image: current.image || {
                          placeholderId: `img_${current.slideId || currentSlide}`,
                          prompt: '',
                          frame: { x: 58, y: 22, w: 32, h: 40 },
                        },
                      }))
                    }
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    + Add
                  </button>
                </div>

                {slide.image && (
                  <div className="space-y-2 text-xs">
                    <p className="text-gray-500">
                      Edit the prompt directly on the slide placeholder.
                    </p>
                    <button
                      onClick={() =>
                        updateCurrentSlide((current) => {
                          delete current.image;
                          return { ...current };
                        })
                      }
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove image
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Auto-generate charts</h4>
                </div>
                <button
                  onClick={handleAutoGenerateCharts}
                  disabled={isAutoCharting}
                  className="w-full text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-2"
                >
                  {isAutoCharting ? 'Generating…' : 'Generate from selected docs'}
                </button>
                {autoChartError && (
                  <p className="mt-2 text-xs text-red-600">{autoChartError}</p>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Chart Builder (PNG)</h4>
                  {slide.chartImage?.data && (
                    <button
                      onClick={() =>
                        updateCurrentSlide((current) => {
                          delete current.chartImage;
                          return { ...current };
                        })
                      }
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setChartBuilderSeed(null);
                    const htmlSlideIndex = Math.max(0, (agenticHtmlSlideIndex || 1) - 1);
                    setChartBuilderTarget({
                      slideId: slide?.slideId,
                      index: showAgenticHtmlInline ? htmlSlideIndex : currentSlide,
                    });
                    setIsChartBuilderOpen(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  Open chart builder
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Visual library</h4>
                </div>
                <button
                  onClick={openVisualLibrary}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  Open visual library
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Generate diagrams, tables, and other visual elements as PNG.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Agentic JSON preview</h4>
                </div>
                {!agenticHtmlJson ? (
                  <p className="text-xs text-gray-500">
                    Generate an Agentic HTML deck to preview JSON here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAgenticHtmlJson((prev) => !prev)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs hover:bg-gray-50"
                      >
                        {showAgenticHtmlJson ? 'Hide JSON' : 'Show JSON'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            navigator.clipboard.writeText(agenticHtmlJson || '');
                          } catch {
                            /* ignore */
                          }
                        }}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-xs hover:bg-gray-50"
                      >
                        Copy
                      </button>
                    </div>
                    {showAgenticHtmlJson && (
                      <pre className="max-h-56 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-2 text-[10px] text-gray-700">
                        {agenticHtmlJson}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-t px-6 py-3" />

        {isChartBuilderOpen &&
          createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6">
              <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold">Chart Builder</h3>
                  <button
                    onClick={() => {
                      setIsChartBuilderOpen(false);
                      setChartBuilderSeed(null);
                      setChartBuilderTarget(null);
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                  <ChartBuilderPanel
                    seed={chartBuilderSeed}
                    onSave={async (payload) => {
                      const imageData = payload?.chartImage || payload;
                      const targetIndex = chartBuilderTarget?.index ?? currentSlide;
                      const frame = slide?.chartImage?.frame || chartImageFrame;
                      updateSlideByTarget(chartBuilderTarget, (current) => {
                        if (payload?.diagram?.mermaid) {
                          return {
                            ...current,
                            diagram: { mermaid: payload.diagram.mermaid },
                            chartImage: payload.chartImage
                              ? {
                                  data: payload.chartImage,
                                  frame: current.chartImage?.frame || chartImageFrame,
                                }
                              : current.chartImage,
                          };
                        }
                        return {
                          ...current,
                          chartImage: {
                            data: payload,
                            frame: current.chartImage?.frame || chartImageFrame,
                          },
                        };
                      });
                      if (agenticHtmlPreviewUrl && showAgenticHtmlInline && agenticHtmlPresentationId) {
                        let htmlContent = agenticHtmlEdited;
                        if (!htmlContent && agenticHtmlPreviewUrl) {
                          const response = await fetch(agenticHtmlPreviewUrl.split('?')[0]);
                          if (response.ok) {
                            htmlContent = await response.text();
                          }
                        }
                        if (htmlContent && imageData) {
                          const updatedHtml = applyChartImageToHtml(
                            htmlContent,
                            targetIndex,
                            imageData,
                            frame
                          );
                          await saveAgenticHtmlContent(updatedHtml, targetIndex);
                        }
                      }
                      await insertChartIntoPptx(imageData, frame, targetIndex);
                      setIsChartBuilderOpen(false);
                      setChartBuilderSeed(null);
                      setChartBuilderTarget(null);
                    }}
                  />
                </div>
              </div>
            </div>,
            document.body
          )}

        {isVisualLibraryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h3 className="text-lg font-semibold">Visual Library</h3>
                  <p className="text-xs text-gray-500">
                    Choose a visual element, edit fields, then generate a PNG.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsVisualLibraryOpen(false);
                    setVisualLibraryTarget(null);
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
              <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Template</label>
                  <select
                    value={visualTemplateId}
                    onChange={(event) => {
                      setVisualTemplateTouched(false);
                      setVisualTemplateId(event.target.value);
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {visualTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {currentVisualTemplate?.description && (
                    <div className="text-xs text-gray-500">{currentVisualTemplate.description}</div>
                  )}
                </div>

                {visualPreviewSrc && (
                  <div className="border border-gray-200 rounded-xl bg-white p-2">
                    <img
                      src={visualPreviewSrc}
                      alt={`${currentVisualTemplate?.name || 'Template'} preview`}
                      className="w-full rounded-lg"
                    />
                  </div>
                )}

                {currentVisualTemplate && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentVisualTemplate.fields.map((field) => {
                      const value = visualTemplateFields[field.key] ?? '';
                      if (field.type === 'list') {
                        return (
                          <div key={field.key} className="space-y-1">
                            <label className="text-xs font-semibold text-gray-600">{field.label}</label>
                            <textarea
                              key={`${visualTemplateId}-${field.key}`}
                              defaultValue={value}
                              onChange={(event) => {
                                visualTemplateDraftRef.current = {
                                  ...visualTemplateDraftRef.current,
                                  [field.key]: event.target.value,
                                };
                              }}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-28"
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={field.key} className="space-y-1">
                          <label className="text-xs font-semibold text-gray-600">{field.label}</label>
                          <input
                            key={`${visualTemplateId}-${field.key}`}
                            defaultValue={value}
                            onChange={(event) => {
                              visualTemplateDraftRef.current = {
                                ...visualTemplateDraftRef.current,
                                [field.key]: event.target.value,
                              };
                            }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Prompt preview</label>
                  <textarea
                    value={visualPromptOverride}
                    onChange={(event) => {
                      setVisualPromptManual(true);
                      setVisualPromptOverride(event.target.value);
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs h-32"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setVisualPromptManual(false);
                      setVisualPromptOverride(
                        buildVisualPrompt(currentVisualTemplate, getVisualFieldValues())
                      );
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Regenerate from template
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateVisual}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
                    disabled={isVisualGenerating}
                  >
                    {isVisualGenerating ? 'Generating...' : 'Generate PNG'}
                  </button>
                  {visualImageError && <div className="text-xs text-red-600">{visualImageError}</div>}
                </div>

                {visualImageUrl && (
                  <div className="space-y-3">
                    <img
                      src={visualImageUrl}
                      alt="Generated visual"
                      className="w-full border border-gray-200 rounded-xl"
                    />
                    <button
                      onClick={() => {
                        updateSlideByTarget(visualLibraryTarget, (current) => ({
                          ...current,
                          chartImage: {
                            data: visualImageUrl,
                            frame: current.chartImage?.frame || { x: 8, y: 28, w: 84, h: 50 },
                          },
                        }));
                        setIsVisualLibraryOpen(false);
                        setVisualLibraryTarget(null);
                      }}
                      className="px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm hover:bg-blue-50"
                    >
                      Use on slide
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isAutoChartModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h3 className="text-lg font-semibold">Chart suggestions</h3>
                  <p className="text-xs text-gray-500">
                    Pick a candidate to load into the chart editor.
                  </p>
                </div>
                <button
                  onClick={() => setIsAutoChartModalOpen(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
              <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
                {autoChartCandidates.length === 0 && (
                  <div className="text-sm text-gray-500">No candidates returned.</div>
                )}
                {autoChartCandidates.map((candidate, idx) => (
                  <div key={`candidate-${idx}`} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {candidate.title || 'Untitled'}{' '}
                          <span className="text-xs text-gray-500">({candidate.type})</span>
                        </div>
                        {candidate.template && (
                          <div className="text-xs text-gray-500">Template: {candidate.template}</div>
                        )}
                        {typeof candidate.confidence === 'number' && (
                          <div className="text-xs text-gray-500">
                            Confidence: {(candidate.confidence * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => applyAutoChartCandidate(candidate)}
                        disabled={!candidate.chartData}
                        className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-2 disabled:text-gray-400 disabled:border-gray-200"
                      >
                        Load into editor
                      </button>
                    </div>
                  </div>
                ))}

                {autoChartMissing.length > 0 && (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-xs text-amber-700">
                    Missing data: {autoChartMissing.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const viewElement =
    view === 'documents' ? (
      <DocumentsView />
    ) : view === 'outline' ? (
      <OutlineView />
    ) : view === 'consistent' ? (
      <ConsistentView />
    ) : view === 'editor' ? (
      <EditorView />
    ) : view === 'charts' ? (
      <ChartBuilder onBack={() => setView('home')} />
    ) : (
      <HomeView />
    );

  return (
    <>
      {viewElement}
      {showIrOnboarding && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-6"
          style={{ zIndex: 9999 }}
        >
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">IR onboarding (recommended)</h3>
                <p className="text-xs text-gray-500">
                  Provide the minimum facts to keep slides grounded. Saved locally.
                </p>
              </div>
              <button
                onClick={() => setShowIrOnboarding(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={loadIrOnboardingSample}
                  className="px-3 py-1.5 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Load sample data
                </button>
                <span className="text-slate-500">Prefills the form for testing.</span>
              </div>
              <div>
                <div className="font-semibold text-gray-800 mb-2">01 / Market Status & Problems</div>
                <textarea
                  className="w-full border rounded-lg p-2 h-24"
                  placeholder="Market definition, geography scope, customer type, why now drivers."
                  value={irOnboarding.market_definition || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, market_definition: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-24 mt-2"
                  placeholder="Problems & unmet needs (who, impact, evidence)."
                  value={irOnboarding.problems_unmet || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, problems_unmet: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="TAM/SAM/SOM basis assumptions."
                  value={irOnboarding.tam_sam_som_basis || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, tam_sam_som_basis: e.target.value }))
                  }
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <input
                    className="border rounded-lg p-2"
                    placeholder="Geography scope"
                    value={irOnboarding.geography_scope || ''}
                    onChange={(e) =>
                      setIrOnboarding((prev) => ({ ...prev, geography_scope: e.target.value }))
                    }
                  />
                  <input
                    className="border rounded-lg p-2"
                    placeholder="Customer type (B2B/B2C, verticals)"
                    value={irOnboarding.customer_type || ''}
                    onChange={(e) =>
                      setIrOnboarding((prev) => ({ ...prev, customer_type: e.target.value }))
                    }
                  />
                </div>
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Why now drivers (3–5 bullets)."
                  value={irOnboarding.why_now_drivers || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, why_now_drivers: e.target.value }))
                  }
                />
              </div>

              <div>
                <div className="font-semibold text-gray-800 mb-2">02 / Solution & Technology</div>
                <textarea
                  className="w-full border rounded-lg p-2 h-20"
                  placeholder="Solution statement (what, for who, outcome)."
                  value={irOnboarding.solution_statement || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, solution_statement: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Differentiators (3–5 points)."
                  value={irOnboarding.differentiators || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, differentiators: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Technology objectives (metrics/targets)."
                  value={irOnboarding.tech_objectives || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, tech_objectives: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Current status (modules, TRL, evidence)."
                  value={irOnboarding.current_status || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, current_status: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Standardization strategy."
                  value={irOnboarding.standardization_strategy || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({
                      ...prev,
                      standardization_strategy: e.target.value,
                    }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="WBS (work packages, deliverables, owners)."
                  value={irOnboarding.wbs || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, wbs: e.target.value }))
                  }
                />
              </div>

              <div>
                <div className="font-semibold text-gray-800 mb-2">
                  03 / Commercialization Strategy
                </div>
                <textarea
                  className="w-full border rounded-lg p-2 h-20"
                  placeholder="Target market (ICP, use cases, buyers)."
                  value={irOnboarding.target_market || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, target_market: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Competition (named competitors + differentiation)."
                  value={irOnboarding.competition || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, competition: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Go-to-market plan (channels, pricing, milestones)."
                  value={irOnboarding.gtm_plan || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, gtm_plan: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Global entry strategy."
                  value={irOnboarding.global_entry || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, global_entry: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Operations & support."
                  value={irOnboarding.ops_support || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, ops_support: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Job creation & outcomes."
                  value={irOnboarding.job_creation || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, job_creation: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Targets & rationale (KPIs + assumptions)."
                  value={irOnboarding.targets_rationale || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, targets_rationale: e.target.value }))
                  }
                />
              </div>

              <div>
                <div className="font-semibold text-gray-800 mb-2">
                  04 / Company Introduction
                </div>
                <textarea
                  className="w-full border rounded-lg p-2 h-20"
                  placeholder="Company legal name, founding date, locations, mission, traction, team."
                  value={irOnboarding.company_intro || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, company_intro: e.target.value }))
                  }
                />
              </div>

              <div>
                <div className="font-semibold text-gray-800 mb-2">
                  05 / Safety & Security Compliance
                </div>
                <textarea
                  className="w-full border rounded-lg p-2 h-20"
                  placeholder="Safety measures."
                  value={irOnboarding.safety_measures || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, safety_measures: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Security measures."
                  value={irOnboarding.security_measures || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, security_measures: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Leakage prevention."
                  value={irOnboarding.leakage_prevention || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, leakage_prevention: e.target.value }))
                  }
                />
                <textarea
                  className="w-full border rounded-lg p-2 h-20 mt-2"
                  placeholder="Other compliance (standards, status)."
                  value={irOnboarding.other_compliance || ''}
                  onChange={(e) =>
                    setIrOnboarding((prev) => ({ ...prev, other_compliance: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => setShowIrOnboarding(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveIrOnboarding}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
