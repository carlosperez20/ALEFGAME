import React, { useEffect, useMemo, useRef, useState } from "react";
import letters from "../data/letters.json";

/**
 * ALEF GAME â€“ Nivel 1 (Vita-like)
 * - Capas superpuestas (z)
 * - Solo fichas libres (no tapadas arriba + al menos un lado libre)
 * - Bandeja de 7. Si intentas meter una 8 â†’ pierdes.
 * - Match de 2: si en bandeja hay 2 iguales â†’ se eliminan de la bandeja.
 * - Al tocar: "foco" (glow) â†’ desaparece del tablero â†’ aparece iluminada en bandeja.
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
 * Usamos un pequeÃ±o margen para que el "tapado" sea consistente.
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
 *    consideramos vecino si estÃ¡ suficientemente cerca a la izquierda o derecha.
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
  // Definimos "vecino lateral" si estÃ¡ casi al lado (dentro de un umbral).
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

      // vecino izquierdo: el borde derecho del otro estÃ¡ cerca del borde izquierdo del actual
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
 * Coordenadas son en px relativos (luego escalamos segÃºn tileW/tileH en buildLayout()).
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
 * Convierte grid->px segÃºn tileW/tileH para que se vea bien en responsive.
 */
function buildLayout(tileW, tileH, level, tileCount) {
  const pool = createLayoutPool();
  const layout = pool.slice(0, Math.min(tileCount, pool.length));

  // separaciÃ³n horizontal/vertical entre fichas
  // MÃ¡s separaciÃ³n para reducir solapes excesivos y mantener jugabilidad
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
  const TRAY_MATCH_MS = 1450;
  const WIN_BANNER_MS = 1800;
  const MAX_LEVEL = 10;
  const STONE_TABLET_TEXTURE = "/assets/stone-tablet-tight.png";
  const GLYPH_BY_ID = {
    alef: "/glyphs/base/alef.png",
    bet: "/glyphs/base/bet.png",
    gimel: "/glyphs/base/gimel.png",
    dalet: "/glyphs/base/dalet.png",
    he: "/glyphs/base/he.png",
    vav: "/glyphs/base/vav.png",
    zayin: "/glyphs/base/zayin.png",
    chet: "/glyphs/base/chet.png",
    tet: "/glyphs/base/tet.png",
    yod: "/glyphs/base/yod.png",
    kaf: "/glyphs/base/kaf.png",
    lamed: "/glyphs/base/lamed.png",
    mem: "/glyphs/base/mem.png",
    nun: "/glyphs/base/nun.png",
    samekh: "/glyphs/base/samekh.png",
    ayin: "/glyphs/base/ayin.png",
    pe: "/glyphs/base/pe.png",
    tsadi: "/glyphs/base/tsadi.png",
    qof: "/glyphs/base/qof.png",
    resh: "/glyphs/base/resh.png",
    shin: "/glyphs/base/shin.png",
    tav: "/glyphs/base/tav.png",
    kaf_sofit: "/glyphs/sofit/kaf-sofit.png",
    mem_sofit: "/glyphs/sofit/mem-sofit.png",
    nun_sofit: "/glyphs/sofit/nun-sofit.png",
    pe_sofit: "/glyphs/sofit/pe-sofit.png",
    tsadi_sofit: "/glyphs/sofit/tsadi-sofit.png",
  };
  const GLYPH_TWEAK_BY_ID = {
    // Bet is the baseline visual size (scale 1.00) for all glyphs.
    alef: { y: 0, scale: 1.0 },
    bet: { y: 0, scale: 1.0 },
    gimel: { y: 0, scale: 1.0 },
    dalet: { y: 0, scale: 1.0 },
    he: { y: 0, scale: 1.0 },
    vav: { y: 0, scale: 1.0 },
    zayin: { y: 0, scale: 1.0 },
    chet: { y: 0, scale: 1.0 },
    tet: { y: 0, scale: 1.0 },
    yod: { y: -6, scale: 0.72 },
    kaf: { y: 0, scale: 1.0 },
    lamed: { y: 0, scale: 1.0 },
    mem: { y: 0, scale: 1.0 },
    nun: { y: 0, scale: 1.0 },
    samekh: { y: 0, scale: 1.0 },
    ayin: { y: 0, scale: 1.0 },
    pe: { y: 0, scale: 1.0 },
    tsadi: { y: 0, scale: 1.0 },
    qof: { y: 0, scale: 1.0 },
    resh: { y: 0, scale: 1.0 },
    shin: { y: 0, scale: 1.0 },
    tav: { y: 0, scale: 1.0 },
    kaf_sofit: { y: 0, scale: 1.0 },
    mem_sofit: { y: 0, scale: 1.0 },
    nun_sofit: { y: 0, scale: 1.0 },
    pe_sofit: { y: 0, scale: 1.0 },
    tsadi_sofit: { y: 0, scale: 1.0 },
  };

  const glyphTransform = (letterId, baseY = -2) => {
    const tweak = GLYPH_TWEAK_BY_ID[letterId] || { y: 0, scale: 1 };
    return `translateY(${baseY + tweak.y}px) scale(${tweak.scale})`;
  };

  // responsive tile size
  const [tileW, setTileW] = useState(72);
  const [tileH, setTileH] = useState(84);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      // mÃ³vil primero
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
  const [uiStep, setUiStep] = useState("intro"); // intro | levels | game
  const [currentLevel, setCurrentLevel] = useState(1);
  const [lastWinLevel, setLastWinLevel] = useState(null);
  const [moveCount, setMoveCount] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalMerits, setTotalMerits] = useState(0);
  const [lastMerits, setLastMerits] = useState(null);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const timeoutsRef = useRef([]);
  const dragRef = useRef({
    tileId: null,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const gameLayoutRef = useRef(null);
  const gameTrayRef = useRef(null);
  const [gameScale, setGameScale] = useState(1);

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

  useEffect(() => {
    if (uiStep !== "game") return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = {
      margin: html.style.margin,
      padding: html.style.padding,
      height: html.style.height,
      width: html.style.width,
      overflow: html.style.overflow,
    };
    const prevBody = {
      margin: body.style.margin,
      padding: body.style.padding,
      height: body.style.height,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    html.style.margin = "0";
    html.style.padding = "0";
    html.style.height = "100vh";
    html.style.width = "100vw";
    html.style.overflow = "hidden";
    body.style.margin = "0";
    body.style.padding = "0";
    body.style.height = "100vh";
    body.style.width = "100vw";
    body.style.overflow = "hidden";
    return () => {
      html.style.margin = prevHtml.margin;
      html.style.padding = prevHtml.padding;
      html.style.height = prevHtml.height;
      html.style.width = prevHtml.width;
      html.style.overflow = prevHtml.overflow;
      body.style.margin = prevBody.margin;
      body.style.padding = prevBody.padding;
      body.style.height = prevBody.height;
      body.style.width = prevBody.width;
      body.style.overflow = prevBody.overflow;
    };
  }, [uiStep]);

  useEffect(() => {
    if (uiStep !== "game" || !hasStarted) return;
    const recalcScale = () => {
      const host = gameLayoutRef.current;
      if (!host || !boardW || !boardH) return;
      const hostRect = host.getBoundingClientRect();
      const trayRect = gameTrayRef.current?.getBoundingClientRect();
      const availableW = Math.max(40, hostRect.width - 8);
      const availableH = Math.max(
        40,
        hostRect.height - (trayRect?.height || 0) - 8
      );
      const sx = availableW / boardW;
      const sy = availableH / boardH;
      const nextScale = Math.min(1.55, Math.max(0.42, Math.min(sx, sy)));
      setGameScale(Number.isFinite(nextScale) ? nextScale : 1);
    };
    recalcScale();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(recalcScale)
        : null;
    if (observer && gameLayoutRef.current) observer.observe(gameLayoutRef.current);
    if (observer && gameTrayRef.current) observer.observe(gameTrayRef.current);
    window.addEventListener("resize", recalcScale);
    return () => {
      window.removeEventListener("resize", recalcScale);
      if (observer) observer.disconnect();
    };
  }, [uiStep, hasStarted, boardW, boardH, tray.length, tileW, tileH]);

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
    setShowWinOverlay(false);
    setHasStarted(false);
    setUiStep("intro");
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

  // Visual offsets para "capas" (solo estÃ©tica)
  const zOffsetX = tileW * 0.08;
  const zOffsetY = tileH * 0.07;

  const DEBUG_BLOCK = false;

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
    setShowWinOverlay(true);
    const tid = setTimeout(() => {
      goToIntro();
    }, WIN_BANNER_MS);
    timeoutsRef.current.push(tid);
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
    // (sonido simple sin assets) â€” beep con WebAudio
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

    // Si estÃ¡ tapada, solo destaparla (no se mueve a la bandeja)
    if (t.covered) {
      setTiles((prev) =>
        prev.map((x) =>
          x.tileId === tileId ? { ...x, covered: false } : x
        )
      );
      return;
    }

    // Bandeja llena: intentar meter otra â†’ pierdes (no se agrega)
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

    // 2) AÃ±adir a bandeja con glow
    const glowUntil = Date.now() + 520;
    const trayId = `${tileId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    let nextTray = [
      ...tray,
      { trayId, tileId, letterId: t.letterId, glowUntil, matchedOut: false },
    ];

    // Si al meter queda > lÃ­mite (no deberÃ­a por el check), pierde:
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

    // Si estaba en 7 y no se limpiÃ³, sigue; si ya estaba 7 antes, arriba ya perdÃ­a.
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
    // render ordenado por z asc -> se vea bien la superposiciÃ³n (top encima)
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
  const trayTrackWidth = hasStarted
    ? clamp(Math.round(boardW * gameScale), 240, 620)
    : 360;

  const levelBonusText = useMemo(() => {
    const bonusByLevel = {
      1: "Bonus pendiente de definir para Nivel 1.",
      2: "Bonus pendiente de definir para Nivel 2.",
      3: "Bonus pendiente de definir para Nivel 3.",
      4: "Bonus pendiente de definir para Nivel 4.",
      5: "Bonus pendiente de definir para Nivel 5.",
      6: "Bonus pendiente de definir para Nivel 6.",
      7: "Bonus pendiente de definir para Nivel 7.",
      8: "Bonus pendiente de definir para Nivel 8.",
      9: "Bonus pendiente de definir para Nivel 9.",
      10: "Bonus pendiente de definir para Nivel 10.",
    };
    return bonusByLevel[currentLevel] || "Bonus pendiente de definir.";
  }, [currentLevel]);


  if (uiStep === "intro") {
    const howToItems = [
      {
        title: "Observa con atención",
        desc: "Selecciona únicamente las fichas libres disponibles.",
        icon: (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        ),
      },
      {
        title: "Conecta símbolos",
        desc: "Forma pares correctos y activa su correspondencia energética.",
        icon: (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            <path d="M8 7h-2a4 4 0 1 0 0 8h2M16 7h2a4 4 0 1 1 0 8h-2M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        title: "Despeja niveles",
        desc: "Limpia el tablero capa por capa hasta completarlo.",
        icon: (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            <path d="M4 14l8-8 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 19l8-8 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          </svg>
        ),
      },
    ];

    return (
      <div
        className="relative min-h-screen overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #0b1f4f 0%, #485062 48%, #0a1533 100%)",
        }}
      >
        <style>{`
          .intro-fog {
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              radial-gradient(900px 520px at 15% 18%, rgba(255,255,255,0.08), transparent 70%),
              radial-gradient(780px 440px at 85% 26%, rgba(255,255,255,0.06), transparent 68%),
              radial-gradient(600px 380px at 50% 80%, rgba(255,255,255,0.045), transparent 70%);
          }
          .intro-reveal {
            opacity: 0;
            transform: translateY(14px);
            animation: introFadeUp 680ms ease forwards;
          }
          .stone-float {
            animation: introFloat 4.8s ease-in-out infinite;
          }
          @keyframes introFadeUp {
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes introFloat {
            0%,100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
        `}</style>

        <div className="intro-fog" />

        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="intro-reveal rounded-[34px] border border-white/20 bg-white/[0.08] p-6 shadow-[0_20px_60px_rgba(2,8,22,0.24)] backdrop-blur-md sm:p-10">
            <section className="grid items-center gap-10 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="text-slate-100">
                <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
                  ALEF GAME
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-200 sm:text-lg">
                  Explora la energía de los símbolos de la creación a través de
                  una experiencia interactiva diseñada para elevar la
                  consciencia, fortalecer el carácter y expandir la claridad
                  mental.
                </p>
                <p className="mt-6 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
                  ALEF GAME es un entrenamiento mental disfrazado de juego.
                  Cada símbolo estimula la concentración, la inteligencia y el
                  equilibrio interior.
                  <br />
                  A medida que avanzas, tu mente se ordena, tu atención se
                  afina y tu descanso se vuelve más profundo.
                </p>
              </div>

              <div className="intro-reveal mx-auto w-full max-w-[300px]" style={{ animationDelay: "120ms" }}>
                <div className="stone-float relative mx-auto h-[280px] w-[230px]">
                  <div className="absolute left-1/2 top-[88%] h-8 w-44 -translate-x-1/2 rounded-full bg-black/30 blur-xl" />
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${STONE_TABLET_TEXTURE})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                    }}
                  />
                </div>
              </div>
            </section>

            <section className="intro-reveal mt-14" style={{ animationDelay: "190ms" }}>
              <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
                Cómo se juega
              </h2>
              <div className="mx-auto mt-7 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {howToItems.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/20 bg-white/[0.06] p-4 text-slate-100"
                  >
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/[0.08] text-white">
                      {item.icon}
                    </div>
                    <div className="mt-3 text-base font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-slate-300">
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-slate-300 sm:text-base">
                Cada movimiento entrena tu enfoque y fortalece tu presencia mental.
              </p>
            </section>

            <section className="intro-reveal mt-14" style={{ animationDelay: "260ms" }}>
              <p className="mx-auto max-w-3xl text-center text-base leading-relaxed text-slate-200 sm:text-lg">
                ALEF GAME es una puerta sutil hacia la exploración simbólica, la
                introspección y el desarrollo interior a través del juego
                consciente.
              </p>
            </section>

            <section className="intro-reveal mt-12 flex justify-center" style={{ animationDelay: "320ms" }}>
              <button
                onClick={() => setUiStep("levels")}
                className="rounded-full bg-[#0d1c46] px-10 py-4 text-sm font-semibold tracking-[0.08em] text-white shadow-[0_16px_34px_rgba(3,9,24,0.35)] transition-transform duration-200 hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(147,197,253,0.4)]"
              >
                COMENZAR EXPERIENCIA
              </button>
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (uiStep === "levels") {
    return (
      <div
        className="min-h-screen"
        style={{
          background:
            "radial-gradient(980px 560px at 14% 12%, rgba(255,255,255,0.08), transparent 68%)," +
            "radial-gradient(840px 520px at 88% 18%, rgba(255,255,255,0.06), transparent 70%)," +
            "linear-gradient(180deg, #0b1f4f 0%, #485062 48%, #0a1533 100%)",
        }}
      >
        <style>{`
          .symbol-card {
            opacity: 0;
            transform: translateY(8px);
            animation: symbolIn 420ms ease forwards;
            transition: transform 240ms ease, box-shadow 240ms ease, filter 240ms ease;
          }
          .symbol-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 14px 30px rgba(2, 6, 23, 0.35);
            filter: brightness(1.02);
          }
          .level-chip {
            transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
          }
          .level-chip:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(2, 6, 23, 0.26);
          }
          @keyframes symbolIn {
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <div className="rounded-[32px] border border-white/20 bg-white/[0.08] p-6 shadow-[0_24px_62px_rgba(2,8,22,0.28)] backdrop-blur-md sm:p-10">
            <div className="text-center">
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                EXPLORA LOS 22 SÍMBOLOS
              </h1>
              <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-slate-200 sm:text-base">
                Cada símbolo representa una fuerza esencial de la creación.
                Aquí puedes contemplar su forma, su nombre y su valor numérico.
              </p>
              <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Los niveles del juego trabajan combinaciones específicas de estos
                símbolos para entrenar enfoque, claridad y presencia mental.
              </p>
            </div>

            <div className="mt-8 flex justify-center">
              <div className="grid grid-cols-5 gap-2 sm:gap-3" style={{ direction: "rtl" }}>
                {letters.slice(0, 22).map((l, idx) => {
                  const glyphSrc = GLYPH_BY_ID[l.id] || null;
                  return (
                    <div
                      key={l.id}
                      className="symbol-card relative flex h-[78px] w-[64px] select-none flex-col items-center justify-center"
                      style={{ animationDelay: `${idx * 28}ms` }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${STONE_TABLET_TEXTURE})`,
                          backgroundSize: "106% auto",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center",
                          filter: "drop-shadow(0 8px 14px rgba(2,6,23,0.28))",
                        }}
                      />
                      <div className="absolute left-1/2 top-[6px] -translate-x-1/2 rounded-md bg-slate-900/60 px-1.5 py-[1px] text-[11px] font-medium leading-none text-white">
                        {l?.value ?? ""}
                      </div>
                      {glyphSrc ? (
                        <img
                          src={glyphSrc}
                          alt={l?.name ?? "glyph"}
                          className="glyph-img select-none pointer-events-none"
                          draggable={false}
                          style={{
                            transform: glyphTransform(l.id, -2),
                            width: 36,
                            height: 36,
                            objectFit: "contain",
                            filter:
                              "brightness(0) saturate(100%) invert(72%) sepia(62%) saturate(706%) " +
                              "hue-rotate(358deg) brightness(95%) contrast(93%) " +
                              "drop-shadow(0 0 0 rgba(0,0,0,1)) " +
                              "drop-shadow(1px 0 0 rgba(0,0,0,1)) " +
                              "drop-shadow(-1px 0 0 rgba(0,0,0,1)) " +
                              "drop-shadow(0 1px 0 rgba(0,0,0,1)) " +
                              "drop-shadow(0 -1px 0 rgba(0,0,0,0.95)) " +
                              "drop-shadow(0 2px 2px rgba(0,0,0,0.65))",
                          }}
                        />
                      ) : null}
                      <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 rounded-md bg-slate-900/60 px-1.5 py-[1px] text-[10px] font-medium leading-none text-white">
                        {l?.name ?? "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-white/20 bg-white/[0.08] p-5 sm:p-6">
              <div className="text-center text-2xl font-semibold text-white">
                Niveles de práctica
              </div>
              <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-relaxed text-slate-300 sm:text-base">
                Cada nivel propone combinaciones específicas de símbolos para
                entrenar concentración, memoria y claridad interior.
                Actualmente todos los niveles permanecen abiertos para visualización.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                {Array.from({ length: MAX_LEVEL }).map((_, i) => {
                  const lvl = i + 1;
                  const isActive = lvl === currentLevel;
                  return (
                    <button
                      key={lvl}
                      onClick={() => setCurrentLevel(lvl)}
                      className={`level-chip rounded-full border px-4 py-2 text-xs font-medium ${
                        isActive
                          ? "border-blue-300/80 bg-blue-400/20 text-white"
                          : "border-white/25 bg-white/[0.06] text-slate-200"
                      }`}
                    >
                      Nivel {lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <button
                onClick={() => {
                  setHasStarted(true);
                  setUiStep("game");
                  initGame();
                }}
                className="rounded-full bg-[#0d1c46] px-10 py-4 text-sm font-semibold tracking-[0.08em] text-white shadow-[0_16px_34px_rgba(3,9,24,0.35)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(147,197,253,0.4)]"
              >
                JUGAR NIVEL SELECCIONADO
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  /* ---------------- Render ---------------- */

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(860px 500px at 50% 44%, rgba(147,197,253,0.12), transparent 64%)," +
          "linear-gradient(180deg, #0b1f4f 0%, #455063 50%, #0a1533 100%)",
      }}
    >
      <style>{`
        .tile-btn {
          transition: transform 160ms ease, box-shadow 160ms ease;
          will-change: transform, box-shadow, opacity;
        }
        .tile-btn[data-free="true"]:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 18px 30px rgba(2,6,23,0.16) !important;
        }
        .tile-btn[data-free="true"]:active {
          transform: translateY(0px) scale(1.02);
          box-shadow: 0 14px 24px rgba(2,6,23,0.16) !important;
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
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease, filter 160ms ease;
          will-change: transform, box-shadow, opacity;
        }
        .star-slot {
          position: relative;
        }
        .star-outline {
          position: absolute;
          inset: 0;
          pointer-events: none;
          color: #caa24a;
          transition: color 180ms ease, filter 180ms ease, opacity 180ms ease;
        }
        .star-outline polygon {
          fill: none;
          stroke: currentColor;
          stroke-width: 6.6;
          stroke-linejoin: miter;
          stroke-linecap: butt;
        }
        .star-slot[data-filled="true"] .star-outline {
          color: #caa24a;
          filter: drop-shadow(0 0 5px rgba(237, 203, 109, 0.55));
        }
        .tray-item[data-glow="true"] {
          filter: drop-shadow(0 0 20px rgba(255, 239, 177, 1)) drop-shadow(0 0 34px rgba(255, 204, 84, 1));
          transform: scale(1.08);
          animation: trayInsertGlow 520ms ease-out forwards;
        }
        .tray-item[data-matched="true"] .star-outline {
          color: #e6bf63;
          filter: drop-shadow(0 0 26px rgba(255, 253, 236, 1)) drop-shadow(0 0 52px rgba(255, 216, 116, 1));
          animation: trayStarFusion ${TRAY_MATCH_MS}ms ease forwards;
        }
        .tray-glyph {
          z-index: 2;
        }
        .tray-flash {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          opacity: 0;
          transform: scale(0.7);
          pointer-events: none;
          z-index: 1;
          background: radial-gradient(
            circle,
            rgba(255,255,255,0.98) 0%,
            rgba(255,255,255,0.76) 30%,
            rgba(255,236,180,0.38) 52%,
            rgba(255,236,180,0) 74%
          );
          filter: blur(0.5px);
        }
        .tray-item[data-matched="true"] .tray-flash {
          animation: trayLedFlash ${TRAY_MATCH_MS}ms ease forwards;
        }
        .tray-item[data-matched="true"] .tray-glyph {
          animation: trayGlyphPairFlash ${TRAY_MATCH_MS}ms ease forwards;
        }
        .gold-hebrew {
          background-size: 240% 240% !important;
          animation: goldShine 1200ms linear infinite, goldPulse 900ms ease-in-out infinite;
          will-change: background-position, filter;
        }
        .glyph-img {
          image-rendering: auto;
          will-change: filter, transform;
        }
        .glyph-gold-dim {
          /* Oro fijo (sin parpadeo), con contorno oscuro fuerte para lectura. */
          filter: brightness(0) saturate(100%) invert(72%) sepia(62%) saturate(706%)
                  hue-rotate(358deg) brightness(95%) contrast(93%)
                  drop-shadow(0 0 0 rgba(0,0,0,1))
                  drop-shadow(1px 0 0 rgba(0,0,0,1))
                  drop-shadow(-1px 0 0 rgba(0,0,0,1))
                  drop-shadow(0 1px 0 rgba(0,0,0,1))
                  drop-shadow(0 -1px 0 rgba(0,0,0,0.95))
                  drop-shadow(0 2px 2px rgba(0,0,0,0.65));
        }
        .glyph-gold-active {
          /* Mismo oro base + encendido titilante muy visible */
          filter: brightness(0) saturate(100%) invert(72%) sepia(62%) saturate(706%)
                  hue-rotate(358deg) brightness(95%) contrast(93%)
                  drop-shadow(0 0 0 rgba(0,0,0,1))
                  drop-shadow(1px 0 0 rgba(0,0,0,1))
                  drop-shadow(-1px 0 0 rgba(0,0,0,1))
                  drop-shadow(0 1px 0 rgba(0,0,0,1))
                  drop-shadow(0 -1px 0 rgba(0,0,0,0.95))
                  drop-shadow(0 2px 2px rgba(0,0,0,0.65));
          animation: glyphBlink 560ms steps(2, end) infinite;
        }
        @keyframes goldShine {
          0% { background-position: 0% 45%; }
          100% { background-position: 100% 55%; }
        }
        @keyframes glyphBlink {
          0%, 49% {
            filter: brightness(0) saturate(100%) invert(72%) sepia(62%) saturate(706%)
                    hue-rotate(358deg) brightness(95%) contrast(93%)
                    drop-shadow(0 0 0 rgba(0,0,0,1))
                    drop-shadow(1px 0 0 rgba(0,0,0,1))
                    drop-shadow(-1px 0 0 rgba(0,0,0,1))
                    drop-shadow(0 1px 0 rgba(0,0,0,1))
                    drop-shadow(0 -1px 0 rgba(0,0,0,0.95))
                    drop-shadow(0 2px 2px rgba(0,0,0,0.65));
            opacity: 0.9;
          }
          50%, 100% {
            filter: brightness(0) saturate(100%) invert(78%) sepia(72%) saturate(980%)
                    hue-rotate(357deg) brightness(108%) contrast(97%)
                    drop-shadow(0 0 0 rgba(0,0,0,1))
                    drop-shadow(1px 0 0 rgba(0,0,0,1))
                    drop-shadow(-1px 0 0 rgba(0,0,0,1))
                    drop-shadow(0 1px 0 rgba(0,0,0,1))
                    drop-shadow(0 -1px 0 rgba(0,0,0,1))
                    drop-shadow(0 2px 2px rgba(0,0,0,0.72))
                    drop-shadow(0 0 10px rgba(255,220,120,1))
                    drop-shadow(0 0 18px rgba(240,185,80,1));
            opacity: 1;
          }
          100% {
            filter: brightness(0) saturate(100%) invert(72%) sepia(62%) saturate(706%)
                    hue-rotate(358deg) brightness(95%) contrast(93%)
                    drop-shadow(0 0 0 rgba(0,0,0,1))
                    drop-shadow(1px 0 0 rgba(0,0,0,1))
                    drop-shadow(-1px 0 0 rgba(0,0,0,1))
                    drop-shadow(0 1px 0 rgba(0,0,0,1))
                    drop-shadow(0 -1px 0 rgba(0,0,0,0.95))
                    drop-shadow(0 2px 2px rgba(0,0,0,0.65));
            opacity: 0.9;
          }
        }
        @keyframes goldPulse {
          0% { filter: drop-shadow(0 0 1px rgba(255, 212, 96, 0.55)) drop-shadow(0 0 4px rgba(255, 193, 46, 0.45)); }
          50% { filter: drop-shadow(0 0 3px rgba(255, 228, 138, 0.95)) drop-shadow(0 0 10px rgba(255, 189, 35, 0.9)); }
          100% { filter: drop-shadow(0 0 1px rgba(255, 212, 96, 0.55)) drop-shadow(0 0 4px rgba(255, 193, 46, 0.45)); }
        }
        @keyframes trayInsertGlow {
          0% {
            transform: scale(0.94);
            filter: drop-shadow(0 0 0 rgba(255,255,255,0));
          }
          40% {
            transform: scale(1.11);
            filter: drop-shadow(0 0 22px rgba(255, 239, 177, 1)) drop-shadow(0 0 36px rgba(255, 204, 84, 1));
          }
          100% {
            transform: scale(1.02);
            filter: drop-shadow(0 0 10px rgba(255, 223, 130, 0.75));
          }
        }
        @keyframes trayGlyphPairFlash {
          0% {
            opacity: 1;
            transform: scale(1);
            filter: brightness(0) saturate(100%) invert(72%) sepia(62%) saturate(706%)
                    hue-rotate(358deg) brightness(95%) contrast(93%)
                    drop-shadow(0 0 0 rgba(0,0,0,1))
                    drop-shadow(1px 0 0 rgba(0,0,0,1))
                    drop-shadow(-1px 0 0 rgba(0,0,0,1))
                    drop-shadow(0 1px 0 rgba(0,0,0,1))
                    drop-shadow(0 -1px 0 rgba(0,0,0,0.95))
                    drop-shadow(0 2px 2px rgba(0,0,0,0.65))
                    drop-shadow(0 0 8px rgba(255, 226, 120, 0.8));
          }
          14% {
            opacity: 1;
            transform: scale(1.2);
            filter: brightness(0) saturate(0%) invert(100%)
                    drop-shadow(0 0 0 rgba(255,255,255,1))
                    drop-shadow(0 0 34px rgba(255,255,255,1))
                    drop-shadow(0 0 66px rgba(255,255,255,1));
          }
          56% {
            opacity: 1;
            transform: scale(1.22);
            filter: brightness(0) saturate(0%) invert(100%)
                    drop-shadow(0 0 0 rgba(255,255,255,1))
                    drop-shadow(0 0 42px rgba(255,255,255,1))
                    drop-shadow(0 0 76px rgba(255,255,255,1));
          }
          84% {
            opacity: 0;
            transform: scale(1.3);
            filter: brightness(0) saturate(0%) invert(100%)
                    drop-shadow(0 0 0 rgba(255,255,255,1))
                    drop-shadow(0 0 48px rgba(255,255,255,1))
                    drop-shadow(0 0 72px rgba(255,255,255,1));
          }
          100% {
            opacity: 0;
            transform: scale(1.3);
            filter: brightness(0) saturate(0%) invert(100%);
          }
        }
        @keyframes trayStarFusion {
          0% {
            filter: drop-shadow(0 0 10px rgba(255, 224, 130, 0.8));
          }
          62% {
            filter: drop-shadow(0 0 36px rgba(255,255,255,1)) drop-shadow(0 0 82px rgba(255, 218, 120, 1));
          }
          100% {
            filter: drop-shadow(0 0 10px rgba(237, 203, 109, 0.7));
          }
        }
        @keyframes trayLedFlash {
          0% {
            opacity: 0;
            transform: scale(0.72);
          }
          18% {
            opacity: 1;
            transform: scale(1.22);
          }
          54% {
            opacity: 0.96;
            transform: scale(1.28);
          }
          100% {
            opacity: 0;
            transform: scale(1.4);
          }
        }
        .game-glass {
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(8px);
          box-shadow: 0 14px 34px rgba(2, 8, 22, 0.24);
        }
        .ctrl-btn {
          transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
        }
        .ctrl-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(2, 6, 23, 0.22);
        }
      `}</style>
      <div className="flex h-full w-full flex-col px-2 sm:px-3">
        <div
          className="flex items-center justify-end"
          style={{ flex: "0 0 8%", minHeight: 42 }}
        >
          <button
            onClick={() => setSoundOn((v) => !v)}
            className="ctrl-btn h-9 rounded-full border border-white/30 bg-white/85 px-3 text-xs text-slate-800 shadow-sm hover:bg-white sm:h-10 sm:text-sm"
            title="Silenciar / activar sonido"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
        </div>

        {/* Main */}
        <div
          ref={gameLayoutRef}
          className="flex min-h-0 flex-col items-center justify-center gap-1 overflow-hidden"
          style={{ flex: "0 0 78%" }}
        >
          {/* Board card */}
          <div className="game-glass order-2 flex min-h-0 w-full max-w-[980px] items-center justify-center overflow-hidden rounded-3xl p-1.5 sm:p-2">
            <div className="flex h-full w-full items-center justify-center overflow-hidden">
              <div
                style={{
                  transform: hasStarted ? `scale(${gameScale})` : undefined,
                  transformOrigin: "center center",
                }}
              >
              {!hasStarted ? (
                <div
                  className="relative rounded-2xl border border-slate-200 bg-white/80 p-4"
                  style={{
                    maxWidth: 560,
                    background:
                      "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)",
                  }}
                >
                  {lastWinLevel && lastMerits !== null && (
                    <div className="mb-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center shadow-sm">
                      <div className="text-2xl font-extrabold tracking-tight text-emerald-800">
                        Mazel Tov. Ganaste {lastMerits} mÃ©ritos
                      </div>
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
                      const glyphSrc = GLYPH_BY_ID[l.id] || null;
                      return (
                        <div
                          key={l.id}
                          className="relative flex h-[72px] w-[60px] select-none flex-col items-center justify-center"
                          style={{ background: "transparent" }}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `url(${STONE_TABLET_TEXTURE})`,
                              backgroundSize: "106% auto",
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "center",
                            }}
                          />
                          <div
                            className="absolute left-1/2 top-[6px] -translate-x-1/2 rounded-md px-1.5 py-[1px] font-medium leading-none"
                            style={{
                              fontSize: 12,
                              letterSpacing: "0.01em",
                              color: "#ffffff",
                              background: "rgba(2,6,23,0.62)",
                              border: "1px solid rgba(255,255,255,0.45)",
                            }}
                          >
                            {l?.value ?? ""}
                          </div>
                          {glyphSrc ? (
                            <img
                              src={glyphSrc}
                              alt={l?.name ?? "glyph"}
                              className="glyph-img glyph-gold-active select-none pointer-events-none"
                              draggable={false}
                              style={{
                                transform: glyphTransform(l.id, -2),
                                width: 36,
                                height: 36,
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            <div className="font-extrabold leading-none text-2xl text-white">
                              {l?.char ?? "?"}
                            </div>
                          )}
                          <div
                            className="absolute bottom-[6px] left-1/2 -translate-x-1/2 rounded-md px-1.5 py-[1px] font-medium tracking-wide leading-none"
                            style={{
                              fontSize: 10,
                              color: "#ffffff",
                              background: "rgba(2,6,23,0.62)",
                              border: "1px solid rgba(255,255,255,0.45)",
                            }}
                          >
                            {l?.name ?? "???"}
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
                  const glyphSrc = l ? GLYPH_BY_ID[l.id] || null : null;
                  const isFree = freeTileIds.has(t.tileId);
                  const isInteractive =
                    isFree && gameState === "playing" && !t.animatingOut;
                  const isCovered = t.covered;
                  const blockReason = blockReasonById.get(t.tileId);
                  const isBlockedTop = blockReason === "blocked:overlap-above";
                  const isBlockedSame = blockReason === "blocked:overlap-same";
                  const isBlockedSide = blockReason === "blocked:lateral";
                  const debugOutline = !DEBUG_BLOCK
                    ? "transparent"
                    : isFree
                    ? "#16a34a"
                    : isBlockedTop
                    ? "#dc2626"
                    : isBlockedSide
                    ? "#d97706"
                    : isBlockedSame
                    ? "#7c3aed"
                    : "#64748b";

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
                      className="tile-btn absolute select-none"
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
                        // Mantener la ficha sin base rectangular; solo piedra con alpha.
                        background: "transparent",
                        boxShadow: "none",
                        border: "none",
                        outline: DEBUG_BLOCK ? `2px solid ${debugOutline}` : "",
                        outlineOffset: DEBUG_BLOCK ? "2px" : "",
                      }}
                      title={
                        isFree
                          ? "Libre: se puede tocar"
                          : isBlockedTop
                          ? "Bloqueada por capa superior"
                          : isBlockedSide
                          ? "Bloqueada lateralmente"
                          : blockReason || "Bloqueada"
                      }
                    >
                        {/* piedra base (PNG con transparencia) */}
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage: `url(${STONE_TABLET_TEXTURE})`,
                            backgroundSize: "106% auto",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center",
                            opacity: isBlockedTop ? 0.78 : isBlockedSide ? 0.9 : 1,
                            filter: isBlockedTop
                              ? "brightness(0.52) saturate(0.85)"
                              : isBlockedSide
                              ? "brightness(0.78)"
                              : "none",
                          }}
                        />
                        {/* Contenido */}
                        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
                          <div
                            className="absolute left-1/2 top-[6px] -translate-x-1/2 rounded-md px-1.5 py-[1px] font-medium leading-none"
                            style={{
                              fontSize: Math.max(13, Math.round(tileW * 0.2)),
                              letterSpacing: "0.01em",
                              color: "#ffffff",
                              background: "rgba(2,6,23,0.62)",
                              border: "1px solid rgba(255,255,255,0.45)",
                              textShadow: "none",
                              opacity: isCovered ? 0 : 1,
                            }}
                          >
                            {l?.value ?? ""}
                          </div>
                          {isCovered && (
                            <div
                              className="absolute inset-[10px] rounded-[12px]"
                              style={{
                                background: "rgba(15,23,42,0.22)",
                                boxShadow:
                                  "inset 0 0 0 1px rgba(15,23,42,0.08)",
                              }}
                            />
                          )}
                          {glyphSrc ? (
                            <img
                              src={glyphSrc}
                              alt={l?.name ?? "glyph"}
                              className={`glyph-img ${isFree ? "glyph-gold-active" : "glyph-gold-dim"} select-none pointer-events-none`}
                              draggable={false}
                              style={{
                                width: Math.round(tileW * 0.62),
                                height: Math.round(tileW * 0.62),
                                transform: glyphTransform(l.id, -2),
                                opacity: isCovered ? 0 : isFree ? 1 : 0.78,
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            <div
                              className="font-extrabold leading-none"
                              style={{
                                fontSize: Math.round(tileW * 0.62),
                                lineHeight: 0.88,
                                transform: "translateY(-4px)",
                                color: "#fff8c8",
                                opacity: isCovered ? 0 : 1,
                              }}
                            >
                              {l?.char ?? "?"}
                            </div>
                          )}
                          <div
                            className="absolute bottom-[6px] left-1/2 -translate-x-1/2 rounded-md px-1.5 py-[1px] font-medium tracking-wide leading-none"
                            style={{
                              fontSize: Math.max(12, Math.round(tileW * 0.18)),
                              color: "#ffffff",
                              background: "rgba(2,6,23,0.62)",
                              border: "1px solid rgba(255,255,255,0.45)",
                              textShadow: "none",
                              opacity: isCovered ? 0 : 1,
                            }}
                          >
                            {l?.name ?? "â€”"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {showWinOverlay && lastMerits !== null && (
                    <div className="absolute inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px]">
                      <div className="mx-4 rounded-3xl border border-emerald-200 bg-emerald-50/95 px-6 py-5 text-center shadow-[0_22px_45px_rgba(2,6,23,0.25)]">
                        <div className="text-4xl font-extrabold tracking-tight text-emerald-800 sm:text-5xl">
                          Mazel Tov
                        </div>
                        <div className="mt-2 text-2xl font-bold text-emerald-700 sm:text-3xl">
                          Ganaste {lastMerits} mÃ©ritos
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>

          <div
            ref={gameTrayRef}
            className="order-1 p-0"
            style={{ width: trayTrackWidth, maxWidth: "100%" }}
          >
            <div className="p-0">
              <div className="flex items-center justify-center gap-0">
                {Array.from({ length: TRAY_LIMIT }).map((_, i) => {
                  const trayIndex = TRAY_LIMIT - 1 - i;
                  const item = tray[trayIndex];
                  const l = item ? letterById.get(item.letterId) : null;
                  const glyphSrc = l ? GLYPH_BY_ID[l.id] || null : null;
                  const glowing = item ? item.glowUntil > Date.now() : false;
                  const matchedOut = item ? item.matchedOut : false;

                  return (
                    <div
                      key={i}
                      className="tray-item star-slot relative flex items-center justify-center"
                      data-glow={glowing && !matchedOut ? "true" : "false"}
                      data-matched={matchedOut ? "true" : "false"}
                      data-filled={item ? "true" : "false"}
                      style={{
                        width: 84,
                        height: 88,
                        marginLeft: i === 0 ? 0 : -8,
                        border: "none",
                        background: "transparent",
                        boxShadow: "none",
                      }}
                    >
                      <svg
                        className="star-outline"
                        viewBox="0 0 100 100"
                        aria-hidden="true"
                      >
                        <polygon points="50,12 84,72 16,72" />
                        <polygon points="50,88 16,28 84,28" />
                      </svg>
                      {item && (
                        <>
                          <div className="tray-flash" />
                          {glyphSrc ? (
                            <img
                              src={glyphSrc}
                              alt={l?.name ?? "glyph"}
                              className="tray-glyph glyph-img glyph-gold-active relative select-none pointer-events-none"
                              draggable={false}
                              style={{
                                width: 36,
                                height: 36,
                                transform: glyphTransform(l.id, -3),
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            <div className="tray-glyph relative text-2xl font-extrabold text-white">
                              {l?.char ?? "?"}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        <div
          className="mx-auto flex w-full max-w-md items-center justify-center gap-2"
          style={{ flex: "0 0 14%", minHeight: 56 }}
        >
          <button
            onClick={undo}
            disabled={history.length === 0}
            className={`ctrl-btn h-9 rounded-full border px-3 text-xs shadow-sm sm:h-10 sm:px-4 sm:text-sm ${
              history.length === 0
                ? "border-slate-200 bg-white/60 text-slate-400"
                : "border-white/30 bg-white/90 text-slate-800 hover:bg-white"
            }`}
          >
            Undo
          </button>
          <button
            onClick={reshuffle}
            disabled={gameState !== "playing"}
            className={`ctrl-btn h-9 rounded-full border px-3 text-xs shadow-sm sm:h-10 sm:px-4 sm:text-sm ${
              gameState !== "playing"
                ? "border-slate-200 bg-white/60 text-slate-400"
                : "border-white/30 bg-white/90 text-slate-800 hover:bg-white"
            }`}
          >
            Barajar
          </button>
          <div className="flex h-9 items-center rounded-full border border-white/30 bg-white/90 px-3 text-xs text-slate-700 shadow-sm sm:h-10 sm:px-4 sm:text-sm">
            Jugadas: {moveCount}
          </div>
        </div>
      </div>
    </div>
  );
}


