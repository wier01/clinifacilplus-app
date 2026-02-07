// clinica-crm-mobile/app/(tabs)/inbox.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  TextInput,
  View,
  RefreshControl,
  ScrollView,
  SectionList,
  Modal,
  PanResponder,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";

type PipelineRow = {
  id: string;
  name?: string | null;
};

type PipelineStageRow = {
  id: string;
  code?: string | null;
  name?: string | null;
  position?: number | null;
};

type PipelineItemRow = {
  id: string;
  phone?: string | null;

  patient_name?: string | null;
  lead_name?: string | null;
  name?: string | null;

  last_message_text?: string | null;
  last_message?: string | null;
  message_preview?: string | null;

  stage_id?: string | null;
  stage_code?: string | null;
  stage_name?: string | null;

  specialty?: string | null;
  payment_type?: string | null;
  visit_type?: string | null;

  status?: string | null;

  updated_at?: string | null;
  last_interaction_at?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
};

type StatusFilter = "__ALL__" | "OPEN" | "WON" | "LOST";
type SortMode = "RECENT" | "OLD" | "STAGE";

// -------------------------
// Config
// -------------------------
const UNANSWERED_MINUTES = 20;

// Paginação
const PAGE_LIMIT = 80;

// Swipe
const ACTION_W = 80;
const ACTIONS_COUNT = 4;
const MAX_SWIPE = ACTION_W * ACTIONS_COUNT;
const SWIPE_OPEN_THRESHOLD = 0.35;

// Persistência
const INBOX_PREFS_KEY = "clinica_crm_inbox_prefs_v1";

type InboxPrefs = {
  q: string;
  statusFilter: StatusFilter;
  stageFilter: string;
  sortMode: SortMode;
  selectedPipelineId: string | null;
};

// -------------------------
// Helpers
// -------------------------
function fmtTag(s?: string | null) {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function safeTimeLabel(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function toMs(dateStr?: string | null) {
  if (!dateStr) return 0;
  const ms = new Date(dateStr).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function pickBestTs(it: PipelineItemRow) {
  return (
    toMs(it.last_message_at) ||
    toMs(it.last_interaction_at) ||
    toMs(it.updated_at) ||
    toMs(it.created_at) ||
    0
  );
}

function normalizePhone(raw?: string | null) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return s.replace(/[^\d+]/g, "");
}

function formatPhoneBRLike(raw?: string | null) {
  const s = normalizePhone(raw);
  if (!s) return "";
  const digits = s.startsWith("+") ? s.slice(1) : s;

  if (digits.length >= 12) {
    const cc = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) return `${cc} ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `${cc} ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `${cc} ${ddd} ${rest}`;
  }

  return digits;
}

function pickTitle(it: PipelineItemRow) {
  const name =
    (it.patient_name && String(it.patient_name).trim()) ||
    (it.lead_name && String(it.lead_name).trim()) ||
    (it.name && String(it.name).trim()) ||
    "";
  if (name) return name;

  const phone = formatPhoneBRLike(it.phone);
  if (phone) return phone;

  const id = String(it.id ?? "");
  if (id) return `Lead ${id.slice(0, 8)}`;

  return "Lead";
}

function pickSubtitle(it: PipelineItemRow) {
  const s =
    (it.last_message_text && String(it.last_message_text).trim()) ||
    (it.last_message && String(it.last_message).trim()) ||
    (it.message_preview && String(it.message_preview).trim()) ||
    "";
  return s || "Sem mensagem";
}

function normalizeItemsResponse(data: any): PipelineItemRow[] {
  const list = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
  if (!Array.isArray(list)) return [];

  return list
    .filter(Boolean)
    .map((row: any) => {
      if (row?.item) {
        const it = row.item ?? {};
        const st = row.stage ?? {};
        const out: PipelineItemRow = {
          ...it,
          id: String(it.id),
          stage_id: it.stage_id ?? st?.id ?? null,
          stage_code: it.stage_code ?? st?.code ?? null,
          stage_name: it.stage_name ?? st?.name ?? null,
        };
        return out;
      }

      const out: PipelineItemRow = { ...row, id: String(row.id) };
      if (!out.stage_code && row?.stage?.code) out.stage_code = row.stage.code;
      if (!out.stage_name && row?.stage?.name) out.stage_name = row.stage.name;
      return out;
    })
    .filter((it: PipelineItemRow) => !!it?.id);
}

function statusBucket(statusRaw?: string | null): "OPEN" | "WON" | "LOST" {
  const s = String(statusRaw ?? "").toUpperCase().trim();
  if (s === "WON" || s === "CLOSED_WON" || s === "SCHEDULED") return "WON";
  if (s === "LOST" || s === "CLOSED_LOST") return "LOST";
  return "OPEN";
}

function stageKey(it: PipelineItemRow) {
  const id = String(it.stage_id ?? "").trim();
  const code = String(it.stage_code ?? "").trim();
  const name = String(it.stage_name ?? "").trim();

  if (id) return `ID:${id}`;
  if (code && name) return `${code}__${name}`;
  if (code) return `${code}__${code}`;
  if (name) return `__${name}`;
  return "__SEM_ETAPA";
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function stageColor(label: string) {
  const palette = [
    { bg: "rgba(59,130,246,0.12)", bd: "rgba(59,130,246,0.45)", fg: "#1E3A8A" },
    { bg: "rgba(16,185,129,0.12)", bd: "rgba(16,185,129,0.45)", fg: "#065F46" },
    { bg: "rgba(245,158,11,0.14)", bd: "rgba(245,158,11,0.50)", fg: "#92400E" },
    { bg: "rgba(168,85,247,0.12)", bd: "rgba(168,85,247,0.45)", fg: "#5B21B6" },
    { bg: "rgba(236,72,153,0.12)", bd: "rgba(236,72,153,0.45)", fg: "#9D174D" },
    { bg: "rgba(14,165,233,0.12)", bd: "rgba(14,165,233,0.45)", fg: "#075985" },
    { bg: "rgba(100,116,139,0.12)", bd: "rgba(100,116,139,0.40)", fg: "#334155" },
  ];
  const idx = hashString(label) % palette.length;
  return palette[idx];
}

function initialsFromTitle(s: string) {
  const parts = String(s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "LE";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function avatarColor(label: string) {
  const palette = ["#2563EB", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#64748B"];
  return palette[hashString(label) % palette.length];
}

function statusChipStyle(status: StatusFilter, active: boolean) {
  const map: Record<string, { bg: string; bd: string; fg: string }> = {
    __ALL__: { bg: "rgba(100,116,139,0.10)", bd: "rgba(100,116,139,0.35)", fg: "#334155" },
    OPEN: { bg: "rgba(59,130,246,0.12)", bd: "rgba(59,130,246,0.45)", fg: "#1E3A8A" },
    WON: { bg: "rgba(16,185,129,0.12)", bd: "rgba(16,185,129,0.45)", fg: "#065F46" },
    LOST: { bg: "rgba(239,68,68,0.12)", bd: "rgba(239,68,68,0.45)", fg: "#7F1D1D" },
  };

  const base = { bg: "rgba(0,0,0,0.02)", bd: "rgba(0,0,0,0.10)", fg: "#111827" };
  const c = map[status] ?? base;

  if (!active) return { backgroundColor: base.bg, borderColor: base.bd, color: base.fg };
  return { backgroundColor: c.bg, borderColor: c.bd, color: c.fg };
}

function isUnanswered(it: PipelineItemRow) {
  const hasPatientMsg = !!String(it.last_message_text ?? "").trim();
  if (!hasPatientMsg) return false;
  const lastTs = pickBestTs(it);
  if (!lastTs) return false;
  const diffMin = (Date.now() - lastTs) / 60000;
  return diffMin >= UNANSWERED_MINUTES;
}

async function hapticLight() {
  try {
    await Haptics.selectionAsync();
  } catch {}
}

async function hapticSuccess() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  style: { backgroundColor: string; borderColor: string };
  textColor: string;
};
function Chip({ label, active, onPress, style, textColor }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: style.borderColor,
        backgroundColor: style.backgroundColor,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "900", color: textColor }}>{label}</Text>
    </Pressable>
  );
}

function Badge({ text, bg, fg, bd }: { text: string; bg: string; fg: string; bd: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: bd,
        backgroundColor: bg,
      }}
    >
      <Text style={{ fontSize: 12, color: fg, fontWeight: "900" }}>{text}</Text>
    </View>
  );
}

type Section = {
  key: string;
  title: string;
  count: number;
  color: { bg: string; bd: string; fg: string };
  data: PipelineItemRow[];
  position: number;
};

// -------------------------
// Persist helpers
// -------------------------
function sanitizePrefs(raw: any): InboxPrefs | null {
  try {
    const q = typeof raw?.q === "string" ? raw.q : "";
    const statusFilter: StatusFilter =
      raw?.statusFilter === "OPEN" || raw?.statusFilter === "WON" || raw?.statusFilter === "LOST" || raw?.statusFilter === "__ALL__"
        ? raw.statusFilter
        : "__ALL__";

    const stageFilter = typeof raw?.stageFilter === "string" ? raw.stageFilter : "__ALL__";

    const sortMode: SortMode = raw?.sortMode === "OLD" || raw?.sortMode === "STAGE" || raw?.sortMode === "RECENT" ? raw.sortMode : "RECENT";

    const selectedPipelineId = raw?.selectedPipelineId ? String(raw.selectedPipelineId) : null;

    return { q, statusFilter, stageFilter, sortMode, selectedPipelineId };
  } catch {
    return null;
  }
}

async function loadPrefs(): Promise<InboxPrefs | null> {
  try {
    const s = await AsyncStorage.getItem(INBOX_PREFS_KEY);
    if (!s) return null;
    const raw = JSON.parse(s);
    return sanitizePrefs(raw);
  } catch {
    return null;
  }
}

async function savePrefs(p: InboxPrefs) {
  try {
    await AsyncStorage.setItem(INBOX_PREFS_KEY, JSON.stringify(p));
  } catch {}
}

async function clearPrefs() {
  try {
    await AsyncStorage.removeItem(INBOX_PREFS_KEY);
  } catch {}
}

// -------------------------
// Swipe Row
// -------------------------
function SwipeRow({
  rowId,
  openRowId,
  setOpenRowId,
  children,
  actions,
}: {
  rowId: string;
  openRowId: string | null;
  setOpenRowId: (id: string | null) => void;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);

  const clamp = (v: number) => {
    if (v > 0) return 0;
    if (v < -MAX_SWIPE) return -MAX_SWIPE;
    return v;
  };

  const close = async (withHaptic = true) => {
    Animated.spring(x, {
      toValue: 0,
      useNativeDriver: true,
      friction: 14,
      tension: 120,
    }).start(async () => {
      startX.current = 0;
      if (openRowId === rowId) setOpenRowId(null);
      if (withHaptic) await hapticLight();
    });
  };

  const open = async () => {
    setOpenRowId(rowId);
    Animated.spring(x, {
      toValue: -MAX_SWIPE,
      useNativeDriver: true,
      friction: 14,
      tension: 120,
    }).start(async () => {
      startX.current = -MAX_SWIPE;
      await hapticLight();
    });
  };

  useEffect(() => {
    if (openRowId !== rowId) {
      x.stopAnimation((val: number) => {
        if (val < -10) {
          Animated.spring(x, {
            toValue: 0,
            useNativeDriver: true,
            friction: 14,
            tension: 120,
          }).start(() => {
            startX.current = 0;
          });
        }
      });
    }
  }, [openRowId, rowId, x]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        const ax = Math.abs(g.dx);
        const ay = Math.abs(g.dy);
        return ax > 8 && ax > ay * 1.2;
      },
      onPanResponderGrant: () => {
        x.stopAnimation((val: number) => {
          startX.current = val;
        });
      },
      onPanResponderMove: (_, g) => {
        const next = clamp(startX.current + g.dx);
        x.setValue(next);
      },
      onPanResponderRelease: async (_, g) => {
        const cur = clamp(startX.current + g.dx);
        const opened = Math.abs(cur) >= MAX_SWIPE * SWIPE_OPEN_THRESHOLD;
        const flingOpen = g.vx < -0.6;

        if (flingOpen || opened) {
          await open();
        } else {
          await close();
        }
      },
      onPanResponderTerminate: async () => close(),
    })
  ).current;

  return (
    <View style={{ position: "relative" }}>
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: MAX_SWIPE,
          flexDirection: "row",
          alignItems: "stretch",
          justifyContent: "flex-end",
        }}
      >
        {actions}
      </View>

      <Animated.View
        {...pan.panHandlers}
        style={{
          transform: [{ translateX: x }],
          backgroundColor: "white",
        }}
      >
        <Pressable
          onPress={() => {
            x.stopAnimation(async (val: number) => {
              if (val < -10) await close();
            });
          }}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function InboxScreen() {
  const colors = useColors();
  const router = useRouter();

  // estado
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("__ALL__");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("__ALL__");
  const [sortMode, setSortMode] = useState<SortMode>("RECENT");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // pipeline selecionado (persistido)
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  // controla quando prefs foram carregadas (pra não salvar "vazio" antes do load)
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const [moveOpen, setMoveOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PipelineItemRow | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // -------------------------
  // Load prefs on mount
  // -------------------------
  useEffect(() => {
    (async () => {
      const p = await loadPrefs();
      if (p) {
        setQ(p.q ?? "");
        setStatusFilter(p.statusFilter ?? "__ALL__");
        setStageFilter(p.stageFilter ?? "__ALL__");
        setSortMode(p.sortMode ?? "RECENT");
        setSelectedPipelineId(p.selectedPipelineId ?? null);
      }
      setPrefsLoaded(true);
    })();
  }, []);

  // -------------------------
  // Save prefs whenever change (after load)
  // -------------------------
  useEffect(() => {
    if (!prefsLoaded) return;
    const prefs: InboxPrefs = {
      q,
      statusFilter,
      stageFilter,
      sortMode,
      selectedPipelineId,
    };
    savePrefs(prefs);
  }, [prefsLoaded, q, statusFilter, stageFilter, sortMode, selectedPipelineId]);

  const resetFilters = async () => {
    setQ("");
    setStageFilter("__ALL__");
    setStatusFilter("__ALL__");
    setSortMode("RECENT");
    setSelectedPipelineId(null);
    await clearPrefs();
  };

  const openNote = (it: PipelineItemRow) => {
    setSelectedItem(it);
    setNoteDraft("");
    setNoteError(null);
    setNoteOpen(true);
  };

  const saveNote = async () => {
    if (!selectedItem) return;
    const text = String(noteDraft || "").trim();
    if (!text) {
      setNoteError("Digite uma nota.");
      return;
    }
    try {
      setNoteSaving(true);
      await apiCall(`/pipelines/items/${selectedItem.id}/note`, {
        method: "POST",
        body: { text },
      });
      setNoteOpen(false);
      setNoteDraft("");
      await itemsInfQ.refetch();
    } catch (e: any) {
      setNoteError(String(e?.message ?? e));
    } finally {
      setNoteSaving(false);
    }
  };

  // -------------------------
  // Pipelines
  // -------------------------
  const pipelinesQ = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const data = await apiCall<any>("/pipelines");
      const list: PipelineRow[] = Array.isArray(data) ? data : (data?.pipelines ?? data?.data ?? []);
      return (list || []).filter(Boolean).map((p: any) => ({ ...p, id: String(p.id) }));
    },
  });

  // pipelineId final = selecionado (se existe) senão primeiro
  const pipelineId = useMemo(() => {
    const list = pipelinesQ.data ?? [];
    if (!list.length) return null;

    if (selectedPipelineId) {
      const exists = list.some((p) => String(p.id) === String(selectedPipelineId));
      if (exists) return String(selectedPipelineId);
    }
    return String(list[0].id);
  }, [pipelinesQ.data, selectedPipelineId]);

  // Se pipelineId escolhido não existir mais, reseta no state (e salva)
  useEffect(() => {
    if (!prefsLoaded) return;
    const list = pipelinesQ.data ?? [];
    if (!list.length) return;
    if (selectedPipelineId && !list.some((p) => String(p.id) === String(selectedPipelineId))) {
      setSelectedPipelineId(null);
    }
  }, [prefsLoaded, pipelinesQ.data, selectedPipelineId]);

  // -------------------------
  // Stages
  // -------------------------
  const stagesQ = useQuery({
    queryKey: ["pipeline-stages", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const data = await apiCall<any>(`/pipelines/${pipelineId}/stages`);
      const list: PipelineStageRow[] = Array.isArray(data) ? data : (data?.stages ?? data?.data ?? []);
      return (list || [])
        .filter(Boolean)
        .map((s: any) => ({
          id: String(s.id),
          code: s.code ?? null,
          name: s.name ?? null,
          position: typeof s.position === "number" ? s.position : Number(s.position ?? 0) || 0,
        }))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    },
  });

  const stageById = useMemo(() => {
    const m = new Map<string, PipelineStageRow>();
    for (const s of stagesQ.data ?? []) m.set(String(s.id), s);
    return m;
  }, [stagesQ.data]);

  // -------------------------
  // Infinite items
  // -------------------------
  const itemsInfQ = useInfiniteQuery({
    queryKey: ["pipeline-items-inf", pipelineId],
    enabled: !!pipelineId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = Number(pageParam || 0);
      const data = await apiCall<any>(`/pipelines/${pipelineId}/items?limit=${PAGE_LIMIT}&offset=${offset}`);
      const items = normalizeItemsResponse(data);
      items.sort((a, b) => pickBestTs(b) - pickBestTs(a));
      return { items, offset, limit: PAGE_LIMIT };
    },
    getNextPageParam: (lastPage) => {
      const len = lastPage.items.length;
      if (len < PAGE_LIMIT) return undefined;
      return lastPage.offset + PAGE_LIMIT;
    },
  });

  // baseItems = pages + dedup
  const baseItems = useMemo(() => {
    const pages = itemsInfQ.data?.pages ?? [];
    const all = pages.flatMap((p) => p.items ?? []);
    const byId = new Map<string, PipelineItemRow>();

    for (const it of all) {
      if (!it?.id) continue;
      const prev = byId.get(it.id);
      if (!prev) byId.set(it.id, it);
      else {
        const a = pickBestTs(prev);
        const b = pickBestTs(it);
        byId.set(it.id, b >= a ? it : prev);
      }
    }

    const out = Array.from(byId.values());
    out.sort((a, b) => pickBestTs(b) - pickBestTs(a));
    return out;
  }, [itemsInfQ.data]);

  const refreshing =
    pipelinesQ.isFetching || stagesQ.isFetching || itemsInfQ.isFetching || itemsInfQ.isRefetching;

  const statusCounts = useMemo(() => {
    const counts = { OPEN: 0, WON: 0, LOST: 0 };
    for (const it of baseItems) counts[statusBucket(it.status)]++;
    return counts;
  }, [baseItems]);

  const stageChips = useMemo(() => {
    const filteredByStatus =
      statusFilter === "__ALL__" ? baseItems : baseItems.filter((it) => statusBucket(it.status) === statusFilter);

    const map = new Map<string, number>();
    for (const it of filteredByStatus) {
      const k = stageKey(it);
      map.set(k, (map.get(k) ?? 0) + 1);
    }

    const labelFromKey = (key: string) => {
      if (key === "__SEM_ETAPA") return "Sem etapa";
      if (key.startsWith("ID:")) {
        const id = key.slice(3);
        const st = stageById.get(id);
        return String(st?.name ?? st?.code ?? "Etapa");
      }
      const parts = key.split("__");
      return parts[1] || "Etapa";
    };

    return Array.from(map.entries())
      .map(([key, count]) => ({ key, label: labelFromKey(key), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [baseItems, statusFilter, stageById]);

  // se etapa salva não existe mais, volta pra ALL
  const stageFilterSafe = useMemo(() => {
    if (stageFilter === "__ALL__") return "__ALL__";
    const exists = stageChips.some((c) => c.key === stageFilter);
    return exists ? stageFilter : "__ALL__";
  }, [stageFilter, stageChips]);

  // se stageFilterSafe mudou por ficar inválido, ajusta state (e salva)
  useEffect(() => {
    if (!prefsLoaded) return;
    if (stageFilter !== stageFilterSafe) setStageFilter(stageFilterSafe);
  }, [prefsLoaded, stageFilter, stageFilterSafe]);

  const itemsFiltered = useMemo(() => {
    let items = baseItems;

    if (statusFilter !== "__ALL__") {
      items = items.filter((it) => statusBucket(it.status) === statusFilter);
    }

    if (stageFilterSafe !== "__ALL__") {
      items = items.filter((it) => stageKey(it) === stageFilterSafe);
    }

    const qq = q.trim().toLowerCase();
    if (qq) {
      items = items.filter((it) => {
        const phone = String(it.phone ?? "").toLowerCase();
        const msg = String(it.last_message_text ?? it.last_message ?? it.message_preview ?? "").toLowerCase();
        const stage = String(it.stage_name ?? it.stage_code ?? "").toLowerCase();
        const name = String(it.patient_name ?? it.lead_name ?? it.name ?? "").toLowerCase();
        const status = String(it.status ?? "").toLowerCase();
        const specialty = String(it.specialty ?? "").toLowerCase();
        return (
          phone.includes(qq) ||
          msg.includes(qq) ||
          stage.includes(qq) ||
          name.includes(qq) ||
          status.includes(qq) ||
          specialty.includes(qq)
        );
      });
    }

    if (sortMode === "RECENT") items = [...items].sort((a, b) => pickBestTs(b) - pickBestTs(a));
    if (sortMode === "OLD") items = [...items].sort((a, b) => pickBestTs(a) - pickBestTs(b));
    if (sortMode === "STAGE") {
      items = [...items].sort((a, b) => {
        const sa = String(a.stage_name ?? a.stage_code ?? "").toLowerCase();
        const sb = String(b.stage_name ?? b.stage_code ?? "").toLowerCase();
        if (sa === sb) return pickBestTs(b) - pickBestTs(a);
        return sa.localeCompare(sb);
      });
    }

    return items;
  }, [baseItems, q, stageFilterSafe, statusFilter, sortMode]);

  const sections = useMemo(() => {
    const labelFromKey = (key: string) => {
      if (key === "__SEM_ETAPA") return "Sem etapa";
      if (key.startsWith("ID:")) {
        const id = key.slice(3);
        const st = stageById.get(id);
        return String(st?.name ?? st?.code ?? "Etapa");
      }
      const parts = key.split("__");
      return parts[1] || "Etapa";
    };

    const map = new Map<string, PipelineItemRow[]>();
    for (const it of itemsFiltered) {
      const k = stageKey(it);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }

    const sec: Array<{
      key: string;
      title: string;
      count: number;
      color: { bg: string; bd: string; fg: string };
      data: PipelineItemRow[];
      position: number;
    }> = [];

    for (const [key, data] of map.entries()) {
      const title = labelFromKey(key);
      const col = stageColor(title);

      let pos = 9999;
      if (key.startsWith("ID:")) {
        const id = key.slice(3);
        const st = stageById.get(id);
        if (st && typeof st.position === "number") pos = st.position;
      }

      const sorted = [...data];
      if (sortMode === "RECENT") sorted.sort((a, b) => pickBestTs(b) - pickBestTs(a));
      if (sortMode === "OLD") sorted.sort((a, b) => pickBestTs(a) - pickBestTs(b));

      sec.push({ key, title, count: sorted.length, color: col, data: sorted, position: pos });
    }

    sec.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      if (b.count !== a.count) return b.count - a.count;
      return a.title.localeCompare(b.title);
    });

    return sec;
  }, [itemsFiltered, stageById, sortMode]);

  const totalCountAll = baseItems.length;
  const filteredCount = itemsFiltered.length;

  const hasActiveFilters =
    q.trim().length > 0 || stageFilterSafe !== "__ALL__" || statusFilter !== "__ALL__" || sortMode !== "RECENT";

  async function moveItemToStage(itemId: string, stageId: string) {
    await apiCall<any>(`/pipelines/items/${itemId}/move`, {
      method: "POST",
      body: { stage_id: stageId },
    } as any);

    await itemsInfQ.refetch();
  }

  function findStageIdByCodes(codes: string[]) {
    const list = stagesQ.data ?? [];
    const set = new Set(codes.map((c) => c.toUpperCase()));
    const st = list.find((s) => set.has(String(s.code ?? "").toUpperCase()));
    return st?.id ? String(st.id) : null;
  }

  async function quickMark(item: PipelineItemRow, kind: "WON" | "LOST") {
    const codes = kind === "WON" ? ["SCHEDULED", "WON", "CLOSED_WON"] : ["LOST", "CLOSED_LOST"];
    const stageId = findStageIdByCodes(codes);

    if (!stageId) {
      Alert.alert(
        "Etapa não encontrada",
        kind === "WON"
          ? "Não achei uma etapa com code SCHEDULED/WON para marcar como Ganho."
          : "Não achei uma etapa com code LOST para marcar como Perdido."
      );
      return;
    }

    await moveItemToStage(item.id, stageId);
    await hapticSuccess();
  }

  const header = (
    <View style={{ padding: 16, paddingBottom: 6, backgroundColor: "#F7F8FB" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>Inbox</Text>
          <Text style={{ marginTop: 2, color: colors.muted, fontSize: 12 }}>
            {filteredCount} leads • {totalCountAll} no total
          </Text>
        </View>
        {hasActiveFilters ? (
          <Pressable
            onPress={resetFilters}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
              backgroundColor: "rgba(0,0,0,0.03)",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "900", color: colors.text }}>Limpar</Text>
          </Pressable>
        ) : null}
      </View>

      <View
        style={{
          marginTop: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: "rgba(15,23,42,0.10)",
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: "white",
        }}
      >
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por nome, telefone, mensagem ou etapa..."
          placeholderTextColor={colors.muted}
          style={{ flex: 1, fontSize: 14, color: colors.text }}
        />
        {q ? (
          <Pressable onPress={() => setQ("")}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.10)",
            backgroundColor: "white",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name="options-outline" size={16} color={colors.muted} />
          <Text style={{ fontSize: 12, fontWeight: "900", color: colors.text }}>Filtros</Text>
        </Pressable>

        {hasActiveFilters ? (
          <Pressable
            onPress={resetFilters}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
              backgroundColor: "rgba(0,0,0,0.03)",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "900", color: colors.text }}>Limpar</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={{ marginTop: 8, color: colors.muted, fontSize: 12 }}>
        Dica: arraste um lead para a esquerda para ações rápidas.
      </Text>

      {/* Erro */}
      {(pipelinesQ.isError || stagesQ.isError || itemsInfQ.isError) ? (
        <View
          style={{
            marginTop: 12,
            backgroundColor: "#FEF2F2",
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: "#FECACA",
          }}
        >
          <Text style={{ color: "#991B1B", fontWeight: "900" }}>Não consegui carregar o Inbox.</Text>
          <Text style={{ color: "#7F1D1D", marginTop: 6, lineHeight: 18 }}>
            {String(
              (pipelinesQ.error as any)?.message ??
                (stagesQ.error as any)?.message ??
                (itemsInfQ.error as any)?.message ??
                "Erro desconhecido"
            )}
          </Text>
          <Text style={{ color: "#7F1D1D", marginTop: 6, lineHeight: 18 }}>
            Dica: confirme em <Text style={{ fontWeight: "900" }}>Mais → Configurações</Text> se a API Base URL está em
            http://localhost:3000 e se o token está salvo.
          </Text>
        </View>
      ) : null}
    </View>
  );

  const renderLeadCard = (it: PipelineItemRow) => {
    const title = pickTitle(it);
    const sub = pickSubtitle(it);

    const ts = it.last_message_at ?? it.last_interaction_at ?? it.updated_at ?? it.created_at;
    const time = safeTimeLabel(ts);

    const stageText = String(it.stage_name ?? it.stage_code ?? "").trim();
    const stage = stageText ? stageText : null;

    const tag1 = fmtTag(it.specialty);
    const tag2 = fmtTag(it.visit_type);
    const tag3 = fmtTag(it.payment_type);

    const bucket = statusBucket(it.status);
    const statusBadge =
      bucket === "WON"
        ? { label: "Ganho", bg: "rgba(16,185,129,0.14)", bd: "rgba(16,185,129,0.35)", fg: "#065F46" }
        : bucket === "LOST"
          ? { label: "Perdido", bg: "rgba(239,68,68,0.12)", bd: "rgba(239,68,68,0.35)", fg: "#7F1D1D" }
          : { label: "Aberto", bg: "rgba(59,130,246,0.12)", bd: "rgba(59,130,246,0.35)", fg: "#1E3A8A" };

    const stageCol = stage ? stageColor(stage) : null;
    const unanswered = isUnanswered(it);
    const initials = initialsFromTitle(title);
    const avatarBg = avatarColor(title);

    const Actions = (
      <>
        <Pressable
          onPress={async () => {
            setOpenRowId(null);
            await hapticLight();
            router.push({ pathname: "/lead/[itemId]", params: { itemId: it.id } } as any);
          }}
          style={{
            width: ACTION_W,
            backgroundColor: "rgba(0,0,0,0.05)",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color="#0f172a" />
          <Text style={{ fontSize: 11, fontWeight: "900", color: "#0f172a" }}>Abrir</Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            setOpenRowId(null);
            await hapticLight();
            setSelectedItem(it);
            setMoveOpen(true);
          }}
          style={{
            width: ACTION_W,
            backgroundColor: "rgba(59,130,246,0.14)",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Ionicons name="shuffle" size={18} color="#1E3A8A" />
          <Text style={{ fontSize: 11, fontWeight: "900", color: "#1E3A8A" }}>Mover</Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            try {
              setOpenRowId(null);
              await quickMark(it, "WON");
            } catch (e: any) {
              Alert.alert("Erro", String(e?.message ?? e));
            }
          }}
          style={{
            width: ACTION_W,
            backgroundColor: "rgba(16,185,129,0.16)",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Ionicons name="checkmark-circle" size={18} color="#065F46" />
          <Text style={{ fontSize: 11, fontWeight: "900", color: "#065F46" }}>Ganho</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Alert.alert("Marcar como Perdido?", "Isso vai mover o lead para a etapa de perdido. Confirmar?", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Confirmar",
                style: "destructive",
                onPress: async () => {
                  try {
                    setOpenRowId(null);
                    await quickMark(it, "LOST");
                  } catch (e: any) {
                    Alert.alert("Erro", String(e?.message ?? e));
                  }
                },
              },
            ]);
          }}
          style={{
            width: ACTION_W,
            backgroundColor: "rgba(239,68,68,0.14)",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Ionicons name="close-circle" size={18} color="#7F1D1D" />
          <Text style={{ fontSize: 11, fontWeight: "900", color: "#7F1D1D" }}>Perdido</Text>
        </Pressable>
      </>
    );

    return (
      <View style={{ backgroundColor: "#F7F8FB" }}>
        <SwipeRow rowId={it.id} openRowId={openRowId} setOpenRowId={setOpenRowId} actions={Actions}>
          <Pressable
            style={{
              marginHorizontal: 16,
              marginTop: 10,
              marginBottom: 2,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(15,23,42,0.08)",
              backgroundColor: "white",
            }}
            onPress={() =>
              router.push(
                {
                  pathname: "/lead/[itemId]",
                  params: { itemId: it.id },
                } as any
              )
            }
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  backgroundColor: avatarBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "900", fontSize: 12 }}>{initials}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }} numberOfLines={1}>
                    {title}
                  </Text>

                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    {unanswered ? <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#22C55E" }} /> : null}

                    {time ? <Text style={{ color: colors.muted, fontSize: 12 }}>{time}</Text> : null}
                  </View>
                </View>

                <Text style={{ marginTop: 2, color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                  {sub}
                </Text>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {stage ? (
                    <Badge
                      text={stage}
                      bg={stageCol?.bg ?? "rgba(0,0,0,0.03)"}
                      bd={stageCol?.bd ?? "rgba(0,0,0,0.10)"}
                      fg={stageCol?.fg ?? "#111827"}
                    />
                  ) : (
                    <Badge text={statusBadge.label} bg={statusBadge.bg} fg={statusBadge.fg} bd={statusBadge.bd} />
                  )}
                </View>
              </View>
            </View>
          </Pressable>
        </SwipeRow>
      </View>
    );
  };

  const footer = (
    <View style={{ padding: 16, alignItems: "center" }}>
      {itemsInfQ.isFetchingNextPage ? <ActivityIndicator /> : null}

      {!itemsInfQ.isFetchingNextPage && itemsInfQ.hasNextPage ? (
        <Pressable
          onPress={() => itemsInfQ.fetchNextPage()}
          style={{
            marginTop: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.10)",
            backgroundColor: "rgba(0,0,0,0.03)",
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.text }}>Carregar mais</Text>
        </Pressable>
      ) : null}

      {!itemsInfQ.hasNextPage && totalCountAll > 0 ? (
        <Text style={{ marginTop: 10, color: colors.muted, fontSize: 12 }}>Fim da lista</Text>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer className="bg-[#F2F5F7]">
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -120,
          left: -80,
          right: -80,
          height: 240,
          backgroundColor: "rgba(37,211,102,0.12)",
          borderBottomLeftRadius: 220,
          borderBottomRightRadius: 220,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 120,
          right: -120,
          width: 220,
          height: 220,
          borderRadius: 999,
          backgroundColor: "rgba(16,185,129,0.10)",
        }}
      />
      <SectionList
        sections={sections}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        stickySectionHeadersEnabled
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (itemsInfQ.hasNextPage && !itemsInfQ.isFetchingNextPage) {
            itemsInfQ.fetchNextPage();
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              pipelinesQ.refetch();
              stagesQ.refetch();
              itemsInfQ.refetch();
            }}
          />
        }
        renderSectionHeader={({ section }) => (
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 8,
              backgroundColor: "#F7F8FB",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: section.color.fg,
                }}
              />

              <Text style={{ fontSize: 12, fontWeight: "900", color: colors.text }} numberOfLines={1}>
                {section.title}
              </Text>

              <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                {section.count} lead{section.count === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => renderLeadCard(item)}
        ListEmptyComponent={() => {
          if (pipelinesQ.isLoading || stagesQ.isLoading || itemsInfQ.isLoading) {
            return (
              <View style={{ padding: 16 }}>
                <ActivityIndicator />
              </View>
            );
          }

          const msg =
            statusFilter !== "__ALL__" || stageFilterSafe !== "__ALL__" || q.trim()
              ? "Nenhum lead encontrado com os filtros atuais."
              : "Nenhum lead encontrado no pipeline.";

          return (
            <View
              style={{
                padding: 24,
                alignItems: "center",
                marginHorizontal: 16,
                marginTop: 16,
                backgroundColor: "white",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  backgroundColor: "rgba(37,99,235,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chatbubbles" size={24} color="#1E3A8A" />
              </View>
              <Text style={{ marginTop: 10, fontWeight: "900", color: colors.text }}>Tudo em dia</Text>
              <Text style={{ marginTop: 6, color: colors.muted, textAlign: "center" }}>{msg}</Text>
            </View>
          );
        }}
      />

      {/* Modal Mover Etapa */}
      <Modal visible={moveOpen} animationType="slide" transparent onRequestClose={() => setMoveOpen(false)}>
        <Pressable
          onPress={() => setMoveOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", padding: 18, justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
              maxHeight: "70%",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Mover etapa</Text>
            <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
              {selectedItem ? pickTitle(selectedItem) : ""}
            </Text>

            <View style={{ height: 12 }} />

            {stagesQ.isLoading ? (
              <View style={{ paddingVertical: 18 }}>
                <ActivityIndicator />
              </View>
            ) : (stagesQ.data ?? []).length === 0 ? (
              <View style={{ paddingVertical: 12 }}>
                <Text style={{ color: colors.muted }}>Não encontrei etapas para este pipeline.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {(stagesQ.data ?? []).map((st) => {
                  const label = String(st.name ?? st.code ?? "").trim() || "Etapa";
                  const col = stageColor(label);

                  const isCurrent = !!selectedItem?.stage_id && String(selectedItem.stage_id) === String(st.id);

                  return (
                    <Pressable
                      key={st.id}
                      onPress={async () => {
                        if (!selectedItem) return;
                        try {
                          await moveItemToStage(selectedItem.id, st.id);
                          setMoveOpen(false);
                          await hapticSuccess();
                        } catch (e: any) {
                          Alert.alert("Erro", String(e?.message ?? e));
                        }
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isCurrent ? col.bd : "rgba(0,0,0,0.10)",
                        backgroundColor: isCurrent ? col.bg : "rgba(0,0,0,0.02)",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <Text style={{ fontWeight: "900", color: isCurrent ? col.fg : colors.text }} numberOfLines={1}>
                        {label}
                      </Text>

                      {isCurrent ? (
                        <Badge text="Atual" bg={col.bg} bd={col.bd} fg={col.fg} />
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ height: 12 }} />

            <Pressable
              onPress={() => setMoveOpen(false)}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                paddingHorizontal: 12,
                backgroundColor: "rgba(0,0,0,0.02)",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.10)",
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.text }}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Filtros */}
      <Modal visible={filtersOpen} animationType="slide" transparent onRequestClose={() => setFiltersOpen(false)}>
        <Pressable
          onPress={() => setFiltersOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", padding: 18, justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
              maxHeight: "75%",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Filtros</Text>
              {hasActiveFilters ? (
                <Pressable onPress={resetFilters}>
                  <Text style={{ fontSize: 12, fontWeight: "900", color: "#1E3A8A" }}>Limpar</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {(() => {
                  const active = statusFilter === "__ALL__";
                  const st = statusChipStyle("__ALL__", active);
                  return (
                    <Pressable
                      onPress={() => setStatusFilter("__ALL__")}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: st.borderColor,
                        backgroundColor: st.backgroundColor,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "900", color: st.color }}>
                        Todos ({totalCountAll})
                      </Text>
                    </Pressable>
                  );
                })()}

                {(["OPEN", "WON", "LOST"] as const).map((s) => {
                  const active = statusFilter === s;
                  const st = statusChipStyle(s, active);
                  const label = s === "OPEN" ? "Abertos" : s === "WON" ? "Ganhos" : "Perdidos";
                  const count = s === "OPEN" ? statusCounts.OPEN : s === "WON" ? statusCounts.WON : statusCounts.LOST;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setStatusFilter(s)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: st.borderColor,
                        backgroundColor: st.backgroundColor,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "900", color: st.color }}>
                        {label} ({count})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {(pipelinesQ.data ?? []).length > 1 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>Pipeline</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {(pipelinesQ.data ?? []).map((p) => {
                    const active = String(p.id) === String(pipelineId);
                    const col = active
                      ? { bg: "rgba(59,130,246,0.12)", bd: "rgba(59,130,246,0.45)", fg: "#1E3A8A" }
                      : { bg: "rgba(0,0,0,0.02)", bd: "rgba(0,0,0,0.10)", fg: "#111827" };

                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setSelectedPipelineId(String(p.id))}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: col.bd,
                          backgroundColor: col.bg,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "900", color: col.fg }} numberOfLines={1}>
                          {String(p.name ?? `Pipeline ${String(p.id).slice(0, 6)}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {totalCountAll > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>Etapa</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {(() => {
                    const active = stageFilterSafe === "__ALL__";
                    const st = active
                      ? { bg: "rgba(16,185,129,0.12)", bd: "rgba(16,185,129,0.45)", fg: "#065F46" }
                      : { bg: "rgba(0,0,0,0.02)", bd: "rgba(0,0,0,0.10)", fg: "#111827" };

                    return (
                      <Pressable
                        onPress={() => setStageFilter("__ALL__")}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: st.bd,
                          backgroundColor: st.bg,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "900", color: st.fg }}>
                          Todas <Text style={{ color: colors.muted }}>({filteredCount})</Text>
                        </Text>
                      </Pressable>
                    );
                  })()}

                  {stageChips.map((c) => {
                    const active = stageFilterSafe === c.key;
                    const col = stageColor(c.label);
                    const st = active
                      ? { bg: col.bg, bd: col.bd, fg: col.fg }
                      : { bg: "rgba(0,0,0,0.02)", bd: "rgba(0,0,0,0.10)", fg: "#111827" };

                    return (
                      <Pressable
                        key={c.key}
                        onPress={() => setStageFilter(c.key)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: st.bd,
                          backgroundColor: st.bg,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "900", color: st.fg }} numberOfLines={1}>
                          {c.label} <Text style={{ color: colors.muted }}>({c.count})</Text>
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>Ordenar</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {(["RECENT", "OLD", "STAGE"] as SortMode[]).map((m) => {
                  const label = m === "RECENT" ? "Recentes" : m === "OLD" ? "Antigos" : "Etapa";
                  const active = sortMode === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setSortMode(m)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? "rgba(59,130,246,0.45)" : "rgba(0,0,0,0.10)",
                        backgroundColor: active ? "rgba(59,130,246,0.12)" : "rgba(0,0,0,0.02)",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "900", color: active ? "#1E3A8A" : "#111827" }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 12 }} />
            <Pressable
              onPress={() => setFiltersOpen(false)}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                paddingHorizontal: 12,
                backgroundColor: "rgba(0,0,0,0.02)",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.10)",
                alignItems: "center",
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.text }}>Concluir</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Nota Interna */}
      <Modal visible={noteOpen} animationType="slide" transparent onRequestClose={() => setNoteOpen(false)}>
        <Pressable
          onPress={() => setNoteOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", padding: 18, justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Adicionar nota</Text>
            <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
              {selectedItem ? pickTitle(selectedItem) : ""}
            </Text>

            <TextInput
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Ex: Paciente pediu retorno na próxima semana…"
              placeholderTextColor={colors.muted}
              multiline
              style={{
                minHeight: 90,
                marginTop: 10,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                backgroundColor: "rgba(0,0,0,0.03)",
              }}
            />

            {noteError ? <Text style={{ color: "#b91c1c", marginTop: 6, fontSize: 12 }}>{noteError}</Text> : null}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => setNoteOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  backgroundColor: "rgba(0,0,0,0.02)",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.10)",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.text }}>Cancelar</Text>
              </Pressable>

              <Pressable
                onPress={saveNote}
                disabled={noteSaving}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  backgroundColor: "rgba(37,99,235,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(37,99,235,0.45)",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#1E3A8A" }}>
                  {noteSaving ? "Salvando..." : "Salvar"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}


