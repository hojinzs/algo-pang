"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SupabaseBrowserClient = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;

type GamePhase = "intro" | "playing" | "result" | "collection";
type Category = "Balance" | "Focus&Calm" | "Vital" | "Special Care";

type Supplement = {
  id: string;
  name: string;
  category: Category;
  color: string;
  accent: string;
  image: string;
  productImage: string;
};

type Tile = {
  key: string;
  supplementId: string;
};

type MatchSet = {
  indexes: Set<number>;
  combo: number;
};

type LastRun = {
  score: number;
  seconds: number;
  counts: Record<string, number>;
  pickedIds: string[];
  newIds: string[];
  title: string;
};

type PointerStart = {
  index: number;
  x: number;
  y: number;
};

type DragState = {
  index: number;
  to: number | null;
};

type SwapMotionPhase = "preview" | "commit" | "reject";

type SwapMotion = {
  from: number;
  to: number;
  phase: SwapMotionPhase;
};

type FallingTileOffsets = Record<string, string>;

type Player = {
  userId: string;
  nickname: string;
};

type SyncStatus = "idle" | "saving" | "saved" | "error";

type CollectionRow = {
  supplement_id: string;
  destroyed_count: number;
};

const BOARD_SIZE = 7;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
const ROUND_SECONDS = 60;
const BOOST_TARGET_SCORE = 4200;
const MAX_BOOSTS = 1;
const COLLECTION_KEY = "nutrition-pang-collection-v1";
const PLAYER_NICKNAME_KEY = "nutrition-pang-player-nickname-v1";
const SWAP_THRESHOLD = 18;
const SWAP_ANIMATION_MS = 170;
const CLEAR_PARTICLE_COUNT = 7;

const SUPPLEMENTS: Supplement[] = [
  {
    id: "mv",
    name: "멀티비타민미네랄",
    category: "Balance",
    color: "#ffd55c",
    accent: "#7bb856",
    image: "/assets/supplements/generated/mv.png",
    productImage: "/assets/supplements/product/mv.png",
  },
  {
    id: "mg",
    name: "마그네슘",
    category: "Focus&Calm",
    color: "#f7efe0",
    accent: "#d0c1aa",
    image: "/assets/supplements/generated/mg.png",
    productImage: "/assets/supplements/product/mg.png",
  },
  {
    id: "o3",
    name: "오메가3",
    category: "Balance",
    color: "#d59a45",
    accent: "#9a6b31",
    image: "/assets/supplements/generated/o3.png",
    productImage: "/assets/supplements/product/o3.png",
  },
  {
    id: "pb",
    name: "프로바이오틱스",
    category: "Vital",
    color: "#f3f5ef",
    accent: "#b7c6a4",
    image: "/assets/supplements/generated/pb.png",
    productImage: "/assets/supplements/product/pb.png",
  },
  {
    id: "cm",
    name: "칼슘&마그네슘",
    category: "Balance",
    color: "#f4eee2",
    accent: "#cfc1aa",
    image: "/assets/supplements/generated/cm.png",
    productImage: "/assets/supplements/product/cm.png",
  },
  {
    id: "vd",
    name: "비타민D",
    category: "Balance",
    color: "#ffe88a",
    accent: "#dca71d",
    image: "/assets/supplements/generated/vd.png",
    productImage: "/assets/supplements/product/vd.png",
  },
  {
    id: "mt",
    name: "밀크씨슬",
    category: "Vital",
    color: "#9f7153",
    accent: "#65412e",
    image: "/assets/supplements/generated/mt.png",
    productImage: "/assets/supplements/product/mt.png",
  },
  {
    id: "rt",
    name: "홍경천테아닌",
    category: "Focus&Calm",
    color: "#ece7d8",
    accent: "#a66a50",
    image: "/assets/supplements/generated/rt.png",
    productImage: "/assets/supplements/product/rt.png",
  },
  {
    id: "bn",
    name: "바나바",
    category: "Special Care",
    color: "#efe7c4",
    accent: "#947b42",
    image: "/assets/supplements/generated/bn.png",
    productImage: "/assets/supplements/product/bn.png",
  },
  {
    id: "bw",
    name: "보스웰리아",
    category: "Special Care",
    color: "#f4efe3",
    accent: "#c8a650",
    image: "/assets/supplements/generated/bw.png",
    productImage: "/assets/supplements/product/bw.png",
  },
  {
    id: "gr",
    name: "녹차 카테킨",
    category: "Special Care",
    color: "#d4b064",
    accent: "#7a5732",
    image: "/assets/supplements/generated/gr.png",
    productImage: "/assets/supplements/product/gr.png",
  },
  {
    id: "ml",
    name: "멜라토닌",
    category: "Focus&Calm",
    color: "#f7f2e7",
    accent: "#bbb2a5",
    image: "/assets/supplements/generated/ml.png",
    productImage: "/assets/supplements/product/ml.png",
  },
  {
    id: "lz",
    name: "루테인지아잔틴",
    category: "Special Care",
    color: "#b9864c",
    accent: "#6e4b2c",
    image: "/assets/supplements/generated/lz.png",
    productImage: "/assets/supplements/product/lz.png",
  },
  {
    id: "cq",
    name: "코큐텐",
    category: "Vital",
    color: "#a24d3b",
    accent: "#64271f",
    image: "/assets/supplements/generated/cq.png",
    productImage: "/assets/supplements/product/cq.png",
  },
];
const VALID_SUPPLEMENT_IDS = new Set(SUPPLEMENTS.map((item) => item.id));

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function tileKey() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getRandomSupplementId(ids: string[]) {
  return ids[Math.floor(Math.random() * ids.length)];
}

function createTile(ids: string[]): Tile {
  return {
    key: tileKey(),
    supplementId: getRandomSupplementId(ids),
  };
}

function hasLineAt(board: Tile[], index: number) {
  const id = board[index]?.supplementId;
  if (!id) return false;

  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  let horizontal = 1;
  let vertical = 1;

  for (let nextCol = col - 1; nextCol >= 0; nextCol -= 1) {
    if (board[row * BOARD_SIZE + nextCol]?.supplementId !== id) break;
    horizontal += 1;
  }
  for (let nextCol = col + 1; nextCol < BOARD_SIZE; nextCol += 1) {
    if (board[row * BOARD_SIZE + nextCol]?.supplementId !== id) break;
    horizontal += 1;
  }
  for (let nextRow = row - 1; nextRow >= 0; nextRow -= 1) {
    if (board[nextRow * BOARD_SIZE + col]?.supplementId !== id) break;
    vertical += 1;
  }
  for (let nextRow = row + 1; nextRow < BOARD_SIZE; nextRow += 1) {
    if (board[nextRow * BOARD_SIZE + col]?.supplementId !== id) break;
    vertical += 1;
  }

  return horizontal >= 3 || vertical >= 3;
}

function createBoard(ids: string[]) {
  const board: Tile[] = [];

  for (let index = 0; index < BOARD_CELLS; index += 1) {
    let tile = createTile(ids);
    let guard = 0;
    while ([...board, tile].length > 2 && hasLineAt([...board, tile], index)) {
      tile = createTile(ids);
      guard += 1;
      if (guard > 20) break;
    }
    board.push(tile);
  }

  return board;
}

function hasAvailableMove(board: Tile[]) {
  for (let index = 0; index < BOARD_CELLS; index += 1) {
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    const candidates = [
      col < BOARD_SIZE - 1 ? index + 1 : null,
      row < BOARD_SIZE - 1 ? index + BOARD_SIZE : null,
    ];

    for (const target of candidates) {
      if (target === null) continue;
      if (findMatches(swapTiles(board, index, target))) return true;
    }
  }

  return false;
}

function createPlayableBoard(ids: string[]) {
  let board = createBoard(ids);
  let guard = 0;

  while (!hasAvailableMove(board) && guard < 80) {
    board = createBoard(ids);
    guard += 1;
  }

  return board;
}

function findMatches(board: Tile[]): MatchSet | null {
  const indexes = new Set<number>();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let streakStart = 0;
    for (let col = 1; col <= BOARD_SIZE; col += 1) {
      const current = col < BOARD_SIZE ? board[row * BOARD_SIZE + col] : null;
      const previous = board[row * BOARD_SIZE + col - 1];
      if (current && previous && current.supplementId === previous.supplementId) continue;

      if (col - streakStart >= 3) {
        for (let matchCol = streakStart; matchCol < col; matchCol += 1) {
          indexes.add(row * BOARD_SIZE + matchCol);
        }
      }
      streakStart = col;
    }
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let streakStart = 0;
    for (let row = 1; row <= BOARD_SIZE; row += 1) {
      const current = row < BOARD_SIZE ? board[row * BOARD_SIZE + col] : null;
      const previous = board[(row - 1) * BOARD_SIZE + col];
      if (current && previous && current.supplementId === previous.supplementId) continue;

      if (row - streakStart >= 3) {
        for (let matchRow = streakStart; matchRow < row; matchRow += 1) {
          indexes.add(matchRow * BOARD_SIZE + col);
        }
      }
      streakStart = row;
    }
  }

  if (!indexes.size) return null;
  return { indexes, combo: 1 };
}

function collapseBoard(board: Tile[], matched: Set<number>, ids: string[]) {
  const next = [...board];

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const survivors: Tile[] = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const index = row * BOARD_SIZE + col;
      if (!matched.has(index)) survivors.push(next[index]);
    }

    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const survivor = survivors[BOARD_SIZE - 1 - row];
      next[row * BOARD_SIZE + col] = survivor ?? createTile(ids);
    }
  }

  return next;
}

function getFallingOffsets(previousBoard: Tile[], nextBoard: Tile[]) {
  const previousIndexes = new Map(previousBoard.map((tile, index) => [tile.key, index]));
  const offsets: FallingTileOffsets = {};

  nextBoard.forEach((tile, index) => {
    const row = Math.floor(index / BOARD_SIZE);
    const previousIndex = previousIndexes.get(tile.key);
    const previousRow = previousIndex === undefined ? -2 : Math.floor(previousIndex / BOARD_SIZE);
    const rowDistance = previousIndex === undefined ? row + 2 : row - previousRow;

    if (rowDistance > 0) {
      offsets[tile.key] = `-${rowDistance * 112}%`;
    }
  });

  return offsets;
}

function getInitialFallingOffsets(board: Tile[]) {
  return Object.fromEntries(
    board.map((tile, index) => [tile.key, `-${(Math.floor(index / BOARD_SIZE) + 2) * 112}%`]),
  );
}

function isAdjacent(from: number, to: number) {
  const diff = Math.abs(from - to);
  if (diff === BOARD_SIZE) return true;
  return diff === 1 && Math.floor(from / BOARD_SIZE) === Math.floor(to / BOARD_SIZE);
}

function getSwipeTarget(from: number, deltaX: number, deltaY: number) {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWAP_THRESHOLD) return null;

  const to =
    Math.abs(deltaX) > Math.abs(deltaY)
      ? from + (deltaX > 0 ? 1 : -1)
      : from + (deltaY > 0 ? BOARD_SIZE : -BOARD_SIZE);

  return isAdjacent(from, to) ? to : null;
}

function getSwapOffset(index: number, motion: SwapMotion | null) {
  if (!motion || (index !== motion.from && index !== motion.to)) return { x: "0px", y: "0px" };

  const diff = motion.to - motion.from;
  if (Math.abs(diff) === 1) {
    const movesRight = (index === motion.from && diff > 0) || (index === motion.to && diff < 0);
    return {
      x: movesRight ? "calc(100% + var(--board-gap))" : "calc(-100% - var(--board-gap))",
      y: "0px",
    };
  }

  const movesDown = (index === motion.from && diff > 0) || (index === motion.to && diff < 0);
  return {
    x: "0px",
    y: movesDown ? "calc(100% + var(--board-gap))" : "calc(-100% - var(--board-gap))",
  };
}

function swapTiles(board: Tile[], from: number, to: number) {
  const next = [...board];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function pickRunSupplements() {
  return shuffle(SUPPLEMENTS).slice(0, 6);
}

function getResultTitle(score: number, counts: Record<string, number>) {
  const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topName = SUPPLEMENTS.find((item) => item.id === topId)?.name ?? "영양제";

  if (score >= 10000) return `${topName} 버튼 고장난 듯`;
  if (score >= 7000) return `${topName}만 보면 손이 먼저 나감`;
  if (score >= 4000) return `내 손가락만 유산소 중`;
  return `${topName} 도감에 인생 걸었음`;
}

function readCollection() {
  if (typeof window === "undefined") return {};
  try {
    const saved = JSON.parse(localStorage.getItem(COLLECTION_KEY) ?? "{}") as Record<string, number>;
    return Object.fromEntries(
      Object.entries(saved).filter(([id, value]) => VALID_SUPPLEMENT_IDS.has(id) && Number.isFinite(value)),
    );
  } catch {
    return {};
  }
}

function writeCollection(collection: Record<string, number>) {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
}

function normalizeNickname(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function validateNickname(value: string) {
  const nickname = normalizeNickname(value);
  if (nickname.length < 2) return "닉네임은 2자 이상으로 입력해주세요.";
  if (nickname.length > 16) return "닉네임은 16자 이하로 입력해주세요.";
  return "";
}

function collectionFromRows(rows: CollectionRow[] | null) {
  return Object.fromEntries(
    (rows ?? [])
      .filter((row) => VALID_SUPPLEMENT_IDS.has(row.supplement_id) && Number.isFinite(row.destroyed_count))
      .map((row) => [row.supplement_id, row.destroyed_count]),
  );
}

async function loadRemoteCollection(client: SupabaseBrowserClient, userId: string) {
  const { data, error } = await client
    .from("player_collections")
    .select("supplement_id, destroyed_count")
    .eq("user_id", userId);

  if (error) throw error;

  return collectionFromRows(data as CollectionRow[] | null);
}

async function persistRunResult(
  client: SupabaseBrowserClient,
  player: Player,
  run: LastRun,
  nextCollection: Record<string, number>,
) {
  const { error: runError } = await client.from("game_runs").insert({
    user_id: player.userId,
    score: run.score,
    seconds: run.seconds,
    destroyed_counts: run.counts,
    picked_ids: run.pickedIds,
    new_ids: run.newIds,
    title: run.title,
  });

  if (runError) throw runError;

  const collectionRows = Object.entries(nextCollection)
    .filter(([id, count]) => VALID_SUPPLEMENT_IDS.has(id) && count > 0)
    .map(([id, count]) => ({
      user_id: player.userId,
      supplement_id: id,
      destroyed_count: count,
      updated_at: new Date().toISOString(),
    }));

  if (!collectionRows.length) return;

  const { error: collectionError } = await client
    .from("player_collections")
    .upsert(collectionRows, { onConflict: "user_id,supplement_id" });

  if (collectionError) throw collectionError;
}

export function NutritionPangGame() {
  const [phase, setPhase] = useState<GamePhase>("intro");
  const [player, setPlayer] = useState<Player | null>(null);
  const [nickname, setNickname] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(PLAYER_NICKNAME_KEY) ?? "";
  });
  const [authError, setAuthError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState("");
  const [runSupplements, setRunSupplements] = useState<Supplement[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [boostScore, setBoostScore] = useState(0);
  const [boosts, setBoosts] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [collection, setCollection] = useState<Record<string, number>>({});
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [swapMotion, setSwapMotion] = useState<SwapMotion | null>(null);
  const [clearingIndexes, setClearingIndexes] = useState<Set<number>>(new Set());
  const [fallingTileKeys, setFallingTileKeys] = useState<Set<string>>(new Set());
  const [fallingOffsets, setFallingOffsets] = useState<FallingTileOffsets>({});
  const [boardNotice, setBoardNotice] = useState("");
  const pointerStart = useRef<PointerStart | null>(null);
  const boardRef = useRef<Tile[]>([]);
  const boardVersionRef = useRef(0);
  const phaseRef = useRef(phase);
  const resolveMatchesRef = useRef<(initialBoard: Tile[], expectedVersion?: number, combo?: number) => void>(
    () => {},
  );
  const countsRef = useRef(counts);
  const scoreRef = useRef(score);
  const pickedIdsRef = useRef<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const supplementsById = useMemo(
    () => Object.fromEntries(SUPPLEMENTS.map((item) => [item.id, item])),
    [],
  );
  const runIds = useMemo(() => runSupplements.map((item) => item.id), [runSupplements]);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    const client = supabase;

    async function loadExistingPlayer() {
      const {
        data: { session },
      } = await client.auth.getSession();
      const userId = session?.user.id;

      if (!userId) return;

      const { data } = await client
        .from("player_profiles")
        .select("nickname")
        .eq("user_id", userId)
        .maybeSingle();

      if (!isMounted) return;

      const savedNickname = typeof data?.nickname === "string" ? data.nickname : "";
      setPlayer({ userId, nickname: savedNickname });
      if (savedNickname) {
        setNickname(savedNickname);
        localStorage.setItem(PLAYER_NICKNAME_KEY, savedNickname);
      }

      try {
        const remoteCollection = await loadRemoteCollection(client, userId);
        if (!isMounted) return;
        writeCollection(remoteCollection);
        setCollection(remoteCollection);
      } catch (error) {
        if (!isMounted) return;
        setSyncStatus("error");
        setSyncError(error instanceof Error ? error.message : "도감을 불러오지 못했습니다.");
      }
    }

    void loadExistingPlayer();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    countsRef.current = counts;
  }, [counts]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const playTone = useCallback((kind: "match" | "boost" | "end") => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return;

    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const frequency = kind === "boost" ? 220 : kind === "end" ? 180 : 520;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "boost" ? 0.08 : 0.04, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  }, []);

  const addScore = useCallback((points: number, feedsBoost = true) => {
    setScore((current) => current + points);
    if (feedsBoost) {
      setBoostScore((current) => {
        const next = current + points;
        if (next >= BOOST_TARGET_SCORE) {
          setBoosts((boostCount) => Math.min(MAX_BOOSTS, boostCount + 1));
          return next - BOOST_TARGET_SCORE;
        }
        return next;
      });
    }
  }, []);

  const applyCounts = useCallback((matchedTiles: Tile[]) => {
    const nextCounts = { ...countsRef.current };
    for (const tile of matchedTiles) {
      nextCounts[tile.supplementId] = (nextCounts[tile.supplementId] ?? 0) + 1;
    }
    countsRef.current = nextCounts;
    setCounts((current) => {
      const next = { ...current };
      for (const tile of matchedTiles) {
        next[tile.supplementId] = (next[tile.supplementId] ?? 0) + 1;
      }
      return next;
    });
  }, []);

  const reshuffleBoard = useCallback(
    async (expectedVersion = boardVersionRef.current) => {
      if (expectedVersion !== boardVersionRef.current || phaseRef.current !== "playing") return;

      setIsResolving(true);
      setSelectedIndex(null);
      setDragState(null);
      setSwapMotion(null);
      setBoardNotice("이동 없음 · 다시 섞는 중");

      await new Promise((resolve) => window.setTimeout(resolve, 620));

      if (expectedVersion !== boardVersionRef.current || phaseRef.current !== "playing") {
        setBoardNotice("");
        setIsResolving(false);
        return;
      }

      const nextBoard = createPlayableBoard(runIds);
      boardVersionRef.current += 1;
      boardRef.current = nextBoard;
      setBoard(nextBoard);
      setClearingIndexes(new Set());
      setFallingOffsets(getInitialFallingOffsets(nextBoard));
      setFallingTileKeys(new Set(nextBoard.map((tile) => tile.key)));
      setBoardNotice("");
      setIsResolving(false);
    },
    [runIds],
  );

  const resolveMatches = useCallback(
    async (initialBoard: Tile[], expectedVersion = boardVersionRef.current, combo = 1) => {
      if (expectedVersion !== boardVersionRef.current) return;

      const match = findMatches(initialBoard);
      if (!match) {
        if (!hasAvailableMove(initialBoard)) {
          await reshuffleBoard(expectedVersion);
          return;
        }
        setIsResolving(false);
        return;
      }

      setIsResolving(true);
      const matchedTiles = [...match.indexes].map((index) => initialBoard[index]);
      const points = matchedTiles.length * 90 * combo;
      applyCounts(matchedTiles);
      addScore(points);
      setSecondsLeft((current) => Math.min(ROUND_SECONDS + 20, current + (combo === 1 ? 1 : 2)));
      playTone("match");
      setClearingIndexes(new Set(match.indexes));
      await new Promise((resolve) => window.setTimeout(resolve, 210));

      if (expectedVersion !== boardVersionRef.current) {
        setClearingIndexes(new Set());
        setIsResolving(false);
        return;
      }

      const collapsedBoard = collapseBoard(initialBoard, match.indexes, runIds);
      const falling = getFallingOffsets(initialBoard, collapsedBoard);
      boardVersionRef.current += 1;
      const nextVersion = boardVersionRef.current;
      boardRef.current = collapsedBoard;
      setFallingOffsets(falling);
      setFallingTileKeys(new Set(Object.keys(falling)));
      setBoard(collapsedBoard);
      setClearingIndexes(new Set());
      setIsResolving(false);

      window.setTimeout(() => {
        if (boardVersionRef.current !== nextVersion) return;
        resolveMatchesRef.current(boardRef.current, nextVersion, combo + 1);
      }, 540);
    },
    [addScore, applyCounts, playTone, reshuffleBoard, runIds],
  );

  useEffect(() => {
    resolveMatchesRef.current = resolveMatches;
  }, [resolveMatches]);

  const finishGame = useCallback(() => {
    const finalCounts = countsRef.current;
    const finalScore = scoreRef.current;
    const pickedIds = pickedIdsRef.current;
    const previousCollection = readCollection();
    const nextCollection = { ...previousCollection };
    const newIds: string[] = [];

    for (const [id, count] of Object.entries(finalCounts)) {
      if (!previousCollection[id]) newIds.push(id);
      nextCollection[id] = (nextCollection[id] ?? 0) + count;
    }

    const nextRun = {
      score: finalScore,
      seconds: elapsedSeconds,
      counts: finalCounts,
      pickedIds,
      newIds,
      title: getResultTitle(finalScore, finalCounts),
    };

    writeCollection(nextCollection);
    setCollection(nextCollection);
    setLastRun(nextRun);
    setSyncStatus(supabase && player ? "saving" : "idle");
    setSyncError("");
    playTone("end");
    setPhase("result");

    if (!supabase || !player) return;

    void persistRunResult(supabase, player, nextRun, nextCollection)
      .then(() => {
        setSyncStatus("saved");
      })
      .catch((error) => {
        setSyncStatus("error");
        setSyncError(error instanceof Error ? error.message : "결과 저장에 실패했습니다.");
      });
  }, [elapsedSeconds, player, playTone, supabase]);

  useEffect(() => {
    if (phase !== "playing") return;

    const timer = window.setTimeout(() => {
      setElapsedSeconds((current) => current + 1);
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.setTimeout(finishGame, 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [finishGame, phase, secondsLeft]);

  const ensurePlayer = useCallback(async () => {
    const nextNickname = normalizeNickname(nickname);
    const validationError = validateNickname(nextNickname);

    if (validationError) {
      setAuthError(validationError);
      return null;
    }

    if (!supabase) {
      setAuthError("Supabase 환경 변수가 아직 설정되지 않았습니다.");
      return null;
    }

    setIsSigningIn(true);
    setAuthError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let userId = session?.user.id;

      if (!userId) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        userId = data.user?.id;
      }

      if (!userId) {
        throw new Error("익명 사용자 ID를 만들지 못했습니다.");
      }

      const { error: profileError } = await supabase.from("player_profiles").upsert({
        user_id: userId,
        nickname: nextNickname,
      });

      if (profileError) throw profileError;

      let remoteCollection: Record<string, number> | null = null;
      try {
        remoteCollection = await loadRemoteCollection(supabase, userId);
      } catch (error) {
        setSyncStatus("error");
        setSyncError(error instanceof Error ? error.message : "도감을 불러오지 못했습니다.");
      }

      if (remoteCollection) {
        writeCollection(remoteCollection);
        setCollection(remoteCollection);
      }

      localStorage.setItem(PLAYER_NICKNAME_KEY, nextNickname);
      const nextPlayer = { userId, nickname: nextNickname };
      setPlayer(nextPlayer);
      setNickname(nextNickname);
      return nextPlayer;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "익명 로그인에 실패했습니다.");
      return null;
    } finally {
      setIsSigningIn(false);
    }
  }, [nickname, supabase]);

  const startGame = useCallback(async () => {
    if (!(await ensurePlayer())) return;

    const picked = pickRunSupplements();
    const ids = picked.map((item) => item.id);
    const nextBoard = createPlayableBoard(ids);

    setCollection(readCollection());
    pickedIdsRef.current = ids;
    boardRef.current = nextBoard;
    boardVersionRef.current += 1;
    setRunSupplements(picked);
    setBoard(nextBoard);
    setFallingOffsets(getInitialFallingOffsets(nextBoard));
    setFallingTileKeys(new Set(nextBoard.map((tile) => tile.key)));
    setScore(0);
    setSecondsLeft(ROUND_SECONDS);
    setElapsedSeconds(0);
    const initialCounts = Object.fromEntries(ids.map((id) => [id, 0]));
    countsRef.current = initialCounts;
    setCounts(initialCounts);
    setBoostScore(0);
    setBoosts(0);
    setLastRun(null);
    setCopied(false);
    setSyncStatus("idle");
    setSyncError("");
    setSelectedIndex(null);
    setDragState(null);
    setSwapMotion(null);
    setBoardNotice("");
    setFallingOffsets({});
    setClearingIndexes(new Set());
    setPhase("playing");
  }, [ensurePlayer]);

  const handleTileTarget = useCallback(
    async (from: number, to: number) => {
      if (phase !== "playing" || isResolving || !isAdjacent(from, to)) return;
      const swapped = swapTiles(board, from, to);

      setIsResolving(true);
      setSelectedIndex(null);
      setDragState(null);

      if (!findMatches(swapped)) {
        setSecondsLeft((current) => Math.max(0, current - 2));
        setSwapMotion({ from, to, phase: "reject" });
        window.setTimeout(() => {
          setSwapMotion(null);
          setIsResolving(false);
        }, SWAP_ANIMATION_MS);
        return;
      }

      setSwapMotion({ from, to, phase: "commit" });
      await new Promise((resolve) => window.setTimeout(resolve, SWAP_ANIMATION_MS));
      boardVersionRef.current += 1;
      const nextVersion = boardVersionRef.current;
      boardRef.current = swapped;
      setSwapMotion(null);
      setBoard(swapped);
      void resolveMatches(swapped, nextVersion);
    },
    [board, isResolving, phase, resolveMatches],
  );

  const useBoost = useCallback(() => {
    if (phase !== "playing" || isResolving || boosts <= 0) return;

    const frequency = new Map<string, number>();
    for (const tile of board) {
      frequency.set(tile.supplementId, (frequency.get(tile.supplementId) ?? 0) + 1);
    }
    const targetId = [...frequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!targetId) return;

    const matchedIndexes = new Set<number>();
    const matchedTiles: Tile[] = [];
    board.forEach((tile, index) => {
      if (tile.supplementId === targetId) {
        matchedIndexes.add(index);
        matchedTiles.push(tile);
      }
    });

    setBoosts((current) => Math.max(0, current - 1));
    setBoostScore(0);
    applyCounts(matchedTiles);
    addScore(matchedTiles.length * 120, false);
    playTone("boost");
    setIsResolving(true);
    setClearingIndexes(new Set(matchedIndexes));

    window.setTimeout(() => {
      if (phase !== "playing") return;
      const nextBoard = collapseBoard(board, matchedIndexes, runIds);
      const falling = getFallingOffsets(board, nextBoard);
      boardVersionRef.current += 1;
      const nextVersion = boardVersionRef.current;
      boardRef.current = nextBoard;
      setClearingIndexes(new Set());
      setFallingOffsets(falling);
      setFallingTileKeys(new Set(Object.keys(falling)));
      setBoard(nextBoard);
      setIsResolving(false);
      window.setTimeout(() => {
        if (boardVersionRef.current !== nextVersion) return;
        void resolveMatches(boardRef.current, nextVersion);
      }, 540);
    }, 260);
  }, [addScore, applyCounts, board, boosts, isResolving, phase, playTone, resolveMatches, runIds]);

  const shareResult = useCallback(async () => {
    if (!lastRun) return;

    const text = `뉴트리션 팡 ${lastRun.score.toLocaleString()}점 - ${lastRun.title} / 도감 ${Object.keys(collection).length}/${SUPPLEMENTS.length}`;
    const url = window.location.href;

    if (navigator.share) {
      await navigator.share({
        title: "뉴트리션 팡",
        text,
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(`${text} ${url}`);
    setCopied(true);
  }, [collection, lastRun]);

  const collectionCount = Object.keys(collection).length;
  const boostProgress = Math.min(100, Math.round((boostScore / BOOST_TARGET_SCORE) * 100));
  const undiscovered = SUPPLEMENTS.filter((item) => !collection[item.id]);
  const resultPickedIds = lastRun?.pickedIds.filter((id) => supplementsById[id]) ?? [];
  const resultNewIds = lastRun?.newIds.filter((id) => supplementsById[id]) ?? [];
  const resultDestroyedIds = resultPickedIds.filter((id) => (lastRun?.counts[id] ?? 0) > 0);
  const resultDestroyedTotal = resultDestroyedIds.reduce((sum, id) => sum + (lastRun?.counts[id] ?? 0), 0);
  const hasOverlay = phase !== "playing";
  const canPlay = phase === "playing" && board.length > 0;

  return (
    <main className={`game-shell ${hasOverlay ? "has-overlay" : ""}`}>
      <section className="screen play-screen" aria-label="뉴트리션 팡 플레이" aria-hidden={hasOverlay}>
          <div className="device-face" aria-label="알고케어 디스펜서 화면">
            <div className="device-screen">
              <div className="screen-shine" />
              <AlgocareLogo />
              <div className="device-metrics">
                <div>
                  <span>점수</span>
                  <strong>{score.toLocaleString()}</strong>
                </div>
                <div>
                  <span>시간</span>
                  <strong>{secondsLeft}s</strong>
                </div>
              </div>
            </div>
            <div className="device-throat">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div
            className={`board ${isResolving ? "is-resolving" : ""}`}
            onPointerCancel={() => {
              pointerStart.current = null;
              setDragState(null);
              if (!isResolving) setSwapMotion(null);
            }}
            onPointerLeave={() => {
              pointerStart.current = null;
              setDragState(null);
              if (!isResolving) setSwapMotion(null);
            }}
          >
            {board.length === 0 && <div className="board-empty" aria-hidden="true" />}
            {board.map((tile, index) => {
              const supplement = supplementsById[tile.supplementId];
              const swapOffset = getSwapOffset(index, swapMotion);
              const isSwapTile = Boolean(swapMotion && (swapMotion.from === index || swapMotion.to === index));
              const isDragging = dragState?.index === index;
              const isSelected = selectedIndex === index;
              const isClearing = clearingIndexes.has(index);
              const isFalling = fallingTileKeys.has(tile.key);
              return (
                <button
                  className={[
                    "tile",
                    isFalling ? "is-falling" : "",
                    isDragging ? "is-dragging" : "",
                    isSwapTile ? "is-swapping" : "",
                    swapMotion?.phase === "commit" && isSwapTile ? "is-swap-commit" : "",
                    swapMotion?.phase === "reject" && isSwapTile ? "is-swap-reject" : "",
                    isSelected ? "is-selected" : "",
                    isClearing ? "is-clearing" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={tile.key}
                  onPointerDown={(event) => {
                    if (!canPlay || isResolving || swapMotion) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    pointerStart.current = {
                      index,
                      x: event.clientX,
                      y: event.clientY,
                    };
                    setSelectedIndex(index);
                    setDragState({ index, to: null });
                  }}
                  onPointerMove={(event) => {
                    const start = pointerStart.current;
                    if (!canPlay || !start || start.index !== index || isResolving) return;
                    const target = getSwipeTarget(start.index, event.clientX - start.x, event.clientY - start.y);
                    setDragState({ index, to: target });
                    setSwapMotion(target === null ? null : { from: start.index, to: target, phase: "preview" });
                  }}
                  onPointerUp={(event) => {
                    const start = pointerStart.current;
                    pointerStart.current = null;
                    if (!start) return;

                    const deltaX = event.clientX - start.x;
                    const deltaY = event.clientY - start.y;
                    const target = dragState?.to ?? getSwipeTarget(start.index, deltaX, deltaY);
                    setDragState(null);
                    if (target === null) {
                      setSwapMotion(null);
                      if (selectedIndex !== null && selectedIndex !== index && isAdjacent(selectedIndex, index)) {
                        void handleTileTarget(selectedIndex, index);
                      }
                      return;
                    }

                    void handleTileTarget(start.index, target);
                  }}
                  onAnimationEnd={() => {
                    if (!fallingTileKeys.has(tile.key)) return;
                    setFallingTileKeys((current) => {
                      const next = new Set(current);
                      next.delete(tile.key);
                      return next;
                    });
                    setFallingOffsets((current) => {
                      const next = { ...current };
                      delete next[tile.key];
                      return next;
                    });
                  }}
                  style={
                    {
                      "--tile": supplement.color,
                      "--tile-accent": supplement.accent,
                      "--swap-x": swapOffset.x,
                      "--swap-y": swapOffset.y,
                      "--fall-delay": `${Math.floor(index / BOARD_SIZE) * 26}ms`,
                      "--fall-distance": fallingOffsets[tile.key] ?? "-224%",
                    } as React.CSSProperties
                  }
                  type="button"
                  aria-label={supplement.name}
                >
                  {isClearing && (
                    <span className="clear-particles" aria-hidden="true">
                      {Array.from({ length: CLEAR_PARTICLE_COUNT }, (_, particleIndex) => (
                        <span className="clear-particle" key={particleIndex} />
                      ))}
                    </span>
                  )}
                  <Image
                    className="pill-image"
                    src={supplement.image}
                    alt=""
                    width={96}
                    height={132}
                    draggable={false}
                    unoptimized
                  />
                </button>
              );
            })}
            {boardNotice && (
              <div className="board-notice" role="status">
                {boardNotice}
              </div>
            )}
          </div>

          <div className="boost-panel">
            <button
              className={`boost-button ${boosts > 0 ? "is-ready" : ""}`}
              disabled={!canPlay || boosts <= 0 || isResolving}
              onClick={useBoost}
              style={
                {
                  "--boost-progress": `${boosts > 0 ? 100 : boostProgress}%`,
                } as React.CSSProperties
              }
              type="button"
            >
              <span>부스트팩 {boosts > 0 ? `${boosts}개` : `${boostProgress}%`}</span>
            </button>
          </div>
      </section>

      {hasOverlay && (
        <div className="overlay-layer" role="presentation">
          {phase === "intro" && (
            <section className="overlay-panel intro-screen" aria-labelledby="game-title">
              <div className="intro-copy">
                <p className="eyebrow">Algocare inspired match game</p>
                <h1 id="game-title">뉴트리션 팡</h1>
                <p>영양제를 맞추고 부스트팩을 터뜨려 아직 못 본 뉴트리션을 찾아보세요.</p>
              </div>
              <div className="rule-list" aria-label="게임 핵심 규칙">
                <p>같은 영양제 3개를 맞춰 격파</p>
                <p>60초 안에 최대한 오래 버티기</p>
                <p>부스트팩으로 한 종류를 한 번에 팡</p>
              </div>
              <form
                className="nickname-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void startGame();
                }}
              >
                <label htmlFor="player-nickname">닉네임</label>
                <input
                  id="player-nickname"
                  maxLength={16}
                  minLength={2}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setAuthError("");
                  }}
                  placeholder="예: 뉴트리션마스터"
                  required
                  value={nickname}
                />
                <span>{player ? `${player.nickname} 기록으로 이어서 플레이` : "결과와 도감을 저장할 이름이에요"}</span>
                {authError && <strong role="alert">{authError}</strong>}
                <button className="primary-button" disabled={isSigningIn} type="submit">
                  {isSigningIn ? "준비 중..." : "시작하기"}
                </button>
              </form>
              <button
                className="ghost-button"
                onClick={() => {
                  setCollection(readCollection());
                  setPhase("collection");
                }}
                type="button"
              >
                도감 보기 {collectionCount}/{SUPPLEMENTS.length}
              </button>
            </section>
          )}

          {phase === "result" && lastRun && (
            <section className="overlay-panel result-screen" aria-labelledby="result-title">
              <div className="result-hero">
                <p className="eyebrow">Result</p>
                <h1 id="result-title">{lastRun.title}</h1>
                <strong>{lastRun.score.toLocaleString()}점</strong>
                <span>
                  {lastRun.seconds}초 생존 · 영양제 {resultDestroyedTotal.toLocaleString()}개 격파
                </span>
                {syncStatus !== "idle" && (
                  <em className={`sync-status ${syncStatus === "error" ? "is-error" : ""}`} role="status">
                    {syncStatus === "saving" && "기록 저장 중..."}
                    {syncStatus === "saved" && "기록 저장 완료"}
                    {syncStatus === "error" && `저장 실패 · ${syncError}`}
                  </em>
                )}
              </div>

              <div className="result-summary" aria-label="격파 요약">
                <span>부순 영양제</span>
                <strong>{resultDestroyedTotal.toLocaleString()}개</strong>
              </div>

              <div className="result-list">
                {resultDestroyedIds.length === 0 && (
                  <div className="result-empty">이번 판에서 격파한 영양제가 없습니다</div>
                )}
                {resultDestroyedIds.map((id) => {
                  const supplement = supplementsById[id];
                  return (
                    <div className="result-row" key={id}>
                      <MiniPill supplement={supplement} />
                      <span>{supplement.name}</span>
                      <strong>{lastRun.counts[id] ?? 0}개</strong>
                    </div>
                  );
                })}
              </div>

              {resultNewIds.length > 0 && (
                <div className="callout">
                  새 영양제 {resultNewIds.length}종 발견:{" "}
                  {resultNewIds.map((id) => supplementsById[id].name).join(", ")}
                </div>
              )}

              <button
                className="mystery-card"
                onClick={() => {
                  setCollection(readCollection());
                  setPhase("collection");
                }}
                type="button"
              >
                <span>아직 미발견 영양제가 있습니다</span>
                <span className="mystery-row">
                  {undiscovered.slice(0, 3).map((item) => (
                    <span className="mystery-pill" key={item.id} />
                  ))}
                </span>
                <strong>
                  도감 {collectionCount}/{SUPPLEMENTS.length}
                </strong>
              </button>

              <div className="action-grid">
                <button className="primary-button" onClick={startGame} type="button">
                  다시 하기
                </button>
                <button className="secondary-button" onClick={shareResult} type="button">
                  {copied ? "링크 복사됨" : "공유하기"}
                </button>
              </div>
            </section>
          )}

          {phase === "collection" && (
            <section className="overlay-panel collection-screen" aria-labelledby="collection-title">
              <div className="screen-header">
                <div>
                  <p className="eyebrow">Collection</p>
                  <h1 id="collection-title">뉴트리션 도감</h1>
                </div>
                <button className="ghost-button compact" onClick={() => setPhase(lastRun ? "result" : "intro")} type="button">
                  닫기
                </button>
              </div>

              <div className="collection-grid">
                {SUPPLEMENTS.map((supplement) => {
                  const found = Boolean(collection[supplement.id]);
                  return (
                    <article className={`collection-item ${found ? "" : "locked"}`} key={supplement.id}>
                      {found ? <MiniPill supplement={supplement} /> : <span className="mystery-pill large" />}
                      <strong>{found ? supplement.name : "???"}</strong>
                      <span>{found ? supplement.category : "미발견"}</span>
                      {found && <small>누적 {collection[supplement.id]}개</small>}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function AlgocareLogo() {
  return (
    <div className="device-logo" aria-label="algocare">
      <svg
        aria-hidden="true"
        className="device-logo-mark"
        role="img"
        viewBox="0 0 258 258"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="currentColor"
          d="M128.95,0C57.74,0,0,57.74,0,128.95s57.74,128.95,128.95,128.95,128.95-57.74,128.95-128.95S200.15,0,128.95,0Z"
        />
        <path
          fill="var(--logo-cutout)"
          d="M192.5,117.66v-53.56c0-1.38-1.1-2.46-2.48-2.46h-20.13c-1.35,0-2.48,1.11-2.48,2.46v20.08c0,.28-.35.37-.5.12-6.46-10.47-22.83-19.19-43.78-19.19-33.84,0-64.19,26.63-64.19,63.82s30.39,63.82,64.19,63.82c20.95,0,37.32-9.46,43.78-19.93.16-.25.5-.12.5.12v20.85c0,1.38,1.1,2.46,2.48,2.46h20.13c1.35,0,2.48-1.1,2.48-2.46v-53.56c0-1.5-1.26-2.73-2.79-2.73h-19.44c-1.25,0-2.38.83-2.7,2.03-4.74,18.15-21.32,31.57-41.05,31.57-23.39,0-42.4-18.92-42.4-42.14s19.03-42.14,42.4-42.14c19.69,0,36.31,13.45,41.05,31.57.31,1.2,1.44,2.03,2.7,2.03h19.44c1.54,0,2.79-1.23,2.79-2.73"
        />
        <path
          fill="var(--logo-cutout)"
          d="M145.59,128.96c0,10.32-8.53,18.7-19.1,18.7s-19.1-8.35-19.1-18.7,8.53-18.67,19.1-18.67,19.1,8.35,19.1,18.67Z"
        />
      </svg>
      <span>algocare</span>
    </div>
  );
}

function MiniPill({ supplement }: { supplement: Supplement }) {
  return (
    <span className="mini-pill">
      <Image
        className="pill-image"
        src={supplement.image}
        alt=""
        width={48}
        height={64}
        draggable={false}
        unoptimized
      />
    </span>
  );
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
