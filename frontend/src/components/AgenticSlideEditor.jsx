import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';

const stripKeyframes = (css) => {
  if (!css) return { css: '', keyframes: [] };
  const keyframes = [];
  let working = css;
  const pattern = /@keyframes\s+[^{]+\{[\s\S]*?\}\s*\}/gi;
  working = working.replace(pattern, (match) => {
    keyframes.push(match);
    return '';
  });
  return { css: working, keyframes };
};

const scopeCssToContainer = (css, scopeSelector) => {
  if (!css) return '';
  // Strip CSS comments first so they don't interfere with selector matching
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const { css: withoutKeyframes, keyframes } = stripKeyframes(noComments);

  // Do not remap global root selectors directly onto the editor container.
  // This prevents AI-generated `body/html/:root` rules from shifting slide geometry.
  const normalizeSelectorPart = (part) => {
    if (!part) return null;
    let cleaned = part.trim().replace(/\s+/g, ' ');
    if (!cleaned) return null;
    if (cleaned.startsWith('@')) return cleaned;

    // Remove root tokens when they are selector prefixes.
    cleaned = cleaned.replace(/^(html|body|:root)\b\s*/i, '');
    // Remove leading combinators left behind after prefix stripping.
    cleaned = cleaned.replace(/^(>|\+|~)\s*/, '');
    if (!cleaned) return null;
    if (cleaned.startsWith(scopeSelector)) return cleaned;
    return `${scopeSelector} ${cleaned}`;
  };

  const scoped = withoutKeyframes.replace(
    /(^|})\s*([^@}{][^{]*)\{/g,
    (match, sep, selector) => {
      const scopedSelector = selector
        .split(',')
        .map(normalizeSelectorPart)
        .filter(Boolean)
        .join(', ');
      // Keep CSS syntactically valid while neutralizing fully-dropped selectors.
      if (!scopedSelector) return `${sep} .__agentic_noop__ {`;
      return `${sep} ${scopedSelector} {`;
    }
  );
  return `${scoped}\n${keyframes.join('\n')}`;
};

/**
 * AgenticSlideEditor - Renders agentic HTML slides with inline editing support
 *
 * Features:
 * - Click on text to edit (H1, H2, H3, H4, P, SPAN, LI, TD, TH)
 * - Click on shapes/icons/images to select and resize
 * - Drag to move absolutely positioned elements
 * - Shift+drag or drag corners to resize
 */
const AgenticSlideEditor = ({
  slideUrl,
  slideIndex,
  onSlideChange,
  onHtmlChange,
  htmlOverride,
  scaleOverride,
  enableChartDataEditor = false,
  showChartEditorToggle = true,
  chartEditorOpen,
  onChartEditorOpenChange,
}) => {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cssContent, setCssContent] = useState('');
  const [allSlides, setAllSlides] = useState([]);
  const [rawHtml, setRawHtml] = useState('');
  const [chartConfigs, setChartConfigs] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [resizeHandles, setResizeHandles] = useState([]);
  const [chartEditorOpenInternal, setChartEditorOpenInternal] = useState(false);
  const dragStateRef = useRef(null);
  const chartInstancesRef = useRef(new Map());
  const chartLoaderRef = useRef(null);
  const BASE_CANVAS_WIDTH = 1920;
  const BASE_CANVAS_HEIGHT = 1080;

  const chartEditorOpenState =
    typeof chartEditorOpen === 'boolean' ? chartEditorOpen : chartEditorOpenInternal;
  const setChartEditorOpenState = onChartEditorOpenChange || setChartEditorOpenInternal;

  const baseUrl = slideUrl ? slideUrl.split('#')[0].split('?')[0] : '';

  const parseHtml = useCallback((html) => {
    if (!html) return;
    setRawHtml(html);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract CSS
    const styleTags = doc.querySelectorAll('style');
    let styles = '';
    styleTags.forEach(style => {
      styles += style.textContent + '\n';
    });
    setCssContent(scopeCssToContainer(styles, '.agentic-slide-content'));

    // Get all slides
    const deck = doc.querySelector('.deck');
    if (deck) {
      const slides = deck.querySelectorAll('section.slide');
      setAllSlides(Array.from(slides).map(s => s.outerHTML));
    } else {
      const slides = doc.querySelectorAll('section.slide');
      if (slides.length > 0) {
        setAllSlides(Array.from(slides).map(s => s.outerHTML));
      } else {
        setAllSlides([doc.body.innerHTML]);
      }
    }

    // Extract chart configs from script tag (safer than regex on whole HTML)
    let parsedCharts = [];
    const scripts = doc.querySelectorAll('script');
    for (const s of scripts) {
      const txt = s.textContent || '';
      const m = txt.match(/const\s+charts\s*=\s*(\[[\s\S]*?\]);/);
      if (m && m[1]) {
        try {
          const candidate = JSON.parse(m[1]);
          if (Array.isArray(candidate)) {
            parsedCharts = candidate;
            break;
          }
        } catch (err) {
          console.warn('[AgenticSlideEditor] Failed to parse chart configs:', err);
        }
      }
    }

    // If chart slots exist but configs are missing, create safe defaults
    const slotIds = new Set(
      Array.from(doc.querySelectorAll('[data-chart-id]'))
        .map(el => el.getAttribute('data-chart-id'))
        .filter(Boolean)
    );
    if (slotIds.size > 0) {
      const byId = new Map(parsedCharts.map(cfg => [cfg.id, cfg]));
      slotIds.forEach((id) => {
        if (byId.has(id)) return;
        byId.set(id, {
          id,
          config: {
            type: 'bar',
            data: {
              labels: ['A', 'B', 'C', 'D', 'E'],
              datasets: [{ label: 'Series 1', data: [10, 20, 30, 20, 10] }],
            },
            options: { responsive: true, maintainAspectRatio: false },
          },
        });
      });
      parsedCharts = Array.from(byId.values());
    }

    setChartConfigs(parsedCharts);
  }, []);

  // Prefer overridden HTML (live edits) when available
  useEffect(() => {
    if (!htmlOverride) return;
    setLoading(false);
    setError(null);
    parseHtml(htmlOverride);
  }, [htmlOverride, parseHtml]);

  // Fetch and parse HTML from URL (fallback when no override)
  useEffect(() => {
    if (!baseUrl || htmlOverride) return;

    setLoading(true);
    setError(null);

    fetch(baseUrl)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch slide HTML: ${res.status}`);
        return res.text();
      })
      .then(html => {
        parseHtml(html);
      })
      .catch(err => {
        setError(err.message);
        console.error('[AgenticSlideEditor] Failed to load:', err);
      })
      .finally(() => setLoading(false));
  }, [baseUrl, htmlOverride, parseHtml]);

  const currentSlideHtml = useMemo(() => {
    if (allSlides.length === 0) return '';
    const idx = Math.max(0, Math.min(slideIndex - 1, allSlides.length - 1));
    return allSlides[idx] || '';
  }, [allSlides, slideIndex]);

  const currentSlideCharts = useMemo(() => {
    if (!chartConfigs.length || !currentSlideHtml) return [];
    const idMatches = [...currentSlideHtml.matchAll(/data-chart-id=["']([^"']+)["']/g)];
    const chartIds = new Set(idMatches.map(m => m[1]));
    return chartConfigs.filter(cfg => chartIds.has(cfg.id));
  }, [chartConfigs, currentSlideHtml]);

  const buildUpdatedHtml = useCallback((slideHtml) => {
    if (!rawHtml) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const slides = doc.querySelectorAll('section.slide');
    const idx = Math.max(0, Math.min(slideIndex - 1, slides.length - 1));
    if (slides.length && slides[idx]) {
      const temp = document.createElement('div');
      temp.innerHTML = slideHtml;
      slides[idx].replaceWith(temp.firstElementChild || temp);
    } else {
      doc.body.innerHTML = slideHtml;
    }
    const docHtml = `<!doctype html>\n${doc.documentElement.outerHTML}`;
    setRawHtml(docHtml);
    return docHtml;
  }, [rawHtml, slideIndex]);

  const commitSlideHtml = useCallback(() => {
    if (!containerRef.current) return;

    // Remove editing classes before saving
    const editingEls = containerRef.current.querySelectorAll('.editing, .shape-editing');
    editingEls.forEach(el => {
      el.classList.remove('editing', 'shape-editing');
      el.removeAttribute('data-edit-mode');
      el.removeAttribute('contenteditable');
    });

    const slideEl = containerRef.current.querySelector('.slide');
    const updatedSlideHtml = slideEl ? slideEl.outerHTML : containerRef.current.innerHTML;

    setAllSlides(prev => {
      if (!prev.length) return prev;
      const next = [...prev];
      const idx = Math.max(0, Math.min(slideIndex - 1, next.length - 1));
      next[idx] = updatedSlideHtml;
      return next;
    });

    const fullHtml = buildUpdatedHtml(updatedSlideHtml);
    if (onSlideChange) onSlideChange(updatedSlideHtml);
    if (onHtmlChange && fullHtml) onHtmlChange(fullHtml);
  }, [buildUpdatedHtml, onHtmlChange, onSlideChange, slideIndex]);

  const handleChartDataChange = useCallback((chartId, field, value) => {
    setChartConfigs(prev => prev.map(cfg => {
      if (cfg.id !== chartId) return cfg;
      const updated = JSON.parse(JSON.stringify(cfg));
      if (field.type === 'label') {
        updated.config.data.labels[field.index] = value;
      } else if (field.type === 'datapoint') {
        updated.config.data.datasets[field.datasetIndex].data[field.index] =
          value === '' ? 0 : parseFloat(value) || 0;
      } else if (field.type === 'datasetLabel') {
        updated.config.data.datasets[field.datasetIndex].label = value;
      }
      return updated;
    }));
  }, []);

  const persistChartConfigs = useCallback(() => {
    if (!rawHtml) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // Remove existing chart script definitions (chart data + renderer)
    const scripts = Array.from(doc.querySelectorAll('script'));
    scripts.forEach(s => {
      const txt = s.textContent || '';
      if (txt.includes('const charts') && txt.includes('new Chart')) {
        s.remove();
      }
    });

    // Inject updated chart configs with render stub at end of body
    const chartsJson = JSON.stringify(chartConfigs, null, 2);
    const script = doc.createElement('script');
    script.textContent = `
      const charts = ${chartsJson};
      charts.forEach(cfg => {
        let canvas = document.getElementById(cfg.id);
        if (!canvas) {
          const slot = document.querySelector(\`[data-chart-id="${cfg.id}"]\`);
          if (slot) {
            canvas = document.createElement('canvas');
            canvas.id = cfg.id;
            slot.appendChild(canvas);
          }
        }
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        new Chart(ctx, cfg.config);
      });
    `;
    doc.body.appendChild(script);

    const updatedHtml = `<!doctype html>\n${doc.documentElement.outerHTML}`;
    setRawHtml(updatedHtml);
    if (onHtmlChange) onHtmlChange(updatedHtml);
  }, [rawHtml, chartConfigs, onHtmlChange]);

  const getScale = useCallback(() => {
    return Number(containerRef.current?.dataset.scale || '1') || 1;
  }, []);

  const updateResizeHandle = useCallback((shape) => {
    if (!shape || !editorRef.current) {
      setResizeHandles([]);
      return;
    }
    const editorRect = editorRef.current.getBoundingClientRect();
    const shapeRect = shape.getBoundingClientRect();

    // Calculate positions relative to the editor container
    const left = shapeRect.left - editorRect.left;
    const top = shapeRect.top - editorRect.top;
    const right = shapeRect.right - editorRect.left;
    const bottom = shapeRect.bottom - editorRect.top;
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;

    const offset = 6;
    setResizeHandles([
      // Corners
      { id: 'tl', left: left - offset, top: top - offset, cursor: 'nwse-resize' },
      { id: 'tr', left: right - offset, top: top - offset, cursor: 'nesw-resize' },
      { id: 'bl', left: left - offset, top: bottom - offset, cursor: 'nesw-resize' },
      { id: 'br', left: right - offset, top: bottom - offset, cursor: 'nwse-resize' },
      // Edges
      { id: 't', left: centerX - offset, top: top - offset, cursor: 'ns-resize' },
      { id: 'b', left: centerX - offset, top: bottom - offset, cursor: 'ns-resize' },
      { id: 'l', left: left - offset, top: centerY - offset, cursor: 'ew-resize' },
      { id: 'r', left: right - offset, top: centerY - offset, cursor: 'ew-resize' },
    ]);
  }, []);

  const applyCanvasScale = useCallback(() => {
    if (!containerRef.current || !editorRef.current) return;
    if (selectedElement && document.activeElement === selectedElement) return;
    const container = containerRef.current;
    const editor = editorRef.current;
    const slide = container.querySelector('.slide');
    const canvas = container.querySelector('.agentic-slide-canvas') || slide || container.firstElementChild;
    if (!canvas) return;

    // Get available space from the editor container
    const editorWidth = editor.clientWidth || 800;
    const editorHeight = editor.clientHeight || 600;

    const padding = 0;
    const availableWidth = Math.max(100, editorWidth - padding * 2);
    const availableHeight = Math.max(100, editorHeight - padding * 2);

    let scale = 1;
    if (typeof scaleOverride === 'number' && !Number.isNaN(scaleOverride) && scaleOverride > 0) {
      scale = scaleOverride;
    } else {
      scale = Math.min(
        availableWidth / BASE_CANVAS_WIDTH,
        availableHeight / BASE_CANVAS_HEIGHT
      );
    }

    const setImportant = (el, prop, value) => {
      if (!el) return;
      el.style.setProperty(prop, value, 'important');
    };

    // Apply scale to the slide/canvas
    setImportant(canvas, 'transform', `scale(${scale})`);
    setImportant(canvas, 'transform-origin', 'top left');
    setImportant(canvas, 'width', `${BASE_CANVAS_WIDTH}px`);
    setImportant(canvas, 'height', `${BASE_CANVAS_HEIGHT}px`);
    setImportant(canvas, 'min-width', `${BASE_CANVAS_WIDTH}px`);
    setImportant(canvas, 'min-height', `${BASE_CANVAS_HEIGHT}px`);
    setImportant(canvas, 'position', 'relative');
    setImportant(canvas, 'left', '0');
    setImportant(canvas, 'top', '0');
    setImportant(canvas, 'margin', '0');
    setImportant(canvas, 'padding', '0');
    setImportant(canvas, 'display', 'block');
    setImportant(canvas, 'float', 'none');
    setImportant(canvas, 'flex-shrink', '0');
    setImportant(canvas, 'overflow', 'hidden');

    container.dataset.scale = String(scale);

    // Size the container to match scaled content
    const scaledWidth = Math.ceil(BASE_CANVAS_WIDTH * scale);
    const scaledHeight = Math.ceil(BASE_CANVAS_HEIGHT * scale);
    setImportant(container, 'width', `${scaledWidth}px`);
    setImportant(container, 'height', `${scaledHeight}px`);
    setImportant(container, 'min-width', `${scaledWidth}px`);
    setImportant(container, 'min-height', `${scaledHeight}px`);
    // Anchor the scaled slide deterministically to avoid flex-centering drift.
    setImportant(container, 'position', 'relative');
    setImportant(container, 'left', '0');
    setImportant(container, 'top', '0');
    setImportant(container, 'transform', 'none');
    setImportant(container, 'margin', '0');
    setImportant(container, 'padding', '0');
    setImportant(container, 'display', 'block');
    setImportant(container, 'float', 'none');
    setImportant(container, 'overflow', 'hidden');

    if (slide) {
      setImportant(slide, 'width', `${BASE_CANVAS_WIDTH}px`);
      setImportant(slide, 'height', `${BASE_CANVAS_HEIGHT}px`);
      setImportant(slide, 'min-width', `${BASE_CANVAS_WIDTH}px`);
      setImportant(slide, 'min-height', `${BASE_CANVAS_HEIGHT}px`);
      setImportant(slide, 'max-width', `${BASE_CANVAS_WIDTH}px`);
      setImportant(slide, 'max-height', `${BASE_CANVAS_HEIGHT}px`);
      setImportant(slide, 'position', 'relative');
      setImportant(slide, 'left', '0');
      setImportant(slide, 'top', '0');
      setImportant(slide, 'right', 'auto');
      setImportant(slide, 'bottom', 'auto');
      setImportant(slide, 'margin', '0');
      setImportant(slide, 'float', 'none');
      setImportant(slide, 'transform', 'none');
      setImportant(slide, 'overflow', 'hidden');
    }

    // Update resize handle position if shape is selected
    if (selectedShape) {
      updateResizeHandle(selectedShape);
    }
  }, [selectedElement, selectedShape, updateResizeHandle, scaleOverride]);

  useLayoutEffect(() => {
    if (!editorRef.current) return undefined;
    const handleResize = () => applyCanvasScale();
    // Apply immediately to avoid a one-frame pre-scale clip/offset.
    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(editorRef.current);
    return () => observer.disconnect();
  }, [applyCanvasScale, currentSlideHtml]);

  // Prevent stale scroll offsets between slides/HTML updates.
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.scrollTop = 0;
    editorRef.current.scrollLeft = 0;
  }, [slideIndex, currentSlideHtml]);

  const ensureChartJs = useCallback(() => {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (chartLoaderRef.current) return chartLoaderRef.current;
    chartLoaderRef.current = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.async = true;
      script.onload = () => resolve(window.Chart);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return chartLoaderRef.current;
  }, []);

  const renderCharts = useCallback(async () => {
    if (!containerRef.current || !chartConfigs.length) return;
    let ChartCtor;
    try {
      ChartCtor = await ensureChartJs();
    } catch (err) {
      console.warn('[AgenticSlideEditor] Chart.js failed to load:', err);
      return;
    }

    const slideEl = containerRef.current.querySelector('.slide') || containerRef.current;
    if (!slideEl) return;

    const nextIds = new Set(chartConfigs.map(cfg => cfg?.id).filter(Boolean));
    chartInstancesRef.current.forEach((instance, id) => {
      if (!nextIds.has(id)) {
        try { instance.destroy(); } catch (_) {}
        chartInstancesRef.current.delete(id);
      }
    });

    chartConfigs.forEach(cfg => {
      if (!cfg || !cfg.id || !cfg.config) return;
      const slot = slideEl.querySelector(`[data-chart-id=\"${cfg.id}\"]`);
      if (!slot) return;
      let canvas = slot.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = cfg.id;
        slot.appendChild(canvas);
      }
      const config = {
        ...cfg.config,
        options: {
          ...(cfg.config?.options || {}),
          responsive: true,
          maintainAspectRatio: false,
        },
      };
      const existing = chartInstancesRef.current.get(cfg.id);
      if (existing) {
        const existingType = existing.config?.type;
        if (existingType && existingType !== config.type) {
          try { existing.destroy(); } catch (_) {}
          chartInstancesRef.current.delete(cfg.id);
        } else {
          existing.data = config.data;
          existing.options = config.options;
          existing.update();
          return;
        }
      }

      slot.classList.add('chart-slot--rendered');
      canvas.style.display = 'block';
      canvas.style.position = 'relative';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.margin = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      const chart = new ChartCtor(canvas, config);
      chartInstancesRef.current.set(cfg.id, chart);
    });
  }, [chartConfigs, ensureChartJs]);

  useEffect(() => {
    renderCharts();
    return () => {
      chartInstancesRef.current.forEach(instance => {
        try { instance.destroy(); } catch (_) {}
      });
      chartInstancesRef.current.clear();
    };
  }, [currentSlideHtml, renderCharts]);

  // Clear selection when clicking outside
  const clearSelection = useCallback(() => {
    if (selectedElement) {
      selectedElement.contentEditable = 'false';
      selectedElement.classList.remove('editing');
      commitSlideHtml();
      setSelectedElement(null);
    }
    if (selectedShape) {
      selectedShape.classList.remove('shape-editing');
      selectedShape.removeAttribute('data-edit-mode');
      setSelectedShape(null);
      setResizeHandles([]);
    }
  }, [selectedElement, selectedShape, commitSlideHtml]);

  // Find if element is editable text
  const isEditableText = useCallback((el) => {
    if (!el || !el.tagName) return false;
    const editableTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'LI', 'TD', 'TH', 'LABEL'];
    // Check if it's a text element or has text content
    if (editableTags.includes(el.tagName)) return true;
    // Also check for elements with mostly text content
    if (el.children.length === 0 && el.textContent?.trim()) return true;
    return false;
  }, []);

  // Find if element is a shape/icon
  const findEditableShape = useCallback((node) => {
    if (!node || !node.closest) return null;

    const shapeSelectors = [
      'svg',
      'img',
      'canvas',
      '.icon',
      '.icon-circle',
      '.shape',
      '.decorative-element',
      '.chart-container',
      '.chart-slot',
      '.image-box',
      '.feature-card',
      '.glow-card',
      '.metric',
      '.metric-item',
      '.agentic-metric',
      '.problem-card',
      '.split-panel',
      '.team-card',
      '.quote-card',
      '.card',
      '.stat-card',
      '.metric-card',
      '.kpi-card',
      '.panel',
      '[data-editable="shape"]',
    ].join(', ');

    // Look for shape elements
    const shape = node.closest(shapeSelectors);
    if (!shape) return null;
    if (shape.closest('.deck') && shape.classList.contains('deck')) return null;
    if (shape.classList.contains('slide') || shape.classList.contains('deck')) return null;

    // Don't select tiny icons inside text
    const rect = shape.getBoundingClientRect();
    if (rect.width < 16 || rect.height < 16) return null;

    return shape;
  }, []);

  // Handle click on text elements
  const handleClick = useCallback((e) => {
    const target = e.target;

    // Check if clicking on resize handle - don't clear selection
    if (target?.dataset?.resizeHandle ||
        (resizeHandleRef.current && resizeHandleRef.current.contains(target))) {
      e.stopPropagation();
      return;
    }

    // If currently editing, don't change selection
    if (target?.isContentEditable || target?.closest?.('[contenteditable="true"]')) {
      return;
    }

    // Check if it's a text element (directly or the first text child inside a wrapper)
    let textTarget = isEditableText(target) ? target : null;
    if (!textTarget && target?.tagName === 'DIV') {
      // Clicked on a wrapper div — look for the first text element inside
      const firstText = target.querySelector('h1, h2, h3, h4, h5, h6, p, span, li, label');
      if (firstText) textTarget = firstText;
    }
    if (textTarget) {
      e.stopPropagation();

      // Single click selects text as a movable/resizable shape
      if (selectedElement) {
        selectedElement.contentEditable = 'false';
        selectedElement.classList.remove('editing');
        setSelectedElement(null);
      }
      if (selectedShape && selectedShape !== textTarget) {
        selectedShape.classList.remove('shape-editing');
        selectedShape.removeAttribute('data-edit-mode');
      }
      textTarget.classList.add('shape-editing');
      textTarget.setAttribute('data-edit-mode', 'move');
      setSelectedShape(textTarget);
      updateResizeHandle(textTarget);
      return;
    }

    // Check if it's a shape
    const shape = findEditableShape(target);
    if (shape) {
      e.stopPropagation();

      // Clear text selection
      if (selectedElement) {
        selectedElement.contentEditable = 'false';
        selectedElement.classList.remove('editing');
        setSelectedElement(null);
      }

      // Clear previous shape
      if (selectedShape && selectedShape !== shape) {
        selectedShape.classList.remove('shape-editing');
        selectedShape.removeAttribute('data-edit-mode');
      }

      // Select shape
      shape.classList.add('shape-editing');
      shape.setAttribute('data-edit-mode', 'move');
      setSelectedShape(shape);
      updateResizeHandle(shape);
      return;
    }

    // Click on background - clear selection
    clearSelection();
  }, [selectedElement, selectedShape, isEditableText, findEditableShape, updateResizeHandle, clearSelection]);

  const handleDoubleClick = useCallback((e) => {
    let target = e.target;
    // If clicked on a wrapper div, find the first text element inside
    if (!isEditableText(target) && target?.tagName === 'DIV') {
      const firstText = target.querySelector('h1, h2, h3, h4, h5, h6, p, span, li, label');
      if (firstText) target = firstText;
    }
    if (!isEditableText(target)) return;
    e.stopPropagation();

    if (selectedShape && selectedShape !== target) {
      selectedShape.classList.remove('shape-editing');
      selectedShape.removeAttribute('data-edit-mode');
    }
    target.classList.remove('shape-editing');
    target.removeAttribute('data-edit-mode');
    setSelectedShape(null);
    setResizeHandles([]);

    target.contentEditable = 'true';
    target.classList.add('editing');
    target.focus();
    setSelectedElement(target);
  }, [isEditableText, selectedShape]);

  // Store selectedShape in a ref for resize handle access
  const selectedShapeRef = useRef(null);
  useEffect(() => {
    selectedShapeRef.current = selectedShape;
  }, [selectedShape]);

  // Handle pointer down for dragging shapes
  const handlePointerDown = useCallback((e) => {
    const target = e.target;

    // Check if on resize handle - use ref to avoid stale closure
    const handleId = target?.dataset?.resizeHandle;
    if (handleId) {
      e.preventDefault();
      e.stopPropagation();

      const shape = selectedShapeRef.current;
      if (!shape) return;

      const scale = getScale();
      const rect = shape.getBoundingClientRect();
      const parent = shape.offsetParent || shape.parentElement;
      const parentRect = parent?.getBoundingClientRect() || rect;

      const startLeft = parseFloat(shape.style.left) || (rect.left - parentRect.left) / scale;
      const startTop = parseFloat(shape.style.top) || (rect.top - parentRect.top) / scale;
      const startW = rect.width / scale;
      const startH = rect.height / scale;
      const ratio = startW > 0 ? startH / startW : 1;

      // Ensure shape is positioned absolutely for resize
      const computed = window.getComputedStyle(shape);
      if (computed.position !== 'absolute' && computed.position !== 'fixed') {
        shape.style.position = 'absolute';
        shape.style.left = `${startLeft}px`;
        shape.style.top = `${startTop}px`;
        shape.style.width = `${startW}px`;
        shape.style.height = `${startH}px`;
        shape.style.margin = '0';
      }

      dragStateRef.current = {
        shape,
        mode: 'resize',
        handleId,
        scale,
        startX: e.clientX,
        startY: e.clientY,
        startLeft,
        startTop,
        startW,
        startH,
        ratio,
        canMove: false,
        parentRect,
      };

      if (editorRef.current?.setPointerCapture) {
        try {
          editorRef.current.setPointerCapture(e.pointerId);
        } catch {}
      }
      return;
    }

    // If editing text, don't start drag
    if (target?.isContentEditable || target?.closest?.('[contenteditable="true"]')) return;

    const shape = isEditableText(target) ? target : findEditableShape(target);
    if (!shape) return;

    e.preventDefault();
    e.stopPropagation();

    const scale = getScale();
    const computed = window.getComputedStyle(shape);
    const isAbsolute = computed.position === 'absolute' || computed.position === 'fixed';
    const mode = 'move';

    // Select the shape on pointer down
    if (selectedElement) {
      selectedElement.contentEditable = 'false';
      selectedElement.classList.remove('editing');
      setSelectedElement(null);
    }
    if (selectedShape && selectedShape !== shape) {
      selectedShape.classList.remove('shape-editing');
      selectedShape.removeAttribute('data-edit-mode');
    }
    shape.classList.add('shape-editing');
    shape.setAttribute('data-edit-mode', mode);
    setSelectedShape(shape);
    updateResizeHandle(shape);

    const rect = shape.getBoundingClientRect();
    const parent = shape.offsetParent || shape.parentElement;
    const parentRect = parent?.getBoundingClientRect() || rect;

    const startLeft = parseFloat(shape.style.left) || (rect.left - parentRect.left) / scale;
    const startTop = parseFloat(shape.style.top) || (rect.top - parentRect.top) / scale;
    const startW = rect.width / scale;
    const startH = rect.height / scale;
    const ratio = startW > 0 ? startH / startW : 1;

    dragStateRef.current = {
      shape,
      mode,
      handleId: 'br',
      scale,
      startX: e.clientX,
      startY: e.clientY,
      startLeft,
      startTop,
      startW,
      startH,
      ratio,
      canMove: false,
      pending: true,
      didMove: false,
      parentRect,
    };

    // Capture pointer on the editor container
    if (editorRef.current?.setPointerCapture) {
      try {
        editorRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }
  }, [isEditableText, findEditableShape, getScale, selectedElement, selectedShape, updateResizeHandle]);

  const handlePointerMove = useCallback((e) => {
    const state = dragStateRef.current;
    if (!state) return;

    const { shape, mode, handleId, scale, startX, startY, startLeft, startTop, startW, startH, ratio } = state;

    const dx = (e.clientX - startX) / scale;
    const dy = (e.clientY - startY) / scale;

    if (mode === 'move') {
      if (state.pending) {
        const dist = Math.hypot(dx, dy);
        if (dist < 3) return;
        state.pending = false;
        state.canMove = true;
        state.didMove = true;
        // Switch to absolute positioning when drag starts
        const computed = window.getComputedStyle(shape);
        if (computed.position !== 'absolute' && computed.position !== 'fixed') {
          shape.style.position = 'absolute';
          shape.style.left = `${startLeft}px`;
          shape.style.top = `${startTop}px`;
          shape.style.width = `${startW}px`;
          shape.style.height = `${startH}px`;
          shape.style.margin = '0';
        }
      }
      shape.style.position = 'absolute';
      shape.style.left = `${startLeft + dx}px`;
      shape.style.top = `${startTop + dy}px`;
    } else if (mode === 'resize') {
      let nextW = startW;
      let nextH = startH;
      let nextLeft = startLeft;
      let nextTop = startTop;

      // Corner handles
      if (handleId === 'br') {
        nextW = startW + dx;
        nextH = startH + dy;
      } else if (handleId === 'tr') {
        nextW = startW + dx;
        nextH = startH - dy;
        nextTop = startTop + dy;
      } else if (handleId === 'bl') {
        nextW = startW - dx;
        nextH = startH + dy;
        nextLeft = startLeft + dx;
      } else if (handleId === 'tl') {
        nextW = startW - dx;
        nextH = startH - dy;
        nextLeft = startLeft + dx;
        nextTop = startTop + dy;
      }
      // Edge handles
      else if (handleId === 't') {
        nextH = startH - dy;
        nextTop = startTop + dy;
      } else if (handleId === 'b') {
        nextH = startH + dy;
      } else if (handleId === 'l') {
        nextW = startW - dx;
        nextLeft = startLeft + dx;
      } else if (handleId === 'r') {
        nextW = startW + dx;
      }

      nextW = Math.max(20, nextW);
      nextH = Math.max(20, nextH);

      state.didMove = true;

      if (e.shiftKey && ratio > 0) {
        const ratioWidth = nextH / ratio;
        const ratioHeight = nextW * ratio;
        if (Math.abs(ratioWidth - nextW) < Math.abs(ratioHeight - nextH)) {
          nextW = ratioWidth;
        } else {
          nextH = ratioHeight;
        }
      }

      shape.style.width = `${nextW}px`;
      shape.style.height = `${nextH}px`;
      shape.style.left = `${nextLeft}px`;
      shape.style.top = `${nextTop}px`;
    }

    // Update resize handle position
    updateResizeHandle(shape);
  }, [updateResizeHandle]);

  const handlePointerUp = useCallback((e) => {
    const hadDrag = Boolean(dragStateRef.current?.didMove);
    dragStateRef.current = null;

    if (editorRef.current?.releasePointerCapture) {
      try {
        editorRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (hadDrag) {
      commitSlideHtml();
    }
  }, [commitSlideHtml]);

  // Handle blur to save text changes
  const handleBlur = useCallback((e) => {
    const target = e.target;
    if (target.contentEditable === 'true') {
      // Delay to allow for click on another element
      setTimeout(() => {
        if (document.activeElement !== target) {
          target.contentEditable = 'false';
          target.classList.remove('editing');
          commitSlideHtml();
          setSelectedElement(null);
        }
      }, 100);
    }
  }, [commitSlideHtml]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept keys when user is typing in chart editor or other inputs
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        clearSelection();
      }

      // Delete selected shape
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShape && !selectedElement) {
        e.preventDefault();
        selectedShape.remove();
        setSelectedShape(null);
        setResizeHandles([]);
        commitSlideHtml();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, selectedShape, clearSelection, commitSlideHtml]);

  // Loading state
  if (loading) {
    return (
      <div className="agentic-slide-editor agentic-slide-editor--loading">
        <div className="agentic-slide-editor__loader">
          <div className="agentic-slide-editor__spinner" />
          <span>Loading slide...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="agentic-slide-editor agentic-slide-editor--error">
        <div className="agentic-slide-editor__error">
          <span>Failed to load slide</span>
          <small>{error}</small>
        </div>
      </div>
    );
  }

  // Empty state
  if (!currentSlideHtml) {
    return (
      <div className="agentic-slide-editor agentic-slide-editor--empty">
        No slide content to display
      </div>
    );
  }

  return (
    <div
      ref={editorRef}
      className="agentic-slide-editor"
      onDoubleClick={handleDoubleClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {cssContent && <style>{cssContent}</style>}

      <style>{`
        .agentic-slide-editor {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
          isolation: isolate;
          background: transparent;
          padding: 0;
          box-sizing: border-box;
        }

        .agentic-slide-editor .deck {
          max-width: none;
          margin: 0;
          padding: 0;
        }

        .agentic-slide-editor .slide {
          margin: 0 !important;
          border-radius: 8px;
        }

        .agentic-slide-editor--loading,
        .agentic-slide-editor--error,
        .agentic-slide-editor--empty {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          min-height: 300px;
        }

        .agentic-slide-editor--error {
          color: #ef4444;
        }

        .agentic-slide-editor__loader {
          text-align: center;
        }

        .agentic-slide-editor__spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #1e293b;
          border-top-color: #a855f7;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 8px;
        }

        .agentic-slide-editor__error {
          text-align: center;
        }

        .agentic-slide-editor__error small {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
          font-size: 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Content wrapper */
        .agentic-slide-content {
          position: relative;
          flex-shrink: 0;
          background: transparent;
          border-radius: 8px;
          display: block !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden;
        }

        .agentic-slide-canvas {
          width: ${BASE_CANVAS_WIDTH}px;
          height: ${BASE_CANVAS_HEIGHT}px;
          min-width: ${BASE_CANVAS_WIDTH}px;
          min-height: ${BASE_CANVAS_HEIGHT}px;
          position: relative;
          display: block !important;
          margin: 0 !important;
          padding: 0 !important;
          left: 0 !important;
          top: 0 !important;
          transform-origin: top left;
          overflow: hidden;
        }

        .agentic-slide-canvas > .slide {
          width: ${BASE_CANVAS_WIDTH}px !important;
          height: ${BASE_CANVAS_HEIGHT}px !important;
          min-width: ${BASE_CANVAS_WIDTH}px !important;
          min-height: ${BASE_CANVAS_HEIGHT}px !important;
          margin: 0 !important;
          position: relative !important;
          left: 0 !important;
          top: 0 !important;
          right: auto !important;
          bottom: auto !important;
          float: none !important;
          transform: none !important;
        }

        .agentic-slide-content .slide {
          box-sizing: border-box;
          margin: 0 !important;
          border-radius: 8px;
          overflow: hidden;
        }

        /* Make all elements interactive */
        .agentic-slide-content * {
          pointer-events: auto;
        }

        /* Text elements - show they are editable */
        .agentic-slide-content h1,
        .agentic-slide-content h2,
        .agentic-slide-content h3,
        .agentic-slide-content h4,
        .agentic-slide-content h5,
        .agentic-slide-content h6,
        .agentic-slide-content p,
        .agentic-slide-content span,
        .agentic-slide-content li,
        .agentic-slide-content td,
        .agentic-slide-content th,
        .agentic-slide-content label {
          cursor: text;
          transition: outline 0.15s ease, background 0.15s ease;
          border-radius: 2px;
        }

        .agentic-slide-content h1:hover,
        .agentic-slide-content h2:hover,
        .agentic-slide-content h3:hover,
        .agentic-slide-content h4:hover,
        .agentic-slide-content h5:hover,
        .agentic-slide-content h6:hover,
        .agentic-slide-content p:hover,
        .agentic-slide-content li:hover,
        .agentic-slide-content td:hover,
        .agentic-slide-content th:hover {
          outline: 2px solid rgba(59, 130, 246, 0.4);
          outline-offset: 2px;
        }

        /* Editing state for text */
        .agentic-slide-content .editing {
          outline: 2px solid #22c55e !important;
          outline-offset: 2px;
          background: rgba(34, 197, 94, 0.08) !important;
          cursor: text !important;
        }

        .agentic-slide-content [contenteditable="true"]:focus {
          outline: 2px solid #22c55e !important;
          outline-offset: 2px;
        }

        /* Shape elements */
        .agentic-slide-content svg,
        .agentic-slide-content img,
        .agentic-slide-content canvas,
        .agentic-slide-content .icon,
        .agentic-slide-content .icon-circle,
        .agentic-slide-content .chart-container,
        .agentic-slide-content .feature-card,
        .agentic-slide-content .glow-card,
        .agentic-slide-content .metric,
        .agentic-slide-content .metric-item,
        .agentic-slide-content .agentic-metric,
        .agentic-slide-content .problem-card,
        .agentic-slide-content .split-panel,
        .agentic-slide-content .team-card,
        .agentic-slide-content .quote-card,
        .agentic-slide-content .card,
        .agentic-slide-content .stat-card,
        .agentic-slide-content .metric-card,
        .agentic-slide-content .kpi-card,
        .agentic-slide-content .panel {
          cursor: pointer;
          transition: outline 0.15s ease;
        }

        .agentic-slide-content svg:hover,
        .agentic-slide-content img:hover,
        .agentic-slide-content canvas:hover,
        .agentic-slide-content .icon:hover,
        .agentic-slide-content .chart-container:hover,
        .agentic-slide-content .feature-card:hover,
        .agentic-slide-content .glow-card:hover,
        .agentic-slide-content .metric:hover,
        .agentic-slide-content .metric-item:hover,
        .agentic-slide-content .agentic-metric:hover,
        .agentic-slide-content .problem-card:hover,
        .agentic-slide-content .split-panel:hover,
        .agentic-slide-content .team-card:hover,
        .agentic-slide-content .quote-card:hover,
        .agentic-slide-content .card:hover,
        .agentic-slide-content .stat-card:hover,
        .agentic-slide-content .metric-card:hover,
        .agentic-slide-content .kpi-card:hover,
        .agentic-slide-content .panel:hover {
          outline: 2px solid rgba(245, 158, 11, 0.5);
          outline-offset: 2px;
        }

        .agentic-slide-content .image-box {
          border: 2px dashed rgba(99, 102, 241, 0.6);
          background: rgba(99, 102, 241, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4f46e5;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .agentic-slide-content .image-box__label {
          pointer-events: none;
        }

        .agentic-slide-content .chart-slot--rendered::before {
          display: none !important;
        }

        .agentic-slide-content .chart-slot--rendered {
          background: transparent !important;
        }

        .agentic-slide-content .chart-slot--rendered canvas {
          position: relative !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
        }

        /* Selected shape */
        .agentic-slide-content .shape-editing {
          outline: 2px solid #f59e0b !important;
          outline-offset: 2px;
          cursor: move !important;
        }

        /* Resize handle */
        .agentic-resize-handle {
          position: absolute;
          width: 16px;
          height: 16px;
          background: #f59e0b;
          border: 3px solid white;
          border-radius: 4px;
          z-index: 30;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          pointer-events: auto;
          touch-action: none;
        }

        .agentic-resize-handle:hover {
          background: #ea580c;
          transform: scale(1.3);
        }

        .agentic-resize-handle:active {
          background: #c2410c;
          transform: scale(1.1);
        }

        /* Chart editor panel */
        .chart-editor-overlay {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 5000;
          pointer-events: none;
        }

        .chart-editor-toggle {
          position: relative;
          z-index: 5001;
          pointer-events: auto;
          background: #1e293b;
          color: #e2e8f0;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }
        .chart-editor-toggle:hover {
          background: #334155;
        }

        .chart-editor-panel {
          position: absolute;
          top: 40px;
          right: 0;
          z-index: 5002;
          pointer-events: auto;
          width: 340px;
          max-height: 360px;
          background: #1e293b;
          color: #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.4);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .chart-editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid #334155;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .chart-editor-save {
          background: #22c55e;
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .chart-editor-save:hover { background: #16a34a; }

        .chart-editor-body {
          overflow-y: auto;
          padding: 8px 12px 12px;
          flex: 1;
        }

        .chart-editor-section {
          margin-bottom: 10px;
        }
        .chart-editor-section:last-child {
          margin-bottom: 0;
        }

        .chart-editor-type {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #94a3b8;
          margin-bottom: 6px;
        }

        .chart-editor-group-label {
          font-size: 11px;
          color: #a78bfa;
          font-weight: 600;
          margin: 6px 0 4px;
        }

        .chart-editor-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
        }

        .chart-editor-cell {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .chart-editor-cell-label {
          font-size: 9px;
          color: #64748b;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }

        .chart-editor-input {
          width: 100%;
          background: #0f172a;
          color: #e2e8f0;
          border: 1px solid #334155;
          border-radius: 4px;
          padding: 4px 6px;
          font-size: 12px;
          font-family: inherit;
          box-sizing: border-box;
        }
        .chart-editor-input:focus {
          outline: none;
          border-color: #a78bfa;
        }
        .chart-editor-input--wide {
          grid-column: 1 / -1;
        }
      `}</style>

      {/* Render the HTML content */}
      <div
        ref={containerRef}
        className="agentic-slide-content"
        onClick={handleClick}
        onBlur={handleBlur}
        onPointerDown={handlePointerDown}
        dangerouslySetInnerHTML={{ __html: `<div class="agentic-slide-canvas">${currentSlideHtml}</div>` }}
      />

      {/* Resize handles for selected shape */}
      {resizeHandles.length > 0 && selectedShape && (
        <div
          ref={resizeHandleRef}
          className="resize-handles-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 29,
          }}
        >
          {resizeHandles.map((handle) => (
            <div
              key={handle.id}
              data-resize-handle={handle.id}
              className="agentic-resize-handle"
              style={{
                position: 'absolute',
                left: handle.left,
                top: handle.top,
                cursor: handle.cursor || 'nwse-resize',
                pointerEvents: 'auto',
              }}
              onPointerDown={handlePointerDown}
            />
          ))}
        </div>
      )}

      {/* Chart data editor (fixed overlay to avoid layout jump) */}
      {enableChartDataEditor && (
        <div
          className="chart-editor-overlay"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {showChartEditorToggle && (
            <button
              className="chart-editor-toggle"
              onClick={(e) => { e.stopPropagation(); setChartEditorOpenState(prev => !prev); }}
              disabled={!currentSlideCharts.length}
              title={!currentSlideCharts.length ? 'No charts found on this slide' : 'Edit chart data'}
              style={!currentSlideCharts.length ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="12" width="4" height="9" rx="1" />
                <rect x="10" y="6" width="4" height="15" rx="1" />
                <rect x="17" y="3" width="4" height="18" rx="1" />
              </svg>
              {chartEditorOpenState ? 'Close chart editor' : 'Edit chart data'}
            </button>
          )}

          {chartEditorOpenState && (
            <div className="chart-editor-panel">
              <div className="chart-editor-header">
                <span>Chart Data Editor</span>
                <button className="chart-editor-save" onClick={persistChartConfigs}>
                  Save to HTML
                </button>
              </div>
              <div className="chart-editor-body">
                {currentSlideCharts.length === 0 && (
                  <div className="chart-editor-section">
                    <div className="chart-editor-type">No charts detected</div>
                    <div className="chart-editor-group-label">
                      This slide has no `data-chart-id` slots.
                    </div>
                  </div>
                )}
                {currentSlideCharts.map(chart => {
                  const data = chart.config?.data;
                  if (!data) return null;
                  const labels = data.labels || [];
                  const datasets = data.datasets || [];

                  return (
                    <div key={chart.id} className="chart-editor-section">
                      <div className="chart-editor-type">
                        {chart.config.type || 'chart'} &mdash; {chart.id}
                      </div>

                      <div className="chart-editor-group-label">Labels</div>
                      <div className="chart-editor-grid">
                        {labels.map((lbl, i) => (
                          <div key={i} className="chart-editor-cell">
                            <span className="chart-editor-cell-label">#{i + 1}</span>
                            <input
                              className="chart-editor-input"
                              value={lbl}
                              onChange={e =>
                                handleChartDataChange(chart.id, { type: 'label', index: i }, e.target.value)
                              }
                            />
                          </div>
                        ))}
                      </div>

                      {datasets.map((ds, di) => (
                        <div key={di}>
                          <div className="chart-editor-group-label">
                            <input
                              className="chart-editor-input chart-editor-input--wide"
                              value={ds.label || ''}
                              placeholder="Dataset name"
                              onChange={e =>
                                handleChartDataChange(chart.id, { type: 'datasetLabel', datasetIndex: di }, e.target.value)
                              }
                            />
                          </div>
                          <div className="chart-editor-grid">
                            {(ds.data || []).map((val, vi) => (
                              <div key={vi} className="chart-editor-cell">
                                <span className="chart-editor-cell-label">
                                  {labels[vi] || `#${vi + 1}`}
                                </span>
                                <input
                                  className="chart-editor-input"
                                  type="number"
                                  value={val}
                                  onChange={e =>
                                    handleChartDataChange(chart.id, { type: 'datapoint', datasetIndex: di, index: vi }, e.target.value)
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgenticSlideEditor;
