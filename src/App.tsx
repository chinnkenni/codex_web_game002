import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bed,
  Bell,
  BookOpen,
  Circle,
  Copy,
  Eye,
  Feather,
  Gem,
  Hourglass,
  Lock,
  Moon,
  Play,
  ScrollText,
  Shield,
  ShoppingCart,
  Skull,
  Sparkles,
  Sword,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";

const STORAGE_KEY = "dream-memory-grid-run-v10";
const DREAM_AUDIO_SRC = new URL("./assets/audio/dreamcore-memory-loop.mp3", import.meta.url).href;
const GRID_COLUMNS = 5;
const GRID_ROWS = 6;
const STARTING_TIME = 210;
const REFILL_EMPTY_THRESHOLD = 3;
const MATCH_SUCCESS_FEEDBACK_MS = 1320;
const COLLECTED_CARD_HIDE_MS = 1120;
const REFILL_MATERIALIZE_MS = 1850;
const MISMATCH_FEEDBACK_MS = 620;
const QUICK_SUCCESS_WINDOW_MS = 6500;

type NodeType = "normal" | "elite" | "shop" | "rest" | "boss";
type Phase = "level" | "map" | "reward" | "shop" | "rest" | "victory" | "gameover";
type CardKind = "fragment" | "utility" | "hazard" | "treasure";
type UtilityEffect =
  | "time"
  | "preview"
  | "protect"
  | "copy"
  | "lock"
  | "energy"
  | "penalty"
  | "shuffle"
  | "seal"
  | "mist"
  | "false-energy";
type Tone = "gold" | "teal" | "violet" | "blue" | "green" | "paper" | "back" | "danger";
type ShopItemId = "scroll" | "rewind" | "lock" | "copy" | "refresh";
type ShopItemKind = "supply" | "refresh";
type BuildTag = "技能" | "棋盘" | "被动" | "梦种";
type CardFaceLayout = "single" | "vertical" | "horizontal" | "large" | "shape";
type ArchiveCollectibleKind = CardKind | "build" | "shop" | "seed";
type ArchiveTab = "collectibles" | "levels" | "build";
type AudioPlaybackState = "idle" | "playing" | "blocked";
type CardFaceProfile = {
  showIcon: boolean;
  showSecondary: boolean;
  iconSize: number;
  gap: number;
  padding: string;
  titleGap: number;
  titleSize: string;
  titleLineHeight: string;
  titleWhiteSpace: "normal" | "nowrap";
  titleSafeUnits: number;
  titleMaxUnits: number;
  titleMinScale: number;
  titleMaxWidth: string;
  detailDirection: "row" | "column";
  detailGap: number;
  pillPadding: string;
  pillSize: string;
  pillLineHeight: string;
  detailSize: string;
  detailLineHeight: string;
  detailWhiteSpace: "normal" | "nowrap";
};
type CardFaceProfileOverride = Partial<CardFaceProfile>;
type IconKey =
  | "moon"
  | "gem"
  | "hourglass"
  | "eye"
  | "shield"
  | "bell"
  | "feather"
  | "waves"
  | "copy"
  | "lock"
  | "scroll"
  | "sparkles"
  | "circle";
type SkillId =
  | "guide"
  | "rewind"
  | "time-lock"
  | "quiet-mistake"
  | "dream-anchor"
  | "fragment-lens"
  | "small-gains"
  | "energy-efficiency"
  | "interference-filter"
  | "lunar-preview"
  | "chain-insight"
  | "flow-state"
  | "overflow-interest"
  | "loop-seed";

interface CellPoint {
  row: number;
  col: number;
}

interface ShapeLabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type BlockCells = CellPoint[];

interface LevelBoardLayout {
  dreamCore: [BlockCells, BlockCells, BlockCells, BlockCells, BlockCells];
  echo: [BlockCells, BlockCells, BlockCells];
  preview: CellPoint;
  floatLarge: BlockCells;
  protect: CellPoint;
  bell: BlockCells;
  floatSmall: CellPoint;
  interference: CellPoint;
  time: CellPoint;
  mirror: BlockCells;
  lock: CellPoint;
  copy: CellPoint;
}

interface CardBlock {
  id: string;
  itemId: string;
  title: string;
  subtitle?: string;
  kind: CardKind;
  cells: CellPoint[];
  tone: Tone;
  iconKey: IconKey;
  value: number;
  revealed: boolean;
  collected: boolean;
  fragmentIndex?: number;
  fragmentTotal?: number;
  effect?: UtilityEffect;
  slotId?: string;
  wave?: number;
  delayed?: boolean;
  locked?: boolean;
}

interface InventoryState {
  acquired: string[];
  merchantItems: ShopItemId[];
  buildRefreshes: number;
  shield: number;
}

interface ArchiveCollectibleRecord {
  key: string;
  title: string;
  kind: ArchiveCollectibleKind;
  tag: string;
  tone: Tone;
  iconKey: IconKey;
  value: number;
  count: number;
  source: string;
  flavor: string;
  nodeType?: NodeType;
  floor?: number;
  fragmentTotal?: number;
  lastSeenAt: number;
}

interface ArchiveLevelRecord {
  key: string;
  nodeType: NodeType;
  atmosphere: string;
  floor: number;
  reason: RewardSummary["reason"];
  value: number;
  target: number;
  entryCost: number;
  timeGain: number;
  recoveredCount: number;
  clearedAt: number;
}

interface ArchiveState {
  entries: ArchiveCollectibleRecord[];
  levels: ArchiveLevelRecord[];
}

interface LevelState {
  id: string;
  nodeType: NodeType;
  floor: number;
  atmosphere: string;
  entryCost: number;
  timeLeft: number;
  target: number;
  value: number;
  penalty: number;
  blocks: CardBlock[];
  selectedIds: string[];
  previewIds: string[];
  previewSeenIds: string[];
  refillDeck: CardBlock[];
  refillWave: number;
  refillQueued: boolean;
  refillPulse: number;
  vanishedIds: string[];
  virtualFragments: Record<string, number>;
  freeMistakeAvailable: boolean;
  resolving: boolean;
  mismatchIds: string[];
  successChain: number;
  quickChain: number;
  lastSuccessAt: number;
}

interface RewardSummary {
  title: string;
  value: number;
  target: number;
  entryCost: number;
  refundedTime: number;
  overflowTime: number;
  reason: "time" | "clear";
}

interface RunState {
  phase: Phase;
  time: number;
  step: number;
  layer: number;
  history: NodeType[];
  currentNode?: NodeType;
  skills: SkillId[];
  buildCharges: Partial<Record<SkillId, number>>;
  buildEnergy: number;
  inventory: InventoryState;
  shopPurchasedIds: ShopItemId[];
  archive: ArchiveState;
  level?: LevelState;
  rewardChoices: SkillId[];
  rewardRoll: number;
  dreamSeeds: string[];
  lastPenalty: number;
  lastSummary?: RewardSummary;
  notice: string;
  timeNotice?: string;
  interferenceEvent?: string;
}

interface SkillDefinition {
  id: SkillId;
  name: string;
  text: string;
  dockText: string;
  iconKey: IconKey;
  chargeCost: number;
  trigger: "active" | "auto" | "passive";
  tag: BuildTag;
}

interface ShopItem {
  id: ShopItemId;
  name: string;
  kind: ShopItemKind;
  cost: number;
  text: string;
  iconKey: IconKey;
}

const ICONS: Record<IconKey, LucideIcon> = {
  moon: Moon,
  gem: Gem,
  hourglass: Hourglass,
  eye: Eye,
  shield: Shield,
  bell: Bell,
  feather: Feather,
  waves: Waves,
  copy: Copy,
  lock: Lock,
  scroll: ScrollText,
  sparkles: Sparkles,
  circle: Circle,
};

const BUILD_CONTROL_SCORE: Record<BuildTag, number> = {
  技能: 1,
  棋盘: 1.2,
  被动: 0.8,
  梦种: 0.8,
};

const BUILD_SKIP_REFUND_TIME: Record<BuildTag, number> = {
  技能: 18,
  棋盘: 20,
  被动: 16,
  梦种: 28,
};

const CARD_FACE_LAYOUT_PROFILES: Record<CardFaceLayout, CardFaceProfile> = {
  single: {
    showIcon: false,
    showSecondary: false,
    iconSize: 16,
    gap: 2,
    padding: "4px 3px",
    titleGap: 0,
    titleSize: "clamp(12px, 18cqw, 16px)",
    titleLineHeight: "1.05",
    titleWhiteSpace: "normal",
    titleSafeUnits: 2.8,
    titleMaxUnits: 3,
    titleMinScale: 0.72,
    titleMaxWidth: "100%",
    detailDirection: "column",
    detailGap: 1,
    pillPadding: "2px 4px",
    pillSize: "clamp(8px, 12cqw, 10px)",
    pillLineHeight: "1.2",
    detailSize: "clamp(8px, 10cqw, 9px)",
    detailLineHeight: "1.25",
    detailWhiteSpace: "nowrap",
  },
  vertical: {
    showIcon: false,
    showSecondary: false,
    iconSize: 22,
    gap: 3,
    padding: "6px 4px",
    titleGap: 0,
    titleSize: "clamp(14px, 23cqw, 18px)",
    titleLineHeight: "1.08",
    titleWhiteSpace: "normal",
    titleSafeUnits: 2.85,
    titleMaxUnits: 3,
    titleMinScale: 0.72,
    titleMaxWidth: "100%",
    detailDirection: "column",
    detailGap: 2,
    pillPadding: "2px 7px 3px",
    pillSize: "clamp(9px, 14cqw, 12px)",
    pillLineHeight: "1.2",
    detailSize: "clamp(9px, 13cqw, 12px)",
    detailLineHeight: "1.28",
    detailWhiteSpace: "nowrap",
  },
  horizontal: {
    showIcon: true,
    showSecondary: false,
    iconSize: 24,
    gap: 4,
    padding: "5px",
    titleGap: 5,
    titleSize: "clamp(14px, 12cqw, 22px)",
    titleLineHeight: "1.06",
    titleWhiteSpace: "nowrap",
    titleSafeUnits: 4.6,
    titleMaxUnits: 5,
    titleMinScale: 0.76,
    titleMaxWidth: "100%",
    detailDirection: "row",
    detailGap: 3,
    pillPadding: "2px 6px 3px",
    pillSize: "clamp(9px, 10cqw, 12px)",
    pillLineHeight: "1.2",
    detailSize: "clamp(8px, 9cqw, 11px)",
    detailLineHeight: "1.25",
    detailWhiteSpace: "nowrap",
  },
  large: {
    showIcon: false,
    showSecondary: true,
    iconSize: 42,
    gap: 5,
    padding: "7px",
    titleGap: 6,
    titleSize: "clamp(19px, 11cqw, 30px)",
    titleLineHeight: "1.06",
    titleWhiteSpace: "nowrap",
    titleSafeUnits: 3.6,
    titleMaxUnits: 4,
    titleMinScale: 0.78,
    titleMaxWidth: "100%",
    detailDirection: "row",
    detailGap: 4,
    pillPadding: "2px 7px 3px",
    pillSize: "clamp(10px, 7cqw, 13px)",
    pillLineHeight: "1.22",
    detailSize: "clamp(9px, 6cqw, 12px)",
    detailLineHeight: "1.28",
    detailWhiteSpace: "nowrap",
  },
  shape: {
    showIcon: false,
    showSecondary: false,
    iconSize: 20,
    gap: 2,
    padding: "4px",
    titleGap: 0,
    titleSize: "clamp(14px, 18cqw, 20px)",
    titleLineHeight: "1.08",
    titleWhiteSpace: "normal",
    titleSafeUnits: 2.85,
    titleMaxUnits: 3,
    titleMinScale: 0.72,
    titleMaxWidth: "100%",
    detailDirection: "column",
    detailGap: 2,
    pillPadding: "2px 7px 3px",
    pillSize: "clamp(9px, 12cqw, 12px)",
    pillLineHeight: "1.22",
    detailSize: "clamp(9px, 11cqw, 11px)",
    detailLineHeight: "1.3",
    detailWhiteSpace: "nowrap",
  },
};

const CARD_KIND_FACE_PROFILES: Record<CardKind, CardFaceProfileOverride> = {
  fragment: {},
  treasure: {
    showSecondary: false,
  },
  utility: {
    showIcon: false,
    showSecondary: false,
    titleSize: "clamp(11px, 16cqw, 15px)",
    detailSize: "clamp(8px, 10cqw, 10px)",
    detailLineHeight: "1.28",
  },
  hazard: {
    showIcon: false,
    showSecondary: false,
    titleSize: "clamp(11px, 16cqw, 15px)",
    pillSize: "clamp(8px, 11cqw, 10px)",
    detailSize: "clamp(8px, 10cqw, 10px)",
    detailLineHeight: "1.28",
  },
};

const CARD_FACE_LAYOUT_KIND_OVERRIDES: Partial<Record<CardFaceLayout, Partial<Record<CardKind, CardFaceProfileOverride>>>> = {
  vertical: {
    treasure: {
      titleSize: "clamp(13px, 22cqw, 17px)",
      detailSize: "clamp(9px, 12cqw, 11px)",
    },
  },
  horizontal: {
    fragment: {
      titleSize: "clamp(15px, 11cqw, 22px)",
    },
    treasure: {
      titleSize: "clamp(14px, 10cqw, 20px)",
    },
  },
  shape: {
    fragment: {
      titleSize: "clamp(14px, 17cqw, 19px)",
      detailSize: "clamp(9px, 10cqw, 11px)",
    },
  },
};

const BOARD_TITLE_ALIASES: Record<string, string> = {
  课桌暗格: "桌洞",
  蓝屏回声: "蓝屏",
  千禧磁带: "磁带",
  记忆碎片: "碎片",
  回溯水纹: "水纹",
  定时锁链: "锁链",
  月相预兆: "预兆",
};

function textFitUnits(text: string) {
  return Array.from(text).reduce((sum, char) => {
    if (/\s/.test(char)) return sum + 0.25;
    if (/[\u0000-\u007f]/.test(char)) return sum + 0.55;
    return sum + 1;
  }, 0);
}

function cellBounds(cells: CellPoint[]) {
  const rows = cells.map((cell) => cell.row);
  const cols = cells.map((cell) => cell.col);
  return {
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
    minCol: Math.min(...cols),
    maxCol: Math.max(...cols),
  };
}

function isRectangularCells(cells: CellPoint[]) {
  const bounds = cellBounds(cells);
  const width = bounds.maxCol - bounds.minCol + 1;
  const height = bounds.maxRow - bounds.minRow + 1;
  return width * height === cells.length;
}

function layoutForCells(cells: CellPoint[]): CardFaceLayout {
  if (!isRectangularCells(cells)) return "shape";
  if (cells.length <= 1) return "single";
  const bounds = cellBounds(cells);
  const cols = bounds.maxCol - bounds.minCol + 1;
  const rows = bounds.maxRow - bounds.minRow + 1;
  if (cols === 1 && rows > 1) return "vertical";
  if (rows === 1 && cols > 1) return "horizontal";
  return cells.length >= 4 ? "large" : "horizontal";
}

function trimToFitUnits(text: string, maxUnits: number) {
  let units = 0;
  let result = "";
  for (const char of Array.from(text)) {
    const nextUnits = textFitUnits(char);
    if (units + nextUnits > maxUnits) break;
    result += char;
    units += nextUnits;
  }
  return result || Array.from(text)[0] || text;
}

function constrainBoardTitle(title: string, cells: CellPoint[]) {
  const maxUnits = CARD_FACE_LAYOUT_PROFILES[layoutForCells(cells)].titleMaxUnits;
  const alias = BOARD_TITLE_ALIASES[title] ?? title;
  if (textFitUnits(alias) <= maxUnits) return alias;
  return trimToFitUnits(alias, maxUnits);
}

function cell(row: number, col: number): CellPoint {
  return { row, col };
}

function cells(...points: Array<[number, number]>): BlockCells {
  return points.map(([row, col]) => cell(row, col));
}

const BOARD_LAYOUTS: LevelBoardLayout[] = [
  {
    dreamCore: [
      cells([0, 0], [0, 1], [1, 0], [1, 1]),
      cells([1, 3]),
      cells([3, 2]),
      cells([4, 1]),
      cells([5, 0]),
    ],
    echo: [cells([0, 3]), cells([0, 4]), cells([1, 4], [2, 4], [3, 4])],
    preview: cell(2, 0),
    floatLarge: cells([2, 1], [2, 2], [3, 1]),
    protect: cell(2, 3),
    bell: cells([3, 0], [4, 0]),
    floatSmall: cell(3, 3),
    interference: cell(4, 3),
    time: cell(5, 1),
    mirror: cells([4, 4], [5, 3], [5, 4]),
    lock: cell(5, 2),
    copy: cell(4, 2),
  },
  {
    dreamCore: [
      cells([0, 1], [0, 2], [0, 3], [1, 2]),
      cells([0, 0]),
      cells([1, 4]),
      cells([4, 3]),
      cells([5, 2]),
    ],
    echo: [cells([1, 0]), cells([2, 0]), cells([5, 0], [5, 1])],
    preview: cell(0, 4),
    floatLarge: cells([2, 1], [2, 2], [3, 2], [3, 3]),
    protect: cell(1, 1),
    bell: cells([3, 0], [4, 0]),
    floatSmall: cell(3, 1),
    interference: cell(2, 4),
    time: cell(4, 1),
    mirror: cells([3, 4], [4, 4], [5, 3], [5, 4]),
    lock: cell(2, 3),
    copy: cell(4, 2),
  },
  {
    dreamCore: [
      cells([0, 0], [0, 1], [0, 2], [0, 3]),
      cells([1, 4]),
      cells([2, 3]),
      cells([4, 0]),
      cells([5, 2]),
    ],
    echo: [cells([0, 4]), cells([1, 0]), cells([1, 1], [2, 1], [2, 2])],
    preview: cell(1, 2),
    floatLarge: cells([3, 1], [3, 2], [3, 3], [4, 2]),
    protect: cell(1, 3),
    bell: cells([2, 0], [3, 0]),
    floatSmall: cell(4, 1),
    interference: cell(2, 4),
    time: cell(5, 0),
    mirror: cells([4, 3], [4, 4], [5, 3], [5, 4]),
    lock: cell(5, 1),
    copy: cell(3, 4),
  },
  {
    dreamCore: [
      cells([0, 2], [0, 3], [1, 1], [1, 2]),
      cells([0, 0]),
      cells([2, 4]),
      cells([5, 4]),
      cells([5, 0]),
    ],
    echo: [cells([0, 4]), cells([1, 4]), cells([2, 0], [3, 0], [4, 0])],
    preview: cell(1, 0),
    floatLarge: cells([2, 1], [3, 1], [3, 2], [3, 3]),
    protect: cell(1, 3),
    bell: cells([4, 3], [4, 4]),
    floatSmall: cell(2, 2),
    interference: cell(2, 3),
    time: cell(5, 1),
    mirror: cells([4, 1], [4, 2], [5, 2], [5, 3]),
    lock: cell(0, 1),
    copy: cell(3, 4),
  },
  {
    dreamCore: [
      cells([0, 0], [0, 1], [1, 0], [1, 1], [2, 1]),
      cells([0, 3]),
      cells([2, 4]),
      cells([3, 4]),
      cells([5, 4]),
    ],
    echo: [cells([0, 4]), cells([1, 4]), cells([5, 0], [5, 1])],
    preview: cell(0, 2),
    floatLarge: cells([2, 2], [2, 3], [3, 1], [3, 2]),
    protect: cell(1, 2),
    bell: cells([3, 0], [4, 0]),
    floatSmall: cell(3, 3),
    interference: cell(1, 3),
    time: cell(2, 0),
    mirror: cells([4, 1], [4, 2], [4, 3], [5, 2]),
    lock: cell(5, 3),
    copy: cell(4, 4),
  },
  {
    dreamCore: [
      cells([0, 3], [1, 3], [2, 3], [2, 4]),
      cells([0, 1]),
      cells([1, 0]),
      cells([4, 4]),
      cells([5, 2]),
    ],
    echo: [cells([0, 0]), cells([0, 4]), cells([3, 0], [4, 0], [4, 1])],
    preview: cell(1, 1),
    floatLarge: cells([2, 0], [2, 1], [2, 2], [3, 1]),
    protect: cell(1, 2),
    bell: cells([3, 3], [3, 4]),
    floatSmall: cell(3, 2),
    interference: cell(1, 4),
    time: cell(5, 0),
    mirror: cells([4, 2], [4, 3], [5, 3], [5, 4]),
    lock: cell(5, 1),
    copy: cell(0, 2),
  },
];

const BOARD_LAYOUT_SEQUENCE: Record<NodeType, number[]> = {
  normal: [1, 2, 3, 0, 1],
  elite: [2, 3, 4, 5, 4],
  boss: [4, 5],
  shop: [0],
  rest: [1],
};

function cellKey(point: CellPoint) {
  return `${point.row}:${point.col}`;
}

function layoutGroups(layout: LevelBoardLayout): BlockCells[] {
  return [
    ...layout.dreamCore,
    ...layout.echo,
    [layout.preview],
    layout.floatLarge,
    [layout.protect],
    layout.bell,
    [layout.floatSmall],
    [layout.interference],
    [layout.time],
    layout.mirror,
    [layout.lock],
    [layout.copy],
  ];
}

function isConnectedCells(group: BlockCells) {
  const keys = new Set(group.map(cellKey));
  if (keys.size <= 1) return true;
  const queue = [group[0]];
  const visited = new Set<string>();

  while (queue.length) {
    const current = queue.shift()!;
    const key = cellKey(current);
    if (visited.has(key)) continue;
    visited.add(key);
    [
      cell(current.row - 1, current.col),
      cell(current.row + 1, current.col),
      cell(current.row, current.col - 1),
      cell(current.row, current.col + 1),
    ].forEach((next) => {
      const nextKey = cellKey(next);
      if (keys.has(nextKey) && !visited.has(nextKey)) queue.push(next);
    });
  }

  return visited.size === keys.size;
}

function validateBoardLayout(layout: LevelBoardLayout, layoutIndex: number) {
  const issues: string[] = [];
  const occupied = new Map<string, number>();

  layoutGroups(layout).forEach((group, groupIndex) => {
    if (!isConnectedCells(group)) issues.push(`layout ${layoutIndex} group ${groupIndex} is disconnected`);
    group.forEach((point) => {
      const key = cellKey(point);
      if (point.row < 0 || point.row >= GRID_ROWS || point.col < 0 || point.col >= GRID_COLUMNS) {
        issues.push(`layout ${layoutIndex} group ${groupIndex} cell ${key} is out of bounds`);
      }
      const owner = occupied.get(key);
      if (owner !== undefined) issues.push(`layout ${layoutIndex} groups ${owner}/${groupIndex} overlap at ${key}`);
      occupied.set(key, groupIndex);
    });
  });

  return issues;
}

const BOARD_LAYOUT_ISSUES = BOARD_LAYOUTS.flatMap(validateBoardLayout);

if (BOARD_LAYOUT_ISSUES.length) {
  console.warn("Board layout issues:", BOARD_LAYOUT_ISSUES);
}

const SKILLS: SkillDefinition[] = [
  {
    id: "guide",
    name: "指引",
    text: "查看 1 张未回收的牌。",
    dockText: "查看1张牌",
    iconKey: "feather",
    chargeCost: 2,
    trigger: "active",
    tag: "技能",
  },
  {
    id: "rewind",
    name: "回溯",
    text: "撤销上一次扣时。",
    dockText: "撤销上一步",
    iconKey: "waves",
    chargeCost: 1,
    trigger: "active",
    tag: "技能",
  },
  {
    id: "time-lock",
    name: "定时锁定",
    text: "锁定时间 +10 秒，并获得 1 层护盾。",
    dockText: "锁定时间+10秒",
    iconKey: "lock",
    chargeCost: 2,
    trigger: "active",
    tag: "技能",
  },
  {
    id: "quiet-mistake",
    name: "静默失误",
    text: "每关第一次匹配失败或干扰不扣时间。",
    dockText: "自动免罚",
    iconKey: "sparkles",
    chargeCost: 1,
    trigger: "auto",
    tag: "被动",
  },
  {
    id: "dream-anchor",
    name: "梦锚",
    text: "打乱时保留 1 个标记，Boss 封锁数量 -1。",
    dockText: "稳住梦位",
    iconKey: "lock",
    chargeCost: 1,
    trigger: "passive",
    tag: "棋盘",
  },
  {
    id: "fragment-lens",
    name: "碎片折光",
    text: "碎片物品少匹配 1 张即可完成，最低仍需 2 张。",
    dockText: "补一碎片",
    iconKey: "gem",
    chargeCost: 2,
    trigger: "active",
    tag: "技能",
  },
  {
    id: "small-gains",
    name: "低语增幅",
    text: "小回忆与小额物件价值提高，适合把空格也变成收益。",
    dockText: "小牌增值",
    iconKey: "waves",
    chargeCost: 1,
    trigger: "passive",
    tag: "被动",
  },
  {
    id: "energy-efficiency",
    name: "梦能导线",
    text: "梦能卡升级，获得梦能时额外为 Build 充能 +1。",
    dockText: "梦能+1",
    iconKey: "sparkles",
    chargeCost: 1,
    trigger: "passive",
    tag: "棋盘",
  },
  {
    id: "interference-filter",
    name: "杂讯稀释",
    text: "减少干扰扣时，并压低补牌异常出现的压力。",
    dockText: "干扰-2秒",
    iconKey: "shield",
    chargeCost: 1,
    trigger: "passive",
    tag: "棋盘",
  },
  {
    id: "lunar-preview",
    name: "月相预兆",
    text: "进入关卡时短暂预览 4 个未翻开的块。",
    dockText: "查看全盘",
    iconKey: "eye",
    chargeCost: 1,
    trigger: "active",
    tag: "技能",
  },
  {
    id: "chain-insight",
    name: "连锁透视",
    text: "每次成功拼合后，短暂透视 1 张未回收牌。",
    dockText: "拼合透视",
    iconKey: "eye",
    chargeCost: 1,
    trigger: "passive",
    tag: "棋盘",
  },
  {
    id: "flow-state",
    name: "心流追忆",
    text: "连续快速回收会返还本关时间，并为 Build 技能充能。",
    dockText: "快手返时",
    iconKey: "hourglass",
    chargeCost: 1,
    trigger: "passive",
    tag: "被动",
  },
  {
    id: "overflow-interest",
    name: "余晖利息",
    text: "通关溢出价值折算更多时间。",
    dockText: "溢出增益",
    iconKey: "hourglass",
    chargeCost: 2,
    trigger: "passive",
    tag: "被动",
  },
  {
    id: "loop-seed",
    name: "梦种·回环",
    text: "阶段末高级被动：溢出时间大幅提升，深层梦里留下回环种子。",
    dockText: "梦种回环",
    iconKey: "moon",
    chargeCost: 1,
    trigger: "passive",
    tag: "梦种",
  },
];

const SHOP_SUPPLIES: ShopItem[] = [
  {
    id: "scroll",
    name: "记忆卷轴",
    kind: "supply",
    cost: 30,
    text: "为 Build 技能注入 1 点能量。",
    iconKey: "scroll",
  },
  {
    id: "rewind",
    name: "回溯水纹",
    kind: "supply",
    cost: 35,
    text: "获得 1 点能量，并返还上次失误扣时。",
    iconKey: "waves",
  },
  {
    id: "lock",
    name: "定时锁链",
    kind: "supply",
    cost: 35,
    text: "护盾 +1，抵消下一次失败惩罚。",
    iconKey: "lock",
  },
  {
    id: "copy",
    name: "记忆碎片",
    kind: "supply",
    cost: 50,
    text: "为 Build 技能注入 2 点能量。",
    iconKey: "copy",
  },
];

const BUILD_REFRESH_ITEM: ShopItem = {
  id: "refresh",
  name: "改写梦签",
  kind: "refresh",
  cost: 32,
  text: "下次 Build 奖励可刷新 1 次。",
  iconKey: "sparkles",
};

const SHOP_ITEMS: ShopItem[] = [...SHOP_SUPPLIES, BUILD_REFRESH_ITEM];

const NODE_META: Record<NodeType, { label: string; icon: LucideIcon; text: string }> = {
  normal: { label: "普通", icon: Sparkles, text: "旧校门回廊" },
  elite: { label: "精英", icon: Sword, text: "碎月操场" },
  shop: { label: "商店", icon: ShoppingCart, text: "千禧梦市" },
  rest: { label: "休息", icon: Bed, text: "月窗卧室" },
  boss: { label: "Boss", icon: Skull, text: "遗失姓名" },
};

const TONE_STYLES: Record<Tone, { bg: string; edge: string; text: string; glow: string }> = {
  gold: {
    bg: "linear-gradient(145deg, rgba(162, 113, 33, .92), rgba(244, 209, 119, .62))",
    edge: "rgba(255, 219, 137, .95)",
    text: "#fff1c8",
    glow: "0 0 24px rgba(246, 194, 81, .38)",
  },
  teal: {
    bg: "linear-gradient(145deg, rgba(14, 102, 111, .9), rgba(34, 171, 181, .48))",
    edge: "rgba(109, 234, 234, .9)",
    text: "#dcffff",
    glow: "0 0 22px rgba(69, 219, 228, .34)",
  },
  violet: {
    bg: "linear-gradient(145deg, rgba(62, 57, 98, .9), rgba(155, 128, 188, .52))",
    edge: "rgba(212, 184, 255, .82)",
    text: "#f1e8ff",
    glow: "0 0 20px rgba(166, 127, 255, .25)",
  },
  blue: {
    bg: "linear-gradient(145deg, rgba(21, 67, 102, .94), rgba(77, 145, 181, .5))",
    edge: "rgba(156, 211, 255, .84)",
    text: "#e9f6ff",
    glow: "0 0 20px rgba(92, 168, 242, .3)",
  },
  green: {
    bg: "linear-gradient(145deg, rgba(21, 91, 67, .92), rgba(74, 156, 111, .52))",
    edge: "rgba(143, 235, 171, .78)",
    text: "#e7ffe9",
    glow: "0 0 18px rgba(80, 219, 135, .25)",
  },
  paper: {
    bg: "linear-gradient(145deg, rgba(230, 221, 201, .96), rgba(184, 169, 139, .88))",
    edge: "rgba(255, 242, 210, .92)",
    text: "#16212a",
    glow: "0 0 14px rgba(255, 241, 198, .2)",
  },
  back: {
    bg: "linear-gradient(145deg, rgba(8, 18, 27, .96), rgba(18, 31, 43, .95))",
    edge: "rgba(130, 109, 72, .36)",
    text: "#dbc596",
    glow: "none",
  },
  danger: {
    bg: "linear-gradient(145deg, rgba(77, 28, 36, .95), rgba(151, 63, 60, .62))",
    edge: "rgba(255, 129, 112, .84)",
    text: "#ffe4d9",
    glow: "0 0 18px rgba(240, 77, 66, .28)",
  },
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const rest = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatTimeDelta(seconds: number) {
  const sign = seconds >= 0 ? "+" : "-";
  return `${sign}${formatTime(Math.abs(seconds))}`;
}

function createEmptyArchive(): ArchiveState {
  return { entries: [], levels: [] };
}

function isNodeType(value: unknown): value is NodeType {
  return typeof value === "string" && value in NODE_META;
}

function isTone(value: unknown): value is Tone {
  return typeof value === "string" && value in TONE_STYLES;
}

function isIconKey(value: unknown): value is IconKey {
  return typeof value === "string" && value in ICONS;
}

function isArchiveCollectibleKind(value: unknown): value is ArchiveCollectibleKind {
  return (
    value === "fragment" ||
    value === "utility" ||
    value === "hazard" ||
    value === "treasure" ||
    value === "build" ||
    value === "shop" ||
    value === "seed"
  );
}

function sortArchiveEntries(entries: ArchiveCollectibleRecord[]) {
  return [...entries].sort((a, b) => b.lastSeenAt - a.lastSeenAt || b.value - a.value || a.title.localeCompare(b.title));
}

function mergeArchiveEntry(archive: ArchiveState, record: ArchiveCollectibleRecord): ArchiveState {
  const existing = archive.entries.find((entry) => entry.key === record.key);
  const nextEntry = existing
    ? {
        ...existing,
        ...record,
        value: Math.max(existing.value, record.value),
        count: existing.count + record.count,
        lastSeenAt: Math.max(existing.lastSeenAt, record.lastSeenAt),
      }
    : record;

  return {
    ...archive,
    entries: sortArchiveEntries([nextEntry, ...archive.entries.filter((entry) => entry.key !== record.key)]).slice(0, 96),
  };
}

function archiveWithEntry(run: RunState, record: ArchiveCollectibleRecord): RunState {
  return {
    ...run,
    archive: mergeArchiveEntry(run.archive ?? createEmptyArchive(), record),
  };
}

function archiveFlavorForBlock(block: CardBlock) {
  if (block.kind === "hazard") {
    if (block.effect === "mist") return "雾从牌面撤走，只剩一次被梦境抹改的痕迹。";
    if (block.effect === "seal") return "封锁留下冷亮边线，像醒来前打不开的抽屉。";
    if (block.effect === "shuffle") return "梦位曾被打乱，路线仍被月档记住。";
    return "干扰已经遭遇过，下次再听见它会更早认出来。";
  }
  if (block.kind === "utility") {
    if (block.effect === "energy" || block.effect === "false-energy") return "一小束梦能被收好，等 Build 技能再次发光。";
    if (block.effect === "preview") return "预兆像短暂亮起的投影，照出还未翻开的牌。";
    if (block.effect === "protect" || block.effect === "lock") return "它把失败的边缘轻轻按住，给下一次尝试留出余地。";
    return "梦里的小工具归档后，仍带着一点可用的余温。";
  }
  if (block.kind === "treasure") return "细小却具体的旧物，像醒来后还攥在手心的碎片。";
  if (block.itemId === "dream-core") return "核心记忆的一块，拼上时会让梦境短暂安静。";
  if (block.itemId === "echo") return "回声反复出现，像走廊尽头有人叫过你的名字。";
  return "这枚碎片已经找回，月档把它压在暗金边框里。";
}

function archiveSourceForRun(run: RunState) {
  if (!run.level) return "梦境档案";
  return `第${run.level.floor}层 · ${NODE_META[run.level.nodeType].label} · ${run.level.atmosphere}`;
}

function archiveBoardCollectible(run: RunState, block: CardBlock, value: number): RunState {
  const level = run.level;
  return archiveWithEntry(run, {
    key: `${block.kind}:${block.effect ?? block.itemId}:${block.title}`,
    title: block.title,
    kind: block.kind,
    tag: blockKindLabel(block),
    tone: block.tone,
    iconKey: block.iconKey,
    value: Math.max(0, value),
    count: 1,
    source: archiveSourceForRun(run),
    flavor: archiveFlavorForBlock(block),
    nodeType: level?.nodeType,
    floor: level?.floor,
    fragmentTotal: block.fragmentTotal,
    lastSeenAt: Date.now(),
  });
}

function archiveSkillReward(run: RunState, skill: SkillDefinition): RunState {
  return archiveWithEntry(run, {
    key: `build:${skill.id}`,
    title: skill.name,
    kind: "build",
    tag: skill.tag,
    tone: skill.tag === "棋盘" ? "teal" : skill.tag === "被动" ? "blue" : skill.tag === "梦种" ? "gold" : "violet",
    iconKey: skill.iconKey,
    value: skill.chargeCost,
    count: 1,
    source: "Build 奖励",
    flavor: skill.text,
    lastSeenAt: Date.now(),
  });
}

function archiveShopItem(run: RunState, item: ShopItem): RunState {
  return archiveWithEntry(run, {
    key: `shop:${item.id}`,
    title: item.name,
    kind: "shop",
    tag: item.kind === "refresh" ? "梦签" : "商店",
    tone: item.kind === "refresh" ? "violet" : "paper",
    iconKey: item.iconKey,
    value: item.cost,
    count: 1,
    source: "千禧梦市",
    flavor: item.text,
    lastSeenAt: Date.now(),
  });
}

function archiveDreamSeed(run: RunState, title: string): RunState {
  return archiveWithEntry(run, {
    key: `seed:${title}`,
    title,
    kind: "seed",
    tag: "梦种",
    tone: "gold",
    iconKey: "moon",
    value: 1,
    count: 1,
    source: "遗失姓名",
    flavor: "阶段末留下的深层种子，会在更远的梦里继续发芽。",
    lastSeenAt: Date.now(),
  });
}

function archiveCompletedLevel(run: RunState, level: LevelState, summary: RewardSummary): RunState {
  const uniqueRecovered = new Set(level.blocks.filter((block) => block.collected).map((block) => block.itemId));
  const record: ArchiveLevelRecord = {
    key: level.id,
    nodeType: level.nodeType,
    atmosphere: level.atmosphere,
    floor: level.floor,
    reason: summary.reason,
    value: summary.value,
    target: summary.target,
    entryCost: summary.entryCost,
    timeGain: summary.refundedTime + summary.overflowTime,
    recoveredCount: uniqueRecovered.size,
    clearedAt: Date.now(),
  };
  const archive = run.archive ?? createEmptyArchive();
  return {
    ...run,
    archive: {
      ...archive,
      levels: [record, ...archive.levels.filter((levelRecord) => levelRecord.key !== record.key)].slice(0, 36),
    },
  };
}

function coerceArchiveEntry(raw: unknown): ArchiveCollectibleRecord | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Partial<ArchiveCollectibleRecord>;
  if (typeof record.key !== "string" || typeof record.title !== "string") return undefined;
  return {
    key: record.key,
    title: record.title,
    kind: isArchiveCollectibleKind(record.kind) ? record.kind : "fragment",
    tag: typeof record.tag === "string" ? record.tag : "记忆",
    tone: isTone(record.tone) ? record.tone : "gold",
    iconKey: isIconKey(record.iconKey) ? record.iconKey : "sparkles",
    value: typeof record.value === "number" ? record.value : 0,
    count: typeof record.count === "number" ? Math.max(1, record.count) : 1,
    source: typeof record.source === "string" ? record.source : "旧档案",
    flavor: typeof record.flavor === "string" ? record.flavor : "旧存档里的回收记录已经转入月档。",
    nodeType: isNodeType(record.nodeType) ? record.nodeType : undefined,
    floor: typeof record.floor === "number" ? record.floor : undefined,
    fragmentTotal: typeof record.fragmentTotal === "number" ? record.fragmentTotal : undefined,
    lastSeenAt: typeof record.lastSeenAt === "number" ? record.lastSeenAt : Date.now(),
  };
}

function coerceArchiveLevel(raw: unknown): ArchiveLevelRecord | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Partial<ArchiveLevelRecord>;
  if (typeof record.key !== "string" || !isNodeType(record.nodeType)) return undefined;
  return {
    key: record.key,
    nodeType: record.nodeType,
    atmosphere: typeof record.atmosphere === "string" ? record.atmosphere : NODE_META[record.nodeType].text,
    floor: typeof record.floor === "number" ? record.floor : 1,
    reason: record.reason === "time" ? "time" : "clear",
    value: typeof record.value === "number" ? record.value : 0,
    target: typeof record.target === "number" ? record.target : 0,
    entryCost: typeof record.entryCost === "number" ? record.entryCost : 0,
    timeGain: typeof record.timeGain === "number" ? record.timeGain : 0,
    recoveredCount: typeof record.recoveredCount === "number" ? record.recoveredCount : 0,
    clearedAt: typeof record.clearedAt === "number" ? record.clearedAt : Date.now(),
  };
}

function parseLegacyAcquired(entry: string, index: number): ArchiveCollectibleRecord {
  const match = entry.match(/^(.+?)\s\+(\d+)$/);
  const title = match?.[1] ?? entry;
  const value = match?.[2] ? Number(match[2]) : 0;
  return {
    key: `legacy:${title}`,
    title,
    kind: "fragment",
    tag: "旧档",
    tone: "gold",
    iconKey: "sparkles",
    value,
    count: 1,
    source: "旧存档",
    flavor: "旧版本留下的回收记录，已并入月档。",
    lastSeenAt: Date.now() - index,
  };
}

function buildLegacyLevels(history: NodeType[] = [], step = 0): ArchiveLevelRecord[] {
  return history
    .filter(isNodeType)
    .slice(0, Math.max(0, Math.min(step, history.length)))
    .map((nodeType, index) => ({
      key: `legacy-level:${index}:${nodeType}`,
      nodeType,
      atmosphere: NODE_META[nodeType].text,
      floor: index + 1,
      reason: "clear" as const,
      value: 0,
      target: 0,
      entryCost: 0,
      timeGain: 0,
      recoveredCount: 0,
      clearedAt: Date.now() - index,
    }));
}

function normalizeArchive(
  archive: Partial<ArchiveState> | undefined,
  inventory?: InventoryState,
  history?: NodeType[],
  step = 0,
): ArchiveState {
  const rawArchive = archive as (Partial<ArchiveState> & { cards?: unknown[] }) | undefined;
  const rawEntries = Array.isArray(rawArchive?.entries)
    ? rawArchive.entries
    : Array.isArray(rawArchive?.cards)
      ? rawArchive.cards
      : [];
  const entries = rawEntries.map(coerceArchiveEntry).filter((entry): entry is ArchiveCollectibleRecord => Boolean(entry));
  const rawLevels = Array.isArray(rawArchive?.levels) ? rawArchive.levels : [];
  const levels = rawLevels.map(coerceArchiveLevel).filter((level): level is ArchiveLevelRecord => Boolean(level));

  const legacyEntries = (inventory?.acquired ?? []).reduce((state, entry, index) => {
    const merged = mergeArchiveEntry(state, parseLegacyAcquired(entry, index));
    return merged;
  }, createEmptyArchive());

  return {
    entries: entries.length ? sortArchiveEntries(entries).slice(0, 96) : legacyEntries.entries,
    levels: levels.length
      ? [...levels].sort((a, b) => b.clearedAt - a.clearedAt).slice(0, 36)
      : buildLegacyLevels(history, step),
  };
}

function roundToFive(value: number) {
  return Math.round(value / 5) * 5;
}

function levelTimeNotice(reason: string, delta: number, nextTimeLeft: number) {
  return `${reason} ${formatTimeDelta(delta)}，本关 ${formatTime(nextTimeLeft)}`;
}

function runTimeNotice(reason: string, delta: number, nextTime: number) {
  return `${reason} ${formatTimeDelta(delta)}，梦时 ${formatTime(nextTime)}`;
}

function anomalyEventLabel(effect?: UtilityEffect) {
  if (effect === "shuffle") return "打乱";
  if (effect === "seal") return "封锁";
  if (effect === "mist") return "雾化";
  if (effect === "false-energy") return "误影";
  return "干扰";
}

function hasSkill(run: Pick<RunState, "skills">, skill: SkillId) {
  return run.skills.includes(skill);
}

function getSkillCharge(run: Pick<RunState, "buildCharges">, skill: SkillId) {
  return run.buildCharges?.[skill] ?? 0;
}

function getShopItem(id: ShopItemId) {
  return SHOP_ITEMS.find((item) => item.id === id)!;
}

function getShopOffers(run: RunState) {
  const supplies = SHOP_SUPPLIES.filter((item) => item.id !== "copy" || run.step >= 3);
  const supply = supplies[(run.step + run.history.length) % supplies.length];
  return [supply, BUILD_REFRESH_ITEM];
}

function canBuyShopItem(run: RunState, item: ShopItem) {
  if (run.time < item.cost) return false;
  if (run.shopPurchasedIds.includes(item.id)) return false;
  if (item.kind === "refresh") return (run.inventory.buildRefreshes ?? 0) < 2;
  return (run.inventory.merchantItems ?? []).length < 1;
}

function getBuildControlScore(skills: SkillId[]) {
  return [...new Set(skills)].reduce((score, skillId) => {
    const skill = getSkill(skillId);
    return score + (BUILD_CONTROL_SCORE[skill.tag] ?? 0);
  }, 0);
}

function controlPressureRate(skills: SkillId[]) {
  return Math.min(0.18, getBuildControlScore(skills) * 0.018);
}

function energyGainFor(run: Pick<RunState, "skills">, baseGain: number) {
  if (baseGain <= 0) return 0;
  return hasSkill(run, "energy-efficiency") ? baseGain + 1 : baseGain;
}

function spendSkillChargeMap(charges: Partial<Record<SkillId, number>>, skill: SkillId, amount: number) {
  return {
    ...charges,
    [skill]: Math.max(0, (charges[skill] ?? 0) - amount),
  };
}

function addBuildEnergy(run: RunState, amount: number): RunState {
  let remaining = (run.buildEnergy ?? 0) + amount;
  const buildCharges = { ...(run.buildCharges ?? {}) };

  while (remaining > 0 && run.skills.length > 0) {
    const candidates = run.skills
      .map((skillId) => {
        const skill = getSkill(skillId);
        const charge = buildCharges[skillId] ?? 0;
        return { skillId, skill, charge, ratio: charge / skill.chargeCost };
      })
      .filter((item) => item.skill.trigger !== "passive" && item.charge < item.skill.chargeCost)
      .sort((a, b) => a.ratio - b.ratio || a.charge - b.charge);

    if (!candidates.length) break;
    const next = candidates[0].skillId;
    buildCharges[next] = (buildCharges[next] ?? 0) + 1;
    remaining -= 1;
  }

  return {
    ...run,
    buildCharges,
    buildEnergy: remaining,
  };
}

function pickRandom<T>(items: T[]) {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function findPreviewTarget(level: LevelState, preferredItemId?: string) {
  const isHiddenTarget = (block: CardBlock) =>
    !block.collected &&
    !block.locked &&
    !block.revealed &&
    !level.previewIds.includes(block.id) &&
    !level.previewSeenIds.includes(block.id);
  if (preferredItemId) {
    const matchingTarget = pickRandom(level.blocks.filter(
      (block) => block.itemId === preferredItemId && isClearRequired(block) && isHiddenTarget(block),
    ));
    if (matchingTarget) return matchingTarget;
  }
  return (
    pickRandom(level.blocks.filter((block) => isClearRequired(block) && isHiddenTarget(block))) ??
    pickRandom(level.blocks.filter((block) => isHiddenTarget(block)))
  );
}

function previewOne(level: LevelState, preferredItemId?: string) {
  const target = findPreviewTarget(level, preferredItemId);
  if (!target) return { level, target };
  return {
    level: {
      ...level,
      previewIds: [...new Set([...level.previewIds, target.id])],
      previewSeenIds: [...new Set([...level.previewSeenIds, target.id])],
    },
    target,
  };
}

function applyRecoveryPerks(run: RunState, level: LevelState, notice: string, kind: "match" | "pickup"): RunState {
  const now = Date.now();
  const quickChain =
    level.lastSuccessAt > 0 && now - level.lastSuccessAt <= QUICK_SUCCESS_WINDOW_MS ? level.quickChain + 1 : 1;
  const successChain = kind === "match" ? level.successChain + 1 : level.successChain;
  const hasFlow = hasSkill(run, "flow-state");
  const hasInsight = hasSkill(run, "chain-insight");
  let nextLevel: LevelState = {
    ...level,
    successChain,
    quickChain,
    lastSuccessAt: now,
  };
  const perkNotes: string[] = [];
  let energyGain = 0;
  let timeGain = 0;

  if (quickChain >= 2 && hasFlow) {
    timeGain += 4;
    nextLevel = { ...nextLevel, timeLeft: nextLevel.timeLeft + 4 };
    perkNotes.push(`心流 ${formatTimeDelta(4)}`);
    if (quickChain % 3 === 0) energyGain = energyGainFor(run, 1);
  } else if (quickChain >= 3 && quickChain % 3 === 0) {
    timeGain += 2;
    nextLevel = { ...nextLevel, timeLeft: nextLevel.timeLeft + 2 };
    perkNotes.push(`快节奏 ${formatTimeDelta(2)}`);
  }

  if (kind === "match" && hasInsight) {
    const result = previewOne(nextLevel);
    nextLevel = result.level;
    if (result.target) perkNotes.push(`连锁透视看见了 ${result.target.title}`);
  }

  let nextRun: RunState = {
    ...run,
    level: nextLevel,
    notice: perkNotes.length ? `${notice} ${perkNotes.join("，")}。` : notice,
    timeNotice: timeGain > 0 ? levelTimeNotice(hasFlow ? "心流返时" : "快节奏返时", timeGain, nextLevel.timeLeft) : run.timeNotice,
  };

  if (energyGain > 0) {
    nextRun = addBuildEnergy(nextRun, energyGain);
    nextRun = {
      ...nextRun,
      notice: `${nextRun.notice} Build 充能 +${energyGain}。`,
    };
  }

  return nextRun;
}

function makeBlock(
  id: string,
  itemId: string,
  title: string,
  cells: CellPoint[],
  tone: Tone,
  iconKey: IconKey,
  value: number,
  extras: Partial<CardBlock> = {},
): CardBlock {
  return {
    id,
    itemId,
    title: constrainBoardTitle(title, cells),
    kind: "fragment",
    cells,
    tone,
    iconKey,
    value,
    revealed: false,
    collected: false,
    slotId: id,
    ...extras,
  };
}

function makeEnergyBlock(id: string, cells: CellPoint[], wave = 0): CardBlock {
  return makeBlock(id, "dream-energy", "梦能", cells, "paper", "sparkles", 0, {
    kind: "utility",
    effect: "energy",
    subtitle: "技能充能",
    wave,
  });
}

function toEnergyBlock(block: CardBlock, wave = block.wave ?? 0): CardBlock {
  return {
    ...makeEnergyBlock(`energy-${block.id}`, block.cells, wave),
    slotId: block.slotId ?? block.id,
  };
}

const MINOR_MEMORY_THEMES: Array<{ title: string; tone: Tone; iconKey: IconKey }> = [
  { title: "粉笔印", tone: "paper", iconKey: "scroll" },
  { title: "玻璃珠", tone: "blue", iconKey: "circle" },
  { title: "贴纸角", tone: "violet", iconKey: "feather" },
  { title: "汽水盖", tone: "green", iconKey: "bell" },
  { title: "车票边", tone: "teal", iconKey: "hourglass" },
  { title: "磁带声", tone: "gold", iconKey: "waves" },
  { title: "练习本", tone: "paper", iconKey: "scroll" },
];

const DEEP_MEMORY_THEMES: Array<{ title: string; tone: Tone; iconKey: IconKey }> = [
  { title: "桌洞", tone: "gold", iconKey: "gem" },
  { title: "旧校门", tone: "blue", iconKey: "circle" },
  { title: "蓝屏", tone: "teal", iconKey: "waves" },
  { title: "磁带", tone: "violet", iconKey: "scroll" },
  { title: "车票", tone: "teal", iconKey: "hourglass" },
  { title: "饭卡", tone: "green", iconKey: "bell" },
  { title: "校徽", tone: "gold", iconKey: "circle" },
  { title: "录音", tone: "violet", iconKey: "waves" },
  { title: "雨伞", tone: "blue", iconKey: "feather" },
  { title: "练习本", tone: "paper", iconKey: "scroll" },
];

function roundToTen(value: number) {
  return Math.round(value / 10) * 10;
}

function roundToFifty(value: number) {
  return Math.round(value / 50) * 50;
}

function targetHintForLevel(nodeType: NodeType, step: number) {
  if (nodeType === "boss") return 6300 + step * 180;
  if (nodeType === "elite") return 4300 + step * 160;
  return (step === 0 ? 3000 : 3200) + step * 110;
}

function minorMemoryValue(nodeType: NodeType, step: number, targetHint: number, index: number) {
  const rate = nodeType === "boss" ? 0.028 : nodeType === "elite" ? 0.026 : 0.023;
  const floor = nodeType === "boss" ? 150 : nodeType === "elite" ? 110 : 65;
  const drift = (index % 3) * 10 + Math.min(step, 5) * 5;
  return roundToTen(Math.max(floor, targetHint * rate) + drift);
}

function makeMinorMemoryBlock(
  id: string,
  cells: CellPoint[],
  nodeType: NodeType,
  step: number,
  targetHint: number,
  index: number,
  wave = 0,
): CardBlock {
  const theme = MINOR_MEMORY_THEMES[index % MINOR_MEMORY_THEMES.length];
  return makeBlock(id, `minor-memory-${id}`, theme.title, cells, theme.tone, theme.iconKey, minorMemoryValue(nodeType, step, targetHint, index), {
    kind: "treasure",
    fragmentIndex: 1,
    fragmentTotal: 1,
    subtitle: "小回忆",
    wave,
  });
}

function deepMemoryValue(nodeType: NodeType, step: number, targetHint: number, index: number) {
  const rate = nodeType === "boss" ? 0.18 : nodeType === "elite" ? 0.15 : 0.12;
  const floor = nodeType === "boss" ? 1100 : nodeType === "elite" ? 760 : 520;
  return roundToFifty(Math.max(floor, targetHint * rate) + Math.min(step, 5) * 35 + (index % 2) * 50);
}

function makeDeepMemoryFragment(
  id: string,
  itemId: string,
  cells: CellPoint[],
  nodeType: NodeType,
  step: number,
  targetHint: number,
  index: number,
  fragmentIndex: number,
  fragmentTotal: number,
  wave = 0,
  theme = DEEP_MEMORY_THEMES[index % DEEP_MEMORY_THEMES.length],
): CardBlock {
  return makeBlock(id, itemId, theme.title, cells, theme.tone, theme.iconKey, deepMemoryValue(nodeType, step, targetHint, index), {
    fragmentIndex,
    fragmentTotal,
    wave,
  });
}

function toMinorMemoryBlock(block: CardBlock, nodeType: NodeType, step: number, targetHint: number, index: number) {
  return {
    ...makeMinorMemoryBlock(`memory-${block.id}`, block.cells, nodeType, step, targetHint, index, block.wave ?? 0),
    slotId: block.slotId ?? block.id,
  };
}

function initialEnergyBudget(nodeType: NodeType, step: number) {
  if (nodeType === "normal" && step === 0) return 0;
  return 1;
}

function selectInitialEnergyIds(blocks: CardBlock[], nodeType: NodeType, step: number) {
  const budget = initialEnergyBudget(nodeType, step);
  if (budget <= 0) return new Set<string>();
  const priority = ["copy", "time", "preview", "protect", "lock"];
  const utilityBlocks = blocks
    .filter((block) => block.kind === "utility" && block.cells.length === 1)
    .sort((a, b) => {
      const aIndex = priority.indexOf(a.id);
      const bIndex = priority.indexOf(b.id);
      return (aIndex < 0 ? priority.length : aIndex) - (bIndex < 0 ? priority.length : bIndex);
    });
  return new Set(utilityBlocks.slice(0, budget).map((block) => block.id));
}

function rebalanceBoardEconomy(blocks: CardBlock[], nodeType: NodeType, step: number, targetHint: number) {
  const energyIds = selectInitialEnergyIds(blocks, nodeType, step);
  let memoryIndex = 0;
  return blocks.map((block) => {
    if (block.kind === "hazard" && nodeType === "normal" && step === 0) {
      const memory = toMinorMemoryBlock(block, nodeType, step, targetHint, memoryIndex);
      memoryIndex += 1;
      return memory;
    }
    if (block.kind !== "utility") return block;
    if (energyIds.has(block.id)) return toEnergyBlock(block);
    const memory = toMinorMemoryBlock(block, nodeType, step, targetHint, memoryIndex);
    memoryIndex += 1;
    return memory;
  });
}

function fillEmptyCellsWithMinorMemories(blocks: CardBlock[], nodeType: NodeType, step: number, targetHint: number, wave = 0): CardBlock[] {
  const occupied = new Set(blocks.flatMap((block) => block.cells.map((cell) => `${cell.row}:${cell.col}`)));
  const filled = [...blocks];
  let memoryIndex = blocks.filter((block) => block.kind === "treasure" && block.itemId.startsWith("minor-memory-")).length;
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLUMNS; col += 1) {
      const key = `${row}:${col}`;
      if (occupied.has(key)) continue;
      const id = `memory-empty-${row}-${col}`;
      filled.push(makeMinorMemoryBlock(id, [{ row, col }], nodeType, step, targetHint, memoryIndex, wave));
      memoryIndex += 1;
      occupied.add(key);
    }
  }
  return filled;
}

function estimatedRequiredValue(blocks: CardBlock[], refillDeck: CardBlock[] = []) {
  const groupValues = new Map<string, number>();
  [...blocks, ...refillDeck].forEach((block) => {
    if (!isClearRequired(block)) return;
    const key = block.itemId;
    groupValues.set(key, Math.max(groupValues.get(key) ?? 0, block.value));
  });
  return [...groupValues.values()].reduce((sum, value) => sum + value, 0);
}

function targetForLevel(nodeType: NodeType, step: number, blocks: CardBlock[], refillDeck: CardBlock[], skills: SkillId[]) {
  const clearValue = estimatedRequiredValue(blocks, refillDeck);
  const ratio = nodeType === "boss" ? 0.86 : nodeType === "elite" ? 0.82 : step === 0 ? 0.76 : 0.8;
  const floor = targetHintForLevel(nodeType, step);
  const baseTarget = Math.max(floor, clearValue * ratio);
  const pressure = step === 0 ? 0 : controlPressureRate(skills);
  return roundToFifty(baseTarget * (1 + pressure));
}

function refillEnergyBudget(level: LevelState) {
  if (!canRefillLevel(level)) return 0;
  return 1;
}

function acquiredTitleSet(run: RunState) {
  return new Set((run.inventory.acquired ?? []).map((entry) => entry.replace(/\s+\+\d+$/, "")));
}

function pickFallbackDeepMemoryTheme(level: LevelState, index: number, blockedTitles = new Set<string>()) {
  const activeTitles = new Set(level.blocks.filter((block) => !block.collected).map((block) => block.title));
  const start = (level.refillWave * 3 + index) % DEEP_MEMORY_THEMES.length;
  for (let offset = 0; offset < DEEP_MEMORY_THEMES.length; offset += 1) {
    const theme = DEEP_MEMORY_THEMES[(start + offset) % DEEP_MEMORY_THEMES.length];
    if (!activeTitles.has(theme.title) && !blockedTitles.has(theme.title)) return theme;
  }
  return DEEP_MEMORY_THEMES[start];
}

function canPlaceRefillCardInSlot(card: CardBlock, slot: CardBlock) {
  if (slot.cells.length === 1) return true;
  return card.kind === "fragment" && (card.fragmentTotal ?? 1) > 1 && card.value >= 500;
}

function makeFallbackDeepMemoryPair(level: LevelState, index: number, blockedTitles?: Set<string>): [CardBlock, CardBlock] {
  const itemId = `deep-refill-${level.refillWave}-${index}`;
  const step = level.floor - 1;
  const theme = pickFallbackDeepMemoryTheme(level, index, blockedTitles);
  const first = makeDeepMemoryFragment(
    `${itemId}-a`,
    itemId,
    [{ row: 0, col: 0 }],
    level.nodeType,
    step,
    level.target,
    index,
    1,
    2,
    level.refillWave,
    theme,
  );
  const second = makeDeepMemoryFragment(
    `${itemId}-b`,
    itemId,
    [{ row: 0, col: 0 }],
    level.nodeType,
    step,
    level.target,
    index,
    2,
    2,
    level.refillWave,
    theme,
  );
  return [first, second];
}

function makeFallbackRefillCard(level: LevelState, slot: CardBlock, index: number, blockedTitles?: Set<string>) {
  if (slot.cells.length > 1) {
    const itemId = `deep-refill-single-${level.refillWave}-${index}`;
    const theme = pickFallbackDeepMemoryTheme(level, index, blockedTitles);
    return makeDeepMemoryFragment(
      `${itemId}-a`,
      itemId,
      [{ row: 0, col: 0 }],
      level.nodeType,
      level.floor - 1,
      level.target,
      index,
      1,
      1,
      level.refillWave,
      theme,
    );
  }
  const hasActiveEnergy = level.blocks.some((block) => !block.collected && block.effect === "energy");
  if (!hasActiveEnergy && refillEnergyBudget(level) > 0) {
    return makeEnergyBlock(`fallback-energy-${level.refillWave}-${index}`, [{ row: 0, col: 0 }], level.refillWave);
  }
  return makeMinorMemoryBlock(
    `fallback-memory-${level.refillWave}-${index}`,
    [{ row: 0, col: 0 }],
    level.nodeType,
    level.floor - 1,
    level.target,
    level.refillWave * 4 + index,
    level.refillWave,
  );
}

function isRefillAnomaly(block: CardBlock) {
  return block.effect === "shuffle" || block.effect === "seal" || block.effect === "mist";
}

function cloneCardIntoSlot(card: CardBlock, slot: CardBlock, wave: number, index: number): CardBlock {
  return {
    ...card,
    id: `${card.id}-w${wave}-${index}-${slot.slotId ?? slot.id}`,
    cells: slot.cells,
    slotId: slot.slotId ?? slot.id,
    wave,
    revealed: false,
    collected: false,
    locked: false,
  };
}

function makeRefillCard(
  id: string,
  itemId: string,
  title: string,
  tone: Tone,
  iconKey: IconKey,
  value: number,
  extras: Partial<CardBlock> = {},
) {
  return makeBlock(id, itemId, title, [{ row: 0, col: 0 }], tone, iconKey, value, {
    delayed: true,
    ...extras,
  });
}

function createRefillDeck(nodeType: NodeType, step: number, valueBoost: number, penalty: number): CardBlock[] {
  if (step === 0 && nodeType === "normal") return [];

  const deck: CardBlock[] = [
    makeRefillCard("refill-sticker", "sticker-photo", "贴纸相", "violet", "feather", 260 + valueBoost, {
      kind: "treasure",
      fragmentIndex: 1,
      fragmentTotal: 1,
    }),
    makeRefillCard("refill-ticket", "old-ticket", "旧车票", "teal", "scroll", 220 + valueBoost, {
      kind: "treasure",
      fragmentIndex: 1,
      fragmentTotal: 1,
    }),
  ];

  if (nodeType === "elite" || nodeType === "boss") {
    deck.unshift(
      makeRefillCard("late-mirror", "moon-mirror", "残镜", "blue", "circle", 460 + valueBoost, {
        fragmentIndex: 2,
        fragmentTotal: nodeType === "boss" ? 3 : 2,
        delayed: true,
      }),
    );
    deck.push(
      makeRefillCard("refill-hazard", "interference", "干扰", "danger", "sparkles", 0, {
        kind: "hazard",
        effect: "penalty",
        subtitle: `-${penalty}秒`,
      }),
    );
    if (step >= 3) {
      deck.push(
        makeRefillCard("mist-anomaly", "mist-anomaly", "雾化", "danger", "eye", 0, {
          kind: "hazard",
          effect: "mist",
          subtitle: "抹去预览",
        }),
      );
      if (nodeType === "elite") {
        deck.push(
          makeRefillCard("elite-shuffle-anomaly", "shuffle-anomaly", "打乱", "danger", "waves", 0, {
            kind: "hazard",
            effect: "shuffle",
            subtitle: "梦位交换",
          }),
        );
      }
    }
  }

  if (nodeType === "boss") {
    deck.unshift(
      makeRefillCard("late-name", "lost-name", "名字", "gold", "gem", 1880, {
        fragmentIndex: 1,
        fragmentTotal: 2,
        delayed: true,
      }),
      makeRefillCard("late-name-2", "lost-name", "名字", "gold", "gem", 1880, {
        fragmentIndex: 2,
        fragmentTotal: 2,
        delayed: true,
      }),
    );
    deck.push(
      makeRefillCard("shuffle-anomaly", "shuffle-anomaly", "打乱", "danger", "waves", 0, {
        kind: "hazard",
        effect: "shuffle",
        subtitle: "梦位交换",
      }),
      makeRefillCard("seal-anomaly", "seal-anomaly", "封锁", "danger", "lock", 0, {
        kind: "hazard",
        effect: "seal",
        subtitle: "锁住碎片",
      }),
      makeRefillCard("false-memory", "false-memory", "同学录", "gold", "scroll", 0, {
        kind: "utility",
        effect: "false-energy",
        subtitle: "误影",
      }),
    );
  }

  return deck;
}

function getBoardLayout(nodeType: NodeType, step: number) {
  const sequence = BOARD_LAYOUT_SEQUENCE[nodeType] ?? BOARD_LAYOUT_SEQUENCE.normal;
  const layoutIndex = sequence[step % sequence.length] ?? sequence[0];
  return BOARD_LAYOUTS[layoutIndex] ?? BOARD_LAYOUTS[0];
}

function createLevel(nodeType: NodeType, step: number, skills: SkillId[]): LevelState {
  const difficulty = nodeType === "boss" ? 3 : nodeType === "elite" ? 2 : 1;
  const id = `${nodeType}-${step + 1}-${Date.now()}`;
  const valueBoost = difficulty === 1 ? 0 : difficulty === 2 ? 220 : 520;
  const basePenalty = nodeType === "boss" ? 12 : nodeType === "elite" ? 8 : 5;
  const penalty = hasSkill({ skills }, "interference-filter") ? Math.max(3, basePenalty - 2) : basePenalty;
  const targetHint = targetHintForLevel(nodeType, step);
  const entryCost = getEntryCost(nodeType, step);
  const boardLayout = getBoardLayout(nodeType, step);

  let blocks: CardBlock[] = [
    makeBlock(
      "dream-1",
      "dream-core",
      "梦核",
      boardLayout.dreamCore[0],
      "gold",
      "gem",
      1550 + valueBoost,
      { fragmentIndex: 1, fragmentTotal: 5 },
    ),
    makeBlock("echo-1", "echo", "回声", boardLayout.echo[0], "teal", "hourglass", 820 + valueBoost, {
      fragmentIndex: 1,
      fragmentTotal: 3,
    }),
    makeBlock("echo-2", "echo", "回声", boardLayout.echo[1], "teal", "hourglass", 820 + valueBoost, {
      fragmentIndex: 2,
      fragmentTotal: 3,
    }),
    makeBlock(
      "echo-3",
      "echo",
      "回声",
      boardLayout.echo[2],
      "teal",
      "hourglass",
      820 + valueBoost,
      { fragmentIndex: 3, fragmentTotal: 3 },
    ),
    makeBlock("dream-2", "dream-core", "梦核", boardLayout.dreamCore[1], "gold", "gem", 1550 + valueBoost, {
      fragmentIndex: 2,
      fragmentTotal: 5,
    }),
    makeBlock("dream-3", "dream-core", "梦核", boardLayout.dreamCore[2], "gold", "gem", 1550 + valueBoost, {
      fragmentIndex: 3,
      fragmentTotal: 5,
    }),
    makeBlock("preview", "preview", "预览", [boardLayout.preview], "paper", "eye", 90, {
      kind: "utility",
      effect: "preview",
      subtitle: "看清全盘",
    }),
    makeBlock(
      "float-1",
      "float-dream",
      "浮梦",
      boardLayout.floatLarge,
      "violet",
      "feather",
      560 + valueBoost,
      { fragmentIndex: 1, fragmentTotal: 2 },
    ),
    makeBlock("protect", "protect", "保护", [boardLayout.protect], "paper", "shield", 80, {
      kind: "utility",
      effect: "protect",
      subtitle: "挡一次扣时",
    }),
    makeBlock(
      "bell",
      "clear-bell",
      "清心铃",
      boardLayout.bell,
      "green",
      "bell",
      360 + valueBoost,
      { kind: "treasure", fragmentIndex: 1, fragmentTotal: 1 },
    ),
    makeBlock("float-2", "float-dream", "浮梦", [boardLayout.floatSmall], "violet", "feather", 560 + valueBoost, {
      fragmentIndex: 2,
      fragmentTotal: 2,
    }),
    makeBlock("interference", "interference", "干扰", [boardLayout.interference], "danger", "sparkles", 0, {
      kind: "hazard",
      effect: "penalty",
      subtitle: `-${penalty}秒`,
    }),
    makeBlock("time", "time", "加时", [boardLayout.time], "paper", "hourglass", 100, {
      kind: "utility",
      effect: "time",
      subtitle: "+25秒",
    }),
    makeBlock("dream-4", "dream-core", "梦核", boardLayout.dreamCore[3], "gold", "gem", 1550 + valueBoost, {
      fragmentIndex: 4,
      fragmentTotal: 5,
    }),
    makeBlock(
      "mirror",
      "moon-mirror",
      "残镜",
      boardLayout.mirror,
      "blue",
      "circle",
      460 + valueBoost,
      { kind: "treasure", fragmentIndex: 1, fragmentTotal: 1 },
    ),
    makeBlock("lock", "lock", "锁定", [boardLayout.lock], "paper", "lock", 70, {
      kind: "utility",
      effect: "protect",
      subtitle: "护盾 +1",
    }),
    makeBlock("dream-5", "dream-core", "梦核", boardLayout.dreamCore[4], "gold", "gem", 1550 + valueBoost, {
      fragmentIndex: 5,
      fragmentTotal: 5,
    }),
    makeBlock("copy", "copy", "能量", [boardLayout.copy], "paper", "sparkles", 70, {
      kind: "utility",
      effect: "energy",
      subtitle: "技能 +1",
    }),
  ];

  if (nodeType === "normal") {
    const bellValue = 520 + valueBoost;
    const mirrorValue = 680 + valueBoost;
    blocks = blocks.map((block) => {
      if (block.id === "bell") {
        return {
          ...block,
          kind: "fragment",
          itemId: "clear-bell",
          value: bellValue,
          fragmentIndex: 1,
          fragmentTotal: 2,
          subtitle: undefined,
        };
      }
      if (block.id === "lock") {
        return {
          ...block,
          kind: "fragment",
          itemId: "clear-bell",
          title: "清心铃",
          tone: "green",
          iconKey: "bell",
          value: bellValue,
          fragmentIndex: 2,
          fragmentTotal: 2,
          effect: undefined,
          subtitle: undefined,
        };
      }
      if (block.id === "mirror") {
        return {
          ...block,
          kind: "fragment",
          itemId: "moon-mirror",
          value: mirrorValue,
          fragmentIndex: 1,
          fragmentTotal: 2,
          subtitle: undefined,
        };
      }
      if (block.id === "time") {
        return {
          ...block,
          kind: "fragment",
          itemId: "moon-mirror",
          title: "残镜",
          tone: "blue",
          iconKey: "circle",
          value: mirrorValue,
          fragmentIndex: 2,
          fragmentTotal: 2,
          effect: undefined,
          subtitle: undefined,
        };
      }
      return block;
    });
  }

  if (difficulty >= 2) {
    const bellValue = 360 + valueBoost;
    const mirrorValue = 460 + valueBoost;
    blocks = blocks.map((block) => {
      if (block.id === "bell") {
        return {
          ...block,
          kind: "fragment",
          itemId: "clear-bell",
          value: bellValue,
          fragmentIndex: 1,
          fragmentTotal: 2,
          subtitle: undefined,
        };
      }
      if (block.id === "lock") {
        return {
          ...block,
          kind: "fragment",
          itemId: "clear-bell",
          title: "清心铃",
          tone: "green",
          iconKey: "bell",
          value: bellValue,
          fragmentIndex: 2,
          fragmentTotal: 2,
          effect: undefined,
          subtitle: undefined,
        };
      }
      if (block.id === "mirror") {
        return {
          ...block,
          kind: "fragment",
          itemId: "moon-mirror",
          value: mirrorValue,
          fragmentIndex: 1,
          fragmentTotal: difficulty >= 3 ? 3 : 2,
          subtitle: undefined,
        };
      }
      if (difficulty >= 3 && block.id === "copy") {
        return {
          ...block,
          kind: "fragment",
          itemId: "moon-mirror",
          title: "残镜",
          tone: "blue",
          iconKey: "circle",
          value: mirrorValue,
          fragmentIndex: 3,
          fragmentTotal: 3,
          effect: undefined,
          subtitle: undefined,
        };
      }
      return block;
    });

    if (nodeType === "normal") {
      blocks.push(
        makeBlock("mirror-2", "moon-mirror", "残镜", [{ row: 3, col: 4 }], "blue", "circle", mirrorValue, {
          fragmentIndex: 2,
          fragmentTotal: 2,
        }),
      );
    }
  }

  blocks = rebalanceBoardEconomy(blocks, nodeType, step, targetHint);
  blocks = fillEmptyCellsWithMinorMemories(blocks, nodeType, step, targetHint);
  const refillDeck = createRefillDeck(nodeType, step, valueBoost, penalty);
  const target = targetForLevel(nodeType, step, blocks, refillDeck, skills);

  const level: LevelState = {
    id,
    nodeType,
    floor: step + 1,
    atmosphere: NODE_META[nodeType].text,
    entryCost,
    timeLeft: entryCost,
    target,
    value: 0,
    penalty,
    blocks,
    selectedIds: [],
    previewIds: [],
    previewSeenIds: [],
    refillDeck,
    refillWave: 1,
    refillQueued: false,
    refillPulse: 0,
    vanishedIds: [],
    virtualFragments: {},
    freeMistakeAvailable: skills.includes("quiet-mistake"),
    resolving: false,
    mismatchIds: [],
    successChain: 0,
    quickChain: 0,
    lastSuccessAt: 0,
  };

  if (skills.includes("lunar-preview")) {
    level.previewIds = blocks
      .filter((block) => block.kind !== "hazard")
      .slice(0, 4)
      .map((block) => block.id);
    level.previewSeenIds = level.previewIds;
  }

  return level;
}

function createInitialRun(archive: ArchiveState = createEmptyArchive()): RunState {
  const skills: SkillId[] = [];
  const level = createLevel("normal", 0, skills);
  return {
    phase: "level",
    time: STARTING_TIME - level.entryCost,
    step: 0,
    layer: 1,
    history: ["normal"],
    currentNode: "normal",
    skills,
    buildCharges: {},
    buildEnergy: 0,
    inventory: {
      acquired: [],
      merchantItems: [],
      buildRefreshes: 0,
      shield: 0,
    },
    shopPurchasedIds: [],
    archive,
    level,
    rewardChoices: [],
    rewardRoll: 0,
    dreamSeeds: [],
    lastPenalty: 0,
    notice: `已支付 ${formatTime(level.entryCost)} 进入第一段回忆。技能与道具都是空的，先从梦里找回自己。`,
    timeNotice: runTimeNotice("第一段入场", -level.entryCost, STARTING_TIME - level.entryCost),
    interferenceEvent: formatTimeDelta(-level.penalty),
  };
}

function loadRun(): RunState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialRun();
    const parsed = JSON.parse(raw) as RunState;
    if (!parsed || typeof parsed.time !== "number" || !parsed.inventory) return createInitialRun();
    const fallback = createInitialRun();
    const savedSkills = parsed.skills ?? [];
    const skills = savedSkills.filter((skillId) => SKILLS.some((skill) => skill.id === skillId));
    const buildCharges = {
      ...fallback.buildCharges,
      ...(parsed.buildCharges ?? {}),
    };
    const merged: RunState = {
      ...fallback,
      ...parsed,
      skills,
      buildCharges,
      buildEnergy: parsed.buildEnergy ?? 0,
      inventory: {
        ...fallback.inventory,
        ...parsed.inventory,
      },
      shopPurchasedIds: parsed.shopPurchasedIds ?? [],
      archive: normalizeArchive(parsed.archive, parsed.inventory, parsed.history, parsed.step),
      level: parsed.level,
      rewardRoll: parsed.rewardRoll ?? 0,
      dreamSeeds: parsed.dreamSeeds ?? fallback.dreamSeeds,
      currentNode: parsed.currentNode,
      lastSummary: parsed.lastSummary,
      notice: parsed.notice || "继续这段梦境。",
      timeNotice: parsed.timeNotice,
      interferenceEvent: parsed.interferenceEvent,
    };
    if (merged.level) {
      merged.level = {
        ...fallback.level,
        ...merged.level,
        atmosphere: merged.level.atmosphere ?? NODE_META[merged.level.nodeType]?.text ?? fallback.level!.atmosphere,
        refillDeck: merged.level.refillDeck ?? [],
        refillWave: merged.level.refillWave ?? 1,
        refillQueued: merged.level.refillQueued ?? false,
        refillPulse: merged.level.refillPulse ?? 0,
        vanishedIds: merged.level.vanishedIds ?? [],
        previewSeenIds: merged.level.previewSeenIds ?? merged.level.previewIds ?? [],
        mismatchIds: merged.level.mismatchIds ?? [],
        successChain: merged.level.successChain ?? 0,
        quickChain: merged.level.quickChain ?? 0,
        lastSuccessAt: merged.level.lastSuccessAt ?? 0,
      };
      merged.level = normalizeIntroLevelRefill(merged.level);
      merged.interferenceEvent = merged.interferenceEvent ?? formatTimeDelta(-merged.level.penalty);
    }
    if (merged.phase === "level" && !merged.level) return fallback;
    return {
      ...merged,
    };
  } catch {
    return createInitialRun();
  }
}

function getChoices(step: number): NodeType[] {
  const route: NodeType[][] = [
    ["normal", "elite", "shop"],
    ["normal", "elite", "rest"],
    ["shop", "normal", "elite"],
    ["rest", "elite", "normal"],
    ["boss"],
  ];
  return route[Math.min(step, route.length - 1)];
}

function isBossGateFailure(run: RunState) {
  const choices = getChoices(run.step);
  return choices.length === 1 && choices[0] === "boss" && run.time < getEntryCost("boss", run.step);
}

function bossGateFailureNotice(time: number, entryCost: number) {
  return `抵达遗失姓名前只剩 ${formatTime(time)}，无法支付 ${formatTime(entryCost)} 入场，梦境直接坍缩。`;
}

function getSkill(id: SkillId) {
  return SKILLS.find((skill) => skill.id === id)!;
}

function canOfferBuild(skill: SkillDefinition, run: RunState) {
  if (skill.tag !== "梦种") return true;
  return run.step >= 3 || (run.currentNode === "elite" && run.step >= 2) || run.currentNode === "boss";
}

function buildRewardChoices(run: RunState, roll = run.rewardRoll ?? 0) {
  const available = SKILLS.filter((skill) => !run.skills.includes(skill.id) && canOfferBuild(skill, run));
  if (!available.length) return [];

  const offset = (run.step + roll * 3) % available.length;
  const rotated = [...available.slice(offset), ...available.slice(0, offset)];
  const tagPlan: BuildTag[] = run.step >= 3 && roll % 2 === 0 ? ["技能", "棋盘", "梦种"] : ["技能", "棋盘", "被动"];
  const selected: SkillDefinition[] = [];

  tagPlan.forEach((tag) => {
    const candidate = rotated.find((skill) => skill.tag === tag && !selected.includes(skill));
    if (candidate) selected.push(candidate);
  });

  rotated.forEach((skill) => {
    if (selected.length >= 3) return;
    if (!selected.includes(skill)) selected.push(skill);
  });

  return selected.slice(0, 3).map((skill) => skill.id);
}

function buildSkipRefundTime(run: Pick<RunState, "rewardChoices" | "step">) {
  const offeredSkills = run.rewardChoices.map(getSkill);
  if (!offeredSkills.length) return 0;
  const offerValue =
    offeredSkills.reduce((sum, skill) => sum + BUILD_SKIP_REFUND_TIME[skill.tag], 0) / offeredSkills.length;
  const depthValue = Math.min(10, Math.max(0, run.step - 1) * 2);
  return Math.max(8, roundToFive(offerValue + depthValue));
}

function blockBounds(block: CardBlock) {
  const rows = block.cells.map((cell) => cell.row);
  const cols = block.cells.map((cell) => cell.col);
  return {
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
    minCol: Math.min(...cols),
    maxCol: Math.max(...cols),
  };
}

function isRectangular(block: CardBlock) {
  const bounds = blockBounds(block);
  const size = (bounds.maxRow - bounds.minRow + 1) * (bounds.maxCol - bounds.minCol + 1);
  return size === block.cells.length;
}

function irregularClipPath(block: CardBlock) {
  const bounds = blockBounds(block);
  const rows = bounds.maxRow - bounds.minRow + 1;
  const cols = bounds.maxCol - bounds.minCol + 1;
  const filled = new Set(block.cells.map((cell) => `${cell.row - bounds.minRow}:${cell.col - bounds.minCol}`));
  const nextByStart = new Map<string, CellPoint>();

  function key(point: CellPoint) {
    return `${point.row}:${point.col}`;
  }

  function hasCell(row: number, col: number) {
    return filled.has(`${row}:${col}`);
  }

  function addEdge(start: CellPoint, end: CellPoint) {
    nextByStart.set(key(start), end);
  }

  block.cells.forEach((cell) => {
    const row = cell.row - bounds.minRow;
    const col = cell.col - bounds.minCol;
    if (!hasCell(row - 1, col)) addEdge({ row, col }, { row, col: col + 1 });
    if (!hasCell(row, col + 1)) addEdge({ row, col: col + 1 }, { row: row + 1, col: col + 1 });
    if (!hasCell(row + 1, col)) addEdge({ row: row + 1, col: col + 1 }, { row: row + 1, col });
    if (!hasCell(row, col - 1)) addEdge({ row: row + 1, col }, { row, col });
  });

  const startKey = [...nextByStart.keys()].sort((a, b) => {
    const [ar, ac] = a.split(":").map(Number);
    const [br, bc] = b.split(":").map(Number);
    return ar - br || ac - bc;
  })[0];
  if (!startKey) return undefined;

  const points: CellPoint[] = [];
  let currentKey = startKey;
  for (let guard = 0; guard <= nextByStart.size + 1; guard += 1) {
    const [row, col] = currentKey.split(":").map(Number);
    points.push({ row, col });
    const next = nextByStart.get(currentKey);
    if (!next) break;
    currentKey = key(next);
    if (currentKey === startKey) break;
  }

  if (points.length < 3) return undefined;
  const simplified = points.filter((point, index) => {
    const prev = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    return !((prev.row === point.row && point.row === next.row) || (prev.col === point.col && point.col === next.col));
  });
  return `polygon(${simplified
    .map((point) => `${(point.col / cols) * 100}% ${(point.row / rows) * 100}%`)
    .join(", ")})`;
}

function blockLabelBox(block: CardBlock): ShapeLabelBox {
  const bounds = blockBounds(block);
  const cols = bounds.maxCol - bounds.minCol + 1;
  const rows = bounds.maxRow - bounds.minRow + 1;
  const filled = new Set(block.cells.map((cell) => `${cell.row - bounds.minRow}:${cell.col - bounds.minCol}`));
  let best = { row: 0, start: 0, length: 1, distance: Number.POSITIVE_INFINITY };
  const centerCol =
    block.cells.reduce((sum, cell) => sum + cell.col - bounds.minCol + 0.5, 0) / block.cells.length;
  const centerRow =
    block.cells.reduce((sum, cell) => sum + cell.row - bounds.minRow + 0.5, 0) / block.cells.length;

  for (let row = 0; row < rows; row += 1) {
    let col = 0;
    while (col < cols) {
      if (!filled.has(`${row}:${col}`)) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < cols && filled.has(`${row}:${col}`)) col += 1;
      const length = col - start;
      const runCenterCol = start + length / 2;
      const runCenterRow = row + 0.5;
      const distance = Math.abs(runCenterCol - centerCol) + Math.abs(runCenterRow - centerRow) * 0.6;
      if (length > best.length || (length === best.length && distance < best.distance)) {
        best = { row, start, length, distance };
      }
    }
  }

  return {
    x: ((best.start + best.length / 2) / cols) * 100,
    y: ((best.row + 0.5) / rows) * 100,
    width: (best.length / cols) * 94,
    height: (1 / rows) * 90,
  };
}

function cardAt(level: LevelState, row: number, col: number) {
  return level.blocks.find((block) => block.cells.some((cell) => cell.row === row && cell.col === col));
}

function effectiveNeed(block: CardBlock, run: RunState) {
  if (!block.fragmentTotal || block.fragmentTotal <= 1) return 1;
  const reduction = hasSkill(run, "fragment-lens") ? 1 : 0;
  return Math.max(2, block.fragmentTotal - reduction);
}

function applyValueBoost(value: number, run: RunState, kind: CardKind) {
  if ((kind === "treasure" || kind === "utility") && hasSkill(run, "small-gains")) return Math.round(value * 1.25);
  return value;
}

function hasPendingRequiredRefill(level: LevelState) {
  return level.refillDeck.some(isClearRequired);
}

function hasActiveRequiredLeft(level: LevelState) {
  return level.blocks.some((block) => isClearRequired(block) && !block.collected);
}

function canRefillLevel(level: LevelState) {
  return !(level.nodeType === "normal" && level.floor === 1);
}

function hasReachedLevelTarget(level: LevelState) {
  return level.target > 0 && level.value >= level.target;
}

function refillStatusForLevel(level: LevelState) {
  if (!canRefillLevel(level)) return "静止";
  if (hasReachedLevelTarget(level)) return "目标达成";
  if (level.refillQueued) return "刷新中";
  if (!hasActiveRequiredLeft(level) && hasPendingRequiredRefill(level)) return "待刷新";
  const collectedCount = level.blocks.filter((block) => block.collected).length;
  const remaining = Math.max(0, REFILL_EMPTY_THRESHOLD - Math.min(collectedCount, REFILL_EMPTY_THRESHOLD));
  return remaining > 0 ? `${remaining}槽后` : "可刷新";
}

function maybeQueueRefill(level: LevelState, force = false) {
  if (!canRefillLevel(level)) return { ...level, refillQueued: false };
  if (hasReachedLevelTarget(level)) return { ...level, refillQueued: false };
  if (level.refillQueued || allRequiredBlocksCollected(level)) return level;
  const emptyCount = level.blocks.filter((block) => block.collected).length;
  const needsDelayedRequired = !hasActiveRequiredLeft(level) && hasPendingRequiredRefill(level);
  if (force || emptyCount >= REFILL_EMPTY_THRESHOLD || needsDelayedRequired) {
    return { ...level, refillQueued: true, resolving: false };
  }
  return level;
}

function releaseOneLockedBlock(level: LevelState) {
  let released = false;
  return {
    ...level,
    blocks: level.blocks.map((block) => {
      if (released || !block.locked) return block;
      released = true;
      return { ...block, locked: false };
    }),
  };
}

function applyShuffleAnomaly(level: LevelState) {
  const includePreview = level.nodeType === "boss";
  const candidates = level.blocks
    .filter(
      (block) =>
        !block.collected &&
        !block.locked &&
        !block.revealed &&
        (includePreview || (!level.previewIds.includes(block.id) && !level.previewSeenIds.includes(block.id))),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const sameShapePool = [1, 2, 3, 4]
    .map((size) => candidates.filter((block) => block.cells.length === size))
    .find((group) => group.length >= 2);

  if (!sameShapePool) {
    return { level, notice: "打乱现象掠过，但没有足够可交换的隐藏牌。" };
  }

  const chosen = sameShapePool.slice(0, Math.min(level.nodeType === "boss" ? 3 : 2, sameShapePool.length));
  const rotatedCells = chosen.map((block) => block.cells);
  const rotatedSlots = chosen.map((block) => block.slotId);
  const cellById = new Map<string, CellPoint[]>();
  const slotById = new Map<string, string | undefined>();
  chosen.forEach((block, index) => {
    const nextIndex = (index + 1) % chosen.length;
    cellById.set(block.id, rotatedCells[nextIndex]);
    slotById.set(block.id, rotatedSlots[nextIndex]);
  });

  return {
    level: {
      ...level,
      blocks: level.blocks.map((block) =>
        cellById.has(block.id)
          ? { ...block, cells: cellById.get(block.id)!, slotId: slotById.get(block.id) ?? block.slotId }
          : block,
      ),
    },
    notice: `打乱现象改写了 ${chosen.length} 张隐藏牌的位置。`,
  };
}

function applySealAnomaly(level: LevelState, maxLocks = level.nodeType === "boss" ? 2 : 1) {
  const required = level.blocks
    .filter((block) => !block.collected && !block.locked && isClearRequired(block))
    .sort((a, b) => a.id.localeCompare(b.id));
  const lockCount = Math.min(maxLocks, Math.max(0, required.length - 1));
  if (lockCount <= 0) {
    return { level, notice: "封锁现象被梦境边界挡下，没有锁住关键碎片。" };
  }

  const lockedIds = new Set(required.slice(-lockCount).map((block) => block.id));
  return {
    level: {
      ...level,
      blocks: level.blocks.map((block) => (lockedIds.has(block.id) ? { ...block, locked: true } : block)),
    },
    notice: `封锁现象锁住了 ${lockCount} 个记忆槽。`,
  };
}

function applyMistAnomaly(level: LevelState) {
  if (!level.previewIds.length) {
    return { level, notice: "雾化现象散开，但没有可抹去的预览。" };
  }
  return {
    level: {
      ...level,
      previewIds: level.previewIds.slice(0, -1),
    },
    notice: "雾化现象抹去了一张短暂预览。",
  };
}

function applyRefillAnomaly(level: LevelState, anomaly: CardBlock, run: RunState) {
  if (hasSkill(run, "interference-filter") && anomaly.effect !== "mist" && level.refillWave % 2 === 1) {
    return { level, notice: "杂讯稀释压低了这次补牌异常。" };
  }
  if (anomaly.effect === "shuffle") {
    const result = applyShuffleAnomaly(level);
    if (!hasSkill(run, "dream-anchor")) return result;
    const marked = result.level.blocks.find((block) => isClearRequired(block) && !block.collected && !block.locked);
    if (!marked) return result;
    return {
      level: {
        ...result.level,
        previewIds: [...new Set([...result.level.previewIds, marked.id])],
        previewSeenIds: [...new Set([...result.level.previewSeenIds, marked.id])],
      },
      notice: `${result.notice} 梦锚保留了 1 个记忆标记。`,
    };
  }
  if (anomaly.effect === "seal") return applySealAnomaly(level, hasSkill(run, "dream-anchor") ? 1 : undefined);
  if (anomaly.effect === "mist") return applyMistAnomaly(level);
  return { level, notice: "" };
}

function resolveRefill(run: RunState): RunState {
  if (!run.level) return run;
  const sourceLevel = run.level;
  if (hasReachedLevelTarget(sourceLevel)) {
    return { ...run, level: { ...sourceLevel, refillQueued: false, resolving: true } };
  }
  if (!canRefillLevel(sourceLevel)) {
    return { ...run, level: { ...sourceLevel, refillQueued: false, resolving: false } };
  }
  const emptySlots = sourceLevel.blocks.filter((block) => block.collected);
  if (!emptySlots.length) {
    return { ...run, level: { ...sourceLevel, refillQueued: false } };
  }

  let deck = [...sourceLevel.refillDeck];
  let level: LevelState = {
    ...sourceLevel,
    blocks: sourceLevel.blocks.filter((block) => !block.collected),
    previewIds: sourceLevel.previewIds.filter((id) => sourceLevel.blocks.some((block) => block.id === id && !block.collected)),
    selectedIds: sourceLevel.selectedIds.filter((id) => sourceLevel.blocks.some((block) => block.id === id && !block.collected)),
    vanishedIds: [],
    refillQueued: false,
  };
  const notices: string[] = [];
  let interferenceEvent = run.interferenceEvent;
  const pendingFallbackFragments: CardBlock[] = [];
  const blockedFallbackTitles = new Set([
    ...acquiredTitleSet(run),
    ...sourceLevel.blocks.filter((block) => block.collected && isClearRequired(block)).map((block) => block.title),
  ]);

  emptySlots.forEach((slot, index) => {
    let nextCard: CardBlock | undefined;

    if (pendingFallbackFragments.length) {
      nextCard = pendingFallbackFragments.shift();
    }

    while (deck.length > 0 && !nextCard) {
      const candidateIndex = deck.findIndex(
        (candidate) => isRefillAnomaly(candidate) || canPlaceRefillCardInSlot(candidate, slot),
      );
      if (candidateIndex < 0) break;
      const candidate = deck.splice(candidateIndex, 1)[0];
      if (isRefillAnomaly(candidate)) {
        const result = applyRefillAnomaly(level, candidate, run);
        level = result.level;
        if (result.notice) {
          notices.push(result.notice);
          interferenceEvent = anomalyEventLabel(candidate.effect);
        }
      } else if (canPlaceRefillCardInSlot(candidate, slot)) {
        nextCard = candidate;
      }
    }

    if (!nextCard && slot.cells.length > 1 && index < emptySlots.length - 1) {
      const [first, second] = makeFallbackDeepMemoryPair(level, index, blockedFallbackTitles);
      nextCard = first;
      pendingFallbackFragments.push(second);
      blockedFallbackTitles.add(first.title);
    }

    const card = nextCard ?? makeFallbackRefillCard(level, slot, index, blockedFallbackTitles);
    if (isClearRequired(card)) blockedFallbackTitles.add(card.title);
    level = {
      ...level,
      blocks: [...level.blocks, cloneCardIntoSlot(card, slot, sourceLevel.refillWave, index)],
    };
  });

  level = {
    ...level,
    refillDeck: deck,
    refillWave: sourceLevel.refillWave + 1,
    refillPulse: (sourceLevel.refillPulse ?? 0) + 1,
  };

  return {
    ...run,
    level,
    notice: notices.length ? notices.join(" ") : "梦境补上了新的记忆。",
    interferenceEvent,
  };
}

function normalizeIntroLevelRefill(level: LevelState): LevelState {
  if (canRefillLevel(level)) return level;
  return {
    ...level,
    refillDeck: [],
    refillWave: 1,
    refillQueued: false,
    refillPulse: level.refillPulse ?? 0,
    vanishedIds: level.vanishedIds ?? [],
    resolving: false,
    mismatchIds: [],
    blocks: level.blocks.filter((block) => (block.wave ?? 0) === 0),
  };
}

function unlockSealedBlock(run: RunState, blockId: string): RunState {
  if (!run.level) return run;
  const block = run.level.blocks.find((item) => item.id === blockId);
  if (!block?.locked) return run;

  let buildEnergy = run.buildEnergy ?? 0;
  let buildCharges = { ...(run.buildCharges ?? {}) };
  let notice = "封锁需要 1 点梦能、任意技能充能，或完成一次拼合来解除。";

  if (hasSkill(run, "time-lock") && getSkillCharge(run, "time-lock") >= getSkill("time-lock").chargeCost) {
    buildCharges = spendSkillChargeMap(buildCharges, "time-lock", getSkill("time-lock").chargeCost);
    notice = "定时锁定抵消了封锁，记忆槽重新浮现。";
  } else if (buildEnergy > 0) {
    buildEnergy -= 1;
    notice = "消耗 1 点储备梦能，封锁解除。";
  } else {
    const chargedSkill = run.skills.find((skillId) => (buildCharges[skillId] ?? 0) > 0);
    if (chargedSkill) {
      buildCharges = spendSkillChargeMap(buildCharges, chargedSkill, 1);
      notice = `抽取 ${getSkill(chargedSkill).name} 的 1 点充能，封锁解除。`;
    } else {
      return { ...run, notice };
    }
  }

  return {
    ...run,
    buildEnergy,
    buildCharges,
    level: {
      ...run.level,
      blocks: run.level.blocks.map((item) => (item.id === blockId ? { ...item, locked: false } : item)),
    },
    notice,
  };
}

function getEntryCost(nodeType: NodeType, step: number) {
  const base = nodeType === "boss" ? 95 : nodeType === "elite" ? 72 : 52;
  const growth = nodeType === "boss" ? 8 : nodeType === "elite" ? 6 : 4;
  return base + step * growth;
}

function isClearRequired(block: CardBlock) {
  return block.kind === "fragment" || block.kind === "treasure";
}

function allRequiredBlocksCollected(level: LevelState) {
  return level.blocks.filter(isClearRequired).every((block) => block.collected) && !hasPendingRequiredRefill(level);
}

function isLevelComplete(level: LevelState) {
  return hasReachedLevelTarget(level) || allRequiredBlocksCollected(level);
}

function revealLevel(level: LevelState): LevelState {
  return {
    ...level,
    selectedIds: [],
    previewIds: [],
    vanishedIds: [],
    refillPulse: level.refillPulse ?? 0,
    refillQueued: false,
    resolving: false,
    mismatchIds: [],
    blocks: level.blocks.map((block) => ({ ...block, revealed: true, locked: false })),
  };
}

function finishLevel(run: RunState, level: LevelState, reason: RewardSummary["reason"]): RunState {
  const revealedLevel = revealLevel(level);

  const overflow = Math.max(0, level.value - level.target);
  const divisor = hasSkill(run, "loop-seed")
    ? hasSkill(run, "overflow-interest")
      ? 28
      : 34
    : hasSkill(run, "overflow-interest")
      ? 38
      : 55;
  const overflowTime = Math.floor(overflow / divisor);
  const refundedTime = Math.max(0, level.timeLeft);
  const summary: RewardSummary = {
    title: level.nodeType === "boss" ? "梦境闭合" : "记忆回收完成",
    value: level.value,
    target: level.target,
    entryCost: level.entryCost,
    refundedTime,
    overflowTime,
    reason,
  };
  const settledTime = run.time + refundedTime + overflowTime;
  const reasonText = reason === "clear" ? "核心记忆已回收" : "关卡时间耗尽";
  const levelTimeGain = refundedTime + overflowTime;
  const settlementNotice = `${reasonText}，本关收获 ${formatTime(levelTimeGain)}（返还 ${formatTime(refundedTime)}，溢出 ${formatTime(overflowTime)}）。`;
  const settlementTimeNotice = runTimeNotice("关卡收获", levelTimeGain, settledTime);
  const archivedRun = archiveCompletedLevel(run, revealedLevel, summary);

  if (level.nodeType === "boss") {
    const seededRun = archiveDreamSeed(archivedRun, "梦种·回环");
    return {
      ...seededRun,
      phase: "victory",
      time: settledTime,
      level: revealedLevel,
      dreamSeeds: [...new Set([...(run.dreamSeeds ?? []), "梦种·回环"])],
      lastSummary: summary,
      notice: `${settlementNotice} 并留下梦种·回环。`,
      timeNotice: settlementTimeNotice,
    };
  }

  return {
    ...archivedRun,
    phase: "reward",
    time: settledTime,
    level: revealedLevel,
    rewardRoll: 0,
    rewardChoices: buildRewardChoices(run, 0),
    lastSummary: summary,
    notice: settlementNotice,
    timeNotice: settlementTimeNotice,
  };
}

function finishIfLevelOver(run: RunState, level: LevelState): RunState {
  if (level.timeLeft <= 0) return finishLevel(run, { ...level, timeLeft: 0 }, "time");
  if (hasReachedLevelTarget(level)) return { ...run, level: { ...level, refillQueued: false, resolving: true } };
  const queuedLevel = maybeQueueRefill(level);
  if (queuedLevel.refillQueued) return { ...run, level: queuedLevel };
  if (allRequiredBlocksCollected(level)) return { ...run, level: { ...level, resolving: true } };
  return { ...run, level };
}

function completeGroup(run: RunState, itemId: string, selectedIds: string[], copied = 0): RunState {
  if (!run.level) return run;
  const level = run.level;
  const groupBlocks = level.blocks.filter((block) => block.itemId === itemId);
  const lead = groupBlocks[0];
  const value = applyValueBoost(Math.max(...groupBlocks.map((block) => block.value)), run, lead.kind);
  const collectedLevel: LevelState = {
    ...level,
    value: level.value + value,
    selectedIds: [],
    refillDeck: level.refillDeck.filter((block) => block.itemId !== itemId),
    virtualFragments: { ...level.virtualFragments, [itemId]: 0 },
    blocks: level.blocks.map((block) =>
      block.itemId === itemId || selectedIds.includes(block.id)
        ? { ...block, revealed: true, collected: true }
        : block,
    ),
  };
  const nextLevel = maybeQueueRefill(releaseOneLockedBlock(collectedLevel), selectedIds.length >= 2);

  const label = copied > 0 ? `${lead.title} 用复制碎片补齐` : `${lead.title} 已拼合`;
  const archivedRun = archiveBoardCollectible(
    {
      ...run,
      level: nextLevel,
      inventory: {
        ...run.inventory,
        acquired: [...run.inventory.acquired, `${lead.title} +${value}`],
      },
    },
    lead,
    value,
  );
  const nextRun = applyRecoveryPerks(
    archivedRun,
    nextLevel,
    `${label}，获得 ${value} 价值。`,
    "match",
  );

  return finishIfLevelOver(nextRun, nextRun.level!);
}

function collectUtility(run: RunState, block: CardBlock): RunState {
  if (!run.level) return run;
  const level = run.level;
  const boost = hasSkill(run, "small-gains");
  let timeLeft = level.timeLeft;
  let inventory = { ...run.inventory };
  let buildCharges = { ...(run.buildCharges ?? {}) };
  let lastPenalty = run.lastPenalty;
  let notice = "";
  let timeNotice = run.timeNotice;
  let interferenceEvent = run.interferenceEvent;
  let previewIds = level.previewIds;
  let previewSeenIds = level.previewSeenIds;
  let freeMistakeAvailable = level.freeMistakeAvailable;
  let valueGain = applyValueBoost(block.value, run, block.kind);
  let energyGain = 0;

  if (block.effect === "time") {
    const gain = boost ? 35 : 25;
    timeLeft += gain;
    notice = `加时 ${formatTimeDelta(gain)}。`;
    timeNotice = levelTimeNotice(`${block.title}加时`, gain, timeLeft);
  } else if (block.effect === "preview") {
    previewIds = level.blocks.filter((item) => !item.collected).map((item) => item.id);
    previewSeenIds = [...new Set([...previewSeenIds, ...previewIds])];
    notice = "预览生效，所有未取得的记忆短暂显形。";
  } else if (block.effect === "protect") {
    inventory = { ...inventory, shield: inventory.shield + 1 };
    notice = "保护生效，下一次匹配失败不扣时间。";
  } else if (block.effect === "copy") {
    energyGain = energyGainFor(run, 1);
    notice = `能量涌入，Build 技能充能 +${energyGain}。`;
  } else if (block.effect === "lock") {
    inventory = { ...inventory, shield: inventory.shield + 1 };
    notice = "锁定生效，获得 1 层护盾。";
  } else if (block.effect === "energy") {
    energyGain = energyGainFor(run, 1);
    notice = `能量涌入，Build 技能充能 +${energyGain}。`;
  } else if (block.effect === "false-energy") {
    energyGain = energyGainFor(run, 1);
    valueGain = 0;
    notice = `误影散开，梦能 +${energyGain}。`;
    interferenceEvent = anomalyEventLabel(block.effect);
  } else if (block.effect === "penalty") {
    let cost = level.penalty;
    if (freeMistakeAvailable) {
      freeMistakeAvailable = false;
      cost = 0;
    } else if (hasSkill(run, "quiet-mistake") && getSkillCharge(run, "quiet-mistake") >= getSkill("quiet-mistake").chargeCost) {
      buildCharges = spendSkillChargeMap(buildCharges, "quiet-mistake", getSkill("quiet-mistake").chargeCost);
      cost = 0;
    }
    timeLeft = Math.max(0, timeLeft - cost);
    lastPenalty = cost;
    valueGain = 0;
    interferenceEvent = cost > 0 ? formatTimeDelta(-cost) : "抵消";
    notice = cost > 0 ? `干扰 ${formatTimeDelta(-cost)}。` : "干扰被抵消。";
    timeNotice =
      cost > 0
        ? levelTimeNotice("梦境干扰", -cost, timeLeft)
        : `干扰抵消，本关 ${formatTime(timeLeft)}`;
  }

  const nextLevel = maybeQueueRefill({
    ...level,
    timeLeft,
    value: level.value + valueGain,
    previewIds,
    previewSeenIds,
    freeMistakeAvailable,
    blocks: level.blocks.map((item) =>
      item.id === block.id ? { ...item, revealed: true, collected: true } : item,
    ),
  });
  const nextRunBase: RunState = {
    ...run,
    inventory,
    buildCharges,
    lastPenalty,
    level: nextLevel,
    notice,
    timeNotice,
    interferenceEvent,
  };
  const chargedRun = energyGain > 0 ? addBuildEnergy(nextRunBase, energyGain) : nextRunBase;
  const nextRun = archiveBoardCollectible(chargedRun, block, valueGain);

  return finishIfLevelOver(nextRun, nextLevel);
}

function getStageStats(run: RunState): Array<{ label: string; value: string; danger?: boolean }> {
  if (run.phase === "level" && run.level) {
    const interferenceEvent = run.interferenceEvent ?? formatTimeDelta(-run.level.penalty);
    return [
      {
        label: "本关时限",
        value: formatTime(run.level.timeLeft),
        danger: run.level.timeLeft <= Math.max(run.level.penalty, 10),
      },
      {
        label: "梦境干扰",
        value: interferenceEvent,
        danger: interferenceEvent.startsWith("-") || ["打乱", "封锁", "雾化", "误影"].includes(interferenceEvent),
      },
    ];
  }

  if (run.phase === "map") {
    return [{ label: "当前层数", value: `${run.layer}/15` }];
  }

  if (run.phase === "shop") {
    return [
      { label: "当前层数", value: `${run.layer}/15` },
      { label: "梦市可消费", value: formatTime(run.time) },
    ];
  }

  if (run.phase === "rest") {
    return [
      { label: "当前层数", value: `${run.layer}/15` },
      { label: "休息前余时", value: formatTime(run.time) },
    ];
  }

  return [
    { label: "当前层数", value: `${run.layer}/15` },
    { label: "总梦时", value: formatTime(run.time) },
  ];
}

function AppContent({
  audioEnabled,
  audioState,
  onToggleAudio,
}: {
  audioEnabled: boolean;
  audioState: AudioPlaybackState;
  onToggleAudio: () => void;
}) {
  const [run, setRun] = useState<RunState>(loadRun);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const mismatchTimers = useRef<number[]>([]);
  const collectedVanishTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
  }, [run]);

  useEffect(() => {
    if (run.phase !== "map" || !isBossGateFailure(run)) return;
    const entryCost = getEntryCost("boss", run.step);
    setRun({
      ...run,
      phase: "gameover",
      currentNode: "boss",
      level: undefined,
      notice: bossGateFailureNotice(run.time, entryCost),
      timeNotice: `Boss入场不足，需要 ${formatTime(entryCost)}`,
    });
  }, [run]);

  useEffect(() => {
    if (run.phase !== "level" || !run.level || run.level.resolving || run.level.refillQueued) return;
    const timer = window.setInterval(() => {
      setRun((current) => {
        if (
          current.phase !== "level" ||
          !current.level ||
          current.level.resolving ||
          current.level.refillQueued ||
          isLevelComplete(current.level) ||
          current.level.timeLeft <= 0
        ) {
          return current;
        }
        const nextTimeLeft = Math.max(0, current.level.timeLeft - 1);
        return {
          ...current,
          level: { ...current.level, timeLeft: nextTimeLeft },
          timeNotice: nextTimeLeft <= 0 ? "本关 00:00，梦醒" : current.timeNotice,
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [run.phase, run.level?.id, run.level?.resolving, run.level?.refillQueued]);

  useEffect(() => {
    if (run.phase !== "level" || !run.level || run.level.resolving) return;
    if (run.level.timeLeft > 0 && !isLevelComplete(run.level)) return;
    setRun((current) => {
      if (current.phase !== "level" || !current.level || current.level.resolving) return current;
      if (current.level.timeLeft > 0 && !isLevelComplete(current.level)) return current;
      return finishIfLevelOver(current, current.level);
    });
  }, [run]);

  useEffect(() => {
    if (run.phase !== "level" || !run.level?.refillQueued || run.level.resolving) return;
    const timer = window.setTimeout(() => {
      setRun((current) => {
        if (current.phase !== "level" || !current.level?.refillQueued || current.level.resolving) return current;
        const refilledRun = resolveRefill(current);
        if (!refilledRun.level) return refilledRun;
        return finishIfLevelOver(refilledRun, refilledRun.level);
      });
    }, REFILL_MATERIALIZE_MS);
    return () => window.clearTimeout(timer);
  }, [run.phase, run.level?.id, run.level?.refillQueued, run.level?.resolving, run.level?.refillWave]);

  useEffect(() => {
    if (run.phase !== "level" || !run.level?.resolving || !isLevelComplete(run.level)) return;
    const timer = window.setTimeout(() => {
      setRun((current) => {
        if (current.phase !== "level" || !current.level || !isLevelComplete(current.level)) return current;
        return finishLevel(current, { ...current.level, resolving: false }, "clear");
      });
    }, MATCH_SUCCESS_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [
    run.phase,
    run.level?.id,
    run.level?.resolving,
    run.level?.blocks.map((block) => `${block.id}:${block.collected}`).join("|"),
  ]);

  useEffect(() => {
    if (run.phase !== "level" || !run.level?.previewIds.length) return;
    const timer = window.setTimeout(() => {
      setRun((current) => {
        if (!current.level) return current;
        return { ...current, level: { ...current.level, previewIds: [] } };
      });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [run.phase, run.level?.id, run.level?.previewIds.join("|")]);

  useEffect(() => {
    if (run.phase !== "level" || !run.level) {
      Object.values(collectedVanishTimers.current).forEach((timer) => window.clearTimeout(timer));
      collectedVanishTimers.current = {};
      return;
    }

    const vanishedIds = new Set(run.level.vanishedIds);
    const pendingCollectedIds = new Set(
      run.level.blocks.filter((block) => block.collected && !vanishedIds.has(block.id)).map((block) => block.id),
    );

    Object.entries(collectedVanishTimers.current).forEach(([id, timer]) => {
      if (!pendingCollectedIds.has(id)) {
        window.clearTimeout(timer);
        delete collectedVanishTimers.current[id];
      }
    });

    pendingCollectedIds.forEach((id) => {
      if (collectedVanishTimers.current[id]) return;
      collectedVanishTimers.current[id] = window.setTimeout(() => {
        delete collectedVanishTimers.current[id];
        setRun((current) => {
          if (current.phase !== "level" || !current.level) return current;
          const stillCollected = current.level.blocks.some((block) => block.id === id && block.collected);
          if (!stillCollected || current.level.vanishedIds.includes(id)) return current;
          return {
            ...current,
            level: {
              ...current.level,
              vanishedIds: [...current.level.vanishedIds, id],
            },
          };
        });
      }, COLLECTED_CARD_HIDE_MS);
    });
  }, [
    run.phase,
    run.level?.id,
    run.level?.blocks.map((block) => `${block.id}:${block.collected}`).join("|"),
    run.level?.vanishedIds.join("|"),
  ]);

  useEffect(() => {
    return () => {
      mismatchTimers.current.forEach((timer) => window.clearTimeout(timer));
      mismatchTimers.current = [];
      Object.values(collectedVanishTimers.current).forEach((timer) => window.clearTimeout(timer));
      collectedVanishTimers.current = {};
    };
  }, []);

  const selectedBlock = useMemo(() => {
    if (!run.level || !run.level.selectedIds.length) return undefined;
    return run.level.blocks.find((block) => block.id === run.level!.selectedIds[0]);
  }, [run.level]);

  function resetRun() {
    mismatchTimers.current.forEach((timer) => window.clearTimeout(timer));
    mismatchTimers.current = [];
    Object.values(collectedVanishTimers.current).forEach((timer) => window.clearTimeout(timer));
    collectedVanishTimers.current = {};
    setArchiveOpen(false);
    setRun(createInitialRun(run.archive ?? createEmptyArchive()));
  }

  function resolveMismatch(ids: string[]) {
    setRun((current) => {
      if (!current.level || current.phase !== "level") return current;
      return {
        ...current,
        level: {
          ...current.level,
          mismatchIds: current.level.mismatchIds.filter((id) => !ids.includes(id)),
          blocks: current.level.blocks.map((block) =>
            ids.includes(block.id) && !block.collected ? { ...block, revealed: false } : block,
          ),
        },
      };
    });
  }

  function handleBlockClick(blockId: string) {
    if (run.phase !== "level" || !run.level || run.level.resolving) return;
    const level = run.level;
    const block = level.blocks.find((item) => item.id === blockId);
    if (!block || block.collected) return;
    if (level.mismatchIds.includes(block.id)) return;

    if (block.locked) {
      setRun(unlockSealedBlock(run, block.id));
      return;
    }

    if (block.revealed && level.selectedIds.includes(block.id)) {
      setRun({
        ...run,
        level: {
          ...level,
          selectedIds: level.selectedIds.filter((id) => id !== block.id),
          blocks: level.blocks.map((item) => (item.id === block.id ? { ...item, revealed: false } : item)),
        },
        notice: `${block.title} 暂时放回梦里，等待它的其它碎片浮现。`,
      });
      return;
    }

    if (block.revealed) return;

    const selectedIds = level.selectedIds;
    const selected = selectedIds
      .map((id) => level.blocks.find((item) => item.id === id))
      .filter(Boolean) as CardBlock[];

    if (selected.length && selected[0].itemId !== block.itemId) {
      const mismatchIds = [...selectedIds, block.id];
      let inventory = { ...run.inventory };
      let buildCharges = { ...(run.buildCharges ?? {}) };
      let freeMistakeAvailable = level.freeMistakeAvailable;
      let penalty = level.penalty;
      let notice = `匹配失败，${selected[0].title} 与 ${block.title} 不是同一组。`;

      if (inventory.shield > 0) {
        inventory = { ...inventory, shield: inventory.shield - 1 };
        penalty = 0;
        notice = "保护抵消了这次匹配失败。";
      } else if (hasSkill(run, "quiet-mistake") && getSkillCharge(run, "quiet-mistake") >= getSkill("quiet-mistake").chargeCost) {
        buildCharges = spendSkillChargeMap(buildCharges, "quiet-mistake", getSkill("quiet-mistake").chargeCost);
        penalty = 0;
        notice = "静默失误释放，本次失败不扣时间。";
      } else if (freeMistakeAvailable) {
        freeMistakeAvailable = false;
        penalty = 0;
        notice = "静默失误生效，本次失败不扣时间。";
      }

      const nextTimeLeft = Math.max(0, level.timeLeft - penalty);
      const nextLevel: LevelState = {
        ...level,
        timeLeft: nextTimeLeft,
        selectedIds: [],
        mismatchIds: [...new Set([...level.mismatchIds, ...mismatchIds])],
        freeMistakeAvailable,
        successChain: 0,
        quickChain: 0,
        lastSuccessAt: 0,
        blocks: level.blocks.map((item) => (item.id === block.id ? { ...item, revealed: true } : item)),
      };

      const nextRun = {
        ...run,
        inventory,
        buildCharges,
        lastPenalty: penalty,
        level: nextLevel,
        notice: penalty > 0 ? `${notice} ${formatTimeDelta(-penalty)}。` : notice,
        timeNotice:
          penalty > 0
            ? levelTimeNotice("误配扣时", -penalty, nextTimeLeft)
            : `${notice} 本关 ${formatTime(nextTimeLeft)}`,
        interferenceEvent: penalty > 0 ? formatTimeDelta(-penalty) : "抵消",
      };

      if (nextTimeLeft <= 0) {
        setRun(finishLevel(nextRun, nextLevel, "time"));
        return;
      }

      setRun(nextRun);

      const timer = window.setTimeout(() => {
        resolveMismatch(mismatchIds);
        mismatchTimers.current = mismatchTimers.current.filter((item) => item !== timer);
      }, MISMATCH_FEEDBACK_MS);
      mismatchTimers.current = [...mismatchTimers.current, timer];
      return;
    }

    if (block.kind === "utility" || block.kind === "hazard") {
      setRun(collectUtility(run, block));
      return;
    }

    if (block.kind === "treasure" || (block.fragmentTotal ?? 1) <= 1) {
      const value = applyValueBoost(block.value, run, block.kind);
      const nextLevel = maybeQueueRefill({
        ...level,
        value: level.value + value,
        refillDeck: level.refillDeck.filter((item) => item.itemId !== block.itemId),
        blocks: level.blocks.map((item) =>
          item.id === block.id ? { ...item, revealed: true, collected: true } : item,
        ),
      });
      const archivedRun = archiveBoardCollectible(
        {
          ...run,
          level: nextLevel,
          inventory: {
            ...run.inventory,
            acquired: [...run.inventory.acquired, `${block.title} +${value}`],
          },
        },
        block,
        value,
      );
      const nextRun = applyRecoveryPerks(
        archivedRun,
        nextLevel,
        `${block.title} 已取得，获得 ${value} 价值。`,
        "pickup",
      );
      setRun(
        finishIfLevelOver(
          nextRun,
          nextRun.level!,
        ),
      );
      return;
    }

    if (!selected.length || selected[0].itemId === block.itemId) {
      const newSelectedIds = [...selectedIds, block.id];
      const virtual = level.virtualFragments[block.itemId] ?? 0;
      const revealedLevel: LevelState = {
        ...level,
        selectedIds: newSelectedIds,
        blocks: level.blocks.map((item) => (item.id === block.id ? { ...item, revealed: true } : item)),
      };
      const nextRun = { ...run, level: revealedLevel, notice: `${block.title} ${block.fragmentIndex}/${block.fragmentTotal} 已翻开。` };
      if (newSelectedIds.length + virtual >= effectiveNeed(block, run)) {
        setRun(completeGroup(nextRun, block.itemId, newSelectedIds, virtual));
      } else {
        setRun(nextRun);
      }
      return;
    }
  }

  function useBuildSkill(skillId: SkillId) {
    if (run.phase !== "level" || !run.level || !run.skills.includes(skillId)) return;
    const skill = getSkill(skillId);
    const charge = getSkillCharge(run, skillId);
    if (skill.trigger !== "active" || charge < skill.chargeCost) return;

    if (skillId === "rewind" && run.lastPenalty <= 0) {
      setRun({ ...run, notice: "当前没有可回溯的扣时。" });
      return;
    }

    const selectedLead =
      run.level.selectedIds
        .map((id) => run.level!.blocks.find((block) => block.id === id))
        .filter(Boolean)[0] as CardBlock | undefined;
    const guideTarget = skillId === "guide" ? findPreviewTarget(run.level, selectedLead?.itemId) : undefined;

    if (skillId === "guide") {
      if (!guideTarget) {
        setRun({ ...run, notice: "当前没有可指引的隐藏牌。" });
        return;
      }
    }

    const buildCharges = spendSkillChargeMap(run.buildCharges ?? {}, skillId, skill.chargeCost);

    if (skillId === "guide") {
      const target = guideTarget;
      if (!target) return;
      setRun({
        ...run,
        buildCharges,
        level: {
          ...run.level,
          previewIds: [...run.level.previewIds, target.id],
          previewSeenIds: [...new Set([...run.level.previewSeenIds, target.id])],
        },
        notice:
          selectedLead && target.itemId === selectedLead.itemId
            ? `指引顺着 ${selectedLead.title} 找到了同组碎片。`
            : `指引揭示了 ${target.title}。`,
      });
      return;
    }

    if (skillId === "rewind") {
      const nextTimeLeft = run.level.timeLeft + run.lastPenalty;
      setRun({
        ...run,
        buildCharges,
        level: { ...run.level, timeLeft: nextTimeLeft },
        lastPenalty: 0,
        notice: `回溯 ${formatTimeDelta(run.lastPenalty)}。`,
        timeNotice: levelTimeNotice("回溯撤销扣时", run.lastPenalty, nextTimeLeft),
        interferenceEvent: "回溯",
      });
      return;
    }

    if (skillId === "time-lock") {
      const locked = run.level.blocks.find((block) => block.locked);
      const nextTimeLeft = run.level.timeLeft + 10;
      setRun({
        ...run,
        buildCharges,
        inventory: { ...run.inventory, shield: run.inventory.shield + 1 },
        level: {
          ...run.level,
          timeLeft: nextTimeLeft,
          blocks: locked
            ? run.level.blocks.map((block) => (block.id === locked.id ? { ...block, locked: false } : block))
            : run.level.blocks,
        },
        notice: locked
          ? `定时锁定 ${formatTimeDelta(10)}，护盾 +1，封锁解除。`
          : `定时锁定 ${formatTimeDelta(10)}，护盾 +1。`,
        timeNotice: levelTimeNotice("定时锁定加时", 10, nextTimeLeft),
      });
      return;
    }

    if (skillId === "lunar-preview") {
      const previewIds = run.level.blocks.filter((block) => !block.collected).map((block) => block.id);
      setRun({
        ...run,
        buildCharges,
        level: {
          ...run.level,
          previewIds,
          previewSeenIds: [...new Set([...run.level.previewSeenIds, ...previewIds])],
        },
        notice: "月相预兆释放，所有未取得的记忆短暂显形。",
      });
      return;
    }

    if (skillId === "fragment-lens") {
      const selected = run.level.selectedIds
        .map((id) => run.level!.blocks.find((block) => block.id === id))
        .filter(Boolean) as CardBlock[];
      if (!selected.length) {
        setRun({ ...run, notice: "先翻开一个碎片，再释放碎片折光。" });
        return;
      }
      const lead = selected[0];
      const virtual = (run.level.virtualFragments[lead.itemId] ?? 0) + 1;
      const baseRun: RunState = {
        ...run,
        buildCharges,
        level: {
          ...run.level,
          virtualFragments: { ...run.level.virtualFragments, [lead.itemId]: virtual },
        },
        notice: `碎片折光补入 ${lead.title}，当前进度 ${selected.length + virtual}/${effectiveNeed(lead, run)}。`,
      };
      if (selected.length + virtual >= effectiveNeed(lead, run)) {
        setRun(completeGroup(baseRun, lead.itemId, run.level.selectedIds, virtual));
      } else {
        setRun(baseRun);
      }
      return;
    }
  }

  function chooseReward(skillId?: SkillId) {
    if (run.phase !== "reward") return;
    const nextStep = run.step + 1;
    const chosenSkill = skillId ? getSkill(skillId) : undefined;
    const skills = skillId && !run.skills.includes(skillId) ? [...run.skills, skillId] : run.skills;
    const skipRefund = chosenSkill ? 0 : buildSkipRefundTime(run);
    const nextTime = run.time + skipRefund;
    const nextRun = addBuildEnergy(
      {
        ...run,
        time: nextTime,
        skills,
        buildEnergy: 0,
      },
      run.buildEnergy ?? 0,
    );
    const rewardRun: RunState = {
      ...run,
      time: nextTime,
      buildCharges: nextRun.buildCharges,
      buildEnergy: nextRun.buildEnergy,
      phase: "map",
      step: nextStep,
      layer: Math.min(15, run.layer + 1),
      skills,
      rewardChoices: [],
      rewardRoll: 0,
      level: undefined,
      dreamSeeds:
        chosenSkill?.tag === "梦种"
          ? [...new Set([...(run.dreamSeeds ?? []), chosenSkill.name])]
          : run.dreamSeeds,
      notice: chosenSkill
        ? `获得${chosenSkill.tag}：${chosenSkill.name}。`
        : `跳过 Build，返还 ${formatTime(skipRefund)} 梦时。`,
      timeNotice: chosenSkill ? run.timeNotice : runTimeNotice("跳过Build", skipRefund, nextTime),
    };
    setRun(chosenSkill ? archiveSkillReward(rewardRun, chosenSkill) : rewardRun);
  }

  function refreshRewardChoices() {
    if (run.phase !== "reward" || (run.inventory.buildRefreshes ?? 0) <= 0) return;
    const rewardRoll = (run.rewardRoll ?? 0) + 1;
    setRun({
      ...run,
      rewardRoll,
      inventory: {
        ...run.inventory,
        buildRefreshes: Math.max(0, (run.inventory.buildRefreshes ?? 0) - 1),
      },
      rewardChoices: buildRewardChoices(run, rewardRoll),
      notice: "改写梦签燃尽，Build 奖励重新浮现。",
    });
  }

  function chooseNode(nodeType: NodeType) {
    if (run.phase !== "map") return;
    if (nodeType === "shop" || nodeType === "rest") {
      setRun({
        ...run,
        phase: nodeType,
        currentNode: nodeType,
        shopPurchasedIds: nodeType === "shop" ? [] : run.shopPurchasedIds,
        history: [...run.history, nodeType],
        notice: nodeType === "shop" ? "梦市开启，时间就是筹码。" : "休息点可恢复或整理梦境。",
      });
      return;
    }
    const level = createLevel(nodeType, run.step, run.skills);
    if (run.time < level.entryCost) {
      if (nodeType === "boss") {
        setRun({
          ...run,
          phase: "gameover",
          currentNode: "boss",
          level: undefined,
          notice: bossGateFailureNotice(run.time, level.entryCost),
          timeNotice: `Boss入场不足，需要 ${formatTime(level.entryCost)}`,
        });
        return;
      }
      setRun({
        ...run,
        notice: `时间不足，进入${NODE_META[nodeType].label}关需要 ${formatTime(level.entryCost)}。`,
        timeNotice: `入场不足，需要 ${formatTime(level.entryCost)}`,
      });
      return;
    }
    const pressureText = getBuildControlScore(run.skills) > 0 ? "梦开始抵抗被控制，清醒目标被轻微抬升。" : "";
    const entryText =
      nodeType === "elite"
        ? `已支付 ${formatTime(level.entryCost)} 进入「${level.atmosphere}」。大块记忆需要小碎片补齐。`
        : `已支付 ${formatTime(level.entryCost)} 进入「${level.atmosphere}」。`;
    setRun({
      ...run,
      phase: "level",
      time: run.time - level.entryCost,
      currentNode: nodeType,
      history: [...run.history, nodeType],
      level,
      notice: pressureText ? `${entryText}${pressureText}` : entryText,
      timeNotice: runTimeNotice(`${level.atmosphere}入场`, -level.entryCost, run.time - level.entryCost),
      interferenceEvent: formatTimeDelta(-level.penalty),
    });
  }

  function leaveUtilityNode(notice: string, patch: Partial<RunState> = {}) {
    const nextStep = run.step + 1;
    setRun({
      ...run,
      ...patch,
      phase: "map",
      step: nextStep,
      layer: Math.min(15, run.layer + 1),
      notice,
    });
  }

  function applyMerchantItemEffects(baseRun: RunState, item: ShopItem) {
    let nextRun = baseRun;
    if (item.id === "scroll") {
      const gain = energyGainFor(nextRun, 1);
      nextRun = addBuildEnergy({ ...nextRun, notice: `记忆卷轴展开，Build 技能充能 +${gain}。` }, gain);
    }
    if (item.id === "rewind") {
      const restored = nextRun.lastPenalty;
      const gain = energyGainFor(nextRun, 1);
      const nextTimeLeft = nextRun.level ? nextRun.level.timeLeft + restored : undefined;
      nextRun = addBuildEnergy({
        ...nextRun,
        level: nextRun.level && nextTimeLeft !== undefined ? { ...nextRun.level, timeLeft: nextTimeLeft } : nextRun.level,
        lastPenalty: 0,
        notice: restored > 0 ? `回溯水纹 ${formatTimeDelta(restored)}，梦能 +${gain}。` : `回溯水纹，梦能 +${gain}。`,
        timeNotice:
          restored > 0 && nextTimeLeft !== undefined
            ? levelTimeNotice("回溯水纹返还", restored, nextTimeLeft)
            : nextRun.timeNotice,
        interferenceEvent: restored > 0 ? "回溯" : nextRun.interferenceEvent,
      }, gain);
    }
    if (item.id === "lock") {
      nextRun = {
        ...nextRun,
        inventory: { ...nextRun.inventory, shield: nextRun.inventory.shield + 1 },
        notice: "定时锁链生效，护盾 +1。",
      };
    }
    if (item.id === "copy") {
      const gain = energyGainFor(nextRun, 2);
      nextRun = addBuildEnergy({ ...nextRun, notice: `记忆碎片共鸣，Build 技能充能 +${gain}。` }, gain);
    }
    return nextRun;
  }

  function buyShopItem(item: ShopItem) {
    if (run.phase !== "shop" || !canBuyShopItem(run, item)) return;
    if (item.kind === "refresh") {
      const nextTime = run.time - item.cost;
      const nextRun = archiveShopItem({
        ...run,
        time: nextTime,
        shopPurchasedIds: [...run.shopPurchasedIds, item.id],
        inventory: {
          ...run.inventory,
          buildRefreshes: (run.inventory.buildRefreshes ?? 0) + 1,
        },
        notice: `${item.name} 已收好，时间 ${formatTimeDelta(-item.cost)}。`,
        timeNotice: runTimeNotice(`购买${item.name}`, -item.cost, nextTime),
      }, item);
      setRun(nextRun);
      return;
    }

    const nextTime = run.time - item.cost;
    const nextRun = archiveShopItem({
      ...run,
      time: nextTime,
      shopPurchasedIds: [...run.shopPurchasedIds, item.id],
      inventory: {
        ...run.inventory,
        merchantItems: [...(run.inventory.merchantItems ?? []), item.id],
      },
      notice: `${item.name} 入槽，时间 ${formatTimeDelta(-item.cost)}。`,
      timeNotice: runTimeNotice(`购买${item.name}`, -item.cost, nextTime),
    }, item);
    setRun(nextRun);
  }

  function useMerchantItem(item: ShopItem) {
    if (run.phase !== "level") return;
    const merchantItems = [...(run.inventory.merchantItems ?? [])];
    const itemIndex = merchantItems.indexOf(item.id);
    if (itemIndex < 0) return;
    merchantItems.splice(itemIndex, 1);
    const nextRun = applyMerchantItemEffects({
      ...run,
      inventory: { ...run.inventory, merchantItems },
    }, item);
    setRun(nextRun);
  }

  function rest(option: "time" | "cleanse" | "focus") {
    if (option === "time") {
      const nextTime = run.time + 45;
      leaveUtilityNode(`休息完成，时间 ${formatTimeDelta(45)}。`, {
        time: nextTime,
        timeNotice: runTimeNotice("月窗休息", 45, nextTime),
      });
    } else if (option === "cleanse") {
      leaveUtilityNode("梦境已整理，护盾与回溯补充。", {
        inventory: { ...run.inventory, shield: run.inventory.shield + 1 },
        lastPenalty: 0,
      });
    } else {
      const chargedRun = addBuildEnergy(run, 2);
      leaveUtilityNode("专注冥想完成，Build 技能获得 2 点能量。", {
        buildCharges: chargedRun.buildCharges,
        buildEnergy: chargedRun.buildEnergy,
      });
    }
  }

  const stageStats = getStageStats(run);

  return (
    <main className="app-shell">
      <StatusBar
        run={run}
        audioEnabled={audioEnabled}
        audioState={audioState}
        onToggleAudio={onToggleAudio}
        onOpenArchive={() => setArchiveOpen(true)}
      />
      <section className="title-row">
        <div>
          <h1>梦境记忆</h1>
          <p>月相拼图</p>
        </div>
        <div className="interference-panel">
          <div>
            {stageStats.map((stat) => (
              <div className={["interference-stat", stat.danger ? "is-danger" : ""].join(" ")} key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="notice-bar" aria-live="polite">
        {run.notice}
      </div>

      {run.phase === "reward" && run.level ? (
        <LevelSettlement run={run} onChooseReward={chooseReward} onRefreshRewards={refreshRewardChoices} />
      ) : run.phase === "shop" ? (
        <ShopPanel run={run} onBuy={buyShopItem} onLeave={() => leaveUtilityNode("离开梦市，路线继续。")} />
      ) : run.phase === "rest" ? (
        <RestPanel run={run} onRest={rest} />
      ) : run.phase === "victory" || run.phase === "gameover" ? (
        <EndPanel run={run} onReset={resetRun} />
      ) : run.level ? (
        <MemoryBoard run={run} onBlockClick={handleBlockClick} />
      ) : (
        <MapChoice run={run} onChoose={chooseNode} />
      )}

      {run.phase === "level" && (
        <ActionDock
          run={run}
          selectedBlock={selectedBlock}
          onUseSkill={useBuildSkill}
          onUseMerchantItem={useMerchantItem}
        />
      )}
      {(run.phase === "level" || run.phase === "map") && <RouteStrip run={run} />}
      {archiveOpen && <ArchivePanel run={run} onClose={() => setArchiveOpen(false)} />}
    </main>
  );
}

function StatusBar({
  run,
  audioEnabled,
  audioState,
  onToggleAudio,
  onOpenArchive,
}: {
  run: RunState;
  audioEnabled: boolean;
  audioState: AudioPlaybackState;
  onToggleAudio: () => void;
  onOpenArchive: () => void;
}) {
  const value = run.level?.value ?? 0;
  const target = run.level?.target ?? 1800;
  const soundBlocked = audioState === "blocked";
  const soundActive = audioEnabled && audioState !== "blocked";
  const SoundIcon = soundActive ? Volume2 : VolumeX;
  return (
    <header className="status-bar">
      <StatusMetric label="总梦时" value={formatTime(run.time)} />
      <StatusMetric label="目标价值" value={target.toString()} />
      <StatusMetric label="已获价值" value={value.toString()} />
      <button
        className={["icon-button", soundActive ? "is-sound-on" : "is-sound-off"].join(" ")}
        type="button"
        aria-label={soundActive ? "关闭音效" : "开启音效"}
        onClick={onToggleAudio}
      >
        <SoundIcon size={22} />
        <span>{soundBlocked ? "重试" : soundActive ? "音效" : "静音"}</span>
      </button>
      <button className="icon-button" type="button" aria-label="图鉴" onClick={onOpenArchive}>
        <BookOpen size={22} />
        <span>图鉴</span>
      </button>
    </header>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function liveSkillArchiveRecord(skill: SkillDefinition): ArchiveCollectibleRecord {
  return {
    key: `build:${skill.id}`,
    title: skill.name,
    kind: "build",
    tag: skill.tag,
    tone: skill.tag === "棋盘" ? "teal" : skill.tag === "被动" ? "blue" : skill.tag === "梦种" ? "gold" : "violet",
    iconKey: skill.iconKey,
    value: skill.chargeCost,
    count: 1,
    source: "当前 Build",
    flavor: skill.text,
    lastSeenAt: 0,
  };
}

function liveSeedArchiveRecord(title: string): ArchiveCollectibleRecord {
  return {
    key: `seed:${title}`,
    title,
    kind: "seed",
    tag: "梦种",
    tone: "gold",
    iconKey: "moon",
    value: 1,
    count: 1,
    source: "深层梦境",
    flavor: "这枚梦种已被带出终点，像一粒还在发光的名字。",
    lastSeenAt: 0,
  };
}

function buildArchiveEntries(run: RunState) {
  const archive = normalizeArchive(run.archive, run.inventory, run.history, run.step);
  const archived = archive.entries.filter((entry) => entry.kind === "build" || entry.kind === "seed");
  const keys = new Set(archived.map((entry) => entry.key));
  const liveSkills = run.skills.map(getSkill).map(liveSkillArchiveRecord).filter((entry) => !keys.has(entry.key));
  liveSkills.forEach((entry) => keys.add(entry.key));
  const liveSeeds = (run.dreamSeeds ?? []).map(liveSeedArchiveRecord).filter((entry) => !keys.has(entry.key));
  return sortArchiveEntries([...archived, ...liveSkills, ...liveSeeds]);
}

function archiveEntryValueLabel(entry: ArchiveCollectibleRecord) {
  if (entry.kind === "shop") return `花费 ${formatTime(entry.value)}`;
  if (entry.kind === "build") return `${entry.tag} · ${entry.value}格`;
  if (entry.kind === "seed") return "深层留种";
  if (entry.kind === "hazard") return "已遭遇";
  return entry.value > 0 ? `价值 ${entry.value}` : entry.source;
}

function ArchiveEntryCard({ entry }: { entry: ArchiveCollectibleRecord }) {
  const Icon = ICONS[entry.iconKey];
  const tone = TONE_STYLES[entry.tone] ?? TONE_STYLES.gold;
  const style = {
    "--archive-tone-bg": tone.bg,
    "--archive-tone-edge": tone.edge,
    "--archive-tone-text": tone.text,
    "--archive-tone-glow": tone.glow,
  } as CSSProperties;

  return (
    <article className={["archive-entry", `archive-kind-${entry.kind}`].join(" ")} style={style}>
      <span className="archive-entry-icon">
        <Icon size={24} strokeWidth={1.45} />
      </span>
      <span className="archive-entry-copy">
        <span>
          <em>{entry.tag}</em>
          <strong>{entry.title}</strong>
          {entry.fragmentTotal && entry.fragmentTotal > 1 ? <b>{entry.fragmentTotal}片</b> : null}
        </span>
        <small>{entry.flavor}</small>
        <i>{entry.source}</i>
      </span>
      <span className="archive-entry-meta">
        <b>{archiveEntryValueLabel(entry)}</b>
        {entry.count > 1 ? <small>x{entry.count}</small> : null}
      </span>
    </article>
  );
}

function ArchiveLevelCard({ level }: { level: ArchiveLevelRecord }) {
  const meta = NODE_META[level.nodeType];
  const Icon = meta.icon;
  const progress = level.target > 0 ? Math.round((level.value / level.target) * 100) : 0;
  const cleared = level.reason === "clear";
  return (
    <article className={["archive-level-card", level.nodeType, cleared ? "is-cleared" : "is-timeout"].join(" ")}>
      <span className="archive-level-art" aria-hidden="true" />
      <span className="archive-level-copy">
        <span>
          <Icon size={24} strokeWidth={1.45} />
          <strong>{level.atmosphere}</strong>
          <em>{cleared ? "核心回收" : "时间耗尽"}</em>
        </span>
        <small>
          第{level.floor}层 · {meta.label} · 回收 {level.recoveredCount} 件
        </small>
        <i>
          {level.target > 0 ? `${level.value}/${level.target} · ${progress}%` : "旧档梦段"} · 收获 {formatTime(level.timeGain)}
        </i>
      </span>
    </article>
  );
}

function ArchiveEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="archive-empty-state">
      <BookOpen size={30} strokeWidth={1.35} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function ArchivePanel({ run, onClose }: { run: RunState; onClose: () => void }) {
  const [tab, setTab] = useState<ArchiveTab>("collectibles");
  const archive = normalizeArchive(run.archive, run.inventory, run.history, run.step);
  const collectibles = archive.entries.filter((entry) => entry.kind !== "build" && entry.kind !== "seed");
  const builds = buildArchiveEntries(run);
  const clearedCount = archive.levels.filter((level) => level.reason === "clear").length;
  const totalValue = archive.entries.reduce((sum, entry) => sum + entry.value * entry.count, 0);
  const tabs: Array<{ id: ArchiveTab; label: string; count: number }> = [
    { id: "collectibles", label: "藏品", count: collectibles.length },
    { id: "levels", label: "梦段", count: archive.levels.length },
    { id: "build", label: "Build", count: builds.length },
  ];

  return (
    <section className="archive-overlay" role="dialog" aria-modal="true" aria-label="梦境图鉴">
      <div className="archive-panel">
        <div className="archive-head">
          <span>
            <BookOpen size={24} strokeWidth={1.45} />
            <strong>月档图鉴</strong>
          </span>
          <button className="archive-close" type="button" aria-label="关闭图鉴" onClick={onClose}>
            <X size={20} strokeWidth={1.7} />
          </button>
        </div>

        <div className="archive-summary">
          <span>
            <small>通关</small>
            <strong>{clearedCount}</strong>
          </span>
          <span>
            <small>藏品</small>
            <strong>{collectibles.length}</strong>
          </span>
          <span>
            <small>归档价值</small>
            <strong>{totalValue}</strong>
          </span>
        </div>

        <div className="archive-tabs" role="tablist" aria-label="图鉴分类">
          {tabs.map((item) => (
            <button
              type="button"
              className={tab === item.id ? "is-active" : ""}
              aria-selected={tab === item.id}
              role="tab"
              key={item.id}
              onClick={() => setTab(item.id)}
            >
              <span>{item.label}</span>
              <b>{item.count}</b>
            </button>
          ))}
        </div>

        <div className="archive-body">
          {tab === "collectibles" ? (
            collectibles.length ? (
              <div className="archive-entry-list">
                {collectibles.map((entry) => (
                  <ArchiveEntryCard entry={entry} key={entry.key} />
                ))}
              </div>
            ) : (
              <ArchiveEmpty title="藏品尚未点亮" text="拼合第一段记忆后，找回的旧物会自动压入月档。" />
            )
          ) : tab === "levels" ? (
            archive.levels.length ? (
              <div className="archive-level-list">
                {archive.levels.map((level) => (
                  <ArchiveLevelCard level={level} key={level.key} />
                ))}
              </div>
            ) : (
              <ArchiveEmpty title="梦段尚未封存" text="完成一段回忆后，旧校门、操场和更深处都会留下记录。" />
            )
          ) : builds.length ? (
            <div className="archive-entry-list">
              {builds.map((entry) => (
                <ArchiveEntryCard entry={entry} key={entry.key} />
              ))}
            </div>
          ) : (
            <ArchiveEmpty title="Build 仍是空槽" text="通关后的三选一奖励会在这里成为你的构筑页。" />
          )}
        </div>
      </div>
    </section>
  );
}

function MemoryBoard({ run, onBlockClick }: { run: RunState; onBlockClick: (id: string) => void }) {
  const level = run.level!;
  const activeLevel = run.phase === "level";
  const vanishedIds = new Set(activeLevel ? level.vanishedIds : []);
  const refillGhostBlocks =
    activeLevel && canRefillLevel(level)
      ? level.blocks.filter((block) => block.collected && vanishedIds.has(block.id))
      : [];
  const refillProgress = Math.min(1, level.refillQueued ? 1 : refillGhostBlocks.length / REFILL_EMPTY_THRESHOLD);
  const cells = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLUMNS; col += 1) {
      const block = cardAt(level, row, col);
      if (!block) continue;
      const vanished = block.collected && vanishedIds.has(block.id);
      const peeked =
        !vanished &&
        !block.locked &&
        !block.revealed &&
        !block.collected &&
        level.previewSeenIds.includes(block.id);
      const visible = !vanished && (block.locked || block.revealed || block.collected || level.previewIds.includes(block.id) || peeked);
      const selected = level.selectedIds.includes(block.id);
      const mismatched = level.mismatchIds.includes(block.id);
      const rectangular = isRectangular(block);
      const hasShapeOverlay = !rectangular && Boolean(irregularClipPath(block));
      const hasBlockOverlay = rectangular;
      const animatingCollected = block.collected && !vanished && !hasBlockOverlay;
      const successCollected = block.collected && isClearRequired(block);
      const sameTop = block.cells.some((cell) => cell.row === row - 1 && cell.col === col);
      const sameRight = block.cells.some((cell) => cell.row === row && cell.col === col + 1);
      const sameBottom = block.cells.some((cell) => cell.row === row + 1 && cell.col === col);
      const sameLeft = block.cells.some((cell) => cell.row === row && cell.col === col - 1);
      const tone = visible ? TONE_STYLES[block.tone] : TONE_STYLES.back;
      const isAnchor = block.cells[0].row === row && block.cells[0].col === col;
      const renderInline = !rectangular && !hasShapeOverlay && isAnchor;

      cells.push(
        <button
          key={`${row}-${col}`}
          type="button"
          className={[
            "grid-cell",
            `tone-${block.tone}`,
            visible ? "is-visible" : "is-hidden",
            peeked ? "is-peeked" : "",
            hasBlockOverlay ? "has-block-overlay" : "",
            vanished ? "is-vanished" : "",
            animatingCollected ? "is-collected" : "",
            animatingCollected && successCollected ? "is-success-collected" : "",
            block.locked ? "is-locked" : "",
            selected ? "is-selected" : "",
            mismatched ? "is-mismatch" : "",
            !rectangular ? "is-irregular" : "",
            hasShapeOverlay ? "has-shape-overlay" : "",
            block.kind === "hazard" && visible && !block.collected ? "is-danger" : "",
          ].join(" ")}
          style={{
            gridColumn: col + 1,
            gridRow: row + 1,
            background: tone.bg,
            color: tone.text,
            boxShadow: selected ? `${tone.glow}, inset 0 0 0 2px rgba(255,255,255,.24)` : tone.glow,
            borderTopColor: sameTop ? "rgba(255, 231, 176, .18)" : tone.edge,
            borderRightColor: sameRight ? "rgba(255, 231, 176, .18)" : tone.edge,
            borderBottomColor: sameBottom ? "rgba(255, 231, 176, .18)" : tone.edge,
            borderLeftColor: sameLeft ? "rgba(255, 231, 176, .18)" : tone.edge,
          }}
          aria-hidden={hasBlockOverlay ? true : undefined}
          aria-label={`${block.title}${block.fragmentIndex ? ` ${block.fragmentIndex}/${block.fragmentTotal}` : ""}`}
          tabIndex={hasBlockOverlay ? -1 : undefined}
          onClick={hasBlockOverlay ? undefined : () => onBlockClick(block.id)}
        >
          {renderInline && <BlockFace block={block} run={run} visible={visible} compact />}
        </button>,
      );
    }
  }

  const overlays = level.blocks.filter(isRectangular).map((block) => {
    const bounds = blockBounds(block);
    const vanished = block.collected && vanishedIds.has(block.id);
    const peeked =
      !vanished &&
      !block.locked &&
      !block.revealed &&
      !block.collected &&
      level.previewSeenIds.includes(block.id);
    const visible = !vanished && (block.locked || block.revealed || block.collected || level.previewIds.includes(block.id) || peeked);
    const animatingCollected = block.collected && !vanished;
    const successCollected = block.collected && isClearRequired(block);
    const mismatched = level.mismatchIds.includes(block.id);
    const tone = visible ? TONE_STYLES[block.tone] : TONE_STYLES.back;
    const style = {
      gridColumn: `${bounds.minCol + 1} / ${bounds.maxCol + 2}`,
      gridRow: `${bounds.minRow + 1} / ${bounds.maxRow + 2}`,
      "--tone-bg": tone.bg,
      "--tone-edge": tone.edge,
      "--tone-text": tone.text,
      "--tone-glow": tone.glow,
      "--block-cols": `${bounds.maxCol - bounds.minCol + 1}`,
      "--block-rows": `${bounds.maxRow - bounds.minRow + 1}`,
    } as CSSProperties;
    return (
      <button
        key={block.id}
        type="button"
        className={[
          "block-overlay",
          block.cells.length <= 1 ? "is-single-block" : "",
          block.cells.length > 1 ? "is-merged-block" : "",
          `tone-${block.tone}`,
          visible ? "is-visible" : "is-hidden",
          peeked ? "is-peeked" : "",
          vanished ? "is-vanished" : "",
          animatingCollected ? "is-collected" : "",
          animatingCollected && successCollected ? "is-success-collected" : "",
          block.locked ? "is-locked" : "",
          level.selectedIds.includes(block.id) ? "is-selected" : "",
          mismatched ? "is-mismatch" : "",
        ].join(" ")}
        style={style}
        aria-label={`${block.title}${block.fragmentIndex ? ` ${block.fragmentIndex}/${block.fragmentTotal}` : ""}`}
        onClick={() => onBlockClick(block.id)}
      >
        <BlockFace block={block} run={run} visible={visible} compact={block.cells.length <= 1} />
      </button>
    );
  });

  const shapeOverlays = level.blocks
    .filter((block) => !isRectangular(block))
    .map((block) => {
      const clipPath = irregularClipPath(block);
      if (!clipPath) return null;

      const bounds = blockBounds(block);
      const labelBox = blockLabelBox(block);
      const vanished = block.collected && vanishedIds.has(block.id);
      const peeked =
        !vanished &&
        !block.locked &&
        !block.revealed &&
        !block.collected &&
        level.previewSeenIds.includes(block.id);
      const visible = !vanished && (block.locked || block.revealed || block.collected || level.previewIds.includes(block.id) || peeked);
      const animatingCollected = block.collected && !vanished;
      const successCollected = block.collected && isClearRequired(block);
      const mismatched = level.mismatchIds.includes(block.id);
      const tone = visible ? TONE_STYLES[block.tone] : TONE_STYLES.back;
      const style = {
        gridColumn: `${bounds.minCol + 1} / ${bounds.maxCol + 2}`,
        gridRow: `${bounds.minRow + 1} / ${bounds.maxRow + 2}`,
        clipPath,
        WebkitClipPath: clipPath,
        "--tone-bg": tone.bg,
        "--tone-edge": tone.edge,
        "--tone-text": tone.text,
        "--tone-glow": tone.glow,
        "--block-cols": `${bounds.maxCol - bounds.minCol + 1}`,
        "--block-rows": `${bounds.maxRow - bounds.minRow + 1}`,
        "--shape-label-x": `${labelBox.x}%`,
        "--shape-label-y": `${labelBox.y}%`,
        "--shape-label-width": `${labelBox.width}%`,
        "--shape-label-height": `${labelBox.height}%`,
      } as CSSProperties;

  return (
    <div
      key={`${block.id}-shape`}
          className={[
            "block-overlay",
            "shape-overlay",
            "is-merged-block",
            `tone-${block.tone}`,
            visible ? "is-visible" : "is-hidden",
            peeked ? "is-peeked" : "",
            vanished ? "is-vanished" : "",
            animatingCollected ? "is-collected" : "",
            animatingCollected && successCollected ? "is-success-collected" : "",
            block.locked ? "is-locked" : "",
            level.selectedIds.includes(block.id) ? "is-selected" : "",
            mismatched ? "is-mismatch" : "",
          ].join(" ")}
          style={style}
          aria-hidden="true"
        >
          <BlockFace block={block} run={run} visible={visible} />
        </div>
      );
    });

  const refillGhosts = refillGhostBlocks.map((block) => {
    const bounds = blockBounds(block);
    const clipPath = !isRectangular(block) ? irregularClipPath(block) : undefined;
    const style = {
      gridColumn: `${bounds.minCol + 1} / ${bounds.maxCol + 2}`,
      gridRow: `${bounds.minRow + 1} / ${bounds.maxRow + 2}`,
      "--refill-progress": refillProgress.toFixed(2),
      ...(clipPath
        ? {
            clipPath,
            WebkitClipPath: clipPath,
          }
        : {}),
    } as CSSProperties;

    return (
      <div
        aria-hidden="true"
        className={[
          "refill-ghost",
          level.refillQueued ? "is-materializing" : "",
          clipPath ? "is-shape" : "",
        ].join(" ")}
        key={`refill-ghost-${block.id}`}
        style={style}
      />
    );
  });

  const progress = level.target > 0 ? (level.value / level.target) * 100 : 0;
  const targetMarker = 72;
  const overflowScale = 60;
  const progressWidth =
    progress <= 100
      ? (progress / 100) * targetMarker
      : Math.min(100, targetMarker + ((progress - 100) / overflowScale) * (100 - targetMarker));
  const baseProgressWidth = Math.min(progressWidth, targetMarker);
  const bonusProgressWidth = Math.max(0, progressWidth - targetMarker);
  const progressStatus = progress > 100 ? "is-overflow" : progress >= 100 ? "is-complete" : "is-pending";
  const chainText = [
    level.successChain > 0 ? `连对${level.successChain}` : "",
    level.quickChain > 1 ? `心流${level.quickChain}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="board-section">
      <div className={["progress-row", progressStatus].join(" ")}>
        <span>
          {level.atmosphere ?? NODE_META[level.nodeType].text}
          {chainText ? ` · ${chainText}` : ""}
        </span>
        <div
          className={[
            "progress-track",
            progressStatus,
          ].join(" ")}
          style={{ "--target-left": `${targetMarker}%` } as CSSProperties}
          aria-label={`已获 ${level.value}，目标 ${level.target}，完成 ${Math.round(progress)}%`}
        >
          <i className="progress-fill-base" style={{ width: `${baseProgressWidth}%` }} />
          <i
            className="progress-fill-bonus"
            style={{ left: `${targetMarker}%`, width: `${bonusProgressWidth}%` }}
          />
          <b className="progress-target-marker" style={{ left: `${targetMarker}%` }} />
        </div>
        <strong>{Math.round(progress)}%</strong>
      </div>
      <div
        className={["memory-board", level.refillQueued ? "is-refill-queued" : ""].join(" ")}
        aria-label="合并网格记忆牌盘"
      >
        {cells}
        {refillGhosts}
        {overlays}
        {shapeOverlays}
        {activeLevel && (level.refillPulse ?? 0) > 0 && (
          <div className="refill-burst" aria-hidden="true" key={`refill-burst-${level.refillPulse}`} />
        )}
      </div>
    </section>
  );
}

function blockKindLabel(block: CardBlock) {
  if (block.kind === "hazard") return "异常";
  if (block.kind === "utility") return block.effect === "energy" || block.effect === "false-energy" ? "梦能" : "工具";
  if (block.kind === "treasure") return "物件";
  return "碎片";
}

function getCardFaceLayout(block: CardBlock, compact: boolean): CardFaceLayout {
  if (!isRectangular(block)) return "shape";
  if (compact || block.cells.length <= 1) return "single";
  const bounds = blockBounds(block);
  const cols = bounds.maxCol - bounds.minCol + 1;
  const rows = bounds.maxRow - bounds.minRow + 1;
  if (cols === 1 && rows > 1) return "vertical";
  if (rows === 1 && cols > 1) return "horizontal";
  return block.cells.length >= 4 ? "large" : "horizontal";
}

function getCardFaceProfile(block: CardBlock, layout: CardFaceLayout): CardFaceProfile {
  return {
    ...CARD_FACE_LAYOUT_PROFILES[layout],
    ...CARD_KIND_FACE_PROFILES[block.kind],
    ...(CARD_FACE_LAYOUT_KIND_OVERRIDES[layout]?.[block.kind] ?? {}),
  };
}

function titleFitScale(title: string, profile: CardFaceProfile) {
  const units = textFitUnits(title);
  if (units <= profile.titleSafeUnits) return 1;
  return Math.max(profile.titleMinScale, Math.min(1, profile.titleSafeUnits / units));
}

function cardFaceStyle(profile: CardFaceProfile, titleScale: number): CSSProperties {
  return {
    "--face-gap": `${profile.gap}px`,
    "--face-padding": profile.padding,
    "--face-title-gap": `${profile.titleGap}px`,
    "--face-title-size": profile.titleSize,
    "--face-title-scale": titleScale.toFixed(3),
    "--face-title-line": profile.titleLineHeight,
    "--face-title-white-space": profile.titleWhiteSpace,
    "--face-title-max-width": profile.titleMaxWidth,
    "--face-detail-direction": profile.detailDirection,
    "--face-detail-gap": `${profile.detailGap}px`,
    "--face-pill-padding": profile.pillPadding,
    "--face-pill-size": profile.pillSize,
    "--face-pill-line": profile.pillLineHeight,
    "--face-detail-size": profile.detailSize,
    "--face-detail-line": profile.detailLineHeight,
    "--face-detail-white-space": profile.detailWhiteSpace,
  } as CSSProperties;
}

function primaryCardDetail(block: CardBlock, displayValue: number) {
  if (block.kind === "utility" || block.kind === "hazard") {
    return block.subtitle ?? (displayValue > 0 ? `价值 ${displayValue}` : undefined);
  }
  return displayValue > 0 ? `价值 ${displayValue}` : block.subtitle;
}

function secondaryCardDetail(block: CardBlock, displayValue: number) {
  if (block.kind === "utility" && displayValue > 0) return `价值 ${displayValue}`;
  if ((block.kind === "fragment" || block.kind === "treasure") && block.value > 0) return block.subtitle;
  return undefined;
}

function BlockFace({ block, run, visible, compact = false }: { block: CardBlock; run: RunState; visible: boolean; compact?: boolean }) {
  if (!visible) return null;
  const layout = getCardFaceLayout(block, compact);
  const baseProfile = getCardFaceProfile(block, layout);
  const displayTitle = block.locked ? "封锁" : constrainBoardTitle(block.title, block.cells);
  const titleNeedsRoom = textFitUnits(displayTitle) > baseProfile.titleSafeUnits;
  const profile =
    baseProfile.showIcon && titleNeedsRoom
      ? { ...baseProfile, showIcon: false, titleGap: 0, titleMaxWidth: "100%" }
      : baseProfile;
  const faceStyle = cardFaceStyle(profile, titleFitScale(displayTitle, profile));
  const faceClassName = [
    "block-face",
    compact ? "is-compact" : "",
    `layout-${layout}`,
    `kind-${block.kind}`,
    titleNeedsRoom ? "is-title-tight" : "",
  ].join(" ");
  if (block.locked) {
    return (
      <div className={faceClassName} style={faceStyle}>
        <div className="block-face-title">
          {profile.showIcon && <Lock size={profile.iconSize} strokeWidth={1.45} />}
          <strong>{displayTitle}</strong>
        </div>
        <div className="block-face-detail">
          <span className="fragment-pill is-muted">异常</span>
          <small>梦能解除</small>
        </div>
      </div>
    );
  }
  const Icon = ICONS[block.iconKey];
  const hasFragmentProgress = Boolean(block.fragmentIndex && block.fragmentTotal);
  const displayValue = applyValueBoost(block.value, run, block.kind);
  const valueText = primaryCardDetail(block, displayValue);
  const detailText = profile.showSecondary ? secondaryCardDetail(block, displayValue) : undefined;
  return (
    <div className={faceClassName} style={faceStyle}>
      <div className="block-face-title">
        {profile.showIcon && <Icon size={profile.iconSize} strokeWidth={1.45} />}
        <strong>{displayTitle}</strong>
      </div>
      <div className="block-face-detail">
        {hasFragmentProgress ? (
          <span className="fragment-pill">
            <b>{blockKindLabel(block)}</b>
            {block.fragmentIndex}/{block.fragmentTotal}
          </span>
        ) : (
          <span className="fragment-pill is-muted">{blockKindLabel(block)}</span>
        )}
        {valueText && <small>{valueText}</small>}
      </div>
      {detailText && <em>{detailText}</em>}
    </div>
  );
}

function ActionDock({
  run,
  selectedBlock,
  onUseSkill,
  onUseMerchantItem,
}: {
  run: RunState;
  selectedBlock?: CardBlock;
  onUseSkill: (skill: SkillId) => void;
  onUseMerchantItem: (item: ShopItem) => void;
}) {
  const slots = [...run.skills.slice(0, 3), ...Array.from<undefined>({ length: Math.max(0, 3 - run.skills.length) })];
  const merchantItemId = run.inventory.merchantItems?.[0];
  const merchantItem = merchantItemId ? getShopItem(merchantItemId) : undefined;
  const merchantCount = merchantItem
    ? (run.inventory.merchantItems ?? []).filter((itemId) => itemId === merchantItem.id).length
    : 0;
  return (
    <section className="action-dock">
      <div className="dock-group skill-group">
        <div className="dock-title skill-dock-title">
          <span>技能</span>
          <small>{run.buildEnergy > 0 ? `能量 ${run.buildEnergy}` : `护盾 ${run.inventory.shield}`}</small>
        </div>
        <div className="skill-slots">
          {slots.map((skillId, index) =>
            skillId ? (
              <BuildSkillButton
                key={skillId}
                run={run}
                skillId={skillId}
                selectedBlock={selectedBlock}
                onUseSkill={onUseSkill}
              />
            ) : (
              <button className="skill-button is-empty" type="button" disabled key={`empty-${index}`}>
                <Sparkles size={25} strokeWidth={1.5} />
                <strong>空槽</strong>
                <small>通关选择</small>
                <span className="skill-state">待选</span>
              </button>
            ),
          )}
        </div>
      </div>
      <div className="dock-group merchant-group">
        <div className="dock-title merchant-dock-title">
          <span>商店道具</span>
        </div>
        <MerchantItemCard item={merchantItem} count={merchantCount} onUse={onUseMerchantItem} />
      </div>
    </section>
  );
}

function MerchantItemCard({
  item,
  count,
  onUse,
}: {
  item?: ShopItem;
  count: number;
  onUse: (item: ShopItem) => void;
}) {
  if (!item) {
    return (
      <button className="merchant-card is-empty" type="button" disabled>
        <ShoppingCart size={29} strokeWidth={1.35} />
        <strong>空槽</strong>
        <small>梦市购入</small>
      </button>
    );
  }

  const Icon = ICONS[item.iconKey];
  return (
    <button className="merchant-card is-owned" type="button" onClick={() => onUse(item)}>
      <span className="merchant-count">x{count}</span>
      <Icon size={31} strokeWidth={1.45} />
      <strong>{item.name}</strong>
      <small>点击使用</small>
    </button>
  );
}

function BuildSkillButton({
  run,
  skillId,
  selectedBlock,
  onUseSkill,
}: {
  run: RunState;
  skillId: SkillId;
  selectedBlock?: CardBlock;
  onUseSkill: (skill: SkillId) => void;
}) {
  const skill = getSkill(skillId);
  const Icon = ICONS[skill.iconKey];
  const charge = getSkillCharge(run, skillId);
  const ready = charge >= skill.chargeCost;
  const active = skill.trigger === "active";
  const needsSelection = skillId === "fragment-lens" && !selectedBlock;
  const disabled = !active || !ready || needsSelection;
  const text = skillId === "fragment-lens" && selectedBlock ? selectedBlock.title : skill.dockText;
  const chargeSlots = Array.from({ length: skill.chargeCost });
  const stateText = active ? (ready ? "可用" : "充能") : skill.trigger === "auto" ? "自动" : "被动";
  return (
    <button
      className={["skill-button", ready ? "is-ready" : "", active ? "is-active-skill" : "is-passive-skill"].join(" ")}
      type="button"
      disabled={disabled}
      onClick={() => onUseSkill(skillId)}
    >
      <span className="skill-state">{stateText}</span>
      <Icon size={27} strokeWidth={1.5} />
      <strong>{skill.name}</strong>
      <small>{text}</small>
      <div className="charge-meter" aria-label={`充能 ${charge}/${skill.chargeCost}`}>
        {chargeSlots.map((_, index) => (
          <i className={index < charge ? "is-filled" : ""} key={index} />
        ))}
      </div>
    </button>
  );
}

function RouteStrip({ run }: { run: RunState }) {
  const routeScrollerRef = useRef<HTMLDivElement>(null);
  const known = [
    { label: "起点", text: "梦境入口", icon: Sparkles, known: true },
    ...run.history.map((node) => ({
      label: NODE_META[node].label,
      text: NODE_META[node].text,
      icon: NODE_META[node].icon,
      known: true,
    })),
  ];
  const remaining = Math.max(0, 15 - run.layer);
  const visibleCount = Math.min(6, Math.max(known.length + Math.min(remaining, 6), 6));
  const unknownCount = Math.max(0, visibleCount - known.length);
  const currentRouteIndex = Math.max(0, known.length - 1);
  const nodes = [
    ...known.map((node, routeIndex) => ({
      ...node,
      routeIndex,
      current: routeIndex === currentRouteIndex,
    })),
    ...Array.from({ length: unknownCount }, (_, index) => ({
      label: "未揭示",
      text: "待选择",
      icon: Circle,
      known: false,
      routeIndex: known.length + index,
      current: false,
    })),
  ].slice(-6);
  const currentVisibleIndex = nodes.findIndex((node) => node.current);

  function scrollCurrentIntoView(behavior: ScrollBehavior = "smooth") {
    const currentNode = routeScrollerRef.current?.querySelector<HTMLElement>("[data-current-route='true']");
    currentNode?.scrollIntoView({ behavior, block: "nearest", inline: "center" });
  }

  useEffect(() => {
    scrollCurrentIntoView("auto");
  }, [run.history.length, run.layer, currentVisibleIndex]);

  return (
    <section className="route-strip">
      <button
        className="dock-title route-locate-button"
        type="button"
        aria-label="定位到当前路线位置"
        onClick={() => scrollCurrentIntoView()}
      >
        梦境路线
      </button>
      <div className="route-nodes" ref={routeScrollerRef}>
        {nodes.map((node, index) => {
          const Icon = node.icon;
          return (
            <div
              className={["route-node", node.known ? "is-done" : "is-unknown", node.current ? "is-current" : ""].join(" ")}
              aria-current={node.current ? "step" : undefined}
              data-current-route={node.current ? "true" : undefined}
              key={`${node.routeIndex}-${node.label}-${index}`}
            >
              {node.current && <b className="route-current-badge">当前</b>}
              <Icon size={21} strokeWidth={1.5} />
              <span>
                <strong>{node.label}</strong>
                <small>{node.text}</small>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MapChoice({
  run,
  onChoose,
  compact = false,
}: {
  run: RunState;
  onChoose: (node: NodeType) => void;
  compact?: boolean;
}) {
  const choices = getChoices(run.step);
  return (
    <section className={["choice-panel map-choice-panel", compact ? "is-compact" : ""].join(" ")}>
      <div className="panel-heading">
        <span>选择下一段梦境</span>
        <strong>{run.step >= 4 ? "终点" : `第 ${run.step + 1} 层`}</strong>
      </div>
      <div className="choice-grid">
        {choices.map((node) => {
          const meta = NODE_META[node];
          const Icon = meta.icon;
          const cost = node === "shop" || node === "rest" ? 0 : getEntryCost(node, run.step);
          const disabled = node !== "boss" && cost > 0 && run.time < cost;
          return (
            <button type="button" className={`node-choice ${node}`} disabled={disabled} key={node} onClick={() => onChoose(node)}>
              <span className="node-choice-art" aria-hidden="true" />
              <span className="node-choice-info">
                <span className="node-choice-icon">
                  <Icon size={28} strokeWidth={1.5} />
                </span>
                <span className="node-choice-copy">
                  <strong>{meta.label}</strong>
                  <small>{meta.text}</small>
                  <b className="node-choice-cost">{cost > 0 ? `入场 ${formatTime(cost)}` : "无需入场时间"}</b>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LevelSettlement({
  run,
  onChooseReward,
  onRefreshRewards,
}: {
  run: RunState;
  onChooseReward: (skill?: SkillId) => void;
  onRefreshRewards: () => void;
}) {
  const summary = run.lastSummary;
  const skipRefund = buildSkipRefundTime(run);
  return (
    <section className="settlement-panel">
      <div className="panel-heading settlement-heading">
        <span>{summary?.title ?? "记忆回收完成"}</span>
        <strong>总时间 {formatTime(run.time)}</strong>
      </div>
      <div className="settlement-board">
        <MemoryBoard run={run} onBlockClick={() => undefined} />
      </div>
      <div className="skill-picker" role="dialog" aria-modal="true" aria-label="选择技能">
        <div className="skill-picker-head">
          <span>选择一张 Build</span>
          <div className="skill-picker-actions">
            {(run.inventory.buildRefreshes ?? 0) > 0 && (
              <button type="button" onClick={onRefreshRewards}>
                刷新 {run.inventory.buildRefreshes}
              </button>
            )}
            <button type="button" className="skip-reward-button" onClick={() => onChooseReward()}>
              跳过 <b>{formatTimeDelta(skipRefund)}</b>
            </button>
          </div>
        </div>
        <div className="skill-card-row">
          {run.rewardChoices.map((skillId) => {
            const skill = getSkill(skillId);
            return (
              <button className="skill-choice-card" type="button" key={skill.id} onClick={() => onChooseReward(skill.id)}>
                <Sparkles size={30} strokeWidth={1.6} />
                <em>{skill.tag}</em>
                <strong>{skill.name}</strong>
                <span>{skill.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ShopPanel({
  run,
  onBuy,
  onLeave,
}: {
  run: RunState;
  onBuy: (item: ShopItem) => void;
  onLeave: () => void;
}) {
  const purchasedIds = new Set(run.shopPurchasedIds);
  const availableItems = getShopOffers(run).filter((item) => !purchasedIds.has(item.id));
  return (
    <section className="modal-panel">
      <div className="panel-heading">
        <span>梦市商店</span>
        <strong>时间可消费</strong>
      </div>
      <div className="shop-list">
        {availableItems.length ? (
          availableItems.map((item) => {
            const Icon = ICONS[item.iconKey];
            const disabled = !canBuyShopItem(run, item);
            return (
              <button className="shop-row" type="button" disabled={disabled} key={item.id} onClick={() => onBuy(item)}>
                <Icon size={24} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.text}</small>
                </span>
                <b>{formatTime(item.cost)}</b>
              </button>
            );
          })
        ) : (
          <div className="shop-empty">本次梦市已售罄</div>
        )}
      </div>
      <button className="secondary-action" type="button" onClick={onLeave}>
        离开商店
      </button>
    </section>
  );
}

function RestPanel({ run, onRest }: { run: RunState; onRest: (option: "time" | "cleanse" | "focus") => void }) {
  return (
    <section className="modal-panel">
      <div className="panel-heading">
        <span>休息点</span>
        <strong>{formatTime(run.time)}</strong>
      </div>
      <div className="choice-grid rest-grid">
        <button type="button" className="node-choice rest" onClick={() => onRest("time")}>
          <Hourglass size={28} />
          <strong>补时</strong>
          <span>时间 {formatTimeDelta(45)}</span>
        </button>
        <button type="button" className="node-choice rest" onClick={() => onRest("cleanse")}>
          <Shield size={28} />
          <strong>整理</strong>
          <span>护盾与回溯 +1</span>
        </button>
        <button type="button" className="node-choice rest" onClick={() => onRest("focus")}>
          <Eye size={28} />
          <strong>冥想</strong>
          <span>指引与复制 +1</span>
        </button>
      </div>
    </section>
  );
}

function EndPanel({ run, onReset }: { run: RunState; onReset: () => void }) {
  const won = run.phase === "victory";
  return (
    <section className="modal-panel end-panel">
      <div className="panel-heading">
        <span>{won ? "梦境通关" : "梦境坍缩"}</span>
        <strong>{won ? "完成" : "失败"}</strong>
      </div>
      <p>
        {won
          ? `你带着 ${formatTime(run.time)} 的剩余时间离开梦境，${run.dreamSeeds[0] ?? "梦种"} 已归档。`
          : run.notice || "时间归零，生命、货币和路线选择同时中断。"}
      </p>
      <button className="primary-action" type="button" onClick={onReset}>
        重新开始
      </button>
    </section>
  );
}

function StartScreen({ onEnter, onOpenArchive }: { onEnter: (enableAudio: boolean) => void; onOpenArchive: () => void }) {
  return (
    <main className="app-shell start-shell">
      <section className="start-page" aria-labelledby="start-title">
        <div className="start-topline">
          <span>梦境入口</span>
          <button className="start-archive-button" type="button" onClick={onOpenArchive}>
            <BookOpen size={17} strokeWidth={1.45} />
            <span>图鉴</span>
          </button>
        </div>

        <section className="start-story-card" aria-label="梦境背景">
          <div className="start-identity">
            <span>遗失姓名前</span>
            <h1 id="start-title">梦境记忆</h1>
            <p>月相拼图</p>
          </div>

          <p className="start-story-copy">
            醒来以前，你听见旧校门的铃声。姓名散成月相、票根、磁带和练习本，
            藏进一格格发光的梦里。进入更深的记忆，找回足够的价值，把自己带回清晨。
          </p>

          <div className="start-floor-panel" aria-label="初始梦境状态">
            <span>
              <small>总梦时</small>
              <strong>{formatTime(STARTING_TIME)}</strong>
            </span>
            <span>
              <small>第一段</small>
              <strong>旧校门</strong>
            </span>
            <span>
              <small>Build</small>
              <strong>空槽</strong>
            </span>
          </div>
        </section>

        <section className="audio-gate" role="dialog" aria-modal="true" aria-labelledby="audio-gate-title">
          <div className="audio-gate-head">
            <span>
              <Volume2 size={24} strokeWidth={1.45} />
            </span>
            <div>
              <h2 id="audio-gate-title">准备入梦</h2>
              <p>月光会替你保管剩下的时间。</p>
            </div>
          </div>
          <div className="audio-gate-actions">
            <button className="primary-action" type="button" onClick={() => onEnter(true)}>
              <Play size={18} strokeWidth={1.7} />
              <span>开启音效并入梦</span>
            </button>
            <button className="secondary-action" type="button" onClick={() => onEnter(false)}>
              <VolumeX size={18} strokeWidth={1.7} />
              <span>静音入梦</span>
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

export function App() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [enteredDream, setEnteredDream] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioState, setAudioState] = useState<AudioPlaybackState>("idle");
  const [startArchiveOpen, setStartArchiveOpen] = useState(false);
  const [startArchiveRun, setStartArchiveRun] = useState<RunState>(loadRun);

  function pauseAmbientAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setAudioState("idle");
  }

  function playAmbientAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.34;
    audio.loop = true;
    const playback = audio.play();
    if (!playback) {
      setAudioState("playing");
      return;
    }
    playback
      .then(() => setAudioState("playing"))
      .catch(() => setAudioState("blocked"));
  }

  function enterDream(enableAudio: boolean) {
    setEnteredDream(true);
    setAudioEnabled(enableAudio);
    if (enableAudio) {
      playAmbientAudio();
    } else {
      pauseAmbientAudio();
    }
  }

  function toggleAmbientAudio() {
    if (audioEnabled && audioState === "playing") {
      setAudioEnabled(false);
      pauseAmbientAudio();
      return;
    }
    setAudioEnabled(true);
    playAmbientAudio();
  }

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  return (
    <>
      <audio ref={audioRef} src={DREAM_AUDIO_SRC} loop preload="auto" onError={() => setAudioState("blocked")} />
      {enteredDream ? (
        <AppContent audioEnabled={audioEnabled} audioState={audioState} onToggleAudio={toggleAmbientAudio} />
      ) : (
        <>
          <StartScreen
            onEnter={enterDream}
            onOpenArchive={() => {
              setStartArchiveRun(loadRun());
              setStartArchiveOpen(true);
            }}
          />
          {startArchiveOpen && <ArchivePanel run={startArchiveRun} onClose={() => setStartArchiveOpen(false)} />}
        </>
      )}
    </>
  );
}
