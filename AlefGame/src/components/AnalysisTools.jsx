
import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Ruler, Move, Circle, LineChart } from 'lucide-react';
import { drawPoint, drawAngle, drawDistance } from "@/lib/video-analysis";

function AnalysisTools({ videoRef }) {
  const canvasRef = useRef(null);
  const [selectedTool, setSelectedTool] = useState(null);
  const [points, setPoints] = useState([]);
  const [measurements, setMeasurements] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Ajustar tamaño del canvas al video
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;

    // Dibujar mediciones existentes
    const ctx = canvas.getContext('2d');
    drawMeasurements(ctx);
  }, [measurements]);

  const drawMeasurements = (ctx) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    measurements.forEach(measurement => {
      switch (measurement.type) {
        case 'angle':
          drawAngle(ctx, measurement.points);
          break;
        case 'distance':
          drawDistance(ctx, measurement.points);
          break;
        case 'point':
          drawPoint(ctx, measurement.point);
          break;
      }
    });
  };

  const handleCanvasClick = (e) => {
    if (!selectedTool) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newPoint = { x, y };

    switch (selectedTool) {
      case 'point':
        setMeasurements([...measurements, {
          type: 'point',
          point: newPoint
        }]);
        break;
      case 'distance':
        if (points.length === 1) {
          setMeasurements([...measurements, {
            type: 'distance',
            points: [...points, newPoint]
          }]);
          setPoints([]);
        } else {
          setPoints([newPoint]);
        }
        break;
      case 'angle':
        if (points.length === 2) {
          setMeasurements([...measurements, {
            type: 'angle',
            points: [...points, newPoint]
          }]);
          setPoints([]);
        } else {
          setPoints([...points, newPoint]);
        }
        break;
    }
  };

  const tools = [
    { id: 'point', icon: Circle, label: 'Punto' },
    { id: 'distance', icon: Ruler, label: 'Distancia' },
    { id: 'angle', icon: LineChart, label: 'Ángulo' },
  ];

  return (
    <div className="absolute top-0 left-0 w-full h-full">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-auto"
        onClick={handleCanvasClick}
      />
      
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-lg p-2 space-y-2"
      >
        {tools.map((tool) => (
          <Button
            key={tool.id}
            size="icon"
            variant={selectedTool === tool.id ? "default" : "ghost"}
            onClick={() => setSelectedTool(tool.id === selectedTool ? null : tool.id)}
            className="relative group"
          >
            <tool.icon className="h-4 w-4" />
            <span className="absolute left-full ml-2 px-2 py-1 bg-background rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {tool.label}
            </span>
          </Button>
        ))}
        
        {measurements.length > 0 && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMeasurements([])}
            className="relative group"
          >
            <Move className="h-4 w-4" />
            <span className="absolute left-full ml-2 px-2 py-1 bg-background rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              Limpiar
            </span>
          </Button>
        )}
      </motion.div>
    </div>
  );
}

export default AnalysisTools;
