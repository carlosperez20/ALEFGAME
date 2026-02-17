
import { useState, useEffect, useRef } from 'react';

// Función para dibujar marcadores y mediciones en el canvas
export function drawAnnotations(ctx, annotations) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  annotations.forEach(annotation => {
    switch (annotation.type) {
      case 'point':
        drawPoint(ctx, annotation);
        break;
      case 'line':
        drawLine(ctx, annotation);
        break;
      case 'angle':
        drawAngle(ctx, annotation);
        break;
      case 'distance':
        drawDistance(ctx, annotation);
        break;
    }
  });
}

// Función para capturar frame actual
export function captureFrame(videoElement) {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0);
  return canvas.toDataURL('image/jpeg');
}

// Función para calcular ángulos entre puntos
export function calculateAngle(p1, p2, p3) {
  const angle = Math.atan2(p3.y - p2.y, p3.x - p2.x) -
                Math.atan2(p1.y - p2.y, p1.x - p2.x);
  return Math.abs((angle * 180) / Math.PI);
}

// Función para calcular distancia entre puntos
export function calculateDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Funciones auxiliares de dibujo
export function drawPoint(ctx, { x, y, color = 'red', size = 5 }) {
  ctx.beginPath();
  ctx.arc(x, y, size, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawLine(ctx, { start, end, color = 'blue', width = 2 }) {
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width * 2;
  ctx.stroke();
}

export function drawAngle(ctx, { p1, p2, p3, color = 'green' }) {
  // Dibuja las líneas
  drawLine(ctx, { start: p1, end: p2, color, width: 4 });
  drawLine(ctx, { start: p2, end: p3, color, width: 4 });
  
  // Dibuja el arco del ángulo
  const angle = calculateAngle(p1, p2, p3);
  ctx.beginPath();
  ctx.arc(p2.x, p2.y, 20, 
    Math.atan2(p1.y - p2.y, p1.x - p2.x),
    Math.atan2(p3.y - p2.y, p3.x - p2.x)
  );
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
  
  // Muestra el valor del ángulo
  ctx.fillStyle = color;
  ctx.fillText(`${Math.round(angle)}°`, p2.x + 25, p2.y + 25);
}

export function drawDistance(ctx, { start, end, color = 'purple' }) {
  drawLine(ctx, { start, end, color });
  const distance = calculateDistance(start, end);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  
  ctx.fillStyle = color;
  ctx.fillText(`${Math.round(distance)}px`, midX, midY - 10);
}

export function useVideoAnalysis(videoRef) {
  const [annotations, setAnnotations] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const tempPointsRef = useRef([]);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    drawAnnotations(ctx, annotations);
  }, [annotations]);

  const handleCanvasClick = (e) => {
    if (!selectedTool) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const point = { x, y };

    switch (selectedTool) {
      case 'point':
        setAnnotations([...annotations, { type: 'point', ...point }]);
        break;
      case 'line':
      case 'distance':
        if (!isDrawing) {
          tempPointsRef.current = [point];
          setIsDrawing(true);
        } else {
          setAnnotations([...annotations, {
            type: selectedTool,
            start: tempPointsRef.current[0],
            end: point
          }]);
          setIsDrawing(false);
          tempPointsRef.current = [];
        }
        break;
      case 'angle':
        tempPointsRef.current.push(point);
        if (tempPointsRef.current.length === 3) {
          setAnnotations([...annotations, {
            type: 'angle',
            p1: tempPointsRef.current[0],
            p2: tempPointsRef.current[1],
            p3: tempPointsRef.current[2]
          }]);
          tempPointsRef.current = [];
        }
        break;
    }
  };

  return {
    canvasRef,
    selectedTool,
    setSelectedTool,
    handleCanvasClick,
    annotations,
    setAnnotations
  };
}
