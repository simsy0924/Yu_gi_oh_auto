"use client";

import {
  Activity,
  BadgeCheck,
  BookOpen,
  Bot,
  ChevronRight,
  CircleAlert,
  Cloud,
  CloudOff,
  Check,
  DatabaseBackup,
  Download,
  ExternalLink,
  FlaskConical,
  GitBranch,
  Hand,
  Layers3,
  LoaderCircle,
  LogIn,
  LogOut,
  Menu,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  SkipBack,
  SkipForward,
  Swords,
  Tag,
  Trash2,
  Trophy,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadFirebaseStore,
  observeGoogleAccount,
  restorePreviousFirebaseStore,
  saveFirebaseStore,
  signInWithGoogle,
  signOutFromGoogle,
} from "../src/firebase";
import {
  countWorstCaseTriggerOperations,
  evaluateHandTrapRoute,
} from "../src/handtrap-engine.js";

type Tab =
  | "handtraps"
  | "decks"
  | "catalog"
  | "cards"
  | "combos"
  | "results"
  | "trash";
type HandTrapMode = "EFFECT_NEGATE" | "ACTIVATION_NEGATE" | "MONSTER_NEGATE";
type ActivationTiming =
  | "RESPONSE_EFFECT"
  | "RESPONSE_SUMMON"
  | "AFTER_RESOLUTION"
  | "OPEN_STATE"
  | "CUSTOM";
type ActivationCondition =
  | "OPPONENT_EFFECT"
  | "MONSTER_EFFECT"
  | "SPECIAL_SUMMON"
  | "CARD_ADDED_FROM_DECK"
  | "OWN_FIELD_EMPTY"
  | "NO_CARDS_CONTROLLED"
  | "FIVE_SUMMONS"
  | "CUSTOM";
type DisruptionType =
  | "NEGATE_EFFECT"
  | "NEGATE_ACTIVATION"
  | "DESTROY"
  | "RETURN_HAND"
  | "RETURN_DECK"
  | "BANISH"
  | "SEND_GRAVE"
  | "DRAW_ON_SUMMON"
  | "PREVENT_ADD_FROM_DECK"
  | "PREVENT_SPECIAL_SUMMON"
  | "PREVENT_BANISH"
  | "REPLACE_SEND_GY_WITH_BANISH"
  | "CUSTOM";
type DisruptionTarget =
  | "RESPONDED_EFFECT"
  | "RESPONDED_CARD"
  | "SELECTED_CARD"
  | "OPPONENT_PLAYER"
  | "ALL_VALID_CARDS"
  | "CUSTOM";
type EffectDuration =
  | "IMMEDIATE"
  | "CHAIN_END"
  | "TURN_END"
  | "NEXT_TURN_END"
  | "WHILE_FACE_UP"
  | "CUSTOM";
type ResolutionLink = "THEN" | "ALSO" | "AND_IF_YOU_DO" | "AND" | "CUSTOM";
type SelectionTiming = "NONE" | "TARGET_AT_ACTIVATION" | "CHOOSE_AT_RESOLUTION";
type OperationApplication = "ON_TRIGGER" | "AFTER_TRIGGER" | "EACH_MATCH";
type MonsterType =
  | "NORMAL"
  | "EFFECT"
  | "RITUAL"
  | "FUSION"
  | "SYNCHRO"
  | "XYZ"
  | "LINK"
  | "PENDULUM"
  | "TOKEN";
type EffectUsageLimit =
  | "NONE"
  | "ONCE_PER_CHAIN"
  | "ONCE_PER_TURN"
  | "HARD_ONCE_PER_TURN"
  | "ONCE_PER_DUEL";
type CardEffectType = "ACTIVATED" | "CONTINUOUS";
type EffectSourceZone =
  | "HAND"
  | "MONSTER_ZONE"
  | "SPELL_TRAP_ZONE"
  | "FIELD_ZONE"
  | "GRAVEYARD"
  | "BANISHED"
  | "EXTRA_DECK"
  | "CUSTOM";
type TurnOwner = "SELF" | "OPPONENT";
type PlayerSide = "SELF" | "OPPONENT";
type DuelPhase = "DRAW" | "STANDBY" | "MAIN1" | "BATTLE" | "MAIN2" | "END";
type EffectActivationTag =
  | "IGNITION"
  | "QUICK"
  | "TRIGGER"
  | "ON_NORMAL_SUMMON"
  | "ON_SPECIAL_SUMMON"
  | "ON_FLIP"
  | "ON_ATTACK"
  | "ON_DAMAGE"
  | "ON_SENT_GY"
  | "ON_BANISHED"
  | "ON_DETACH_XYZ"
  | "ON_CARD_EFFECT"
  | "ON_MONSTER_EFFECT"
  | "ON_SUMMON_ATTEMPT"
  | "CUSTOM";
type EffectApplicationTag =
  | "WHILE_FACE_UP"
  | "WHILE_IN_GY"
  | "WHILE_BANISHED"
  | "WHILE_XYZ_MATERIAL"
  | "TARGET_REQUIRED"
  | "NON_TARGETING"
  | "SELF"
  | "OPPONENT"
  | "MONSTER"
  | "SPELL_TRAP"
  | "EXTRA_DECK_MONSTER"
  | "CUSTOM";
type EffectOperationTag =
  | "SEARCH"
  | "DRAW"
  | "SEND_DECK_TO_GY"
  | "SPECIAL_SUMMON"
  | "NORMAL_SUMMON"
  | "DESTROY"
  | "BANISH"
  | "SEND_GY"
  | "RETURN_HAND"
  | "RETURN_DECK"
  | "NEGATE_EFFECT"
  | "NEGATE_ACTIVATION"
  | "CHANGE_ATK_DEF"
  | "CHANGE_LEVEL_RANK"
  | "CHANGE_TYPE_ATTRIBUTE"
  | "ATTACH_XYZ"
  | "DETACH_XYZ"
  | "GRANT_EFFECT"
  | "TAKE_CONTROL"
  | "SUMMON_LOCK"
  | "EFFECT_LOCK"
  | "CUSTOM";
type GrantMode = "GENERIC" | "WHILE_XYZ_MATERIAL";
type ComboActionType = "EFFECT" | "SUMMON" | "CHAIN_RESOLVE";
type EffectExecutionMode = "IMMEDIATE" | "CHAIN_REGISTER";
type HandTrapResponseStrategy =
  | "AUTO"
  | "BLOCK_WITH_PERMISSION"
  | "AVOID_TRIGGER"
  | "BYPASS_ROUTE"
  | "ACCEPT_WITH_LIMIT";
type SummonType =
  | "NORMAL"
  | "RULE_SPECIAL"
  | "RITUAL"
  | "FUSION"
  | "SYNCHRO"
  | "XYZ"
  | "PENDULUM"
  | "LINK"
  | "TOKEN"
  | "OTHER";

type GrantedEffectProfile = {
  label: string;
  text: string;
  effectType: CardEffectType;
  sourceZone: EffectSourceZone;
  usageLimit: EffectUsageLimit;
  allowedTurns: TurnOwner[];
  allowedPhases: DuelPhase[];
  timingDetails: string;
  activationTags: EffectActivationTag[];
  applicationTags: EffectApplicationTag[];
  operationTags: EffectOperationTag[];
  interruptibleBy: string[];
  blocksHandTraps: string[];
};

type DisruptionOperation = {
  id: string;
  type: DisruptionType;
  target: DisruptionTarget;
  duration: EffectDuration;
  link: ResolutionLink;
  selection: SelectionTiming;
  details: string;
  amount: number;
  application: OperationApplication;
  conditionText: string;
};

type HandTrap = {
  id: string;
  name: string;
  mode?: HandTrapMode;
  description: string;
  builtIn?: boolean;
  activation: {
    sourceZone: "HAND" | "FIELD" | "GRAVEYARD" | "BANISHED" | "CUSTOM";
    timing: ActivationTiming;
    conditions: ActivationCondition[];
    conditionLogic: "ALL" | "ANY";
    customCondition: string;
    costText: string;
    usageLimit:
      | "NONE"
      | "ONCE_PER_TURN"
      | "HARD_ONCE_PER_TURN"
      | "ONCE_PER_DUEL";
  };
  disruptions: DisruptionOperation[];
};

type CardEffect = {
  id: string;
  label: string;
  text: string;
  costText: string;
  interactionNotes: string[];
  interruptibleBy: string[];
  blocksHandTraps: string[];
  usageLimit: EffectUsageLimit;
  turnRestriction: string;
  effectType: CardEffectType;
  sourceZone: EffectSourceZone;
  allowedTurns: TurnOwner[];
  allowedPhases: DuelPhase[];
  timingDetails: string;
  canBeGranted: boolean;
  grantDetails: string;
  activationTags: EffectActivationTag[];
  applicationTags: EffectApplicationTag[];
  operationTags: EffectOperationTag[];
  grantMode: GrantMode;
  grantedProfile: GrantedEffectProfile | null;
};

type Card = {
  id: string;
  name: string;
  kind: "MONSTER" | "SPELL" | "TRAP";
  monsterType: MonsterType | null;
  levelRankLink: number | null;
  attack: CardStat;
  defense: CardStat;
  ruleText: string;
  effects: CardEffect[];
};

type CardStat = number | "?" | null;

type CatalogCard = {
  i: number;
  p: number | null;
  n: string;
  t: string;
  e: string;
  c: "Monster" | "Spell" | "Trap";
  r: string | null;
  y: string | null;
  a: string | null;
  v: number | null;
  k: number | "?" | null;
  d: number | "?" | null;
  m: string;
  g: string[];
  u: boolean;
};

type CatalogPayload = {
  updatedAt: string;
  source: string;
  cards: CatalogCard[];
};

type ComboStep = {
  id: string;
  effectId: string;
  stopsWhenNegated: boolean;
  costEvents: ZoneEvent[];
  permissionEvents: PermissionEvent[];
  zoneEvents: ZoneEvent[];
  actingCardId: string;
  effectGrantEvents: EffectGrantEvent[];
  turnOwner: TurnOwner;
  phase: DuelPhase;
  actionType: ComboActionType;
  effectExecutionMode: EffectExecutionMode;
  chainId: string;
  chainLabel: string;
  summonedCardId: string;
  summonType: SummonType;
  summonFrom: CardLocation;
  summonCount: number;
  summonZone: MonsterZoneSlot;
  summonInterruptibleBy: string[];
  materials: SummonMaterial[];
  opponentLpChange: number;
  declaresSpecialWin: boolean;
  specialWinText: string;
};

type ZoneEvent = {
  id: string;
  cardId: string;
  zone: CardLocation;
  monsterZone?: MonsterZoneSlot;
  xyzHostZone?: MonsterZoneSlot;
  owner: PlayerSide;
  action: "SUMMON" | "LEAVE";
  timing: "BEFORE" | "AFTER";
  quantity: number;
  destination?: CardLocation;
};
type SummonMaterial = {
  id: string;
  cardId: string;
  from: CardLocation;
  destination: CardLocation;
  xyzHostZone?: MonsterZoneSlot;
  quantity: number;
};
type EffectGrantEvent = {
  id: string;
  effectId: string;
  targetCardId: string;
  action: "GRANT" | "REVOKE";
};

type PermissionEvent = {
  id: string;
  permissionEffectId: string;
  action: "ENABLE" | "CONSUME" | "DISABLE";
  uses: number;
};

type Combo = {
  id: string;
  name: string;
  deckId: string;
  startingHand: CardQuantity[];
  goals: ComboGoal[];
  goalField?: GoalFieldEntry[];
  opponentStartingLp: number;
  opponentStartingHandSize: number;
  steps: ComboStep[];
  branches: ComboBranch[];
  handTrapPlans: HandTrapResponsePlan[];
};
type CardQuantity = { id: string; cardId: string; quantity: number };
type FieldZone =
  | "MONSTER_ZONE"
  | "SPELL_TRAP_ZONE"
  | "FIELD_ZONE"
  | "PENDULUM_ZONE";
type GoalFieldEntry = CardQuantity & { zone: FieldZone };
type CardLocation =
  | FieldZone
  | "HAND"
  | "GRAVEYARD"
  | "BANISHED"
  | "XYZ_MATERIAL"
  | "DECK"
  | "EXTRA_DECK";
type MonsterZoneSlot =
  | "MAIN_1"
  | "MAIN_2"
  | "MAIN_3"
  | "MAIN_4"
  | "MAIN_5"
  | "EXTRA_LEFT"
  | "EXTRA_RIGHT";
type ComboGoal =
  | {
      id: string;
      kind: "CARD_LOCATION";
      cardId: string;
      location: CardLocation;
      quantity: number;
      owner: PlayerSide;
    }
  | { id: string; kind: "OPPONENT_LP"; maximum: number }
  | {
      id: string;
      kind: "LOCATION_COUNT_MAX";
      owner: PlayerSide;
      location: CardLocation;
      maximum: number;
    }
  | { id: string; kind: "SPECIAL_WIN"; label: string };
type ComboBranch = {
  id: string;
  name: string;
  triggerHandTrapId: string;
  atStepId: string;
  alternateComboId: string;
};

type HandTrapResponsePlan = {
  id: string;
  handTrapId: string;
  strategy: HandTrapResponseStrategy;
  maxOpponentDraws: number;
  maxAffectedSteps: number;
  maxResolvedOperations: number;
  notes: string;
};

type TestPoint = {
  handTrapId: string;
  handTrapName: string;
  stepIndex: number;
  stepId?: string;
  cardName: string;
  effectLabel: string;
  stopped: boolean;
  triggered?: boolean;
  directInterruption?: boolean;
  resolvedOperations?: number;
  goalReached?: boolean;
  missingGoal?: string[];
  disruptionSummary?: string;
  blockedByPermission?: string;
  bypassBranchName?: string;
};

type HandTrapCheckSummary = {
  handTrapId: string;
  handTrapName: string;
  role: string;
  strategy: HandTrapResponseStrategy;
  planned: boolean;
  passed: boolean;
  triggerCount: number;
  affectedSteps: number;
  opponentDraws: number;
  endPhaseReturns: number;
  blockedSteps: number;
  redirectedSteps: number;
  resolvedOperations: number;
  blockedCount: number;
  bypassedCount: number;
  reason: string;
  notes: string;
};

type TestRun = {
  id: string;
  comboId: string;
  comboName: string;
  createdAt: string;
  points: TestPoint[];
  summaries?: HandTrapCheckSummary[];
  baselineGoalReached?: boolean;
  baselineMissingGoal?: string[];
};

type Store = {
  schemaVersion?: number;
  handTraps: HandTrap[];
  decks: Deck[];
  cards: Card[];
  combos: Combo[];
  runs: TestRun[];
  trash: TrashItem[];
};
type AccountUser = {
  uid: string;
  email: string;
  displayName: string;
};
type CloudSyncState =
  | "CHECKING"
  | "LOCAL"
  | "LOADING"
  | "SYNCING"
  | "SYNCED"
  | "DIRTY"
  | "CONFLICT"
  | "ERROR";
type CloudSyncController = {
  user: AccountUser | null;
  state: CloudSyncState;
  error: string;
  updatedAt: string | null;
  hasDeviceBackup: boolean;
  hasServerBackup: boolean;
  signIn: () => void;
  signOut: () => void;
  syncNow: () => Promise<void>;
  restoreDeviceBackup: () => void;
  restoreServerBackup: () => Promise<void>;
  useCloudCopy: () => void;
  keepDeviceCopy: () => void;
};
type DeckEntry = {
  id: string;
  cardId: string;
  quantity: number;
  section: "MAIN" | "EXTRA";
};
type Deck = {
  id: string;
  name: string;
  description: string;
  entries: DeckEntry[];
};
type TrashItem = {
  id: string;
  kind: "CARD" | "HANDTRAP" | "COMBO" | "DECK";
  name: string;
  deletedAt: string;
  data: Card | HandTrap | Combo | Deck;
};

const ASH_ID = "builtin-ash-blossom";
const UNKNOWN_OPPONENT_CARD_ID = "__opponent_unknown_card__";
const CATALOG_CARD_COUNT = 13_982;
const CATALOG_PAGE_SIZE = 48;
const CATALOG_REVIEW_BATCH_SIZE = 100;
const CATALOG_BASE_URL = `${import.meta.env.BASE_URL}data/ygo-ko-cards`;
const CATALOG_MANIFEST_URL = `${CATALOG_BASE_URL}/manifest.json`;

type CatalogManifest = Pick<CatalogPayload, "updatedAt" | "source"> & {
  cardCount: number;
  parts: string[];
};

type CatalogHandTrapEffectInteraction = {
  interruptibleBy: string[];
  blocksHandTraps: string[];
  interactionNotes: string[];
  confidence: number;
  needsReview: boolean;
  note: string;
};

type CatalogHandTrapCardInteraction = {
  interruptibleBy: string[];
  blocksHandTraps: string[];
  effects: Record<string, CatalogHandTrapEffectInteraction>;
};

type CatalogHandTrapInteractions = {
  schemaVersion: number;
  cardCount: number;
  effectCount: number;
  needsReview: number;
  cards: Record<string, CatalogHandTrapCardInteraction>;
};

type CatalogReviewStatus = "VERIFIED" | "DRAFT" | "HOLD" | "NO_EFFECT";
type CatalogReviewEntry = {
  status: CatalogReviewStatus;
  note: string;
};

type CatalogEffectAudit = {
  costText: string;
  timingDetails: string;
  operationTags: EffectOperationTag[];
  activationTags: EffectActivationTag[];
  applicationTags: EffectApplicationTag[];
  sourceZone: EffectSourceZone;
  allowedTurns: TurnOwner[];
  allowedPhases: DuelPhase[];
  interruptibleBy: string[];
  interactionNotes: string[];
};

const FIRST_REVIEW_BATCH_IDS = new Set([
  19196, 7315, 12653, 6994, 7128, 21385, 12824, 15287, 18843, 15288,
  15289, 4138, 4365, 4455, 6053, 4806, 5324, 5617, 5421, 11416,
  9939, 10028, 10263, 21413, 9877, 22701, 10414, 10197, 10181, 9618,
  22700, 11415, 9855, 9922, 11110, 9856, 10538, 22313, 11414, 10223,
  10367, 10564, 10790, 11023, 12097, 21463, 21454, 14920, 22314, 5759,
  4011, 5307, 4787, 4482, 6697, 6526, 7755, 7535, 6667, 10853,
  8160, 14175, 15997, 5708, 11155, 5709, 6330, 5422, 15331, 5707,
  8536, 5899, 5706, 7795, 12362, 5710, 16845, 5711, 13431, 13533,
  10654, 5737, 11754, 21760, 9675, 4722, 4703, 4489, 10641, 6118,
  4226, 5097, 5094, 5103, 4188, 5093, 6886, 6200, 11517, 10378,
]);

const FIRST_REVIEW_BATCH_NO_EFFECT_IDS = new Set([
  4138, 4365, 4455, 5759, 4011, 4787, 4482, 7535, 21760, 4722,
  4489, 5094, 4188, 5093,
]);

const FIRST_REVIEW_BATCH_HOLDS = new Map<number, string>([
  [7315, "번호가 없는 복수의 지속·유발 처리를 수동 분리해야 합니다."],
  [6053, "번호가 없는 드로우·파괴·회복 효과를 각각 분리해야 합니다."],
  [5617, "두 선택지의 코스트와 무효 범위를 선택지별로 분리해야 합니다."],
  [9877, "엑시즈 소환된 몬스터에게 부여되는 효과를 별도 프로필로 옮겨야 합니다."],
  [12097, "룰 일반 소환, 묘지 소생, 부여 효과가 한 카드에 함께 있습니다."],
  [21463, "지속 내성·레벨 변경·파괴 효과의 적용 범위를 추가 확인해야 합니다."],
  [14920, "소생 후 무효 처리와 엑시즈 소재 부여 효과가 중첩됩니다."],
  [22314, "카운터 함정의 무효 후 선택 처리와 묘지 효과를 따로 검토해야 합니다."],
  [5709, "구형 텍스트의 소환 조건과 전투 후 효과 무효를 분리해야 합니다."],
  [15331, "전투 수치 복사와 묘지 서치까지 포함한 3개 효과의 세부 타이밍 확인이 필요합니다."],
  [5707, "구형 텍스트의 장착 카드 코스트와 묘지 제외 처리를 분리해야 합니다."],
  [8536, "룰 특수 소환과 장착 카드 코스트를 사용하는 복수 처리가 번호 없이 이어집니다."],
  [16845, "융합 소재 조건과 드로우·파괴 수량의 상관관계를 별도 모델링해야 합니다."],
  [13431, "파괴 대신 카운터를 제거하는 대체 효과를 별도 처리로 지원해야 합니다."],
  [13533, "펜듈럼 효과와 몬스터 효과의 중복 번호를 양쪽 영역별로 검토해야 합니다."],
  [10654, "번호 없는 공격력 상승과 파괴 후 회수 효과를 분리해야 합니다."],
  [11754, "지속 함정과 소생 몬스터가 서로 이탈할 때의 연동 처리를 확인해야 합니다."],
  [10641, "소환 제한과 일반 소환 성공 시 소생 효과의 적용 순서를 검토해야 합니다."],
  [5097, "룰 특수 소환과 묘지에서 발동하는 컨트롤 획득 효과를 분리해야 합니다."],
  [10378, "체인을 만들지 않는 패 특수 소환과 엑시즈 소재 제한을 룰 텍스트로 옮겨야 합니다."],
]);

const DETAILED_CATALOG_REVIEWS = new Map<number, CatalogReviewEntry>([
  [
    19196,
    {
      status: "VERIFIED",
      note:
        "공식 카드 DB의 보충 정보와 관련 Q&A까지 기준으로 효과별 코스트·처리·직접 체인·조건부 간섭을 다시 대조했습니다.",
    },
  ],
]);

const DETAILED_CATALOG_EFFECT_AUDITS = new Map<string, CatalogEffectAudit>([
  [
    "19196-main-1",
    {
      costText: "없음",
      timingDetails:
        "속공 마법의 카드 발동 효과. 데미지 스텝에는 발동할 수 없습니다. 덱 또는 묘지에서 패로 넣는 처리를 모두 포함합니다.",
      operationTags: ["SEARCH"],
      activationTags: ["CUSTOM"],
      applicationTags: ["SELF"],
      sourceZone: "SPELL_TRAP_ZONE",
      allowedTurns: ["SELF", "OPPONENT"],
      allowedPhases: ["DRAW", "STANDBY", "MAIN1", "BATTLE", "MAIN2", "END"],
      interruptibleBy: [
        ASH_ID,
        "builtin-ghost-belle",
        "builtin-dominus-purge",
      ],
      interactionNotes: [
        "D.D. 크로우 / 비스테드 마그나무트·드루이드브룸·발드레이크·살로니르 · 묘지의 회수 후보(D.D. 크로우는 카드, 비스테드는 빛/어둠 몬스터)를 체인으로 제외할 수 있으나, 덱이나 묘지에 다른 적법한 후보가 남으면 ①은 처리 가능",
        "드롤 & 로크 버드 · 드로우 페이즈 이외에 실제로 덱의 카드를 패에 넣었을 때만 처리 후 발동 가능. 묘지에서 회수했다면 발동할 수 없음",
      ],
    },
  ],
  [
    "19196-main-2",
    {
      costText: "묘지의 이 카드를 제외한다.",
      timingDetails:
        "자신 메인 페이즈에 묘지에서 발동. 덱이 1장 이상 있어야 하며, 자신의 묘지 / 제외 상태인 다른 ‘죄보’ 마법·함정 1장을 대상으로 지정합니다. 덱 맨 아래로 되돌린 뒤 드로우하며 두 처리는 동시가 아닙니다.",
      operationTags: ["RETURN_DECK", "DRAW"],
      activationTags: ["IGNITION"],
      applicationTags: ["SELF", "TARGET_REQUIRED", "WHILE_IN_GY"],
      sourceZone: "GRAVEYARD",
      allowedTurns: ["SELF"],
      allowedPhases: ["MAIN1", "MAIN2"],
      interruptibleBy: [
        ASH_ID,
        "builtin-skull-meister",
        "builtin-dominus-purge",
      ],
      interactionNotes: [
        "저택 와라시 · 발동할 때 묘지의 카드를 대상으로 골랐을 때만 직접 체인 가능. 제외 상태의 카드만 대상으로 골랐다면 체인할 수 없음",
        "D.D. 크로우 · 묘지의 ‘죄보’ 카드를 대상으로 골랐을 때 그 대상을 체인으로 제외하면, 덱 맨 아래로 되돌리지 못해 뒤의 드로우도 처리되지 않음",
        "아티팩트－롱기누스 · 미리 적용되어 있으면 묘지의 이 카드를 제외하는 코스트를 낼 수 없어 ②를 발동할 수 없음",
        "디멘션 어트랙터 · 미리 적용되어 이 카드가 묘지로 보내지는 대신 제외되면 ②의 발동 준비 자체를 막을 수 있음. 이미 묘지에 존재하는 이 카드에는 소급 적용되지 않음",
        "드롤 & 로크 버드 · 1장 드로우까지 정상 처리된 뒤 발동하여, 그 턴의 이후 덱→패 이동을 막을 수 있음(현재 효과는 막지 않음)",
      ],
    },
  ],
]);

function catalogReviewFor(cardId: number): CatalogReviewEntry | null {
  if (!FIRST_REVIEW_BATCH_IDS.has(cardId)) return null;
  const detailedReview = DETAILED_CATALOG_REVIEWS.get(cardId);
  if (detailedReview) return detailedReview;
  if (FIRST_REVIEW_BATCH_NO_EFFECT_IDS.has(cardId)) {
    return {
      status: "NO_EFFECT",
      note: "효과가 없는 일반·의식 몬스터로 확인했습니다. 카드 텍스트는 룰·설명란에 보존됩니다.",
    };
  }
  const holdNote = FIRST_REVIEW_BATCH_HOLDS.get(cardId);
  if (holdNote) return { status: "HOLD", note: holdNote };
  return {
    status: "DRAFT",
    note: "번호 분리와 키워드 태그만 적용한 1차 초안입니다. 효과별 패트랩 조건을 정밀 재검수해야 합니다.",
  };
}

type SeedEffectOptions = Partial<CardEffect> & { ash?: boolean };

function seedEffect(
  id: string,
  label: string,
  text: string,
  operationTags: EffectOperationTag[] = [],
  options: SeedEffectOptions = {},
): CardEffect {
  const { ash, ...effectOptions } = options;
  return normalizeCardEffect({
    id: `seed-effect-${id}`,
    label,
    text,
    operationTags,
    interruptibleBy: ash ? [ASH_ID] : [],
    allowedTurns: ["SELF"],
    allowedPhases: ["MAIN1", "MAIN2"],
    ...effectOptions,
  });
}

function seedMonster(
  id: string,
  name: string,
  monsterType: MonsterType,
  levelRankLink: number,
  attack: CardStat,
  defense: CardStat,
  ruleText: string,
  effects: CardEffect[],
): Card {
  return {
    id: `seed-card-${id}`,
    name,
    kind: "MONSTER",
    monsterType,
    levelRankLink,
    attack,
    defense,
    ruleText,
    effects,
  };
}

function seedSpell(
  id: string,
  name: string,
  sourceZone: EffectSourceZone,
  effects: CardEffect[],
): Card {
  return {
    id: `seed-card-${id}`,
    name,
    kind: "SPELL",
    monsterType: null,
    levelRankLink: null,
    attack: null,
    defense: null,
    ruleText: "",
    effects: effects.map((effect) => ({ ...effect, sourceZone })),
  };
}

const SELF_OR_OPPONENT: TurnOwner[] = ["SELF", "OPPONENT"];
const ALL_PHASES: DuelPhase[] = [
  "DRAW",
  "STANDBY",
  "MAIN1",
  "BATTLE",
  "MAIN2",
  "END",
];

const SEEDED_CARDS: Card[] = [
  seedMonster(
    "speedroid-terrortop",
    "SR 베이고맥스",
    "EFFECT",
    3,
    1200,
    600,
    "",
    [
      seedEffect(
        "terrortop-1",
        "① 자체 특수 소환",
        "자신 필드에 몬스터가 존재하지 않을 경우, 이 카드는 패에서 특수 소환할 수 있다.",
        ["SPECIAL_SUMMON"],
        {
          effectType: "CONTINUOUS",
          sourceZone: "HAND",
          timingDetails: "발동하지 않는 특수 소환 방법",
        },
      ),
      seedEffect(
        "terrortop-2",
        "② 스피드로이드 서치",
        "이 카드가 일반 소환 / 특수 소환에 성공했을 때에 발동할 수 있다. 덱에서 ‘SR 베이고맥스’ 이외의 ‘스피드로이드’ 몬스터 1장을 패에 넣는다.",
        ["SEARCH"],
        {
          ash: true,
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["TRIGGER", "ON_NORMAL_SUMMON", "ON_SPECIAL_SUMMON"],
        },
      ),
    ],
  ),
  seedMonster(
    "speedroid-taketomborg",
    "SR 타케톰보그",
    "EFFECT",
    3,
    600,
    1200,
    "‘SR 타케톰보그’는 1턴에 1번밖에 특수 소환할 수 없다.",
    [
      seedEffect(
        "taketomborg-1",
        "① 자체 특수 소환",
        "자신 필드에 바람 속성 몬스터가 존재할 경우, 이 카드는 패에서 특수 소환할 수 있다.",
        ["SPECIAL_SUMMON"],
        {
          effectType: "CONTINUOUS",
          sourceZone: "HAND",
          timingDetails: "발동하지 않는 특수 소환 방법",
        },
      ),
      seedEffect(
        "taketomborg-2",
        "② 튜너 특수 소환",
        "이 카드를 릴리스하고 발동할 수 있다. 덱에서 ‘스피드로이드’ 튜너 1장을 특수 소환한다. 발동 후 턴 종료시까지 자신은 바람 속성 몬스터밖에 특수 소환할 수 없다.",
        ["SPECIAL_SUMMON", "SUMMON_LOCK"],
        {
          ash: true,
          activationTags: ["IGNITION"],
          turnRestriction: "발동 후 턴 종료시까지 바람 속성 몬스터만 특수 소환",
        },
      ),
    ],
  ),
  seedMonster("ash-blossom", "하루 우라라", "EFFECT", 3, 0, 1800, "튜너", [
    seedEffect(
      "ash-1",
      "① 덱 접근 효과 무효",
      "덱에서 카드를 패에 넣는 효과, 덱에서 몬스터를 특수 소환하는 효과, 또는 덱에서 카드를 묘지로 보내는 효과가 발동했을 때, 이 카드를 패에서 버리고 발동할 수 있다. 그 효과를 무효로 한다.",
      ["NEGATE_EFFECT"],
      {
        sourceZone: "HAND",
        usageLimit: "HARD_ONCE_PER_TURN",
        allowedTurns: SELF_OR_OPPONENT,
        allowedPhases: ALL_PHASES,
        activationTags: ["QUICK", "ON_CARD_EFFECT"],
        applicationTags: ["OPPONENT"],
      },
    ),
  ]),
  seedMonster(
    "materiactor-zeptowing",
    "머티리어크톨 젭토윙",
    "EFFECT",
    3,
    0,
    0,
    "",
    [
      seedEffect(
        "zeptowing-1",
        "① 자체 특수 소환",
        "자신 필드에 ‘머티리어크톨’ 카드가 존재할 경우에 발동할 수 있다. 이 카드를 패에서 특수 소환한다.",
        ["SPECIAL_SUMMON"],
        {
          sourceZone: "HAND",
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["IGNITION"],
        },
      ),
      seedEffect(
        "zeptowing-2",
        "② 머티리어크톨 서치와 일반 몬스터 회수",
        "이 카드를 일반 소환 / 특수 소환 / 리버스했을 경우에 발동할 수 있다. 덱에서 ‘머티리어크톨 젭토윙’ 이외의 ‘머티리어크톨’ 카드 1장을 패에 넣는다. 그 후, 자신 묘지에서 레벨 3 일반 몬스터 1장을 패에 넣거나 특수 소환할 수 있다.",
        ["SEARCH", "RETURN_HAND", "SPECIAL_SUMMON"],
        {
          ash: true,
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: [
            "TRIGGER",
            "ON_NORMAL_SUMMON",
            "ON_SPECIAL_SUMMON",
            "ON_FLIP",
          ],
        },
      ),
    ],
  ),
  seedMonster(
    "megala",
    "현람한 메가라",
    "EFFECT",
    3,
    500,
    1500,
    "①의 방법에 의한 특수 소환은 1턴에 1번밖에 할 수 없다.",
    [
      seedEffect(
        "megala-1",
        "① 자체 특수 소환",
        "자신 묘지에 ‘싸이크론’이 존재할 경우, 또는 상대 필드에 마법 / 함정 카드가 존재하지 않을 경우, 이 카드는 패에서 특수 소환할 수 있다.",
        ["SPECIAL_SUMMON"],
        {
          effectType: "CONTINUOUS",
          sourceZone: "HAND",
          timingDetails: "발동하지 않는 특수 소환 방법",
        },
      ),
      seedEffect(
        "megala-2",
        "② 현람 몬스터 특수 소환",
        "‘현람’ 속공 마법 카드나 ‘싸이크론’이 발동했을 경우에 발동할 수 있다. 같은 이름의 몬스터가 자신 필드에 존재하지 않는 ‘현람’ 몬스터 1장을 덱에서 특수 소환한다. 발동 후 턴 종료시까지 자신은 바람 속성 몬스터밖에 특수 소환할 수 없다.",
        ["SPECIAL_SUMMON", "SUMMON_LOCK"],
        {
          ash: true,
          usageLimit: "HARD_ONCE_PER_TURN",
          allowedTurns: SELF_OR_OPPONENT,
          allowedPhases: ALL_PHASES,
          activationTags: ["TRIGGER", "ON_CARD_EFFECT"],
        },
      ),
    ],
  ),
  seedMonster(
    "eldam",
    "현람한 엘담",
    "EFFECT",
    3,
    1300,
    800,
    "①의 방법에 의한 특수 소환은 1턴에 1번밖에 할 수 없다.",
    [
      seedEffect(
        "eldam-1",
        "① 자체 특수 소환",
        "자신 묘지에 ‘싸이크론’이 존재할 경우, 또는 상대 필드에 마법 / 함정 카드가 존재하지 않을 경우, 이 카드는 패에서 특수 소환할 수 있다.",
        ["SPECIAL_SUMMON"],
        {
          effectType: "CONTINUOUS",
          sourceZone: "HAND",
          timingDetails: "발동하지 않는 특수 소환 방법",
        },
      ),
      seedEffect(
        "eldam-2",
        "② 현람 몬스터 서치",
        "이 카드를 일반 소환 / 특수 소환했을 경우에 발동할 수 있다. 덱에서 ‘현람한 엘담’ 이외의 ‘현람’ 몬스터나 ‘싸이크론’ 1장을 패에 넣는다.",
        ["SEARCH"],
        {
          ash: true,
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["TRIGGER", "ON_NORMAL_SUMMON", "ON_SPECIAL_SUMMON"],
        },
      ),
    ],
  ),
  seedMonster(
    "suen",
    "현람한 스엔",
    "EFFECT",
    3,
    1600,
    400,
    "①의 방법에 의한 특수 소환은 1턴에 1번밖에 할 수 없다.",
    [
      seedEffect(
        "suen-1",
        "① 자체 특수 소환",
        "자신 묘지에 ‘싸이크론’이 존재할 경우, 또는 상대 필드에 마법 / 함정 카드가 존재하지 않을 경우, 이 카드는 패에서 특수 소환할 수 있다.",
        ["SPECIAL_SUMMON"],
        {
          effectType: "CONTINUOUS",
          sourceZone: "HAND",
          timingDetails: "발동하지 않는 특수 소환 방법",
        },
      ),
      seedEffect(
        "suen-2",
        "② 현람 마법·함정 서치",
        "이 카드를 일반 소환 / 특수 소환했을 경우에 발동할 수 있다. 덱에서 ‘현람’ 마법 / 함정 카드나 ‘싸이크론’ 1장을 패에 넣는다.",
        ["SEARCH"],
        {
          ash: true,
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["TRIGGER", "ON_NORMAL_SUMMON", "ON_SPECIAL_SUMMON"],
        },
      ),
    ],
  ),
  seedMonster("zoodiac-ratpier", "십이수 모르모래트", "EFFECT", 4, 0, 0, "", [
    seedEffect(
      "ratpier-1",
      "① 십이수 덤핑",
      "이 카드가 일반 소환에 성공했을 경우에 발동할 수 있다. 덱에서 ‘십이수’ 카드 1장을 묘지로 보낸다.",
      ["SEND_DECK_TO_GY"],
      { ash: true, activationTags: ["TRIGGER", "ON_NORMAL_SUMMON"] },
    ),
    seedEffect(
      "ratpier-2",
      "② 엑시즈 소재 부여 효과",
      "이 카드를 소재로서 가지고 있는, 원래 종족이 야수전사족인 엑시즈 몬스터는 효과를 얻는다.",
      ["GRANT_EFFECT"],
      {
        effectType: "CONTINUOUS",
        canBeGranted: true,
        grantMode: "WHILE_XYZ_MATERIAL",
        grantDetails: "원래 종족이 야수전사족인 엑시즈 몬스터",
        grantedProfile: {
          label: "모르모래트 특수 소환",
          text: "1턴에 1번, 엑시즈 소재를 1개 제거하고 발동할 수 있다. 패 / 덱에서 ‘십이수 모르모래트’ 1장을 특수 소환한다.",
          effectType: "ACTIVATED",
          sourceZone: "MONSTER_ZONE",
          usageLimit: "ONCE_PER_TURN",
          allowedTurns: ["SELF"],
          allowedPhases: ["MAIN1", "MAIN2"],
          timingDetails: "",
          activationTags: ["IGNITION"],
          applicationTags: ["WHILE_XYZ_MATERIAL"],
          operationTags: ["DETACH_XYZ", "SPECIAL_SUMMON"],
          interruptibleBy: [ASH_ID],
          blocksHandTraps: [],
        },
      },
    ),
  ]),
  seedMonster("zoodiac-whiptail", "십이수 바이퍼", "EFFECT", 4, 1200, 400, "", [
    seedEffect(
      "whiptail-1",
      "① 엑시즈 소재화",
      "자신 필드의 야수전사족 엑시즈 몬스터 1장을 대상으로 하고 발동할 수 있다. 자신의 패 / 필드의 이 카드를 그 몬스터의 아래에 겹쳐 엑시즈 소재로 한다. 이 효과는 상대 턴에도 발동할 수 있다.",
      ["ATTACH_XYZ"],
      {
        sourceZone: "HAND",
        allowedTurns: SELF_OR_OPPONENT,
        allowedPhases: ALL_PHASES,
        activationTags: ["QUICK"],
        applicationTags: ["TARGET_REQUIRED"],
      },
    ),
    seedEffect(
      "whiptail-2",
      "② 엑시즈 소재 부여 효과",
      "이 카드를 소재로서 가지고 있는, 원래 종족이 야수전사족인 엑시즈 몬스터는 효과를 얻는다.",
      ["GRANT_EFFECT"],
      {
        effectType: "CONTINUOUS",
        canBeGranted: true,
        grantMode: "WHILE_XYZ_MATERIAL",
        grantedProfile: {
          label: "전투한 상대 몬스터 제외",
          text: "이 카드가 상대 몬스터와 전투를 실행한 데미지 계산 후에 발동한다. 그 상대 몬스터를 제외한다.",
          effectType: "ACTIVATED",
          sourceZone: "MONSTER_ZONE",
          usageLimit: "NONE",
          allowedTurns: SELF_OR_OPPONENT,
          allowedPhases: ["BATTLE"],
          timingDetails: "데미지 계산 후 강제 발동",
          activationTags: ["TRIGGER", "ON_DAMAGE"],
          applicationTags: ["WHILE_XYZ_MATERIAL", "MONSTER"],
          operationTags: ["BANISH"],
          interruptibleBy: [],
          blocksHandTraps: [],
        },
      },
    ),
  ]),
  seedMonster("zoodiac-ramram", "십이수 램", "EFFECT", 4, 400, 2000, "", [
    seedEffect(
      "ramram-1",
      "① 파괴 시 소생",
      "이 카드가 전투 / 효과로 파괴되었을 경우, ‘십이수 램’ 이외의 자신 묘지의 ‘십이수’ 몬스터 1장을 대상으로 하고 발동할 수 있다. 그 몬스터를 특수 소환한다.",
      ["SPECIAL_SUMMON"],
      {
        allowedTurns: SELF_OR_OPPONENT,
        allowedPhases: ALL_PHASES,
        activationTags: ["TRIGGER", "CUSTOM"],
        applicationTags: ["TARGET_REQUIRED"],
      },
    ),
    seedEffect(
      "ramram-2",
      "② 엑시즈 소재 부여 효과",
      "이 카드를 소재로서 가지고 있는, 원래 종족이 야수전사족인 엑시즈 몬스터는 효과를 얻는다.",
      ["GRANT_EFFECT"],
      {
        effectType: "CONTINUOUS",
        canBeGranted: true,
        grantMode: "WHILE_XYZ_MATERIAL",
        grantedProfile: {
          label: "대상 지정 함정 발동 무효",
          text: "이 카드를 대상으로 하는 상대 함정 카드의 효과가 발동했을 때, 엑시즈 소재를 1개 제거하고 발동할 수 있다. 그 발동을 무효로 한다.",
          effectType: "ACTIVATED",
          sourceZone: "MONSTER_ZONE",
          usageLimit: "NONE",
          allowedTurns: SELF_OR_OPPONENT,
          allowedPhases: ALL_PHASES,
          timingDetails: "대상 지정 함정 효과에 체인",
          activationTags: ["QUICK", "ON_CARD_EFFECT"],
          applicationTags: ["WHILE_XYZ_MATERIAL", "TARGET_REQUIRED"],
          operationTags: ["DETACH_XYZ", "NEGATE_ACTIVATION"],
          interruptibleBy: [],
          blocksHandTraps: [],
        },
      },
    ),
  ]),
  seedMonster(
    "millennium-shield",
    "천년왕조의 방패",
    "EFFECT",
    5,
    0,
    3000,
    "",
    [
      seedEffect(
        "millennium-shield-1",
        "① 지속 마법으로 놓기",
        "이 카드가 패에 존재할 경우에 발동할 수 있다. 이 카드를 지속 마법 카드로 취급하고 자신의 마법 & 함정 존에 앞면 표시로 놓는다.",
        ["CUSTOM"],
        {
          sourceZone: "HAND",
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["IGNITION"],
        },
      ),
      seedEffect(
        "millennium-shield-2",
        "② 특수 소환과 천년의 십자 서치",
        "지속 마법 카드로 취급할 경우, 2000 LP를 지불하거나 패의 ‘천년의 십자’ 1장을 상대에게 보여주고 발동할 수 있다. 이 카드를 특수 소환한다. 그 후, 덱에서 ‘천년의 십자’ 1장을 패에 넣을 수 있다.",
        ["SPECIAL_SUMMON", "SEARCH"],
        {
          ash: true,
          sourceZone: "SPELL_TRAP_ZONE",
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["IGNITION"],
        },
      ),
      seedEffect(
        "millennium-shield-3",
        "③ 마법·함정 효과 파괴 내성",
        "이 카드가 몬스터 존에 존재하는 한, 이 카드는 마법 / 함정 카드의 효과로는 파괴되지 않는다.",
        [],
        {
          effectType: "CONTINUOUS",
          applicationTags: ["WHILE_FACE_UP", "SELF"],
        },
      ),
    ],
  ),
  seedMonster(
    "millennium-golem",
    "천년의 보물을 지키는 골렘",
    "EFFECT",
    6,
    2000,
    2200,
    "",
    [
      seedEffect(
        "millennium-golem-1",
        "① 지속 마법으로 놓기",
        "이 카드가 패에 존재할 경우에 발동할 수 있다. 이 카드를 지속 마법 카드로 취급하고 자신의 마법 & 함정 존에 앞면 표시로 놓는다.",
        ["CUSTOM"],
        {
          sourceZone: "HAND",
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["IGNITION"],
        },
      ),
      seedEffect(
        "millennium-golem-2",
        "② 특수 소환과 웨주의 신전 서치",
        "지속 마법 카드로 취급할 경우, 2000 LP를 지불하거나 패의 ‘천년의 십자’ 1장을 상대에게 보여주고 발동할 수 있다. 이 카드를 특수 소환한다. 그 후, 덱에서 ‘웨주의 신전’ 1장을 패에 넣을 수 있다.",
        ["SPECIAL_SUMMON", "SEARCH"],
        {
          ash: true,
          sourceZone: "SPELL_TRAP_ZONE",
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["IGNITION"],
        },
      ),
      seedEffect(
        "millennium-golem-3",
        "③ 천년의 십자 발동 보호",
        "이 카드가 몬스터 존에 존재하는 한, 자신의 ‘천년의 십자’의 발동은 무효화되지 않는다.",
        ["CUSTOM"],
        {
          effectType: "CONTINUOUS",
          applicationTags: ["WHILE_FACE_UP", "SELF"],
        },
      ),
    ],
  ),
  seedMonster(
    "millennium-primitive",
    "천년의 잠에서 깨어난 원시인",
    "EFFECT",
    8,
    2750,
    2500,
    "",
    [
      seedEffect(
        "primitive-1",
        "① 지속 마법으로 놓기",
        "이 카드가 패에 존재할 경우에 발동할 수 있다. 이 카드를 지속 마법 카드로 취급하고 자신의 마법 & 함정 존에 앞면 표시로 놓는다.",
        ["CUSTOM"],
        {
          sourceZone: "HAND",
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["IGNITION"],
        },
      ),
      seedEffect(
        "primitive-2",
        "② 특수 소환과 몬스터 서치",
        "지속 마법 카드로 취급할 경우, 2000 LP를 지불하거나 패의 ‘천년의 십자’ 1장을 상대에게 보여주고 발동할 수 있다. 이 카드를 특수 소환한다. 그 후, 덱에서 ‘천년’ 몬스터나 ‘밀레니엄’ 몬스터 1장을 패에 넣을 수 있다.",
        ["SPECIAL_SUMMON", "SEARCH"],
        {
          ash: true,
          sourceZone: "SPELL_TRAP_ZONE",
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["IGNITION"],
        },
      ),
      seedEffect(
        "primitive-3",
        "③ 몬스터 효과 파괴 내성",
        "이 카드가 몬스터 존에 존재하는 한, 이 카드는 몬스터의 효과로는 파괴되지 않는다.",
        [],
        {
          effectType: "CONTINUOUS",
          applicationTags: ["WHILE_FACE_UP", "SELF"],
        },
      ),
    ],
  ),
  seedSpell("card-advance", "카드 어드밴스", "SPELL_TRAP_ZONE", [
    seedEffect(
      "card-advance-1",
      "① 덱 위 확인과 추가 어드밴스 소환",
      "자신의 덱 위에서 카드를 5장까지 확인하고, 좋아하는 순서대로 덱 위로 되돌린다. 이 턴에 자신은 통상 소환 외에도 1번만 몬스터 1장을 어드밴스 소환할 수 있다.",
      ["NORMAL_SUMMON"],
      { activationTags: ["IGNITION"] },
    ),
  ]),
  seedSpell("slash-draw", "일격필살! 슬래시 드로우", "SPELL_TRAP_ZONE", [
    seedEffect(
      "slash-draw-1",
      "① 슬래시 드로우",
      "패를 1장 버리고 발동할 수 있다. 상대 필드의 카드 수만큼 자신의 덱 위에서 카드를 묘지로 보낸 후 1장 드로우하고 서로 확인한다. 그것이 ‘일격필살! 슬래시 드로우’면 그 카드를 묘지로 보내고 필드의 카드를 전부 파괴한 후, 파괴되어 묘지로 보내진 카드 수 × 2000 데미지를 준다. 다르면 이 효과로 덱에서 묘지로 보낸 카드 수만큼 자신 묘지의 카드를 덱으로 되돌린다.",
      ["SEND_DECK_TO_GY", "DRAW", "DESTROY", "RETURN_DECK"],
      {
        ash: true,
        usageLimit: "HARD_ONCE_PER_TURN",
        activationTags: ["IGNITION"],
      },
    ),
  ]),
  seedSpell("vaylantz-wakening", "VV~시작의 땅~", "SPELL_TRAP_ZONE", [
    seedEffect(
      "vaylantz-wakening-1",
      "① 필드 마법 서치",
      "덱에서 ‘밸리언츠’ 필드 마법 카드 1장을 패에 넣는다. 그 후, 자신 필드의 펜듈럼 몬스터 카드 1장을 골라 파괴하고, 덱에서 ‘포지션 체인지’ 1장을 패에 넣는 효과를 적용할 수 있다.",
      ["SEARCH", "DESTROY"],
      {
        ash: true,
        usageLimit: "HARD_ONCE_PER_TURN",
        activationTags: ["IGNITION"],
      },
    ),
    seedEffect(
      "vaylantz-wakening-2",
      "② 펜듈럼 존에 놓기",
      "묘지의 이 카드를 제외하고 발동할 수 있다. 자신의 엑스트라 덱에서 앞면 표시의 ‘밸리언츠’ 펜듈럼 몬스터 1장을 고르고 자신의 펜듈럼 존에 놓는다. 이 효과는 이 카드가 묘지로 보내진 턴에는 발동할 수 없다.",
      ["BANISH", "CUSTOM"],
      {
        sourceZone: "GRAVEYARD",
        usageLimit: "HARD_ONCE_PER_TURN",
        activationTags: ["IGNITION"],
        turnRestriction: "묘지로 보내진 턴에는 발동 불가",
      },
    ),
  ]),
  seedSpell("talents-thrust", "삼전의 호", "SPELL_TRAP_ZONE", [
    seedEffect(
      "talents-thrust-1",
      "① 일반 마법·함정 세트 또는 서치",
      "이 턴에 상대가 몬스터의 효과를 발동하고 있을 경우에 발동할 수 있다. 덱에서 ‘삼전의 호’ 이외의 일반 마법 / 일반 함정 카드 1장을 자신 필드에 세트한다. 그 카드는 이 턴에 발동할 수 없다. 상대 필드에 몬스터가 존재할 경우, 세트하지 않고 패에 넣을 수도 있다.",
      ["SEARCH", "CUSTOM"],
      {
        ash: true,
        usageLimit: "HARD_ONCE_PER_TURN",
        activationTags: ["IGNITION", "CUSTOM"],
      },
    ),
  ]),
  seedSpell("shinra-bansho", "VV－진라만상", "FIELD_ZONE", [
    seedEffect(
      "shinra-1",
      "① 상대 필드 존에 필드 마법 놓기",
      "이 카드의 발동시의 효과 처리로서, 덱에서 ‘VV－진라만상’ 이외의 ‘밸리언츠’ 필드 마법 카드 1장을 상대의 필드 존에 앞면 표시로 놓는다.",
      ["CUSTOM"],
      { activationTags: ["IGNITION"] },
    ),
    seedEffect(
      "shinra-2",
      "② 마법·함정 존 몬스터 특수 소환",
      "필드 존에 카드가 2장 있을 경우, 턴 플레이어는 자신의 마법 & 함정 존의 몬스터 카드 1장을 대상으로 하고 발동할 수 있다. 그 카드를 그 정면의 자신 메인 몬스터 존에 특수 소환한다.",
      ["SPECIAL_SUMMON"],
      {
        usageLimit: "HARD_ONCE_PER_TURN",
        allowedTurns: SELF_OR_OPPONENT,
        activationTags: ["IGNITION"],
        applicationTags: ["TARGET_REQUIRED"],
      },
    ),
  ]),
  seedSpell("konig-wissen", "VV－쾨니히 비센", "FIELD_ZONE", [
    seedEffect(
      "konig-1",
      "① 상대 필드 존에 필드 마법 놓기",
      "이 카드의 발동시의 효과 처리로서, 덱에서 ‘VV－쾨니히 비센’ 이외의 ‘밸리언츠’ 필드 마법 카드 1장을 상대의 필드 존에 앞면 표시로 놓는다.",
      ["CUSTOM"],
      { activationTags: ["IGNITION"] },
    ),
    seedEffect(
      "konig-2",
      "② 상대 몬스터를 지속 마법으로 놓기",
      "필드 존에 카드가 2장 있을 경우, 턴 플레이어는 자신 몬스터 정면의 상대 메인 몬스터 존의 효과 몬스터 1장을 대상으로 하고 발동할 수 있다. 그 몬스터를 같은 세로열인 상대의 마법 & 함정 존에 지속 마법 카드로 취급하고 앞면 표시로 놓는다. 놓을 곳의 카드는 파괴된다.",
      ["CUSTOM", "DESTROY"],
      {
        usageLimit: "HARD_ONCE_PER_TURN",
        allowedTurns: SELF_OR_OPPONENT,
        activationTags: ["IGNITION"],
        applicationTags: ["TARGET_REQUIRED", "MONSTER"],
      },
    ),
  ]),
  seedSpell("wedju-temple", "웨주의 신전", "FIELD_ZONE", [
    seedEffect(
      "wedju-1",
      "① 몬스터 2장을 지속 마법으로 놓기",
      "자신 메인 페이즈에 발동할 수 있다. 패에서 몬스터 1장을 지속 마법 카드로 취급하고 자신의 마법 & 함정 존에 앞면 표시로 놓는다. 그 후, ‘천년’ 몬스터나 ‘밀레니엄’ 몬스터 1장을 덱에서 같은 방법으로 놓는다.",
      ["CUSTOM"],
      { usageLimit: "HARD_ONCE_PER_TURN", activationTags: ["IGNITION"] },
    ),
    seedEffect(
      "wedju-2",
      "② 파괴된 몬스터를 지속 마법으로 보존",
      "자신 필드의 앞면 표시 ‘천년’ 몬스터나 ‘밀레니엄’ 몬스터가 전투 / 효과로 파괴되었을 경우, 묘지로 보내지 않으며 지속 마법 카드로 취급하고 자신의 마법 & 함정 존에 앞면 표시로 놓을 수 있다.",
      ["CUSTOM"],
      {
        effectType: "CONTINUOUS",
        allowedTurns: SELF_OR_OPPONENT,
        allowedPhases: ALL_PHASES,
        applicationTags: ["WHILE_FACE_UP"],
      },
    ),
  ]),
  seedSpell("materiactor-meltthrough", "머티리어크톨 멜트스루", "FIELD_ZONE", [
    seedEffect(
      "meltthrough-1",
      "① 덱 위 순서 변경",
      "이 카드의 발동시의 효과 처리로서, 자신의 덱 위에서 카드를 6장 넘기고 좋아하는 순서대로 덱 위로 되돌린다.",
      [],
      { activationTags: ["IGNITION"] },
    ),
    seedEffect(
      "meltthrough-2",
      "② 일반 몬스터 위에 엑시즈 특수 소환",
      "1턴에 1번, 1500 LP를 지불하고 발동할 수 있다. 자신의 엑스트라 덱에서 ‘머티리어크톨’ 엑시즈 몬스터 1장을 자신 필드의 레벨 3 일반 몬스터 위에 겹쳐 특수 소환한다. 이 특수 소환은 엑시즈 소환으로 취급한다. 발동 후 턴 종료시까지 자신은 엑시즈 몬스터밖에 엑스트라 덱에서 특수 소환할 수 없다.",
      ["SPECIAL_SUMMON", "ATTACH_XYZ", "SUMMON_LOCK"],
      {
        usageLimit: "ONCE_PER_TURN",
        activationTags: ["IGNITION"],
        turnRestriction:
          "발동 후 턴 종료시까지 엑스트라 덱에서는 엑시즈 몬스터만 특수 소환",
      },
    ),
    seedEffect(
      "meltthrough-3",
      "③ 엑시즈 소재 보충",
      "자신 필드의 엑시즈 몬스터가 엑시즈 소환되었을 경우, 자신의 덱 위의 카드 1장을 자신 필드의 ‘머티리어크톨’ 엑시즈 몬스터의 아래에 겹쳐 엑시즈 소재로 할 수 있다.",
      ["ATTACH_XYZ"],
      {
        allowedTurns: SELF_OR_OPPONENT,
        allowedPhases: ALL_PHASES,
        activationTags: ["TRIGGER", "CUSTOM"],
      },
    ),
  ]),
  seedSpell(
    "materiactor-meltdown",
    "머티리어크톨 멜트다운",
    "SPELL_TRAP_ZONE",
    [
      seedEffect(
        "meltdown-1",
        "① 덱 위 확인과 머티리어크톨 서치",
        "자신 메인 페이즈에 발동할 수 있다. 자신의 덱 위에서 카드를 6장 넘기고, 그 중에서 ‘머티리어크톨’ 카드 1장을 패에 넣을 수 있다. 나머지는 좋아하는 순서대로 덱 위로 되돌린다. 그 후, 자신 필드의 랭크 3 엑시즈 몬스터의 소재 1장을 패로 되돌릴 수 있다.",
        ["SEARCH", "RETURN_HAND"],
        {
          ash: true,
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["IGNITION"],
        },
      ),
      seedEffect(
        "meltdown-2",
        "② 머티리어크톨 엑시즈 소재 보충",
        "자신의 엑시즈 몬스터가 효과를 발동했을 경우에 발동할 수 있다. 자신의 덱 맨 위의 카드를 자신 필드의 ‘머티리어크톨’ 엑시즈 몬스터 1장의 엑시즈 소재로 한다.",
        ["ATTACH_XYZ"],
        {
          allowedTurns: SELF_OR_OPPONENT,
          allowedPhases: ALL_PHASES,
          activationTags: ["TRIGGER", "ON_CARD_EFFECT"],
        },
      ),
    ],
  ),
  seedSpell("mst", "싸이크론", "SPELL_TRAP_ZONE", [
    seedEffect(
      "mst-1",
      "① 마법·함정 파괴",
      "필드의 마법 / 함정 카드 1장을 대상으로 하고 발동할 수 있다. 그 카드를 파괴한다.",
      ["DESTROY"],
      {
        allowedTurns: SELF_OR_OPPONENT,
        allowedPhases: ALL_PHASES,
        activationTags: ["QUICK"],
        applicationTags: ["TARGET_REQUIRED", "SPELL_TRAP"],
      },
    ),
  ]),
  seedSpell("hyun-shadow", "현람한 헌영", "SPELL_TRAP_ZONE", [
    seedEffect(
      "hyun-shadow-1a",
      "①-a 현람 몬스터 서치",
      "이하의 효과에서 1개를 선택하고 발동할 수 있다(이 카드명의 이하의 효과는 각각 1턴에 1번밖에 선택할 수 없다). 덱에서 레벨 4 이하의 ‘현람’ 몬스터 1장을 패에 넣는다.",
      ["SEARCH"],
      {
        ash: true,
        usageLimit: "HARD_ONCE_PER_TURN",
        allowedTurns: SELF_OR_OPPONENT,
        allowedPhases: ALL_PHASES,
        activationTags: ["QUICK"],
      },
    ),
    seedEffect(
      "hyun-shadow-1b",
      "①-b 싸이크론 서치·회수",
      "이하의 효과에서 1개를 선택하고 발동할 수 있다(이 카드명의 이하의 효과는 각각 1턴에 1번밖에 선택할 수 없다). 자신의 덱 / 묘지에서 ‘싸이크론’ 1장을 패에 넣는다.",
      ["SEARCH", "RETURN_HAND"],
      {
        ash: true,
        usageLimit: "HARD_ONCE_PER_TURN",
        allowedTurns: SELF_OR_OPPONENT,
        allowedPhases: ALL_PHASES,
        activationTags: ["QUICK"],
      },
    ),
    seedEffect(
      "hyun-shadow-2",
      "② 파괴 시 다시 세트",
      "이 카드가 ‘싸이크론’의 효과로 파괴되었을 경우에 발동할 수 있다. 이 카드를 자신 필드에 세트한다.",
      ["CUSTOM"],
      {
        sourceZone: "GRAVEYARD",
        allowedTurns: SELF_OR_OPPONENT,
        allowedPhases: ALL_PHASES,
        activationTags: ["TRIGGER", "CUSTOM"],
      },
    ),
  ]),
  seedSpell("fire-formation-tenki", "염무－「천기」", "SPELL_TRAP_ZONE", [
    seedEffect(
      "tenki-1",
      "① 야수전사족 서치",
      "이 카드의 발동시의 효과 처리로서, 덱에서 레벨 4 이하의 야수전사족 몬스터 1장을 패에 넣을 수 있다.",
      ["SEARCH"],
      {
        ash: true,
        usageLimit: "HARD_ONCE_PER_TURN",
        activationTags: ["IGNITION"],
      },
    ),
    seedEffect(
      "tenki-2",
      "② 야수전사족 공격력 상승",
      "이 카드가 마법 & 함정 존에 존재하는 한, 자신 필드의 야수전사족 몬스터의 공격력은 100 올린다.",
      ["CHANGE_ATK_DEF"],
      {
        effectType: "CONTINUOUS",
        applicationTags: ["WHILE_FACE_UP", "MONSTER"],
      },
    ),
  ]),
  seedMonster(
    "mx-saber-invoker",
    "M.X－세이버 인보커",
    "XYZ",
    3,
    1600,
    500,
    "레벨 3 몬스터 × 2",
    [
      seedEffect(
        "invoker-1",
        "① 땅 속성 전사족·야수전사족 특수 소환",
        "1턴에 1번, 엑시즈 소재를 1개 제거하고 발동할 수 있다. 전사족이나 야수전사족의 땅 속성 / 레벨 4 몬스터 1장을 덱에서 수비 표시로 특수 소환한다. 그 몬스터는 엔드 페이즈에 파괴된다.",
        ["DETACH_XYZ", "SPECIAL_SUMMON", "DESTROY"],
        {
          ash: true,
          usageLimit: "ONCE_PER_TURN",
          activationTags: ["IGNITION"],
        },
      ),
    ],
  ),
  seedMonster(
    "materiactor-exagard",
    "머티리어크톨 엑사가르드",
    "XYZ",
    3,
    2000,
    2000,
    "레벨 3 몬스터 × 2장 이상",
    [
      seedEffect(
        "exagard-1",
        "① 머티리어크톨 특수 소환 또는 마법·함정 서치",
        "엑시즈 소재를 1개 제거하고 발동할 수 있다. 덱에서 ‘머티리어크톨’ 몬스터 1장을 특수 소환하거나, ‘머티리어크톨’ 마법 / 함정 카드 1장을 패에 넣는다.",
        ["DETACH_XYZ", "SPECIAL_SUMMON", "SEARCH"],
        {
          ash: true,
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["IGNITION"],
        },
      ),
      seedEffect(
        "exagard-2",
        "② 소재 회수와 필드 카드 바운스",
        "상대가 몬스터를 일반 소환 / 특수 소환했을 경우에 발동할 수 있다. ‘머티리어크톨’ 카드를 포함하는 이 카드의 엑시즈 소재를 2장까지 패로 되돌린다. 자신 묘지에 일반 몬스터가 존재할 경우, 추가로 필드의 카드 1장을 패로 되돌릴 수 있다.",
        ["RETURN_HAND"],
        {
          usageLimit: "HARD_ONCE_PER_TURN",
          allowedTurns: ["OPPONENT"],
          allowedPhases: ALL_PHASES,
          activationTags: ["TRIGGER", "ON_NORMAL_SUMMON", "ON_SPECIAL_SUMMON"],
        },
      ),
    ],
  ),
  ...[
    [
      "zoodiac-broadbull",
      "십이수 불혼",
      "레벨 4 몬스터 × 2",
      "1턴에 1번, 엑시즈 소재를 1개 제거하고 발동할 수 있다. 덱에서 통상 소환 가능한 야수전사족 몬스터 1장을 패에 넣는다.",
      ["DETACH_XYZ", "SEARCH"] as EffectOperationTag[],
      true,
    ],
    [
      "zoodiac-tigermortar",
      "십이수 타이그리스",
      "레벨 4 몬스터 × 3",
      "1턴에 1번, 엑시즈 소재를 1개 제거하고, 자신 필드의 엑시즈 몬스터 1장과 자신 묘지의 ‘십이수’ 몬스터 1장을 대상으로 하여 발동할 수 있다. 그 ‘십이수’ 몬스터를 그 엑시즈 몬스터의 아래에 겹쳐 엑시즈 소재로 한다.",
      ["DETACH_XYZ", "ATTACH_XYZ"] as EffectOperationTag[],
      false,
    ],
    [
      "zoodiac-drident",
      "십이수 드란시아",
      "레벨 4 몬스터 × 4",
      "자신 / 상대 턴에 1번, 엑시즈 소재를 1개 제거하고, 필드의 앞면 표시 카드 1장을 대상으로 하여 발동할 수 있다. 그 카드를 파괴한다.",
      ["DETACH_XYZ", "DESTROY"] as EffectOperationTag[],
      false,
    ],
    [
      "zoodiac-chakanine",
      "십이수 라이카",
      "레벨 4 몬스터 × 2장 이상",
      "1턴에 1번, 엑시즈 소재를 1개 제거하고, 자신 묘지의 ‘십이수’ 몬스터 1장을 대상으로 하여 발동할 수 있다. 그 몬스터를 특수 소환한다. 그 몬스터는 이 턴에 효과가 무효화되고 엑시즈 소환의 소재로 할 수 없다.",
      ["DETACH_XYZ", "SPECIAL_SUMMON", "NEGATE_EFFECT"] as EffectOperationTag[],
      false,
    ],
  ].map(([id, name, materials, text, operations, ash]) =>
    seedMonster(
      id as string,
      name as string,
      "XYZ",
      4,
      "?",
      "?",
      `${materials}. 이 카드는 1턴에 1번, 같은 이름의 카드 이외의 자신 필드의 ‘십이수’ 몬스터 위에 겹쳐 엑시즈 소환할 수도 있다.`,
      [
        seedEffect(
          `${id}-1`,
          "① 소재만큼 공격력·수비력 상승",
          "이 카드의 공격력 / 수비력은, 이 카드가 엑시즈 소재로 하고 있는 ‘십이수’ 몬스터 각각의 수치만큼 올린다.",
          ["CHANGE_ATK_DEF"],
          { effectType: "CONTINUOUS", applicationTags: ["WHILE_FACE_UP"] },
        ),
        seedEffect(
          `${id}-2`,
          "② 고유 효과",
          text as string,
          operations as EffectOperationTag[],
          {
            ash: ash as boolean,
            usageLimit: "ONCE_PER_TURN",
            allowedTurns:
              name === "십이수 드란시아" ? SELF_OR_OPPONENT : ["SELF"],
            allowedPhases:
              name === "십이수 드란시아" ? ALL_PHASES : ["MAIN1", "MAIN2"],
            activationTags:
              name === "십이수 드란시아" ? ["QUICK"] : ["IGNITION"],
            applicationTags:
              name === "십이수 타이그리스" ||
              name === "십이수 드란시아" ||
              name === "십이수 라이카"
                ? ["TARGET_REQUIRED"]
                : [],
          },
        ),
      ],
    ),
  ),
  seedMonster(
    "zoodiac-boarbow",
    "십이수 와일드보우",
    "XYZ",
    4,
    "?",
    "?",
    "레벨 4 몬스터 × 5. 이 카드는 1턴에 1번, 같은 이름의 카드 이외의 자신 필드의 ‘십이수’ 몬스터 위에 겹쳐 엑시즈 소환할 수도 있다.",
    [
      seedEffect(
        "boarbow-1",
        "① 소재만큼 공격력·수비력 상승",
        "이 카드의 공격력 / 수비력은, 이 카드가 엑시즈 소재로 하고 있는 ‘십이수’ 몬스터 각각의 수치만큼 올린다.",
        ["CHANGE_ATK_DEF"],
        { effectType: "CONTINUOUS" },
      ),
      seedEffect(
        "boarbow-2",
        "② 직접 공격",
        "이 카드는 상대에게 직접 공격할 수 있다.",
        [],
        { effectType: "CONTINUOUS" },
      ),
      seedEffect(
        "boarbow-3",
        "③ 상대 패·필드 전부 묘지",
        "가지고 있는 엑시즈 소재의 수가 12 이상인 이 카드가 상대에게 전투 데미지를 주었을 때에 발동할 수 있다. 상대의 패 / 필드의 카드를 전부 묘지로 보내고, 그 후, 이 카드는 수비 표시가 된다.",
        ["SEND_GY", "CUSTOM"],
        { allowedPhases: ["BATTLE"], activationTags: ["TRIGGER", "ON_DAMAGE"] },
      ),
    ],
  ),
  seedMonster(
    "zoodiac-hammerkong",
    "십이수 해머콩",
    "XYZ",
    4,
    "?",
    "?",
    "레벨 4 몬스터 × 3장 이상. 이 카드는 1턴에 1번, 같은 이름의 카드 이외의 자신 필드의 ‘십이수’ 몬스터 위에 겹쳐 엑시즈 소환할 수도 있다.",
    [
      seedEffect(
        "hammerkong-1",
        "① 소재만큼 공격력·수비력 상승",
        "이 카드의 공격력 / 수비력은, 이 카드가 엑시즈 소재로 하고 있는 ‘십이수’ 몬스터 각각의 수치만큼 올린다.",
        ["CHANGE_ATK_DEF"],
        { effectType: "CONTINUOUS" },
      ),
      seedEffect(
        "hammerkong-2",
        "② 다른 십이수 대상 내성",
        "엑시즈 소재를 가진 이 카드가 몬스터 존에 존재하는 한, 상대는 이 카드 이외의 필드의 ‘십이수’ 몬스터를 효과의 대상으로 할 수 없다.",
        [],
        {
          effectType: "CONTINUOUS",
          applicationTags: ["WHILE_FACE_UP", "MONSTER"],
        },
      ),
      seedEffect(
        "hammerkong-3",
        "③ 엔드 페이즈 소재 제거",
        "자신 / 상대의 엔드 페이즈에 발동한다. 이 카드의 엑시즈 소재를 1개 제거한다.",
        ["DETACH_XYZ"],
        {
          allowedTurns: SELF_OR_OPPONENT,
          allowedPhases: ["END"],
          activationTags: ["TRIGGER"],
        },
      ),
    ],
  ),
  seedMonster(
    "mathmech-alembertian",
    "괴참기 달랑베르시안",
    "XYZ",
    4,
    2000,
    0,
    "레벨 4 몬스터 × 2장 이상",
    [
      seedEffect(
        "alembertian-1",
        "① 소재 수에 따른 서치",
        "이 카드를 엑시즈 소환했을 경우, 엑시즈 소재를 제거하고 발동할 수 있다. 2개: 덱에서 ‘참기’ 카드 1장을 패에 넣는다. 3개: 덱에서 레벨 4 몬스터 1장을 패에 넣는다. 4개: 덱에서 마법 / 함정 카드 1장을 패에 넣는다.",
        ["DETACH_XYZ", "SEARCH"],
        {
          ash: true,
          usageLimit: "HARD_ONCE_PER_TURN",
          activationTags: ["TRIGGER", "CUSTOM"],
        },
      ),
      seedEffect(
        "alembertian-2",
        "② 참기 몬스터 특수 소환",
        "자신 필드의 몬스터 1장을 릴리스하고 발동할 수 있다. 자신의 패 / 묘지에서 레벨 4의 ‘참기’ 몬스터 1장을 특수 소환한다.",
        ["SPECIAL_SUMMON"],
        { usageLimit: "HARD_ONCE_PER_TURN", activationTags: ["IGNITION"] },
      ),
    ],
  ),
  seedMonster(
    "eclipse-twins",
    "이클립스의 쌍둥이",
    "XYZ",
    4,
    2500,
    1200,
    "레벨 4 몬스터 × 2. 이 카드를 엑시즈 소환할 경우, 자신 필드의 랭크 4 몬스터를 레벨 4 몬스터로 하고 소재로 할 수 있다.",
    [
      seedEffect(
        "eclipse-1",
        "① 몬스터에 2회 공격",
        "이 카드의 엑시즈 소재를 1개 제거하고 발동할 수 있다. 이 턴에, 이 카드는 1번의 배틀 페이즈 중에 2회까지 몬스터에 공격할 수 있다.",
        ["DETACH_XYZ", "CUSTOM"],
        { activationTags: ["IGNITION"] },
      ),
      seedEffect(
        "eclipse-2",
        "② 묘지로 보내지면 엑시즈 2장 활용",
        "이 카드가 묘지로 보내졌을 경우, 자신 묘지의 다른 랭크 4 이하의 엑시즈 몬스터 2장을 대상으로 하고 발동할 수 있다. 그 중 1장을 특수 소환하고, 나머지 1장을 그 몬스터의 엑시즈 소재로 한다.",
        ["SPECIAL_SUMMON", "ATTACH_XYZ"],
        {
          sourceZone: "GRAVEYARD",
          usageLimit: "HARD_ONCE_PER_TURN",
          allowedTurns: SELF_OR_OPPONENT,
          allowedPhases: ALL_PHASES,
          activationTags: ["TRIGGER", "ON_SENT_GY"],
          applicationTags: ["TARGET_REQUIRED"],
        },
      ),
    ],
  ),
  seedMonster(
    "saryuja-skull-dread",
    "쇄룡사－스컬데드",
    "LINK",
    4,
    2800,
    null,
    "카드명이 다른 몬스터 2장 이상",
    [
      seedEffect(
        "saryuja-2",
        "소재 2장 이상: 링크 앞 몬스터 강화",
        "이 카드의 링크 앞에 몬스터가 일반 소환 / 특수 소환되었을 경우에 발동한다. 그 몬스터의 공격력 / 수비력은 300 올린다.",
        ["CHANGE_ATK_DEF"],
        {
          allowedTurns: SELF_OR_OPPONENT,
          allowedPhases: ALL_PHASES,
          activationTags: ["TRIGGER", "ON_NORMAL_SUMMON", "ON_SPECIAL_SUMMON"],
        },
      ),
      seedEffect(
        "saryuja-3",
        "소재 3장 이상: 패 특수 소환",
        "1턴에 1번, 자신 메인 페이즈에 발동할 수 있다. 패에서 몬스터 1장을 특수 소환한다.",
        ["SPECIAL_SUMMON"],
        { usageLimit: "ONCE_PER_TURN", activationTags: ["IGNITION"] },
      ),
      seedEffect(
        "saryuja-4",
        "소재 4장: 4장 드로우 후 3장 되돌리기",
        "이 카드를 링크 소환했을 때에 발동할 수 있다. 자신은 4장 드로우한다. 그 후, 자신의 패를 3장 골라 좋아하는 순서대로 덱 아래로 되돌린다.",
        ["DRAW", "RETURN_DECK"],
        { ash: true, activationTags: ["TRIGGER", "CUSTOM"] },
      ),
    ],
  ),
];

function handTrapOperation(
  id: string,
  type: DisruptionType,
  target: DisruptionTarget,
  duration: EffectDuration,
  details: string,
  options: Partial<
    Pick<
      DisruptionOperation,
      "link" | "selection" | "amount" | "application" | "conditionText"
    >
  > = {},
): DisruptionOperation {
  return {
    id,
    type,
    target,
    duration,
    details,
    link: options.link ?? "THEN",
    selection: options.selection ?? "NONE",
    amount: options.amount ?? 1,
    application: options.application ??
      (type === "DRAW_ON_SUMMON" ? "EACH_MATCH" : "ON_TRIGGER"),
    conditionText: options.conditionText ?? "",
  };
}

function defineBuiltInHandTrap(
  id: string,
  name: string,
  description: string,
  activation: Partial<HandTrap["activation"]>,
  disruptions: DisruptionOperation[],
): HandTrap {
  return {
    id,
    name,
    description,
    builtIn: true,
    activation: {
      sourceZone: activation.sourceZone ?? "HAND",
      timing: activation.timing ?? "RESPONSE_EFFECT",
      conditions: activation.conditions ?? ["OPPONENT_EFFECT"],
      conditionLogic: activation.conditionLogic ?? "ALL",
      customCondition: activation.customCondition ?? "",
      costText: activation.costText ?? "",
      usageLimit: activation.usageLimit ?? "NONE",
    },
    disruptions,
  };
}

const BUILT_IN_HAND_TRAPS: HandTrap[] = [
  defineBuiltInHandTrap(
    ASH_ID,
    "하루 우라라",
    "드로우를 포함한 덱→패 이동·덱 특수 소환·덱에서 묘지로 보내기를 포함하는 효과를 무효로 합니다.",
    {
      conditions: ["OPPONENT_EFFECT"],
      customCondition:
        "드로우를 포함해 덱에서 카드를 패에 넣거나, 덱에서 몬스터를 특수 소환하거나, 덱에서 카드를 묘지로 보내는 효과를 포함할 때",
      costText: "이 카드를 패에서 버린다",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "ash-negate",
        "NEGATE_EFFECT",
        "RESPONDED_EFFECT",
        "IMMEDIATE",
        "그 효과를 무효로 한다",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-ghost-ogre",
    "유령토끼",
    "필드에서 발동한 몬스터 효과나 이미 앞면인 마법·함정의 효과에 반응해 그 카드를 파괴합니다.",
    {
      conditions: ["OPPONENT_EFFECT", "CUSTOM"],
      customCondition:
        "필드의 몬스터 효과, 또는 필드에 이미 앞면 표시인 마법 / 함정의 효과가 발동했을 때",
      costText: "패 / 필드의 이 카드를 묘지로 보낸다",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "ghost-ogre-destroy",
        "DESTROY",
        "RESPONDED_CARD",
        "IMMEDIATE",
        "필드의 그 카드를 파괴한다(효과는 무효로 하지 않는다)",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-nibiru",
    "원시생명체 니비루",
    "메인 페이즈에 상대가 몬스터를 5장 이상 소환했다면 양쪽 필드의 앞면 몬스터를 가능한 한 릴리스합니다.",
    {
      timing: "OPEN_STATE",
      conditions: ["FIVE_SUMMONS"],
      customCondition:
        "상대가 5장 이상의 몬스터를 일반 소환 / 특수 소환한 자신 / 상대 턴의 메인 페이즈",
      costText: "",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "nibiru-tribute",
        "CUSTOM",
        "ALL_VALID_CARDS",
        "IMMEDIATE",
        "자신 / 상대 필드의 앞면 표시 몬스터를 가능한 한 릴리스한다",
        { selection: "CHOOSE_AT_RESOLUTION" },
      ),
      handTrapOperation(
        "nibiru-summon",
        "CUSTOM",
        "CUSTOM",
        "IMMEDIATE",
        "이 카드를 패에서 특수 소환하고 상대 필드에 원시생명체 토큰을 특수 소환한다",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-feedrauris-harmonia",
    "피드라울리스＝하르모니아",
    "상대 필드의 몬스터 효과에 반응해 자신을 특수 소환하고, 공개 수가 충분하면 싱크로 몬스터를 묘지로 보내고 상대 몬스터를 파괴합니다.",
    {
      conditions: ["MONSTER_EFFECT", "CUSTOM"],
      customCondition:
        "상대 필드의 몬스터 효과가 발동했을 때 패의 이 카드와 엑스트라 덱의 싱크로 몬스터를 합계 2장 이상 보여줄 수 있을 때",
      costText: "패의 이 카드와 엑스트라 덱의 싱크로 몬스터 5장까지를 보여준다",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "feedrauris-special",
        "CUSTOM",
        "CUSTOM",
        "IMMEDIATE",
        "2장 이상 공개했다면 이 카드를 특수 소환한다",
        { application: "ON_TRIGGER", conditionText: "합계 2장 이상 공개" },
      ),
      handTrapOperation(
        "feedrauris-send",
        "SEND_GRAVE",
        "CUSTOM",
        "IMMEDIATE",
        "4장 이상 공개했다면 공개한 싱크로 몬스터 1장을 엑스트라 덱에서 묘지로 보낸다",
        { application: "ON_TRIGGER", conditionText: "합계 4장 이상 공개" },
      ),
      handTrapOperation(
        "feedrauris-destroy",
        "DESTROY",
        "SELECTED_CARD",
        "IMMEDIATE",
        "합계 6장을 공개했다면 상대 필드의 몬스터 1장을 파괴한다",
        {
          selection: "CHOOSE_AT_RESOLUTION",
          application: "ON_TRIGGER",
          conditionText: "합계 6장 공개",
        },
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-dominus-spiral",
    "도미나스 스파이럴",
    "상대가 패·묘지의 몬스터 효과를 발동한 턴에 상대 몬스터를 패 또는 엑스트라 덱으로 되돌립니다.",
    {
      timing: "OPEN_STATE",
      conditions: ["CUSTOM"],
      customCondition:
        "상대가 패 / 묘지의 몬스터 효과를 발동한 턴. 패 발동 시 이후 듀얼 중 빛 / 어둠 속성 몬스터 효과를 발동할 수 없음",
      costText: "",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "dominus-spiral-return",
        "RETURN_HAND",
        "SELECTED_CARD",
        "IMMEDIATE",
        "상대 필드의 몬스터 1장을 패 / 엑스트라 덱으로 되돌린다. 자신 묘지에 함정이 없으면 상대는 묘지의 몬스터 1장을 특수 소환할 수 있다",
        { selection: "TARGET_AT_ACTIVATION" },
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-dominus-spark",
    "도미나스 스파크",
    "상대가 패·묘지의 몬스터 효과를 발동한 턴에 상대 필드의 몬스터 1장을 제외합니다.",
    {
      timing: "OPEN_STATE",
      conditions: ["CUSTOM"],
      customCondition:
        "상대가 패 / 묘지의 몬스터 효과를 발동한 턴. 패 발동 시 이후 듀얼 중 땅 / 물 / 화염 / 바람 속성 몬스터 효과를 발동할 수 없음",
      costText: "",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "dominus-spark-banish",
        "BANISH",
        "SELECTED_CARD",
        "IMMEDIATE",
        "상대 필드의 몬스터 1장을 제외한다. 자신 묘지에 함정이 없으면 상대는 패의 몬스터 1장을 특수 소환할 수 있다",
        { selection: "TARGET_AT_ACTIVATION" },
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-dd-crow",
    "D.D. 크로우",
    "상대 묘지의 카드 1장을 대상으로 제외합니다.",
    {
      timing: "RESPONSE_EFFECT",
      conditions: ["CUSTOM"],
      customCondition: "자신 / 상대 턴에 상대 묘지의 카드 1장을 대상으로 할 수 있을 때",
      costText: "이 카드를 패에서 묘지로 버린다",
    },
    [
      handTrapOperation(
        "dd-crow-banish",
        "BANISH",
        "SELECTED_CARD",
        "IMMEDIATE",
        "상대 묘지의 대상 카드 1장을 제외한다",
        { selection: "TARGET_AT_ACTIVATION" },
      ),
    ],
  ),
  ...[
    ["builtin-bystial-magnamhut", "비스테드 마그나무트"],
    ["builtin-bystial-druiswurm", "비스테드 드루이드브룸"],
    ["builtin-bystial-baldrake", "비스테드 발드레이크"],
    ["builtin-bystial-saronir", "비스테드 살로니르"],
  ].map(([id, name]) =>
    defineBuiltInHandTrap(
      id,
      name,
      "자신 또는 상대 묘지의 빛·어둠 속성 몬스터 1장을 제외하고 패에서 특수 소환합니다.",
      {
        timing: "OPEN_STATE",
        conditions: ["CUSTOM"],
        customCondition:
          "자신 또는 상대 묘지의 빛 / 어둠 속성 몬스터 1장을 대상으로 할 수 있을 때. 상대 턴에는 상대 필드에 몬스터가 존재해야 함",
        costText: "대상 몬스터를 제외한다",
        usageLimit: "HARD_ONCE_PER_TURN",
      },
      [
        handTrapOperation(
          `${id}-banish`,
          "BANISH",
          "SELECTED_CARD",
          "IMMEDIATE",
          "묘지의 대상 빛 / 어둠 속성 몬스터를 제외한다",
          { selection: "TARGET_AT_ACTIVATION" },
        ),
        handTrapOperation(
          `${id}-summon`,
          "CUSTOM",
          "CUSTOM",
          "IMMEDIATE",
          "그 후 이 카드를 패에서 특수 소환한다",
        ),
      ],
    ),
  ),
  defineBuiltInHandTrap(
    "builtin-skull-meister",
    "스컬 마이스터",
    "상대 묘지에서 발동한 카드의 효과를 무효로 합니다.",
    {
      conditions: ["OPPONENT_EFFECT", "CUSTOM"],
      customCondition: "상대 묘지에서 마법 / 함정 / 몬스터의 효과가 발동했을 때",
      costText: "이 카드를 패에서 묘지로 보낸다",
    },
    [
      handTrapOperation(
        "skull-meister-negate",
        "NEGATE_EFFECT",
        "RESPONDED_EFFECT",
        "IMMEDIATE",
        "그 효과를 무효로 한다",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-ghost-belle",
    "저택 와라시",
    "묘지에서 회수·특수 소환·제외하는 효과를 포함하는 카드의 발동을 무효로 합니다.",
    {
      conditions: ["OPPONENT_EFFECT", "CUSTOM"],
      customCondition:
        "묘지에서 카드를 패 / 덱 / 엑스트라 덱에 넣거나, 묘지에서 몬스터를 특수 소환하거나, 묘지에서 카드를 제외하는 효과를 포함할 때",
      costText: "이 카드를 패에서 버린다",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "ghost-belle-negate",
        "NEGATE_ACTIVATION",
        "RESPONDED_EFFECT",
        "IMMEDIATE",
        "그 발동을 무효로 한다",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-phantazmay",
    "환창룡 판타즈메이",
    "필드에 존재할 때 자신 필드의 몬스터를 대상으로 하는 상대 효과의 발동을 무효로 하고 파괴합니다.",
    {
      sourceZone: "FIELD",
      conditions: ["OPPONENT_EFFECT", "CUSTOM"],
      customCondition:
        "이 카드가 자신 필드에 존재하고 상대가 자신 필드의 몬스터를 대상으로 하는 효과를 발동했을 때",
      costText: "패를 1장 버린다",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "phantazmay-negate",
        "NEGATE_ACTIVATION",
        "RESPONDED_EFFECT",
        "IMMEDIATE",
        "그 발동을 무효로 한다",
      ),
      handTrapOperation(
        "phantazmay-destroy",
        "DESTROY",
        "RESPONDED_CARD",
        "IMMEDIATE",
        "그 카드를 파괴한다",
      ),
    ],
  ),
  ...[
    {
      id: "builtin-dominus-purge",
      name: "도미나스 퍼지",
      condition: "덱에서 카드를 패에 넣는 효과를 포함하는 카드의 효과가 발동했을 때",
      restriction: "어둠 / 물 / 화염",
    },
    {
      id: "builtin-dominus-impulse",
      name: "도미나스 임펄스",
      condition: "몬스터를 특수 소환하는 효과를 포함하는 카드의 효과가 발동했을 때",
      restriction: "빛 / 땅 / 바람",
    },
  ].map(({ id, name, condition, restriction }) =>
    defineBuiltInHandTrap(
      id,
      name,
      `${condition} 그 효과를 무효로 하고, 묘지에 함정이 있다면 그 카드도 파괴합니다.`,
      {
        conditions: ["OPPONENT_EFFECT", "CUSTOM"],
        customCondition: `${condition}. 패에서 발동하려면 상대 필드에 카드가 존재해야 하며, 이후 듀얼 중 ${restriction} 속성 몬스터 효과를 발동할 수 없음`,
        costText: "",
        usageLimit: "HARD_ONCE_PER_TURN",
      },
      [
        handTrapOperation(
          `${id}-negate`,
          "NEGATE_EFFECT",
          "RESPONDED_EFFECT",
          "IMMEDIATE",
          "그 효과를 무효로 한다",
        ),
        handTrapOperation(
          `${id}-destroy`,
          "DESTROY",
          "RESPONDED_CARD",
          "IMMEDIATE",
          "자신 묘지에 함정 카드가 존재할 경우 추가로 그 무효로 한 카드를 파괴한다",
          { link: "AND_IF_YOU_DO" },
        ),
      ],
    ),
  ),
  defineBuiltInHandTrap(
    "builtin-infinite-impermanence",
    "무한포영",
    "자신 필드에 카드가 없을 때 패에서 발동해 상대 필드의 앞면 몬스터 효과를 턴 종료시까지 무효로 합니다.",
    {
      conditions: ["NO_CARDS_CONTROLLED", "CUSTOM"],
      customCondition: "상대 필드의 앞면 표시 몬스터 1장을 대상으로 할 수 있을 때",
      costText: "",
    },
    [
      handTrapOperation(
        "impermanence-negate",
        "NEGATE_EFFECT",
        "SELECTED_CARD",
        "TURN_END",
        "대상 몬스터의 효과를 턴 종료시까지 무효로 한다",
        { selection: "TARGET_AT_ACTIVATION" },
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-dominus-verse",
    "열왕시편",
    "자신 묘지에 몬스터가 없을 때 패에서 발동해 상대 필드 몬스터의 효과를 무효로 합니다.",
    {
      conditions: ["MONSTER_EFFECT", "CUSTOM"],
      customCondition:
        "상대가 필드의 몬스터 효과를 발동했을 때. 패 발동은 자신 묘지에 몬스터가 없어야 하며, 이후 다음 턴 종료시까지 패 / 묘지 / 제외 상태인 몬스터 효과를 발동할 수 없음",
      costText: "",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "dominus-verse-negate",
        "NEGATE_EFFECT",
        "RESPONDED_EFFECT",
        "IMMEDIATE",
        "그 효과를 무효로 한다",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-effect-veiler",
    "이펙트 뵐러",
    "상대 메인 페이즈에 상대 필드의 효과 몬스터 1장의 효과를 턴 종료시까지 무효로 합니다.",
    {
      conditions: ["MONSTER_EFFECT", "CUSTOM"],
      customCondition: "상대 메인 페이즈에 상대 필드의 효과 몬스터 1장을 대상으로 할 수 있을 때",
      costText: "이 카드를 패에서 묘지로 보낸다",
    },
    [
      handTrapOperation(
        "effect-veiler-negate",
        "NEGATE_EFFECT",
        "SELECTED_CARD",
        "TURN_END",
        "대상 몬스터의 효과를 턴 종료시까지 무효로 한다",
        { selection: "TARGET_AT_ACTIVATION" },
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-ghost-mourner",
    "사요 시구레",
    "상대가 앞면 몬스터를 특수 소환했을 때 그 몬스터의 효과를 턴 종료시까지 무효로 하고, 필드를 벗어나면 원래 공격력만큼 데미지를 줍니다.",
    {
      timing: "AFTER_RESOLUTION",
      conditions: ["SPECIAL_SUMMON"],
      customCondition: "상대가 몬스터를 앞면 표시로 특수 소환했을 때 그 중 1장을 대상으로 함",
      costText: "이 카드를 패에서 버린다",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "ghost-mourner-negate",
        "NEGATE_EFFECT",
        "SELECTED_CARD",
        "TURN_END",
        "대상 몬스터의 효과를 턴 종료시까지 무효로 한다",
        { selection: "TARGET_AT_ACTIVATION" },
      ),
      handTrapOperation(
        "ghost-mourner-damage",
        "CUSTOM",
        "OPPONENT_PLAYER",
        "TURN_END",
        "그 몬스터가 이 턴 중 필드에서 벗어나면 컨트롤러가 원래 공격력만큼 데미지를 받는다",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-psy-framegear-gamma",
    "PSY프레임기어 γ",
    "자신 필드에 몬스터가 없을 때 상대 몬스터 효과의 발동을 무효로 하고 파괴하며, 자신과 드라이버를 특수 소환합니다.",
    {
      conditions: ["MONSTER_EFFECT", "OWN_FIELD_EMPTY"],
      customCondition: "패 / 덱 / 묘지에 PSY프레임 드라이버가 존재해야 함",
      costText: "",
    },
    [
      handTrapOperation(
        "gamma-negate",
        "NEGATE_ACTIVATION",
        "RESPONDED_EFFECT",
        "IMMEDIATE",
        "그 발동을 무효로 한다",
      ),
      handTrapOperation(
        "gamma-destroy",
        "DESTROY",
        "RESPONDED_CARD",
        "IMMEDIATE",
        "그 카드를 파괴한다",
      ),
      handTrapOperation(
        "gamma-summon",
        "CUSTOM",
        "CUSTOM",
        "TURN_END",
        "이 카드와 PSY프레임 드라이버를 특수 소환하고 엔드 페이즈에 둘 다 제외한다",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-herald-of-orange-light",
    "버밀리온 디클레어러",
    "이 카드와 천사족 몬스터 1장을 패에서 묘지로 보내 상대 몬스터 효과의 발동을 무효로 하고 파괴합니다.",
    {
      conditions: ["MONSTER_EFFECT"],
      costText: "패에서 이 카드와 천사족 몬스터 1장을 묘지로 보낸다",
    },
    [
      handTrapOperation(
        "orange-light-negate",
        "NEGATE_ACTIVATION",
        "RESPONDED_EFFECT",
        "IMMEDIATE",
        "그 발동을 무효로 한다",
      ),
      handTrapOperation(
        "orange-light-destroy",
        "DESTROY",
        "RESPONDED_CARD",
        "IMMEDIATE",
        "그 카드를 파괴한다",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-red-reboot",
    "레드 리부트",
    "LP를 절반 지불하고 패에서 발동해 상대 함정의 발동을 무효로 하고, 턴 종료시까지 상대의 함정 발동을 막습니다.",
    {
      conditions: ["OPPONENT_EFFECT", "CUSTOM"],
      customCondition: "상대가 함정 카드를 발동했을 때",
      costText: "패에서 발동할 경우 LP를 절반 지불한다",
    },
    [
      handTrapOperation(
        "red-reboot-negate",
        "NEGATE_ACTIVATION",
        "RESPONDED_EFFECT",
        "IMMEDIATE",
        "그 발동을 무효로 한다",
      ),
      handTrapOperation(
        "red-reboot-reset",
        "CUSTOM",
        "RESPONDED_CARD",
        "IMMEDIATE",
        "그 카드를 그대로 세트하고 상대는 덱에서 함정 카드 1장을 세트할 수 있다",
      ),
      handTrapOperation(
        "red-reboot-lock",
        "CUSTOM",
        "OPPONENT_PLAYER",
        "TURN_END",
        "이 카드의 발동 후 턴 종료시까지 상대는 함정 카드를 발동할 수 없다",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-maxx-c",
    "증식의 G",
    "이 턴에 상대가 몬스터를 특수 소환할 때마다 1장 드로우합니다.",
    {
      timing: "OPEN_STATE",
      conditions: ["CUSTOM"],
      customCondition: "자신 / 상대 턴",
      costText: "이 카드를 패에서 묘지로 보낸다",
      usageLimit: "HARD_ONCE_PER_TURN",
    },
    [
      handTrapOperation(
        "maxx-c-draw",
        "DRAW_ON_SUMMON",
        "OPPONENT_PLAYER",
        "TURN_END",
        "상대가 몬스터를 특수 소환할 때마다 1장 드로우한다",
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-dimension-shifter",
    "디멘션 어트랙터",
    "다음 턴 종료시까지 묘지로 보내지는 카드를 대신 제외합니다.",
    {
      timing: "OPEN_STATE",
      conditions: ["CUSTOM"],
      customCondition: "자신 묘지에 카드가 존재하지 않을 때",
      costText: "이 카드를 패에서 묘지로 보낸다",
    },
    [
      handTrapOperation(
        "dimension-shifter-banish",
        "REPLACE_SEND_GY_WITH_BANISH",
        "ALL_VALID_CARDS",
        "NEXT_TURN_END",
        "다음 턴 종료시까지 묘지로 보내지는 카드는 묘지로 가지 않고 제외된다",
        { application: "AFTER_TRIGGER" },
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-artifact-lancea",
    "아티팩트－롱기누스",
    "상대 턴에 이 카드를 릴리스해 그 턴 동안 서로 카드를 제외할 수 없게 합니다.",
    {
      conditions: ["CUSTOM"],
      customCondition: "상대 턴",
      costText: "패 / 필드의 이 카드를 릴리스한다",
    },
    [
      handTrapOperation(
        "artifact-lancea-lock",
        "PREVENT_BANISH",
        "ALL_VALID_CARDS",
        "TURN_END",
        "이 턴에 서로 카드를 제외할 수 없다",
        { application: "AFTER_TRIGGER" },
      ),
    ],
  ),
  defineBuiltInHandTrap(
    "builtin-droll-lock-bird",
    "드롤 & 로크 버드",
    "상대가 드로우 페이즈 이외에 덱에서 카드를 패에 넣은 뒤, 그 턴 동안 양쪽의 추가 덱→패 이동을 막습니다.",
    {
      timing: "AFTER_RESOLUTION",
      conditions: ["CARD_ADDED_FROM_DECK"],
      customCondition: "드로우 페이즈 이외에 상대가 덱에서 카드를 패에 넣었을 때",
      costText: "이 카드를 패에서 묘지로 보낸다",
    },
    [
      handTrapOperation(
        "droll-lock",
        "PREVENT_ADD_FROM_DECK",
        "ALL_VALID_CARDS",
        "TURN_END",
        "이 턴에 서로 덱에서 카드를 패에 넣을 수 없다",
        { application: "AFTER_TRIGGER" },
      ),
    ],
  ),
  ...[
    {
      id: "builtin-mulcharmy-fuwalos",
      name: "마루챠미 후와로스",
      source: "덱 / 엑스트라 덱",
    },
    {
      id: "builtin-mulcharmy-purulia",
      name: "마루챠미 푸루리아",
      source: "패(일반 소환 포함)",
    },
    {
      id: "builtin-mulcharmy-meowls",
      name: "마루챠미 냐루스",
      source: "묘지 / 제외 상태",
    },
  ].map(({ id, name, source }) =>
    defineBuiltInHandTrap(
      id,
      name,
      `상대가 ${source}에서 몬스터를 소환할 때마다 1장 드로우하고, 엔드 페이즈에 초과 패를 되돌립니다.`,
      {
        timing: "OPEN_STATE",
        conditions: ["NO_CARDS_CONTROLLED"],
        customCondition: `자신 / 상대 턴. 상대가 ${source}에서 몬스터를 소환할 때 적용`,
        costText: "이 카드를 패에서 버린다",
        usageLimit: "HARD_ONCE_PER_TURN",
      },
      [
        handTrapOperation(
          `${id}-draw`,
          "DRAW_ON_SUMMON",
          "OPPONENT_PLAYER",
          "TURN_END",
          `상대가 ${source}에서 몬스터를 소환할 때마다 1장 드로우한다. 엔드 페이즈에 패가 상대 필드 카드 수 + 6장보다 많으면 차이만큼 무작위로 덱으로 되돌린다`,
        ),
      ],
    ),
  ),
];

const DEFAULT_STORE: Store = {
  schemaVersion: 20,
  handTraps: BUILT_IN_HAND_TRAPS,
  decks: [],
  cards: SEEDED_CARDS,
  combos: [],
  runs: [],
  trash: [],
};

const MODE_LABEL: Record<HandTrapMode, string> = {
  EFFECT_NEGATE: "효과 무효",
  ACTIVATION_NEGATE: "발동 무효",
  MONSTER_NEGATE: "몬스터 효과 무효",
};

const TIMING_LABEL: Record<ActivationTiming, string> = {
  RESPONSE_EFFECT: "효과 발동에 체인",
  RESPONSE_SUMMON: "소환에 반응",
  AFTER_RESOLUTION: "효과 처리 후",
  OPEN_STATE: "오픈 게임 상태",
  CUSTOM: "사용자 정의",
};
const CONDITION_LABEL: Record<ActivationCondition, string> = {
  OPPONENT_EFFECT: "상대가 효과를 발동",
  MONSTER_EFFECT: "몬스터 효과가 발동",
  SPECIAL_SUMMON: "몬스터가 특수 소환됨",
  CARD_ADDED_FROM_DECK: "덱에서 카드가 패에 들어옴",
  OWN_FIELD_EMPTY: "자신 필드가 비어 있음",
  NO_CARDS_CONTROLLED: "자신이 카드를 컨트롤하지 않음",
  FIVE_SUMMONS: "5장 이상 소환됨",
  CUSTOM: "추가 사용자 조건",
};
const DISRUPTION_LABEL: Record<DisruptionType, string> = {
  NEGATE_EFFECT: "효과 무효",
  NEGATE_ACTIVATION: "발동 무효",
  DESTROY: "파괴",
  RETURN_HAND: "패로 바운스",
  RETURN_DECK: "덱으로 바운스",
  BANISH: "제외",
  SEND_GRAVE: "묘지로 보냄",
  DRAW_ON_SUMMON: "특수 소환마다 드로우",
  PREVENT_ADD_FROM_DECK: "덱에서 패 추가 금지",
  PREVENT_SPECIAL_SUMMON: "특수 소환 금지",
  PREVENT_BANISH: "제외 금지",
  REPLACE_SEND_GY_WITH_BANISH: "묘지 이동을 제외로 치환",
  CUSTOM: "사용자 정의 처리",
};
const OPERATION_APPLICATION_LABEL: Record<OperationApplication, string> = {
  ON_TRIGGER: "격발 시 1회 처리",
  AFTER_TRIGGER: "격발 후 잔존 적용",
  EACH_MATCH: "조건 행동마다 반복 적용",
};
const TARGET_LABEL: Record<DisruptionTarget, string> = {
  RESPONDED_EFFECT: "반응한 효과",
  RESPONDED_CARD: "그 효과를 발동한 카드",
  SELECTED_CARD: "선택한 카드",
  OPPONENT_PLAYER: "상대 플레이어",
  ALL_VALID_CARDS: "조건을 만족하는 모든 카드",
  CUSTOM: "사용자 정의 대상",
};
const DURATION_LABEL: Record<EffectDuration, string> = {
  IMMEDIATE: "즉시 처리",
  CHAIN_END: "체인 종료까지",
  TURN_END: "턴 종료까지",
  NEXT_TURN_END: "다음 턴 종료까지",
  WHILE_FACE_UP: "앞면으로 존재하는 동안",
  CUSTOM: "사용자 정의 기간",
};
const LINK_LABEL: Record<ResolutionLink, string> = {
  THEN: "그 후",
  ALSO: "또한",
  AND_IF_YOU_DO: "그렇게 했을 경우",
  AND: "동시에 처리",
  CUSTOM: "사용자 정의 연결",
};
const SELECTION_LABEL: Record<SelectionTiming, string> = {
  NONE: "선택 없음",
  TARGET_AT_ACTIVATION: "발동 시 대상 지정",
  CHOOSE_AT_RESOLUTION: "처리 시 선택",
};
const USAGE_LABEL = {
  NONE: "제한 없음",
  ONCE_PER_TURN: "턴에 1번",
  HARD_ONCE_PER_TURN: "카드명으로 턴에 1번",
  ONCE_PER_DUEL: "듀얼 중 1번",
} as const;
const MONSTER_TYPE_LABEL: Record<MonsterType, string> = {
  NORMAL: "일반",
  EFFECT: "효과",
  RITUAL: "의식",
  FUSION: "융합",
  SYNCHRO: "싱크로",
  XYZ: "엑시즈",
  LINK: "링크",
  PENDULUM: "펜듈럼",
  TOKEN: "토큰",
};
const EFFECT_USAGE_LABEL: Record<EffectUsageLimit, string> = {
  NONE: "제한 없음",
  ONCE_PER_CHAIN: "체인 중 1번",
  ONCE_PER_TURN: "이 카드가 턴에 1번",
  HARD_ONCE_PER_TURN: "카드명으로 턴에 1번",
  ONCE_PER_DUEL: "듀얼 중 1번",
};
const PERMISSION_EVENT_LABEL = {
  ENABLE: "퍼미션 활성",
  CONSUME: "횟수 차감",
  DISABLE: "퍼미션 소멸",
} as const;
const HAND_TRAP_RESPONSE_LABEL: Record<HandTrapResponseStrategy, string> = {
  AUTO: "자동 판정",
  BLOCK_WITH_PERMISSION: "퍼미션으로 차단",
  AVOID_TRIGGER: "발동 조건 피하기",
  BYPASS_ROUTE: "우회 전개 사용",
  ACCEPT_WITH_LIMIT: "맞고 제한 내 진행",
};
const EFFECT_TYPE_LABEL: Record<CardEffectType, string> = {
  ACTIVATED: "발동하는 효과",
  CONTINUOUS: "지속효과",
};
const SOURCE_ZONE_LABEL: Record<EffectSourceZone, string> = {
  HAND: "패",
  MONSTER_ZONE: "몬스터 존",
  SPELL_TRAP_ZONE: "마법·함정 존",
  FIELD_ZONE: "필드 존",
  GRAVEYARD: "묘지",
  BANISHED: "제외 상태",
  EXTRA_DECK: "엑스트라 덱",
  CUSTOM: "기타·사용자 정의",
};
const TURN_OWNER_LABEL: Record<TurnOwner, string> = {
  SELF: "자신 턴",
  OPPONENT: "상대 턴",
};
const PLAYER_SIDE_LABEL: Record<PlayerSide, string> = {
  SELF: "자신",
  OPPONENT: "상대",
};
const PHASE_LABEL: Record<DuelPhase, string> = {
  DRAW: "드로우 페이즈",
  STANDBY: "스탠바이 페이즈",
  MAIN1: "메인 페이즈 1",
  BATTLE: "배틀 페이즈",
  MAIN2: "메인 페이즈 2",
  END: "엔드 페이즈",
};
const FIELD_ZONE_LABEL: Record<FieldZone, string> = {
  MONSTER_ZONE: "몬스터 존",
  SPELL_TRAP_ZONE: "마법·함정 존",
  FIELD_ZONE: "필드 존",
  PENDULUM_ZONE: "펜듈럼 존",
};
const LOCATION_LABEL: Record<CardLocation, string> = {
  HAND: "패",
  MONSTER_ZONE: "몬스터 존",
  SPELL_TRAP_ZONE: "마법·함정 존",
  FIELD_ZONE: "필드 존",
  PENDULUM_ZONE: "펜듈럼 존",
  GRAVEYARD: "묘지",
  BANISHED: "제외",
  XYZ_MATERIAL: "엑시즈 소재",
  DECK: "덱",
  EXTRA_DECK: "엑스트라 덱",
};
const MONSTER_ZONE_LABEL: Record<MonsterZoneSlot, string> = {
  MAIN_1: "메인 몬스터 존 1 (왼쪽)",
  MAIN_2: "메인 몬스터 존 2",
  MAIN_3: "메인 몬스터 존 3 (중앙)",
  MAIN_4: "메인 몬스터 존 4",
  MAIN_5: "메인 몬스터 존 5 (오른쪽)",
  EXTRA_LEFT: "왼쪽 엑스트라 몬스터 존",
  EXTRA_RIGHT: "오른쪽 엑스트라 몬스터 존",
};
const MAIN_MONSTER_ZONES: MonsterZoneSlot[] = [
  "MAIN_1",
  "MAIN_2",
  "MAIN_3",
  "MAIN_4",
  "MAIN_5",
];
const EXTRA_MONSTER_ZONES: MonsterZoneSlot[] = ["EXTRA_LEFT", "EXTRA_RIGHT"];
const ACTIVATION_TAG_LABEL: Record<EffectActivationTag, string> = {
  IGNITION: "기동 효과",
  QUICK: "유발즉시·빠른 효과",
  TRIGGER: "유발 효과",
  ON_NORMAL_SUMMON: "일반 소환 성공 시",
  ON_SPECIAL_SUMMON: "특수 소환 성공 시",
  ON_FLIP: "리버스 시",
  ON_ATTACK: "공격 선언·전투 시",
  ON_DAMAGE: "데미지 발생 시",
  ON_SENT_GY: "묘지로 보내졌을 때",
  ON_BANISHED: "제외되었을 때",
  ON_DETACH_XYZ: "엑시즈 소재를 제거했을 때",
  ON_CARD_EFFECT: "카드 효과 발동에 체인",
  ON_MONSTER_EFFECT: "몬스터 효과 발동에 체인",
  ON_SUMMON_ATTEMPT: "소환 시도에 반응",
  CUSTOM: "기타 발동 조건",
};
const APPLICATION_TAG_LABEL: Record<EffectApplicationTag, string> = {
  WHILE_FACE_UP: "앞면 표시로 존재하는 동안",
  WHILE_IN_GY: "묘지에 존재하는 동안",
  WHILE_BANISHED: "제외되어 있는 동안",
  WHILE_XYZ_MATERIAL: "엑시즈 소재인 동안",
  TARGET_REQUIRED: "대상을 지정",
  NON_TARGETING: "대상을 지정하지 않음",
  SELF: "자신에게 적용",
  OPPONENT: "상대에게 적용",
  MONSTER: "몬스터에 적용",
  SPELL_TRAP: "마법·함정에 적용",
  EXTRA_DECK_MONSTER: "엑스트라 덱 몬스터에 적용",
  CUSTOM: "기타 적용 조건",
};
const OPERATION_TAG_LABEL: Record<EffectOperationTag, string> = {
  SEARCH: "덱에서 패에 넣음",
  DRAW: "드로우",
  SEND_DECK_TO_GY: "덱에서 묘지로 보냄",
  SPECIAL_SUMMON: "특수 소환",
  NORMAL_SUMMON: "일반 소환",
  DESTROY: "파괴",
  BANISH: "제외",
  SEND_GY: "묘지로 보냄",
  RETURN_HAND: "패로 되돌림",
  RETURN_DECK: "덱으로 되돌림",
  NEGATE_EFFECT: "효과 무효",
  NEGATE_ACTIVATION: "발동 무효",
  CHANGE_ATK_DEF: "공격력·수비력 변경",
  CHANGE_LEVEL_RANK: "레벨·랭크 변경",
  CHANGE_TYPE_ATTRIBUTE: "종족·속성 변경",
  ATTACH_XYZ: "엑시즈 소재로 함",
  DETACH_XYZ: "엑시즈 소재 제거",
  GRANT_EFFECT: "효과 부여",
  TAKE_CONTROL: "컨트롤 획득",
  SUMMON_LOCK: "소환 제한",
  EFFECT_LOCK: "효과 발동 제한",
  CUSTOM: "기타 처리",
};
const SUMMON_TYPE_LABEL: Record<SummonType, string> = {
  NORMAL: "일반 소환",
  RULE_SPECIAL: "효과 외 텍스트·룰 특수 소환",
  RITUAL: "의식 소환",
  FUSION: "융합 소환",
  SYNCHRO: "싱크로 소환",
  XYZ: "엑시즈 소환",
  PENDULUM: "펜듈럼 소환",
  LINK: "링크 소환",
  TOKEN: "토큰 특수 소환",
  OTHER: "기타 소환",
};

function legacyDisruption(mode?: HandTrapMode): DisruptionOperation {
  const type: DisruptionType =
    mode === "ACTIVATION_NEGATE" ? "NEGATE_ACTIVATION" : "NEGATE_EFFECT";
  return {
    id: uid(),
    type,
    target: "RESPONDED_EFFECT",
    duration: "IMMEDIATE",
    link: "THEN",
    selection: "NONE",
    details: MODE_LABEL[mode ?? "EFFECT_NEGATE"],
    amount: 1,
    application: "ON_TRIGGER",
    conditionText: "",
  };
}

function normalizeHandTrap(
  trap: Partial<HandTrap> & Pick<HandTrap, "id" | "name">,
): HandTrap {
  const builtInAsh = DEFAULT_STORE.handTraps[0];
  const fallbackActivation =
    trap.id === ASH_ID
      ? builtInAsh.activation
      : {
          sourceZone: "HAND" as const,
          timing: "RESPONSE_EFFECT" as const,
          conditions: ["OPPONENT_EFFECT" as const],
          conditionLogic: "ALL" as const,
          customCondition: "",
          costText: "이 카드를 패에서 버린다",
          usageLimit: "HARD_ONCE_PER_TURN" as const,
        };
  const fallbackDisruptions =
    trap.id === ASH_ID ? builtInAsh.disruptions : [legacyDisruption(trap.mode)];
  return {
    id: trap.id,
    name: trap.name,
    description: trap.description ?? "",
    builtIn: trap.builtIn,
    mode: trap.mode,
    activation: trap.activation
      ? {
          ...trap.activation,
          conditionLogic: trap.activation.conditionLogic ?? "ALL",
        }
      : {
          ...fallbackActivation,
          conditions: [...fallbackActivation.conditions],
        },
    disruptions: trap.disruptions?.length
      ? trap.disruptions.map((operation) => {
          const upgradedType: DisruptionType =
            trap.id === "builtin-artifact-lancea" &&
            operation.id === "artifact-lancea-lock" &&
            operation.type === "CUSTOM"
              ? "PREVENT_BANISH"
              : trap.id === "builtin-dimension-shifter" &&
                  operation.id === "dimension-shifter-banish" &&
                  operation.type === "BANISH"
                ? "REPLACE_SEND_GY_WITH_BANISH"
                : operation.type;
          return {
            ...operation,
            type: upgradedType,
            link: operation.link ?? "THEN",
            selection: operation.selection ?? "NONE",
            amount: operation.amount ?? 1,
            application:
              operation.application ??
              (upgradedType === "DRAW_ON_SUMMON"
                ? "EACH_MATCH"
                : operation.duration === "TURN_END" ||
                    operation.duration === "NEXT_TURN_END" ||
                    operation.duration === "WHILE_FACE_UP"
                  ? "AFTER_TRIGGER"
                  : "ON_TRIGGER"),
            conditionText:
              operation.conditionText ??
              (trap.id === "builtin-feedrauris-harmonia"
                ? operation.id === "feedrauris-special"
                  ? "합계 2장 이상 공개"
                  : operation.id === "feedrauris-send"
                    ? "합계 4장 이상 공개"
                    : operation.id === "feedrauris-destroy"
                      ? "합계 6장 공개"
                      : ""
                : ""),
          };
        })
      : fallbackDisruptions.map((operation) => ({
          ...operation,
          amount: operation.amount ?? 1,
          application: operation.application ?? "ON_TRIGGER",
          conditionText: operation.conditionText ?? "",
        })),
  };
}

function disruptionSummary(trap: HandTrap) {
  return trap.disruptions
    .map((operation) =>
      operation.type === "DRAW_ON_SUMMON"
        ? `${DISRUPTION_LABEL[operation.type]} ×${operation.amount}`
        : DISRUPTION_LABEL[operation.type],
    )
    .join(" + ");
}

function handTrapRole(trap: HandTrap) {
  if (trap.disruptions.some((operation) => operation.type === "DRAW_ON_SUMMON"))
    return "누적 드로우";
  if (
    trap.disruptions.some(
      (operation) =>
        operation.duration === "TURN_END" ||
        operation.duration === "NEXT_TURN_END" ||
        operation.duration === "WHILE_FACE_UP",
    )
  )
    return trap.disruptions.length > 1 ? "복합·잔존형" : "잔존형";
  return trap.disruptions.length > 1 ? "복합 방해" : "단발 방해";
}

function directlyInterruptsStep(
  trap: HandTrap,
  actionType: ComboActionType,
) {
  if (
    trap.disruptions.some((operation) =>
      ["NEGATE_EFFECT", "NEGATE_ACTIVATION"].includes(operation.type),
    )
  )
    return actionType === "EFFECT";
  return (
    actionType === "SUMMON" &&
    trap.disruptions.some(
      (operation) => operation.type === "PREVENT_SPECIAL_SUMMON",
    )
  );
}

function triggerOperationCount(trap: HandTrap) {
  return countWorstCaseTriggerOperations(trap.disruptions);
}

type HandTrapRouteMetrics = {
  triggerCount: number;
  triggerStepIds: string[];
  affectedStepIds: string[];
  blockedStepIds: string[];
  redirectedStepIds: string[];
  opponentDraws: number;
  endPhaseReturns: number;
  applicationCount: number;
  firstStepIndex: number | null;
};

function measureHandTrapRoute(
  combo: Combo,
  trap: HandTrap,
  effectIndex: Map<string, { card: Card; effect: CardEffect }>,
): HandTrapRouteMetrics {
  if (trap.activation.conditions.includes("FIVE_SUMMONS")) {
    const summonSteps = combo.steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => step.actionType === "SUMMON");
    let summonedMonsters = 0;
    const thresholdStep = summonSteps.find(({ step }) => {
      summonedMonsters += Math.max(1, step.summonCount ?? 1);
      return summonedMonsters >= 5;
    });
    return {
      triggerCount: thresholdStep ? 1 : 0,
      triggerStepIds: thresholdStep ? [thresholdStep.step.id] : [],
      affectedStepIds: thresholdStep ? [thresholdStep.step.id] : [],
      blockedStepIds: [],
      redirectedStepIds: [],
      opponentDraws: 0,
      endPhaseReturns: 0,
      applicationCount: thresholdStep ? trap.disruptions.length : 0,
      firstStepIndex: thresholdStep?.index ?? null,
    };
  }
  const finalField = simulateComboField(combo).boards.SELF.cards;
  const finalPlayerFieldCards = [...finalField.entries()].reduce(
    (total, [key, quantity]) =>
      /^(MONSTER_ZONE|SPELL_TRAP_ZONE|FIELD_ZONE|PENDULUM_ZONE):/.test(key)
        ? total + quantity
        : total,
    0,
  );
  const steps = combo.steps.map((step, index) => {
    const effect =
      step.actionType === "EFFECT"
        ? effectIndex.get(step.effectId)?.effect
        : undefined;
    const inferredCostDestinations: CardLocation[] = [];
    if (step.costEvents.some((event) => event.action === "LEAVE")) {
      if (/묘지로 보내|버린다|버리고/.test(effect?.costText ?? ""))
        inferredCostDestinations.push("GRAVEYARD");
      if (/제외/.test(effect?.costText ?? ""))
        inferredCostDestinations.push("BANISHED");
    }
    return {
      id: step.id,
      index,
      actionType: step.actionType,
      turnOwner: step.turnOwner,
      phase: step.phase,
      summonType: step.summonType,
      summonFrom: step.summonFrom,
      operationTags: effect?.operationTags ?? [],
      costDestinations: [
        ...step.costEvents.flatMap((event) =>
          event.destination
            ? [event.destination]
            : event.action === "SUMMON"
              ? [event.zone]
              : [],
        ),
        ...inferredCostDestinations,
      ],
      resultDestinations: step.zoneEvents
        .filter((event) => event.action === "SUMMON")
        .map((event) => event.zone),
      materialDestinations: step.materials.map(
        (material) => material.destination,
      ),
    };
  });
  const drawOperation = trap.disruptions.find(
    (operation) => operation.type === "DRAW_ON_SUMMON",
  );
  return evaluateHandTrapRoute({
    trapId: trap.id,
    disruptionTypes: trap.disruptions.map((operation) => operation.type),
    drawAmount: drawOperation?.amount ?? 1,
    steps,
    opponentStartingHandSize: combo.opponentStartingHandSize,
    finalPlayerFieldCards,
  });
}

function monsterValueLabel(card: Card) {
  if (card.monsterType === "XYZ") return `RANK ${card.levelRankLink ?? "-"}`;
  if (card.monsterType === "LINK") return `LINK ${card.levelRankLink ?? "-"}`;
  return `LEVEL ${card.levelRankLink ?? "-"}`;
}

function normalizeCardEffect(
  effect: Partial<CardEffect> & Pick<CardEffect, "id" | "label">,
): CardEffect {
  const allowedTurns = effect.allowedTurns ?? ["SELF", "OPPONENT"];
  const allowedPhases = effect.allowedPhases ?? [
    "DRAW",
    "STANDBY",
    "MAIN1",
    "BATTLE",
    "MAIN2",
    "END",
  ];
  const grantedProfile = effect.grantedProfile
    ? {
        ...effect.grantedProfile,
        allowedTurns: effect.grantedProfile.allowedTurns ?? allowedTurns,
        allowedPhases: effect.grantedProfile.allowedPhases ?? allowedPhases,
        activationTags: effect.grantedProfile.activationTags ?? [],
        applicationTags: effect.grantedProfile.applicationTags ?? [],
        operationTags: effect.grantedProfile.operationTags ?? [],
        interruptibleBy: effect.grantedProfile.interruptibleBy ?? [],
        blocksHandTraps: effect.grantedProfile.blocksHandTraps ?? [],
      }
    : effect.canBeGranted
      ? {
          label: `${effect.label} (부여)`,
          text: effect.text ?? "",
          effectType: effect.effectType ?? "ACTIVATED",
          sourceZone: "MONSTER_ZONE" as EffectSourceZone,
          usageLimit: effect.usageLimit ?? "NONE",
          allowedTurns,
          allowedPhases,
          timingDetails: effect.timingDetails ?? "",
          activationTags: effect.activationTags ?? [],
          applicationTags: effect.applicationTags ?? [],
          operationTags: effect.operationTags ?? [],
          interruptibleBy: effect.interruptibleBy ?? [],
          blocksHandTraps: effect.blocksHandTraps ?? [],
        }
      : null;
  return {
    id: effect.id,
    label: effect.label,
    text: effect.text ?? "",
    costText: effect.costText ?? "",
    interactionNotes: effect.interactionNotes ?? [],
    interruptibleBy: effect.interruptibleBy ?? [],
    blocksHandTraps: effect.blocksHandTraps ?? [],
    usageLimit: effect.usageLimit ?? "NONE",
    turnRestriction: effect.turnRestriction ?? "",
    effectType: effect.effectType ?? "ACTIVATED",
    sourceZone: effect.sourceZone ?? "MONSTER_ZONE",
    allowedTurns,
    allowedPhases,
    timingDetails: effect.timingDetails ?? "",
    canBeGranted: effect.canBeGranted ?? false,
    grantDetails: effect.grantDetails ?? "",
    activationTags: effect.activationTags ?? [],
    applicationTags: effect.applicationTags ?? [],
    operationTags: effect.operationTags ?? [],
    grantMode: effect.grantMode ?? "GENERIC",
    grantedProfile,
  };
}

function normalizeCard(card: Card): Card {
  const normalizeStat = (value: CardStat) =>
    value === "?"
      ? "?"
      : typeof value === "number" && Number.isFinite(value)
        ? value
        : 0;
  return {
    ...card,
    ruleText: card.ruleText ?? "",
    monsterType:
      card.kind === "MONSTER" ? (card.monsterType ?? "EFFECT") : null,
    levelRankLink: card.kind === "MONSTER" ? (card.levelRankLink ?? 4) : null,
    attack: card.kind === "MONSTER" ? normalizeStat(card.attack) : null,
    defense:
      card.kind === "MONSTER" && card.monsterType !== "LINK"
        ? normalizeStat(card.defense)
        : null,
    effects: card.effects.map(normalizeCardEffect),
  };
}

function catalogMonsterType(card: CatalogCard): MonsterType {
  const typeLine = card.y ?? "";
  if (typeLine.includes("Link")) return "LINK";
  if (typeLine.includes("Xyz")) return "XYZ";
  if (typeLine.includes("Synchro")) return "SYNCHRO";
  if (typeLine.includes("Fusion")) return "FUSION";
  if (typeLine.includes("Ritual")) return "RITUAL";
  if (typeLine.includes("Token")) return "TOKEN";
  if (typeLine.includes("Pendulum")) return "PENDULUM";
  if (typeLine.includes("Normal") && !typeLine.includes("Effect"))
    return "NORMAL";
  return "EFFECT";
}

function catalogCardKind(card: CatalogCard): Card["kind"] {
  if (card.c === "Spell") return "SPELL";
  if (card.c === "Trap") return "TRAP";
  return "MONSTER";
}

function catalogTypeSummary(card: CatalogCard) {
  if (card.c === "Spell") return `${card.r ?? "Normal"} 마법`;
  if (card.c === "Trap") return `${card.r ?? "Normal"} 함정`;
  const monsterType = catalogMonsterType(card);
  const value =
    monsterType === "XYZ"
      ? `랭크 ${card.v ?? "-"}`
      : monsterType === "LINK"
        ? `링크 ${card.v ?? "-"}`
        : `레벨 ${card.v ?? "-"}`;
  return `${MONSTER_TYPE_LABEL[monsterType]} · ${value}`;
}

const NUMBERED_EFFECT_MARKER = /([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*[:：]/g;

function splitCatalogEffectText(text: string) {
  const matches = [...text.matchAll(NUMBERED_EFFECT_MARKER)];
  if (!matches.length) {
    return {
      commonText: "",
      effects: text.trim() ? [{ marker: "", text: text.trim() }] : [],
    };
  }
  const commonText = text.slice(0, matches[0].index ?? 0).trim();
  return {
    commonText,
    effects: matches.map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? text.length;
      return {
        marker: match[1],
        text: text.slice(start, end).trim(),
      };
    }),
  };
}

function splitCatalogActivationText(text: string) {
  const divider = /(?:발동할 수 있다|발동한다)\s*[.。]/.exec(text);
  if (!divider || divider.index === undefined) {
    return { activationText: "", operationText: text, costText: "" };
  }
  const activationText = text.slice(0, divider.index).trim();
  const operationText = text
    .slice(divider.index + divider[0].length)
    .trim();
  const costText = activationText
    .split(/,\s*/)
    .filter((clause) =>
      /(?:버리|릴리스|제외하고|지불|묘지로 보내고|엑시즈 소재[^.。]*제거하고|패에서[^.。]*보여주고|공개하고)/.test(
        clause,
      ),
    )
    .map((clause) => clause.replace(/^자신 메인 페이즈에\s*/, "").trim())
    .join(", ");
  return {
    activationText,
    operationText: operationText || text,
    costText,
  };
}

function inferCatalogEffect(
  text: string,
  commonText: string,
  marker: string,
  kind: Card["kind"],
  continuousContainer: boolean,
  defaultSourceZone: EffectSourceZone,
  availableHandTrapIds: Set<string>,
): Partial<CardEffect> {
  const fullText = `${commonText} ${text}`.trim();
  const { activationText, operationText, costText } =
    splitCatalogActivationText(text);
  const operations = new Set<EffectOperationTag>();
  const activations = new Set<EffectActivationTag>();
  const applications = new Set<EffectApplicationTag>();

  if (/덱[^.。]*(?:패에 넣|패로 넣|가져온)/.test(operationText))
    operations.add("SEARCH");
  if (/드로우/.test(operationText)) operations.add("DRAW");
  if (/덱[^.。]*묘지로 보내/.test(operationText))
    operations.add("SEND_DECK_TO_GY");
  if (/특수 소환/.test(operationText)) operations.add("SPECIAL_SUMMON");
  if (/일반 소환/.test(operationText)) operations.add("NORMAL_SUMMON");
  if (/파괴(?!되|된|되어|되었)/.test(operationText)) operations.add("DESTROY");
  if (/제외/.test(operationText)) operations.add("BANISH");
  if (/묘지로 보내(?!진|졌)/.test(operationText)) operations.add("SEND_GY");
  if (/패(?:로|에) 되돌/.test(operationText)) operations.add("RETURN_HAND");
  if (/덱[^.。]*(?:되돌|돌려놓)/.test(operationText)) operations.add("RETURN_DECK");
  if (/발동을 무효/.test(operationText)) operations.add("NEGATE_ACTIVATION");
  if (/효과(?:를|는)[^.。]*무효/.test(operationText)) operations.add("NEGATE_EFFECT");
  if (/(?:공격력|수비력)[^.。]*(?:올리|올린|내리|내린|된다|한다|변경)/.test(operationText))
    operations.add("CHANGE_ATK_DEF");
  if (/(?:레벨|랭크)[^.。]*(?:된다|한다|변경)/.test(operationText))
    operations.add("CHANGE_LEVEL_RANK");
  if (/(?:종족|속성)[^.。]*(?:된다|한다|변경)/.test(operationText))
    operations.add("CHANGE_TYPE_ATTRIBUTE");
  if (/엑시즈 소재로 (?:한다|하고|하여)/.test(operationText))
    operations.add("ATTACH_XYZ");
  if (/엑시즈 소재[^.。]*제거/.test(operationText)) operations.add("DETACH_XYZ");
  if (/효과를 (?:얻는다|부여)/.test(operationText)) operations.add("GRANT_EFFECT");
  if (/컨트롤을 얻/.test(operationText)) operations.add("TAKE_CONTROL");
  if (/(?:밖에 )?(?:일반 소환|특수 소환|소환)[^.。]*할 수 없다/.test(operationText))
    operations.add("SUMMON_LOCK");
  if (/(?:상대|서로|플레이어|몬스터|카드)[^.。]*효과[^.。]*발동할 수 없다/.test(operationText))
    operations.add("EFFECT_LOCK");

  let sourceZone = defaultSourceZone;
  if (/(?:패의 이 카드|이 카드가 패에 존재|이 카드를 패에서[^.。]*특수 소환)/.test(text))
    sourceZone = "HAND";
  else if (/(?:묘지의 이 카드|이 카드가 묘지에 존재)/.test(text))
    sourceZone = "GRAVEYARD";
  else if (/(?:제외 상태인 이 카드|제외되어 있는 이 카드)/.test(text))
    sourceZone = "BANISHED";

  if (/일반 소환[^.。]*(?:성공|했을 경우|되었을 경우)/.test(text))
    activations.add("ON_NORMAL_SUMMON");
  if (/특수 소환[^.。]*(?:성공|했을 경우|되었을 경우)/.test(text))
    activations.add("ON_SPECIAL_SUMMON");
  if (/(?:리버스|반전 소환)/.test(text)) activations.add("ON_FLIP");
  if (/(?:공격 선언|전투를 실행|전투로)/.test(text))
    activations.add("ON_ATTACK");
  if (/데미지/.test(text)) activations.add("ON_DAMAGE");
  if (/묘지로 보내졌을 경우/.test(text)) activations.add("ON_SENT_GY");
  if (/제외되었을 경우/.test(text)) activations.add("ON_BANISHED");
  if (/엑시즈 소재[^.。]*제거[^.。]*(?:경우|때)/.test(text))
    activations.add("ON_DETACH_XYZ");
  if (/상대[^.。]*몬스터의 효과[^.。]*발동(?:했을 때|했을 경우|할 때|에 체인)/.test(text))
    activations.add("ON_MONSTER_EFFECT");
  else if (/상대[^.。]*(?:카드|효과)[^.。]*발동(?:했을 때|했을 경우|할 때|에 체인)/.test(text))
    activations.add("ON_CARD_EFFECT");
  if (/(?:상대 턴에도 발동|퀵 이펙트)/.test(text)) activations.add("QUICK");
  if (/자신 메인 페이즈[^.。]*발동할 수 있다/.test(text))
    activations.add("IGNITION");
  if (/(?:경우|때)[^．.。]*발동(?:할 수 있다|한다)/.test(text))
    activations.add("TRIGGER");

  if (/(?:대상으로 하고|대상으로 하여) 발동/.test(text))
    applications.add("TARGET_REQUIRED");
  if (/자신/.test(text)) applications.add("SELF");
  if (/상대(?: 필드|의 (?:패|필드|덱|묘지)|에게| 몬스터| 카드)/.test(text))
    applications.add("OPPONENT");
  if (/몬스터/.test(text)) applications.add("MONSTER");
  if (/(?:마법\s*[&/·]\s*함정|마법 또는 함정)/.test(text))
    applications.add("SPELL_TRAP");
  if (/엑스트라 덱에서 특수 소환된 몬스터/.test(text))
    applications.add("EXTRA_DECK_MONSTER");
  if (sourceZone === "GRAVEYARD") applications.add("WHILE_IN_GY");
  if (sourceZone === "BANISHED") applications.add("WHILE_BANISHED");
  if (/앞면 표시로 존재하는 한/.test(text)) applications.add("WHILE_FACE_UP");
  if (/엑시즈 소재로 되어 있는 동안/.test(text))
    applications.add("WHILE_XYZ_MATERIAL");

  let usageLimit: EffectUsageLimit = "NONE";
  const commonLimitSentence = commonText
    .split(/[.。]/)
    .find(
      (sentence) =>
        /(?:1턴에 1번|듀얼 중에 1번)/.test(sentence) &&
        (!/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(sentence) ||
          Boolean(marker && sentence.includes(marker))),
    );
  const appliesCardActivationLimit =
    /1턴에 1장밖에 발동할 수 없(?:다|으며)/.test(commonText) &&
    (/발동시의 효과 처리/.test(text) || marker === "①");
  if (/듀얼 중에 1번/.test(text) || /듀얼 중에 1번/.test(commonLimitSentence ?? ""))
    usageLimit = "ONCE_PER_DUEL";
  else if (
    /이 카드명의[^.。]*1턴에 1번/.test(text) ||
    Boolean(commonLimitSentence) ||
    appliesCardActivationLimit ||
    /1턴에 1장밖에 발동할 수 없(?:다|으며)/.test(text)
  )
    usageLimit = "HARD_ONCE_PER_TURN";
  else if (/1턴에 1번/.test(text)) usageLimit = "ONCE_PER_TURN";
  else if (/동일 체인 위에서는 1번/.test(fullText)) usageLimit = "ONCE_PER_CHAIN";

  const mentionsOpponentTurn =
    /상대(?: 턴| 메인 페이즈|의 (?:드로우|스탠바이|메인|배틀|엔드) 페이즈)/.test(text);
  const mentionsSelfTurn =
    /자신(?: 턴| 메인 페이즈|의 (?:드로우|스탠바이|메인|배틀|엔드) 페이즈)/.test(text);
  const allowedTurns: TurnOwner[] =
    mentionsOpponentTurn && !mentionsSelfTurn
      ? ["OPPONENT"]
      : mentionsSelfTurn && !mentionsOpponentTurn
        ? ["SELF"]
        : [...SELF_OR_OPPONENT];
  const allowedPhases = new Set<DuelPhase>();
  if (/드로우 페이즈/.test(text)) allowedPhases.add("DRAW");
  if (/스탠바이 페이즈/.test(text)) allowedPhases.add("STANDBY");
  if (/메인 페이즈 1/.test(text)) allowedPhases.add("MAIN1");
  if (/메인 페이즈 2/.test(text)) allowedPhases.add("MAIN2");
  if (/메인 페이즈/.test(text) && !allowedPhases.has("MAIN1") && !allowedPhases.has("MAIN2")) {
    allowedPhases.add("MAIN1");
    allowedPhases.add("MAIN2");
  }
  if (/배틀 페이즈/.test(text)) allowedPhases.add("BATTLE");
  if (/엔드 페이즈/.test(text)) allowedPhases.add("END");

  const effectType: CardEffectType =
    ((continuousContainer &&
      !/(?:발동할 수 있다|발동한다|발동시의 효과 처리)/.test(text)) ||
      /(?:앞면 표시로 존재하는 한|동안 적용|계속 적용)/.test(text) ||
      (sourceZone === "HAND" &&
        /특수 소환할 수 있다/.test(text) &&
        !/발동할 수 있다/.test(text))) &&
    !/발동할 수 있다/.test(text)
      ? "CONTINUOUS"
      : "ACTIVATED";
  const interruptibleBy = new Set<string>();
  const addInterrupt = (id: string) => {
    if (availableHandTrapIds.has(id)) interruptibleBy.add(id);
  };
  if (
    /덱[^.。]*(?:패에 넣|특수 소환|묘지로 보내)/.test(operationText) ||
    operations.has("DRAW")
  ) {
    addInterrupt(ASH_ID);
    if (operations.has("SEARCH") || operations.has("DRAW"))
      addInterrupt("builtin-dominus-purge");
    if (operations.has("SPECIAL_SUMMON")) addInterrupt("builtin-dominus-impulse");
  }
  const graveyardEffectScope = `${activationText} ${operationText}`;
  if (
    /묘지(?:의|에서)[^.。]*(?:패|덱|엑스트라 덱)[^.。]*(?:넣|되돌)/.test(
      graveyardEffectScope,
    ) ||
    /묘지(?:의|에서)[^.。]*특수 소환/.test(graveyardEffectScope) ||
    /묘지(?:의|에서)[^.。]*제외/.test(operationText)
  )
    addInterrupt("builtin-ghost-belle");
  if (sourceZone === "GRAVEYARD" && effectType === "ACTIVATED")
    addInterrupt("builtin-skull-meister");
  if (
    kind === "MONSTER" &&
    sourceZone === "MONSTER_ZONE" &&
    effectType === "ACTIVATED"
  ) {
    addInterrupt("builtin-infinite-impermanence");
    addInterrupt("builtin-effect-veiler");
  }

  const interactionNotes: string[] = [];
  if (operations.has("SEARCH") || operations.has("DRAW"))
    interactionNotes.push(
      "드롤 & 로크 버드 · 드로우 페이즈 이외에 덱→패 처리가 끝난 뒤 발동하며, 현재 효과가 아니라 이후 덱→패 이동을 막는 후속 간섭 후보",
    );
  if (/제외/.test(costText) || operations.has("BANISH"))
    interactionNotes.push(
      "아티팩트－롱기누스 · 상대 턴에 미리 적용되면 제외 처리 또는 제외 코스트를 막는 사전 간섭 후보",
    );
  if (operations.has("SEND_GY") || operations.has("SEND_DECK_TO_GY"))
    interactionNotes.push(
      "디멘션 어트랙터 · 이미 적용 중이면 묘지로 갈 카드를 제외로 바꾸는 잔존형 간섭 후보",
    );
  if (operations.has("SPECIAL_SUMMON")) {
    interactionNotes.push(
      "증식의 G · 이미 적용 중이면 이 특수 소환 처리 후 상대에게 드로우를 주는 잔존형 간섭 후보",
      "원시생명체 니비루 · 이 소환으로 메인 페이즈 누적 일반/특수 소환 수가 5장 이상이면 처리 후 발동 가능한 후보",
    );
  }

  return {
    costText,
    interactionNotes,
    effectType,
    sourceZone,
    usageLimit,
    allowedTurns,
    allowedPhases: allowedPhases.size ? [...allowedPhases] : [...ALL_PHASES],
    timingDetails: "카드 텍스트의 명시 문구를 기준으로 자동 분류됨 · 검토 필요",
    activationTags: [...activations],
    applicationTags: [...applications],
    operationTags: [...operations],
    interruptibleBy: [...interruptibleBy],
  };
}

function applyDetailedCatalogEffectAudit(
  cardId: number,
  scope: "pendulum" | "main",
  index: number,
  effect: CardEffect,
  availableHandTrapIds?: Set<string>,
) {
  const audit = DETAILED_CATALOG_EFFECT_AUDITS.get(
    `${cardId}-${scope}-${index + 1}`,
  );
  if (!audit) return effect;
  return normalizeCardEffect({
    ...effect,
    ...audit,
    interruptibleBy: availableHandTrapIds
      ? audit.interruptibleBy.filter((id) => availableHandTrapIds.has(id))
      : audit.interruptibleBy,
  });
}

function catalogInteractionCardId(card: CatalogCard) {
  return `${card.i}:${card.p ?? "null"}`;
}

function applyCatalogHandTrapInteractions(
  card: CatalogCard,
  effects: CardEffect[],
  interactions: CatalogHandTrapInteractions | null,
  availableHandTrapIds: Set<string>,
) {
  const cardInteractions = interactions?.cards[catalogInteractionCardId(card)];
  if (!cardInteractions) return effects;
  return effects.map((effect) => {
    const match = /-(pendulum|main)-(\d+)$/.exec(effect.id);
    if (!match) return effect;
    const scope = match[1];
    const index = Number(match[2]);
    const interaction = cardInteractions.effects[`${scope}/${index}`];
    if (!interaction) return effect;
    const hasDetailedAudit = DETAILED_CATALOG_EFFECT_AUDITS.has(
      `${card.i}-${scope}-${index}`,
    );
    return normalizeCardEffect({
      ...effect,
      interruptibleBy: (
        hasDetailedAudit
          ? effect.interruptibleBy
          : interaction.interruptibleBy
      ).filter((id) => availableHandTrapIds.has(id)),
      blocksHandTraps: interaction.blocksHandTraps.filter((id) =>
        availableHandTrapIds.has(id),
      ),
      interactionNotes: [
        ...effect.interactionNotes,
        ...interaction.interactionNotes,
        ...(interaction.needsReview ? [interaction.note] : []),
      ],
    });
  });
}

function catalogToLibraryCard(
  card: CatalogCard,
  handTraps: HandTrap[],
  interactions: CatalogHandTrapInteractions | null = null,
): Card {
  const kind = catalogCardKind(card);
  const monsterType = kind === "MONSTER" ? catalogMonsterType(card) : null;
  const review = catalogReviewFor(card.i);
  const details = [
    card.y ? `공식 분류: ${card.y}` : "",
    card.a ? `속성: ${card.a}` : "",
    card.m ? `소환 소재: ${card.m}` : "",
    card.g.length ? `링크 마커: ${card.g.join(", ")}` : "",
  ].filter(Boolean);
  const hasMainEffect =
    kind !== "MONSTER" ||
    Boolean(card.y?.includes("Effect"));
  if (!hasMainEffect && card.t) details.push(card.t);

  const sourceZone: EffectSourceZone =
    kind === "MONSTER" ? "MONSTER_ZONE" : "SPELL_TRAP_ZONE";
  const effects: CardEffect[] = [];
  const availableHandTrapIds = new Set(handTraps.map((trap) => trap.id));
  if (card.e) {
    const split = splitCatalogEffectText(card.e);
    if (split.commonText) details.push(`펜듈럼 공통 제한: ${split.commonText}`);
    split.effects.forEach((effect, index) => {
      effects.push(
        applyDetailedCatalogEffectAudit(
          card.i,
          "pendulum",
          index,
          normalizeCardEffect({
            id: `catalog-effect-${card.i}-pendulum-${index + 1}`,
            label: effect.marker ? `펜듈럼 ${effect.marker} 효과` : "펜듈럼 효과",
            text: effect.text,
            ...inferCatalogEffect(
              effect.text,
              split.commonText,
              effect.marker,
              kind,
              card.r === "Continuous" || card.r === "Equip",
              "SPELL_TRAP_ZONE",
              availableHandTrapIds,
            ),
          }),
          availableHandTrapIds,
        ),
      );
    });
  }
  if (hasMainEffect && card.t) {
    const split = splitCatalogEffectText(card.t);
    if (split.commonText) details.push(`공통 효과 제한: ${split.commonText}`);
    split.effects.forEach((effect, index) => {
      effects.push(
        applyDetailedCatalogEffectAudit(
          card.i,
          "main",
          index,
          normalizeCardEffect({
            id: `catalog-effect-${card.i}-main-${index + 1}`,
            label: effect.marker ? `${effect.marker} 효과` : "공식 카드 효과",
            text: effect.text,
            ...inferCatalogEffect(
              effect.text,
              split.commonText,
              effect.marker,
              kind,
              card.r === "Continuous" || card.r === "Equip",
              sourceZone,
              availableHandTrapIds,
            ),
          }),
          availableHandTrapIds,
        ),
      );
    });
  }
  if (effects.length)
    details.push("자동 분류: 번호별 효과 분리 및 명시 문구 기반 태그 제안 (검토 필요)");
  if (review) {
    details.push(
      review.status === "VERIFIED"
        ? `분류 상태: 공식 DB·Q&A 정밀 검수 · ${review.note}`
        : review.status === "DRAFT"
          ? `분류 상태: 1차 자동 초안 · ${review.note}`
          : review.status === "NO_EFFECT"
            ? `분류 상태: 효과 없음 확인 · ${review.note}`
            : `분류 상태: 자동 초안 보류 · ${review.note}`,
    );
  }

  const registeredEffects = applyCatalogHandTrapInteractions(
    card,
    effects,
    interactions,
    availableHandTrapIds,
  );
  const reviewTiming =
    review?.status === "VERIFIED"
      ? "공식 DB·Q&A 정밀 검수"
      : review?.status === "DRAFT"
        ? "1차 자동 초안 · 정밀 재검수 필요"
        : review?.status === "HOLD"
          ? `자동 분류 초안 · 보류: ${review.note}`
          : null;

  return normalizeCard({
    id: `catalog-card-${card.i}`,
    name: card.n,
    kind,
    monsterType,
    levelRankLink: kind === "MONSTER" ? (card.v ?? 0) : null,
    attack: kind === "MONSTER" ? (card.k ?? "?") : null,
    defense:
      kind === "MONSTER" && monsterType !== "LINK" ? (card.d ?? "?") : null,
    ruleText: details.join("\n"),
    effects: reviewTiming
      ? registeredEffects.map((effect) => ({
          ...effect,
          timingDetails: [effect.timingDetails, reviewTiming]
            .filter(Boolean)
            .join(" · "),
        }))
      : registeredEffects,
  });
}

function parseCardStat(value: string): number | "?" {
  return value.trim() === "?" ? "?" : Number(value);
}

function migrateDetailedCatalogReviewCards(cards: Card[], previousVersion: number) {
  if (previousVersion >= 19) return cards;
  return cards.map((card) => {
    if (card.id !== "catalog-card-19196") return card;
    const review = DETAILED_CATALOG_REVIEWS.get(19196);
    const reviewLine = review
      ? `분류 상태: 공식 DB·Q&A 정밀 검수 · ${review.note}`
      : "";
    const ruleText = /(?:분류 검수|분류 상태):[^\n]*/.test(card.ruleText)
      ? card.ruleText.replace(/(?:분류 검수|분류 상태):[^\n]*/, reviewLine)
      : [card.ruleText, reviewLine].filter(Boolean).join("\n");
    return {
      ...card,
      ruleText,
      effects: card.effects.map((effect) => {
        const effectNumber = /-main-(\d+)$/.exec(effect.id)?.[1];
        return effectNumber
          ? applyDetailedCatalogEffectAudit(
              19196,
              "main",
              Number(effectNumber) - 1,
              effect,
            )
          : effect;
      }),
    };
  });
}

function isValidCardStat(value: string) {
  return value.trim() === "?" || /^\d+$/.test(value.trim());
}

function normalizeCombo(combo: Combo): Combo {
  const legacyGoals = (combo.goalField ?? []).map((goal) => ({
    id: goal.id,
    kind: "CARD_LOCATION" as const,
    cardId: goal.cardId,
    location: goal.zone as CardLocation,
    quantity: goal.quantity,
    owner: "SELF" as const,
  }));
  let legacySummonIndex = 0;
  const steps = combo.steps.map((step) => {
    const legacyZone =
      MAIN_MONSTER_ZONES[
        Math.min(legacySummonIndex, MAIN_MONSTER_ZONES.length - 1)
      ];
    if ((step.actionType ?? "EFFECT") === "SUMMON") legacySummonIndex += 1;
    const legacyEvents = step.zoneEvents ?? [];
    const normalizeEvent = (event: ZoneEvent, timing: ZoneEvent["timing"]) => {
      const zone = event.zone ?? "MONSTER_ZONE";
      return {
        ...event,
        zone,
        owner: event.owner ?? "SELF",
        xyzHostZone:
          zone === "XYZ_MATERIAL"
            ? (event.xyzHostZone ?? step.summonZone ?? legacyZone)
            : event.xyzHostZone,
        quantity: event.quantity ?? 1,
        destination: event.destination,
        timing,
      };
    };
    return {
      ...step,
      costEvents:
        step.costEvents?.map((event) => normalizeEvent(event, "BEFORE")) ??
        legacyEvents
          .filter((event) => event.timing === "BEFORE")
          .map((event) => normalizeEvent(event, "BEFORE")),
      permissionEvents: step.permissionEvents ?? [],
      zoneEvents: legacyEvents
        .filter((event) => event.timing !== "BEFORE")
        .map((event) => normalizeEvent(event, "AFTER")),
      actingCardId: step.actingCardId ?? "",
      effectGrantEvents: step.effectGrantEvents ?? [],
      turnOwner: step.turnOwner ?? "SELF",
      phase: step.phase ?? "MAIN1",
      actionType: step.actionType ?? "EFFECT",
      effectExecutionMode: step.effectExecutionMode ?? "IMMEDIATE",
      chainId: step.chainId ?? `chain-${step.id}`,
      chainLabel: step.chainLabel ?? "체인 1",
      summonedCardId: step.summonedCardId ?? "",
      summonType: step.summonType ?? "NORMAL",
      summonFrom:
        step.summonFrom ??
        ((step.summonType ?? "NORMAL") === "NORMAL"
          ? "HAND"
          : ["FUSION", "SYNCHRO", "XYZ", "LINK"].includes(
                step.summonType ?? "NORMAL",
              )
            ? "EXTRA_DECK"
            : "HAND"),
      summonCount: Math.max(1, step.summonCount ?? 1),
      summonZone: step.summonZone ?? legacyZone,
      summonInterruptibleBy: step.summonInterruptibleBy ?? [],
      materials: (step.materials ?? []).map((material) => ({
        ...material,
        xyzHostZone:
          material.xyzHostZone ?? step.summonZone ?? legacyZone,
        quantity: material.quantity ?? 1,
      })),
      opponentLpChange: step.opponentLpChange ?? 0,
      declaresSpecialWin: step.declaresSpecialWin ?? false,
      specialWinText: step.specialWinText ?? "",
    };
  });
  return {
    ...combo,
    deckId: combo.deckId ?? "",
    startingHand: combo.startingHand ?? [],
    goals: (combo.goals ?? legacyGoals).map((goal) =>
      goal.kind === "CARD_LOCATION"
        ? { ...goal, owner: goal.owner ?? "SELF" }
        : goal,
    ),
    opponentStartingLp: combo.opponentStartingLp ?? 8000,
    opponentStartingHandSize: combo.opponentStartingHandSize ?? 5,
    branches: combo.branches ?? [],
    handTrapPlans: (combo.handTrapPlans ?? []).map((plan) => ({
      ...plan,
      strategy: plan.strategy ?? "AUTO",
      maxOpponentDraws: Math.max(0, plan.maxOpponentDraws ?? 0),
      maxAffectedSteps: Math.max(0, plan.maxAffectedSteps ?? 0),
      maxResolvedOperations: Math.max(
        0,
        plan.maxResolvedOperations ?? 99,
      ),
      notes: plan.notes ?? "",
    })),
    steps,
  };
}

function normalizeDeck(deck: Deck, cards: Card[]): Deck {
  const legacy = deck as Deck & {
    pending?: string[];
    builtIn?: boolean;
    entries: Array<DeckEntry & { cardName?: string }>;
  };
  const legacyEntries = legacy.entries as Array<
    DeckEntry & { cardName?: string }
  >;
  return {
    id: deck.id,
    name: deck.name,
    description: deck.description ?? "",
    entries: (legacyEntries ?? []).flatMap((entry) => {
      const cardId =
        entry.cardId || cards.find((card) => card.name === entry.cardName)?.id;
      return cardId
        ? [
            {
              id: entry.id ?? uid(),
              cardId,
              quantity: Math.max(1, Math.min(3, entry.quantity ?? 1)),
              section: entry.section ?? "MAIN",
            },
          ]
        : [];
    }),
  };
}

function deckQuantityMap(deck?: Deck) {
  const map = new Map<string, number>();
  deck?.entries.forEach((entry) =>
    map.set(entry.cardId, (map.get(entry.cardId) ?? 0) + entry.quantity),
  );
  return map;
}

function comboDeckErrors(combo: Combo, deck: Deck | undefined, cards: Card[]) {
  if (!deck) return ["연결된 덱이 없습니다."];
  const limits = deckQuantityMap(deck);
  const errors = new Set<string>();
  const check = (cardId: string, quantity = 1) => {
    if (!cardId) return;
    const name =
      cards.find((card) => card.id === cardId)?.name ?? "삭제된 카드";
    const limit = limits.get(cardId) ?? 0;
    if (!limit) errors.add(`${name}: 선택한 덱에 없음`);
    else if (quantity > limit)
      errors.add(`${name}: 덱 ${limit}장보다 ${quantity}장을 사용`);
  };
  combo.startingHand.forEach((entry) => check(entry.cardId, entry.quantity));
  combo.goals.forEach(
    (goal) =>
      goal.kind === "CARD_LOCATION" &&
      goal.owner !== "OPPONENT" &&
      check(goal.cardId, goal.quantity),
  );
  combo.steps.forEach((step) => {
    if (step.actionType === "SUMMON") check(step.summonedCardId);
    if (step.actionType === "EFFECT")
      check(
        step.actingCardId ||
          cards.find((card) =>
            card.effects.some((effect) => effect.id === step.effectId),
          )?.id ||
          "",
      );
    step.costEvents.forEach(
      (event) => event.owner !== "OPPONENT" && check(event.cardId, event.quantity),
    );
    step.zoneEvents.forEach(
      (event) => event.owner !== "OPPONENT" && check(event.cardId, event.quantity),
    );
    step.materials.forEach((material) =>
      check(material.cardId, material.quantity),
    );
    step.effectGrantEvents.forEach((event) => check(event.targetCardId));
  });
  const handTotals = new Map<string, number>();
  combo.startingHand.forEach((entry) =>
    handTotals.set(
      entry.cardId,
      (handTotals.get(entry.cardId) ?? 0) + entry.quantity,
    ),
  );
  handTotals.forEach((quantity, cardId) => check(cardId, quantity));
  return [...errors];
}

type PendingChainLink = { step: ComboStep; negated: boolean };
type PlayerBoardState = {
  cards: Map<string, number>;
  monsterZones: Map<MonsterZoneSlot, string>;
  xyzMaterials: Map<MonsterZoneSlot, Map<string, number>>;
};
type DuelState = {
  boards: Record<PlayerSide, PlayerBoardState>;
  pendingChains: Map<string, PendingChainLink[]>;
  violations: string[];
  opponentLP: number;
  specialWin: boolean;
  specialWinText: string;
};

function fieldKey(cardId: string, zone: CardLocation) {
  return `${zone}:${cardId}`;
}

function emptyPlayerBoard(): PlayerBoardState {
  return {
    cards: new Map(),
    monsterZones: new Map(),
    xyzMaterials: new Map(),
  };
}

function clonePlayerBoard(board: PlayerBoardState): PlayerBoardState {
  return {
    cards: new Map(board.cards),
    monsterZones: new Map(board.monsterZones),
    xyzMaterials: new Map(
      [...board.xyzMaterials].map(([slot, materials]) => [
        slot,
        new Map(materials),
      ]),
    ),
  };
}

function cloneDuelState(state: DuelState): DuelState {
  return {
    ...state,
    boards: {
      SELF: clonePlayerBoard(state.boards.SELF),
      OPPONENT: clonePlayerBoard(state.boards.OPPONENT),
    },
    pendingChains: new Map(
      [...state.pendingChains].map(([id, links]) => [
        id,
        links.map((link) => ({ ...link })),
      ]),
    ),
    violations: [...state.violations],
  };
}

function initialDuelState(combo: Combo): DuelState {
  const state: DuelState = {
    boards: { SELF: emptyPlayerBoard(), OPPONENT: emptyPlayerBoard() },
    pendingChains: new Map(),
    violations: [],
    opponentLP: combo.opponentStartingLp,
    specialWin: false,
    specialWinText: "",
  };
  combo.startingHand.forEach((entry) => {
    const key = fieldKey(entry.cardId, "HAND");
    const cards = state.boards.SELF.cards;
    cards.set(key, (cards.get(key) ?? 0) + entry.quantity);
  });
  if (combo.opponentStartingHandSize > 0) {
    state.boards.OPPONENT.cards.set(
      fieldKey(UNKNOWN_OPPONENT_CARD_ID, "HAND"),
      combo.opponentStartingHandSize,
    );
  }
  return state;
}

function adjustCardCount(
  state: DuelState,
  owner: PlayerSide,
  cardId: string,
  zone: CardLocation,
  delta: number,
) {
  const key = fieldKey(cardId, zone);
  const cards = state.boards[owner].cards;
  const next = (cards.get(key) ?? 0) + delta;
  if (next > 0) cards.set(key, next);
  else cards.delete(key);
}

function releaseXyzMaterials(
  state: DuelState,
  owner: PlayerSide,
  slot: MonsterZoneSlot,
) {
  const board = state.boards[owner];
  const materials = board.xyzMaterials.get(slot);
  if (!materials) return;
  materials.forEach((quantity, cardId) => {
    adjustCardCount(state, owner, cardId, "XYZ_MATERIAL", -quantity);
    adjustCardCount(state, owner, cardId, "GRAVEYARD", quantity);
  });
  board.xyzMaterials.delete(slot);
}

function applyFieldEvent(
  state: DuelState,
  event: ZoneEvent,
  allowEmptyXyzHost = false,
) {
  const owner = event.owner ?? "SELF";
  const board = state.boards[owner];
  const isMonsterSlotOccupied = (slot: MonsterZoneSlot) =>
    slot.startsWith("EXTRA_")
      ? state.boards.SELF.monsterZones.has(slot) ||
        state.boards.OPPONENT.monsterZones.has(slot)
      : board.monsterZones.has(slot);
  const key = fieldKey(event.cardId, event.zone);
  for (let count = 0; count < event.quantity; count += 1) {
    if (event.zone === "XYZ_MATERIAL") {
      const hostSlot = event.xyzHostZone;
      if (!hostSlot) {
        state.violations.push("엑시즈 소재를 붙일 몬스터 존이 지정되지 않았습니다.");
        continue;
      }
      if (
        event.action === "SUMMON" &&
        !allowEmptyXyzHost &&
        !board.monsterZones.has(hostSlot)
      ) {
        state.violations.push(
          `${MONSTER_ZONE_LABEL[hostSlot]}에 엑시즈 소재를 받을 몬스터가 없습니다.`,
        );
        continue;
      }
      const materials = new Map(board.xyzMaterials.get(hostSlot) ?? []);
      const current = materials.get(event.cardId) ?? 0;
      if (event.action === "LEAVE" && current <= 0) {
        state.violations.push(
          `${MONSTER_ZONE_LABEL[hostSlot]}의 엑시즈 소재에 해당 카드가 없습니다.`,
        );
        continue;
      }
      const next = current + (event.action === "SUMMON" ? 1 : -1);
      if (next > 0) materials.set(event.cardId, next);
      else materials.delete(event.cardId);
      if (materials.size) board.xyzMaterials.set(hostSlot, materials);
      else board.xyzMaterials.delete(hostSlot);
      adjustCardCount(
        state,
        owner,
        event.cardId,
        "XYZ_MATERIAL",
        event.action === "SUMMON" ? 1 : -1,
      );
      continue;
    }
    if (event.action === "LEAVE" && (board.cards.get(key) ?? 0) <= 0) {
      const cardName =
        event.cardId === UNKNOWN_OPPONENT_CARD_ID
          ? "임의 카드"
          : "해당 카드";
      state.violations.push(
        `${PLAYER_SIDE_LABEL[owner]} ${LOCATION_LABEL[event.zone]}에 ${cardName}가 없습니다.`,
      );
      continue;
    }
    if (event.zone === "MONSTER_ZONE") {
      if (event.action === "SUMMON") {
        const slot =
          event.monsterZone ??
          [...MAIN_MONSTER_ZONES, ...EXTRA_MONSTER_ZONES].find(
            (candidate) => !isMonsterSlotOccupied(candidate),
          );
        if (!slot) {
          state.violations.push("사용 가능한 몬스터 존이 없습니다.");
          continue;
        }
        if (isMonsterSlotOccupied(slot)) {
          state.violations.push(
            `${MONSTER_ZONE_LABEL[slot]}에 이미 카드가 있습니다.`,
          );
          continue;
        }
        board.monsterZones.set(slot, event.cardId);
      } else {
        const slot =
          event.monsterZone &&
          board.monsterZones.get(event.monsterZone) === event.cardId
            ? event.monsterZone
            : [...board.monsterZones.entries()].find(
                ([, cardId]) => cardId === event.cardId,
              )?.[0];
        if (slot) {
          releaseXyzMaterials(state, owner, slot);
          board.monsterZones.delete(slot);
        }
      }
    }
    const next =
      (board.cards.get(key) ?? 0) + (event.action === "SUMMON" ? 1 : -1);
    if (next > 0) board.cards.set(key, next);
    else board.cards.delete(key);
  }
}

function applySummonMaterial(
  state: DuelState,
  material: SummonMaterial,
  summonedHostZone: MonsterZoneSlot,
) {
  applyFieldEvent(state, {
    id: material.id,
    cardId: material.cardId,
    zone: material.from,
    xyzHostZone: material.xyzHostZone,
    owner: "SELF",
    action: "LEAVE",
    timing: "BEFORE",
    quantity: material.quantity,
  });
  applyFieldEvent(
    state,
    {
      id: material.id,
      cardId: material.cardId,
      zone: material.destination,
      xyzHostZone:
        material.destination === "XYZ_MATERIAL"
          ? summonedHostZone
          : material.xyzHostZone,
      owner: "SELF",
      action: "SUMMON",
      timing: "BEFORE",
      quantity: material.quantity,
    },
    material.destination === "XYZ_MATERIAL",
  );
}

function applyCostEvents(state: DuelState, step: ComboStep) {
  step.costEvents.forEach((event) => {
    applyFieldEvent(state, event);
    if (event.action !== "LEAVE" || !event.destination) return;
    applyFieldEvent(state, {
      ...event,
      id: `${event.id}-destination`,
      zone: event.destination,
      monsterZone: undefined,
      xyzHostZone:
        event.destination === "XYZ_MATERIAL" ? event.xyzHostZone : undefined,
      action: "SUMMON",
    });
  });
}

function applySuccessfulStep(state: DuelState, step: ComboStep) {
  step.zoneEvents
    .filter((event) => event.timing === "AFTER")
    .forEach((event) => applyFieldEvent(state, event));
  const summonAlreadyRecorded = step.zoneEvents.some(
    (event) =>
      (event.owner ?? "SELF") === "SELF" &&
      event.action === "SUMMON" &&
      event.zone === "MONSTER_ZONE" &&
      event.cardId === step.summonedCardId,
  );
  if (
    step.actionType === "SUMMON" &&
    step.summonedCardId &&
    !summonAlreadyRecorded
  ) {
    applyFieldEvent(state, {
      id: `implicit-${step.id}`,
      cardId: step.summonedCardId,
      zone: "MONSTER_ZONE",
      monsterZone: step.summonZone,
      owner: "SELF",
      action: "SUMMON",
      timing: "AFTER",
      quantity: 1,
    });
  }
  state.opponentLP = Math.max(0, state.opponentLP + step.opponentLpChange);
  if (step.declaresSpecialWin) {
    state.specialWin = true;
    state.specialWinText = step.specialWinText || "특수 승리 조건 달성";
  }
}

function simulateComboField(
  combo: Combo,
  interruptedStepId?: string,
  initialState?: DuelState,
): DuelState {
  const state = initialState
    ? cloneDuelState(initialState)
    : initialDuelState(combo);
  for (const step of combo.steps) {
    applyCostEvents(state, step);
    if (step.actionType === "SUMMON")
      step.materials.forEach((material) =>
        applySummonMaterial(state, material, step.summonZone),
      );
    if (
      step.actionType === "EFFECT" &&
      step.effectExecutionMode === "CHAIN_REGISTER"
    ) {
      const links = state.pendingChains.get(step.chainId) ?? [];
      state.pendingChains.set(step.chainId, [
        ...links,
        { step, negated: step.id === interruptedStepId },
      ]);
      continue;
    }
    if (step.actionType === "CHAIN_RESOLVE") {
      const links = state.pendingChains.get(step.chainId) ?? [];
      [...links].reverse().forEach((link) => {
        if (!link.negated) applySuccessfulStep(state, link.step);
      });
      state.pendingChains.delete(step.chainId);
      if (links.some((link) => link.negated && link.step.stopsWhenNegated))
        break;
      continue;
    }
    if (step.id === interruptedStepId) {
      if (step.actionType === "SUMMON")
        releaseXyzMaterials(state, "SELF", step.summonZone);
      if (step.stopsWhenNegated) break;
      continue;
    }
    applySuccessfulStep(state, step);
  }
  state.pendingChains.forEach((links) => {
    if (links.length)
      state.violations.push(
        `${links[0].step.chainLabel} 체인이 아직 처리되지 않았습니다.`,
      );
  });
  return state;
}

function simulateFieldBeforeStep(combo: Combo, stepId: string): DuelState {
  const state = initialDuelState(combo);
  for (const step of combo.steps) {
    applyCostEvents(state, step);
    if (step.actionType === "SUMMON")
      step.materials.forEach((material) =>
        applySummonMaterial(state, material, step.summonZone),
      );
    if (step.id === stepId) break;
    if (
      step.actionType === "EFFECT" &&
      step.effectExecutionMode === "CHAIN_REGISTER"
    ) {
      const links = state.pendingChains.get(step.chainId) ?? [];
      state.pendingChains.set(step.chainId, [
        ...links,
        { step, negated: false },
      ]);
      continue;
    }
    if (step.actionType === "CHAIN_RESOLVE") {
      const links = state.pendingChains.get(step.chainId) ?? [];
      [...links]
        .reverse()
        .forEach((link) => applySuccessfulStep(state, link.step));
      state.pendingChains.delete(step.chainId);
      continue;
    }
    applySuccessfulStep(state, step);
  }
  return state;
}

function resolvedStepsBefore(steps: ComboStep[], endIndex: number) {
  const resolved: ComboStep[] = [];
  const pending = new Map<string, ComboStep[]>();
  steps.slice(0, endIndex).forEach((step) => {
    if (
      step.actionType === "EFFECT" &&
      step.effectExecutionMode === "CHAIN_REGISTER"
    ) {
      pending.set(step.chainId, [...(pending.get(step.chainId) ?? []), step]);
    } else if (step.actionType === "CHAIN_RESOLVE") {
      resolved.push(...[...(pending.get(step.chainId) ?? [])].reverse());
      pending.delete(step.chainId);
    } else {
      resolved.push(step);
    }
  });
  return resolved;
}

function pendingChainLinksBefore(
  steps: ComboStep[],
  chainId: string,
  endIndex: number,
) {
  let links: ComboStep[] = [];
  steps.slice(0, endIndex).forEach((step) => {
    if (
      step.actionType === "EFFECT" &&
      step.effectExecutionMode === "CHAIN_REGISTER" &&
      step.chainId === chainId
    )
      links.push(step);
    if (step.actionType === "CHAIN_RESOLVE" && step.chainId === chainId)
      links = [];
  });
  return links;
}

function missingGoalCards(combo: Combo, state: DuelState, cards: Card[]) {
  const missing = combo.goals.flatMap((goal) => {
    if (goal.kind === "OPPONENT_LP")
      return state.opponentLP <= goal.maximum
        ? []
        : [`상대 LP ${goal.maximum} 이하 (현재 ${state.opponentLP})`];
    if (goal.kind === "SPECIAL_WIN")
      return state.specialWin
        ? []
        : [`특수 승리 · ${goal.label || "조건 달성"}`];
    if (goal.kind === "LOCATION_COUNT_MAX") {
      const prefix = `${goal.location}:`;
      let current = 0;
      state.boards[goal.owner].cards.forEach((quantity, key) => {
        if (key.startsWith(prefix)) current += quantity;
      });
      return current <= goal.maximum
        ? []
        : [
            `${PLAYER_SIDE_LABEL[goal.owner]} ${LOCATION_LABEL[goal.location]} ${goal.maximum}장 이하 (현재 ${current}장)`,
          ];
    }
    const owner = goal.owner ?? "SELF";
    const current =
      state.boards[owner].cards.get(fieldKey(goal.cardId, goal.location)) ?? 0;
    if (current >= goal.quantity) return [];
    const name =
      cards.find((card) => card.id === goal.cardId)?.name ?? "삭제된 카드";
    return [
      `${PLAYER_SIDE_LABEL[owner]} ${LOCATION_LABEL[goal.location]} · ${name} ×${goal.quantity - current}`,
    ];
  });
  return [
    ...state.violations.map((violation) => `처리 오류 · ${violation}`),
    ...missing,
  ];
}

type ReplayFrame = {
  state: DuelState;
  activeCardId: string;
  actionType: ComboActionType | null;
  entering: string[];
  leaving: { cardId: string; owner: PlayerSide }[];
  title: string;
  detail: string;
};

function replayCardSnapshot(state: DuelState) {
  const snapshot = new Map<string, number>();
  (["SELF", "OPPONENT"] as PlayerSide[]).forEach((owner) => {
    state.boards[owner].cards.forEach((quantity, key) => {
      snapshot.set(`${owner}:${key}`, quantity);
    });
  });
  return snapshot;
}

function buildReplayFrames(
  combo: Combo,
  cards: Card[],
  effectIndex: Map<string, { card: Card; effect: CardEffect }>,
): ReplayFrame[] {
  const state = initialDuelState(combo);
  const frames: ReplayFrame[] = [
    {
      state: cloneDuelState(state),
      activeCardId: "",
      actionType: null,
      entering: [],
      leaving: [],
      title: "시작 패",
      detail: "전개 시작 전 상태",
    },
  ];
  const appendFrame = (
    step: ComboStep,
    beforeKeys: Map<string, number>,
    title: string,
    detail: string,
    leaving: { cardId: string; owner: PlayerSide }[],
    actionType: ComboActionType = step.actionType,
  ) => {
    const entering: string[] = [];
    (["SELF", "OPPONENT"] as PlayerSide[]).forEach((owner) => {
      state.boards[owner].cards.forEach((quantity, key) => {
        const previous = beforeKeys.get(`${owner}:${key}`) ?? 0;
        for (let index = previous; index < quantity; index += 1)
          entering.push(`${owner}:${key}:${index}`);
      });
    });
    const item = effectIndex.get(step.effectId);
    frames.push({
      state: cloneDuelState(state),
      activeCardId:
        step.actionType === "SUMMON"
          ? step.summonedCardId
          : step.actingCardId || item?.card.id || "",
      actionType,
      entering,
      leaving,
      title,
      detail,
    });
  };
  combo.steps.forEach((step) => {
    const item = effectIndex.get(step.effectId);
    const activeCardId =
      step.actionType === "SUMMON"
        ? step.summonedCardId
        : step.actingCardId || item?.card.id || "";
    const actor = cards.find((card) => card.id === activeCardId);
    const beforeKeys = replayCardSnapshot(state);
    const costLeaving = step.costEvents
      .filter((event) => event.action === "LEAVE")
      .flatMap((event) =>
        Array.from({ length: event.quantity }, () => ({
          cardId: event.cardId,
          owner: event.owner ?? "SELF",
        })),
      );
    applyCostEvents(state, step);
    if (step.actionType === "SUMMON")
      step.materials.forEach((material) =>
        applySummonMaterial(state, material, step.summonZone),
      );
    if (
      step.actionType === "EFFECT" &&
      step.effectExecutionMode === "CHAIN_REGISTER"
    ) {
      const links = state.pendingChains.get(step.chainId) ?? [];
      state.pendingChains.set(step.chainId, [
        ...links,
        { step, negated: false },
      ]);
      appendFrame(
        step,
        beforeKeys,
        `${step.chainLabel} · CL${links.length + 1} 등록`,
        `${actor?.name ?? item?.card.name ?? "삭제된 카드"} · ${item?.effect.label ?? "삭제된 효과"} 발동${step.costEvents.length ? " · 코스트 지불 완료" : ""}`,
        costLeaving,
        "EFFECT",
      );
      return;
    }
    if (step.actionType === "CHAIN_RESOLVE") {
      const links = state.pendingChains.get(step.chainId) ?? [];
      if (!links.length) {
        appendFrame(
          step,
          beforeKeys,
          `${step.chainLabel} 처리`,
          "등록된 체인 링크가 없습니다.",
          [],
          "CHAIN_RESOLVE",
        );
      } else {
        const remainingLinks = [...links];
        [...links].reverse().forEach((link, reverseIndex) => {
          const linkBefore = replayCardSnapshot(state);
          const linkItem = effectIndex.get(link.step.effectId);
          const linkActor =
            cards.find((card) => card.id === link.step.actingCardId) ??
            linkItem?.card;
          const leaving = link.step.zoneEvents
            .filter((event) => event.action === "LEAVE")
            .flatMap((event) =>
              Array.from({ length: event.quantity }, () => ({
                cardId: event.cardId,
                owner: event.owner ?? "SELF",
              })),
            );
          remainingLinks.pop();
          if (remainingLinks.length)
            state.pendingChains.set(
              step.chainId,
              remainingLinks.map((item) => ({ ...item })),
            );
          else state.pendingChains.delete(step.chainId);
          applySuccessfulStep(state, link.step);
          appendFrame(
            link.step,
            linkBefore,
            `${step.chainLabel} 역순 처리 · CL${links.length - reverseIndex}`,
            `${linkActor?.name ?? "삭제된 카드"} · ${linkItem?.effect.label ?? "삭제된 효과"}`,
            leaving,
            "EFFECT",
          );
        });
      }
      state.pendingChains.delete(step.chainId);
      return;
    }
    const leaving = [
      ...costLeaving,
      ...step.zoneEvents
        .filter((event) => event.action === "LEAVE")
        .flatMap((event) =>
          Array.from({ length: event.quantity }, () => ({
            cardId: event.cardId,
            owner: event.owner ?? "SELF",
          })),
        ),
      ...step.materials.flatMap((material) =>
        Array.from({ length: material.quantity }, () => ({
          cardId: material.cardId,
          owner: "SELF" as PlayerSide,
        })),
      ),
    ];
    applySuccessfulStep(state, step);
    appendFrame(
      step,
      beforeKeys,
      step.actionType === "SUMMON"
        ? `${actor?.name ?? "삭제된 몬스터"} · ${SUMMON_TYPE_LABEL[step.summonType]}`
        : `${actor?.name ?? item?.card.name ?? "삭제된 카드"} · ${item?.effect.label ?? "삭제된 효과"}`,
      `${TURN_OWNER_LABEL[step.turnOwner]} · ${PHASE_LABEL[step.phase]}${step.actionType === "SUMMON" ? ` · ${LOCATION_LABEL[step.summonFrom]}에서 ${step.summonCount}장 · ${MONSTER_ZONE_LABEL[step.summonZone]}` : ""}${step.opponentLpChange ? ` · 상대 LP ${step.opponentLpChange > 0 ? "+" : ""}${step.opponentLpChange}` : ""}${step.declaresSpecialWin ? ` · ${step.specialWinText}` : ""}`,
      leaving,
    );
  });
  return frames;
}

function comboGoalLabel(goal: ComboGoal, cards: Card[]) {
  if (goal.kind === "OPPONENT_LP") return `상대 LP ${goal.maximum} 이하`;
  if (goal.kind === "SPECIAL_WIN") return `특수 승리 · ${goal.label}`;
  if (goal.kind === "LOCATION_COUNT_MAX")
    return `${PLAYER_SIDE_LABEL[goal.owner]} ${LOCATION_LABEL[goal.location]} ${goal.maximum}장 이하`;
  return `${PLAYER_SIDE_LABEL[goal.owner ?? "SELF"]} ${LOCATION_LABEL[goal.location]} · ${cards.find((card) => card.id === goal.cardId)?.name ?? "삭제된 카드"} ×${goal.quantity}`;
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

function usePersistentStore() {
  const [store, setStore] = useState<Store>(DEFAULT_STORE);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [syncState, setSyncState] = useState<CloudSyncState>("CHECKING");
  const [syncError, setSyncError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [hasDeviceBackup, setHasDeviceBackup] = useState(false);
  const [hasServerBackup, setHasServerBackup] = useState(false);
  const storeRef = useRef(store);
  const syncedStoreJsonRef = useRef<string | null>(null);
  const pendingCloudStoreRef = useRef<Store | null>(null);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const normalizeStoredData = (parsed: Store): Store => {
    const previousVersion = parsed.schemaVersion ?? 1;
    const normalizedCards = (parsed.cards ?? []).map(normalizeCard);
    const existingNames = new Set(normalizedCards.map((card) => card.name));
    const migratedCards =
      previousVersion < 9
        ? [
            ...normalizedCards,
            ...SEEDED_CARDS.filter((card) => !existingNames.has(card.name)),
          ]
        : normalizedCards;
    const detailedReviewCards = migrateDetailedCatalogReviewCards(
      migratedCards,
      previousVersion,
    );
    const migratedDecks = (parsed.decks ?? [])
      .filter((deck) => deck.id !== "seed-deck-zoodiac-materiactor-hyun")
      .map((deck) => normalizeDeck(deck, detailedReviewCards));
    const normalizedHandTraps = (
      parsed.handTraps ?? DEFAULT_STORE.handTraps
    ).map((trap) => {
      if (previousVersion < 2 && trap.id === ASH_ID)
        return normalizeHandTrap({ ...BUILT_IN_HAND_TRAPS[0] });
      const builtIn = BUILT_IN_HAND_TRAPS.find(
        (defaultTrap) => defaultTrap.id === trap.id,
      );
      return normalizeHandTrap({
        ...trap,
        builtIn: builtIn ? true : trap.builtIn,
      });
    });
    const existingHandTrapIds = new Set(
      normalizedHandTraps.map((trap) => trap.id),
    );
    const migratedHandTraps = [
      ...normalizedHandTraps,
      ...BUILT_IN_HAND_TRAPS.filter(
        (trap) => !existingHandTrapIds.has(trap.id),
      ).map((trap) => normalizeHandTrap(trap)),
    ];
    return {
      ...DEFAULT_STORE,
      ...parsed,
      schemaVersion: 20,
      trash: parsed.trash ?? [],
      decks: migratedDecks,
      cards: detailedReviewCards,
      combos: (parsed.combos ?? []).map(normalizeCombo),
      handTraps: migratedHandTraps,
    };
  };

  const saveToCloud = async (nextStore: Store) => {
    if (!user) throw new Error("먼저 Google 계정으로 로그인하세요.");
    setSyncState("SYNCING");
    setSyncError("");
    const nextStoreJson = JSON.stringify(nextStore);
    const result = await saveFirebaseStore(
      user.uid,
      nextStoreJson,
      updatedAt ? new Date(updatedAt).getTime() : null,
    );
    setUpdatedAt(
      result.updatedAt ? new Date(result.updatedAt).toISOString() : null,
    );
    setHasServerBackup(Boolean(result.previous));
    syncedStoreJsonRef.current = nextStoreJson;
    setSyncState("SYNCED");
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("combo-lab-v1");
      if (saved) {
        setStore(normalizeStoredData(JSON.parse(saved) as Store));
      }
    } catch {
      setStore(DEFAULT_STORE);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("combo-lab-v1", JSON.stringify(store));
  }, [store, ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setHasDeviceBackup(
      localStorage.getItem("combo-lab-v1-device-backup") !== null,
    );

    const unsubscribe = observeGoogleAccount(async (account) => {
      try {
        if (cancelled) return;
        setSyncError("");
        if (!account) {
          setUser(null);
          setUpdatedAt(null);
          setHasServerBackup(false);
          syncedStoreJsonRef.current = null;
          pendingCloudStoreRef.current = null;
          setSyncState("LOCAL");
          return;
        }

        setUser(account);
        setSyncState("LOADING");
        const cloudResult = await loadFirebaseStore(account.uid);
        if (cancelled) return;

        if (cloudResult.current) {
          const currentLocal = localStorage.getItem("combo-lab-v1");
          const cloudStore = normalizeStoredData(
            JSON.parse(cloudResult.current) as Store,
          );
          const cloudStoreJson = JSON.stringify(cloudStore);
          let localDiffers = false;
          if (currentLocal) {
            try {
              const localStore = normalizeStoredData(
                JSON.parse(currentLocal) as Store,
              );
              localDiffers = JSON.stringify(localStore) !== cloudStoreJson;
              if (localDiffers) {
                localStorage.setItem("combo-lab-v1-device-backup", currentLocal);
                setHasDeviceBackup(true);
              }
            } catch {
              // A broken local snapshot should not block the cloud copy.
            }
          }
          setUpdatedAt(
            cloudResult.updatedAt
              ? new Date(cloudResult.updatedAt).toISOString()
              : null,
          );
          setHasServerBackup(Boolean(cloudResult.previous));
          syncedStoreJsonRef.current = cloudStoreJson;
          if (localDiffers) {
            pendingCloudStoreRef.current = cloudStore;
            setSyncState("CONFLICT");
          } else {
            setStore(cloudStore);
            pendingCloudStoreRef.current = null;
            setSyncState("SYNCED");
          }
        } else {
          syncedStoreJsonRef.current = null;
          setUpdatedAt(null);
          setHasServerBackup(false);
          setSyncState("DIRTY");
        }
        localStorage.setItem("combo-lab-v1-cloud-user", account.email);
      } catch (error) {
        if (cancelled) return;
        setSyncError(
          error instanceof Error ? error.message : "계정 연결에 실패했습니다.",
        );
        setSyncState("ERROR");
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ready]);

  const visibleSyncState: CloudSyncState =
    user &&
    syncState !== "CHECKING" &&
    syncState !== "LOADING" &&
    syncState !== "SYNCING" &&
    syncState !== "CONFLICT" &&
    syncState !== "ERROR" &&
    JSON.stringify(store) !== syncedStoreJsonRef.current
      ? "DIRTY"
      : syncState;
  const cloudSync: CloudSyncController = {
    user,
    state: visibleSyncState,
    error: syncError,
    updatedAt,
    hasDeviceBackup,
    hasServerBackup,
    signIn: () => {
      setSyncError("");
      void signInWithGoogle().catch((error: unknown) => {
        setSyncError(
          error instanceof Error ? error.message : "Google 로그인에 실패했습니다.",
        );
        setSyncState("ERROR");
      });
    },
    signOut: () => {
      localStorage.removeItem("combo-lab-v1-cloud-user");
      void signOutFromGoogle().catch((error: unknown) => {
        setSyncError(
          error instanceof Error ? error.message : "로그아웃에 실패했습니다.",
        );
        setSyncState("ERROR");
      });
    },
    syncNow: async () => {
      try {
        await saveToCloud(storeRef.current);
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "동기화에 실패했습니다.",
        );
        setSyncState("ERROR");
      }
    },
    restoreDeviceBackup: () => {
      const backup = localStorage.getItem("combo-lab-v1-device-backup");
      if (!backup) return;
      try {
        setStore(normalizeStoredData(JSON.parse(backup) as Store));
        localStorage.removeItem("combo-lab-v1-device-backup");
        setHasDeviceBackup(false);
        setSyncState("DIRTY");
      } catch {
        setSyncError("이 기기의 백업 데이터를 읽을 수 없습니다.");
        setSyncState("ERROR");
      }
    },
    restoreServerBackup: async () => {
      setSyncState("LOADING");
      setSyncError("");
      try {
        if (!user) throw new Error("먼저 Google 계정으로 로그인하세요.");
        const result = await restorePreviousFirebaseStore(user.uid);
        if (!result.current)
          throw new Error("이전 Google 저장본을 찾지 못했습니다.");
        const restoredStore = normalizeStoredData(
          JSON.parse(result.current) as Store,
        );
        setStore(restoredStore);
        storeRef.current = restoredStore;
        syncedStoreJsonRef.current = JSON.stringify(restoredStore);
        setUpdatedAt(
          result.updatedAt ? new Date(result.updatedAt).toISOString() : null,
        );
        setHasServerBackup(Boolean(result.previous));
        setSyncState("SYNCED");
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "이전 저장본 복원에 실패했습니다.",
        );
        setSyncState("ERROR");
      }
    },
    useCloudCopy: () => {
      const cloudStore = pendingCloudStoreRef.current;
      if (!cloudStore) return;
      setStore(cloudStore);
      storeRef.current = cloudStore;
      syncedStoreJsonRef.current = JSON.stringify(cloudStore);
      pendingCloudStoreRef.current = null;
      setSyncState("SYNCED");
    },
    keepDeviceCopy: () => {
      pendingCloudStoreRef.current = null;
      setSyncState("DIRTY");
    },
  };

  return [store, setStore, cloudSync] as const;
}

export default function Home() {
  const [store, setStore, cloudSync] = usePersistentStore();
  const [tab, setTab] = useState<Tab>("handtraps");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<
    "handtrap" | "card" | "deck" | "combo" | null
  >(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingHandTrapId, setEditingHandTrapId] = useState<string | null>(
    null,
  );
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [selectedComboId, setSelectedComboId] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);

  const effectIndex = useMemo(() => {
    const map = new Map<string, { card: Card; effect: CardEffect }>();
    store.cards.forEach((card) =>
      card.effects.forEach((effect) => map.set(effect.id, { card, effect })),
    );
    return map;
  }, [store.cards]);

  const runCombo = () => {
    const combo =
      store.combos.find((item) => item.id === selectedComboId) ??
      store.combos[0];
    if (!combo) return;
    const points: TestPoint[] = [];
    const linkedDeck = store.decks.find((deck) => deck.id === combo.deckId);
    const deckErrors = comboDeckErrors(combo, linkedDeck, store.cards);
    const baselineField = simulateComboField(combo);
    const baselineMissingGoal = [
      ...deckErrors.map((error) => `덱 오류 · ${error}`),
      ...missingGoalCards(combo, baselineField, store.cards),
    ];
    const findPermissionFor = (handTrapId: string, stepIndex: number) => {
      const permissionState = new Map<string, number>();
      resolvedStepsBefore(combo.steps, stepIndex).forEach((previousStep) =>
        previousStep.permissionEvents.forEach((event) => {
          if (event.action === "ENABLE")
            permissionState.set(
              event.permissionEffectId,
              Math.max(1, event.uses),
            );
          if (event.action === "DISABLE")
            permissionState.delete(event.permissionEffectId);
          if (event.action === "CONSUME") {
            const remaining =
              (permissionState.get(event.permissionEffectId) ?? 0) -
              Math.max(1, event.uses);
            if (remaining > 0)
              permissionState.set(event.permissionEffectId, remaining);
            else permissionState.delete(event.permissionEffectId);
          }
        }),
      );
      const permissionEntry = [...permissionState.entries()].find(
        ([permissionEffectId, remaining]) => {
          const permissionEffect = effectIndex.get(permissionEffectId)?.effect;
          return (
            remaining > 0 &&
            !!permissionEffect &&
            (permissionEffect.blocksHandTraps.includes(handTrapId) ||
              permissionEffect.grantedProfile?.blocksHandTraps.includes(
                handTrapId,
              ))
          );
        },
      );
      return {
        permissionEntry,
        permission: permissionEntry
          ? effectIndex.get(permissionEntry[0])
          : undefined,
      };
    };
    combo.steps.forEach((step, stepIndex) => {
      if (step.actionType === "SUMMON") {
        const summoned = store.cards.find(
          (card) => card.id === step.summonedCardId,
        );
        step.summonInterruptibleBy.forEach((handTrapId) => {
          const handTrap = store.handTraps.find(
            (entry) => entry.id === handTrapId,
          );
          if (!handTrap) return;
          const branch = combo.branches.find(
            (item) =>
              item.triggerHandTrapId === handTrapId &&
              item.atStepId === step.id,
          );
          const alternate = branch
            ? store.combos.find((item) => item.id === branch.alternateComboId)
            : undefined;
          const { permissionEntry, permission } = findPermissionFor(
            handTrapId,
            stepIndex,
          );
          const directInterruption = directlyInterruptsStep(
            handTrap,
            step.actionType,
          );
          const testedField = permission
            ? baselineField
            : alternate
            ? simulateComboField(
                alternate,
                undefined,
                simulateFieldBeforeStep(combo, step.id),
              )
            : directInterruption
              ? simulateComboField(combo, step.id)
              : baselineField;
          const missingGoal = [
            ...deckErrors.map((error) => `덱 오류 · ${error}`),
            ...missingGoalCards(combo, testedField, store.cards),
          ];
          const goalReached =
            combo.goals.length > 0
              ? missingGoal.length === 0
              : permission || branch
                ? true
                : !directInterruption || !step.stopsWhenNegated;
          points.push({
            handTrapId,
            handTrapName: handTrap.name,
            stepIndex,
            stepId: step.id,
            cardName: summoned?.name ?? "삭제된 몬스터",
            effectLabel: SUMMON_TYPE_LABEL[step.summonType],
            stopped: !goalReached,
            triggered: !permission,
            directInterruption,
            resolvedOperations: permission ? 0 : triggerOperationCount(handTrap),
            goalReached,
            missingGoal,
            disruptionSummary: disruptionSummary(handTrap),
            blockedByPermission: permission
              ? `${permission.card.name} · ${permission.effect.label} (잔여 ${permissionEntry?.[1]}회)`
              : undefined,
            bypassBranchName: branch?.name,
          });
        });
        return;
      }
      const item = effectIndex.get(step.effectId);
      if (!item) return;
      const actingCard =
        store.cards.find((card) => card.id === step.actingCardId) ?? item.card;
      const effectiveEffect =
        actingCard.id !== item.card.id && item.effect.grantedProfile
          ? item.effect.grantedProfile
          : item.effect;
      effectiveEffect.interruptibleBy.forEach((handTrapId) => {
        const handTrap = store.handTraps.find(
          (entry) => entry.id === handTrapId,
        );
        if (!handTrap) return;
        const { permissionEntry, permission } = findPermissionFor(
          handTrapId,
          stepIndex,
        );
        const branch = combo.branches.find(
          (branchItem) =>
            branchItem.triggerHandTrapId === handTrapId &&
            branchItem.atStepId === step.id,
        );
        const alternate = branch
          ? store.combos.find(
              (comboItem) => comboItem.id === branch.alternateComboId,
            )
          : undefined;
        const directInterruption = directlyInterruptsStep(
          handTrap,
          step.actionType,
        );
        const testedField = permission
          ? baselineField
          : alternate
            ? simulateComboField(
                alternate,
                undefined,
                simulateFieldBeforeStep(combo, step.id),
              )
            : directInterruption
              ? simulateComboField(combo, step.id)
              : baselineField;
        const missingGoal = [
          ...deckErrors.map((error) => `덱 오류 · ${error}`),
          ...missingGoalCards(combo, testedField, store.cards),
        ];
        const goalReached =
          combo.goals.length > 0
            ? missingGoal.length === 0
            : !!permission ||
              !!branch ||
              !directInterruption ||
              !step.stopsWhenNegated;
        points.push({
          handTrapId,
          handTrapName: handTrap.name,
          stepIndex,
          stepId: step.id,
          cardName:
            actingCard.id === item.card.id
              ? item.card.name
              : `${actingCard.name} (부여받은 효과)`,
          effectLabel: effectiveEffect.label,
          stopped: !goalReached,
          triggered: !permission,
          directInterruption,
          resolvedOperations: permission ? 0 : triggerOperationCount(handTrap),
          goalReached,
          missingGoal,
          disruptionSummary: disruptionSummary(handTrap),
          blockedByPermission: permission
            ? `${permission.card.name} · ${permission.effect.label} (잔여 ${permissionEntry?.[1]}회)`
            : undefined,
          bypassBranchName: branch?.name,
        });
      });
    });
    const summaries: HandTrapCheckSummary[] = store.handTraps
      .map((handTrap) => {
        const plan = combo.handTrapPlans?.find(
          (item) => item.handTrapId === handTrap.id,
        );
        const trapPoints = points.filter(
          (point) => point.handTrapId === handTrap.id,
        );
        const metrics = measureHandTrapRoute(combo, handTrap, effectIndex);
        const automaticPermission =
          metrics.firstStepIndex === null
            ? undefined
            : findPermissionFor(handTrap.id, metrics.firstStepIndex).permission;
        const automaticBlocked = !!automaticPermission;
        const automaticAffected = automaticBlocked
          ? []
          : metrics.affectedStepIds;
        const automaticBlockedSteps = automaticBlocked
          ? []
          : metrics.blockedStepIds;
        const automaticRedirectedSteps = automaticBlocked
          ? []
          : metrics.redirectedStepIds;
        const affectedStepIds = new Set([
          ...automaticAffected,
          ...trapPoints.map((point) => point.stepId).filter(Boolean),
        ]);
        const opponentDraws = automaticBlocked ? 0 : metrics.opponentDraws;
        const endPhaseReturns = automaticBlocked
          ? 0
          : metrics.endPhaseReturns;
        const triggerCount = Math.max(
          automaticBlocked ? 0 : metrics.triggerCount,
          trapPoints.length,
        );
        const blockedCount =
          trapPoints.filter((point) => point.blockedByPermission).length +
          (automaticBlocked ? 1 : 0);
        const bypassedCount = trapPoints.filter(
          (point) => point.bypassBranchName,
        ).length;
        const manualResolvedOperations = Math.max(
          0,
          ...trapPoints.map((point) => point.resolvedOperations ?? 0),
        );
        const resolvedOperations = Math.max(
          automaticBlocked ? 0 : metrics.applicationCount,
          manualResolvedOperations,
        );
        const pointsPassed = trapPoints.every(
          (point) => point.goalReached !== false && !point.stopped,
        );
        const role = handTrapRole(handTrap);
        const persistentRisk =
          (role.includes("잔존") || role === "누적 드로우") &&
          triggerCount > 0;
        const unresolvedOperationRisk = trapPoints.some(
          (point) =>
            point.triggered &&
            !point.directInterruption &&
            !point.blockedByPermission &&
            !point.bypassBranchName &&
            (point.resolvedOperations ?? 0) > 0,
        );
        const automaticRisk =
          !automaticBlocked && metrics.triggerCount > 0;
        const strategy = plan?.strategy ?? "AUTO";
        let passed = pointsPassed;
        let reason = pointsPassed
          ? "등록된 방해 지점에서 목표 상태 도달"
          : "방해 적용 후 목표 상태 미달";

        if (strategy === "AUTO") {
          if (automaticRisk && !trapPoints.length) {
            passed = false;
            reason = plan
              ? "격발된 잔존 효과를 자동 판정만으로 허용할 수 없습니다"
              : "잔존형 패트랩이 격발되었지만 대응안이 등록되지 않았습니다";
          } else if (persistentRisk) {
            passed = false;
            reason = plan
              ? "격발 후 누적 적용을 자동 판정만으로 허용할 수 없습니다"
              : "격발된 누적형 패트랩 대응안이 등록되지 않았습니다";
          } else if (unresolvedOperationRisk) {
            passed = false;
            reason = plan
              ? "파괴·이동·복합 처리는 대응 한도나 우회 전개를 지정해야 합니다"
              : "무효가 아닌 방해가 격발되어 대응안 확인이 필요합니다";
          } else if (!trapPoints.length && triggerCount === 0) {
            reason = "현재 전개에서는 발동·적용 조건을 충족하지 않음";
          } else if (!trapPoints.length) {
            reason = "격발 조건은 충족하지만 후속 전개에 추가 영향 없음";
          }
        }
        if (strategy === "BLOCK_WITH_PERMISSION") {
          const allManualBlocked = trapPoints.every(
            (point) => !!point.blockedByPermission,
          );
          const automaticCovered =
            metrics.triggerCount === 0 || automaticBlocked;
          passed = pointsPassed && allManualBlocked && automaticCovered;
          reason = passed
            ? `퍼미션으로 ${blockedCount}개 적용 지점 차단`
            : "모든 발동 가능 지점보다 먼저 사용 가능한 퍼미션이 필요합니다";
        }
        if (strategy === "AVOID_TRIGGER") {
          passed = triggerCount === 0 && trapPoints.length === 0;
          reason = passed
            ? "발동 조건을 만들지 않고 전개 완료"
            : `발동 가능 지점 ${triggerCount}개가 남아 있습니다`;
        }
        if (strategy === "BYPASS_ROUTE") {
          passed =
            trapPoints.length > 0 &&
            trapPoints.every(
              (point) => !!point.bypassBranchName && point.goalReached !== false,
            ) &&
            (!automaticAffected.length || bypassedCount > 0);
          reason = passed
            ? `${bypassedCount}개 지점에서 우회 전개로 목표 도달`
            : "각 발동 가능 지점에 목표를 달성하는 우회 전개를 연결해야 합니다";
        }
        if (strategy === "ACCEPT_WITH_LIMIT") {
          const drawLimit = Math.max(0, plan?.maxOpponentDraws ?? 0);
          const affectedLimit = Math.max(0, plan?.maxAffectedSteps ?? 0);
          const operationLimit = Math.max(
            0,
            plan?.maxResolvedOperations ?? 99,
          );
          passed =
            pointsPassed &&
            opponentDraws <= drawLimit &&
            affectedStepIds.size <= affectedLimit &&
            resolvedOperations <= operationLimit;
          reason = passed
            ? `허용 범위 내 격발 · 드로우 ${opponentDraws}/${drawLimit}장 · 영향 ${affectedStepIds.size}/${affectedLimit}단계 · 처리 ${resolvedOperations}/${operationLimit}회`
            : `허용 초과 또는 목표 미달 · 드로우 ${opponentDraws}/${drawLimit}장 · 영향 ${affectedStepIds.size}/${affectedLimit}단계 · 처리 ${resolvedOperations}/${operationLimit}회`;
        }

        if (!plan && !trapPoints.length && triggerCount === 0) return null;
        return {
          handTrapId: handTrap.id,
          handTrapName: handTrap.name,
          role,
          strategy,
          planned: !!plan,
          passed,
          triggerCount,
          affectedSteps: affectedStepIds.size,
          opponentDraws,
          endPhaseReturns,
          blockedSteps: automaticBlockedSteps.length,
          redirectedSteps: automaticRedirectedSteps.length,
          resolvedOperations,
          blockedCount,
          bypassedCount,
          reason,
          notes: plan?.notes ?? "",
        };
      })
      .filter((summary): summary is HandTrapCheckSummary => !!summary);
    const run: TestRun = {
      id: uid(),
      comboId: combo.id,
      comboName: combo.name,
      createdAt: new Date().toISOString(),
      points,
      summaries,
      baselineGoalReached:
        combo.goals.length === 0 || baselineMissingGoal.length === 0,
      baselineMissingGoal,
    };
    setStore((current) => ({
      ...current,
      runs: [run, ...current.runs].slice(0, 20),
    }));
    setTab("results");
  };

  const counts = {
    handTraps: store.handTraps.length,
    effects: store.cards.reduce((sum, card) => sum + card.effects.length, 0),
    combos: store.combos.length,
  };

  return (
    <div className="app-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="brand-row">
          <div className="brand-mark">
            <FlaskConical size={20} />
          </div>
          <div>
            <strong>COMBO LAB</strong>
            <span>DETERMINISTIC TESTER</span>
          </div>
          <button
            className="icon-button mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="메뉴 닫기"
          >
            <X size={19} />
          </button>
        </div>

        <nav>
          <NavButton
            active={tab === "handtraps"}
            icon={<Hand size={19} />}
            label="패트랩"
            onClick={() => setTab("handtraps")}
          />
          <NavButton
            active={tab === "decks"}
            icon={<Layers3 size={19} />}
            label="덱"
            count={store.decks.length}
            onClick={() => setTab("decks")}
          />
          <NavButton
            active={tab === "catalog"}
            icon={<DatabaseBackup size={19} />}
            label="전체 카드"
            count={CATALOG_CARD_COUNT}
            onClick={() => setTab("catalog")}
          />
          <NavButton
            active={tab === "cards"}
            icon={<BookOpen size={19} />}
            label="카드 라이브러리"
            count={store.cards.length}
            onClick={() => setTab("cards")}
          />
          <NavButton
            active={tab === "combos"}
            icon={<GitBranch size={19} />}
            label="전개법"
            count={store.combos.length}
            onClick={() => setTab("combos")}
          />
          <NavButton
            active={tab === "results"}
            icon={<Activity size={19} />}
            label="검사 결과"
            count={store.runs.length}
            onClick={() => setTab("results")}
          />
          <NavButton
            active={tab === "trash"}
            icon={<Trash2 size={19} />}
            label="휴지통"
            count={store.trash.length}
            onClick={() => setTab("trash")}
          />
        </nav>

        <div className="sidebar-note">
          <div className="note-icon">
            <ShieldCheck size={18} />
          </div>
          <p>모든 검사는 원본 전개에서 독립적으로 실행됩니다.</p>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="메뉴 열기"
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumbs">
            <span>워크스페이스</span>
            <ChevronRight size={15} />
            <strong>{tabTitle(tab)}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label="계정 및 동기화"
              onClick={() => setAccountOpen(true)}
            >
              <UserRound size={19} />
            </button>
            <button
              className={`status-pill sync-${cloudSync.state.toLowerCase()}`}
              onClick={() => setAccountOpen(true)}
            >
              <span /> {cloudSyncLabel(cloudSync)}
            </button>
          </div>
        </header>

        <div className="content">
          {tab === "handtraps" && (
            <HandTrapScreen
              store={store}
              setStore={setStore}
              openModal={() => {
                setEditingHandTrapId(null);
                setModal("handtrap");
              }}
              editHandTrap={(id) => {
                setEditingHandTrapId(id);
                setModal("handtrap");
              }}
              counts={counts}
            />
          )}
          {tab === "decks" && (
            <DecksScreen
              store={store}
              setStore={setStore}
              openModal={() => {
                setEditingDeckId(null);
                setModal("deck");
              }}
              editDeck={(id) => {
                setEditingDeckId(id);
                setModal("deck");
              }}
            />
          )}
          {tab === "catalog" && (
            <CardCatalogScreen
              store={store}
              setStore={setStore}
              editCard={(cardId) => {
                setEditingCardId(cardId);
                setModal("card");
              }}
            />
          )}
          {tab === "cards" && (
            <CardsScreen
              store={store}
              setStore={setStore}
              openModal={() => {
                setEditingCardId(null);
                setModal("card");
              }}
              editCard={(cardId) => {
                setEditingCardId(cardId);
                setModal("card");
              }}
            />
          )}
          {tab === "combos" && (
            <CombosScreen
              store={store}
              setStore={setStore}
              effectIndex={effectIndex}
              selectedComboId={selectedComboId}
              setSelectedComboId={setSelectedComboId}
              openModal={() => {
                setEditingComboId(null);
                setModal("combo");
              }}
              editCombo={(id) => {
                setEditingComboId(id);
                setModal("combo");
              }}
              runCombo={runCombo}
            />
          )}
          {tab === "results" && <ResultsScreen runs={store.runs} />}
          {tab === "trash" && <TrashScreen store={store} setStore={setStore} />}
        </div>
      </main>

      {menuOpen && (
        <button
          className="scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="메뉴 닫기"
        />
      )}
      {modal === "handtrap" && (
        <HandTrapModal
          initialHandTrap={store.handTraps.find(
            (trap) => trap.id === editingHandTrapId,
          )}
          onClose={() => {
            setModal(null);
            setEditingHandTrapId(null);
          }}
          onSave={(item) => {
            setStore((s) => ({
              ...s,
              handTraps: editingHandTrapId
                ? s.handTraps.map((trap) =>
                    trap.id === editingHandTrapId ? item : trap,
                  )
                : [...s.handTraps, item],
            }));
            setModal(null);
            setEditingHandTrapId(null);
          }}
        />
      )}
      {modal === "card" && (
        <CardModal
          handTraps={store.handTraps}
          initialCard={store.cards.find((card) => card.id === editingCardId)}
          onClose={() => {
            setModal(null);
            setEditingCardId(null);
          }}
          onSave={(item) => {
            setStore((s) => {
              if (!editingCardId) return { ...s, cards: [...s.cards, item] };
              const previous = s.cards.find(
                (card) => card.id === editingCardId,
              );
              const previousEffectIds = new Set(
                previous?.effects.map((effect) => effect.id) ?? [],
              );
              const nextEffectIds = new Set(
                item.effects.map((effect) => effect.id),
              );
              return {
                ...s,
                cards: s.cards.map((card) =>
                  card.id === editingCardId ? item : card,
                ),
                combos: s.combos.map((combo) => ({
                  ...combo,
                  steps: combo.steps.filter(
                    (step) =>
                      !previousEffectIds.has(step.effectId) ||
                      nextEffectIds.has(step.effectId),
                  ),
                })),
              };
            });
            setModal(null);
            setEditingCardId(null);
          }}
        />
      )}
      {modal === "deck" && (
        <DeckModal
          cards={store.cards}
          initialDeck={store.decks.find((deck) => deck.id === editingDeckId)}
          onClose={() => {
            setModal(null);
            setEditingDeckId(null);
          }}
          onSave={(item) => {
            setStore((s) => ({
              ...s,
              decks: editingDeckId
                ? s.decks.map((deck) =>
                    deck.id === editingDeckId ? item : deck,
                  )
                : [...s.decks, item],
            }));
            setModal(null);
            setEditingDeckId(null);
          }}
        />
      )}
      {modal === "combo" && (
        <ComboModal
          cards={store.cards}
          decks={store.decks}
          handTraps={store.handTraps}
          combos={store.combos}
          initialCombo={store.combos.find(
            (combo) => combo.id === editingComboId,
          )}
          onClose={() => {
            setModal(null);
            setEditingComboId(null);
          }}
          onSave={(item) => {
            setStore((s) => ({
              ...s,
              combos: editingComboId
                ? s.combos.map((combo) =>
                    combo.id === editingComboId ? item : combo,
                  )
                : [...s.combos, item],
            }));
            setSelectedComboId(item.id);
            setModal(null);
            setEditingComboId(null);
          }}
        />
      )}
      {accountOpen && (
        <AccountModal
          cloudSync={cloudSync}
          onClose={() => setAccountOpen(false)}
        />
      )}
    </div>
  );
}

function cloudSyncLabel(cloudSync: CloudSyncController) {
  if (!cloudSync.user) {
    return cloudSync.state === "CHECKING" ? "계정 확인 중" : "로컬 저장됨";
  }
  return {
    CHECKING: "계정 확인 중",
    LOCAL: "로컬 저장됨",
    LOADING: "계정 데이터 불러오는 중",
    SYNCING: "동기화 중",
    SYNCED: "계정에 동기화됨",
    DIRTY: "이 기기 변경사항 저장 필요",
    CONFLICT: "계정 데이터와 이 기기 데이터가 다름",
    ERROR: "동기화 오류",
  }[cloudSync.state];
}

function AccountModal({
  cloudSync,
  onClose,
}: {
  cloudSync: CloudSyncController;
  onClose: () => void;
}) {
  const busy =
    cloudSync.state === "CHECKING" ||
    cloudSync.state === "LOADING" ||
    cloudSync.state === "SYNCING";
  return (
    <div className="modal-layer">
      <button
        className="modal-scrim"
        onClick={onClose}
        aria-label="계정 창 닫기"
      />
      <div className="modal account-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span>GOOGLE ACCOUNT & CLOUD SYNC</span>
            <h2>Google 계정 동기화</h2>
            <p>같은 Google 계정으로 로그인한 모든 기기에서 덱과 전개법을 이어갑니다.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="account-body">
          {cloudSync.user ? (
            <>
              <div className="account-profile">
                <div>
                  <UserRound size={24} />
                </div>
                <section>
                  <small>로그인한 계정</small>
                  <strong>{cloudSync.user.displayName}</strong>
                  <span>{cloudSync.user.email}</span>
                </section>
                <BadgeCheck size={20} />
              </div>
              <div
                className={`sync-summary sync-summary-${cloudSync.state.toLowerCase()}`}
              >
                {cloudSync.state === "ERROR" ? (
                  <CloudOff size={22} />
                ) : cloudSync.state === "CONFLICT" ? (
                  <CircleAlert size={22} />
                ) : busy ? (
                  <LoaderCircle className="spin-icon" size={22} />
                ) : (
                  <Cloud size={22} />
                )}
                <div>
                  <strong>{cloudSyncLabel(cloudSync)}</strong>
                  <span>
                    {cloudSync.error ||
                      (cloudSync.state === "DIRTY"
                        ? "자동으로 덮어쓰지 않습니다. 확인 후 아래 저장 버튼을 눌러주세요."
                        : cloudSync.state === "CONFLICT"
                          ? "어느 데이터를 사용할지 선택하기 전에는 아무것도 덮어쓰지 않습니다."
                        : cloudSync.updatedAt
                          ? `마지막 저장 ${new Date(cloudSync.updatedAt).toLocaleString("ko-KR")}`
                          : "첫 계정 저장을 준비하고 있습니다.")}
                  </span>
                </div>
              </div>
              {cloudSync.state === "CONFLICT" && (
                <div className="sync-conflict-card">
                  <div>
                    <CircleAlert size={20} />
                    <section>
                      <strong>두 저장본이 서로 다릅니다.</strong>
                      <span>
                        자동 선택하지 않습니다. 계정 저장본을 불러오거나, 현재 이
                        기기 데이터를 유지한 뒤 직접 서버에 저장하세요.
                      </span>
                    </section>
                  </div>
                  <div>
                    <button
                      className="secondary-button"
                      onClick={cloudSync.useCloudCopy}
                    >
                      계정 데이터 불러오기
                    </button>
                    <button
                      className="primary-button"
                      onClick={cloudSync.keepDeviceCopy}
                    >
                      이 기기 데이터 유지
                    </button>
                  </div>
                </div>
              )}
              {cloudSync.hasDeviceBackup && (
                <div className="device-backup-card">
                  <DatabaseBackup size={20} />
                  <div>
                    <strong>로그인 전 이 기기 데이터가 보관되어 있습니다.</strong>
                    <span>
                      복원하면 현재 계정 데이터를 이 기기의 백업으로 교체합니다.
                    </span>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "화면의 데이터를 이 기기 백업으로 교체할까요? 서버에는 저장 버튼을 누르기 전까지 반영되지 않습니다.",
                        )
                      )
                        cloudSync.restoreDeviceBackup();
                    }}
                  >
                    백업 복원
                  </button>
                </div>
              )}
              {cloudSync.hasServerBackup && (
                <div className="device-backup-card server-backup-card">
                  <DatabaseBackup size={20} />
                  <div>
                    <strong>서버의 바로 이전 저장본이 보관되어 있습니다.</strong>
                    <span>
                      잘못 덮어쓴 경우 직전 상태로 되돌릴 수 있습니다. 복원 전 현재
                      서버본도 교대 백업됩니다.
                    </span>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      if (window.confirm("서버의 바로 이전 저장본으로 복원할까요?"))
                        void cloudSync.restoreServerBackup();
                    }}
                    disabled={busy}
                  >
                    이전 서버본
                  </button>
                </div>
              )}
              <div className="account-actions">
                <button
                  className="primary-button"
                  onClick={() => void cloudSync.syncNow()}
                  disabled={
                    busy ||
                    cloudSync.state === "SYNCED" ||
                    cloudSync.state === "CONFLICT"
                  }
                >
                  {busy ? (
                    <LoaderCircle className="spin-icon" size={16} />
                  ) : (
                    <Cloud size={16} />
                  )}
                  {cloudSync.state === "SYNCED"
                    ? "저장할 변경 없음"
                    : "이 기기 데이터를 계정에 저장"}
                </button>
                {cloudSync.state === "ERROR" && (
                  <button
                    className="secondary-button"
                    onClick={() => window.location.reload()}
                  >
                    계정 데이터 다시 불러오기
                  </button>
                )}
                <button className="secondary-button" onClick={cloudSync.signOut}>
                  <LogOut size={16} /> 로그아웃
                </button>
              </div>
            </>
          ) : (
            <div className="sign-in-panel">
              <div className="sign-in-icon">
                <Cloud size={30} />
              </div>
              <h3>Google 계정으로 다른 기기에서도 이어서 사용하세요.</h3>
              <p>
                앱이 비밀번호를 저장하지 않고 Firebase의 Google 로그인을 사용합니다.
                처음 로그인하면 현재 기기의 카드·덱·전개법을 계정에 올릴지 직접
                확인할 수 있습니다.
              </p>
              <button className="primary-button" onClick={cloudSync.signIn}>
                <LogIn size={17} /> Google 계정으로 로그인
              </button>
              <small>로그인하지 않으면 지금처럼 이 기기에만 저장됩니다.</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "nav-button active" : "nav-button"}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && <b>{count}</b>}
    </button>
  );
}

function tabTitle(tab: Tab) {
  return {
    handtraps: "패트랩",
    decks: "덱",
    catalog: "전체 카드",
    cards: "카드 라이브러리",
    combos: "전개법",
    results: "검사 결과",
    trash: "휴지통",
  }[tab];
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function HandTrapScreen({
  store,
  setStore,
  openModal,
  editHandTrap,
  counts,
}: {
  store: Store;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
  openModal: () => void;
  editHandTrap: (id: string) => void;
  counts: { handTraps: number; effects: number; combos: number };
}) {
  return (
    <>
      <PageHeading
        eyebrow="INTERRUPTION LIBRARY"
        title="패트랩부터 정의하세요"
        description="등록된 패트랩은 모든 카드 효과의 대응 태그 목록에 즉시 추가됩니다."
        action={
          <button className="primary-button" onClick={openModal}>
            <Plus size={18} /> 새 패트랩 등록
          </button>
        }
      />
      <section className="metric-grid">
        <Metric
          icon={<Hand size={20} />}
          color="violet"
          value={counts.handTraps}
          label="등록된 패트랩"
        />
        <Metric
          icon={<Tag size={20} />}
          color="teal"
          value={counts.effects}
          label="정의된 효과"
        />
        <Metric
          icon={<GitBranch size={20} />}
          color="amber"
          value={counts.combos}
          label="등록된 전개법"
        />
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>패트랩 관리</h2>
            <p>
              무효 방식은 패트랩 쪽에서, 적용 가능 여부는 카드 효과 쪽에서
              정의합니다.
            </p>
          </div>
          <span className="count-label">{store.handTraps.length} ITEMS</span>
        </div>
        <div className="trap-list">
          {store.handTraps.map((trap) => (
            <div className="trap-row" key={trap.id}>
              <div className="trap-glyph">
                <Sparkles size={22} />
              </div>
              <div className="trap-copy">
                <div>
                  <h3>{trap.name}</h3>
                  {trap.builtIn && (
                    <span className="built-in">
                      <BadgeCheck size={13} /> 기본 제공
                    </span>
                  )}
                </div>
                <p>{trap.description}</p>
              </div>
              <span className="mode-chip">{disruptionSummary(trap)}</span>
              <button
                className="icon-button edit"
                aria-label={`${trap.name} 수정`}
                onClick={() => editHandTrap(trap.id)}
              >
                <Pencil size={17} />
              </button>
              {!trap.builtIn && (
                <button
                  className="icon-button danger"
                  aria-label="삭제"
                  title="휴지통으로 이동"
                  onClick={() =>
                    setStore((s) => ({
                      ...s,
                      trash: [
                        {
                          id: uid(),
                          kind: "HANDTRAP",
                          name: trap.name,
                          deletedAt: new Date().toISOString(),
                          data: trap,
                        },
                        ...s.trash,
                      ],
                      handTraps: s.handTraps.filter((x) => x.id !== trap.id),
                    }))
                  }
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="flow-panel">
        <div className="flow-title">
          <Zap size={19} />
          <span>검사 파이프라인</span>
        </div>
        <div className="flow-steps">
          <FlowStep n="01" title="패트랩 등록" text="무효 방식을 정의" active />
          <ChevronRight />
          <FlowStep
            n="02"
            title="효과별 태그 연결"
            text="직접 대응 여부 지정"
          />
          <ChevronRight />
          <FlowStep
            n="03"
            title="전개 자동 검사"
            text="모든 지점에 개별 투입"
          />
        </div>
      </section>
    </>
  );
}

function Metric({
  icon,
  color,
  value,
  label,
}: {
  icon: React.ReactNode;
  color: string;
  value: number;
  label: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${color}`}>{icon}</div>
      <div>
        <strong>{String(value).padStart(2, "0")}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

function FlowStep({
  n,
  title,
  text,
  active,
}: {
  n: string;
  title: string;
  text: string;
  active?: boolean;
}) {
  return (
    <div className={active ? "flow-step active" : "flow-step"}>
      <b>{n}</b>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function DecksScreen({
  store,
  setStore,
  openModal,
  editDeck,
}: {
  store: Store;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
  openModal: () => void;
  editDeck: (id: string) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="DECK LIBRARY"
        title="사용할 덱을 구성하세요"
        description="카드 라이브러리에서 카드를 골라 실제 투입 매수를 등록합니다. 전개법은 선택한 덱의 카드와 매수만 사용할 수 있습니다."
        action={
          <button
            className="primary-button"
            onClick={openModal}
            disabled={!store.cards.length}
          >
            <Plus size={18} /> 새 덱
          </button>
        }
      />
      {store.cards.length === 0 ? (
        <Empty
          icon={<BookOpen size={28} />}
          title="카드 등록이 먼저 필요합니다"
          text="카드 라이브러리에 카드를 등록한 뒤 덱을 구성하세요."
        />
      ) : store.decks.length === 0 ? (
        <Empty
          icon={<Layers3 size={28} />}
          title="등록된 덱이 없습니다"
          text="카드 라이브러리의 카드로 첫 덱을 만들어 보세요."
          action={
            <button className="secondary-button" onClick={openModal}>
              <Plus size={17} /> 덱 만들기
            </button>
          }
        />
      ) : (
        <div className="deck-stack">
          {store.decks.map((deck) => {
            const main = deck.entries.filter(
              (entry) => entry.section === "MAIN",
            );
            const extra = deck.entries.filter(
              (entry) => entry.section === "EXTRA",
            );
            const total = (entries: DeckEntry[]) =>
              entries.reduce((sum, entry) => sum + entry.quantity, 0);
            const verified = deck.entries.filter((entry) =>
              store.cards.some((card) => card.id === entry.cardId),
            ).length;
            const List = ({
              title,
              entries,
            }: {
              title: string;
              entries: DeckEntry[];
            }) => (
              <section className="deck-column">
                <div className="deck-column-head">
                  <h3>{title}</h3>
                  <span>{total(entries)} CARDS</span>
                </div>
                <div className="deck-card-list">
                  {entries.map((entry) => {
                    const card = store.cards.find(
                      (item) => item.id === entry.cardId,
                    );
                    return (
                      <div className="deck-card-row" key={entry.id}>
                        <div>
                          <strong>{card?.name ?? "삭제된 카드"}</strong>
                          <span>
                            {card
                              ? `${card.effects.length}개 효과 등록 · ${card.kind === "MONSTER" ? MONSTER_TYPE_LABEL[card.monsterType ?? "EFFECT"] + " 몬스터" : card.kind === "SPELL" ? "마법 카드" : "함정 카드"}`
                              : "카드 라이브러리에서 삭제됨"}
                          </span>
                        </div>
                        <b>×{entry.quantity}</b>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
            return (
              <article className="deck-panel" key={deck.id}>
                <div className="deck-hero">
                  <div>
                    <div className="deck-title-row">
                      <div className="deck-icon">
                        <Layers3 size={24} />
                      </div>
                      <div>
                        <span className="eyebrow">USER DECK</span>
                        <h2>{deck.name}</h2>
                      </div>
                    </div>
                    <p>{deck.description || "설명 없음"}</p>
                  </div>
                  <div className="deck-hero-actions">
                    <div className="deck-metrics">
                      <div>
                        <strong>{total(main)}</strong>
                        <span>MAIN</span>
                      </div>
                      <div>
                        <strong>{total(extra)}</strong>
                        <span>EXTRA</span>
                      </div>
                      <div>
                        <strong>{verified}</strong>
                        <span>연결 카드</span>
                      </div>
                    </div>
                    <div className="definition-actions">
                      <button
                        className="icon-button edit"
                        onClick={() => editDeck(deck.id)}
                        aria-label={`${deck.name} 수정`}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="icon-button danger"
                        onClick={() =>
                          setStore((current) => ({
                            ...current,
                            decks: current.decks.filter(
                              (item) => item.id !== deck.id,
                            ),
                            trash: [
                              {
                                id: uid(),
                                kind: "DECK",
                                name: deck.name,
                                deletedAt: new Date().toISOString(),
                                data: deck,
                              },
                              ...current.trash,
                            ],
                          }))
                        }
                        aria-label={`${deck.name} 삭제`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="deck-columns">
                  <List title="메인 덱" entries={main} />
                  <List title="엑스트라 덱" entries={extra} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function DeckModal({
  cards,
  initialDeck,
  onClose,
  onSave,
}: {
  cards: Card[];
  initialDeck?: Deck;
  onClose: () => void;
  onSave: (deck: Deck) => void;
}) {
  const isExtra = (card: Card) =>
    card.kind === "MONSTER" &&
    ["FUSION", "SYNCHRO", "XYZ", "LINK"].includes(card.monsterType ?? "");
  const [name, setName] = useState(initialDeck?.name ?? "");
  const [description, setDescription] = useState(
    initialDeck?.description ?? "",
  );
  const [entries, setEntries] = useState<DeckEntry[]>(
    initialDeck?.entries.map((entry) => ({ ...entry })) ?? [],
  );
  const addCard = (section: DeckEntry["section"]) => {
    const candidate = cards.find(
      (card) =>
        (section === "EXTRA") === isExtra(card) &&
        !entries.some((entry) => entry.cardId === card.id),
    );
    if (candidate)
      setEntries((list) => [
        ...list,
        { id: uid(), cardId: candidate.id, quantity: 1, section },
      ]);
  };
  const cardOptions = (section: DeckEntry["section"]) =>
    cards.filter((card) => (section === "EXTRA") === isExtra(card));
  const updateEntry = (id: string, patch: Partial<DeckEntry>) =>
    setEntries((list) =>
      list.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  const total = (section: DeckEntry["section"]) =>
    entries
      .filter((entry) => entry.section === section)
      .reduce((sum, entry) => sum + entry.quantity, 0);
  return (
    <ModalShell
      title={initialDeck ? "덱 수정" : "새 덱 만들기"}
      subtitle="카드 라이브러리에서 메인·엑스트라 덱 카드와 실제 투입 매수를 선택합니다."
      onClose={onClose}
    >
      <div className="form-body">
        <Field label="덱 이름">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 나의 전개 검증 덱"
            autoFocus
          />
        </Field>
        <Field label="설명">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="덱의 목적이나 메모"
          />
        </Field>
        <div className="deck-builder-grid">
          {(["MAIN", "EXTRA"] as const).map((section) => (
            <div className="builder-section" key={section}>
              <div className="builder-heading">
                <div>
                  <h3>{section === "MAIN" ? "메인 덱" : "엑스트라 덱"}</h3>
                  <p>{total(section)}장 · 각 카드 최대 3장</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => addCard(section)}
                  disabled={
                    !cardOptions(section).some(
                      (card) =>
                        !entries.some((entry) => entry.cardId === card.id),
                    )
                  }
                >
                  <Plus size={15} /> 카드 추가
                </button>
              </div>
              {entries.filter((entry) => entry.section === section).length ===
              0 ? (
                <div className="inline-empty">등록된 카드가 없습니다.</div>
              ) : (
                entries
                  .filter((entry) => entry.section === section)
                  .map((entry) => (
                    <div className="deck-entry-editor" key={entry.id}>
                      <select
                        value={entry.cardId}
                        onChange={(event) =>
                          updateEntry(entry.id, { cardId: event.target.value })
                        }
                      >
                        {cardOptions(section).map((card) => (
                          <option
                            value={card.id}
                            key={card.id}
                            disabled={entries.some(
                              (other) =>
                                other.id !== entry.id &&
                                other.cardId === card.id,
                            )}
                          >
                            {card.name}
                          </option>
                        ))}
                      </select>
                      <label>
                        <select
                          className="deck-quantity-select"
                          value={entry.quantity}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              quantity: Number(event.target.value),
                            })
                          }
                          aria-label="카드 매수"
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                        <span>장</span>
                      </label>
                      <button
                        className="icon-button danger"
                        onClick={() =>
                          setEntries((list) =>
                            list.filter((item) => item.id !== entry.id),
                          )
                        }
                        aria-label="덱에서 제거"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
              )}
            </div>
          ))}
        </div>
      </div>
      <ModalActions
        onClose={onClose}
        onSave={() =>
          onSave({
            id: initialDeck?.id ?? uid(),
            name: name.trim(),
            description: description.trim(),
            entries,
          })
        }
        disabled={
          !name.trim() ||
          entries.length === 0 ||
          entries.some((entry, index) =>
            entries.some(
              (other, otherIndex) =>
                index !== otherIndex && entry.cardId === other.cardId,
            ),
          )
        }
      />
    </ModalShell>
  );
}

function CardCatalogScreen({
  store,
  setStore,
  editCard,
}: {
  store: Store;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
  editCard: (cardId: string) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [catalogInteractions, setCatalogInteractions] =
    useState<CatalogHandTrapInteractions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"ALL" | "Monster" | "Spell" | "Trap">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBatch, setReviewBatch] = useState(1);
  const [reviewFilter, setReviewFilter] = useState<
    CatalogReviewStatus | "ALL" | "UNCLASSIFIED"
  >("ALL");

  useEffect(() => {
    const controller = new AbortController();
    const loadCatalog = async () => {
      try {
        const manifestResponse = await fetch(CATALOG_MANIFEST_URL, {
          signal: controller.signal,
          cache: "force-cache",
        });
        if (!manifestResponse.ok)
          throw new Error("전체 카드 목록을 불러오지 못했습니다.");

        const manifest = (await manifestResponse.json()) as CatalogManifest;
        if (!Array.isArray(manifest.parts) || manifest.parts.length === 0)
          throw new Error("전체 카드 목록이 비어 있습니다.");

        const cardParts = await Promise.all(
          manifest.parts.map(async (part) => {
            const response = await fetch(`${CATALOG_BASE_URL}/${part}`, {
              signal: controller.signal,
              cache: "force-cache",
            });
            if (!response.ok)
              throw new Error("전체 카드 파일 일부를 불러오지 못했습니다.");
            const cards = (await response.json()) as CatalogCard[];
            if (!Array.isArray(cards))
              throw new Error("전체 카드 파일 형식이 올바르지 않습니다.");
            return cards;
          }),
        );
        const cards = cardParts.flat();
        if (cards.length === 0 || cards.length !== manifest.cardCount)
          throw new Error("전체 카드 파일이 비어 있습니다.");
        const interactionResponse = await fetch(
          `${CATALOG_BASE_URL}/handtrap-interactions.json`,
          {
            signal: controller.signal,
            cache: "force-cache",
          },
        );
        if (!interactionResponse.ok)
          throw new Error("패트랩 상호작용 파일을 불러오지 못했습니다.");
        const interactionPayload =
          (await interactionResponse.json()) as CatalogHandTrapInteractions;
        if (interactionPayload.cardCount !== manifest.cardCount)
          throw new Error("패트랩 상호작용 카드 수가 올바르지 않습니다.");
        setCatalogInteractions(interactionPayload);
        setCatalog({
          updatedAt: manifest.updatedAt,
          source: manifest.source,
          cards,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "전체 카드를 불러오지 못했습니다.",
        );
      }
    };
    void loadCatalog();
    return () => controller.abort();
  }, []);

  const filteredCards = useMemo(() => {
    if (!catalog) return [];
    const needle = query.trim().toLocaleLowerCase("ko-KR");
    return catalog.cards.filter((card) => {
      if (kind !== "ALL" && card.c !== kind) return false;
      if (!needle) return true;
      return `${card.n}\n${card.t}\n${card.e}`
        .toLocaleLowerCase("ko-KR")
        .includes(needle);
    });
  }, [catalog, kind, query]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredCards.length / CATALOG_PAGE_SIZE),
  );
  const safePage = Math.min(page, pageCount);
  const visibleCards = filteredCards.slice(
    (safePage - 1) * CATALOG_PAGE_SIZE,
    safePage * CATALOG_PAGE_SIZE,
  );
  const libraryByCatalogId = useMemo(
    () => new Map(store.cards.map((card) => [card.id, card])),
    [store.cards],
  );
  const libraryByName = useMemo(
    () => new Map(store.cards.map((card) => [card.name, card])),
    [store.cards],
  );
  const reviewBatchCount = Math.ceil(
    (catalog?.cards.length ?? CATALOG_CARD_COUNT) / CATALOG_REVIEW_BATCH_SIZE,
  );
  const reviewBatchCards = useMemo(() => {
    if (!catalog) return [];
    const start = (reviewBatch - 1) * CATALOG_REVIEW_BATCH_SIZE;
    return catalog.cards.slice(start, start + CATALOG_REVIEW_BATCH_SIZE);
  }, [catalog, reviewBatch]);
  const reviewRows = useMemo(
    () =>
      reviewBatchCards.map((card, index) => {
        const review = catalogReviewFor(card.i);
        const status: CatalogReviewStatus | "UNCLASSIFIED" =
          review?.status ?? "UNCLASSIFIED";
        return {
          card,
          globalIndex:
            (reviewBatch - 1) * CATALOG_REVIEW_BATCH_SIZE + index + 1,
          review,
          status,
          classified: catalogToLibraryCard(
            card,
            store.handTraps,
            catalogInteractions,
          ),
        };
      }),
    [catalogInteractions, reviewBatch, reviewBatchCards, store.handTraps],
  );
  const visibleReviewRows = reviewRows.filter(
    (row) => reviewFilter === "ALL" || row.status === reviewFilter,
  );
  const batchVerifiedCount = reviewRows.filter(
    (row) => row.status === "VERIFIED",
  ).length;
  const batchDraftCount = reviewRows.filter(
    (row) => row.status === "DRAFT",
  ).length;
  const batchNoEffectCount = reviewRows.filter(
    (row) => row.status === "NO_EFFECT",
  ).length;
  const batchHoldCount = reviewRows.filter(
    (row) => row.status === "HOLD",
  ).length;
  const batchClassifiedCount =
    batchVerifiedCount + batchDraftCount + batchNoEffectCount + batchHoldCount;
  const batchTotalCount = reviewRows.length;
  const classifiedOverall = FIRST_REVIEW_BATCH_IDS.size;

  const importCard = (catalogCard: CatalogCard) => {
    const imported = catalogToLibraryCard(
      catalogCard,
      store.handTraps,
      catalogInteractions,
    );
    setStore((current) => {
      if (
        current.cards.some(
          (card) => card.id === imported.id || card.name === imported.name,
        )
      )
        return current;
      return { ...current, cards: [...current.cards, imported] };
    });
  };

  return (
    <>
      <PageHeading
        eyebrow="COMPLETE OCG / TCG CATALOG"
        title="한국어 카드 13,982장을 검색하세요"
        description="전체 카드에서 가져오면 ①·②·③ 효과를 자동으로 나누고, 명시된 효과 문구를 기준으로 태그와 대응 패트랩을 제안합니다. 자동 분류 결과는 카드 편집에서 검토할 수 있습니다."
        action={
          <button
            className={reviewOpen ? "primary-button" : "secondary-button"}
            onClick={() => setReviewOpen((value) => !value)}
          >
            <Bot size={17} />
            {reviewOpen ? "분류 작업대 닫기" : "100장 분류 작업대"}
          </button>
        }
      />
      {reviewOpen && (
        <section className="catalog-review-workbench">
          <div className="review-workbench-head">
            <div>
              <span>AI CLASSIFICATION QUEUE</span>
              <h2>100장 단위 분류 작업대</h2>
              <p>
                키워드 초안과 공식 DB·Q&A 기반 정밀 검수를 구분합니다. 직접 체인,
                사전 차단, 처리 후 제약을 섞지 않고 효과마다 근거를 남깁니다.
              </p>
            </div>
            <div className="review-overall-progress">
              <strong>
                {classifiedOverall.toLocaleString("ko-KR")} /{" "}
                {(catalog?.cards.length ?? CATALOG_CARD_COUNT).toLocaleString("ko-KR")}
              </strong>
              <span>초안 상태 지정 진행률</span>
              <div>
                <i
                  style={{
                    width: `${(classifiedOverall / (catalog?.cards.length ?? CATALOG_CARD_COUNT)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="review-batch-toolbar">
            <button
              className="secondary-button"
              disabled={reviewBatch === 1}
              onClick={() => setReviewBatch((value) => Math.max(1, value - 1))}
            >
              이전 100장
            </button>
            <div>
              <strong>
                {reviewBatch} / {reviewBatchCount} 묶음
              </strong>
              <span>
                {(reviewBatch - 1) * CATALOG_REVIEW_BATCH_SIZE + 1}–
                {Math.min(
                  reviewBatch * CATALOG_REVIEW_BATCH_SIZE,
                  catalog?.cards.length ?? CATALOG_CARD_COUNT,
                )}번 카드
              </span>
            </div>
            <button
              className="secondary-button"
              disabled={reviewBatch === reviewBatchCount}
              onClick={() =>
                setReviewBatch((value) =>
                  Math.min(reviewBatchCount, value + 1),
                )
              }
            >
              다음 100장
            </button>
          </div>

          <div className="review-batch-summary">
            <div className="review-batch-state">
              {batchClassifiedCount === batchTotalCount ? (
                <BadgeCheck size={20} />
              ) : (
                <LoaderCircle size={20} />
              )}
              <div>
                <strong>
                  {batchClassifiedCount === batchTotalCount
                    ? "초안 상태 지정 완료"
                    : "아직 분류 전"}
                </strong>
                <span>
                  정밀 검수 {batchVerifiedCount}장 · 1차 초안 {batchDraftCount}장 ·
                  효과 없음 {batchNoEffectCount}장 · 보류 {batchHoldCount}장 · 미분류{" "}
                  {batchTotalCount - batchClassifiedCount}장
                </span>
              </div>
            </div>
            <select
              value={reviewFilter}
              onChange={(event) =>
                setReviewFilter(
                  event.target.value as
                    | CatalogReviewStatus
                    | "ALL"
                    | "UNCLASSIFIED",
                )
              }
              aria-label="분류 상태 필터"
            >
              <option value="ALL">전체 상태</option>
              <option value="VERIFIED">정밀 검수</option>
              <option value="DRAFT">1차 초안</option>
              <option value="HOLD">보류</option>
              <option value="NO_EFFECT">효과 없음</option>
              <option value="UNCLASSIFIED">미분류</option>
            </select>
          </div>

          <div className="review-card-list">
            {visibleReviewRows.map(({ card, classified, globalIndex, review, status }) => {
              const operationTags = [
                ...new Set(
                  classified.effects.flatMap((effect) => effect.operationTags),
                ),
              ];
              const matchingHandTraps = [
                ...new Set(
                  classified.effects.flatMap((effect) => effect.interruptibleBy),
                ),
              ]
                .map(
                  (id) => store.handTraps.find((trap) => trap.id === id)?.name,
                )
                .filter(Boolean) as string[];
              const libraryCard =
                libraryByCatalogId.get(`catalog-card-${card.i}`) ??
                libraryByName.get(card.n);
              const statusLabel =
                status === "VERIFIED"
                  ? "정밀 검수"
                  : status === "DRAFT"
                    ? "1차 초안"
                    : status === "HOLD"
                      ? "보류"
                      : status === "NO_EFFECT"
                        ? "효과 없음"
                        : "미분류";
              return (
                <details className={`review-card-row status-${status.toLowerCase()}`} key={card.i}>
                  <summary>
                    <b>{String(globalIndex).padStart(3, "0")}</b>
                    <div>
                      <strong>{card.n}</strong>
                      <span>
                        {catalogTypeSummary(card)} · 효과 {classified.effects.length}개
                      </span>
                    </div>
                    <em>{statusLabel}</em>
                    <ChevronRight size={17} />
                  </summary>
                  <div className="review-card-detail">
                    <p>{review?.note ?? "자동 분류 전입니다. 다음 100장 검수에서 처리합니다."}</p>
                    <div className="review-tag-summary">
                      <span>처리 태그</span>
                      {operationTags.length ? (
                        operationTags.map((tag) => (
                          <b key={tag}>{OPERATION_TAG_LABEL[tag]}</b>
                        ))
                      ) : (
                        <i>없음</i>
                      )}
                    </div>
                    <div className="review-tag-summary">
                      <span>직접 대응 패트랩</span>
                      {matchingHandTraps.length ? (
                        matchingHandTraps.map((name) => <b key={name}>{name}</b>)
                      ) : (
                        <i>없음</i>
                      )}
                    </div>
                    {classified.effects.length > 0 && (
                      <div className="review-effect-list">
                        {classified.effects.map((effect) => (
                          <article key={effect.id}>
                            <strong>{effect.label}</strong>
                            <p>{effect.text}</p>
                            <span>
                              {SOURCE_ZONE_LABEL[effect.sourceZone]} ·{" "}
                              {effect.effectType === "CONTINUOUS" ? "지속효과" : "발동 효과"}
                            </span>
                            {effect.costText && (
                              <small className="review-effect-cost">
                                발동 코스트 · {effect.costText}
                              </small>
                            )}
                            <small className="review-effect-direct">
                              직접 대응 ·{" "}
                              {effect.interruptibleBy.length
                                ? effect.interruptibleBy
                                    .map(
                                      (id) =>
                                        store.handTraps.find(
                                          (trap) => trap.id === id,
                                        )?.name,
                                    )
                                    .filter(Boolean)
                                    .join(" · ")
                                : "없음"}
                            </small>
                            {effect.interactionNotes.length > 0 && (
                              <ul className="review-effect-notes">
                                {effect.interactionNotes.map((note) => (
                                  <li key={note}>{note}</li>
                                ))}
                              </ul>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                    <button
                      className={libraryCard ? "secondary-button" : "primary-button"}
                      onClick={() =>
                        libraryCard ? editCard(libraryCard.id) : importCard(card)
                      }
                    >
                      {libraryCard ? <Check size={16} /> : <Download size={16} />}
                      {libraryCard
                        ? "라이브러리 태그 편집"
                        : status === "VERIFIED"
                          ? "정밀 검수본으로 가져오기"
                          : "분류 초안으로 가져오기"}
                    </button>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}
      <div className="catalog-toolbar">
        <label className="catalog-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="카드명 또는 카드 텍스트 검색"
            aria-label="전체 카드 검색"
          />
        </label>
        <select
          value={kind}
          onChange={(event) => {
            setKind(
              event.target.value as "ALL" | "Monster" | "Spell" | "Trap",
            );
            setPage(1);
          }}
          aria-label="카드 종류 필터"
        >
          <option value="ALL">전체 종류</option>
          <option value="Monster">몬스터</option>
          <option value="Spell">마법</option>
          <option value="Trap">함정</option>
        </select>
        <span className="catalog-result-count">
          {catalog ? `${filteredCards.length.toLocaleString("ko-KR")}장` : "불러오는 중"}
        </span>
      </div>

      {!catalog && !loadError && (
        <div className="catalog-loading">
          <LoaderCircle size={24} className="spin" />
          <strong>전체 카드 목록을 여는 중입니다</strong>
          <span>첫 로딩은 기기에 따라 잠시 걸릴 수 있습니다.</span>
        </div>
      )}
      {loadError && (
        <Empty
          icon={<CircleAlert size={28} />}
          title="전체 카드를 불러오지 못했습니다"
          text={loadError}
        />
      )}
      {catalog && (
        <>
          <div className="catalog-grid">
            {visibleCards.map((card) => {
              const libraryCard =
                libraryByCatalogId.get(`catalog-card-${card.i}`) ??
                libraryByName.get(card.n);
              return (
                <article className="catalog-card" key={card.i}>
                  <div className="catalog-card-head">
                    <span>{catalogTypeSummary(card)}</span>
                    <div>
                      {catalogReviewFor(card.i) && (
                        <b className={`catalog-review-badge status-${catalogReviewFor(card.i)?.status.toLowerCase()}`}>
                          {catalogReviewFor(card.i)?.status === "VERIFIED"
                            ? "정밀 검수"
                            : catalogReviewFor(card.i)?.status === "DRAFT"
                              ? "1차 초안"
                              : catalogReviewFor(card.i)?.status === "HOLD"
                                ? "보류"
                                : "효과 없음"}
                        </b>
                      )}
                      {card.u && <b>미발매 번역</b>}
                    </div>
                  </div>
                  <h2>{card.n}</h2>
                  {card.c === "Monster" && (
                    <div className="stats">
                      <span>{card.a ?? "속성 미상"}</span>
                      <span>
                        ATK <b>{card.k ?? "?"}</b>
                      </span>
                      {catalogMonsterType(card) !== "LINK" && (
                        <span>
                          DEF <b>{card.d ?? "?"}</b>
                        </span>
                      )}
                    </div>
                  )}
                  <p className="catalog-text">
                    {[card.e, card.t].filter(Boolean).join("\n") ||
                      "등록된 카드 텍스트가 없습니다."}
                  </p>
                  <button
                    className={libraryCard ? "secondary-button" : "primary-button"}
                    onClick={() =>
                      libraryCard ? editCard(libraryCard.id) : importCard(card)
                    }
                  >
                    {libraryCard ? <Check size={16} /> : <Download size={16} />}
                    {libraryCard ? "태그 편집" : "내 라이브러리에 추가"}
                  </button>
                </article>
              );
            })}
          </div>
          {filteredCards.length === 0 && (
            <div className="catalog-no-result">
              <Search size={22} /> 검색 결과가 없습니다.
            </div>
          )}
          {filteredCards.length > 0 && (
            <div className="catalog-pagination">
              <button
                className="secondary-button"
                disabled={safePage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                이전
              </button>
              <span>
                {safePage.toLocaleString("ko-KR")} / {pageCount.toLocaleString("ko-KR")}
              </span>
              <button
                className="secondary-button"
                disabled={safePage === pageCount}
                onClick={() =>
                  setPage((value) => Math.min(pageCount, value + 1))
                }
              >
                다음
              </button>
            </div>
          )}
          <div className="catalog-source-note">
            <div>
              <DatabaseBackup size={18} />
              <p>
                데이터 스냅샷 {catalog.updatedAt} · 한국 미발매 카드 일부는
                커뮤니티 번역으로 표시됩니다. 카드 텍스트를 가져온 뒤 효과별로
                나누고 방해 태그를 직접 검토해 주세요.
              </p>
            </div>
            <span>
              <a
                href="https://www.db.yugioh-card.com/yugiohdb/?request_locale=ko"
                target="_blank"
                rel="noreferrer"
              >
                공식 카드 DB <ExternalLink size={13} />
              </a>
              <a
                href="https://github.com/DawnbrandBots/yaml-yugi"
                target="_blank"
                rel="noreferrer"
              >
                데이터 프로젝트 <ExternalLink size={13} />
              </a>
            </span>
          </div>
        </>
      )}
    </>
  );
}

function CardsScreen({
  store,
  setStore,
  openModal,
  editCard,
}: {
  store: Store;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
  openModal: () => void;
  editCard: (cardId: string) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="CARD DEFINITIONS"
        title="카드와 효과를 등록하세요"
        description="공격력·수비력을 포함해 카드를 정의하고, 각 효과마다 대응 가능한 패트랩을 직접 선택합니다."
        action={
          <button className="primary-button" onClick={openModal}>
            <Plus size={18} /> 새 카드 등록
          </button>
        }
      />
      {store.cards.length === 0 ? (
        <Empty
          icon={<BookOpen size={28} />}
          title="등록된 카드가 없습니다"
          text="첫 카드를 만들고 각 효과에 하루 우라라 대응 태그를 연결해 보세요."
          action={
            <button className="secondary-button" onClick={openModal}>
              <Plus size={17} /> 카드 등록
            </button>
          }
        />
      ) : (
        <div className="card-grid">
          {store.cards.map((card) => (
            <article className="definition-card" key={card.id}>
              <div className="definition-top">
                <div className="card-glyph">
                  <Swords size={22} />
                </div>
                <span>
                  {card.kind === "MONSTER"
                    ? `${MONSTER_TYPE_LABEL[card.monsterType ?? "EFFECT"]} 몬스터`
                    : card.kind}
                </span>
                <div className="definition-actions">
                  <button
                    className="icon-button edit"
                    aria-label={`${card.name} 수정`}
                    title="카드 수정"
                    onClick={() => editCard(card.id)}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`${card.name} 삭제`}
                    title="휴지통으로 이동"
                    onClick={() =>
                      setStore((s) => ({
                        ...s,
                        cards: s.cards.filter((x) => x.id !== card.id),
                        trash: [
                          {
                            id: uid(),
                            kind: "CARD",
                            name: card.name,
                            deletedAt: new Date().toISOString(),
                            data: card,
                          },
                          ...s.trash,
                        ],
                      }))
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
              <h2>{card.name}</h2>
              {card.kind === "MONSTER" && (
                <div className="stats">
                  <span>{monsterValueLabel(card)}</span>
                  <span>
                    ATK <b>{card.attack}</b>
                  </span>
                  {card.monsterType !== "LINK" && (
                    <span>
                      DEF <b>{card.defense}</b>
                    </span>
                  )}
                </div>
              )}
              {card.ruleText && (
                <div className="rule-text">
                  <small>효과 외 텍스트</small>
                  <p>{card.ruleText}</p>
                </div>
              )}
              <div className="effect-stack">
                {card.effects.map((effect) => (
                  <EffectDefinitionView
                    effect={effect}
                    handTraps={store.handTraps}
                    key={effect.id}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function EffectDefinitionView({
  effect,
  handTraps,
}: {
  effect: CardEffect;
  handTraps: HandTrap[];
}) {
  const tagNames = (values: string[], labels: Record<string, string>) =>
    values.map((value) => labels[value]).filter(Boolean);
  const trapNames = (values: string[]) =>
    values.map(
      (id) => handTraps.find((trap) => trap.id === id)?.name ?? "삭제됨",
    );
  const TagLine = ({
    title,
    values,
    permission,
  }: {
    title: string;
    values: string[];
    permission?: boolean;
  }) => (
    <div className={permission ? "tag-section permission" : "tag-section"}>
      <small>{title}</small>
      <div className="tag-row">
        {values.length ? (
          values.map((value) => <span key={value}>{value}</span>)
        ) : (
          <em>없음</em>
        )}
      </div>
    </div>
  );
  return (
    <div className="effect-box">
      <div>
        <b>{effect.label}</b>
        <span>{effect.text}</span>
      </div>
      <div className="effect-meta">
        <span>{EFFECT_TYPE_LABEL[effect.effectType]}</span>
        <span>{SOURCE_ZONE_LABEL[effect.sourceZone]}</span>
        <span>
          {effect.allowedTurns.map((turn) => TURN_OWNER_LABEL[turn]).join("·")}
        </span>
        <span>
          {effect.allowedPhases.length === 6
            ? "모든 페이즈"
            : effect.allowedPhases.map((phase) => PHASE_LABEL[phase]).join("·")}
        </span>
        <span>{EFFECT_USAGE_LABEL[effect.usageLimit]}</span>
      </div>
      {effect.costText && (
        <div className="effect-audit-note cost">
          <small>발동 코스트</small>
          <p>{effect.costText}</p>
        </div>
      )}
      <TagLine
        title="발동 조건"
        values={tagNames(effect.activationTags, ACTIVATION_TAG_LABEL)}
      />
      <TagLine
        title="적용 조건"
        values={tagNames(effect.applicationTags, APPLICATION_TAG_LABEL)}
      />
      <TagLine
        title="처리 내용"
        values={tagNames(effect.operationTags, OPERATION_TAG_LABEL)}
      />
      <TagLine
        title="이 효과에 직접 대응 가능한 패트랩"
        values={trapNames(effect.interruptibleBy)}
      />
      {effect.interactionNotes.length > 0 && (
        <div className="effect-audit-note">
          <small>사전 적용·조건부·처리 후 간섭</small>
          <ul>
            {effect.interactionNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
      <TagLine
        title="이 효과로 막는 패트랩"
        values={trapNames(effect.blocksHandTraps)}
        permission
      />
      {effect.grantedProfile && (
        <div className="granted-summary">
          <strong>
            {effect.grantMode === "WHILE_XYZ_MATERIAL"
              ? "엑시즈 소재 부여 효과"
              : "부여되는 효과"}{" "}
            · {effect.grantedProfile.label}
          </strong>
          <p>{effect.grantedProfile.text}</p>
          <TagLine
            title="부여 효과 발동 조건"
            values={tagNames(
              effect.grantedProfile.activationTags,
              ACTIVATION_TAG_LABEL,
            )}
          />
          <TagLine
            title="부여 효과 적용 조건"
            values={tagNames(
              effect.grantedProfile.applicationTags,
              APPLICATION_TAG_LABEL,
            )}
          />
          <TagLine
            title="부여 효과 처리 내용"
            values={tagNames(
              effect.grantedProfile.operationTags,
              OPERATION_TAG_LABEL,
            )}
          />
          <TagLine
            title="부여 효과가 맞는 패트랩"
            values={trapNames(effect.grantedProfile.interruptibleBy)}
          />
          <TagLine
            title="부여 효과로 막는 패트랩"
            values={trapNames(effect.grantedProfile.blocksHandTraps)}
            permission
          />
        </div>
      )}
    </div>
  );
}

function CombosScreen({
  store,
  setStore,
  effectIndex,
  selectedComboId,
  setSelectedComboId,
  openModal,
  editCombo,
  runCombo,
}: {
  store: Store;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
  effectIndex: Map<string, { card: Card; effect: CardEffect }>;
  selectedComboId: string;
  setSelectedComboId: (id: string) => void;
  openModal: () => void;
  editCombo: (id: string) => void;
  runCombo: () => void;
}) {
  const selected =
    store.combos.find((x) => x.id === selectedComboId) ?? store.combos[0];
  return (
    <>
      <PageHeading
        eyebrow="COMBO SCRIPTS"
        title="검증할 전개법을 구성하세요"
        description="사용할 덱을 먼저 고르고, 그 덱의 카드와 투입 매수 안에서 전개를 작성합니다."
        action={
          <div className="heading-actions">
            <button
              className="primary-button"
              onClick={openModal}
              disabled={!store.cards.length || !store.decks.length}
            >
              <Plus size={18} /> 새 전개법
            </button>
            {selected && (
              <>
                <button
                  className="ghost-button"
                  onClick={() => editCombo(selected.id)}
                >
                  <Pencil size={17} /> 수정
                </button>
                <button
                  className="ghost-button danger-action"
                  onClick={() => {
                    setStore((s) => ({
                      ...s,
                      combos: s.combos.filter(
                        (combo) => combo.id !== selected.id,
                      ),
                      trash: [
                        {
                          id: uid(),
                          kind: "COMBO",
                          name: selected.name,
                          deletedAt: new Date().toISOString(),
                          data: selected,
                        },
                        ...s.trash,
                      ],
                    }));
                    setSelectedComboId("");
                  }}
                >
                  <Trash2 size={17} /> 삭제
                </button>
              </>
            )}
          </div>
        }
      />
      {!store.cards.length ? (
        <Empty
          icon={<CircleAlert size={28} />}
          title="카드 등록이 먼저 필요합니다"
          text="전개 단계에서 사용할 카드 효과를 먼저 등록하세요."
        />
      ) : !store.decks.length ? (
        <Empty
          icon={<Layers3 size={28} />}
          title="덱 등록이 먼저 필요합니다"
          text="덱 화면에서 카드 라이브러리의 카드와 투입 매수를 등록하세요."
        />
      ) : !store.combos.length ? (
        <Empty
          icon={<GitBranch size={28} />}
          title="아직 전개법이 없습니다"
          text="등록한 덱의 카드 효과를 순서대로 연결해 첫 전개법을 만드세요."
          action={
            <button className="secondary-button" onClick={openModal}>
              <Plus size={17} /> 전개법 만들기
            </button>
          }
        />
      ) : (
        <div className="combo-layout">
          <section className="panel combo-list-panel">
            <div className="panel-head">
              <div>
                <h2>전개법</h2>
                <p>검사할 루트를 선택하세요.</p>
              </div>
            </div>
            {store.combos.map((combo) => (
              <button
                className={
                  selected?.id === combo.id
                    ? "combo-option active"
                    : "combo-option"
                }
                key={combo.id}
                onClick={() => setSelectedComboId(combo.id)}
              >
                <GitBranch size={18} />
                <div>
                  <strong>{combo.name}</strong>
                  <span>
                    {store.decks.find((deck) => deck.id === combo.deckId)
                      ?.name ?? "덱 미연결"}{" "}
                    · {combo.steps.length}단계
                  </span>
                </div>
                <ChevronRight size={17} />
              </button>
            ))}
          </section>
          <section className="panel timeline-panel">
            <div className="panel-head">
              <div>
                <h2>{selected?.name}</h2>
                <p>
                  {store.decks.find((deck) => deck.id === selected?.deckId)
                    ?.name ?? "연결된 덱 없음"}{" "}
                  · 효과와 소환, 패트랩 우회 분기
                </p>
              </div>
              <button className="run-button" onClick={runCombo}>
                <Bot size={18} /> 목표 도달 검사
              </button>
            </div>
            {selected &&
              comboDeckErrors(
                selected,
                store.decks.find((deck) => deck.id === selected.deckId),
                store.cards,
              ).length > 0 && (
                <div className="route-warning deck-route-warning">
                  {comboDeckErrors(
                    selected,
                    store.decks.find((deck) => deck.id === selected.deckId),
                    store.cards,
                  ).join(" · ")}
                </div>
              )}
            {selected && (
              <div className="combo-requirements">
                <div>
                  <small>시작 패</small>
                  <div>
                    {selected.startingHand.length ? (
                      selected.startingHand.map((entry) => (
                        <span key={entry.id}>
                          {store.cards.find((card) => card.id === entry.cardId)
                            ?.name ?? "삭제된 카드"}{" "}
                          ×{entry.quantity}
                        </span>
                      ))
                    ) : (
                      <em>미설정</em>
                    )}
                  </div>
                </div>
                <div>
                  <small>목표 상태</small>
                  <div>
                    {selected.goals.length ? (
                      selected.goals.map((goal) => (
                        <span key={goal.id}>
                          {comboGoalLabel(goal, store.cards)}
                        </span>
                      ))
                    ) : (
                      <em>미설정 · 기존 중단 판정 사용</em>
                    )}
                  </div>
                </div>
                <div>
                  <small>패트랩 대응안</small>
                  <div>
                    {selected.handTrapPlans?.length ? (
                      selected.handTrapPlans.map((plan) => (
                        <span key={plan.id}>
                          {store.handTraps.find(
                            (trap) => trap.id === plan.handTrapId,
                          )?.name ?? "삭제된 패트랩"}{" "}
                          · {HAND_TRAP_RESPONSE_LABEL[plan.strategy]}
                          {plan.strategy === "ACCEPT_WITH_LIMIT"
                            ? ` · 드로우 ${plan.maxOpponentDraws}장 / 영향 ${plan.maxAffectedSteps}단계 / 처리 ${plan.maxResolvedOperations ?? 99}회 이하`
                            : ""}
                        </span>
                      ))
                    ) : (
                      <em>미등록 · 누적형 방해는 경고</em>
                    )}
                  </div>
                </div>
              </div>
            )}
            {selected && (
              <ComboPlayback
                combo={selected}
                cards={store.cards}
                effectIndex={effectIndex}
              />
            )}
            <div className="timeline">
              {selected?.steps.map((step, index) => (
                <ComboTimelineStep
                  step={step}
                  index={index}
                  store={store}
                  effectIndex={effectIndex}
                  key={step.id}
                />
              ))}
            </div>
            {selected && selected.branches.length > 0 && (
              <div className="branch-summary">
                {selected.branches.map((branch) => (
                  <span key={branch.id}>
                    {store.handTraps.find(
                      (trap) => trap.id === branch.triggerHandTrapId,
                    )?.name ?? "삭제된 패트랩"}{" "}
                    → {branch.name} →{" "}
                    {store.combos.find(
                      (combo) => combo.id === branch.alternateComboId,
                    )?.name ?? "삭제된 전개법"}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function ComboPlayback({
  combo,
  cards,
  effectIndex,
}: {
  combo: Combo;
  cards: Card[];
  effectIndex: Map<string, { card: Card; effect: CardEffect }>;
}) {
  const frames = useMemo(
    () => buildReplayFrames(combo, cards, effectIndex),
    [combo, cards, effectIndex],
  );
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedXyz, setSelectedXyz] = useState<{
    owner: PlayerSide;
    slot: MonsterZoneSlot;
  } | null>(null);
  useEffect(() => {
    setCursor(0);
    setPlaying(false);
    setSelectedXyz(null);
  }, [combo.id]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setCursor((current) => {
          if (current >= frames.length - 1) {
            setPlaying(false);
            return current;
          }
          return current + 1;
        }),
      1250,
    );
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);
  const frame = frames[cursor];
  const cardName = (id: string) =>
    id === UNKNOWN_OPPONENT_CARD_ID
      ? "뒷면 카드"
      : (cards.find((card) => card.id === id)?.name ?? "삭제된 카드");
  const entriesAt = (owner: PlayerSide, location: CardLocation) => {
    const entries: { cardId: string; index: number }[] = [];
    frame.state.boards[owner].cards.forEach((quantity, key) => {
      const prefix = `${location}:`;
      if (!key.startsWith(prefix)) return;
      const cardId = key.slice(prefix.length);
      for (let index = 0; index < quantity; index += 1)
        entries.push({ cardId, index });
    });
    return entries;
  };
  const xyzMaterialsAt = (owner: PlayerSide, slot: MonsterZoneSlot) => {
    const entries: { cardId: string; index: number }[] = [];
    frame.state.boards[owner].xyzMaterials
      .get(slot)
      ?.forEach((quantity, cardId) => {
      for (let index = 0; index < quantity; index += 1)
        entries.push({ cardId, index });
    });
    return entries;
  };
  const CardToken = ({
    cardId,
    index,
    location,
    owner,
  }: {
    cardId: string;
    index: number;
    location: CardLocation;
    owner: PlayerSide;
  }) => {
    const entryKey = `${owner}:${location}:${cardId}:${index}`;
    const justEntered =
      location === "MONSTER_ZONE"
        ? frame.entering.some((key) =>
            key.startsWith(`${owner}:MONSTER_ZONE:${cardId}:`),
          )
        : frame.entering.includes(entryKey);
    const className = [
      "duel-card",
      frame.actionType === "EFFECT" && frame.activeCardId === cardId
        ? "effect-active"
        : "",
      justEntered ? "entering" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <div className={className} title={cardName(cardId)}>
        <span>{cardName(cardId)}</span>
        {justEntered && location === "MONSTER_ZONE" && (
          <em className="summon-badge">소환</em>
        )}
      </div>
    );
  };
  const MonsterSlot = ({
    owner,
    slot,
  }: {
    owner: PlayerSide;
    slot: MonsterZoneSlot;
  }) => {
    const cardId = frame.state.boards[owner].monsterZones.get(slot);
    const card = cards.find((entry) => entry.id === cardId);
    const materials = xyzMaterialsAt(owner, slot);
    const cardToken = cardId ? (
      <CardToken
        cardId={cardId}
        index={0}
        location="MONSTER_ZONE"
        owner={owner}
      />
    ) : null;
    return (
      <div
        className="duel-slot monster-position"
        title={MONSTER_ZONE_LABEL[slot]}
      >
        {card?.monsterType === "XYZ" ? (
          <button
            className="xyz-monster-button"
            onClick={() =>
              setSelectedXyz((current) =>
                current?.owner === owner && current.slot === slot
                  ? null
                  : { owner, slot },
              )
            }
            aria-label={`${card.name}의 엑시즈 소재 보기`}
            aria-pressed={
              selectedXyz?.owner === owner && selectedXyz.slot === slot
            }
          >
            {cardToken}
            <em className="xyz-material-count">MAT {materials.length}</em>
          </button>
        ) : (
          cardToken
        )}
        <b>
          {slot.startsWith("MAIN_")
            ? slot.slice(-1)
            : slot === "EXTRA_LEFT"
              ? "EX-L"
              : "EX-R"}
        </b>
      </div>
    );
  };
  const MonsterZoneBoard = ({ owner }: { owner: PlayerSide }) => (
    <div
      className={`duel-zone duel-zone-monster_zone duel-owner-${owner.toLowerCase()}`}
    >
      <small>메인 몬스터 존</small>
      <div>
        {MAIN_MONSTER_ZONES.map((slot) => (
          <MonsterSlot owner={owner} slot={slot} key={slot} />
        ))}
      </div>
    </div>
  );
  const Zone = ({
    location,
    slots = 5,
    owner,
  }: {
    location: CardLocation;
    slots?: number;
    owner: PlayerSide;
  }) => {
    const entries = entriesAt(owner, location);
    return (
      <div
        className={`duel-zone duel-zone-${location.toLowerCase()} duel-owner-${owner.toLowerCase()}`}
      >
        <small>{LOCATION_LABEL[location]}</small>
        <div>
          {Array.from(
            { length: Math.max(slots, entries.length) },
            (_, index) => {
              const entry = entries[index];
              return (
                <div
                  className="duel-slot"
                  key={`${owner}-${location}-${index}`}
                >
                  {entry && (
                    <CardToken
                      cardId={entry.cardId}
                      index={entry.index}
                      location={location}
                      owner={owner}
                    />
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>
    );
  };
  const pileLocations: CardLocation[] = [
    "GRAVEYARD",
    "BANISHED",
    "DECK",
    "EXTRA_DECK",
  ];
  const selectedXyzHost = selectedXyz
    ? frame.state.boards[selectedXyz.owner].monsterZones.get(selectedXyz.slot)
    : undefined;
  const selectedXyzMaterials = selectedXyz
    ? xyzMaterialsAt(selectedXyz.owner, selectedXyz.slot)
    : [];
  return (
    <section className="combo-playback">
      <div className="playback-head">
        <div>
          <Sparkles size={17} />
          <div>
            <strong>전개 시뮬레이터</strong>
            <span>
              {cursor}/{frames.length - 1}단계 · {frame.title}
            </span>
          </div>
        </div>
        <div className="playback-controls">
          <button
            onClick={() => {
              setPlaying(false);
              setCursor(0);
            }}
            aria-label="처음"
          >
            <SkipBack size={17} />
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setCursor((value) => Math.max(0, value - 1));
            }}
            disabled={cursor === 0}
            aria-label="이전 단계"
          >
            <ChevronRight className="reverse-icon" size={18} />
          </button>
          <button
            className="play-main"
            onClick={() => {
              if (cursor === frames.length - 1) setCursor(0);
              setPlaying((value) => !value);
            }}
            aria-label={playing ? "일시 정지" : "자동 재생"}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setCursor((value) => Math.min(frames.length - 1, value + 1));
            }}
            disabled={cursor === frames.length - 1}
            aria-label="다음 단계"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setCursor(frames.length - 1);
            }}
            aria-label="마지막"
          >
            <SkipForward size={17} />
          </button>
        </div>
      </div>
      <div className="duel-stage" key={`${combo.id}-${cursor}`}>
        <div className="opponent-status">
          <span>OPPONENT</span>
          <strong>LP {frame.state.opponentLP.toLocaleString()}</strong>
        </div>
        {frame.state.pendingChains.size > 0 && (
          <div className="chain-stack">
            {[...frame.state.pendingChains.entries()].map(
              ([chainId, links]) => (
                <div key={chainId}>
                  <strong>{links[0]?.step.chainLabel ?? "체인"}</strong>
                  {links.map((link, linkIndex) => {
                    const item = effectIndex.get(link.step.effectId);
                    return (
                      <span key={link.step.id}>
                        CL{linkIndex + 1} · {item?.card.name ?? "삭제된 카드"} ·{" "}
                        {item?.effect.label ?? "삭제된 효과"}
                      </span>
                    );
                  })}
                </div>
              ),
            )}
          </div>
        )}
        <Zone
          owner="OPPONENT"
          location="HAND"
          slots={Math.max(5, entriesAt("OPPONENT", "HAND").length)}
        />
        <div className="player-field opponent-player-field">
          <div className="field-side-zones">
            <Zone owner="OPPONENT" location="FIELD_ZONE" slots={1} />
            <Zone owner="OPPONENT" location="PENDULUM_ZONE" slots={1} />
          </div>
          <MonsterZoneBoard owner="OPPONENT" />
          <Zone owner="OPPONENT" location="SPELL_TRAP_ZONE" />
        </div>
        <div className="field-divider">
          <i />
        </div>
        <div className="extra-monster-zone-row shared-extra-row">
          {EXTRA_MONSTER_ZONES.map((slot) => {
            const owner = frame.state.boards.SELF.monsterZones.has(slot)
              ? "SELF"
              : frame.state.boards.OPPONENT.monsterZones.has(slot)
                ? "OPPONENT"
                : "SELF";
            return <MonsterSlot owner={owner} slot={slot} key={slot} />;
          })}
        </div>
        <div className="player-field">
          <div className="field-side-zones">
            <Zone owner="SELF" location="FIELD_ZONE" slots={1} />
            <Zone owner="SELF" location="PENDULUM_ZONE" slots={1} />
          </div>
          <MonsterZoneBoard owner="SELF" />
          <Zone owner="SELF" location="SPELL_TRAP_ZONE" />
        </div>
        <Zone
          owner="SELF"
          location="HAND"
          slots={Math.max(5, entriesAt("SELF", "HAND").length)}
        />
        {selectedXyz && selectedXyzHost && (
          <div className="xyz-material-panel">
            <div>
              <div>
                <small>XYZ MATERIALS</small>
                <strong>{cardName(selectedXyzHost)}</strong>
                <span>
                  {PLAYER_SIDE_LABEL[selectedXyz.owner]} ·{" "}
                  {MONSTER_ZONE_LABEL[selectedXyz.slot]}
                </span>
              </div>
              <button
                onClick={() => setSelectedXyz(null)}
                aria-label="엑시즈 소재 닫기"
              >
                <X size={15} />
              </button>
            </div>
            {selectedXyzMaterials.length ? (
              <ul>
                {selectedXyzMaterials.map((material) => (
                  <li key={`${material.cardId}-${material.index}`}>
                    <span>{cardName(material.cardId)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>부착된 엑시즈 소재가 없습니다.</p>
            )}
          </div>
        )}
        {frame.actionType === "EFFECT" && frame.activeCardId && (
          <div className="activation-focus">
            <Zap size={16} />
            <div>
              <small>EFFECT ACTIVATION</small>
              <strong>{cardName(frame.activeCardId)}</strong>
            </div>
          </div>
        )}
        {frame.leaving.length > 0 && (
          <div className="leaving-layer">
            {frame.leaving.map((item, index) => (
              <div
                className="departure-notice"
                key={`${item.owner}-${item.cardId}-${index}`}
              >
                <X size={14} />
                <div>
                  <small>{PLAYER_SIDE_LABEL[item.owner]} 카드 이동</small>
                  <strong>{cardName(item.cardId)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
        {frame.state.specialWin && (
          <div className="special-win">
            <Trophy size={24} />
            <strong>SPECIAL WIN</strong>
            <span>{frame.state.specialWinText}</span>
          </div>
        )}
      </div>
      <div className="pile-row dual-pile-row">
        {(["OPPONENT", "SELF"] as PlayerSide[]).flatMap((owner) =>
          pileLocations.map((location) => (
            <div key={`${owner}-${location}`}>
              <small>
                {PLAYER_SIDE_LABEL[owner]} · {LOCATION_LABEL[location]}
              </small>
              <strong>{entriesAt(owner, location).length}</strong>
              <span>
                {entriesAt(owner, location)
                  .slice(0, 2)
                  .map((entry) => cardName(entry.cardId))
                  .join(" · ") || "비어 있음"}
              </span>
            </div>
          )),
        )}
      </div>
      <div className="playback-caption">
        <strong>{frame.title}</strong>
        <span>{frame.detail}</span>
      </div>
      <input
        className="playback-range"
        type="range"
        min="0"
        max={frames.length - 1}
        value={cursor}
        onChange={(e) => {
          setPlaying(false);
          setCursor(Number(e.target.value));
        }}
      />
    </section>
  );
}

function ComboTimelineStep({
  step,
  index,
  store,
  effectIndex,
}: {
  step: ComboStep;
  index: number;
  store: Store;
  effectIndex: Map<string, { card: Card; effect: CardEffect }>;
}) {
  if (step.actionType === "CHAIN_RESOLVE") {
    const combo = store.combos.find((candidate) =>
      candidate.steps.some((item) => item.id === step.id),
    );
    const links = pendingChainLinksBefore(
      combo?.steps ?? [],
      step.chainId,
      index,
    );
    return (
      <div className="timeline-row chain-resolve-row">
        <div className="step-number">{index + 1}</div>
        <div>
          <strong>{step.chainLabel} · 체인 처리</strong>
          <span>
            {links.length
              ? [...links]
                  .reverse()
                  .map((link, reverseIndex) => {
                    const item = effectIndex.get(link.effectId);
                    return `CL${links.length - reverseIndex} ${item?.card.name ?? "삭제된 카드"} · ${item?.effect.label ?? "삭제된 효과"}`;
                  })
                  .join(" → ")
              : "등록된 링크 없음"}
          </span>
          <div className="tag-row">
            <span>마지막 링크부터 역순 처리</span>
          </div>
        </div>
        <span className="chain-chip">RESOLVE</span>
      </div>
    );
  }
  const item = effectIndex.get(step.effectId);
  const actor =
    store.cards.find((card) => card.id === step.actingCardId) ?? item?.card;
  const summoned = store.cards.find((card) => card.id === step.summonedCardId);
  const trapIds =
    step.actionType === "SUMMON"
      ? step.summonInterruptibleBy
      : (item?.effect.interruptibleBy ?? []);
  return (
    <div className="timeline-row">
      <div className="step-number">{index + 1}</div>
      <div>
        <strong>
          {step.actionType === "SUMMON"
            ? `${summoned?.name ?? "삭제된 몬스터"} · ${SUMMON_TYPE_LABEL[step.summonType]}`
            : `${actor?.name ?? "삭제된 카드"} · ${item?.effect.label ?? "삭제된 효과"}${actor?.id !== item?.card.id ? " (부여받은 효과)" : ""}`}
        </strong>
        <span>
          {step.actionType === "SUMMON"
            ? `${TURN_OWNER_LABEL[step.turnOwner]} · ${PHASE_LABEL[step.phase]} · ${LOCATION_LABEL[step.summonFrom]}에서 ${step.summonCount}장 · ${MONSTER_ZONE_LABEL[step.summonZone]}`
            : `${item?.effect.text ?? ""}${step.effectExecutionMode === "CHAIN_REGISTER" ? ` · ${step.chainLabel} 체인 링크 등록` : ""}`}
        </span>
        <div className="tag-row">
          {trapIds.map((id) => (
            <span key={id}>
              {store.handTraps.find((trap) => trap.id === id)?.name ?? "삭제됨"}
            </span>
          ))}
        </div>
        {step.costEvents.length > 0 && (
          <div className="permission-event-list cost-event-list">
            {step.costEvents.map((event) => (
              <span key={event.id}>
                발동 코스트 · {PLAYER_SIDE_LABEL[event.owner ?? "SELF"]} ·{" "}
                {LOCATION_LABEL[event.zone]} ·{" "}
                {event.zone === "XYZ_MATERIAL"
                  ? `${MONSTER_ZONE_LABEL[event.xyzHostZone ?? "MAIN_3"]} · `
                  : ""}
                {event.cardId === UNKNOWN_OPPONENT_CARD_ID
                  ? "임의의 상대 카드"
                  : (store.cards.find((card) => card.id === event.cardId)
                      ?.name ?? "삭제된 카드")} {" "}
                ×{event.quantity} {event.action === "SUMMON" ? "추가" : "제거"}
              </span>
            ))}
          </div>
        )}
        {step.materials.length > 0 && (
          <div className="permission-event-list">
            {step.materials.map((material) => (
              <span key={material.id}>
                소재 ·{" "}
                {store.cards.find((card) => card.id === material.cardId)
                  ?.name ?? "삭제된 카드"}{" "}
                ×{material.quantity} · {LOCATION_LABEL[material.from]} →{" "}
                {LOCATION_LABEL[material.destination]}
                {material.destination === "XYZ_MATERIAL"
                  ? ` (${MONSTER_ZONE_LABEL[step.summonZone]})`
                  : ""}
              </span>
            ))}
          </div>
        )}
        {step.zoneEvents.length > 0 && (
          <div className="permission-event-list">
            {step.zoneEvents.map((event) => (
              <span key={event.id}>
                처리 시 · {PLAYER_SIDE_LABEL[event.owner ?? "SELF"]} ·{" "}
                {LOCATION_LABEL[event.zone]}
                {event.zone === "MONSTER_ZONE"
                  ? ` (${MONSTER_ZONE_LABEL[event.monsterZone ?? "MAIN_3"]})`
                  : event.zone === "XYZ_MATERIAL"
                    ? ` (${MONSTER_ZONE_LABEL[event.xyzHostZone ?? "MAIN_3"]})`
                  : ""}{" "}
                ·{" "}
                {event.cardId === UNKNOWN_OPPONENT_CARD_ID
                  ? "임의의 상대 카드"
                  : (store.cards.find((card) => card.id === event.cardId)
                      ?.name ?? "삭제된 카드")} {" "}
                ×{event.quantity} {event.action === "SUMMON" ? "추가" : "제거"}
              </span>
            ))}
          </div>
        )}
        {(step.opponentLpChange !== 0 || step.declaresSpecialWin) && (
          <div className="permission-event-list">
            <span>
              {step.opponentLpChange !== 0
                ? `상대 LP ${step.opponentLpChange > 0 ? "+" : ""}${step.opponentLpChange}`
                : ""}
              {step.declaresSpecialWin
                ? ` · 특수 승리: ${step.specialWinText}`
                : ""}
            </span>
          </div>
        )}
        {step.permissionEvents.length > 0 && (
          <div className="permission-event-list">
            {step.permissionEvents.map((event) => (
              <span key={event.id}>
                {PERMISSION_EVENT_LABEL[event.action]} ·{" "}
                {effectIndex.get(event.permissionEffectId)?.card.name ??
                  "삭제된 카드"}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className={step.stopsWhenNegated ? "stop-chip" : "survive-chip"}>
        {step.stopsWhenNegated ? "실패 시 후속 중단" : "실패해도 후속 진행"}
      </span>
    </div>
  );
}

function ResultsScreen({ runs }: { runs: TestRun[] }) {
  const latest = runs[0];
  const isFailed = (point: TestPoint) =>
    point.goalReached === undefined ? point.stopped : !point.goalReached;
  const failedPoints = latest?.points.filter(isFailed) ?? [];
  const summaries = latest?.summaries ?? [];
  const failedSummaries = summaries.filter((summary) => !summary.passed);
  const overallFailed =
    latest?.baselineGoalReached === false ||
    (summaries.length > 0
      ? failedSummaries.length > 0
      : failedPoints.length > 0);
  return (
    <>
      <PageHeading
        eyebrow="TEST REPORT"
        title="목표 상태 도달 검사 결과"
        description="단발 투입 지점과 누적형 패트랩의 반복 적용을 함께 재현하고, 등록한 대응 한도와 최종 목표 달성 여부로 판정합니다."
      />
      {!latest ? (
        <Empty
          icon={<Activity size={28} />}
          title="아직 검사 결과가 없습니다"
          text="전개법 화면에서 전체 지점 검사를 실행하세요."
        />
      ) : (
        <>
          <section className="result-hero">
            <div>
              <span>LATEST RUN</span>
              <h2>{latest.comboName}</h2>
              <p>
                {new Date(latest.createdAt).toLocaleString("ko-KR")} · 무방해
                기준{" "}
                {latest.baselineGoalReached === false
                  ? `목표 미달 (${latest.baselineMissingGoal?.join(", ")})`
                  : "목표 도달"}
              </p>
            </div>
            <div className={overallFailed ? "verdict fail" : "verdict pass"}>
              <strong>
                {latest.baselineGoalReached === false
                  ? "기본 전개부터 목표 미달"
                  : failedSummaries.length || failedPoints.length
                    ? "패트랩 대응 기준 미달"
                    : "모든 대응 기준 통과"}
              </strong>
              <span>
                {summaries.length > 0
                  ? `${failedSummaries.length}개 실패 / ${summaries.length}종 패트랩 종합 검사`
                  : `${failedPoints.length}개 실패 / ${latest.points.length}개 패트랩 검사`}
              </span>
            </div>
          </section>
          {summaries.length > 0 && (
            <section className="panel handtrap-summary-panel">
              <div className="panel-head">
                <div>
                  <h2>패트랩별 종합 판정</h2>
                  <p>
                    단발 투입 지점뿐 아니라 턴 동안 반복되는 드로우·잔존 효과와
                    등록한 대응 한도를 함께 검사합니다.
                  </p>
                </div>
              </div>
              <div className="handtrap-summary-list">
                {summaries.map((summary) => (
                  <article
                    className={
                      summary.passed
                        ? "handtrap-summary-card pass"
                        : "handtrap-summary-card fail"
                    }
                    key={summary.handTrapId}
                  >
                    <div className="handtrap-summary-head">
                      <div>
                        <span>{summary.role}</span>
                        <h3>{summary.handTrapName}</h3>
                      </div>
                      <b>{summary.passed ? "통과" : "재검토"}</b>
                    </div>
                    <div className="handtrap-summary-metrics">
                      <span>격발 {summary.triggerCount}회</span>
                      <span>영향 {summary.affectedSteps}단계</span>
                      {summary.opponentDraws > 0 && (
                        <span>상대 드로우 {summary.opponentDraws}장</span>
                      )}
                      {(summary.endPhaseReturns ?? 0) > 0 && (
                        <span>엔드 덱 반환 {summary.endPhaseReturns}장</span>
                      )}
                      {(summary.blockedSteps ?? 0) > 0 && (
                        <span>코스트 불가 {summary.blockedSteps}단계</span>
                      )}
                      {(summary.redirectedSteps ?? 0) > 0 && (
                        <span>위치 치환 {summary.redirectedSteps}단계</span>
                      )}
                      {(summary.resolvedOperations ?? 0) > 0 && (
                        <span>처리 적용 {summary.resolvedOperations}회</span>
                      )}
                      {summary.blockedCount > 0 && (
                        <span>퍼미션 차단 {summary.blockedCount}회</span>
                      )}
                      {summary.bypassedCount > 0 && (
                        <span>우회 {summary.bypassedCount}곳</span>
                      )}
                    </div>
                    <p>
                      <strong>
                        {summary.planned
                          ? HAND_TRAP_RESPONSE_LABEL[summary.strategy]
                          : "대응안 미등록"}
                      </strong>
                      {summary.reason}
                    </p>
                    {summary.notes && <small>{summary.notes}</small>}
                  </article>
                ))}
              </div>
            </section>
          )}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>패트랩 투입 지점별 결과</h2>
                <p>카드 수량은 목표를 초과해도 성공으로 처리합니다.</p>
              </div>
            </div>
            {latest.points.length === 0 ? (
              <div className="inline-empty">
                연결된 패트랩 태그가 있는 효과·소환이 없습니다.
              </div>
            ) : (
              <div className="result-list">
                {latest.points.map((point, index) => {
                  const failed = isFailed(point);
                  const route = point.bypassBranchName
                    ? `${point.effectLabel}에 방해 적용 → ‘${point.bypassBranchName}’ 우회 전개`
                    : point.blockedByPermission
                      ? `${point.blockedByPermission}의 퍼미션으로 패트랩 무효`
                      : point.directInterruption
                        ? `${point.effectLabel}에 직접 방해 · ${point.disruptionSummary ?? "방해 적용"}`
                        : `${point.effectLabel}에서 격발 · ${point.disruptionSummary ?? "잔존·복합 처리"}${(point.resolvedOperations ?? 0) > 1 ? ` · ${point.resolvedOperations}개 처리 순차 적용` : ""}`;
                  return (
                    <div
                      className="result-row"
                      key={`${point.handTrapId}-${point.stepIndex}-${index}`}
                    >
                      <div
                        className={
                          failed ? "result-icon fail" : "result-icon pass"
                        }
                      >
                        {failed ? <X size={18} /> : <BadgeCheck size={18} />}
                      </div>
                      <div>
                        <div>
                          <strong>
                            {point.stepIndex + 1}단계 · {point.cardName}
                          </strong>
                          <span>{point.handTrapName}</span>
                        </div>
                        <p>
                          {route} →{" "}
                          {failed
                            ? `목표 미달${point.missingGoal?.length ? `: ${point.missingGoal.join(", ")}` : ""}`
                            : "목표 상태 도달"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function TrashScreen({
  store,
  setStore,
}: {
  store: Store;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
}) {
  const restore = (item: TrashItem) =>
    setStore((current) => {
      if (item.kind === "CARD")
        return {
          ...current,
          cards: [...current.cards, item.data as Card],
          trash: current.trash.filter((entry) => entry.id !== item.id),
        };
      if (item.kind === "HANDTRAP")
        return {
          ...current,
          handTraps: [...current.handTraps, item.data as HandTrap],
          trash: current.trash.filter((entry) => entry.id !== item.id),
        };
      if (item.kind === "DECK")
        return {
          ...current,
          decks: [...current.decks, item.data as Deck],
          trash: current.trash.filter((entry) => entry.id !== item.id),
        };
      return {
        ...current,
        combos: [...current.combos, normalizeCombo(item.data as Combo)],
        trash: current.trash.filter((entry) => entry.id !== item.id),
      };
    });
  const conflicts = (item: TrashItem) =>
    item.kind === "CARD"
      ? store.cards.some((entry) => entry.id === (item.data as Card).id)
      : item.kind === "HANDTRAP"
        ? store.handTraps.some(
            (entry) => entry.id === (item.data as HandTrap).id,
          )
        : item.kind === "DECK"
          ? store.decks.some((entry) => entry.id === (item.data as Deck).id)
          : store.combos.some((entry) => entry.id === (item.data as Combo).id);
  const permanentlyDelete = (item: TrashItem) =>
    setStore((current) => {
      const next = {
        ...current,
        trash: current.trash.filter((entry) => entry.id !== item.id),
      };
      if (item.kind === "HANDTRAP") {
        const id = (item.data as HandTrap).id;
        return {
          ...next,
          cards: next.cards.map((card) => ({
            ...card,
            effects: card.effects.map((effect) => ({
              ...effect,
              interruptibleBy: effect.interruptibleBy.filter(
                (value) => value !== id,
              ),
              blocksHandTraps: effect.blocksHandTraps.filter(
                (value) => value !== id,
              ),
              grantedProfile: effect.grantedProfile
                ? {
                    ...effect.grantedProfile,
                    interruptibleBy:
                      effect.grantedProfile.interruptibleBy.filter(
                        (value) => value !== id,
                      ),
                    blocksHandTraps:
                      effect.grantedProfile.blocksHandTraps.filter(
                        (value) => value !== id,
                      ),
                  }
                : null,
            })),
          })),
          combos: next.combos.map((combo) => ({
            ...combo,
            branches: combo.branches.filter(
              (branch) => branch.triggerHandTrapId !== id,
            ),
            steps: combo.steps.map((step) => ({
              ...step,
              summonInterruptibleBy: step.summonInterruptibleBy.filter(
                (value) => value !== id,
              ),
            })),
          })),
        };
      }
      if (item.kind === "COMBO") {
        const id = (item.data as Combo).id;
        return {
          ...next,
          combos: next.combos.map((combo) => ({
            ...combo,
            branches: combo.branches.filter(
              (branch) => branch.alternateComboId !== id,
            ),
          })),
        };
      }
      if (item.kind === "CARD") {
        const card = item.data as Card;
        const effectIds = new Set(card.effects.map((effect) => effect.id));
        return {
          ...next,
          combos: next.combos.map((combo) => ({
            ...combo,
            startingHand: combo.startingHand.filter(
              (entry) => entry.cardId !== card.id,
            ),
            goals: combo.goals.filter(
              (goal) =>
                goal.kind !== "CARD_LOCATION" || goal.cardId !== card.id,
            ),
            steps: combo.steps
              .filter(
                (step) =>
                  step.summonedCardId !== card.id &&
                  step.actingCardId !== card.id &&
                  !effectIds.has(step.effectId),
              )
              .map((step) => ({
                ...step,
                costEvents: step.costEvents.filter(
                  (event) => event.cardId !== card.id,
                ),
                zoneEvents: step.zoneEvents.filter(
                  (event) => event.cardId !== card.id,
                ),
                materials: step.materials.filter(
                  (material) => material.cardId !== card.id,
                ),
                effectGrantEvents: step.effectGrantEvents.filter(
                  (event) =>
                    event.targetCardId !== card.id &&
                    !effectIds.has(event.effectId),
                ),
              })),
          })),
        };
      }
      return next;
    });
  return (
    <>
      <PageHeading
        eyebrow="RECYCLE BIN"
        title="휴지통"
        description="삭제한 카드·덱·패트랩·전개법을 복원하거나 영구 삭제합니다."
      />
      {store.trash.length === 0 ? (
        <Empty
          icon={<Trash2 size={28} />}
          title="휴지통이 비어 있습니다"
          text="삭제한 항목은 이곳에 보관됩니다."
        />
      ) : (
        <section className="panel trash-list">
          {store.trash.map((item) => (
            <div className="trash-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.kind === "CARD"
                    ? "카드"
                    : item.kind === "HANDTRAP"
                      ? "패트랩"
                      : item.kind === "DECK"
                        ? "덱"
                        : "전개법"}{" "}
                  · {new Date(item.deletedAt).toLocaleString("ko-KR")}
                </span>
              </div>
              <div>
                <button
                  className="secondary-button"
                  disabled={conflicts(item)}
                  onClick={() => restore(item)}
                >
                  복원
                </button>
                <button
                  className="ghost-button danger-action"
                  onClick={() => permanentlyDelete(item)}
                >
                  영구 삭제
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="empty-state">
      <div>{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </section>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} aria-label="닫기" />
      <section className="modal">
        <div className="modal-head">
          <div>
            <span>NEW DEFINITION</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function HandTrapModal({
  initialHandTrap,
  onClose,
  onSave,
}: {
  initialHandTrap?: HandTrap;
  onClose: () => void;
  onSave: (item: HandTrap) => void;
}) {
  const base =
    initialHandTrap ??
    normalizeHandTrap({ id: uid(), name: "", description: "" });
  const [name, setName] = useState(base.name);
  const [description, setDescription] = useState(base.description);
  const [sourceZone, setSourceZone] = useState(base.activation.sourceZone);
  const [timing, setTiming] = useState(base.activation.timing);
  const [conditions, setConditions] = useState<ActivationCondition[]>([
    ...base.activation.conditions,
  ]);
  const [conditionLogic, setConditionLogic] = useState(
    base.activation.conditionLogic,
  );
  const [customCondition, setCustomCondition] = useState(
    base.activation.customCondition,
  );
  const [costText, setCostText] = useState(base.activation.costText);
  const [usageLimit, setUsageLimit] = useState(base.activation.usageLimit);
  const [disruptions, setDisruptions] = useState<DisruptionOperation[]>(
    base.disruptions.map((operation) => ({ ...operation })),
  );
  const updateDisruption = (id: string, patch: Partial<DisruptionOperation>) =>
    setDisruptions((list) =>
      list.map((operation) =>
        operation.id === id ? { ...operation, ...patch } : operation,
      ),
    );
  const toggleCondition = (condition: ActivationCondition, checked: boolean) =>
    setConditions((list) =>
      checked
        ? [...list, condition]
        : list.filter((item) => item !== condition),
    );

  return (
    <ModalShell
      title={initialHandTrap ? "패트랩 수정" : "패트랩 등록"}
      subtitle="발동 조건과 비용, 한 번에 적용되는 모든 방해 처리를 순서대로 정의합니다."
      onClose={onClose}
    >
      <div className="form-body">
        <div className="form-grid">
          <Field label="카드명">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 드롤 & 로크 버드"
              autoFocus
            />
          </Field>
          <Field label="발동 위치">
            <select
              value={sourceZone}
              onChange={(e) =>
                setSourceZone(
                  e.target.value as HandTrap["activation"]["sourceZone"],
                )
              }
            >
              <option value="HAND">패</option>
              <option value="FIELD">필드</option>
              <option value="GRAVEYARD">묘지</option>
              <option value="BANISHED">제외 상태</option>
              <option value="CUSTOM">사용자 정의</option>
            </select>
          </Field>
          <Field label="발동 타이밍">
            <select
              value={timing}
              onChange={(e) => setTiming(e.target.value as ActivationTiming)}
            >
              {Object.entries(TIMING_LABEL).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="사용 제한">
            <select
              value={usageLimit}
              onChange={(e) =>
                setUsageLimit(
                  e.target.value as HandTrap["activation"]["usageLimit"],
                )
              }
            >
              {Object.entries(USAGE_LABEL).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="builder-section">
          <div className="builder-heading">
            <div>
              <h3>발동 조건</h3>
              <p>조건의 결합 방식과 예외 문장을 함께 저장합니다.</p>
            </div>
            <select
              className="compact-select"
              value={conditionLogic}
              onChange={(e) =>
                setConditionLogic(e.target.value as "ALL" | "ANY")
              }
            >
              <option value="ALL">선택 조건 모두 만족</option>
              <option value="ANY">선택 조건 중 하나 이상</option>
            </select>
          </div>
          <div className="condition-grid">
            {Object.entries(CONDITION_LABEL).map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={conditions.includes(value as ActivationCondition)}
                  onChange={(e) =>
                    toggleCondition(
                      value as ActivationCondition,
                      e.target.checked,
                    )
                  }
                />
                <i />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <Field label="세부·예외 조건">
            <textarea
              value={customCondition}
              onChange={(e) => setCustomCondition(e.target.value)}
              placeholder="예: 드로우 페이즈 이외에 상대 덱에서 카드가 패에 들어온 턴"
            />
          </Field>
          <Field label="발동 비용">
            <input
              value={costText}
              onChange={(e) => setCostText(e.target.value)}
              placeholder="예: 이 카드를 패에서 묘지로 보낸다"
            />
          </Field>
        </div>
        <div className="builder-section">
          <div className="builder-heading">
            <div>
              <h3>방해 처리</h3>
              <p>
                복수 처리 카드라면 실제 처리 순서와 문장 연결 방식까지
                추가하세요.
              </p>
            </div>
            <button
              className="text-button"
              onClick={() =>
                setDisruptions((list) => [
                  ...list,
                  {
                    id: uid(),
                    type: "DESTROY",
                    target: "RESPONDED_CARD",
                    duration: "IMMEDIATE",
                    link: "THEN",
                    selection: "NONE",
                    details: "",
                    amount: 1,
                    application: "ON_TRIGGER",
                    conditionText: "",
                  },
                ])
              }
            >
              <Plus size={16} /> 처리 추가
            </button>
          </div>
          {disruptions.map((operation, index) => (
            <div className="disruption-editor" key={operation.id}>
              <div className="disruption-number">{index + 1}</div>
              <div className="disruption-fields">
                <div className="form-grid">
                  {index > 0 && (
                    <Field label="앞 처리와의 연결">
                      <select
                        value={operation.link}
                        onChange={(e) =>
                          updateDisruption(operation.id, {
                            link: e.target.value as ResolutionLink,
                          })
                        }
                      >
                        {Object.entries(LINK_LABEL).map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field label="방해 종류">
                    <select
                      value={operation.type}
                      onChange={(e) =>
                        updateDisruption(operation.id, {
                          type: e.target.value as DisruptionType,
                        })
                      }
                    >
                      {Object.entries(DISRUPTION_LABEL).map(
                        ([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  {operation.type === "DRAW_ON_SUMMON" && (
                    <Field label="소환 1회당 드로우">
                      <input
                        type="number"
                        min="1"
                        value={operation.amount}
                        onChange={(e) =>
                          updateDisruption(operation.id, {
                            amount: Math.max(1, Number(e.target.value)),
                          })
                        }
                      />
                    </Field>
                  )}
                  <Field label="적용 대상">
                    <select
                      value={operation.target}
                      onChange={(e) =>
                        updateDisruption(operation.id, {
                          target: e.target.value as DisruptionTarget,
                        })
                      }
                    >
                      {Object.entries(TARGET_LABEL).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="선택 시점">
                    <select
                      value={operation.selection}
                      onChange={(e) =>
                        updateDisruption(operation.id, {
                          selection: e.target.value as SelectionTiming,
                        })
                      }
                    >
                      {Object.entries(SELECTION_LABEL).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="지속 기간">
                    <select
                      value={operation.duration}
                      onChange={(e) =>
                        updateDisruption(operation.id, {
                          duration: e.target.value as EffectDuration,
                        })
                      }
                    >
                      {Object.entries(DURATION_LABEL).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="적용 방식">
                    <select
                      value={operation.application}
                      onChange={(e) =>
                        updateDisruption(operation.id, {
                          application: e.target.value as OperationApplication,
                        })
                      }
                    >
                      {Object.entries(OPERATION_APPLICATION_LABEL).map(
                        ([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="이 처리의 추가 조건">
                    <input
                      value={operation.conditionText}
                      onChange={(e) =>
                        updateDisruption(operation.id, {
                          conditionText: e.target.value,
                        })
                      }
                      placeholder="예: 합계 4장 이상 공개"
                    />
                  </Field>
                  <Field label="세부 처리">
                    <input
                      value={operation.details}
                      onChange={(e) =>
                        updateDisruption(operation.id, {
                          details: e.target.value,
                        })
                      }
                      placeholder="대상 지정 여부나 예외를 기록"
                    />
                  </Field>
                </div>
              </div>
              {disruptions.length > 1 && (
                <button
                  className="icon-button danger"
                  aria-label={`방해 처리 ${index + 1} 삭제`}
                  onClick={() =>
                    setDisruptions((list) =>
                      list.filter((item) => item.id !== operation.id),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <Field label="메모">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="룰 처리나 참고 사항을 기록하세요."
          />
        </Field>
      </div>
      <ModalActions
        onClose={onClose}
        onSave={() =>
          name.trim() &&
          disruptions.length &&
          onSave({
            id: initialHandTrap?.id ?? uid(),
            name: name.trim(),
            description: description.trim(),
            builtIn: initialHandTrap?.builtIn,
            activation: {
              sourceZone,
              timing,
              conditions,
              conditionLogic,
              customCondition: customCondition.trim(),
              costText: costText.trim(),
              usageLimit,
            },
            disruptions,
          })
        }
        disabled={!name.trim() || !disruptions.length}
      />
    </ModalShell>
  );
}

function CardModal({
  handTraps,
  initialCard,
  onClose,
  onSave,
}: {
  handTraps: HandTrap[];
  initialCard?: Card;
  onClose: () => void;
  onSave: (item: Card) => void;
}) {
  const normalizedInitial = initialCard
    ? normalizeCard(initialCard)
    : undefined;
  const [name, setName] = useState(normalizedInitial?.name ?? "");
  const [kind, setKind] = useState<Card["kind"]>(
    normalizedInitial?.kind ?? "MONSTER",
  );
  const [monsterType, setMonsterType] = useState<MonsterType>(
    normalizedInitial?.monsterType ?? "EFFECT",
  );
  const [levelRankLink, setLevelRankLink] = useState(
    String(normalizedInitial?.levelRankLink ?? 4),
  );
  const [attack, setAttack] = useState(String(normalizedInitial?.attack ?? 0));
  const [defense, setDefense] = useState(
    String(normalizedInitial?.defense ?? 0),
  );
  const [ruleText, setRuleText] = useState(normalizedInitial?.ruleText ?? "");
  const [effects, setEffects] = useState<CardEffect[]>(
    normalizedInitial?.effects.map((effect) => ({
      ...effect,
      interactionNotes: [...effect.interactionNotes],
      interruptibleBy: [...effect.interruptibleBy],
      blocksHandTraps: [...effect.blocksHandTraps],
      activationTags: [...effect.activationTags],
      applicationTags: [...effect.applicationTags],
      operationTags: [...effect.operationTags],
      grantedProfile: effect.grantedProfile
        ? {
            ...effect.grantedProfile,
            allowedTurns: [...effect.grantedProfile.allowedTurns],
            allowedPhases: [...effect.grantedProfile.allowedPhases],
            activationTags: [...effect.grantedProfile.activationTags],
            applicationTags: [...effect.grantedProfile.applicationTags],
            operationTags: [...effect.grantedProfile.operationTags],
            interruptibleBy: [...effect.grantedProfile.interruptibleBy],
            blocksHandTraps: [...effect.grantedProfile.blocksHandTraps],
          }
        : null,
    })) ?? [normalizeCardEffect({ id: uid(), label: "① 효과" })],
  );
  const updateEffect = (id: string, patch: Partial<CardEffect>) =>
    setEffects((list) =>
      list.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  const toggleTag = (
    effect: CardEffect,
    field: "interruptibleBy" | "blocksHandTraps",
    handTrapId: string,
    checked: boolean,
  ) =>
    updateEffect(effect.id, {
      [field]: checked
        ? [...effect[field], handTrapId]
        : effect[field].filter((id) => id !== handTrapId),
    });
  const toggleTiming = <T extends TurnOwner | DuelPhase>(
    effect: CardEffect,
    field: "allowedTurns" | "allowedPhases",
    value: T,
    checked: boolean,
  ) => {
    const current = effect[field] as T[];
    updateEffect(effect.id, {
      [field]: checked
        ? [...current, value]
        : current.filter((item) => item !== value),
    });
  };
  const toggleEffectTag = <
    T extends EffectActivationTag | EffectApplicationTag | EffectOperationTag,
  >(
    effect: CardEffect,
    field: "activationTags" | "applicationTags" | "operationTags",
    value: T,
    checked: boolean,
  ) => {
    const current = effect[field] as T[];
    updateEffect(effect.id, {
      [field]: checked
        ? [...current, value]
        : current.filter((item) => item !== value),
    });
  };
  const setGrantEnabled = (effect: CardEffect, enabled: boolean) =>
    updateEffect(effect.id, {
      canBeGranted: enabled,
      grantedProfile: enabled
        ? (effect.grantedProfile ?? {
            label: `${effect.label} (부여 효과)`,
            text: "",
            effectType: "ACTIVATED",
            sourceZone: "MONSTER_ZONE",
            usageLimit: "NONE",
            allowedTurns: ["SELF", "OPPONENT"],
            allowedPhases: [
              "DRAW",
              "STANDBY",
              "MAIN1",
              "BATTLE",
              "MAIN2",
              "END",
            ],
            timingDetails: "",
            activationTags: [],
            applicationTags: [],
            operationTags: [],
            interruptibleBy: [],
            blocksHandTraps: [],
          })
        : null,
    });
  const updateGrantedProfile = (
    effect: CardEffect,
    patch: Partial<GrantedEffectProfile>,
  ) =>
    updateEffect(effect.id, {
      grantedProfile: effect.grantedProfile
        ? { ...effect.grantedProfile, ...patch }
        : null,
    });

  return (
    <ModalShell
      title={initialCard ? "카드 수정" : "카드 등록"}
      subtitle="몬스터 분류와 효과별 방해·퍼미션 태그, 턴 제약을 정의합니다."
      onClose={onClose}
    >
      <div className="form-body">
        <div className="form-grid">
          <Field label="카드명">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="카드명을 입력하세요"
              autoFocus
            />
          </Field>
          <Field label="카드 종류">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Card["kind"])}
            >
              <option value="MONSTER">몬스터</option>
              <option value="SPELL">마법</option>
              <option value="TRAP">함정</option>
            </select>
          </Field>
          {kind === "MONSTER" && (
            <>
              <Field label="몬스터 분류">
                <select
                  value={monsterType}
                  onChange={(e) =>
                    setMonsterType(e.target.value as MonsterType)
                  }
                >
                  {Object.entries(MONSTER_TYPE_LABEL).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label} 몬스터
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={
                  monsterType === "XYZ"
                    ? "랭크"
                    : monsterType === "LINK"
                      ? "링크"
                      : "레벨"
                }
              >
                <input
                  type="number"
                  min="0"
                  value={levelRankLink}
                  onChange={(e) => setLevelRankLink(e.target.value)}
                />
              </Field>
              <Field label="공격력">
                <input
                  type="text"
                  placeholder="숫자 또는 ?"
                  value={attack}
                  onChange={(e) => setAttack(e.target.value)}
                />
              </Field>
              {monsterType !== "LINK" && (
                <Field label="수비력">
                  <input
                    type="text"
                    placeholder="숫자 또는 ?"
                    value={defense}
                    onChange={(e) => setDefense(e.target.value)}
                  />
                </Field>
              )}
            </>
          )}
        </div>
        <Field label="효과 외 텍스트·룰 설명">
          <textarea
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
            placeholder="예: 이 카드는 룰상 ‘○○’ 카드로도 취급한다. / 이 카드는 통상 소환할 수 없다."
          />
        </Field>
        <div className="effect-editor-head">
          <div>
            <h3>효과 정의</h3>
            <p>맞는 패트랩과 막을 수 있는 패트랩을 서로 별도로 지정합니다.</p>
          </div>
          <button
            className="text-button"
            onClick={() =>
              setEffects((list) => [
                ...list,
                normalizeCardEffect({
                  id: uid(),
                  label: `${circled(list.length + 1)} 효과`,
                }),
              ])
            }
          >
            <Plus size={16} /> 효과 추가
          </button>
        </div>
        {effects.map((effect, index) => (
          <div className="effect-editor" key={effect.id}>
            <div className="effect-editor-title">
              <strong>효과 {index + 1}</strong>
              {effects.length > 1 && (
                <button
                  className="icon-button danger"
                  aria-label={`효과 ${index + 1} 삭제`}
                  onClick={() =>
                    setEffects((list) =>
                      list.filter((item) => item.id !== effect.id),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="form-grid">
              <Field label="효과 이름">
                <input
                  value={effect.label}
                  onChange={(e) =>
                    updateEffect(effect.id, { label: e.target.value })
                  }
                />
              </Field>
              <Field label="효과 종류">
                <select
                  value={effect.effectType}
                  onChange={(e) =>
                    updateEffect(effect.id, {
                      effectType: e.target.value as CardEffectType,
                    })
                  }
                >
                  {Object.entries(EFFECT_TYPE_LABEL).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={
                  effect.effectType === "CONTINUOUS"
                    ? "적용되는 위치"
                    : "발동 위치"
                }
              >
                <select
                  value={effect.sourceZone}
                  onChange={(e) =>
                    updateEffect(effect.id, {
                      sourceZone: e.target.value as EffectSourceZone,
                    })
                  }
                >
                  {Object.entries(SOURCE_ZONE_LABEL).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="사용 제한">
                <select
                  value={effect.usageLimit}
                  onChange={(e) =>
                    updateEffect(effect.id, {
                      usageLimit: e.target.value as EffectUsageLimit,
                    })
                  }
                >
                  {Object.entries(EFFECT_USAGE_LABEL).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="timing-grid">
              <div className="check-group">
                <span>사용 가능한 턴</span>
                {Object.entries(TURN_OWNER_LABEL).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={effect.allowedTurns.includes(value as TurnOwner)}
                      onChange={(e) =>
                        toggleTiming(
                          effect,
                          "allowedTurns",
                          value as TurnOwner,
                          e.target.checked,
                        )
                      }
                    />
                    <i />
                    {label}
                  </label>
                ))}
              </div>
              <div className="check-group">
                <span>사용 가능한 페이즈</span>
                {Object.entries(PHASE_LABEL).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={effect.allowedPhases.includes(
                        value as DuelPhase,
                      )}
                      onChange={(e) =>
                        toggleTiming(
                          effect,
                          "allowedPhases",
                          value as DuelPhase,
                          e.target.checked,
                        )
                      }
                    />
                    <i />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Field label="발동 타이밍 세부 조건">
              <input
                value={effect.timingDetails}
                onChange={(e) =>
                  updateEffect(effect.id, { timingDetails: e.target.value })
                }
                placeholder="예: 스탠바이 페이즈 개시 시 / 데미지 스텝에는 발동할 수 없다"
              />
            </Field>
            <div className="effect-tag-builder">
              <div>
                <strong>발동 조건 태그</strong>
                <div className="mini-tag-grid">
                  {Object.entries(ACTIVATION_TAG_LABEL).map(
                    ([value, label]) => (
                      <label key={value}>
                        <input
                          type="checkbox"
                          checked={effect.activationTags.includes(
                            value as EffectActivationTag,
                          )}
                          onChange={(e) =>
                            toggleEffectTag(
                              effect,
                              "activationTags",
                              value as EffectActivationTag,
                              e.target.checked,
                            )
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ),
                  )}
                </div>
              </div>
              <div>
                <strong>적용 조건 태그</strong>
                <div className="mini-tag-grid">
                  {Object.entries(APPLICATION_TAG_LABEL).map(
                    ([value, label]) => (
                      <label key={value}>
                        <input
                          type="checkbox"
                          checked={effect.applicationTags.includes(
                            value as EffectApplicationTag,
                          )}
                          onChange={(e) =>
                            toggleEffectTag(
                              effect,
                              "applicationTags",
                              value as EffectApplicationTag,
                              e.target.checked,
                            )
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ),
                  )}
                </div>
              </div>
              <div>
                <strong>처리 내용 태그</strong>
                <div className="mini-tag-grid">
                  {Object.entries(OPERATION_TAG_LABEL).map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        checked={effect.operationTags.includes(
                          value as EffectOperationTag,
                        )}
                        onChange={(e) =>
                          toggleEffectTag(
                            effect,
                            "operationTags",
                            value as EffectOperationTag,
                            e.target.checked,
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <Field label="효과 설명">
              <textarea
                value={effect.text}
                onChange={(e) =>
                  updateEffect(effect.id, { text: e.target.value })
                }
                placeholder="효과 처리 내용을 입력하세요"
              />
            </Field>
            <div className="form-grid">
              <Field label="발동 코스트">
                <input
                  value={effect.costText}
                  onChange={(e) =>
                    updateEffect(effect.id, { costText: e.target.value })
                  }
                  placeholder="예: 묘지의 이 카드를 제외한다 / 패를 1장 버린다"
                />
              </Field>
              <Field label="사전·조건부·처리 후 패트랩 메모">
                <textarea
                  value={effect.interactionNotes.join("\n")}
                  onChange={(e) =>
                    updateEffect(effect.id, {
                      interactionNotes: e.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="한 줄에 하나씩 입력하세요"
                />
              </Field>
            </div>
            <label className="switch-label grant-switch">
              <input
                type="checkbox"
                checked={effect.canBeGranted}
                onChange={(e) => setGrantEnabled(effect, e.target.checked)}
              />
              <i />
              다른 카드에 별도의 효과를 부여함
            </label>
            {effect.canBeGranted && effect.grantedProfile && (
              <div className="granted-profile">
                <div className="form-grid">
                  <Field label="부여 방식">
                    <select
                      value={effect.grantMode}
                      onChange={(e) =>
                        updateEffect(effect.id, {
                          grantMode: e.target.value as GrantMode,
                        })
                      }
                    >
                      <option value="GENERIC">일반 효과 부여</option>
                      <option value="WHILE_XYZ_MATERIAL">
                        엑시즈 소재인 동안 그 엑시즈 몬스터에 부여
                      </option>
                    </select>
                  </Field>
                  <Field label="부여된 효과 이름">
                    <input
                      value={effect.grantedProfile.label}
                      onChange={(e) =>
                        updateGrantedProfile(effect, { label: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="부여된 효과 종류">
                    <select
                      value={effect.grantedProfile.effectType}
                      onChange={(e) =>
                        updateGrantedProfile(effect, {
                          effectType: e.target.value as CardEffectType,
                        })
                      }
                    >
                      {Object.entries(EFFECT_TYPE_LABEL).map(
                        ([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="부여된 효과 발동·적용 위치">
                    <select
                      value={effect.grantedProfile.sourceZone}
                      onChange={(e) =>
                        updateGrantedProfile(effect, {
                          sourceZone: e.target.value as EffectSourceZone,
                        })
                      }
                    >
                      {Object.entries(SOURCE_ZONE_LABEL).map(
                        ([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="부여된 효과 사용 제한">
                    <select
                      value={effect.grantedProfile.usageLimit}
                      onChange={(e) =>
                        updateGrantedProfile(effect, {
                          usageLimit: e.target.value as EffectUsageLimit,
                        })
                      }
                    >
                      {Object.entries(EFFECT_USAGE_LABEL).map(
                        ([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                </div>
                <Field label="효과 부여 조건·범위">
                  <input
                    value={effect.grantDetails}
                    onChange={(e) =>
                      updateEffect(effect.id, { grantDetails: e.target.value })
                    }
                    placeholder="예: 이 카드가 엑시즈 소재인 동안 그 몬스터에 부여"
                  />
                </Field>
                <Field label="부여된 효과 설명">
                  <textarea
                    value={effect.grantedProfile.text}
                    onChange={(e) =>
                      updateGrantedProfile(effect, { text: e.target.value })
                    }
                  />
                </Field>
                <div className="effect-tag-builder compact">
                  <div>
                    <strong>부여 효과 발동 조건</strong>
                    <div className="mini-tag-grid">
                      {Object.entries(ACTIVATION_TAG_LABEL).map(
                        ([value, label]) => (
                          <label key={value}>
                            <input
                              type="checkbox"
                              checked={effect.grantedProfile!.activationTags.includes(
                                value as EffectActivationTag,
                              )}
                              onChange={(e) =>
                                updateGrantedProfile(effect, {
                                  activationTags: e.target.checked
                                    ? [
                                        ...effect.grantedProfile!
                                          .activationTags,
                                        value as EffectActivationTag,
                                      ]
                                    : effect.grantedProfile!.activationTags.filter(
                                        (item) => item !== value,
                                      ),
                                })
                              }
                            />
                            <span>{label}</span>
                          </label>
                        ),
                      )}
                    </div>
                  </div>
                  <div>
                    <strong>부여 효과 적용 조건</strong>
                    <div className="mini-tag-grid">
                      {Object.entries(APPLICATION_TAG_LABEL).map(
                        ([value, label]) => (
                          <label key={value}>
                            <input
                              type="checkbox"
                              checked={effect.grantedProfile!.applicationTags.includes(
                                value as EffectApplicationTag,
                              )}
                              onChange={(e) =>
                                updateGrantedProfile(effect, {
                                  applicationTags: e.target.checked
                                    ? [
                                        ...effect.grantedProfile!
                                          .applicationTags,
                                        value as EffectApplicationTag,
                                      ]
                                    : effect.grantedProfile!.applicationTags.filter(
                                        (item) => item !== value,
                                      ),
                                })
                              }
                            />
                            <span>{label}</span>
                          </label>
                        ),
                      )}
                    </div>
                  </div>
                  <div>
                    <strong>부여 효과 처리 내용</strong>
                    <div className="mini-tag-grid">
                      {Object.entries(OPERATION_TAG_LABEL).map(
                        ([value, label]) => (
                          <label key={value}>
                            <input
                              type="checkbox"
                              checked={effect.grantedProfile!.operationTags.includes(
                                value as EffectOperationTag,
                              )}
                              onChange={(e) =>
                                updateGrantedProfile(effect, {
                                  operationTags: e.target.checked
                                    ? [
                                        ...effect.grantedProfile!.operationTags,
                                        value as EffectOperationTag,
                                      ]
                                    : effect.grantedProfile!.operationTags.filter(
                                        (item) => item !== value,
                                      ),
                                })
                              }
                            />
                            <span>{label}</span>
                          </label>
                        ),
                      )}
                    </div>
                  </div>
                </div>
                <div className="dual-tag-grid">
                  <div className="check-group">
                    <span>부여된 효과가 맞을 수 있는 패트랩</span>
                    {handTraps.map((trap) => (
                      <label key={trap.id}>
                        <input
                          type="checkbox"
                          checked={effect.grantedProfile!.interruptibleBy.includes(
                            trap.id,
                          )}
                          onChange={(e) =>
                            updateGrantedProfile(effect, {
                              interruptibleBy: e.target.checked
                                ? [
                                    ...effect.grantedProfile!.interruptibleBy,
                                    trap.id,
                                  ]
                                : effect.grantedProfile!.interruptibleBy.filter(
                                    (id) => id !== trap.id,
                                  ),
                            })
                          }
                        />
                        <i />
                        {trap.name}
                        <small>{disruptionSummary(trap)}</small>
                      </label>
                    ))}
                  </div>
                  <div className="check-group permission-group">
                    <span>부여된 효과로 막을 수 있는 패트랩</span>
                    {handTraps.map((trap) => (
                      <label key={trap.id}>
                        <input
                          type="checkbox"
                          checked={effect.grantedProfile!.blocksHandTraps.includes(
                            trap.id,
                          )}
                          onChange={(e) =>
                            updateGrantedProfile(effect, {
                              blocksHandTraps: e.target.checked
                                ? [
                                    ...effect.grantedProfile!.blocksHandTraps,
                                    trap.id,
                                  ]
                                : effect.grantedProfile!.blocksHandTraps.filter(
                                    (id) => id !== trap.id,
                                  ),
                            })
                          }
                        />
                        <i />
                        {trap.name}
                        <small>퍼미션 대상</small>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <Field label="적용 후 턴 제약">
              <input
                value={effect.turnRestriction}
                onChange={(e) =>
                  updateEffect(effect.id, { turnRestriction: e.target.value })
                }
                placeholder="예: 이 턴, 자신은 싱크로 몬스터밖에 엑스트라 덱에서 특수 소환할 수 없다"
              />
            </Field>
            <div className="dual-tag-grid">
              <div className="check-group">
                <span>이 효과에 직접 대응 가능한 패트랩</span>
                {handTraps.map((trap) => (
                  <label key={trap.id}>
                    <input
                      type="checkbox"
                      checked={effect.interruptibleBy.includes(trap.id)}
                      onChange={(e) =>
                        toggleTag(
                          effect,
                          "interruptibleBy",
                          trap.id,
                          e.target.checked,
                        )
                      }
                    />
                    <i />
                    {trap.name}
                    <small>{disruptionSummary(trap)}</small>
                  </label>
                ))}
              </div>
              <div className="check-group permission-group">
                <span>이 효과로 막을 수 있는 패트랩</span>
                {handTraps.map((trap) => (
                  <label key={trap.id}>
                    <input
                      type="checkbox"
                      checked={effect.blocksHandTraps.includes(trap.id)}
                      onChange={(e) =>
                        toggleTag(
                          effect,
                          "blocksHandTraps",
                          trap.id,
                          e.target.checked,
                        )
                      }
                    />
                    <i />
                    {trap.name}
                    <small>퍼미션 대상</small>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <ModalActions
        onClose={onClose}
        onSave={() =>
          name.trim() &&
          effects.every((effect) => effect.label.trim()) &&
          onSave({
            id: initialCard?.id ?? uid(),
            name: name.trim(),
            kind,
            monsterType: kind === "MONSTER" ? monsterType : null,
            levelRankLink: kind === "MONSTER" ? Number(levelRankLink) : null,
            attack: kind === "MONSTER" ? parseCardStat(attack) : null,
            defense:
              kind === "MONSTER" && monsterType !== "LINK"
                ? parseCardStat(defense)
                : null,
            ruleText: ruleText.trim(),
            effects,
          })
        }
        disabled={
          !name.trim() ||
          effects.some(
            (effect) =>
              !effect.label.trim() ||
              !effect.allowedTurns.length ||
              !effect.allowedPhases.length,
          ) ||
          (kind === "MONSTER" &&
            (!isValidCardStat(attack) ||
              (monsterType !== "LINK" && !isValidCardStat(defense))))
        }
      />
    </ModalShell>
  );
}

function ComboModal({
  cards,
  decks,
  handTraps,
  combos,
  initialCombo,
  onClose,
  onSave,
}: {
  cards: Card[];
  decks: Deck[];
  handTraps: HandTrap[];
  combos: Combo[];
  initialCombo?: Combo;
  onClose: () => void;
  onSave: (item: Combo) => void;
}) {
  const [name, setName] = useState(initialCombo?.name ?? "");
  const [deckId, setDeckId] = useState(
    initialCombo?.deckId || decks[0]?.id || "",
  );
  const selectedDeck = decks.find((deck) => deck.id === deckId);
  const limits = deckQuantityMap(selectedDeck);
  const availableCards = cards.filter((card) => limits.has(card.id));
  const allEffects = availableCards.flatMap((card) =>
    card.effects.map((effect) => ({ card, effect })),
  );
  const permissionEffects = allEffects.filter(
    ({ effect }) => effect.blocksHandTraps.length > 0,
  );
  const grantableEffects = allEffects.filter(
    ({ effect }) => effect.canBeGranted,
  );
  const monsterCards = availableCards.filter((card) => card.kind === "MONSTER");
  const [startingHand, setStartingHand] = useState<CardQuantity[]>(
    initialCombo?.startingHand?.map((entry) => ({ ...entry })) ?? [],
  );
  const [goals, setGoals] = useState<ComboGoal[]>(
    initialCombo?.goals?.map((entry) => ({ ...entry })) ?? [],
  );
  const [opponentStartingLp, setOpponentStartingLp] = useState(
    initialCombo?.opponentStartingLp ?? 8000,
  );
  const [opponentStartingHandSize, setOpponentStartingHandSize] = useState(
    initialCombo?.opponentStartingHandSize ?? 5,
  );
  const makeStep = (): ComboStep => {
    const id = uid();
    return {
      id,
      effectId: allEffects[0]?.effect.id ?? "",
      actingCardId: allEffects[0]?.card.id ?? "",
      turnOwner: "SELF",
      phase: "MAIN1",
      stopsWhenNegated: true,
      costEvents: [],
      permissionEvents: [],
      zoneEvents: [],
      effectGrantEvents: [],
      actionType: "EFFECT",
      effectExecutionMode: "IMMEDIATE",
      chainId: `chain-${id}`,
      chainLabel: "체인 1",
      summonedCardId: monsterCards[0]?.id ?? "",
      summonType: "NORMAL",
      summonFrom: "HAND",
      summonCount: 1,
      summonZone: "MAIN_3",
      summonInterruptibleBy: [],
      materials: [],
      opponentLpChange: 0,
      declaresSpecialWin: false,
      specialWinText: "",
    };
  };
  const [steps, setSteps] = useState<ComboStep[]>(
    initialCombo?.steps.map((step) => ({
      ...step,
      costEvents: step.costEvents.map((event) => ({ ...event })),
      permissionEvents: step.permissionEvents.map((event) => ({ ...event })),
      zoneEvents: step.zoneEvents.map((event) => ({ ...event })),
      effectGrantEvents: step.effectGrantEvents.map((event) => ({ ...event })),
      summonInterruptibleBy: [...step.summonInterruptibleBy],
      materials: step.materials.map((material) => ({ ...material })),
    })) ?? (allEffects[0] ? [makeStep()] : []),
  );
  const [branches, setBranches] = useState<ComboBranch[]>(
    initialCombo?.branches.map((branch) => ({ ...branch })) ?? [],
  );
  const [handTrapPlans, setHandTrapPlans] = useState<HandTrapResponsePlan[]>(
    initialCombo?.handTrapPlans?.map((plan) => ({ ...plan })) ?? [],
  );
  const firstUnplannedHandTrap = handTraps.find(
    (trap) => !handTrapPlans.some((plan) => plan.handTrapId === trap.id),
  );
  const addHandTrapPlan = () => {
    if (!firstUnplannedHandTrap) return;
    setHandTrapPlans((plans) => [
      ...plans,
      {
        id: uid(),
        handTrapId: firstUnplannedHandTrap.id,
        strategy: "ACCEPT_WITH_LIMIT",
        maxOpponentDraws: 5,
        maxAffectedSteps: 5,
        maxResolvedOperations: 5,
        notes: "",
      },
    ]);
  };
  const addStep = () => {
    const nextStep = makeStep();
    setSteps((list) => [...list, nextStep]);
    window.setTimeout(
      () =>
        document
          .getElementById(`combo-step-${nextStep.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0,
    );
  };
  const updateStep = (stepId: string, patch: Partial<ComboStep>) =>
    setSteps((list) =>
      list.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
    );
  const updateChainLabel = (chainId: string, label: string) =>
    setSteps((list) =>
      list.map((step) =>
        step.chainId === chainId ? { ...step, chainLabel: label } : step,
      ),
    );
  const chainGroups = [
    ...new Map(
      steps
        .filter(
          (step) =>
            step.actionType === "EFFECT" &&
            step.effectExecutionMode === "CHAIN_REGISTER",
        )
        .map((step) => [
          step.chainId,
          { id: step.chainId, label: step.chainLabel },
        ]),
    ).values(),
  ];
  const addPermissionEvent = (step: ComboStep) => {
    if (!permissionEffects[0]) return;
    updateStep(step.id, {
      permissionEvents: [
        ...step.permissionEvents,
        {
          id: uid(),
          permissionEffectId: permissionEffects[0].effect.id,
          action: "ENABLE",
          uses: 1,
        },
      ],
    });
  };
  const updatePermissionEvent = (
    step: ComboStep,
    eventId: string,
    patch: Partial<PermissionEvent>,
  ) =>
    updateStep(step.id, {
      permissionEvents: step.permissionEvents.map((event) =>
        event.id === eventId ? { ...event, ...patch } : event,
      ),
    });
  const addCostEvent = (step: ComboStep) => {
    if (availableCards[0])
      updateStep(step.id, {
        costEvents: [
          ...step.costEvents,
          {
            id: uid(),
            cardId: availableCards[0].id,
            zone: "HAND",
            xyzHostZone: "MAIN_3",
            owner: "SELF",
            action: "LEAVE",
            timing: "BEFORE",
            quantity: 1,
            destination: "GRAVEYARD",
          },
        ],
      });
  };
  const updateCostEvent = (
    step: ComboStep,
    eventId: string,
    patch: Partial<ZoneEvent>,
  ) =>
    updateStep(step.id, {
      costEvents: step.costEvents.map((event) =>
        event.id === eventId ? { ...event, ...patch } : event,
      ),
    });
  const addZoneEvent = (step: ComboStep) => {
    if (availableCards[0])
      updateStep(step.id, {
        zoneEvents: [
          ...step.zoneEvents,
          {
            id: uid(),
            cardId: availableCards[0].id,
            zone:
              availableCards[0].kind === "MONSTER"
                ? "MONSTER_ZONE"
                : "SPELL_TRAP_ZONE",
            monsterZone: "MAIN_3",
            xyzHostZone: "MAIN_3",
            owner: "SELF",
            action: "SUMMON",
            timing: "AFTER",
            quantity: 1,
          },
        ],
      });
  };
  const updateZoneEvent = (
    step: ComboStep,
    eventId: string,
    patch: Partial<ZoneEvent>,
  ) =>
    updateStep(step.id, {
      zoneEvents: step.zoneEvents.map((event) =>
        event.id === eventId ? { ...event, ...patch } : event,
      ),
    });
  const addMaterial = (step: ComboStep) => {
    if (monsterCards[0])
      updateStep(step.id, {
        materials: [
          ...step.materials,
          {
            id: uid(),
            cardId: monsterCards[0].id,
            from: "MONSTER_ZONE",
            destination:
              step.summonType === "XYZ" ? "XYZ_MATERIAL" : "GRAVEYARD",
            xyzHostZone: step.summonZone,
            quantity: 1,
          },
        ],
      });
  };
  const updateMaterial = (
    step: ComboStep,
    materialId: string,
    patch: Partial<SummonMaterial>,
  ) =>
    updateStep(step.id, {
      materials: step.materials.map((material) =>
        material.id === materialId ? { ...material, ...patch } : material,
      ),
    });
  const addGrantEvent = (step: ComboStep) => {
    if (grantableEffects[0] && availableCards[0])
      updateStep(step.id, {
        effectGrantEvents: [
          ...step.effectGrantEvents,
          {
            id: uid(),
            effectId: grantableEffects[0].effect.id,
            targetCardId: availableCards[0].id,
            action: "GRANT",
          },
        ],
      });
  };
  const updateGrantEvent = (
    step: ComboStep,
    eventId: string,
    patch: Partial<EffectGrantEvent>,
  ) =>
    updateStep(step.id, {
      effectGrantEvents: step.effectGrantEvents.map((event) =>
        event.id === eventId ? { ...event, ...patch } : event,
      ),
    });
  const isStepEffectAvailable = (step: ComboStep, stepIndex: number) => {
    if (step.actionType !== "EFFECT") return true;
    const owner = allEffects.find(({ effect }) => effect.id === step.effectId)
      ?.card.id;
    if (!step.actingCardId || step.actingCardId === owner) return true;
    let granted = false;
    resolvedStepsBefore(steps, stepIndex).forEach((previous) =>
      previous.effectGrantEvents.forEach((event) => {
        if (
          event.effectId === step.effectId &&
          event.targetCardId === step.actingCardId
        )
          granted = event.action === "GRANT";
      }),
    );
    return granted;
  };
  const isStepTimingValid = (step: ComboStep) => {
    if (step.actionType !== "EFFECT") return true;
    const entry = allEffects.find((item) => item.effect.id === step.effectId);
    if (!entry) return false;
    const effect =
      step.actingCardId !== entry.card.id && entry.effect.grantedProfile
        ? entry.effect.grantedProfile
        : entry.effect;
    return (
      effect.allowedTurns.includes(step.turnOwner) &&
      effect.allowedPhases.includes(step.phase)
    );
  };
  const isChainStepValid = (step: ComboStep, stepIndex: number) =>
    step.actionType !== "CHAIN_RESOLVE" ||
    pendingChainLinksBefore(steps, step.chainId, stepIndex).length > 0;
  const unresolvedChainIds = (() => {
    const pending = new Set<string>();
    steps.forEach((step) => {
      if (
        step.actionType === "EFFECT" &&
        step.effectExecutionMode === "CHAIN_REGISTER"
      )
        pending.add(step.chainId);
      if (step.actionType === "CHAIN_RESOLVE") pending.delete(step.chainId);
    });
    return pending;
  })();
  const isGrantTargetValid = (event: EffectGrantEvent) => {
    const entry = grantableEffects.find(
      ({ effect }) => effect.id === event.effectId,
    );
    const target = availableCards.find(
      (card) => card.id === event.targetCardId,
    );
    return (
      entry?.effect.grantMode !== "WHILE_XYZ_MATERIAL" ||
      target?.monsterType === "XYZ"
    );
  };
  const draftCombo = (): Combo => ({
    id: initialCombo?.id ?? "draft",
    name: name.trim(),
    deckId,
    startingHand,
    goals,
    opponentStartingLp,
    opponentStartingHandSize,
    steps,
    branches,
    handTrapPlans,
  });
  const deckErrors = comboDeckErrors(draftCombo(), selectedDeck, cards);
  const xyzHostOptionsAt = (stepId: string, owner: PlayerSide = "SELF") => {
    const state = simulateFieldBeforeStep(draftCombo(), stepId);
    return Object.entries(MONSTER_ZONE_LABEL).map(([value, label]) => {
      const cardId = state.boards[owner].monsterZones.get(
        value as MonsterZoneSlot,
      );
      const cardName = cards.find((card) => card.id === cardId)?.name;
      return {
        value: value as MonsterZoneSlot,
        label: `${label} · ${cardName ?? "비어 있음"}`,
      };
    });
  };

  return (
    <ModalShell
      title={initialCombo ? "전개법 수정" : "전개법 만들기"}
      subtitle="시작 패와 최소 목표 필드를 정한 뒤, 각 방해 지점의 최종 도달 여부를 검사합니다."
      onClose={onClose}
    >
      <div className="form-body">
        <div className="combo-identity-grid">
          <Field label="전개법 이름">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 베이고맥스 원핸드 기본 전개"
              autoFocus
            />
          </Field>
          <Field label="사용할 덱">
            <select
              value={deckId}
              onChange={(event) => setDeckId(event.target.value)}
            >
              {decks.map((deck) => (
                <option value={deck.id} key={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {deckErrors.length > 0 && (
          <div className="route-warning deck-route-warning">
            {deckErrors.join(" · ")}
          </div>
        )}
        <div className="combo-setup-grid">
          <div className="builder-section setup-builder">
            <div className="builder-heading">
              <div>
                <h3>시작 패</h3>
                <p>선택한 덱의 투입 매수를 넘길 수 없습니다.</p>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  availableCards[0] &&
                  setStartingHand((list) => [
                    ...list,
                    { id: uid(), cardId: availableCards[0].id, quantity: 1 },
                  ])
                }
              >
                <Plus size={15} /> 카드 추가
              </button>
            </div>
            {startingHand.length === 0 ? (
              <div className="inline-empty">시작 패를 1장 이상 추가하세요.</div>
            ) : (
              startingHand.map((entry) => (
                <div className="quantity-editor" key={entry.id}>
                  <select
                    value={entry.cardId}
                    onChange={(e) =>
                      setStartingHand((list) =>
                        list.map((item) =>
                          item.id === entry.id
                            ? {
                                ...item,
                                cardId: e.target.value,
                                quantity: Math.min(
                                  item.quantity,
                                  limits.get(e.target.value) ?? 1,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    {availableCards.map((card) => (
                      <option value={card.id} key={card.id}>
                        {card.name} (덱 {limits.get(card.id)}장)
                      </option>
                    ))}
                  </select>
                  <label>
                    <input
                      type="number"
                      min="1"
                      max={limits.get(entry.cardId) ?? 1}
                      value={entry.quantity}
                      onChange={(e) =>
                        setStartingHand((list) =>
                          list.map((item) =>
                            item.id === entry.id
                              ? {
                                  ...item,
                                  quantity: Math.max(
                                    1,
                                    Math.min(
                                      limits.get(item.cardId) ?? 1,
                                      Number(e.target.value),
                                    ),
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    <span>장</span>
                  </label>
                  <button
                    className="icon-button danger"
                    aria-label="시작 패 카드 삭제"
                    onClick={() =>
                      setStartingHand((list) =>
                        list.filter((item) => item.id !== entry.id),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="builder-section setup-builder">
            <div className="builder-heading">
              <div>
                <h3>목표 상태</h3>
                <p>카드 위치·상대 LP·특수 승리를 함께 목표로 지정합니다.</p>
              </div>
              <div className="goal-add-actions">
                <button
                  className="text-button"
                  onClick={() =>
                    availableCards[0] &&
                    setGoals((list) => [
                      ...list,
                      {
                        id: uid(),
                        kind: "CARD_LOCATION",
                        cardId: availableCards[0].id,
                        quantity: 1,
                        owner: "SELF",
                        location:
                          availableCards[0].kind === "MONSTER"
                            ? "MONSTER_ZONE"
                            : "SPELL_TRAP_ZONE",
                      },
                    ])
                  }
                >
                  <Plus size={15} /> 카드
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    setGoals((list) => [
                      ...list,
                      { id: uid(), kind: "OPPONENT_LP", maximum: 0 },
                    ])
                  }
                >
                  <Plus size={15} /> LP
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    setGoals((list) => [
                      ...list,
                      {
                        id: uid(),
                        kind: "LOCATION_COUNT_MAX",
                        owner: "OPPONENT",
                        location: "HAND",
                        maximum: 0,
                      },
                    ])
                  }
                >
                  <Hand size={15} /> 상대 패
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    setGoals((list) => [
                      ...list,
                      {
                        id: uid(),
                        kind: "SPECIAL_WIN",
                        label: "특수 승리 조건 달성",
                      },
                    ])
                  }
                >
                  <Trophy size={15} /> 특수 승리
                </button>
              </div>
            </div>
            <Field label="상대 시작 LP">
              <input
                type="number"
                min="0"
                value={opponentStartingLp}
                onChange={(e) =>
                  setOpponentStartingLp(Math.max(0, Number(e.target.value)))
                }
              />
            </Field>
            <Field label="상대 시작 패 매수">
              <input
                type="number"
                min="0"
                max="60"
                value={opponentStartingHandSize}
                onChange={(e) =>
                  setOpponentStartingHandSize(
                    Math.max(0, Math.min(60, Number(e.target.value))),
                  )
                }
              />
            </Field>
            {goals.length === 0 ? (
              <div className="inline-empty">
                목표 상태를 1개 이상 추가하세요.
              </div>
            ) : (
              goals.map((entry) => (
                <div
                  className={
                    entry.kind === "CARD_LOCATION"
                      ? "goal-editor card-location-goal"
                      : entry.kind === "LOCATION_COUNT_MAX"
                        ? "goal-editor location-count-goal"
                        : "goal-editor"
                  }
                  key={entry.id}
                >
                  {entry.kind === "CARD_LOCATION" ? (
                    <>
                      <select
                        value={entry.owner ?? "SELF"}
                        onChange={(e) =>
                          setGoals((list) =>
                            list.map((item) =>
                              item.id === entry.id &&
                              item.kind === "CARD_LOCATION"
                                ? {
                                    ...item,
                                    owner: e.target.value as PlayerSide,
                                    cardId:
                                      e.target.value === "SELF" &&
                                      !availableCards.some(
                                        (card) => card.id === item.cardId,
                                      )
                                        ? (availableCards[0]?.id ?? "")
                                        : item.cardId,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {Object.entries(PLAYER_SIDE_LABEL).map(
                          ([value, label]) => (
                            <option value={value} key={value}>
                              {label} 카드
                            </option>
                          ),
                        )}
                      </select>
                      <select
                        value={entry.cardId}
                        onChange={(e) =>
                          setGoals((list) =>
                            list.map((item) =>
                              item.id === entry.id &&
                              item.kind === "CARD_LOCATION"
                                ? { ...item, cardId: e.target.value }
                                : item,
                            ),
                          )
                        }
                      >
                        {(entry.owner === "OPPONENT"
                          ? cards
                          : availableCards
                        ).map((card) => (
                          <option value={card.id} key={card.id}>
                            {card.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={entry.location}
                        onChange={(e) =>
                          setGoals((list) =>
                            list.map((item) =>
                              item.id === entry.id &&
                              item.kind === "CARD_LOCATION"
                                ? {
                                    ...item,
                                    location: e.target.value as CardLocation,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {Object.entries(LOCATION_LABEL).map(
                          ([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      <label>
                        <input
                          type="number"
                          min="1"
                          value={entry.quantity}
                          onChange={(e) =>
                            setGoals((list) =>
                              list.map((item) =>
                                item.id === entry.id &&
                                item.kind === "CARD_LOCATION"
                                  ? {
                                      ...item,
                                      quantity: Math.max(
                                        1,
                                        Number(e.target.value),
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        <span>장 이상</span>
                      </label>
                    </>
                  ) : entry.kind === "LOCATION_COUNT_MAX" ? (
                    <>
                      <select
                        value={entry.owner}
                        onChange={(e) =>
                          setGoals((list) =>
                            list.map((item) =>
                              item.id === entry.id &&
                              item.kind === "LOCATION_COUNT_MAX"
                                ? {
                                    ...item,
                                    owner: e.target.value as PlayerSide,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {Object.entries(PLAYER_SIDE_LABEL).map(
                          ([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      <select
                        value={entry.location}
                        onChange={(e) =>
                          setGoals((list) =>
                            list.map((item) =>
                              item.id === entry.id &&
                              item.kind === "LOCATION_COUNT_MAX"
                                ? {
                                    ...item,
                                    location: e.target.value as CardLocation,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {Object.entries(LOCATION_LABEL).map(
                          ([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      <label>
                        <input
                          type="number"
                          min="0"
                          value={entry.maximum}
                          onChange={(e) =>
                            setGoals((list) =>
                              list.map((item) =>
                                item.id === entry.id &&
                                item.kind === "LOCATION_COUNT_MAX"
                                  ? {
                                      ...item,
                                      maximum: Math.max(
                                        0,
                                        Number(e.target.value),
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        <span>장 이하</span>
                      </label>
                    </>
                  ) : entry.kind === "OPPONENT_LP" ? (
                    <Field label="상대 LP가 이 수치 이하">
                      <input
                        type="number"
                        min="0"
                        value={entry.maximum}
                        onChange={(e) =>
                          setGoals((list) =>
                            list.map((item) =>
                              item.id === entry.id &&
                              item.kind === "OPPONENT_LP"
                                ? {
                                    ...item,
                                    maximum: Math.max(
                                      0,
                                      Number(e.target.value),
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                  ) : (
                    <Field label="특수 승리 조건명">
                      <input
                        value={entry.label}
                        onChange={(e) =>
                          setGoals((list) =>
                            list.map((item) =>
                              item.id === entry.id &&
                              item.kind === "SPECIAL_WIN"
                                ? { ...item, label: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                  )}
                  <button
                    className="icon-button danger"
                    aria-label="목표 삭제"
                    onClick={() =>
                      setGoals((list) =>
                        list.filter((item) => item.id !== entry.id),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="effect-editor-head">
          <div>
            <h3>전개 단계</h3>
            <p>효과 발동과 각종 소환을 같은 타임라인에 기록합니다.</p>
          </div>
        </div>
        {steps.map((step, index) => (
          <div
            className="combo-step-card"
            id={`combo-step-${step.id}`}
            key={step.id}
          >
            <div className="step-action-kind">
              <select
                value={step.actionType}
                onChange={(e) => {
                  const actionType = e.target.value as ComboActionType;
                  const group = chainGroups[0];
                  updateStep(step.id, {
                    actionType,
                    ...(actionType === "CHAIN_RESOLVE"
                      ? {
                          chainId: group?.id ?? step.chainId,
                          chainLabel: group?.label ?? step.chainLabel,
                          costEvents: [],
                          zoneEvents: [],
                          effectGrantEvents: [],
                          permissionEvents: [],
                          materials: [],
                          opponentLpChange: 0,
                          declaresSpecialWin: false,
                          specialWinText: "",
                        }
                      : {}),
                  });
                }}
              >
                <option value="EFFECT">효과 발동</option>
                <option value="SUMMON">몬스터 소환</option>
                <option value="CHAIN_RESOLVE">체인 처리 (역순)</option>
              </select>
            </div>
            <div className="combo-step-main">
              <b>{index + 1}</b>
              {step.actionType === "EFFECT" ? (
                <select
                  value={step.effectId}
                  onChange={(e) => {
                    const selected = allEffects.find(
                      ({ effect }) => effect.id === e.target.value,
                    );
                    updateStep(step.id, {
                      effectId: e.target.value,
                      actingCardId: selected?.card.id ?? "",
                    });
                  }}
                >
                  {allEffects.map(({ card, effect }) => (
                    <option value={effect.id} key={effect.id}>
                      {card.name} · {effect.label}
                    </option>
                  ))}
                </select>
              ) : step.actionType === "SUMMON" ? (
                <select
                  value={step.summonedCardId}
                  onChange={(e) =>
                    updateStep(step.id, { summonedCardId: e.target.value })
                  }
                >
                  {monsterCards.map((card) => (
                    <option value={card.id} key={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              ) : (
                <strong className="chain-resolve-title">
                  {step.chainLabel} · 마지막 체인 링크부터 처리
                </strong>
              )}
              {step.actionType !== "CHAIN_RESOLVE" && (
                <label className="switch-label">
                  <input
                    type="checkbox"
                    checked={step.stopsWhenNegated}
                    onChange={(e) =>
                      updateStep(step.id, {
                        stopsWhenNegated: e.target.checked,
                      })
                    }
                  />
                  <i />
                  실패 시 후속 중단
                </label>
              )}
              {steps.length > 1 && (
                <button
                  className="icon-button danger"
                  aria-label={`전개 단계 ${index + 1} 삭제`}
                  onClick={() =>
                    setSteps((list) =>
                      list.filter((item) => item.id !== step.id),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {step.actionType !== "CHAIN_RESOLVE" && (
              <div className="step-timing-row">
                <select
                  value={step.turnOwner}
                  onChange={(e) =>
                    updateStep(step.id, {
                      turnOwner: e.target.value as TurnOwner,
                    })
                  }
                >
                  {Object.entries(TURN_OWNER_LABEL).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={step.phase}
                  onChange={(e) =>
                    updateStep(step.id, { phase: e.target.value as DuelPhase })
                  }
                >
                  {Object.entries(PHASE_LABEL).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {step.actionType === "EFFECT" ? (
              <>
                {!isStepTimingValid(step) && (
                  <div className="route-warning">
                    이 효과를 등록된 턴·페이즈에는 사용할 수 없습니다.
                  </div>
                )}
                <div className="chain-mode-builder">
                  <Field label="효과 처리 방식">
                    <select
                      value={step.effectExecutionMode}
                      onChange={(e) =>
                        updateStep(step.id, {
                          effectExecutionMode: e.target
                            .value as EffectExecutionMode,
                        })
                      }
                    >
                      <option value="IMMEDIATE">즉시 처리 (체인 생략)</option>
                      <option value="CHAIN_REGISTER">체인 링크로 등록</option>
                    </select>
                  </Field>
                  {step.effectExecutionMode === "CHAIN_REGISTER" && (
                    <>
                      <Field label="체인">
                        <select
                          value={step.chainId}
                          onChange={(e) => {
                            const group = chainGroups.find(
                              (item) => item.id === e.target.value,
                            );
                            updateStep(step.id, {
                              chainId: e.target.value,
                              chainLabel: group?.label ?? step.chainLabel,
                            });
                          }}
                        >
                          <option value={step.chainId}>
                            {step.chainLabel} (현재)
                          </option>
                          {chainGroups
                            .filter((group) => group.id !== step.chainId)
                            .map((group) => (
                              <option value={group.id} key={group.id}>
                                {group.label}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="체인 이름">
                        <input
                          value={step.chainLabel}
                          onChange={(e) =>
                            updateChainLabel(step.chainId, e.target.value)
                          }
                        />
                      </Field>
                    </>
                  )}
                </div>
                <div className="permission-builder">
                  <div>
                    <strong>이 효과를 실제로 사용하는 카드</strong>
                  </div>
                  <select
                    value={
                      step.actingCardId ||
                      allEffects.find(
                        ({ effect }) => effect.id === step.effectId,
                      )?.card.id
                    }
                    onChange={(e) =>
                      updateStep(step.id, { actingCardId: e.target.value })
                    }
                  >
                    {availableCards.map((card) => (
                      <option value={card.id} key={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </div>
                {!isStepEffectAvailable(step, index) && (
                  <div className="route-warning">
                    이 카드에는 아직 해당 효과가 부여되지 않았습니다. 앞
                    단계에서 효과 부여를 추가하세요.
                  </div>
                )}
                <div className="permission-builder">
                  <div>
                    <strong>이 단계 처리 후 효과 부여 상태</strong>
                    {grantableEffects.length > 0 ? (
                      <button
                        className="text-button"
                        onClick={() => addGrantEvent(step)}
                      >
                        <Plus size={15} /> 부여·회수 추가
                      </button>
                    ) : (
                      <span>
                        카드 효과에서 ‘다른 카드에 부여 가능’을 먼저 설정하세요.
                      </span>
                    )}
                  </div>
                  {step.effectGrantEvents.map((event) => (
                    <div key={event.id}>
                      <div className="permission-event-editor">
                        <select
                          value={event.effectId}
                          onChange={(e) =>
                            updateGrantEvent(step, event.id, {
                              effectId: e.target.value,
                            })
                          }
                        >
                          {grantableEffects.map(({ card, effect }) => (
                            <option value={effect.id} key={effect.id}>
                              {card.name} ·{" "}
                              {effect.grantedProfile?.label ?? effect.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={event.targetCardId}
                          onChange={(e) =>
                            updateGrantEvent(step, event.id, {
                              targetCardId: e.target.value,
                            })
                          }
                        >
                          {availableCards.map((card) => (
                            <option value={card.id} key={card.id}>
                              {card.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={event.action}
                          onChange={(e) =>
                            updateGrantEvent(step, event.id, {
                              action: e.target
                                .value as EffectGrantEvent["action"],
                            })
                          }
                        >
                          <option value="GRANT">효과 부여</option>
                          <option value="REVOKE">효과 회수·소멸</option>
                        </select>
                        <button
                          className="icon-button danger"
                          aria-label="효과 부여 상태 삭제"
                          onClick={() =>
                            updateStep(step.id, {
                              effectGrantEvents: step.effectGrantEvents.filter(
                                (item) => item.id !== event.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      {!isGrantTargetValid(event) && (
                        <div className="route-warning">
                          엑시즈 소재로 부여하는 효과의 대상은 엑시즈 몬스터여야
                          합니다.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : step.actionType === "SUMMON" ? (
              <div className="summon-builder">
                <Field label="소환 방식">
                  <select
                    value={step.summonType}
                    onChange={(e) =>
                      updateStep(step.id, {
                        summonType: e.target.value as SummonType,
                        materials: step.materials.map((material) => ({
                          ...material,
                          destination:
                            e.target.value === "XYZ"
                              ? "XYZ_MATERIAL"
                              : material.destination === "XYZ_MATERIAL"
                                ? "GRAVEYARD"
                                : material.destination,
                        })),
                      })
                    }
                  >
                    {Object.entries(SUMMON_TYPE_LABEL).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="소환 전 위치">
                  <select
                    value={step.summonFrom}
                    onChange={(e) =>
                      updateStep(step.id, {
                        summonFrom: e.target.value as CardLocation,
                      })
                    }
                  >
                    {(
                      [
                        "HAND",
                        "DECK",
                        "EXTRA_DECK",
                        "GRAVEYARD",
                        "BANISHED",
                        "SPELL_TRAP_ZONE",
                        "MONSTER_ZONE",
                      ] as CardLocation[]
                    ).map((location) => (
                      <option value={location} key={location}>
                        {LOCATION_LABEL[location]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="동시에 소환한 몬스터 수">
                  <label className="number-with-unit">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={step.summonCount}
                      onChange={(e) =>
                        updateStep(step.id, {
                          summonCount: Math.max(
                            1,
                            Math.min(20, Number(e.target.value)),
                          ),
                        })
                      }
                    />
                    <span>장</span>
                  </label>
                </Field>
                <Field label="소환할 몬스터 존">
                  <select
                    value={step.summonZone}
                    onChange={(e) =>
                      updateStep(step.id, {
                        summonZone: e.target.value as MonsterZoneSlot,
                      })
                    }
                  >
                    {Object.entries(MONSTER_ZONE_LABEL).map(
                      ([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
                <div className="permission-builder material-builder">
                  <div>
                    <strong>소환 소재</strong>
                    <button
                      className="text-button"
                      onClick={() => addMaterial(step)}
                    >
                      <Plus size={15} /> 소재 추가
                    </button>
                  </div>
                  {step.materials.length === 0 ? (
                    <span>소재가 없는 소환입니다.</span>
                  ) : (
                    step.materials.map((material) => (
                      <div
                        className={
                          material.from === "XYZ_MATERIAL"
                            ? "material-editor has-xyz-source"
                            : "material-editor"
                        }
                        key={material.id}
                      >
                        <select
                          value={material.cardId}
                          onChange={(e) =>
                            updateMaterial(step, material.id, {
                              cardId: e.target.value,
                            })
                          }
                        >
                          {monsterCards.map((card) => (
                            <option value={card.id} key={card.id}>
                              {card.name}
                            </option>
                          ))}
                        </select>
                        {material.from === "XYZ_MATERIAL" && (
                          <select
                            value={material.xyzHostZone ?? "MAIN_3"}
                            onChange={(e) =>
                              updateMaterial(step, material.id, {
                                xyzHostZone: e.target
                                  .value as MonsterZoneSlot,
                              })
                            }
                            aria-label="소재를 꺼낼 엑시즈 몬스터 존"
                          >
                            {xyzHostOptionsAt(step.id).map((option) => (
                              <option value={option.value} key={option.value}>
                                {option.label}의 소재
                              </option>
                            ))}
                          </select>
                        )}
                        <select
                          value={material.from}
                          onChange={(e) =>
                            updateMaterial(step, material.id, {
                              from: e.target.value as CardLocation,
                            })
                          }
                        >
                          {Object.entries(LOCATION_LABEL).map(
                            ([value, label]) => (
                              <option value={value} key={value}>
                                {label}에서
                              </option>
                            ),
                          )}
                        </select>
                        {material.destination === "XYZ_MATERIAL" && (
                          <small className="material-host-note">
                            부착 대상 · {MONSTER_ZONE_LABEL[step.summonZone]}
                          </small>
                        )}
                        <select
                          value={material.destination}
                          onChange={(e) =>
                            updateMaterial(step, material.id, {
                              destination: e.target.value as CardLocation,
                            })
                          }
                        >
                          {Object.entries(LOCATION_LABEL).map(
                            ([value, label]) => (
                              <option value={value} key={value}>
                                {label}로
                              </option>
                            ),
                          )}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={material.quantity}
                          onChange={(e) =>
                            updateMaterial(step, material.id, {
                              quantity: Math.max(1, Number(e.target.value)),
                            })
                          }
                        />
                        <button
                          className="icon-button danger"
                          onClick={() =>
                            updateStep(step.id, {
                              materials: step.materials.filter(
                                (item) => item.id !== material.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="check-group">
                  <span>이 소환에 사용할 수 있는 패트랩</span>
                  {handTraps.map((trap) => (
                    <label key={trap.id}>
                      <input
                        type="checkbox"
                        checked={step.summonInterruptibleBy.includes(trap.id)}
                        onChange={(e) =>
                          updateStep(step.id, {
                            summonInterruptibleBy: e.target.checked
                              ? [...step.summonInterruptibleBy, trap.id]
                              : step.summonInterruptibleBy.filter(
                                  (id) => id !== trap.id,
                                ),
                          })
                        }
                      />
                      <i />
                      {trap.name}
                      <small>{disruptionSummary(trap)}</small>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="chain-resolve-builder">
                <Field label="처리할 체인">
                  <select
                    value={step.chainId}
                    onChange={(e) => {
                      const group = chainGroups.find(
                        (item) => item.id === e.target.value,
                      );
                      updateStep(step.id, {
                        chainId: e.target.value,
                        chainLabel: group?.label ?? "체인",
                      });
                    }}
                  >
                    {chainGroups.map((group) => (
                      <option value={group.id} key={group.id}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <p>
                  등록된 링크를 CL
                  {
                    steps
                      .slice(0, index)
                      .filter(
                        (candidate) =>
                          candidate.actionType === "EFFECT" &&
                          candidate.effectExecutionMode === "CHAIN_REGISTER" &&
                          candidate.chainId === step.chainId,
                      ).length
                  }
                  부터 CL1까지 역순으로 처리합니다.
                </p>
                {!isChainStepValid(step, index) && (
                  <div className="route-warning">
                    앞 단계에 이 체인의 등록된 링크가 없습니다.
                  </div>
                )}
              </div>
            )}
            {step.actionType === "EFFECT" && (
              <div className="permission-builder cost-builder">
                <div>
                  <strong>발동 시 코스트·즉시 위치 변화</strong>
                  {availableCards.length > 0 && (
                    <button
                      className="text-button"
                      onClick={() => addCostEvent(step)}
                    >
                      <Plus size={15} /> 코스트 추가
                    </button>
                  )}
                </div>
                <p>체인 처리 전, 이 효과를 발동하는 순간 먼저 적용됩니다.</p>
                {step.costEvents.map((event) => (
                  <div
                    className={
                      event.zone === "MONSTER_ZONE"
                        ? "cost-event-editor has-monster-slot"
                        : event.zone === "XYZ_MATERIAL"
                          ? "cost-event-editor has-xyz-host"
                          : "cost-event-editor"
                    }
                    key={event.id}
                  >
                    <select
                      value={event.owner ?? "SELF"}
                      onChange={(e) =>
                        updateCostEvent(step, event.id, {
                          owner: e.target.value as PlayerSide,
                          cardId:
                            e.target.value === "SELF" &&
                            event.cardId === UNKNOWN_OPPONENT_CARD_ID
                              ? (availableCards[0]?.id ?? "")
                              : event.cardId,
                        })
                      }
                      aria-label="카드 소유자"
                    >
                      {Object.entries(PLAYER_SIDE_LABEL).map(
                        ([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                    <select
                      value={event.cardId}
                      onChange={(e) =>
                        updateCostEvent(step, event.id, {
                          cardId: e.target.value,
                        })
                      }
                    >
                      {event.owner === "OPPONENT" && (
                        <option value={UNKNOWN_OPPONENT_CARD_ID}>
                          상대 패의 임의 카드
                        </option>
                      )}
                      {(event.owner === "OPPONENT"
                        ? cards
                        : availableCards
                      ).map((card) => (
                        <option value={card.id} key={card.id}>
                          {card.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={event.zone}
                      onChange={(e) =>
                        updateCostEvent(step, event.id, {
                          zone: e.target.value as CardLocation,
                          ...(e.target.value === "XYZ_MATERIAL" && {
                            xyzHostZone: event.xyzHostZone ?? "MAIN_3",
                          }),
                        })
                      }
                    >
                      {Object.entries(LOCATION_LABEL).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {event.zone === "MONSTER_ZONE" && (
                      <select
                        value={event.monsterZone ?? "MAIN_3"}
                        onChange={(e) =>
                          updateCostEvent(step, event.id, {
                            monsterZone: e.target.value as MonsterZoneSlot,
                          })
                        }
                      >
                        {Object.entries(MONSTER_ZONE_LABEL).map(
                          ([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                    {event.zone === "XYZ_MATERIAL" && (
                      <select
                        value={event.xyzHostZone ?? "MAIN_3"}
                        onChange={(e) =>
                          updateCostEvent(step, event.id, {
                            xyzHostZone: e.target.value as MonsterZoneSlot,
                          })
                        }
                        aria-label="엑시즈 소재를 가진 몬스터 존"
                      >
                        {xyzHostOptionsAt(step.id, event.owner).map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}의 소재
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      value={event.action}
                      onChange={(e) =>
                        updateCostEvent(step, event.id, {
                          action: e.target.value as ZoneEvent["action"],
                          ...(e.target.value === "SUMMON" && {
                            destination: undefined,
                          }),
                        })
                      }
                    >
                      <option value="LEAVE">그 위치에서 제거</option>
                      <option value="SUMMON">그 위치에 추가</option>
                    </select>
                    {event.action === "LEAVE" && (
                      <select
                        value={event.destination ?? ""}
                        onChange={(e) =>
                          updateCostEvent(step, event.id, {
                            destination: e.target.value
                              ? (e.target.value as CardLocation)
                              : undefined,
                          })
                        }
                        aria-label="코스트 처리 후 위치"
                      >
                        <option value="">처리 후 위치 미지정</option>
                        {Object.entries(LOCATION_LABEL).map(([value, label]) => (
                          <option value={value} key={value}>
                            → {label}
                          </option>
                        ))}
                      </select>
                    )}
                    <label>
                      <input
                        type="number"
                        min="1"
                        value={event.quantity}
                        onChange={(e) =>
                          updateCostEvent(step, event.id, {
                            quantity: Math.max(1, Number(e.target.value)),
                          })
                        }
                      />
                      <span>장</span>
                    </label>
                    <button
                      className="icon-button danger"
                      aria-label="코스트 삭제"
                      onClick={() =>
                        updateStep(step.id, {
                          costEvents: step.costEvents.filter(
                            (item) => item.id !== event.id,
                          ),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {step.actionType !== "CHAIN_RESOLVE" && (
              <>
                <div className="permission-builder">
                  <div>
                    <strong>
                      {step.actionType === "EFFECT" &&
                      step.effectExecutionMode === "CHAIN_REGISTER"
                        ? "체인 처리 시 적용되는 카드 위치 변화"
                        : "처리 시 카드 위치 변화"}
                    </strong>
                    {availableCards.length > 0 && (
                      <button
                        className="text-button"
                        onClick={() => addZoneEvent(step)}
                      >
                        <Plus size={15} /> 이동 추가
                      </button>
                    )}
                  </div>
                  {step.zoneEvents.map((event) => (
                    <div
                      className={
                        event.zone === "MONSTER_ZONE"
                          ? "field-event-editor has-monster-slot"
                          : event.zone === "XYZ_MATERIAL"
                            ? "field-event-editor has-xyz-host"
                            : "field-event-editor"
                      }
                      key={event.id}
                    >
                      <select
                        value={event.owner ?? "SELF"}
                        onChange={(e) =>
                          updateZoneEvent(step, event.id, {
                            owner: e.target.value as PlayerSide,
                            cardId:
                              e.target.value === "SELF" &&
                              event.cardId === UNKNOWN_OPPONENT_CARD_ID
                                ? (availableCards[0]?.id ?? "")
                                : event.cardId,
                          })
                        }
                        aria-label="카드 소유자"
                      >
                        {Object.entries(PLAYER_SIDE_LABEL).map(
                          ([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      <select
                        value={event.cardId}
                        onChange={(e) =>
                          updateZoneEvent(step, event.id, {
                            cardId: e.target.value,
                          })
                        }
                      >
                        {event.owner === "OPPONENT" && (
                          <option value={UNKNOWN_OPPONENT_CARD_ID}>
                            상대 패의 임의 카드
                          </option>
                        )}
                        {(event.owner === "OPPONENT"
                          ? cards
                          : availableCards
                        ).map((card) => (
                          <option value={card.id} key={card.id}>
                            {card.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={event.zone}
                        onChange={(e) =>
                          updateZoneEvent(step, event.id, {
                            zone: e.target.value as CardLocation,
                            ...(e.target.value === "XYZ_MATERIAL" && {
                              xyzHostZone: event.xyzHostZone ?? "MAIN_3",
                            }),
                          })
                        }
                      >
                        {Object.entries(LOCATION_LABEL).map(
                          ([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      {event.zone === "MONSTER_ZONE" && (
                        <select
                          value={event.monsterZone ?? "MAIN_3"}
                          onChange={(e) =>
                            updateZoneEvent(step, event.id, {
                              monsterZone: e.target.value as MonsterZoneSlot,
                            })
                          }
                        >
                          {Object.entries(MONSTER_ZONE_LABEL).map(
                            ([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      )}
                      {event.zone === "XYZ_MATERIAL" && (
                        <select
                          value={event.xyzHostZone ?? "MAIN_3"}
                          onChange={(e) =>
                            updateZoneEvent(step, event.id, {
                              xyzHostZone: e.target.value as MonsterZoneSlot,
                            })
                          }
                          aria-label="엑시즈 소재를 받을 몬스터 존"
                        >
                          {xyzHostOptionsAt(step.id, event.owner).map((option) => (
                            <option value={option.value} key={option.value}>
                              {option.label}의 소재
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        value={event.action}
                        onChange={(e) =>
                          updateZoneEvent(step, event.id, {
                            action: e.target.value as ZoneEvent["action"],
                          })
                        }
                      >
                        <option value="SUMMON">그 위치에 추가</option>
                        <option value="LEAVE">그 위치에서 제거</option>
                      </select>
                      <label>
                        <input
                          type="number"
                          min="1"
                          value={event.quantity}
                          onChange={(e) =>
                            updateZoneEvent(step, event.id, {
                              quantity: Math.max(1, Number(e.target.value)),
                            })
                          }
                        />
                        <span>장</span>
                      </label>
                      <button
                        className="icon-button danger"
                        aria-label="위치 변화 삭제"
                        onClick={() =>
                          updateStep(step.id, {
                            zoneEvents: step.zoneEvents.filter(
                              (item) => item.id !== event.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="step-outcome-builder">
                  <Field label="상대 LP 변화">
                    <input
                      type="number"
                      value={step.opponentLpChange}
                      onChange={(e) =>
                        updateStep(step.id, {
                          opponentLpChange: Number(e.target.value),
                        })
                      }
                      placeholder="예: -8000"
                    />
                  </Field>
                  <label className="switch-label">
                    <input
                      type="checkbox"
                      checked={step.declaresSpecialWin}
                      onChange={(e) =>
                        updateStep(step.id, {
                          declaresSpecialWin: e.target.checked,
                        })
                      }
                    />
                    <i />이 효과 처리로 특수 승리
                  </label>
                  {step.declaresSpecialWin && (
                    <Field label="특수 승리 조건">
                      <input
                        value={step.specialWinText}
                        onChange={(e) =>
                          updateStep(step.id, {
                            specialWinText: e.target.value,
                          })
                        }
                        placeholder="예: 엑조디아 5종류를 패에 모음"
                      />
                    </Field>
                  )}
                </div>
                <div className="permission-builder">
                  <div>
                    <strong>처리 완료 후 퍼미션 상태</strong>
                    {permissionEffects.length > 0 ? (
                      <button
                        className="text-button"
                        onClick={() => addPermissionEvent(step)}
                      >
                        <Plus size={15} /> 상태 변화 추가
                      </button>
                    ) : (
                      <span>
                        먼저 ‘막을 수 있는 패트랩’ 태그가 있는 효과를
                        등록하세요.
                      </span>
                    )}
                  </div>
                  {step.permissionEvents.map((event) => (
                    <div className="permission-event-editor" key={event.id}>
                      <select
                        value={event.permissionEffectId}
                        onChange={(e) =>
                          updatePermissionEvent(step, event.id, {
                            permissionEffectId: e.target.value,
                          })
                        }
                      >
                        {permissionEffects.map(({ card, effect }) => (
                          <option value={effect.id} key={effect.id}>
                            {card.name} · {effect.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={event.action}
                        onChange={(e) =>
                          updatePermissionEvent(step, event.id, {
                            action: e.target.value as PermissionEvent["action"],
                          })
                        }
                      >
                        <option value="ENABLE">퍼미션 활성화</option>
                        <option value="CONSUME">사용 횟수 차감</option>
                        <option value="DISABLE">
                          필드에서 사라짐·비활성화
                        </option>
                      </select>
                      {event.action !== "DISABLE" && (
                        <label>
                          <input
                            type="number"
                            min="1"
                            value={event.uses}
                            onChange={(e) =>
                              updatePermissionEvent(step, event.id, {
                                uses: Math.max(1, Number(e.target.value)),
                              })
                            }
                          />
                          <span>회</span>
                        </label>
                      )}
                      <button
                        className="icon-button danger"
                        aria-label="퍼미션 상태 변화 삭제"
                        onClick={() =>
                          updateStep(step.id, {
                            permissionEvents: step.permissionEvents.filter(
                              (item) => item.id !== event.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
        <div className="builder-section handtrap-plan-section">
          <div className="builder-heading">
            <div>
              <h3>패트랩별 대응안</h3>
              <p>
                누적 드로우·잔존형 방해까지 포함해 허용 범위와 대응 방식을
                미리 정합니다.
              </p>
            </div>
            {firstUnplannedHandTrap && (
              <button className="text-button" onClick={addHandTrapPlan}>
                <Plus size={16} /> 대응안 추가
              </button>
            )}
          </div>
          {handTrapPlans.length === 0 ? (
            <div className="inline-empty">
              대응안이 없으면 단발 방해는 기존 목표 도달 기준으로 검사하고,
              누적형 방해는 대응안 미등록으로 표시합니다.
            </div>
          ) : (
            <div className="handtrap-plan-list">
              {handTrapPlans.map((plan) => (
                <div className="handtrap-plan-editor" key={plan.id}>
                  <Field label="대상 패트랩">
                    <select
                      value={plan.handTrapId}
                      onChange={(event) =>
                        setHandTrapPlans((plans) =>
                          plans.map((item) =>
                            item.id === plan.id
                              ? { ...item, handTrapId: event.target.value }
                              : item,
                          ),
                        )
                      }
                    >
                      {handTraps.map((trap) => (
                        <option
                          value={trap.id}
                          key={trap.id}
                          disabled={handTrapPlans.some(
                            (item) =>
                              item.id !== plan.id &&
                              item.handTrapId === trap.id,
                          )}
                        >
                          {trap.name} · {handTrapRole(trap)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="대응 방식">
                    <select
                      value={plan.strategy}
                      onChange={(event) =>
                        setHandTrapPlans((plans) =>
                          plans.map((item) =>
                            item.id === plan.id
                              ? {
                                  ...item,
                                  strategy: event.target
                                    .value as HandTrapResponseStrategy,
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      {Object.entries(HAND_TRAP_RESPONSE_LABEL).map(
                        ([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="상대 드로우 허용">
                    <label className="number-with-unit">
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={plan.maxOpponentDraws}
                        disabled={plan.strategy !== "ACCEPT_WITH_LIMIT"}
                        onChange={(event) =>
                          setHandTrapPlans((plans) =>
                            plans.map((item) =>
                              item.id === plan.id
                                ? {
                                    ...item,
                                    maxOpponentDraws: Math.max(
                                      0,
                                      Math.min(60, Number(event.target.value)),
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <span>장 이하</span>
                    </label>
                  </Field>
                  <Field label="방해 적용 허용">
                    <label className="number-with-unit">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={plan.maxAffectedSteps}
                        disabled={plan.strategy !== "ACCEPT_WITH_LIMIT"}
                        onChange={(event) =>
                          setHandTrapPlans((plans) =>
                            plans.map((item) =>
                              item.id === plan.id
                                ? {
                                    ...item,
                                    maxAffectedSteps: Math.max(
                                      0,
                                      Math.min(99, Number(event.target.value)),
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <span>단계 이하</span>
                    </label>
                  </Field>
                  <Field label="복합·잔존 처리 허용">
                    <label className="number-with-unit">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={plan.maxResolvedOperations}
                        disabled={plan.strategy !== "ACCEPT_WITH_LIMIT"}
                        onChange={(event) =>
                          setHandTrapPlans((plans) =>
                            plans.map((item) =>
                              item.id === plan.id
                                ? {
                                    ...item,
                                    maxResolvedOperations: Math.max(
                                      0,
                                      Math.min(99, Number(event.target.value)),
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <span>회 이하</span>
                    </label>
                  </Field>
                  <Field label="대응 메모">
                    <input
                      value={plan.notes}
                      onChange={(event) =>
                        setHandTrapPlans((plans) =>
                          plans.map((item) =>
                            item.id === plan.id
                              ? { ...item, notes: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="예: 증식의 G에 5장까지만 허용 후 종료"
                    />
                  </Field>
                  <button
                    className="icon-button danger"
                    aria-label="패트랩 대응안 삭제"
                    onClick={() =>
                      setHandTrapPlans((plans) =>
                        plans.filter((item) => item.id !== plan.id),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="builder-section">
          <div className="builder-heading">
            <div>
              <h3>패트랩별 우회 전개</h3>
              <p>
                특정 단계에서 패트랩을 맞았을 때 전환할 기존 전개법을
                연결합니다.
              </p>
            </div>
            {handTraps.length > 0 && combos.length > 0 && (
              <button
                className="text-button"
                onClick={() =>
                  setBranches((list) => [
                    ...list,
                    {
                      id: uid(),
                      name: "우회 전개",
                      triggerHandTrapId: handTraps[0].id,
                      atStepId: steps[0]?.id ?? "",
                      alternateComboId: combos[0].id,
                    },
                  ])
                }
              >
                <Plus size={16} /> 우회 추가
              </button>
            )}
          </div>
          {combos.length === 0 ? (
            <div className="inline-empty">
              우회 루트로 사용할 다른 전개법을 먼저 등록하세요.
            </div>
          ) : (
            branches.map((branch) => (
              <div className="branch-editor" key={branch.id}>
                <input
                  value={branch.name}
                  onChange={(e) =>
                    setBranches((list) =>
                      list.map((item) =>
                        item.id === branch.id
                          ? { ...item, name: e.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="우회 이름"
                />
                <select
                  value={branch.triggerHandTrapId}
                  onChange={(e) =>
                    setBranches((list) =>
                      list.map((item) =>
                        item.id === branch.id
                          ? { ...item, triggerHandTrapId: e.target.value }
                          : item,
                      ),
                    )
                  }
                >
                  {handTraps.map((trap) => (
                    <option value={trap.id} key={trap.id}>
                      {trap.name}
                    </option>
                  ))}
                </select>
                <select
                  value={branch.atStepId}
                  onChange={(e) =>
                    setBranches((list) =>
                      list.map((item) =>
                        item.id === branch.id
                          ? { ...item, atStepId: e.target.value }
                          : item,
                      ),
                    )
                  }
                >
                  {steps.map((step, index) => (
                    <option value={step.id} key={step.id}>
                      {index + 1}단계
                    </option>
                  ))}
                </select>
                <select
                  value={branch.alternateComboId}
                  onChange={(e) =>
                    setBranches((list) =>
                      list.map((item) =>
                        item.id === branch.id
                          ? { ...item, alternateComboId: e.target.value }
                          : item,
                      ),
                    )
                  }
                >
                  {combos.map((combo) => (
                    <option value={combo.id} key={combo.id}>
                      {combo.name}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-button danger"
                  onClick={() =>
                    setBranches((list) =>
                      list.filter((item) => item.id !== branch.id),
                    )
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
        {unresolvedChainIds.size > 0 && (
          <div className="route-warning chain-save-warning">
            처리되지 않은 체인이 있습니다. ‘체인 처리 (역순)’ 단계를 추가해야
            저장할 수 있습니다.
          </div>
        )}
        <button className="combo-step-fab" onClick={addStep}>
          <Plus size={18} /> 전개 단계 추가
        </button>
      </div>
      <ModalActions
        onClose={onClose}
        onSave={() =>
          name.trim() &&
          startingHand.length &&
          goals.length &&
          steps.length &&
          !unresolvedChainIds.size &&
          onSave({
            id: initialCombo?.id ?? uid(),
            name: name.trim(),
            deckId,
            startingHand,
            goals,
            opponentStartingLp,
            opponentStartingHandSize,
            steps,
            branches,
            handTrapPlans,
          })
        }
        disabled={
          !name.trim() ||
          !startingHand.length ||
          !goals.length ||
          !steps.length ||
          !deckId ||
          deckErrors.length > 0 ||
          unresolvedChainIds.size > 0 ||
          goals.some(
            (goal) => goal.kind === "SPECIAL_WIN" && !goal.label.trim(),
          ) ||
          steps.some(
            (step, index) =>
              !isStepEffectAvailable(step, index) ||
              !isStepTimingValid(step) ||
              !isChainStepValid(step, index) ||
              (step.actionType === "EFFECT" &&
                step.effectExecutionMode === "CHAIN_REGISTER" &&
                !step.chainLabel.trim()) ||
              step.effectGrantEvents.some(
                (event) => !isGrantTargetValid(event),
              ) ||
              (step.declaresSpecialWin && !step.specialWinText.trim()),
          ) ||
          branches.some(
            (branch) =>
              !branch.name.trim() ||
              !branch.atStepId ||
              !branch.alternateComboId,
          )
        }
      />
    </ModalShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function ModalActions({
  onClose,
  onSave,
  disabled,
}: {
  onClose: () => void;
  onSave: () => void;
  disabled: boolean;
}) {
  return (
    <div className="modal-actions">
      <button className="ghost-button" onClick={onClose}>
        취소
      </button>
      <button className="primary-button" onClick={onSave} disabled={disabled}>
        <BadgeCheck size={17} /> 저장
      </button>
    </div>
  );
}
function circled(n: number) {
  return ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"][n - 1] ?? `${n}.`;
}
