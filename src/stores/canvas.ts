import { create } from "zustand";
import { ipc } from "@/lib/ipc";
import { useTrash } from "@/stores/trash";
import type {
  CanvasConnection,
  CanvasData,
  CanvasMeta,
  CanvasNode,
  StickyColor,
} from "@/lib/types";

export type CanvasTool =
  | "select"
  | "pan"
  | "sticky"
  | "card"
  | "image"
  | "text"
  | "shape"
  | "connector";

interface CanvasState {
  currentCanvasId: string;
  canvasList: CanvasMeta[];
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  viewport: { x: number; y: number; zoom: number };
  selectedIds: string[];
  activeTool: CanvasTool;
  activeColor: StickyColor;
  connectingFromId: string | null;
  loaded: boolean;

  loadList: () => Promise<CanvasMeta[]>;
  load: (canvasId?: string) => Promise<void>;
  save: () => Promise<void>;

  createCanvas: (name: string) => Promise<string>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;

  addNode: (node: Partial<CanvasNode>) => string;
  updateNode: (id: string, patch: Partial<CanvasNode>) => void;
  deleteNodes: (ids: string[]) => void;
  duplicateNodes: (ids: string[]) => void;
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;

  addConnection: (fromId: string, toId: string, label?: string) => void;
  deleteConnection: (id: string) => void;

  setViewport: (
    viewport: Partial<{ x: number; y: number; zoom: number }>,
  ) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitView: () => void;

  setSelectedIds: (ids: string[]) => void;
  toggleSelectId: (id: string, multi?: boolean) => void;
  setActiveTool: (tool: CanvasTool) => void;
  setActiveColor: (color: StickyColor) => void;
  setConnectingFromId: (id: string | null) => void;

  clearCanvas: () => void;
  loadTemplate: (templateName: "moodboard" | "brainstorm") => void;
}

const DEFAULT_MOODBOARD_NODES: CanvasNode[] = [
  {
    id: "node-1",
    type: "card",
    x: 80,
    y: 80,
    width: 320,
    height: 180,
    title: "✨ Creative Moodboard",
    content: "Collect inspiration, sticky notes, imagery, and connections on an infinite canvas.",
    color: "neutral",
    zIndex: 1,
    updatedAt: Date.now(),
  },
  {
    id: "node-2",
    type: "sticky",
    x: 440,
    y: 80,
    width: 200,
    height: 200,
    content: "💡 Project Vision\n\n• Clean minimalist look\n• Local-first Markdown\n• Endless canvas workspace",
    color: "yellow",
    rotation: -1.5,
    zIndex: 2,
    updatedAt: Date.now(),
  },
  {
    id: "node-3",
    type: "sticky",
    x: 680,
    y: 110,
    width: 200,
    height: 200,
    content: "🎨 Color Palette\n\n• Warm monochrome base\n• Soft pastel sticky highlights\n• Crisp typography",
    color: "mint",
    rotation: 2,
    zIndex: 3,
    updatedAt: Date.now(),
  },
  {
    id: "node-4",
    type: "image",
    x: 80,
    y: 300,
    width: 320,
    height: 220,
    title: "Design Inspiration",
    content: "Minimalist workspace layout",
    imageUrl: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80",
    color: "neutral",
    zIndex: 4,
    updatedAt: Date.now(),
  },
  {
    id: "node-5",
    type: "sticky",
    x: 440,
    y: 320,
    width: 220,
    height: 200,
    content: "⚡ Quick Controls\n\n• Drag to move items\n• Pinch or Scroll to Zoom\n• Space + Drag to Pan\n• Double click to edit",
    color: "sky",
    rotation: -1,
    zIndex: 5,
    updatedAt: Date.now(),
  },
  {
    id: "node-6",
    type: "shape",
    shapeType: "pill",
    x: 690,
    y: 360,
    width: 180,
    height: 60,
    content: "🚀 Launched Idea",
    color: "lavender",
    zIndex: 6,
    updatedAt: Date.now(),
  },
];

const DEFAULT_CONNECTIONS: CanvasConnection[] = [
  {
    id: "conn-1",
    fromId: "node-1",
    toId: "node-2",
    label: "Vision",
    style: "curved",
  },
  {
    id: "conn-2",
    fromId: "node-2",
    toId: "node-3",
    label: "Style",
    style: "curved",
  },
  {
    id: "conn-3",
    fromId: "node-1",
    toId: "node-4",
    label: "Inspiration",
    style: "curved",
  },
  {
    id: "conn-4",
    fromId: "node-3",
    toId: "node-6",
    label: "Result",
    style: "dashed",
  },
];

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useCanvas = create<CanvasState>((set, get) => ({
  currentCanvasId: "default",
  canvasList: [{ id: "default", name: "Moodboard Geral", createdAt: Date.now(), updatedAt: Date.now() }],
  nodes: [],
  connections: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedIds: [],
  activeTool: "select",
  activeColor: "yellow",
  connectingFromId: null,
  loaded: false,

  loadList: async () => {
    try {
      const list = await ipc.canvasListLoad();
      if (list && Array.isArray(list) && list.length > 0) {
        set({ canvasList: list });
        return list;
      }
    } catch {
      // fallback
    }
    const defaultList: CanvasMeta[] = [
      { id: "default", name: "Moodboard Geral", createdAt: Date.now(), updatedAt: Date.now() },
    ];
    set({ canvasList: defaultList });
    return defaultList;
  },

  load: async (id) => {
    const canvasId = id || get().currentCanvasId || "default";
    set({ currentCanvasId: canvasId, loaded: false });
    await get().loadList();

    try {
      const data = await ipc.canvasLoad(canvasId);
      if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
        set({
          nodes: data.nodes,
          connections: data.connections || [],
          viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
          loaded: true,
        });
      } else {
        // First load: seed default moodboard template
        set({
          nodes: DEFAULT_MOODBOARD_NODES,
          connections: DEFAULT_CONNECTIONS,
          viewport: { x: 40, y: 40, zoom: 0.95 },
          loaded: true,
        });
        await get().save();
      }
    } catch {
      set({
        nodes: DEFAULT_MOODBOARD_NODES,
        connections: DEFAULT_CONNECTIONS,
        viewport: { x: 40, y: 40, zoom: 0.95 },
        loaded: true,
      });
    }
  },

  save: async () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const { nodes, connections, viewport, currentCanvasId } = get();
      const payload: CanvasData = {
        version: 1,
        nodes,
        connections,
        viewport,
      };
      try {
        await ipc.canvasSave(payload, currentCanvasId);
      } catch {
        // non-fatal
      }
    }, 300);
  },

  createCanvas: async (name: string) => {
    const list = await get().loadList();
    const newId = `canvas-${Date.now()}`;
    const newMeta: CanvasMeta = {
      id: newId,
      name: name.trim() || "Novo Moodboard",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const newList = [...list, newMeta];
    set({ canvasList: newList });
    await ipc.canvasListSave(newList);

    const initialData: CanvasData = {
      version: 1,
      nodes: [
        {
          id: `node-${Date.now()}`,
          type: "card",
          x: 100,
          y: 100,
          width: 320,
          height: 180,
          title: `✨ ${newMeta.name}`,
          content: "Cole referências, sticky notes, imagens e conexões do seu projeto.",
          color: "neutral",
          zIndex: 1,
          updatedAt: Date.now(),
        },
      ],
      connections: [],
      viewport: { x: 40, y: 40, zoom: 1 },
    };
    await ipc.canvasSave(initialData, newId);
    return newId;
  },

  renameCanvas: async (id: string, name: string) => {
    const list = get().canvasList;
    const newList = list.map((item) =>
      item.id === id ? { ...item, name: name.trim() || item.name, updatedAt: Date.now() } : item,
    );
    set({ canvasList: newList });
    await ipc.canvasListSave(newList);
  },

  deleteCanvas: async (id: string) => {
    const list = get().canvasList;
    if (list.length <= 1) return;
    const targetMeta = list.find((item) => item.id === id);
    if (targetMeta) {
      let data = null;
      try {
        data = await ipc.canvasLoad(id);
      } catch {
        // ignore
      }
      useTrash.getState().addItem({
        name: targetMeta.name,
        type: "canvas",
        payload: { meta: targetMeta, data },
      });
    }
    const newList = list.filter((item) => item.id !== id);
    set({ canvasList: newList });
    await ipc.canvasListSave(newList);

    if (get().currentCanvasId === id) {
      const nextId = newList[0]?.id || "default";
      await get().load(nextId);
    }
  },

  addNode: (partialNode) => {
    const { nodes, activeColor } = get();
    const maxZ = nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    const id = `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    const newNode: CanvasNode = {
      id,
      type: partialNode.type || "sticky",
      x: partialNode.x ?? 200,
      y: partialNode.y ?? 200,
      width: partialNode.width ?? (partialNode.type === "sticky" ? 200 : 280),
      height: partialNode.height ?? (partialNode.type === "sticky" ? 200 : 180),
      content: partialNode.content ?? "",
      title: partialNode.title,
      color: partialNode.color || activeColor,
      imageUrl: partialNode.imageUrl,
      rotation: partialNode.type === "sticky" ? (Math.random() * 4 - 2) : 0,
      shapeType: partialNode.shapeType,
      zIndex: maxZ + 1,
      updatedAt: Date.now(),
    };

    set({
      nodes: [...nodes, newNode],
      selectedIds: [id],
    });
    void get().save();
    return id;
  },

  updateNode: (id, patch) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    }));
    void get().save();
  },

  deleteNodes: (ids) => {
    if (ids.length === 0) return;
    set((state) => ({
      nodes: state.nodes.filter((n) => !ids.includes(n.id)),
      connections: state.connections.filter(
        (c) => !ids.includes(c.fromId) && !ids.includes(c.toId),
      ),
      selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
    }));
    void get().save();
  },

  duplicateNodes: (ids) => {
    const { nodes } = get();
    const targets = nodes.filter((n) => ids.includes(n.id));
    if (targets.length === 0) return;

    const maxZ = nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    const newNodes: CanvasNode[] = [];
    const newIds: string[] = [];

    targets.forEach((node, idx) => {
      const newId = `node-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`;
      newIds.push(newId);
      newNodes.push({
        ...node,
        id: newId,
        x: node.x + 30,
        y: node.y + 30,
        zIndex: maxZ + idx + 1,
        updatedAt: Date.now(),
      });
    });

    set({
      nodes: [...nodes, ...newNodes],
      selectedIds: newIds,
    });
    void get().save();
  },

  bringToFront: (ids) => {
    const { nodes } = get();
    const maxZ = nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    set({
      nodes: nodes.map((n) =>
        ids.includes(n.id) ? { ...n, zIndex: maxZ + 1 } : n,
      ),
    });
    void get().save();
  },

  sendToBack: (ids) => {
    const { nodes } = get();
    const minZ = nodes.reduce((min, n) => Math.min(min, n.zIndex || 0), 0);
    set({
      nodes: nodes.map((n) =>
        ids.includes(n.id) ? { ...n, zIndex: Math.max(1, minZ - 1) } : n,
      ),
    });
    void get().save();
  },

  addConnection: (fromId, toId, label) => {
    if (fromId === toId) return;
    const { connections } = get();
    const exists = connections.some(
      (c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId),
    );
    if (exists) return;

    const newConnection: CanvasConnection = {
      id: `conn-${Date.now()}`,
      fromId,
      toId,
      label,
      style: "curved",
    };

    set({
      connections: [...connections, newConnection],
      connectingFromId: null,
      activeTool: "select",
    });
    void get().save();
  },

  deleteConnection: (id) => {
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
    }));
    void get().save();
  },

  setViewport: (patch) => {
    set((state) => ({
      viewport: { ...state.viewport, ...patch },
    }));
    void get().save();
  },

  zoomIn: () => {
    const { zoom } = get().viewport;
    const nextZoom = Math.min(2.5, Number((zoom + 0.15).toFixed(2)));
    get().setViewport({ zoom: nextZoom });
  },

  zoomOut: () => {
    const { zoom } = get().viewport;
    const nextZoom = Math.max(0.25, Number((zoom - 0.15).toFixed(2)));
    get().setViewport({ zoom: nextZoom });
  },

  resetZoom: () => {
    get().setViewport({ zoom: 1 });
  },

  fitView: () => {
    const { nodes } = get();
    if (nodes.length === 0) {
      set({ viewport: { x: 0, y: 0, zoom: 1 } });
      return;
    }
    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x + n.width));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxY = Math.max(...nodes.map((n) => n.y + n.height));

    const width = maxX - minX;
    const height = maxY - minY;
    const maxDim = Math.max(width, height);

    set({
      viewport: {
        x: -minX + 80,
        y: -minY + 80,
        zoom: Math.min(1.2, Math.max(0.4, 800 / (maxDim + 200))),
      },
    });
  },

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  toggleSelectId: (id, multi = false) => {
    const { selectedIds } = get();
    if (multi) {
      if (selectedIds.includes(id)) {
        set({ selectedIds: selectedIds.filter((i) => i !== id) });
      } else {
        set({ selectedIds: [...selectedIds, id] });
      }
    } else {
      set({ selectedIds: [id] });
    }
  },

  setActiveTool: (tool) => {
    set({
      activeTool: tool,
      connectingFromId: tool === "connector" ? get().connectingFromId : null,
    });
  },

  setActiveColor: (color) => set({ activeColor: color }),

  setConnectingFromId: (id) => set({ connectingFromId: id }),

  clearCanvas: () => {
    set({
      nodes: [],
      connections: [],
      selectedIds: [],
    });
    void get().save();
  },

  loadTemplate: (template) => {
    if (template === "moodboard") {
      set({
        nodes: DEFAULT_MOODBOARD_NODES,
        connections: DEFAULT_CONNECTIONS,
        viewport: { x: 40, y: 40, zoom: 0.95 },
        selectedIds: [],
      });
    } else if (template === "brainstorm") {
      const centerNode: CanvasNode = {
        id: "center",
        type: "card",
        x: 400,
        y: 250,
        width: 260,
        height: 140,
        title: "🎯 Central Topic",
        content: "What is our main objective or design focus?",
        color: "neutral",
        zIndex: 1,
        updatedAt: Date.now(),
      };
      const branches: CanvasNode[] = [
        {
          id: "b1",
          type: "sticky",
          x: 120,
          y: 120,
          width: 200,
          height: 180,
          content: "💭 Idea 1\n\nUser experience principles",
          color: "yellow",
          rotation: -2,
          zIndex: 2,
          updatedAt: Date.now(),
        },
        {
          id: "b2",
          type: "sticky",
          x: 720,
          y: 120,
          width: 200,
          height: 180,
          content: "🚀 Idea 2\n\nTechnical stack & tools",
          color: "sky",
          rotation: 2,
          zIndex: 3,
          updatedAt: Date.now(),
        },
        {
          id: "b3",
          type: "sticky",
          x: 120,
          y: 380,
          width: 200,
          height: 180,
          content: "🎨 Idea 3\n\nVisual aesthetic & palette",
          color: "mint",
          rotation: 1,
          zIndex: 4,
          updatedAt: Date.now(),
        },
        {
          id: "b4",
          type: "sticky",
          x: 720,
          y: 380,
          width: 200,
          height: 180,
          content: "📊 Idea 4\n\nFeedback & next steps",
          color: "rose",
          rotation: -1,
          zIndex: 5,
          updatedAt: Date.now(),
        },
      ];
      const conns: CanvasConnection[] = [
        { id: "c1", fromId: "center", toId: "b1", style: "curved" },
        { id: "c2", fromId: "center", toId: "b2", style: "curved" },
        { id: "c3", fromId: "center", toId: "b3", style: "curved" },
        { id: "c4", fromId: "center", toId: "b4", style: "curved" },
      ];
      set({
        nodes: [centerNode, ...branches],
        connections: conns,
        viewport: { x: 50, y: 50, zoom: 0.9 },
        selectedIds: [],
      });
    }
    void get().save();
  },
}));
