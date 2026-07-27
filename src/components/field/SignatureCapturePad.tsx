'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SignatureCapturePadProps = {
  disabled?: boolean;
  onChange: (signatureData: string | null, isEmpty: boolean) => void;
};

type Point = {
  x: number;
  y: number;
};

const CANVAS_HEIGHT = 200;

export function SignatureCapturePad({ disabled = false, onChange }: SignatureCapturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const onChangeRef = useRef(onChange);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const configureCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = getContext();
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(320, Math.min(600, Math.round(rect.width || 600)));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(CANVAS_HEIGHT * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, CANVAS_HEIGHT);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 3;
    const inkColor = window.getComputedStyle(canvas).color || 'white';
    context.strokeStyle = inkColor;
    context.fillStyle = inkColor;

    drawingRef.current = false;
    hasInkRef.current = false;
    lastPointRef.current = null;
    setHasInk(false);
    onChangeRef.current(null, true);
  }, [getContext]);

  useEffect(() => {
    configureCanvas();
    window.addEventListener('resize', configureCanvas);
    return () => window.removeEventListener('resize', configureCanvas);
  }, [configureCanvas]);

  const getPoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const markChanged = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInkRef.current) {
      onChangeRef.current(null, true);
      return;
    }
    onChangeRef.current(canvas.toDataURL('image/png'), false);
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (disabled || !event.isPrimary) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const context = getContext();
      const point = getPoint(event);
      if (!context || !point) return;

      drawingRef.current = true;
      hasInkRef.current = true;
      lastPointRef.current = point;
      context.beginPath();
      context.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
      context.fill();
      setHasInk(true);
    },
    [disabled, getContext, getPoint],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (disabled || !drawingRef.current || !event.isPrimary) return;
      event.preventDefault();
      const context = getContext();
      const point = getPoint(event);
      const lastPoint = lastPointRef.current;
      if (!context || !point || !lastPoint) return;

      context.beginPath();
      context.moveTo(lastPoint.x, lastPoint.y);
      context.lineTo(point.x, point.y);
      context.stroke();
      lastPointRef.current = point;
    },
    [disabled, getContext, getPoint],
  );

  const finishStroke = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || !drawingRef.current || !event.isPrimary) return;
    event.preventDefault();
    drawingRef.current = false;
    lastPointRef.current = null;
    markChanged();
  }, [disabled, markChanged]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const context = getContext();
    if (!canvas || !context || disabled) return;
    const rect = canvas.getBoundingClientRect();
    context.clearRect(0, 0, rect.width || 600, CANVAS_HEIGHT);
    drawingRef.current = false;
    hasInkRef.current = false;
    lastPointRef.current = null;
    setHasInk(false);
    onChangeRef.current(null, true);
  }, [disabled, getContext]);

  const preventTouchScroll = useCallback((event: ReactTouchEvent<HTMLCanvasElement>) => {
    if (!disabled) event.preventDefault();
  }, [disabled]);

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="h-[200px] w-full max-w-[600px] touch-none rounded-xl border border-surface-border bg-surface-base text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
        aria-label="Sign here"
        role="img"
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
        onTouchStart={preventTouchScroll}
        onTouchMove={preventTouchScroll}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-10 border-surface-border bg-surface-card text-text-secondary hover:text-text-primary"
        onClick={handleClear}
        disabled={disabled || !hasInk}
      >
        <Eraser className="h-4 w-4" />
        Clear
      </Button>
    </div>
  );
}
