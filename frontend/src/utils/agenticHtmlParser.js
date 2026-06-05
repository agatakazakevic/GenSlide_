/**
 * Agentic HTML Parser
 * Converts agentic slide HTML into editable element structures and back.
 */

// Elements that should have contenteditable
const TEXT_ELEMENTS = ['h1', 'h2', 'h3', 'h4', 'p', 'span', 'li', 'td', 'th', 'strong', 'em'];

// Elements that should be resizable
const RESIZABLE_ELEMENTS = ['svg', 'img'];

// Container elements that group other elements
const CONTAINER_ELEMENTS = ['div', 'section', 'ul', 'ol', 'table', 'thead', 'tbody', 'tr'];

/**
 * Extract inline styles from a DOM element as an object
 */
function extractStyles(element) {
  const styleObj = {};
  const style = element.getAttribute('style');
  if (!style) return styleObj;

  style.split(';').forEach(rule => {
    const [prop, value] = rule.split(':').map(s => s.trim());
    if (prop && value) {
      // Convert to camelCase for React
      const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      styleObj[camelProp] = value;
    }
  });

  return styleObj;
}

/**
 * Convert style object back to inline style string
 */
function stylesToString(styleObj) {
  return Object.entries(styleObj)
    .map(([key, value]) => {
      // Convert camelCase back to kebab-case
      const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${kebabKey}: ${value}`;
    })
    .join('; ');
}

/**
 * Parse agentic HTML into an array of editable element objects
 */
export function parseAgenticHtml(html) {
  if (!html) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find the agentic canvas or the section
  const canvas = doc.querySelector('.agentic-canvas') || doc.querySelector('section');
  if (!canvas) return [];

  const elements = [];
  let idCounter = 0;

  function processNode(node, parentId = null, depth = 0) {
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const tagName = node.tagName.toLowerCase();
    const isText = TEXT_ELEMENTS.includes(tagName);
    const isResizable = RESIZABLE_ELEMENTS.includes(tagName);
    const isContainer = CONTAINER_ELEMENTS.includes(tagName);

    const el = {
      id: `el-${idCounter++}`,
      tagName,
      className: node.className || '',
      style: extractStyles(node),
      attributes: {},
      content: '',
      children: [],
      parentId,
      depth,
      isEditable: isText,
      isResizable: isResizable || (isContainer && node.querySelector('svg, img')),
      isDraggable: depth <= 2 && (isContainer || isResizable),
    };

    // Copy relevant attributes
    ['id', 'data-chart-id', 'viewBox', 'xmlns', 'fill', 'stroke', 'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height'].forEach(attr => {
      if (node.hasAttribute(attr)) {
        el.attributes[attr] = node.getAttribute(attr);
      }
    });

    // For text elements, get innerHTML
    if (isText) {
      el.content = node.innerHTML;
      el.elementType = 'text';
    } else if (tagName === 'svg') {
      // For SVG, store the entire outerHTML
      el.content = node.outerHTML;
      el.elementType = 'svg';
    } else {
      el.elementType = 'container';
    }

    // Process children (except for SVG which we treat as atomic)
    if (tagName !== 'svg') {
      Array.from(node.children).forEach(child => {
        const childEl = processNode(child, el.id, depth + 1);
        if (childEl) {
          el.children.push(childEl.id);
        }
      });
    }

    elements.push(el);
    return el;
  }

  // Process all direct children of the canvas
  Array.from(canvas.children).forEach(child => {
    processNode(child, null, 0);
  });

  return elements;
}

/**
 * Serialize an array of element objects back to HTML
 */
export function serializeElements(elements) {
  if (!elements || elements.length === 0) return '';

  // Build a map for quick lookup
  const elementMap = {};
  elements.forEach(el => {
    elementMap[el.id] = el;
  });

  // Find root elements (no parent)
  const rootElements = elements.filter(el => el.parentId === null);

  function renderElement(el) {
    const { tagName, className, style, attributes, content, children, elementType } = el;

    // For SVG, return the stored content directly
    if (elementType === 'svg') {
      return content;
    }

    // Build attribute string
    let attrStr = '';
    if (className) {
      attrStr += ` class="${className}"`;
    }
    if (Object.keys(style).length > 0) {
      attrStr += ` style="${stylesToString(style)}"`;
    }
    Object.entries(attributes).forEach(([key, value]) => {
      attrStr += ` ${key}="${value}"`;
    });

    // For text elements, use content
    if (elementType === 'text') {
      return `<${tagName}${attrStr}>${content}</${tagName}>`;
    }

    // For containers, render children
    const childrenHtml = children
      .map(childId => elementMap[childId])
      .filter(Boolean)
      .map(renderElement)
      .join('\n');

    return `<${tagName}${attrStr}>\n${childrenHtml}\n</${tagName}>`;
  }

  const innerHtml = rootElements.map(renderElement).join('\n');

  return `<section class="slide slide--agentic">
  <div class="agentic-canvas">
    ${innerHtml}
  </div>
</section>`;
}

/**
 * Update a specific element in the elements array
 */
export function updateElement(elements, elementId, updates) {
  return elements.map(el => {
    if (el.id === elementId) {
      return { ...el, ...updates };
    }
    return el;
  });
}

/**
 * Update element style
 */
export function updateElementStyle(elements, elementId, styleUpdates) {
  return elements.map(el => {
    if (el.id === elementId) {
      return {
        ...el,
        style: { ...el.style, ...styleUpdates }
      };
    }
    return el;
  });
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeContent(html) {
  // Remove script tags and event handlers
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Remove all script elements
  doc.querySelectorAll('script').forEach(el => el.remove());

  // Remove event handler attributes
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}
