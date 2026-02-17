import React, { useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Text, Group } from "react-konva";

// Herramientas disponibles
const TOOL = {
  SELECT: "select",
  LINE: "line",
  CIRCLE: "circle",
  FREE: "free",
  TEXT: "text",
  DISTANCE: "distance",
  ANGLE: "angle",
  SCALE: "scale"
};

function AnnotationCanvas({ imageUrl, width, height, onChangeScale }) {
  const [tool, setTool] = useState(TOOL.SELECT);
  const [annotations, setAnnotations] = useState([]);
  const [drawing, setDrawing] = useState(null);
  const [scalePx, setScalePx] = useState(null); // px que equivalen a 22cm
  const [selectedId, setSelectedId] = useState(null);
  const [textInput, setTextInput] = useState("");
  const stageRef = useRef();

  // Manejo de click para cada herramienta
  const handleStageMouseDown = (e) => {
    const pos = e.target.getStage().getPointerPosition();
    if (tool === TOOL.LINE || tool === TOOL.DISTANCE) {
      setDrawing({ type: tool, points: [pos.x, pos.y, pos.x, pos.y] });
    } else if (tool === TOOL.CIRCLE) {
      setDrawing({ type: tool, x: pos.x, y: pos.y, radius: 1 });
    } else if (tool === TOOL.FREE) {
      setDrawing({ type: tool, points: [pos.x, pos.y] });
    } else if (tool === TOOL.TEXT) {
      setAnnotations([...annotations, { type: "text", x: pos.x, y: pos.y, text: textInput }]);
      setTextInput("");
    } else if (tool === TOOL.SCALE) {
      // Marcar dos puntos sobre el balón para calibrar escala
      if (!drawing) {
        setDrawing({ type: "scale", points: [pos.x, pos.y] });
      } else {
        const [x1, y1] = drawing.points;
        const dist = Math.sqrt((pos.x - x1) ** 2 + (pos.y - y1) ** 2);
        setScalePx(dist);
        setDrawing(null);
        if (onChangeScale) onChangeScale(dist);
      }
    } else if (tool === TOOL.ANGLE) {
      // Selección de 3 puntos
      if (!drawing) {
        setDrawing({ type: "angle", points: [pos.x, pos.y] });
      } else if (drawing.points.length === 2) {
        setDrawing({ ...drawing, points: [...drawing.points, pos.x, pos.y] });
      } else if (drawing.points.length === 4) {
        setDrawing({ ...drawing, points: [...drawing.points, pos.x, pos.y] });
        // Guardar ángulo
        setAnnotations([
          ...annotations,
          { type: "angle", points: [...drawing.points, pos.x, pos.y] }
        ]);
        setDrawing(null);
      } else {
        setDrawing({ ...drawing, points: [...drawing.points, pos.x, pos.y] });
      }
    }
  };

  const handleStageMouseMove = (e) => {
    if (!drawing) return;
    const pos = e.target.getStage().getPointerPosition();
    if (drawing.type === TOOL.LINE || drawing.type === TOOL.DISTANCE) {
      setDrawing({ ...drawing, points: [drawing.points[0], drawing.points[1], pos.x, pos.y] });
    } else if (drawing.type === TOOL.CIRCLE) {
      const dx = pos.x - drawing.x;
      const dy = pos.y - drawing.y;
      setDrawing({ ...drawing, radius: Math.sqrt(dx * dx + dy * dy) });
    } else if (drawing.type === TOOL.FREE) {
      setDrawing({ ...drawing, points: [...drawing.points, pos.x, pos.y] });
    }
  };

  const handleStageMouseUp = () => {
    if (!drawing) return;
    setAnnotations([...annotations, drawing]);
    setDrawing(null);
  };

  // Medición de distancia en cm
  const getDistanceCm = (points) => {
    if (!scalePx) return null;
    const [x1, y1, x2, y2] = points;
    const px = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    return ((px / scalePx) * 22).toFixed(1); // 22cm balón
  };

  // Medición de ángulo
  const getAngle = (pts) => {
    if (pts.length < 6) return null;
    const [x1, y1, x2, y2, x3, y3] = pts;
    const a = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const b = Math.sqrt((x2 - x3) ** 2 + (y2 - y3) ** 2);
    const c = Math.sqrt((x3 - x1) ** 2 + (y3 - y1) ** 2);
    // Ley de cosenos
    const angle = Math.acos((a * a + b * b - c * c) / (2 * a * b));
    return (angle * (180 / Math.PI)).toFixed(1);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => setTool(TOOL.SELECT)}>Seleccionar</button>
        <button onClick={() => setTool(TOOL.LINE)}>Línea</button>
        <button onClick={() => setTool(TOOL.CIRCLE)}>Círculo</button>
        <button onClick={() => setTool(TOOL.FREE)}>Libre</button>
        <button onClick={() => setTool(TOOL.TEXT)}>Texto</button>
        <button onClick={() => setTool(TOOL.DISTANCE)}>Distancia</button>
        <button onClick={() => setTool(TOOL.ANGLE)}>Ángulo</button>
        <button onClick={() => setTool(TOOL.SCALE)}>Calibrar balón</button>
        <input
          type="text"
          placeholder="Texto..."
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <span className="text-xs text-gray-500">(Primero calibrar balón para medición real)</span>
      </div>
      <div style={{ position: "relative", width, height }}>
        <img src={imageUrl} alt="anotable" style={{ width, height, display: "block" }} />
        <Stage
          width={width}
          height={height}
          ref={stageRef}
          style={{ position: "absolute", top: 0, left: 0 }}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
        >
          <Layer>
            {annotations.map((ann, i) => {
              if (ann.type === "line" || ann.type === "distance") {
                return (
                  <Group key={i}>
                    <Line
                      points={ann.points}
                      stroke={ann.type === "distance" ? "red" : "blue"}
                      strokeWidth={2}
                      lineCap="round"
                    />
                    {ann.type === "distance" && scalePx && (
                      <Text
                        x={(ann.points[0] + ann.points[2]) / 2}
                        y={(ann.points[1] + ann.points[3]) / 2}
                        text={getDistanceCm(ann.points) + " cm"}
                        fontSize={16}
                        fill="red"
                        fontStyle="bold"
                      />
                    )}
                  </Group>
                );
              }
              if (ann.type === "circle") {
                return <Circle key={i} x={ann.x} y={ann.y} radius={ann.radius} stroke="green" strokeWidth={2} />;
              }
              if (ann.type === "free") {
                return <Line key={i} points={ann.points} stroke="purple" strokeWidth={2} lineCap="round" tension={0.5} />;
              }
              if (ann.type === "text") {
                return <Text key={i} x={ann.x} y={ann.y} text={ann.text} fontSize={18} fill="black" />;
              }
              if (ann.type === "angle") {
                return (
                  <Group key={i}>
                    <Line points={ann.points} stroke="orange" strokeWidth={2} />
                    {getAngle(ann.points) && (
                      <Text
                        x={ann.points[2]}
                        y={ann.points[3]}
                        text={getAngle(ann.points) + "°"}
                        fontSize={16}
                        fill="orange"
                        fontStyle="bold"
                      />
                    )}
                  </Group>
                );
              }
              return null;
            })}
            {drawing && drawing.type !== "text" && drawing.type !== "angle" && (
              drawing.type === "circle" ? (
                <Circle x={drawing.x} y={drawing.y} radius={drawing.radius} stroke="gray" strokeWidth={2} />
              ) : (
                <Line points={drawing.points} stroke="gray" strokeWidth={2} lineCap="round" />
              )
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

export default AnnotationCanvas;

