import React, { useEffect, useMemo, useRef, useState } from "react";
import letters from "../data/letters.json";

/**
 * ALEF GAME – Nivel 1 (Vita-like)
 * - Capas superpuestas (z)
 * - Solo fichas libres (no tapadas arriba + al menos un lado libre)
 * - Bandeja de 7. Si intentas meter una 8 → pierdes.
 * - Match de 2: si en bandeja hay 2 iguales → se eliminan de la bandeja.
 * - Al tocar: "foco" (glow) → desaparece del tablero → aparece iluminada en bandeja.
 */

/* ---------------- Helpers ---------------- */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function rectsOverlapAny(r1, r2) {
  return !(
    r2.left >= r1.right ||
    r2.right <= r1.left ||
    r2.top >= r1.bottom ||
    r2.bottom <= r1.top
  );
}

/**
 * Calcula rect base (sin offset visual por z) para bloqueo real.
 * Usamos un pequeño margen para que el "tapado" sea consistente.
 */
function tileRectBase(t, tileW, tileH, zOffsetX, zOffsetY) {
  const pad = Math.max(1, Math.round(tileW * 0.02));
  const left = t.x + t.z * zOffsetX;
  const top = t.y - t.z * zOffsetY;
  return {
    left: left + pad,
    top: top + pad,
    right: left + tileW - pad,
    bottom: top + tileH - pad,
  };
}

/**
 * Regla Vita-like:
 * 1) No tapada por arriba: no puede haber otra ficha con z mayor que se solape.
 * 2) Al menos un lado libre (izq o der) en la misma capa (z):
 *    consideramos vecino si está suficientemente cerca a la izquierda o derecha.
 */
function computeTileStatus(
  aliveTiles,
  tileW,
  tileH,
  zOffsetX,
  zOffsetY,
  sideGapFactor
) {
  const free = new Set();
  const reasonById = new Map();

  // Map tileId -> rect base
  const rectById = new Map();
  for (const t of aliveTiles) {
    rectById.set(t.tileId, tileRectBase(t, tileW, tileH, zOffsetX, zOffsetY));
  }

  // 1) Bloqueo por solape: cualquier solape en capa superior o misma capa
  const blockedFromTop = new Set();
  const blockedSameLayer = new Set();
  for (const t of aliveTiles) {
    const r = rectById.get(t.tileId);
    for (const o of aliveTiles) {
      if (o.tileId === t.tileId) continue;
      const ro = rectById.get(o.tileId);
      if (!rectsOverlapAny(r, ro)) continue;
      if (o.z > t.z) {
        blockedFromTop.add(t.tileId);
        reasonById.set(t.tileId, "blocked:overlap-above");
        break;
      }
      if (o.z === t.z) {
        blockedSameLayer.add(t.tileId);
        reasonById.set(t.tileId, "blocked:overlap-same");
        break;
      }
    }
  }

  // 2) Lados libres en la misma capa
  // Definimos "vecino lateral" si está casi al lado (dentro de un umbral).
  const sameLayer = new Map(); // z -> tiles
  for (const t of aliveTiles) {
    if (!sameLayer.has(t.z)) sameLayer.set(t.z, []);
    sameLayer.get(t.z).push(t);
  }

  const sideGap = tileW * sideGapFactor;

  for (const t of aliveTiles) {
    if (blockedFromTop.has(t.tileId) || blockedSameLayer.has(t.tileId)) continue;

    const layerTiles = sameLayer.get(t.z) || [];
    const rt = rectById.get(t.tileId);

    let hasLeftNeighbor = false;
    let hasRightNeighbor = false;

    for (const o of layerTiles) {
      if (o.tileId === t.tileId) continue;
      const ro = rectById.get(o.tileId);

      // vecino lateral: en misma capa y con solape vertical real
      const verticalOverlap =
        Math.min(rt.bottom, ro.bottom) - Math.max(rt.top, ro.top) > 0;
      if (!verticalOverlap) continue;

      // vecino izquierdo: el borde derecho del otro está cerca del borde izquierdo del actual
      if (ro.right <= rt.left && rt.left - ro.right <= sideGap) {
        hasLeftNeighbor = true;
      }
      // vecino derecho
      if (ro.left >= rt.right && ro.left - rt.right <= sideGap) {
        hasRightNeighbor = true;
      }

      if (hasLeftNeighbor && hasRightNeighbor) break;
    }

    // lado libre si NO hay vecino en al menos uno de los lados
    if (!hasLeftNeighbor || !hasRightNeighbor) {
      free.add(t.tileId);
    } else {
      reasonById.set(t.tileId, "blocked:lateral");
    }
  }

  return { free, reasonById };
}

/* ---------------- Layout ---------------- */

/**
 * Layout de 24 fichas (PAR, siempre).
 * Coordenadas son en px relativos (luego escalamos según tileW/tileH en buildLayout()).
 * z = capa.
 */
function createLayoutPool() {
  // Base original (24) sin solape en la misma capa.
  const base = [
    // z=0 (base) 12
    { gx: 1, gy: 2, z: 0 },
    { gx: 2, gy: 2, z: 0 },
    { gx: 3, gy: 2, z: 0 },
    { gx: 4, gy: 2, z: 0 },
    { gx: 1, gy: 3, z: 0 },
    { gx: 2, gy: 3, z: 0 },
    { gx: 3, gy: 3, z: 0 },
    { gx: 4, gy: 3, z: 0 },
    { gx: 2, gy: 4, z: 0 },
    { gx: 3, gy: 4, z: 0 },
    { gx: 2, gy: 1, z: 0 },
    { gx: 3, gy: 1, z: 0 },
    // z=1 (medio) 8
    { gx: 2, gy: 2, z: 1 },
    { gx: 3, gy: 2, z: 1 },
    { gx: 2, gy: 3, z: 1 },
    { gx: 3, gy: 3, z: 1 },
    { gx: 2, gy: 1, z: 1 },
    { gx: 3, gy: 1, z: 1 },
    { gx: 2, gy: 4, z: 1 },
    { gx: 3, gy: 4, z: 1 },
    // z=2 (top) 4
    { gx: 2, gy: 2, z: 2 },
    { gx: 3, gy: 2, z: 2 },
    { gx: 2, gy: 3, z: 2 },
    { gx: 3, gy: 3, z: 2 },
  ];

  const extras = [
    // z=0 extras (alrededor, sin solape en la misma capa)
    { gx: 0, gy: 2, z: 0 },
    { gx: 5, gy: 2, z: 0 },
    { gx: 0, gy: 3, z: 0 },
    { gx: 5, gy: 3, z: 0 },
    { gx: 1, gy: 0, z: 0 },
    { gx: 4, gy: 0, z: 0 },
    { gx: 1, gy: 5, z: 0 },
    { gx: 4, gy: 5, z: 0 },
    { gx: 2, gy: 0, z: 0 },
    { gx: 3, gy: 0, z: 0 },
    { gx: 2, gy: 5, z: 0 },
    { gx: 3, gy: 5, z: 0 },
    // z=1 extras
    { gx: 1, gy: 2, z: 1 },
    { gx: 4, gy: 2, z: 1 },
    { gx: 1, gy: 3, z: 1 },
    { gx: 4, gy: 3, z: 1 },
    { gx: 2, gy: 0, z: 1 },
    { gx: 3, gy: 0, z: 1 },
    { gx: 2, gy: 5, z: 1 },
    { gx: 3, gy: 5, z: 1 },
    // z=2 extras
    { gx: 2, gy: 1, z: 2 },
    { gx: 3, gy: 1, z: 2 },
    { gx: 2, gy: 4, z: 2 },
    { gx: 3, gy: 4, z: 2 },
    { gx: 1, gy: 2, z: 2 },
    { gx: 4, gy: 2, z: 2 },
    // z=3 extras
    { gx: 2, gy: 2, z: 3 },
    { gx: 3, gy: 2, z: 3 },
  ];

  return [...base, ...extras];
}

/**
 * Convierte grid->px según tileW/tileH para que se vea bien en responsive.
 */
function buildLayout(tileW, tileH, level, tileCount) {
  const pool = createLayoutPool();
  const layout = pool.slice(0, Math.min(tileCount, pool.length));

  // separación horizontal/vertical entre fichas
  // Más separación para reducir solapes excesivos y mantener jugabilidad
  const stepX = tileW * 1.02;
  const stepY = tileH * 1.02;

  // offset para centrar
  // tomamos rango de gx/gy para centrar el tablero
  const gxs = layout.map((p) => p.gx);
  const gys = layout.map((p) => p.gy);
  const minX = Math.min(...gxs);
  const maxX = Math.max(...gxs);
  const minY = Math.min(...gys);
  const maxY = Math.max(...gys);

  const spanX = (maxX - minX) * stepX + tileW;
  const spanY = (maxY - minY) * stepY + tileH;

  // dejamos margen
  const pad = Math.max(18, Math.round(tileW * 0.25));
  const boardW = spanX + pad * 2;
  const boardH = spanY + pad * 2;

  const positionsPx = layout.map((p, i) => {
    const x = pad + (p.gx - minX) * stepX;
    const y = pad + (p.gy - minY) * stepY;
    return { tileId: `t${i}`, x, y, z: p.z };
  });

  return { boardW, boardH, positionsPx };
}

/* ---------------- Component ---------------- */

export default function AlefGame() {
  const TRAY_LIMIT = 4;
  const BOARD_REMOVE_MS = 240;
  const TRAY_MATCH_MS = 320;
  const MAX_LEVEL = 10;

  // responsive tile size
  const [tileW, setTileW] = useState(72);
  const [tileH, setTileH] = useState(84);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      // móvil primero
      const tw = clamp(Math.round(w * 0.11), 58, 86);
      const th = Math.round(tw * 1.18);
      setTileW(tw);
      setTileH(th);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const letterById = useMemo(() => {
    const m = new Map();
    for (const l of letters) m.set(l.id, l);
    return m;
  }, []);

  const [gameState, setGameState] = useState("playing"); // playing | win | lose
  const [tiles, setTiles] = useState([]); // {tileId, letterId, x,y,z, removed}
  const [tray, setTray] = useState([]); // {tileId, letterId, glowUntil}
  const [history, setHistory] = useState([]); // snapshots for undo
  const [soundOn, setSoundOn] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [lastWinLevel, setLastWinLevel] = useState(null);
  const [moveCount, setMoveCount] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalMerits, setTotalMerits] = useState(0);
  const [lastMerits, setLastMerits] = useState(null);
  const timeoutsRef = useRef([]);
  const dragRef = useRef({
    tileId: null,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const levelConfig = useMemo(() => {
    const tileCount = clamp(24 + (currentLevel - 1) * 2, 24, 50);
    const sideGapFactor = 0.18;
    const coverRate = clamp((currentLevel - 1) * 0.06, 0, 0.45);
    return {
      tileCount,
      sideGapFactor,
      coverRate,
    };
  }, [currentLevel]);

  const { boardW, boardH, positionsPx } = useMemo(() => {
    return buildLayout(tileW, tileH, currentLevel, levelConfig.tileCount);
  }, [tileW, tileH, currentLevel, levelConfig.tileCount]);

  // Init / reset
  const initGame = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    const layout = positionsPx;
    const pairCount = layout.length / 2; // layout ya es PAR (24/2=12)

    const level1Letters = letters.slice(0, 10);
    const base = [];
    while (base.length < pairCount) {
      const chunk = shuffle(level1Letters).map((l) => l.id);
      for (const id of chunk) {
        if (base.length < pairCount) base.push(id);
      }
    }
    const pairIds = shuffle([...base, ...base]);
    const coverCount = Math.round(pairIds.length * levelConfig.coverRate);
    const coverSet = new Set(
      shuffle(pairIds.map((_, i) => i)).slice(0, coverCount)
    );

    const newTiles = layout.map((p, idx) => ({
      tileId: p.tileId,
      letterId: pairIds[idx],
      x: p.x,
      y: p.y,
      z: p.z,
      removed: false,
      animatingOut: false,
      covered: coverSet.has(idx),
    }));

    setTiles(newTiles);
    setTray([]);
    setHistory([]);
    setGameState("playing");
    setMoveCount(0);
    setElapsedSec(0);
    setStartTime(Date.now());
  };

  const goToIntro = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setHasStarted(false);
    setTiles([]);
    setTray([]);
    setHistory([]);
    setGameState("playing");
    setStartTime(null);
  };

  useEffect(() => {
    if (hasStarted && positionsPx.length && tiles.length === 0) initGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, positionsPx.length]);

  useEffect(() => {
    if (!hasStarted || gameState !== "playing") return;
    const id = setInterval(() => {
      if (startTime) {
        setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 500);
    return () => clearInterval(id);
  }, [hasStarted, gameState, startTime]);

  const aliveTiles = useMemo(
    () => tiles.filter((t) => !t.removed && !t.animatingOut),
    [tiles]
  );

  // Visual offsets para "capas" (solo estética)
  const zOffsetX = tileW * 0.08;
  const zOffsetY = tileH * 0.07;

  const DEBUG_BLOCK = true;

  const { free: freeTileIds, reasonById: blockReasonById } = useMemo(() => {
    return computeTileStatus(
      aliveTiles,
      tileW,
      tileH,
      zOffsetX,
      zOffsetY,
      levelConfig.sideGapFactor
    );
  }, [
    aliveTiles,
    tileW,
    tileH,
    zOffsetX,
    zOffsetY,
    levelConfig.sideGapFactor,
  ]);

  // Win condition: sin fichas vivas
  useEffect(() => {
    if (!hasStarted) return;
    if (gameState !== "playing") return;
    if (aliveTiles.length === 0) setGameState("win");
  }, [aliveTiles.length, gameState, hasStarted]);

  useEffect(() => {
    if (gameState !== "win") return;
    const timeTarget = 90 + (currentLevel - 1) * 15;
    const moveTarget = 20 + (currentLevel - 1) * 3;
    const timeRatio = elapsedSec / timeTarget;
    const moveRatio = moveCount / moveTarget;
    const scoreTime = clamp(1 - (timeRatio - 1) * 0.5, 0, 1);
    const scoreMoves = clamp(1 - (moveRatio - 1) * 0.5, 0, 1);
    const scoreFinal = scoreTime * 0.35 + scoreMoves * 0.65;
    let baseMerits = 2;
    if (scoreFinal >= 0.85) baseMerits = 10;
    else if (scoreFinal >= 0.7) baseMerits = 8;
    else if (scoreFinal >= 0.55) baseMerits = 6;
    else if (scoreFinal >= 0.4) baseMerits = 4;
    const levelMultiplier = 1 + (currentLevel - 1) * 0.1;
    const earned = Math.round(baseMerits * levelMultiplier);
    setLastMerits(earned);
    setTotalMerits((prev) => prev + earned);
    setLastWinLevel(currentLevel);
    goToIntro();
  }, [gameState, currentLevel]);

  const pushHistory = (nextTiles, nextTray, nextGameState) => {
    setHistory((prev) => [
      ...prev,
      {
        tiles: JSON.parse(JSON.stringify(nextTiles)),
        tray: JSON.parse(JSON.stringify(nextTray)),
        gameState: nextGameState,
      },
    ]);
  };

  const undo = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setTiles(last.tiles);
      setTray(last.tray);
      setGameState(last.gameState);
      return prev.slice(0, -1);
    });
  };

  const playClickSound = () => {
    if (!soundOn) return;
    // (sonido simple sin assets) — beep con WebAudio
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.06);
      setTimeout(() => ctx.close(), 120);
    } catch {}
  };

  const tryRemovePairInTray = (nextTray) => {
    // Match de 2: si hay 2 iguales, se eliminan ambas (las primeras 2 que encuentre).
    const counts = new Map();
    for (const it of nextTray) {
      if (it.matchedOut) continue;
      counts.set(it.letterId, (counts.get(it.letterId) || 0) + 1);
    }

    for (const [letterId, c] of counts.entries()) {
      if (c >= 2) {
        const ids = [];
        for (const it of nextTray) {
          if (it.letterId === letterId && !it.matchedOut) {
            ids.push(it.trayId);
            if (ids.length === 2) break;
          }
        }
        if (ids.length < 2) return nextTray;

        const next = nextTray.map((it) =>
          ids.includes(it.trayId)
            ? { ...it, matchedOut: true, glowUntil: Date.now() + TRAY_MATCH_MS }
            : it
        );

        const tid = setTimeout(() => {
          setTray((prev) => prev.filter((it) => !ids.includes(it.trayId)));
        }, TRAY_MATCH_MS);
        timeoutsRef.current.push(tid);

        return next;
      }
    }
    return nextTray;
  };

  const pickTile = (tileId) => {
    if (gameState !== "playing") return;

    const t = tiles.find((x) => x.tileId === tileId);
    if (!t || t.removed || t.animatingOut) return;

    const isFree = freeTileIds.has(tileId);
    if (!isFree) {
      // bloqueadas: visibles y sin opacidad, solo no se mueven
      return;
    }

    // Si está tapada, solo destaparla (no se mueve a la bandeja)
    if (t.covered) {
      setTiles((prev) =>
        prev.map((x) =>
          x.tileId === tileId ? { ...x, covered: false } : x
        )
      );
      return;
    }

    // Bandeja llena: intentar meter otra → pierdes (no se agrega)
    if (tray.length >= TRAY_LIMIT) {
      setGameState("lose");
      return;
    }

    playClickSound();

    // snapshot ANTES del cambio
    pushHistory(tiles, tray, gameState);

    // 1) Quitar del tablero (desaparece)
    const nextTiles = tiles.map((x) =>
      x.tileId === tileId ? { ...x, animatingOut: true } : x
    );

    // 2) Añadir a bandeja con glow
    const glowUntil = Date.now() + 240;
    const trayId = `${tileId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    let nextTray = [
      ...tray,
      { trayId, tileId, letterId: t.letterId, glowUntil, matchedOut: false },
    ];

    // Si al meter queda > límite (no debería por el check), pierde:
    if (nextTray.length > TRAY_LIMIT) {
      setTiles(nextTiles);
      setTray(nextTray);
      setGameState("lose");
      return;
    }

    // 3) Si forma par, se limpia (match 2)
    const cleaned = tryRemovePairInTray(nextTray);

    setTiles(nextTiles);
    setTray(cleaned);
    setMoveCount((prev) => prev + 1);

    const tid = setTimeout(() => {
      setTiles((prev) =>
        prev.map((x) =>
          x.tileId === tileId ? { ...x, removed: true } : x
        )
      );
    }, BOARD_REMOVE_MS);
    timeoutsRef.current.push(tid);

    // Si estaba en 7 y no se limpió, sigue; si ya estaba 7 antes, arriba ya perdía.
  };

  const handlePointerDown = (e, tileId) => {
    if (gameState !== "playing") return;
    const isFree = freeTileIds.has(tileId);
    if (!isFree) return;
    const t = tiles.find((x) => x.tileId === tileId);
    if (!t || t.removed || t.animatingOut) return;

    e.preventDefault();
    dragRef.current = {
      tileId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    setDragOffset({ x: 0, y: 0 });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const dr = dragRef.current;
    if (!dr.tileId) return;
    e.preventDefault();
    const dx = e.clientX - dr.startX;
    const dy = e.clientY - dr.startY;
    if (!dr.moved && Math.hypot(dx, dy) > 6) dr.moved = true;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = (e) => {
    const dr = dragRef.current;
    if (!dr.tileId) return;
    e.preventDefault();
    const { tileId, moved } = dr;
    dragRef.current = { tileId: null, startX: 0, startY: 0, moved: false };
    setDragOffset({ x: 0, y: 0 });
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (!moved) {
      pickTile(tileId);
    }
  };

  const reshuffle = () => {
    if (gameState !== "playing") return;

    // snapshot
    pushHistory(tiles, tray, gameState);

    // Rebaraja SOLO las letras de las fichas vivas en tablero
    const alive = tiles.filter((t) => !t.removed);
    const ids = alive.map((t) => t.letterId);
    const mixed = shuffle(ids);

    let k = 0;
    const nextTiles = tiles.map((t) => {
      if (t.removed) return t;
      const letterId = mixed[k++];
      return { ...t, letterId };
    });

    setTiles(nextTiles);
  };

  // UI helpers
  const boardVisibleTiles = useMemo(() => {
    // render ordenado por z asc -> se vea bien la superposición (top encima)
    return [...tiles]
      .filter((t) => !t.removed)
      .sort((a, b) => a.z - b.z);
  }, [tiles]);

  const statusText =
    gameState === "playing"
      ? "Jugando"
      : gameState === "win"
      ? "Ganaste"
      : "Perdiste";

  /* ---------------- Render ---------------- */

  return (
    <div
      className="min-h-screen"
      style={{
        // Modo Israel (sutil): blancos + azules suaves
        background:
          "radial-gradient(900px 500px at 15% 20%, rgba(37,99,235,0.06), transparent 60%)," +
          "radial-gradient(900px 520px at 85% 30%, rgba(59,130,246,0.05), transparent 62%)," +
          "linear-gradient(180deg, #ffffff 0%, #f8fbff 60%, #eef6ff 100%)",
      }}
    >
      <style>{`
        .tile-btn {
          transition: transform 160ms ease, box-shadow 160ms ease;
          will-change: transform, box-shadow, opacity;
        }
        .tile-btn[data-free="true"]:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 18px 30px rgba(2,6,23,0.12), 0 0 0 2px rgba(255,255,255,0.75), 0 0 18px rgba(255,255,255,0.65) !important;
        }
        .tile-btn[data-free="true"]:active {
          transform: translateY(0px) scale(1.02);
          box-shadow: 0 14px 24px rgba(2,6,23,0.12), 0 0 0 2px rgba(255,255,255,0.85), 0 0 14px rgba(255,255,255,0.7) !important;
        }
        .tile-btn[data-out="true"] {
          animation: tilePopOut ${BOARD_REMOVE_MS}ms ease forwards;
        }
        @keyframes tilePopOut {
          0% { opacity: 1; transform: scale(1); box-shadow: 0 16px 30px rgba(2,6,23,0.14); }
          45% { opacity: 1; transform: scale(1.05); box-shadow: 0 0 0 2px rgba(255,255,255,0.9), 0 0 18px rgba(255,255,255,0.9); }
          100% { opacity: 0; transform: scale(0.98); box-shadow: 0 0 0 1px rgba(255,255,255,0.3); }
        }
        .tray-item {
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
          will-change: transform, box-shadow, opacity;
        }
        .tray-item[data-glow="true"] {
          box-shadow: 0 0 0 2px rgba(255,255,255,0.85), 0 14px 26px rgba(2,6,23,0.10);
          transform: scale(1.03);
        }
        .tray-item[data-matched="true"] {
          animation: trayMatchOut ${TRAY_MATCH_MS}ms ease forwards;
        }
        @keyframes trayMatchOut {
          0% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 2px rgba(255,255,255,0.7); }
          50% { opacity: 1; transform: scale(1.08); box-shadow: 0 0 0 2px rgba(255,255,255,0.95), 0 0 16px rgba(255,255,255,0.8); }
          100% { opacity: 0; transform: scale(0.98); box-shadow: 0 0 0 1px rgba(255,255,255,0.25); }
        }
      `}</style>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur px-5 py-4 shadow-[0_18px_45px_rgba(2,6,23,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold tracking-tight text-slate-900">
                ALEF GAME
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Nivel {currentLevel} — Vita-like (capas + bloqueo real). Solo
                fichas libres. Pierdes si llenas la bandeja.
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                  Bandeja: {tray.length}/{TRAY_LIMIT}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                  Tablero: {aliveTiles.length} fichas vivas
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                  Tiempo: {elapsedSec}s
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                  Jugadas: {moveCount}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                  Méritos: {totalMerits}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 ${
                    gameState === "lose"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : gameState === "win"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Estado: {statusText}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
              <button
                onClick={() => setSoundOn((v) => !v)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Sonido: {soundOn ? "On" : "Off"}
              </button>

              <button
                onClick={undo}
                disabled={history.length === 0}
                className={`rounded-full border px-4 py-2 text-sm shadow-sm ${
                  history.length === 0
                    ? "border-slate-200 bg-white/60 text-slate-400"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                Undo
              </button>

              <button
                onClick={reshuffle}
                disabled={gameState !== "playing"}
                className={`rounded-full border px-4 py-2 text-sm shadow-sm ${
                  gameState !== "playing"
                    ? "border-slate-200 bg-white/60 text-slate-400"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                Barajar
              </button>

              <button
                onClick={() => {
                  setHasStarted(true);
                  initGame();
                }}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm text-white shadow-sm hover:bg-slate-800"
              >
                Jugar
              </button>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px] items-start">
          {/* Board card */}
          <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-4 shadow-[0_18px_45px_rgba(2,6,23,0.08)]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Tablero</div>
              <div className="text-xs text-slate-500">
                Tip: despeja capas superiores para desbloquear.
              </div>
            </div>

            <div className="mt-3 flex justify-center">
              {!hasStarted ? (
                <div
                  className="relative rounded-2xl border border-slate-200 bg-white/80 p-4"
                  style={{
                    maxWidth: 560,
                    background:
                      "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)",
                  }}
                >
                  {lastWinLevel && (
                    <div className="mb-2 text-center text-xs font-semibold text-emerald-700">
                      Nivel {lastWinLevel} superado
                      {lastMerits !== null && ` · +${lastMerits} méritos`}
                    </div>
                  )}
                  <div className="mb-3 flex flex-wrap justify-center gap-2">
                    {Array.from({ length: MAX_LEVEL }).map((_, i) => {
                      const lvl = i + 1;
                      const isActive = lvl === currentLevel;
                      return (
                        <button
                          key={lvl}
                          onClick={() => setCurrentLevel(lvl)}
                          className={`rounded-full border px-3 py-1 text-xs shadow-sm ${
                            isActive
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          Nivel {lvl}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mb-3 text-center text-xs text-slate-500">
                    Alefato completo (22 letras)
                  </div>
                  <div
                    className="grid grid-cols-5 gap-1"
                    style={{ direction: "rtl" }}
                  >
                    {letters.slice(0, 22).map((l) => {
                      const accent = l?.color || "#2563eb";
                      return (
                        <div
                          key={l.id}
                          className="relative flex h-[66px] w-[58px] select-none flex-col items-center justify-center rounded-[14px] border"
                          style={{
                            borderColor: "rgba(15,23,42,0.10)",
                            background:
                              "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
                            boxShadow:
                              "0 10px 18px rgba(2,6,23,0.10), inset 0 1px 0 rgba(255,255,255,0.95)",
                          }}
                        >
                          <div
                            className="absolute inset-[4px] rounded-[12px]"
                            style={{ border: `1px solid ${accent}` }}
                          />
                          <div className="text-[10px] font-semibold text-slate-700">
                            {l?.value ?? ""}
                          </div>
                          <div className="text-[22px] font-extrabold text-black">
                            {l?.char ?? "?"}
                          </div>
                          <div className="text-[9px] text-slate-600">
                            {l?.name ?? "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div
                  className="relative rounded-2xl border border-slate-200 overflow-hidden"
                  style={{
                    width: boardW,
                    height: boardH,
                    background:
                      "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)",
                  }}
                >
                  {/* brillo sutil */}
                  <div
                    className="absolute inset-0 opacity-60"
                    style={{
                      background:
                        "radial-gradient(700px 360px at 25% 20%, rgba(37,99,235,0.08), transparent 60%)," +
                        "radial-gradient(700px 360px at 80% 55%, rgba(59,130,246,0.07), transparent 62%)",
                    }}
                  />

                  {boardVisibleTiles.map((t) => {
                    const l = letterById.get(t.letterId);
                  const isFree = freeTileIds.has(t.tileId);
                  const isInteractive =
                    isFree && gameState === "playing" && !t.animatingOut;
                  const isCovered = t.covered;
                  const blockReason = blockReasonById.get(t.tileId);
                  const debugOutline =
                    !DEBUG_BLOCK || isFree
                      ? "transparent"
                      : blockReason === "blocked:overlap-above"
                      ? "#ef4444"
                      : blockReason === "blocked:overlap-same"
                      ? "#f59e0b"
                      : blockReason === "blocked:lateral"
                      ? "#8b5cf6"
                      : "#64748b";

                    // Color educativo (si existe), pero en nivel 1 la letra es negra.
                    const accent = l?.color || "#2563eb";

                    // Estilo visual tipo "tile" con bisel + textura
                    const left = t.x + t.z * zOffsetX;
                    const top = t.y - t.z * zOffsetY;

                  return (
                    <button
                      key={t.tileId}
                      onPointerDown={(e) => handlePointerDown(e, t.tileId)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      aria-disabled={!isInteractive}
                      data-free={isInteractive ? "true" : "false"}
                      data-out={t.animatingOut ? "true" : "false"}
                      className="tile-btn absolute select-none rounded-[18px]"
                      style={{
                        left,
                        top,
                        width: tileW,
                        height: tileH,
                        zIndex: 10 + t.z * 10,
                        cursor: isInteractive ? "pointer" : "default",
                        pointerEvents: isInteractive ? "auto" : "none",
                        touchAction: "none",
                        transform:
                          dragRef.current.tileId === t.tileId
                            ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
                            : undefined,
                        // Ficha base (porcelana)
                        background:
                          "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
                        boxShadow:
                          "0 16px 30px rgba(2,6,23,0.12), inset 0 1px 0 rgba(255,255,255,0.95)",
                        border: "1px solid rgba(15,23,42,0.10)",
                        outline: DEBUG_BLOCK ? `2px solid ${debugOutline}` : "",
                        outlineOffset: DEBUG_BLOCK ? "2px" : "",
                      }}
                      title={
                        isFree
                          ? "Libre"
                          : blockReason || "Bloqueada (tapada o sin lados libres)"
                      }
                    >
                        {/* borde acento */}
                        <div
                          className="absolute inset-[6px] rounded-[14px]"
                          style={{
                            border: `1.5px solid ${accent}`,
                          }}
                        />

                        {/* textura (muy sutil) */}
                        <div
                          className="absolute inset-[6px] rounded-[14px] opacity-50"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle at 20% 20%, rgba(15,23,42,0.04), transparent 45%)," +
                              "radial-gradient(circle at 80% 35%, rgba(15,23,42,0.03), transparent 50%)," +
                              "repeating-linear-gradient(0deg, rgba(15,23,42,0.015) 0, rgba(15,23,42,0.015) 1px, transparent 1px, transparent 7px)",
                          }}
                        />

                        {/* Contenido */}
                        <div className="relative z-10 flex h-full flex-col items-center justify-center">
                          <div
                            className="text-[10px] font-semibold text-slate-700"
                            style={{ opacity: isCovered ? 0 : 1 }}
                          >
                            {l?.value ?? ""}
                          </div>
                          {isCovered && (
                            <div
                              className="absolute inset-[10px] rounded-[12px]"
                              style={{
                                background: `${accent}2A`,
                                boxShadow:
                                  "inset 0 0 0 1px rgba(15,23,42,0.08)",
                              }}
                            />
                          )}
                          <div
                            className="font-extrabold leading-none"
                            style={{
                              fontSize: Math.round(tileW * 0.52),
                              color: "#000000",
                              opacity: isCovered ? 0 : 1,
                            }}
                          >
                            {l?.char ?? "?"}
                          </div>
                          <div
                            className="mt-1 text-[11px] tracking-wide text-slate-600"
                            style={{ opacity: isCovered ? 0 : 1 }}
                          >
                            {l?.name ?? "—"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column: Tray */}
          <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-4 shadow-[0_18px_45px_rgba(2,6,23,0.08)]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-800">Bandeja</div>
              <div className="text-xs text-slate-500">
                {tray.length}/{TRAY_LIMIT}
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Se limpia al formar pares (match de 2).
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: TRAY_LIMIT }).map((_, i) => {
                  const item = tray[i];
                  const l = item ? letterById.get(item.letterId) : null;
                  const accent = l?.color || "#2563eb";
                  const glowing = item ? item.glowUntil > Date.now() : false;
                  const matchedOut = item ? item.matchedOut : false;

                  return (
                    <div
                      key={i}
                      className="tray-item relative flex items-center justify-center rounded-2xl"
                      data-glow={glowing && !matchedOut ? "true" : "false"}
                      data-matched={matchedOut ? "true" : "false"}
                      style={{
                        width: 42,
                        height: 52,
                        border: "1px solid rgba(15,23,42,0.10)",
                        background:
                          "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
                        boxShadow: "0 10px 18px rgba(2,6,23,0.10)",
                      }}
                    >
                      {item && (
                        <>
                          <div
                            className="absolute inset-[6px] rounded-[14px]"
                            style={{ border: `1.5px solid ${accent}` }}
                          />
                          <div
                            className="relative font-extrabold"
                            style={{
                              fontSize: 22,
                              color: "#000000",
                            }}
                          >
                            {l?.char ?? "?"}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold text-slate-800">
                Objetivo educativo
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Nivel 1: reconocer letras y nombres. (Luego: Nivel 2 letra ↔
                número).
              </div>
            </div>

            {gameState === "lose" && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <div>Llenaste la bandeja. Reinicia o usa Undo.</div>
                <button
                  onClick={goToIntro}
                  className="mt-3 rounded-full border border-red-200 bg-white px-4 py-2 text-xs text-red-700 shadow-sm hover:bg-red-50"
                >
                  Reiniciar
                </button>
              </div>
            )}
            {gameState === "win" && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                ¡Tablero limpio! 🎉
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
