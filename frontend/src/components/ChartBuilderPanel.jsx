import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Treemap,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { Download, Plus, Trash2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import mermaid from 'mermaid';

const ChartBuilderPanel = ({ onSave, seed }) => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const [chartType, setChartType] = useState('line');
  const [psstSection, setPsstSection] = useState('market-status');
  const [title, setTitle] = useState('Revenue Growth');
  const [unitLabel, setUnitLabel] = useState('$M');
  const [data, setData] = useState([
    { label: '2021', value: 100, forecast: false },
    { label: '2022', value: 125, forecast: false },
    { label: '2023', value: 156, forecast: false },
    { label: '2024', value: 195, forecast: false },
    { label: '2025E', value: 240, forecast: true },
    { label: '2026E', value: 288, forecast: true },
  ]);
  const [colors, setColors] = useState({
    primary: '#2563eb',
    secondary: '#10b981',
    forecast: '#94a3b8',
    accent: '#f59e0b',
  });
  const [multiSeries, setMultiSeries] = useState([
    { key: 'seriesA', label: 'Baseline' },
    { key: 'seriesB', label: 'Target' },
  ]);
  const [multiSeriesData, setMultiSeriesData] = useState([
    { label: '2021', seriesA: 100, seriesB: 130 },
    { label: '2022', seriesA: 120, seriesB: 160 },
    { label: '2023', seriesA: 150, seriesB: 190 },
    { label: '2024', seriesA: 180, seriesB: 230 },
  ]);
  const [pieData, setPieData] = useState([
    { label: 'Domestic', value: 45 },
    { label: 'Import', value: 30 },
    { label: 'Other', value: 25 },
  ]);
  const [waffleData, setWaffleData] = useState([
    { label: 'Data accuracy concerns', value: 55, note: 'of companies express concern' },
    { label: 'Fully digitized', value: 21, note: 'of companies are fully digitized' },
    { label: 'Data quality doubts', value: 45, note: 'of companies doubt data quality' },
  ]);
  const [beforeAfterData, setBeforeAfterData] = useState([
    { label: 'Cycle Time', before: 100, after: 65 },
    { label: 'Energy Use', before: 100, after: 72 },
  ]);
  const [bulletData, setBulletData] = useState([
    { label: 'Revenue', value: 72, target: 85, max: 100 },
    { label: 'Margin', value: 48, target: 60, max: 100 },
  ]);
  const [comparisonTable, setComparisonTable] = useState({
    columns: ['Metric', 'Current', 'Our Tech'],
    rows: [
      ['Throughput', '120 units', '180 units'],
      ['Cost per unit', '$12', '$8'],
      ['Energy use', '100%', '72%'],
    ],
  });
  const [ganttData, setGanttData] = useState([
    { task: 'R&D', start: 0, duration: 3 },
    { task: 'Pilot', start: 2, duration: 2 },
    { task: 'Scale', start: 4, duration: 2 },
  ]);
  const [timelineData, setTimelineData] = useState([
    { date: 'Q1', event: 'Prototype' },
    { date: 'Q2', event: 'Pilot' },
    { date: 'Q3', event: 'Certification' },
  ]);
  const [funnelData, setFunnelData] = useState([
    { stage: 'Awareness', value: 10000 },
    { stage: 'Qualified', value: 3200 },
    { stage: 'Signed', value: 900 },
  ]);
  const [trlData, setTrlData] = useState({
    current: 4,
    target: 7,
    max: 9,
    milestones: [2, 4, 6, 8, 9],
  });
  const [kpiCards, setKpiCards] = useState([
    { label: 'Revenue', value: '$240M', change: '+23%' },
    { label: 'CO2 Saved', value: '18k tons', change: '-28%' },
  ]);
  const [quadrantItems, setQuadrantItems] = useState([
    { name: 'A', x: 75, y: 80 },
    { name: 'B', x: 30, y: 70 },
    { name: 'C', x: 80, y: 35 },
    { name: 'D', x: 25, y: 30 },
  ]);
  const [growthCallout, setGrowthCallout] = useState('Revenue milestone reached');
  const [growthCaption, setGrowthCaption] = useState('Goal: 40% margin with steady scale to 2028.');
  const [revenueMixTitle, setRevenueMixTitle] = useState('Revenue Plan');
  const [revenueMixSubtitle, setRevenueMixSubtitle] = useState('Revenue Mix');
  const [pricingTitle, setPricingTitle] = useState('Pricing Model');
  const [pricingSummary, setPricingSummary] = useState('SaaS subscription + usage fee');
  const [pricingDetails, setPricingDetails] = useState([
    'Enterprise license (monthly / annual)',
    'Base fee + overage usage',
    'Optional success fee',
  ]);
  const [conciergeTitle, setConciergeTitle] = useState('Concierge');
  const [conciergeDetails, setConciergeDetails] = useState([
    'Managed service',
    'Reporting, review, and submission support',
  ]);
  const [marketSizeRings, setMarketSizeRings] = useState([
    { label: 'TAM', amount: '1.6T', color: '#fed7aa' },
    { label: 'SAM', amount: '1.1T', color: '#fdba74' },
    { label: 'SOM', amount: '0.47T', color: '#fb923c' },
  ]);
  const [mermaidCode, setMermaidCode] = useState('flowchart LR\n  A[Input] --> B[Processing]\n  B --> C[Output]');
  const [isExporting, setIsExporting] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState('');
  const [aiImageError, setAiImageError] = useState('');
  const chartRef = useRef(null);

  const normalizeNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const normalizeChartType = (type) => {
    if (!type) return null;
    const normalized = String(type).toLowerCase();
    if (normalized === 'column') return 'bar';
    if (normalized === 'doughnut') return 'donut';
    if (normalized === 'table') return 'comparison-table';
    if (normalized === 'metrics') return 'kpi-cards';
    if (normalized === 'comparison') return 'comparison-table';
    return normalized;
  };

  const chartTypes = [
    { id: 'bar', name: 'Bar' },
    { id: 'grouped', name: 'Grouped Bar' },
    { id: 'stacked', name: 'Stacked Bar' },
    { id: 'line', name: 'Line' },
    { id: 'combo', name: 'Combo' },
    { id: 'waterfall', name: 'Waterfall' },
    { id: 'before-after', name: 'Before / After' },
    { id: 'comparison-table', name: 'Comparison Table' },
    { id: 'kpi-table', name: 'KPI Table' },
    { id: 'gantt', name: 'Gantt / Roadmap' },
    { id: 'timeline', name: 'Timeline' },
    { id: 'funnel', name: 'Funnel' },
    { id: 'trl', name: 'TRL Progress' },
    { id: 'pie', name: 'Pie' },
    { id: 'donut', name: 'Donut' },
    { id: 'quadrant', name: '2x2 Quadrant' },
    { id: 'kpi-cards', name: 'KPI Cards' },
    { id: 'treemap', name: 'Treemap' },
    { id: 'bullet', name: 'Bullet Chart' },
    { id: 'waffle', name: 'Waffle Chart' },
    { id: 'growth-curve', name: 'Growth Curve' },
    { id: 'revenue-mix', name: 'Revenue Mix Plan' },
    { id: 'bar-line', name: 'Bar + Line' },
    { id: 'market-size', name: 'Market Size' },
    { id: 'mermaid', name: 'Mermaid Diagram' },
  ];

  const mermaidExamples = [
    {
      id: 'platform-architecture',
      label: 'Product / Platform Architecture',
      code: `flowchart LR
  Users((Users)) --> UI[Web / Mobile UI]
  UI --> API[API Gateway]
  API --> Core[Core Services]
  Core --> Data[(Data Lake)]
  Core --> ML[ML Services]
  ML --> Models[(Model Registry)]
  Data --> BI[Analytics & BI]`,
    },
    {
      id: 'system-components',
      label: 'System Components Overview',
      code: `flowchart TB
  Frontend[Frontend] --> Backend[Backend Services]
  Backend --> Storage[(Storage)]
  Backend --> Auth[Auth & IAM]
  Backend --> Observability[Logging/Monitoring]
  Backend --> Integrations[3rd-party Integrations]`,
    },
    {
      id: 'data-flow',
      label: 'Data Flow & Data Pipeline',
      code: `flowchart LR
  Sources[Data Sources] --> Ingest[Ingestion]
  Ingest --> Clean[Cleaning/ETL]
  Clean --> Feature[Feature Store]
  Feature --> Train[Model Training]
  Train --> Deploy[Deployment]
  Deploy --> Apps[Apps/BI]`,
    },
    {
      id: 'ml-flow',
      label: 'AI / ML Training & Inference Flow',
      code: `flowchart TB
  Data[(Training Data)] --> Prep[Preprocessing]
  Prep --> Train[Training]
  Train --> Validate[Validation]
  Validate --> Model[(Model Artifact)]
  Model --> Serve[Inference Service]
  Serve --> Apps[Product Apps]`,
    },
    {
      id: 'data-flywheel',
      label: 'Proprietary Data Flywheel',
      code: `flowchart LR
  Users --> Usage[Product Usage]
  Usage --> Data[Data Capture]
  Data --> Improve[Model Improvement]
  Improve --> Better[Better Results]
  Better --> Users`,
    },
    {
      id: 'customer-journey',
      label: 'Customer Journey / User Workflow',
      code: `flowchart LR
  Discover[Discover] --> Evaluate[Evaluate]
  Evaluate --> Trial[Trial]
  Trial --> Purchase[Purchase]
  Purchase --> Onboard[Onboard]
  Onboard --> Expand[Expand]`,
    },
    {
      id: 'onboarding',
      label: 'Onboarding & Activation Flow',
      code: `flowchart TB
  Signup[Sign up] --> Verify[Verify Email]
  Verify --> Setup[Account Setup]
  Setup --> FirstValue[First Value Achieved]
  FirstValue --> Retain[Retention]`,
    },
    {
      id: 'gtm-motion',
      label: 'Go-To-Market Motion (PLG / Sales-led)',
      code: `flowchart LR
  PLG[Product-led] --> PQL[PQL]
  PQL --> Sales[Sales-led]
  Sales --> Close[Closed Won]
  Close --> Expansion[Expansion]`,
    },
    {
      id: 'sales-funnel',
      label: 'Sales Funnel Logic',
      code: `flowchart TB
  Lead[Lead] --> MQL[MQL]
  MQL --> SQL[SQL]
  SQL --> Proposal[Proposal]
  Proposal --> Close[Close]`,
    },
    {
      id: 'integrations-map',
      label: 'Ecosystem / Integrations Map',
      code: `flowchart LR
  Core[Core Platform] --> CRM[CRM]
  Core --> ERP[ERP]
  Core --> HR[HR Systems]
  Core --> Data[Data Warehouse]
  Core --> Comms[Messaging]`,
    },
    {
      id: 'competitive-diff',
      label: 'Competitive Structural Differentiation',
      code: `flowchart LR
  OurStack[Our Stack] --> Unique[Unique Data + Models]
  Unique --> Advantage[Cost & Speed Advantage]
  Competitors[Competitors] --> Legacy[Legacy Stack]
  Legacy --> Lag[Higher Cost]`,
    },
    {
      id: 'value-flow',
      label: 'Value Creation Flow',
      code: `flowchart LR
  Input[Input Data] --> Insight[Insights]
  Insight --> Action[Actions]
  Action --> Impact[Business Impact]
  Impact --> Value[Value Realized]`,
    },
    {
      id: 'operating-model',
      label: 'Operating Model / Process Automation',
      code: `flowchart TB
  Request[Request Intake] --> Orchestrate[Orchestration]
  Orchestrate --> Automate[Automation]
  Automate --> Review[Human Review]
  Review --> Deploy[Deploy]`,
    },
    {
      id: 'scalability-flow',
      label: 'Scalability & Infrastructure Flow',
      code: `flowchart LR
  Edge[Edge] --> Region[Regional Clusters]
  Region --> Core[Core Cloud]
  Core --> Data[(Data Lake)]
  Core --> Observability[Observability]`,
    },
    {
      id: 'risk-compliance',
      label: 'Risk, Dependency & Compliance Flow',
      code: `flowchart TB
  Dependencies[Dependencies] --> Risk[Risk Review]
  Risk --> Controls[Controls]
  Controls --> Compliance[Compliance]
  Compliance --> Audit[Audit Trail]`,
    },
  ];

  const psstSections = [
    { id: 'market-status', label: 'Market Status', required: ['bar', 'line'] },
    { id: 'solution-tech', label: 'Solution & Tech', required: ['comparison-table', 'trl'] },
    { id: 'rd-plan', label: 'R&D Plan', required: ['gantt', 'timeline'] },
    { id: 'scale-up', label: 'Scale-up', required: ['line', 'funnel'] },
    { id: 'budget', label: 'Budget', required: ['stacked', 'waterfall', 'pie'] },
    { id: 'impact', label: 'Impact', required: ['before-after', 'bar'] },
  ];

  const recommendedChartIds = useMemo(() => {
    const section = psstSections.find((item) => item.id === psstSection);
    return new Set(section?.required || []);
  }, [psstSection]);

  useEffect(() => {
    if (!seed) return;
    setAiImageUrl('');
    setAiImageError('');

    const seedTitle = seed.title || seed.chartData?.title;
    if (seedTitle) setTitle(seedTitle);

    const nextType = normalizeChartType(seed.chartData?.type || seed.type || seed.diagram?.type);
    if (seed.diagram?.mermaid || seed.mermaid) {
      setChartType('mermaid');
      setMermaidCode(seed.diagram?.mermaid || seed.mermaid);
      return;
    }

    if (seed.chartData) {
      const labels = Array.isArray(seed.chartData.labels) ? seed.chartData.labels : [];
      const datasets = Array.isArray(seed.chartData.datasets) ? seed.chartData.datasets : [];
      const resolvedType = nextType || chartType;

      if (resolvedType) setChartType(resolvedType);

      if (['bar', 'combo', 'waterfall', 'growth-curve'].includes(resolvedType)) {
        const dataset = datasets[0] || {};
        setData(
          labels.map((label, idx) => ({
            label,
            value: normalizeNumber(dataset.data?.[idx]),
            forecast: false,
          }))
        );
      }

      if (['line', 'grouped', 'stacked', 'bar-line', 'revenue-mix'].includes(resolvedType)) {
        const series = datasets.length
          ? datasets.map((dataset, idx) => ({
              key: `series${idx}`,
              label: dataset.label || `Series ${idx + 1}`,
            }))
          : [{ key: 'series0', label: 'Series' }];

        setMultiSeries(series);
        setMultiSeriesData(
          labels.map((label, idx) => {
            const row = { label };
            series.forEach((seriesItem, seriesIdx) => {
              row[seriesItem.key] = normalizeNumber(datasets[seriesIdx]?.data?.[idx]);
            });
            return row;
          })
        );
      }

      if (['pie', 'donut', 'revenue-mix'].includes(resolvedType)) {
        const dataset = datasets[0] || {};
        setPieData(
          labels.map((label, idx) => ({
            label,
            value: normalizeNumber(dataset.data?.[idx]),
          }))
        );
      }
    }

    if (seed.table && Array.isArray(seed.table.columns) && Array.isArray(seed.table.rows)) {
      setComparisonTable({
        columns: seed.table.columns,
        rows: seed.table.rows,
      });
      if (!seed.chartData) setChartType('comparison-table');
    }

    if (Array.isArray(seed.metrics) && seed.metrics.length) {
      setKpiCards(
        seed.metrics.map((metric) => ({
          label: metric.label || 'Metric',
          value: metric.value || '',
          change: metric.change || '',
        }))
      );
      if (!seed.chartData) setChartType('kpi-cards');
    }
  }, [seed]);

  const addDataPoint = () => {
    setData([...data, { label: `Point ${data.length + 1}`, value: 0, forecast: false }]);
  };

  const updateDataPoint = (index, field, value) => {
    const newData = [...data];
    newData[index][field] = field === 'value' ? parseFloat(value) || 0 : value;
    setData(newData);
  };

  const removeDataPoint = (index) => {
    setData(data.filter((_, i) => i !== index));
  };

  const exportChart = async () => {
    if (!chartRef.current || isExporting) return;
    if (chartType === 'mermaid') {
      try {
        const id = `mermaid-export-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, mermaidCode);
        const encoded = encodeURIComponent(svg)
          .replace(/%0A/g, '')
          .replace(/%20/g, ' ');
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
        onSave?.({
          diagram: { mermaid: mermaidCode },
          chartImage: dataUrl,
          type: 'diagram',
        });
      } catch (error) {
        onSave?.({ diagram: { mermaid: mermaidCode }, type: 'diagram' });
      }
      return;
    }
    setIsExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      onSave?.(dataUrl);
    } finally {
      setIsExporting(false);
    }
  };

  const seriesColors = [colors.primary, colors.secondary, colors.accent, colors.forecast];

  const formatValue = (value) => {
    if (!unitLabel) return value;
    const trimmed = unitLabel.trim();
    if (!trimmed) return value;
    if (trimmed.startsWith('$') || trimmed.startsWith('₩') || trimmed.startsWith('€')) {
      return `${trimmed}${value}`;
    }
    return `${value} ${trimmed}`;
  };

  const formatSeriesData = (seriesData) =>
    seriesData
      .map((row) => {
        const entries = Object.entries(row)
          .filter(([key]) => key !== 'label')
          .map(([key, value]) => `${key}: ${value}`);
        return `${row.label} => ${entries.join(', ')}`;
      })
      .join('\n');

  const buildAiPrompt = () => {
    const base = [
      'Create an executive-grade chart image.',
      'Preserve ALL data values, labels, relative proportions, and axis scales exactly.',
      'Do NOT invent or change any numbers.',
      'Use a clean, professional layout with clear typography and subtle styling.',
    ];

    const chartBlock = [`Chart type: ${chartType}`, `Title: ${title}`];
    if (unitLabel) chartBlock.push(`Unit: ${unitLabel}`);

    if (['bar', 'combo', 'waterfall', 'growth-curve'].includes(chartType)) {
      chartBlock.push(
        'Data:',
        data.map((row) => `${row.label}: ${row.value}`).join('\n')
      );
    }

    if (['line', 'grouped', 'stacked', 'bar-line', 'revenue-mix'].includes(chartType)) {
      chartBlock.push('Series:');
      chartBlock.push(
        multiSeries
          .map((series) => `${series.key}: ${series.label}`)
          .join('\n')
      );
      chartBlock.push('Data:');
      chartBlock.push(formatSeriesData(multiSeriesData));
    }

    if (['pie', 'donut', 'revenue-mix', 'treemap'].includes(chartType)) {
      chartBlock.push(
        'Slices:',
        pieData.map((row) => `${row.label}: ${row.value}`).join('\n')
      );
    }

    if (chartType === 'before-after') {
      chartBlock.push(
        'Before/After:',
        beforeAfterData
          .map((row) => `${row.label}: before ${row.before}, after ${row.after}`)
          .join('\n')
      );
    }

    if (['comparison-table', 'kpi-table'].includes(chartType)) {
      chartBlock.push('Table columns:', comparisonTable.columns.join(' | '));
      chartBlock.push(
        'Table rows:',
        comparisonTable.rows.map((row) => row.join(' | ')).join('\n')
      );
    }

    if (chartType === 'gantt') {
      chartBlock.push(
        'Roadmap tasks:',
        ganttData
          .map((row) => `${row.task}: start ${row.start}, duration ${row.duration}`)
          .join('\n')
      );
    }

    if (chartType === 'timeline') {
      chartBlock.push(
        'Timeline:',
        timelineData.map((row) => `${row.date}: ${row.event}`).join('\n')
      );
    }

    if (chartType === 'funnel') {
      chartBlock.push(
        'Funnel stages:',
        funnelData.map((row) => `${row.stage}: ${row.value}`).join('\n')
      );
    }

    if (chartType === 'trl') {
      chartBlock.push(
        `TRL current: ${trlData.current}, target: ${trlData.target}, max: ${trlData.max}`,
        `Milestones: ${trlData.milestones.join(', ')}`
      );
    }

    if (chartType === 'kpi-cards') {
      chartBlock.push(
        'KPI cards:',
        kpiCards.map((row) => `${row.label}: ${row.value} (${row.change})`).join('\n')
      );
    }

    if (chartType === 'quadrant') {
      chartBlock.push(
        'Quadrant points (x,y 0-100):',
        quadrantItems.map((row) => `${row.name}: ${row.x}, ${row.y}`).join('\n')
      );
    }

    if (chartType === 'bullet') {
      chartBlock.push(
        'Bullet rows:',
        bulletData
          .map((row) => `${row.label}: value ${row.value}, target ${row.target}, max ${row.max}`)
          .join('\n')
      );
    }

    if (chartType === 'waffle') {
      chartBlock.push(
        'Waffle cards:',
        waffleData
          .map((row) => `${row.label}: ${row.value}% (${row.note || ''})`)
          .join('\n')
      );
    }

    if (chartType === 'revenue-mix') {
      chartBlock.push(
        `Left chart title: ${revenueMixTitle}`,
        `Donut title: ${revenueMixSubtitle}`,
        `Pricing title: ${pricingTitle}`,
        `Pricing summary: ${pricingSummary}`,
        `Pricing details: ${pricingDetails.join('; ')}`,
        `Concierge title: ${conciergeTitle}`,
        `Concierge details: ${conciergeDetails.join('; ')}`
      );
    }

    if (chartType === 'growth-curve') {
      chartBlock.push(`Callout: ${growthCallout}`, `Caption: ${growthCaption}`);
    }

    if (chartType === 'market-size') {
      chartBlock.push(
        'Market size rings:',
        marketSizeRings.map((ring) => `${ring.label}: ${ring.amount}`).join('\n')
      );
    }

    return `${base.join(' ')}\n\n${chartBlock.join('\n')}`;
  };

  const handleGenerateAiImage = async () => {
    if (isAiGenerating) return;
    setIsAiGenerating(true);
    setAiImageError('');
    const placeholderId = `chart_ai_${Date.now()}`;
    try {
      const prompt = buildAiPrompt();
      const response = await fetch(`${API_BASE}/workflow/generate-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompts: [{ placeholderId, prompt }],
        }),
      });
      if (!response.ok) {
        throw new Error('Image generation failed');
      }
      const result = await response.json();
      const image = result.images?.[placeholderId];
      if (!image?.data) {
        throw new Error('No image data returned');
      }
      setAiImageUrl(image.data);
    } catch (error) {
      setAiImageError(error.message || 'Failed to generate image');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const updateMultiSeriesLabel = (index, value) => {
    setMultiSeries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], label: value };
      return next;
    });
  };

  const updateMultiSeriesValue = (rowIndex, seriesKey, value) => {
    setMultiSeriesData((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [seriesKey]: Number(value) || 0 };
      return next;
    });
  };

  const updateMultiSeriesLabelValue = (rowIndex, value) => {
    setMultiSeriesData((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], label: value };
      return next;
    });
  };

  const addMultiSeriesRow = () => {
    setMultiSeriesData((prev) => [
      ...prev,
      { label: `Row ${prev.length + 1}`, ...multiSeries.reduce((acc, series) => ({ ...acc, [series.key]: 0 }), {}) },
    ]);
  };

  const removeMultiSeriesRow = (index) => {
    setMultiSeriesData((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addSeries = () => {
    const key = `series${String.fromCharCode(65 + multiSeries.length)}`;
    setMultiSeries((prev) => [...prev, { key, label: `Series ${prev.length + 1}` }]);
    setMultiSeriesData((prev) =>
      prev.map((row) => ({
        ...row,
        [key]: 0,
      }))
    );
  };

  const removeSeries = (index) => {
    setMultiSeries((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      const removed = prev[index];
      setMultiSeriesData((rows) =>
        rows.map((row) => {
          const nextRow = { ...row };
          delete nextRow[removed.key];
          return nextRow;
        })
      );
      return next;
    });
  };

  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={multiSeriesData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 11 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 11 }} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        {multiSeries.map((series, idx) => (
          <Line
            key={series.key}
            type="monotone"
            dataKey={series.key}
            stroke={seriesColors[idx % seriesColors.length]}
            strokeWidth={3}
            dot={{ fill: seriesColors[idx % seriesColors.length], r: 4 }}
            name={series.label}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" stroke="#6b7280" style={{ fontSize: 11 }} tickFormatter={formatValue} />
        <YAxis dataKey="label" type="category" stroke="#6b7280" style={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        <Bar dataKey="value" name="Value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.forecast ? colors.forecast : colors.primary} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  const renderGroupedChart = () => (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={multiSeriesData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 11 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 11 }} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        {multiSeries.map((series, idx) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={series.label}
            fill={seriesColors[idx % seriesColors.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  const renderStackedChart = () => (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={multiSeriesData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 11 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 11 }} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        {multiSeries.map((series, idx) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            stackId="a"
            fill={seriesColors[idx % seriesColors.length]}
            name={series.label}
            radius={idx === multiSeries.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  const renderComboChart = () => (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 11 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 11 }} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        <Bar dataKey="value" fill={colors.primary} name="Volume" radius={[4, 4, 0, 0]} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={colors.secondary}
          strokeWidth={3}
          name="Trend"
          dot={{ fill: colors.secondary, r: 4 }}
          data={data.map((d) => ({ ...d, value: d.value * 1.1 }))}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  const renderWaterfall = () => {
    let cumulative = 0;
    const waterfallData = data.map((d) => {
      const start = cumulative;
      cumulative += d.value;
      return { label: d.label, start, end: cumulative, value: d.value };
    });

    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={waterfallData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 11 }} />
          <YAxis stroke="#6b7280" style={{ fontSize: 11 }} tickFormatter={formatValue} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
            formatter={(value) => formatValue(value)}
          />
          <Bar dataKey="end" fill="transparent" />
          <Bar dataKey="value" radius={[4, 4, 4, 4]}>
            {waterfallData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.value >= 0 ? colors.primary : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderKPITable = () => {
    return (
      <div className="overflow-auto text-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {comparisonTable.columns.map((column, idx) => (
                <th
                  key={`col-${idx}`}
                  className={`border border-gray-300 px-2 py-1 font-semibold ${
                    idx === 0 ? 'text-left' : 'text-right'
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonTable.rows.map((row, rowIdx) => (
              <tr key={`row-${rowIdx}`}>
                {row.map((cell, cellIdx) => (
                  <td
                    key={`cell-${rowIdx}-${cellIdx}`}
                    className={`border border-gray-300 px-2 py-1 ${cellIdx === 0 ? 'font-medium text-left' : 'text-right'}`}
                  >
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

  const renderComparisonTable = () => renderKPITable();

  const renderCohortHeatmap = () => {
    const cohorts = ['Q1 2023', 'Q2 2023', 'Q3 2023'];
    const months = ['M0', 'M1', 'M2', 'M3'];
    const heatmapData = cohorts.map((_, i) =>
      months.map((__, j) => Math.max(0, 100 - (i * 7 + j * 10)))
    );

    const getColor = (value) => {
      if (value >= 80) return 'bg-green-600';
      if (value >= 60) return 'bg-green-400';
      if (value >= 40) return 'bg-yellow-400';
      if (value >= 20) return 'bg-orange-400';
      return 'bg-red-400';
    };

    return (
      <div className="overflow-auto text-[10px]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-left font-semibold">Cohort</th>
              {months.map((m) => (
                <th key={m} className="border border-gray-300 px-2 py-1 bg-gray-100 text-center font-semibold">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c, i) => (
              <tr key={c}>
                <td className="border border-gray-300 px-2 py-1 font-medium bg-gray-50">{c}</td>
                {heatmapData[i].map((v, j) => (
                  <td
                    key={`${c}-${j}`}
                    className={`border border-gray-300 px-2 py-1 text-center text-white font-semibold ${getColor(
                      v
                    )}`}
                  >
                    {v}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderGantt = () => {
    const maxRange = Math.max(
      ...ganttData.map((item) => item.start + item.duration),
      6
    );
    return (
      <div className="space-y-2 text-xs">
        <div className="flex text-[10px] text-gray-600 mb-1">
          <div className="w-24"></div>
          {[...Array(maxRange)].map((_, i) => (
            <div key={`q-${i}`} className="flex-1 text-center">
              M{i + 1}
            </div>
          ))}
        </div>
        {ganttData.map((item, idx) => (
          <div key={`${item.task}-${idx}`} className="flex items-center">
            <div className="w-24 font-medium pr-2">{item.task}</div>
            <div className="flex-1 flex">
              <div style={{ width: `${(item.start / maxRange) * 100}%` }}></div>
              <div
                style={{
                  width: `${(item.duration / maxRange) * 100}%`,
                  backgroundColor: seriesColors[idx % seriesColors.length],
                }}
                className="h-6 rounded flex items-center justify-center text-white text-[10px] font-semibold"
              >
                {item.duration}M
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTimeline = () => {
    return (
      <div className="relative py-4 text-xs">
        <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gray-300"></div>
        {timelineData.map((m, i) => (
          <div key={m.event} className={`flex items-center mb-4 ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className={`w-5/12 ${i % 2 === 0 ? 'text-right pr-4' : 'text-left pl-4'}`}>
              <div className="font-semibold">{m.date}</div>
              <div className="text-gray-600">{m.event}</div>
            </div>
            <div className="relative z-10">
              <div
                className="w-3 h-3 rounded-full border-2 border-white"
                style={{ backgroundColor: seriesColors[i % seriesColors.length] }}
              ></div>
            </div>
            <div className="w-5/12"></div>
          </div>
        ))}
      </div>
    );
  };

  const renderFunnel = () => {
    const maxValue = Math.max(...funnelData.map((item) => item.value), 1);

    return (
      <div className="space-y-2 py-2 text-xs">
        {funnelData.map((item, i) => {
          const width = (item.value / maxValue) * 100;
          return (
            <div key={item.stage} className="flex items-center gap-2">
              <div className="w-20 text-right">{item.stage}</div>
              <div className="flex-1">
                <div
                  className="h-8 flex items-center justify-center text-white font-semibold text-[10px]"
                  style={{
                    width: `${width}%`,
                    backgroundColor: seriesColors[i % seriesColors.length],
                    clipPath: i === 0 ? 'none' : 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)',
                  }}
                >
                  {Math.round((item.value / maxValue) * 100)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderQuadrant = () => {
    return (
      <div className="relative w-full h-48 border-2 border-gray-300 text-[10px]">
        <div className="absolute inset-0 flex">
          <div className="w-1/2 h-full bg-yellow-50 border-r border-gray-300"></div>
          <div className="w-1/2 h-full bg-green-50"></div>
        </div>
        <div className="absolute inset-0 flex flex-col">
          <div className="h-1/2 border-b border-gray-300"></div>
          <div className="h-1/2"></div>
        </div>
        {quadrantItems.map((item) => (
          <div
            key={item.name}
            className="absolute w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shadow"
            style={{
              left: `${item.x}%`,
              top: `${100 - item.y}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: colors.primary,
            }}
          >
            {item.name}
          </div>
        ))}
      </div>
    );
  };

  const renderKPICards = () => {
    return (
      <div className="grid grid-cols-2 gap-3 text-xs">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="bg-white border-2 border-gray-200 rounded-lg p-3">
            <div className="text-[10px] text-gray-600 mb-1">{kpi.label}</div>
            <div className="text-lg font-bold mb-1">{kpi.value}</div>
            <div className="text-[10px] font-semibold text-green-600">{kpi.change}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderPieChart = (innerRadius = 0) => (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="label"
          innerRadius={innerRadius}
          outerRadius={90}
          paddingAngle={2}
        >
          {pieData.map((entry, index) => (
            <Cell key={`slice-${entry.label}`} fill={seriesColors[index % seriesColors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatValue(value)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );

  const renderTreemap = () => (
    <ResponsiveContainer width="100%" height={240}>
      <Treemap
        data={pieData.map((entry, idx) => ({
          ...entry,
          name: entry.label,
          fill: seriesColors[idx % seriesColors.length],
        }))}
        dataKey="value"
        nameKey="name"
        stroke="#ffffff"
      />
    </ResponsiveContainer>
  );

  const renderBullet = () => {
    const maxValue = Math.max(...bulletData.map((row) => row.max || row.value || 0), 1);
    return (
      <div className="space-y-3 text-xs">
        {bulletData.map((row, idx) => {
          const rowMax = row.max || maxValue;
          const valuePct = Math.min((row.value / rowMax) * 100, 100);
          const targetPct = Math.min((row.target / rowMax) * 100, 100);
          return (
            <div key={`bullet-${idx}`}>
              <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                <span>{row.label}</span>
                <span>{formatValue(row.value)}</span>
              </div>
              <div className="relative h-3 rounded-full bg-slate-100">
                <div
                  className="absolute left-0 top-0 h-3 rounded-full bg-blue-600"
                  style={{ width: `${valuePct}%` }}
                ></div>
                <div
                  className="absolute top-[-3px] h-5 w-1 bg-amber-500"
                  style={{ left: `${targetPct}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const buildWaffleCells = () => {
    const order = [];
    for (let row = 9; row >= 0; row -= 1) {
      for (let col = 0; col < 10; col += 1) {
        order.push(row * 10 + col);
      }
    }
    return order;
  };

  const renderWaffle = () => {
    const order = buildWaffleCells();
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-4">
          {waffleData.map((item, idx) => {
            const count = Math.max(0, Math.min(100, Math.round(Number(item.value || 0))));
            const fillColor = seriesColors[idx % seriesColors.length];
            return (
              <div key={`waffle-card-${idx}`} className="space-y-2">
                <div className="grid grid-cols-10 gap-1">
                  {order.map((cellIndex, cellIdx) => {
                    const filled = cellIdx < count;
                    return (
                      <div
                        key={`waffle-${idx}-${cellIndex}`}
                        className="w-3 h-3 rounded-[3px]"
                        style={{ backgroundColor: filled ? fillColor : '#ede9fe' }}
                      ></div>
                    );
                  })}
                </div>
                <div className="text-center">
                  <div className="text-base font-semibold text-slate-900">{`${count}%`}</div>
                  <div className="text-[11px] text-slate-600">{item.note || item.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBeforeAfter = () => (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={beforeAfterData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 11 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 11 }} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        <Bar dataKey="before" fill={colors.forecast} name="Before" radius={[4, 4, 0, 0]} />
        <Bar dataKey="after" fill={colors.primary} name="After" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderGrowthCurve = () => {
    const width = 640;
    const height = 280;
    const padding = 50;
    const values = data.map((item) => item.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const span = Math.max(max - min, 1);
    const points = data.map((item, idx) => {
      const x = padding + (idx * (width - padding * 2)) / Math.max(data.length - 1, 1);
      const y = height - padding - ((item.value - min) / span) * (height - padding * 2);
      return { x, y, label: item.label, value: item.value };
    });
    if (!points.length) {
      return <div className="text-sm text-slate-500">Add data points to render the curve.</div>;
    }
    const path = points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x} ${pt.y}`).join(' ');
    const lastPoint = points[points.length - 1];
    const calloutWidth = 210;
    const calloutHeight = 44;
    const calloutX = Math.min(lastPoint.x + 10, width - calloutWidth - 10);
    const calloutY = Math.max(lastPoint.y - calloutHeight - 20, 10);

    return (
      <div className="space-y-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-72">
          <defs>
            <linearGradient id="growthLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f9a8d4" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d1d5db" />
          <path d={path} fill="none" stroke="url(#growthLine)" strokeWidth="6" strokeLinecap="round" />
          {points.map((pt, idx) => (
            <g key={`point-${idx}`}>
              <circle cx={pt.x} cy={pt.y} r="6" fill="#f472b6" />
              <text x={pt.x} y={pt.y - 14} textAnchor="middle" fontSize="14" fill="#f472b6" fontWeight="600">
                {formatValue(pt.value)}
              </text>
              <text x={pt.x} y={height - padding + 20} textAnchor="middle" fontSize="12" fill="#9ca3af">
                {pt.label}
              </text>
            </g>
          ))}
          {growthCallout && (
            <g>
              <rect x={calloutX} y={calloutY} rx="10" ry="10" width={calloutWidth} height={calloutHeight} fill="#f9a8d4" />
              <text
                x={calloutX + calloutWidth / 2}
                y={calloutY + calloutHeight / 2 + 5}
                textAnchor="middle"
                fontSize="14"
                fill="#ffffff"
                fontWeight="700"
              >
                {growthCallout}
              </text>
            </g>
          )}
        </svg>
        {growthCaption && <div className="text-sm text-slate-600">{growthCaption}</div>}
      </div>
    );
  };

  const renderBarLine = () => {
    const barSeries = multiSeries[0];
    const lineSeries = multiSeries[1] || multiSeries[0];
    return (
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={multiSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 12 }} />
          <YAxis stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
            formatter={(value) => formatValue(value)}
          />
          <Legend />
          {barSeries && (
            <Bar dataKey={barSeries.key} fill={colors.primary} name={barSeries.label} radius={[4, 4, 0, 0]} />
          )}
          {lineSeries && (
            <Line
              type="monotone"
              dataKey={lineSeries.key}
              stroke={colors.secondary}
              strokeWidth={3}
              name={lineSeries.label}
              dot={{ fill: colors.secondary, r: 5 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  const renderRevenueMix = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">{revenueMixTitle}</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={multiSeriesData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 12 }} />
            <YAxis stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
              formatter={(value) => formatValue(value)}
            />
            {multiSeries.slice(0, 2).map((series, idx) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                stroke={idx === 0 ? colors.primary : '#111827'}
                strokeWidth={3}
                dot={{ fill: idx === 0 ? colors.primary : '#111827', r: 4 }}
                name={series.label}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {multiSeries.slice(0, 2).map((series, idx) => (
            <span key={`legend-${series.key}`} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: idx === 0 ? colors.primary : '#111827' }}
              ></span>
              {series.label}
            </span>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={70}>
                  {pieData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={seriesColors[idx % seriesColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-700 mb-2">{revenueMixSubtitle}</div>
            <div className="space-y-2 text-sm">
              {pieData.map((slice, idx) => (
                <div key={`mix-${idx}`} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: seriesColors[idx % seriesColors.length] }}
                  ></span>
                  <span className="font-medium text-slate-700">{slice.label}</span>
                  <span className="text-slate-500">{slice.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-700">{pricingTitle}</div>
          <div className="text-base font-semibold text-blue-600 mt-1">{pricingSummary}</div>
          <ul className="mt-2 text-sm text-slate-600 list-disc list-inside space-y-1">
            {pricingDetails.map((item, idx) => (
              <li key={`pricing-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-700">{conciergeTitle}</div>
          <ul className="mt-2 text-sm text-slate-600 list-disc list-inside space-y-1">
            {conciergeDetails.map((item, idx) => (
              <li key={`concierge-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderMarketSize = () => {
    const width = 520;
    const height = 320;
    const centerX = 190;
    const centerY = 180;
    const maxRadius = 140;
    const gap = 34;
    return (
      <div className="flex flex-col lg:flex-row gap-6 items-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xl h-72">
          {marketSizeRings.map((ring, idx) => {
            const radius = maxRadius - idx * gap;
            const labelY = centerY - radius / 2;
            return (
              <g key={`ring-${idx}`}>
                <circle cx={centerX} cy={centerY} r={radius} fill={ring.color} opacity={0.9} />
                <text x={centerX} y={labelY} textAnchor="middle" fontSize="16" fill="#1f2937" fontWeight="600">
                  {ring.label}
                </text>
                <text x={centerX} y={labelY + 20} textAnchor="middle" fontSize="13" fill="#1f2937">
                  {ring.amount}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="space-y-3 text-sm text-slate-600">
          {marketSizeRings.map((ring, idx) => (
            <div key={`ring-note-${idx}`} className="flex items-center gap-3">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: ring.color }}></span>
              <span className="font-semibold text-slate-700">{ring.label}</span>
              <span>{ring.amount}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTRL = () => {
    const max = Math.max(1, trlData.max);
    const currentPct = (trlData.current / max) * 100;
    const targetPct = (trlData.target / max) * 100;
    return (
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span>Current TRL {trlData.current}</span>
          <span>Target TRL {trlData.target}</span>
        </div>
        <div className="relative h-3 bg-gray-200 rounded-full">
          <div
            className="absolute h-3 bg-blue-600 rounded-full"
            style={{ width: `${currentPct}%` }}
          ></div>
          <div
            className="absolute h-3 bg-blue-200 rounded-full"
            style={{ width: `${targetPct}%` }}
          ></div>
          {trlData.milestones.map((milestone) => (
            <div
              key={`milestone-${milestone}`}
              className="absolute -top-1 w-2 h-2 rounded-full bg-gray-500"
              style={{ left: `${(milestone / max) * 100}%` }}
            ></div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>TRL 1</span>
          <span>TRL {max}</span>
        </div>
      </div>
    );
  };

  const renderChart = () => {
    switch (chartType) {
      case 'mermaid':
        return <MermaidBlock code={mermaidCode} />;
      case 'line':
        return renderLineChart();
      case 'bar':
        return renderBarChart();
      case 'grouped':
        return renderGroupedChart();
      case 'stacked':
        return renderStackedChart();
      case 'combo':
        return renderComboChart();
      case 'bar-line':
        return renderBarLine();
      case 'waterfall':
        return renderWaterfall();
      case 'before-after':
        return renderBeforeAfter();
      case 'comparison-table':
        return renderComparisonTable();
      case 'kpi-table':
        return renderKPITable();
      case 'gantt':
        return renderGantt();
      case 'timeline':
        return renderTimeline();
      case 'funnel':
        return renderFunnel();
      case 'trl':
        return renderTRL();
      case 'pie':
        return renderPieChart(0);
      case 'donut':
        return renderPieChart(40);
      case 'treemap':
        return renderTreemap();
      case 'bullet':
        return renderBullet();
      case 'waffle':
        return renderWaffle();
      case 'quadrant':
        return renderQuadrant();
      case 'kpi-cards':
        return renderKPICards();
      case 'growth-curve':
        return renderGrowthCurve();
      case 'revenue-mix':
        return renderRevenueMix();
      case 'market-size':
        return renderMarketSize();
      default:
        return renderLineChart();
    }
  };

  const showDataEditor = ['bar', 'combo', 'waterfall', 'growth-curve'].includes(chartType);
  const showMultiSeriesEditor = ['line', 'grouped', 'stacked', 'bar-line', 'revenue-mix'].includes(chartType);
  const isMermaid = chartType === 'mermaid';

  const MermaidBlock = ({ code }) => {
    const containerRef = useRef(null);
    useEffect(() => {
      if (!code || !containerRef.current) return;
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

    return <div className="w-full h-full flex items-center justify-center" ref={containerRef} />;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-600">PSST section</label>
        <select
          value={psstSection}
          onChange={(event) => {
            const next = event.target.value;
            setPsstSection(next);
            const section = psstSections.find((item) => item.id === next);
            if (section?.required?.length) {
              setChartType(section.required[0]);
            }
          }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
        >
          {psstSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
          {chartTypes
            .filter((type) => recommendedChartIds.has(type.id))
            .map((type) => (
              <button
                key={`rec-${type.id}`}
                type="button"
                onClick={() => setChartType(type.id)}
                className="px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                {type.name}
              </button>
            ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chartTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setChartType(type.id)}
            className={`px-3 py-1 rounded-full text-xs border ${
              chartType === type.id ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600'
            }`}
            type="button"
          >
            {type.name}
          </button>
        ))}
      </div>

      {!isMermaid && (
        <input
          type="text"
          value={unitLabel}
          onChange={(e) => setUnitLabel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
          placeholder="Units (e.g. ₩, %, tons CO2)"
        />
      )}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        placeholder="Chart title"
      />

      {isMermaid && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600">Mermaid examples (IR-friendly)</label>
          <select
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
            onChange={(event) => {
              const example = mermaidExamples.find((item) => item.id === event.target.value);
              if (example) setMermaidCode(example.code);
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Choose an example…
            </option>
            {mermaidExamples.map((example) => (
              <option key={example.id} value={example.id}>
                {example.label}
              </option>
            ))}
          </select>
          <textarea
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs min-h-[140px] font-mono"
            value={mermaidCode}
            onChange={(event) => setMermaidCode(event.target.value)}
            placeholder="Paste or edit Mermaid code here"
          />
        </div>
      )}

      <div ref={chartRef} className="bg-white p-3 rounded-lg border border-gray-200">
        <div className="text-sm font-semibold mb-2">{title}</div>
        {renderChart()}
      </div>

      <button
        onClick={exportChart}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm"
        type="button"
        disabled={isExporting}
      >
        <Download size={14} />
        {isExporting ? 'Saving...' : isMermaid ? 'Save diagram to slide' : 'Save chart to slide'}
      </button>

      {!isMermaid && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">AI chart (PNG)</span>
            <button
              onClick={handleGenerateAiImage}
              className="text-xs text-emerald-600 hover:text-emerald-700"
            type="button"
            disabled={isAiGenerating}
          >
            {isAiGenerating ? 'Generating...' : 'Generate AI PNG'}
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            Creates a non-editable PNG from the current chart data.
          </p>
        {aiImageError && <div className="text-xs text-red-600">{aiImageError}</div>}
        {aiImageUrl && (
          <div className="space-y-2">
            <img
              src={aiImageUrl}
              alt="AI chart preview"
              className="w-full border border-gray-200 rounded-lg"
            />
            <button
              onClick={() => onSave?.(aiImageUrl)}
              className="w-full px-3 py-2 text-sm border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50"
              type="button"
            >
              Use AI PNG on slide
            </button>
          </div>
        )}
        </div>
      )}

      {showDataEditor && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Data points</span>
            <button
              onClick={addDataPoint}
              className="flex items-center gap-1 text-xs text-emerald-600"
              type="button"
            >
              <Plus size={12} />
              Add
            </button>
          </div>
          {data.map((point, index) => (
            <div key={`${point.label}-${index}`} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={point.label}
                onChange={(e) => updateDataPoint(index, 'label', e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={point.value}
                onChange={(e) => updateDataPoint(index, 'value', e.target.value)}
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={point.forecast}
                  onChange={(e) => updateDataPoint(index, 'forecast', e.target.checked)}
                />
                F
              </label>
              <button
                onClick={() => removeDataPoint(index)}
                className="text-red-600"
                type="button"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showMultiSeriesEditor && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Series</span>
            <button onClick={addSeries} className="text-xs text-emerald-600" type="button">
              <Plus size={12} /> Add series
            </button>
          </div>
          <div className="space-y-2">
            {multiSeries.map((series, idx) => (
              <div key={series.key} className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  value={series.label}
                  onChange={(e) => updateMultiSeriesLabel(idx, e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded"
                />
                {multiSeries.length > 1 && (
                  <button onClick={() => removeSeries(idx)} className="text-red-600" type="button">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-semibold text-gray-700">Rows</span>
            <button onClick={addMultiSeriesRow} className="text-xs text-emerald-600" type="button">
              <Plus size={12} /> Add row
            </button>
          </div>
          {multiSeriesData.map((row, rowIdx) => (
            <div key={`row-${rowIdx}`} className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                value={row.label}
                onChange={(e) => updateMultiSeriesLabelValue(rowIdx, e.target.value)}
                className="w-24 px-2 py-1 border border-gray-200 rounded"
              />
              {multiSeries.map((series) => (
                <input
                  key={`${rowIdx}-${series.key}`}
                  type="number"
                  value={row[series.key]}
                  onChange={(e) => updateMultiSeriesValue(rowIdx, series.key, e.target.value)}
                  className="w-20 px-2 py-1 border border-gray-200 rounded"
                />
              ))}
              <button onClick={() => removeMultiSeriesRow(rowIdx)} className="text-red-600" type="button">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {chartType === 'growth-curve' && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-700">Growth callout</span>
          <input
            type="text"
            value={growthCallout}
            onChange={(e) => setGrowthCallout(e.target.value)}
            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
            placeholder="Callout text"
          />
          <textarea
            value={growthCaption}
            onChange={(e) => setGrowthCaption(e.target.value)}
            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
            rows={3}
            placeholder="Caption"
          />
        </div>
      )}

      {chartType === 'revenue-mix' && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-700">Revenue mix layout</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="text"
              value={revenueMixTitle}
              onChange={(e) => setRevenueMixTitle(e.target.value)}
              className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
              placeholder="Left chart title"
            />
            <input
              type="text"
              value={revenueMixSubtitle}
              onChange={(e) => setRevenueMixSubtitle(e.target.value)}
              className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
              placeholder="Donut title"
            />
          </div>
          <input
            type="text"
            value={pricingTitle}
            onChange={(e) => setPricingTitle(e.target.value)}
            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
            placeholder="Pricing title"
          />
          <input
            type="text"
            value={pricingSummary}
            onChange={(e) => setPricingSummary(e.target.value)}
            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
            placeholder="Pricing summary"
          />
          <textarea
            value={pricingDetails.join('\n')}
            onChange={(e) => setPricingDetails(e.target.value.split('\n').filter(Boolean))}
            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
            rows={4}
            placeholder="Pricing details (one per line)"
          />
          <input
            type="text"
            value={conciergeTitle}
            onChange={(e) => setConciergeTitle(e.target.value)}
            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
            placeholder="Concierge title"
          />
          <textarea
            value={conciergeDetails.join('\n')}
            onChange={(e) => setConciergeDetails(e.target.value.split('\n').filter(Boolean))}
            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
            rows={3}
            placeholder="Concierge details (one per line)"
          />
        </div>
      )}

      {['comparison-table', 'kpi-table'].includes(chartType) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Table</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setComparisonTable((prev) => ({
                    ...prev,
                    columns: [...prev.columns, `Column ${prev.columns.length + 1}`],
                    rows: prev.rows.map((row) => [...row, '']),
                  }))
                }
                className="text-xs text-emerald-600"
              >
                <Plus size={12} /> Column
              </button>
              <button
                type="button"
                onClick={() =>
                  setComparisonTable((prev) => ({
                    ...prev,
                    rows: [...prev.rows, prev.columns.map(() => '')],
                  }))
                }
                className="text-xs text-emerald-600"
              >
                <Plus size={12} /> Row
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {comparisonTable.columns.map((column, idx) => (
              <input
                key={`col-${idx}`}
                type="text"
                value={column}
                onChange={(e) =>
                  setComparisonTable((prev) => {
                    const columns = [...prev.columns];
                    columns[idx] = e.target.value;
                    return { ...prev, columns };
                  })
                }
                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
              />
            ))}
            {comparisonTable.rows.map((row, rowIdx) => (
              <div key={`row-edit-${rowIdx}`} className="flex flex-wrap gap-2">
                {row.map((cell, cellIdx) => (
                  <input
                    key={`cell-edit-${rowIdx}-${cellIdx}`}
                    type="text"
                    value={cell}
                    onChange={(e) =>
                      setComparisonTable((prev) => {
                        const rows = prev.rows.map((r) => [...r]);
                        rows[rowIdx][cellIdx] = e.target.value;
                        return { ...prev, rows };
                      })
                    }
                    className="flex-1 min-w-[120px] px-2 py-1 border border-gray-200 rounded text-xs"
                  />
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setComparisonTable((prev) => ({
                      ...prev,
                      rows: prev.rows.filter((_, idx) => idx !== rowIdx),
                    }))
                  }
                  className="text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {chartType === 'before-after' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Before / After</span>
            <button
              type="button"
              onClick={() =>
                setBeforeAfterData((prev) => [...prev, { label: `Item ${prev.length + 1}`, before: 0, after: 0 }])
              }
              className="text-xs text-emerald-600"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {beforeAfterData.map((row, idx) => (
            <div key={`ba-${idx}`} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={row.label}
                onChange={(e) =>
                  setBeforeAfterData((prev) => prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))
                }
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.before}
                onChange={(e) =>
                  setBeforeAfterData((prev) => prev.map((item, i) => (i === idx ? { ...item, before: Number(e.target.value) || 0 } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.after}
                onChange={(e) =>
                  setBeforeAfterData((prev) => prev.map((item, i) => (i === idx ? { ...item, after: Number(e.target.value) || 0 } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={() => setBeforeAfterData((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {chartType === 'gantt' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Gantt tasks</span>
            <button
              type="button"
              onClick={() =>
                setGanttData((prev) => [...prev, { task: `Task ${prev.length + 1}`, start: 0, duration: 1 }])
              }
              className="text-xs text-emerald-600"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {ganttData.map((row, idx) => (
            <div key={`gantt-${idx}`} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={row.task}
                onChange={(e) =>
                  setGanttData((prev) => prev.map((item, i) => (i === idx ? { ...item, task: e.target.value } : item)))
                }
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.start}
                onChange={(e) =>
                  setGanttData((prev) => prev.map((item, i) => (i === idx ? { ...item, start: Number(e.target.value) || 0 } : item)))
                }
                className="w-16 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.duration}
                onChange={(e) =>
                  setGanttData((prev) => prev.map((item, i) => (i === idx ? { ...item, duration: Number(e.target.value) || 0 } : item)))
                }
                className="w-16 px-2 py-1 border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={() => setGanttData((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {chartType === 'timeline' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Timeline</span>
            <button
              type="button"
              onClick={() =>
                setTimelineData((prev) => [...prev, { date: `Q${prev.length + 1}`, event: 'Milestone' }])
              }
              className="text-xs text-emerald-600"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {timelineData.map((row, idx) => (
            <div key={`timeline-${idx}`} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={row.date}
                onChange={(e) =>
                  setTimelineData((prev) => prev.map((item, i) => (i === idx ? { ...item, date: e.target.value } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="text"
                value={row.event}
                onChange={(e) =>
                  setTimelineData((prev) => prev.map((item, i) => (i === idx ? { ...item, event: e.target.value } : item)))
                }
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={() => setTimelineData((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {chartType === 'funnel' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Funnel stages</span>
            <button
              type="button"
              onClick={() =>
                setFunnelData((prev) => [...prev, { stage: `Stage ${prev.length + 1}`, value: 0 }])
              }
              className="text-xs text-emerald-600"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {funnelData.map((row, idx) => (
            <div key={`funnel-${idx}`} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={row.stage}
                onChange={(e) =>
                  setFunnelData((prev) => prev.map((item, i) => (i === idx ? { ...item, stage: e.target.value } : item)))
                }
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.value}
                onChange={(e) =>
                  setFunnelData((prev) => prev.map((item, i) => (i === idx ? { ...item, value: Number(e.target.value) || 0 } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={() => setFunnelData((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {chartType === 'bullet' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Bullet rows</span>
            <button
              type="button"
              onClick={() =>
                setBulletData((prev) => [
                  ...prev,
                  { label: `Metric ${prev.length + 1}`, value: 0, target: 0, max: 100 },
                ])
              }
              className="text-xs text-emerald-600"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {bulletData.map((row, idx) => (
            <div key={`bullet-${idx}`} className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                value={row.label}
                onChange={(e) =>
                  setBulletData((prev) => prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))
                }
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.value}
                onChange={(e) =>
                  setBulletData((prev) => prev.map((item, i) => (i === idx ? { ...item, value: Number(e.target.value) || 0 } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.target}
                onChange={(e) =>
                  setBulletData((prev) => prev.map((item, i) => (i === idx ? { ...item, target: Number(e.target.value) || 0 } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.max}
                onChange={(e) =>
                  setBulletData((prev) => prev.map((item, i) => (i === idx ? { ...item, max: Number(e.target.value) || 0 } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={() => setBulletData((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {['pie', 'donut', 'revenue-mix', 'treemap'].includes(chartType) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Slices</span>
            <button
              type="button"
              onClick={() => setPieData((prev) => [...prev, { label: `Slice ${prev.length + 1}`, value: 0 }])}
              className="text-xs text-emerald-600"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {pieData.map((row, idx) => (
            <div key={`pie-${idx}`} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={row.label}
                onChange={(e) =>
                  setPieData((prev) => prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))
                }
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.value}
                onChange={(e) =>
                  setPieData((prev) => prev.map((item, i) => (i === idx ? { ...item, value: Number(e.target.value) || 0 } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={() => setPieData((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {chartType === 'waffle' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Waffle cards</span>
            <button
              type="button"
              onClick={() =>
                setWaffleData((prev) => [
                  ...prev,
                  { label: `Metric ${prev.length + 1}`, value: 0, note: '' },
                ])
              }
              className="text-xs text-emerald-600"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {waffleData.map((row, idx) => (
            <div key={`waffle-edit-${idx}`} className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                value={row.label}
                onChange={(e) =>
                  setWaffleData((prev) => prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))
                }
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.value}
                onChange={(e) =>
                  setWaffleData((prev) => prev.map((item, i) => (i === idx ? { ...item, value: Number(e.target.value) || 0 } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="text"
                value={row.note}
                onChange={(e) =>
                  setWaffleData((prev) => prev.map((item, i) => (i === idx ? { ...item, note: e.target.value } : item)))
                }
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={() => setWaffleData((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {chartType === 'market-size' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Market size rings</span>
            <button
              type="button"
              onClick={() =>
                setMarketSizeRings((prev) => [
                  ...prev,
                  { label: `Tier ${prev.length + 1}`, amount: '0', color: '#fde68a' },
                ])
              }
              className="text-xs text-emerald-600"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {marketSizeRings.map((ring, idx) => (
            <div key={`ring-${idx}`} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={ring.label}
                onChange={(e) =>
                  setMarketSizeRings((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item))
                  )
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="text"
                value={ring.amount}
                onChange={(e) =>
                  setMarketSizeRings((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, amount: e.target.value } : item))
                  )
                }
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="color"
                value={ring.color}
                onChange={(e) =>
                  setMarketSizeRings((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, color: e.target.value } : item))
                  )
                }
                className="w-8 h-8 border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={() => setMarketSizeRings((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {chartType === 'trl' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <input
              type="number"
              value={trlData.current}
              onChange={(e) => setTrlData((prev) => ({ ...prev, current: Number(e.target.value) || 0 }))}
              className="w-20 px-2 py-1 border border-gray-200 rounded"
            />
            <span className="text-gray-600">Current</span>
            <input
              type="number"
              value={trlData.target}
              onChange={(e) => setTrlData((prev) => ({ ...prev, target: Number(e.target.value) || 0 }))}
              className="w-20 px-2 py-1 border border-gray-200 rounded"
            />
            <span className="text-gray-600">Target</span>
            <input
              type="number"
              value={trlData.max}
              onChange={(e) => setTrlData((prev) => ({ ...prev, max: Number(e.target.value) || 1 }))}
              className="w-20 px-2 py-1 border border-gray-200 rounded"
            />
            <span className="text-gray-600">Max</span>
          </div>
          <input
            type="text"
            value={trlData.milestones.join(',')}
            onChange={(e) =>
              setTrlData((prev) => ({
                ...prev,
                milestones: e.target.value
                  .split(',')
                  .map((value) => Number(value.trim()))
                  .filter((value) => !Number.isNaN(value)),
              }))
            }
            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
            placeholder="Milestones (e.g. 2,4,6,8,9)"
          />
        </div>
      )}

      {chartType === 'kpi-cards' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">KPI cards</span>
            <button
              type="button"
              onClick={() =>
                setKpiCards((prev) => [...prev, { label: 'Metric', value: '0', change: '+0%' }])
              }
              className="text-xs text-emerald-600"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {kpiCards.map((row, idx) => (
            <div key={`kpi-${idx}`} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={row.label}
                onChange={(e) =>
                  setKpiCards((prev) => prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))
                }
                className="flex-1 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="text"
                value={row.value}
                onChange={(e) =>
                  setKpiCards((prev) => prev.map((item, i) => (i === idx ? { ...item, value: e.target.value } : item)))
                }
                className="w-24 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="text"
                value={row.change}
                onChange={(e) =>
                  setKpiCards((prev) => prev.map((item, i) => (i === idx ? { ...item, change: e.target.value } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={() => setKpiCards((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {chartType === 'quadrant' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Quadrant points</span>
            <button
              type="button"
              onClick={() =>
                setQuadrantItems((prev) => [...prev, { name: 'New', x: 50, y: 50 }])
              }
              className="text-xs text-emerald-600"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {quadrantItems.map((row, idx) => (
            <div key={`quad-${idx}`} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={row.name}
                onChange={(e) =>
                  setQuadrantItems((prev) => prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)))
                }
                className="w-20 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.x}
                onChange={(e) =>
                  setQuadrantItems((prev) => prev.map((item, i) => (i === idx ? { ...item, x: Number(e.target.value) || 0 } : item)))
                }
                className="w-16 px-2 py-1 border border-gray-200 rounded"
              />
              <input
                type="number"
                value={row.y}
                onChange={(e) =>
                  setQuadrantItems((prev) => prev.map((item, i) => (i === idx ? { ...item, y: Number(e.target.value) || 0 } : item)))
                }
                className="w-16 px-2 py-1 border border-gray-200 rounded"
              />
              <button
                type="button"
                onClick={() => setQuadrantItems((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChartBuilderPanel;
