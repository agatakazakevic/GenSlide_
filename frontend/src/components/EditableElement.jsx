import React, { useState, useRef, useEffect, useCallback } from 'react';
import { sanitizeContent } from '../utils/agenticHtmlParser';

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * EditableElement - Makes agentic slide elements editable and resizable
 * Supports:
 * - Text editing (contenteditable for h1-h4, p, span, li)
 * - Drag to move
 * - Resize handles for SVG/containers
 */
const EditableElement = ({
  element,
  isSelected,
  onSelect,
  onContentChange,
  onStyleChange,
  containerRef,
}) => {
  const elementRef = useRef(null);
  const dragStateRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [localStyle, setLocalStyle] = useState(element.style || {});
  const localStyleRef = useRef(element.style || {});

  // Sync style from props
  useEffect(() => {
    setLocalStyle(element.style || {});
    localStyleRef.current = element.style || {};
  }, [element.style]);

  // Handle text editing
  const handleBlur = useCallback((e) => {
    setIsEditing(false);
    if (element.isEditable) {
      const newContent = sanitizeContent(e.target.innerHTML);
      if (newContent !== element.content) {
        onContentChange(newContent);
      }
    }
  }, [element.content, element.isEditable, onContentChange]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onSelect();

    // Single click enables editing for text elements
    if (element.isEditable && isSelected) {
      setIsEditing(true);
      // Focus and place cursor at end
      setTimeout(() => {
        if (elementRef.current) {
          elementRef.current.focus();
          const range = document.createRange();
          range.selectNodeContents(elementRef.current);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 0);
    }
  }, [element.isEditable, isSelected, onSelect]);

  // Drag/resize logic (adapted from DraggableImageBox)
  useEffect(() => {
    if (!element.isDraggable && !element.isResizable) return;

    const applyDelta = (clientX, clientY) => {
      if (!dragStateRef.current) return;
      const { mode, startStyle, bounds, startLeftPx, startTopPx } = dragStateRef.current;
      const dxPx = clientX - startLeftPx;
      const dyPx = clientY - startTopPx;

      // Parse current position (handle px, %, or unitless)
      const parseValue = (val, containerSize) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (val.endsWith('%')) return (parseFloat(val) / 100) * containerSize;
        return parseFloat(val) || 0;
      };

      const startX = parseValue(startStyle.left, bounds.width);
      const startY = parseValue(startStyle.top, bounds.height);
      const startW = parseValue(startStyle.width, bounds.width) || 100;
      const startH = parseValue(startStyle.height, bounds.height) || 100;

      let newStyle = { ...localStyleRef.current };

      if (mode === 'move') {
        const nextX = startX + dxPx;
        const nextY = startY + dyPx;
        newStyle.left = `${nextX}px`;
        newStyle.top = `${nextY}px`;
      }

      if (mode === 'resize') {
        const minSize = 30;
        const nextW = clamp(startW + dxPx, minSize, bounds.width);
        const nextH = clamp(startH + dyPx, minSize, bounds.height);
        newStyle.width = `${nextW}px`;
        newStyle.height = `${nextH}px`;
      }

      localStyleRef.current = newStyle;
      setLocalStyle(newStyle);
    };

    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      applyDelta(clientX, clientY);
    };

    const handleUp = () => {
      if (dragStateRef.current) {
        onStyleChange(localStyleRef.current);
        dragStateRef.current = null;
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [element.isDraggable, element.isResizable, onStyleChange]);

  const startDrag = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing) return;

    const bounds = containerRef?.current?.getBoundingClientRect() ||
      elementRef.current?.offsetParent?.getBoundingClientRect() ||
      { width: 1200, height: 675 };

    dragStateRef.current = {
      mode,
      startLeftPx: e.clientX,
      startTopPx: e.clientY,
      startStyle: { ...localStyleRef.current },
      bounds,
    };

    if (e.pointerId) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };

  // Convert React-style object to inline style string for dangerouslySetInnerHTML
  const styleToInline = (styleObj) => {
    return Object.entries(styleObj)
      .map(([key, value]) => {
        const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${kebab}: ${value}`;
      })
      .join('; ');
  };

  // Render based on element type
  const renderContent = () => {
    const { tagName, className, content, elementType, attributes, children } = element;

    // Base classes for editing states
    const editableClasses = [
      'editable-element',
      isSelected ? 'selected' : '',
      isEditing ? 'editing' : '',
    ].filter(Boolean).join(' ');

    const combinedClassName = `${className} ${editableClasses}`.trim();

    // Style object for React
    const reactStyle = { ...localStyle };

    // For SVG elements, render as-is with a wrapper
    if (elementType === 'svg') {
      return (
        <div
          ref={elementRef}
          className={`editable-element svg-wrapper ${isSelected ? 'selected' : ''}`}
          style={{ ...reactStyle, position: reactStyle.position || 'relative' }}
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    // For text elements, use contentEditable
    if (elementType === 'text') {
      const Tag = tagName;
      return (
        <Tag
          ref={elementRef}
          className={combinedClassName}
          style={reactStyle}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onClick={handleClick}
          onBlur={handleBlur}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    // For containers, render as div with children handled externally
    return (
      <div
        ref={elementRef}
        className={combinedClassName}
        style={reactStyle}
        onClick={handleClick}
        data-element-id={element.id}
      />
    );
  };

  // Render resize handles when selected and resizable
  const renderHandles = () => {
    if (!isSelected || !element.isResizable) return null;

    return (
      <>
        {/* Move handle at top */}
        {element.isDraggable && (
          <div
            className="drag-handle"
            onPointerDown={(e) => startDrag(e, 'move')}
            style={{ touchAction: 'none' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>
            </svg>
          </div>
        )}

        {/* Resize handles at corners */}
        <div
          className="resize-handle corner-se"
          onPointerDown={(e) => startDrag(e, 'resize')}
          style={{ touchAction: 'none' }}
        />
        <div
          className="resize-handle corner-sw"
          onPointerDown={(e) => startDrag(e, 'resize')}
          style={{ touchAction: 'none' }}
        />
        <div
          className="resize-handle corner-ne"
          onPointerDown={(e) => startDrag(e, 'resize')}
          style={{ touchAction: 'none' }}
        />
        <div
          className="resize-handle corner-nw"
          onPointerDown={(e) => startDrag(e, 'resize')}
          style={{ touchAction: 'none' }}
        />
      </>
    );
  };

  return (
    <div className="editable-element-wrapper" style={{ position: 'relative', display: 'contents' }}>
      {renderContent()}
      {renderHandles()}
    </div>
  );
};

export default EditableElement;
