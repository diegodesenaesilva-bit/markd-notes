import {
  BringToFront,
  ChevronDown,
  CopyPlus,
  CornerDownRight,
  FileText,
  Folder,
  FolderPlus,
  Grid,
  Hand,
  Image as ImageIcon,
  Maximize2,
  MousePointer,
  Palette,
  SendToBack,
  Sparkles,
  Square,
  StickyNote,
  Type,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Tooltip } from "@/components/ui/Tooltip";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/utils";
import { useCanvas } from "@/stores/canvas";
import { useVault } from "@/stores/vault";
import { VaultItemPickerModal } from "@/components/canvas/VaultItemPickerModal";
import type { CanvasNode, StickyColor } from "@/lib/types";

const COLOR_CLASSES: Record<
  StickyColor | string,
  { bg: string; border: string; text: string; header: string }
> = {
  yellow: {
    bg: "bg-amber-100 dark:bg-amber-950/70",
    border: "border-amber-300/80 dark:border-amber-700/60",
    text: "text-amber-950 dark:text-amber-100",
    header: "bg-amber-200/60 dark:bg-amber-900/40",
  },
  mint: {
    bg: "bg-emerald-100 dark:bg-emerald-950/70",
    border: "border-emerald-300/80 dark:border-emerald-700/60",
    text: "text-emerald-950 dark:text-emerald-100",
    header: "bg-emerald-200/60 dark:bg-emerald-900/40",
  },
  sky: {
    bg: "bg-sky-100 dark:bg-sky-950/70",
    border: "border-sky-300/80 dark:border-sky-700/60",
    text: "text-sky-950 dark:text-sky-100",
    header: "bg-sky-200/60 dark:bg-sky-900/40",
  },
  lavender: {
    bg: "bg-purple-100 dark:bg-purple-950/70",
    border: "border-purple-300/80 dark:border-purple-700/60",
    text: "text-purple-950 dark:text-purple-100",
    header: "bg-purple-200/60 dark:bg-purple-900/40",
  },
  rose: {
    bg: "bg-rose-100 dark:bg-rose-950/70",
    border: "border-rose-300/80 dark:border-rose-700/60",
    text: "text-rose-950 dark:text-rose-100",
    header: "bg-rose-200/60 dark:bg-rose-900/40",
  },
  neutral: {
    bg: "bg-panel",
    border: "border-line",
    text: "text-ink",
    header: "bg-hover",
  },
};

const COLOR_OPTIONS: { id: StickyColor; label: string; dot: string }[] = [
  { id: "yellow", label: "Yellow", dot: "bg-amber-300 border-amber-400" },
  { id: "mint", label: "Mint", dot: "bg-emerald-300 border-emerald-400" },
  { id: "sky", label: "Sky", dot: "bg-sky-300 border-sky-400" },
  { id: "lavender", label: "Lavender", dot: "bg-purple-300 border-purple-400" },
  { id: "rose", label: "Rose", dot: "bg-rose-300 border-rose-400" },
  { id: "neutral", label: "Monochrome", dot: "bg-neutral-300 border-neutral-400 dark:bg-neutral-700" },
];

export function CanvasPage({ canvasId = "default" }: { canvasId?: string }) {
  const nodes = useCanvas((s) => s.nodes);
  const connections = useCanvas((s) => s.connections);
  const viewport = useCanvas((s) => s.viewport);
  const selectedIds = useCanvas((s) => s.selectedIds);
  const activeTool = useCanvas((s) => s.activeTool);
  const activeColor = useCanvas((s) => s.activeColor);
  const connectingFromId = useCanvas((s) => s.connectingFromId);
  const currentCanvasId = useCanvas((s) => s.currentCanvasId);
  const canvasList = useCanvas((s) => s.canvasList);
  const renameCanvas = useCanvas((s) => s.renameCanvas);

  const loadCanvas = useCanvas((s) => s.load);
  const addNode = useCanvas((s) => s.addNode);
  const updateNode = useCanvas((s) => s.updateNode);
  const deleteNodes = useCanvas((s) => s.deleteNodes);
  const duplicateNodes = useCanvas((s) => s.duplicateNodes);
  const bringToFront = useCanvas((s) => s.bringToFront);
  const sendToBack = useCanvas((s) => s.sendToBack);
  const addConnection = useCanvas((s) => s.addConnection);
  const setViewport = useCanvas((s) => s.setViewport);
  const zoomIn = useCanvas((s) => s.zoomIn);
  const zoomOut = useCanvas((s) => s.zoomOut);
  const resetZoom = useCanvas((s) => s.resetZoom);
  const fitView = useCanvas((s) => s.fitView);
  const setSelectedIds = useCanvas((s) => s.setSelectedIds);
  const toggleSelectId = useCanvas((s) => s.toggleSelectId);
  const setActiveTool = useCanvas((s) => s.setActiveTool);
  const setActiveColor = useCanvas((s) => s.setActiveColor);
  const setConnectingFromId = useCanvas((s) => s.setConnectingFromId);
  const clearCanvas = useCanvas((s) => s.clearCanvas);
  const loadTemplate = useCanvas((s) => s.loadTemplate);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ w: 0, h: 0, x: 0, y: 0 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [imageUrlModal, setImageUrlModal] = useState(false);
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [templateMenu, setTemplateMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [vaultPickerOpen, setVaultPickerOpen] = useState(false);

  const currentMeta = canvasList.find((c) => c.id === currentCanvasId) || {
    id: canvasId,
    name: "Moodboard",
  };

  // Load target canvas when canvasId changes
  useEffect(() => {
    void loadCanvas(canvasId);
  }, [canvasId, loadCanvas]);

  // Spacebar pan toggle + Delete key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        editingNodeId ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === "Space" && !spacePressed) {
        setSpacePressed(true);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        deleteNodes(selectedIds);
      }
      if (e.key === "Escape") {
        setSelectedIds([]);
        setConnectingFromId(null);
        setActiveTool("select");
      }
      if (e.key === "v" || e.key === "V") setActiveTool("select");
      if (e.key === "h" || e.key === "H") setActiveTool("pan");
      if (e.key === "n" || e.key === "N") setActiveTool("sticky");
      if (e.key === "t" || e.key === "T") setActiveTool("text");
      if (e.key === "c" || e.key === "C") setActiveTool("card");
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    spacePressed,
    selectedIds,
    editingNodeId,
    deleteNodes,
    setSelectedIds,
    setConnectingFromId,
    setActiveTool,
  ]);

  // Wheel pan / zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        const newZoom = Math.min(
          2.5,
          Math.max(0.25, Number((viewport.zoom * zoomFactor).toFixed(2))),
        );
        setViewport({ zoom: newZoom });
      } else {
        setViewport({
          x: viewport.x - e.deltaX,
          y: viewport.y - e.deltaY,
        });
      }
    },
    [viewport, setViewport],
  );

  // Convert screen coordinates to canvas space
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (screenX - rect.left - viewport.x) / viewport.zoom;
      const y = (screenY - rect.top - viewport.y) / viewport.zoom;
      return { x, y };
    },
    [viewport],
  );

  // Handle pointer events for panning canvas
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target !== containerRef.current && (e.target as HTMLElement).id !== "canvas-bg") {
      return;
    }

    if (e.button === 1 || spacePressed || activeTool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Clicked background with tool active
    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    if (activeTool === "sticky") {
      addNode({
        type: "sticky",
        x: canvasPos.x - 100,
        y: canvasPos.y - 100,
        content: "New Note",
      });
      setActiveTool("select");
    } else if (activeTool === "card") {
      addNode({
        type: "card",
        x: canvasPos.x - 140,
        y: canvasPos.y - 90,
        title: "Card Title",
        content: "Add details or list items here...",
      });
      setActiveTool("select");
    } else if (activeTool === "text") {
      addNode({
        type: "text",
        x: canvasPos.x - 80,
        y: canvasPos.y - 20,
        content: "Heading Text",
      });
      setActiveTool("select");
    } else if (activeTool === "shape") {
      addNode({
        type: "shape",
        shapeType: "pill",
        x: canvasPos.x - 90,
        y: canvasPos.y - 30,
        width: 180,
        height: 60,
        content: "Idea Badge",
      });
      setActiveTool("select");
    } else {
      setSelectedIds([]);
      setConnectingFromId(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setViewport({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (draggingNodeId) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      updateNode(draggingNodeId, {
        x: Math.round(pos.x - dragOffset.x),
        y: Math.round(pos.y - dragOffset.y),
      });
      return;
    }

    if (resizingNodeId) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const newWidth = Math.max(120, Math.round(pos.x - resizeStart.x));
      const newHeight = Math.max(80, Math.round(pos.y - resizeStart.y));
      updateNode(resizingNodeId, {
        width: newWidth,
        height: newHeight,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // non-fatal
      }
    }
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
    if (resizingNodeId) {
      setResizingNodeId(null);
    }
  };

  // Drag node start
  const handleNodePointerDown = (
    e: React.PointerEvent,
    node: CanvasNode,
  ) => {
    e.stopPropagation();

    if (activeTool === "connector") {
      if (!connectingFromId) {
        setConnectingFromId(node.id);
        toast.info("Click another note to connect them");
      } else if (connectingFromId !== node.id) {
        addConnection(connectingFromId, node.id);
        toast.success("Notes connected");
      }
      return;
    }

    if (activeTool === "pan" || spacePressed) {
      return;
    }

    toggleSelectId(node.id, e.shiftKey || e.metaKey);

    const pos = screenToCanvas(e.clientX, e.clientY);
    setDraggingNodeId(node.id);
    setDragOffset({
      x: pos.x - node.x,
      y: pos.y - node.y,
    });
    bringToFront([node.id]);
  };

  // Start resize node
  const handleResizePointerDown = (
    e: React.PointerEvent,
    node: CanvasNode,
  ) => {
    e.stopPropagation();
    setResizingNodeId(node.id);
    setResizeStart({
      w: node.width,
      h: node.height,
      x: node.x,
      y: node.y,
    });
  };

  // Drop image files directly onto canvas
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result) {
            const canvasPos = screenToCanvas(e.clientX, e.clientY);
            addNode({
              type: "image",
              x: canvasPos.x - 160,
              y: canvasPos.y - 120,
              width: 320,
              height: 240,
              title: file.name,
              imageUrl: result,
            });
            toast.success("Image added to canvas");
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleAddImageUrl = () => {
    if (!inputImageUrl.trim()) return;
    addNode({
      type: "image",
      x: -viewport.x / viewport.zoom + 300,
      y: -viewport.y / viewport.zoom + 200,
      width: 320,
      height: 220,
      title: "Image Note",
      imageUrl: inputImageUrl.trim(),
    });
    setInputImageUrl("");
    setImageUrlModal(false);
    toast.success("Image card added");
  };

  const selectedNode = selectedIds.length === 1 ? nodes.find((n) => n.id === selectedIds[0]) : null;

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-bg font-sans">
      {/* Top Header Bar */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-panel/90 p-1.5 shadow-md backdrop-blur-md pointer-events-auto">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-hover text-ink">
            <Palette size={15} strokeWidth={2} />
          </span>
          <div className="pr-2">
            {isRenaming ? (
              <input
                type="text"
                autoFocus
                value={renameText}
                onChange={(e) => setRenameText(e.target.value)}
                onBlur={() => {
                  if (renameText.trim()) {
                    void renameCanvas(currentMeta.id, renameText.trim());
                  }
                  setIsRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (renameText.trim()) {
                      void renameCanvas(currentMeta.id, renameText.trim());
                    }
                    setIsRenaming(false);
                  } else if (e.key === "Escape") {
                    setIsRenaming(false);
                  }
                }}
                className="h-5 w-32 rounded bg-bg px-1.5 text-[12px] font-semibold text-ink outline-none border border-sky-500"
              />
            ) : (
              <h1
                onClick={() => {
                  setRenameText(currentMeta.name);
                  setIsRenaming(true);
                }}
                title="Clique para renomear este moodboard"
                className="text-[12.5px] font-semibold text-ink leading-tight cursor-pointer hover:underline"
              >
                {currentMeta.name}
              </h1>
            )}
            <p className="text-[10px] text-faint">
              {nodes.length} itens • {connections.length} links
            </p>
          </div>

          <div className="h-4 w-px bg-line-soft mx-1" />

          {/* Preset templates */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTemplateMenu(!templateMenu)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line-soft bg-hover px-2.5 text-[11.5px] font-medium text-ink transition-colors hover:bg-active"
            >
              <Sparkles size={13} className="text-amber-500" />
              Templates
              <ChevronDown size={12} className="text-faint" />
            </button>

            {templateMenu && (
              <div className="absolute top-9 left-0 w-48 rounded-xl border border-line bg-panel p-1 shadow-xl z-50">
                <button
                  type="button"
                  onClick={() => {
                    loadTemplate("moodboard");
                    setTemplateMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-hover"
                >
                  <Grid size={14} className="text-sky-500" />
                  Default Moodboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    loadTemplate("brainstorm");
                    setTemplateMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-hover"
                >
                  <Sparkles size={14} className="text-purple-500" />
                  Brainstorming Map
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <Tooltip label="Fit all elements on screen">
            <button
              type="button"
              onClick={fitView}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-panel/90 px-3 text-[11.5px] font-medium text-ink shadow-md backdrop-blur-md hover:bg-hover"
            >
              <Maximize2 size={13} />
              Fit View
            </button>
          </Tooltip>

          <Tooltip label="Clear canvas">
            <button
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to clear the canvas?")) {
                  clearCanvas();
                }
              }}
              className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-panel/90 text-faint shadow-md backdrop-blur-md hover:bg-hover hover:text-ink"
            >
              <Trash2 size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div
        ref={containerRef}
        id="canvas-bg"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={cx(
          "h-full w-full touch-none relative transition-cursor duration-75",
          spacePressed || activeTool === "pan" || isPanning
            ? "cursor-grab active:cursor-grabbing"
            : activeTool === "sticky" || activeTool === "card" || activeTool === "text" || activeTool === "shape"
            ? "cursor-crosshair"
            : "cursor-default",
        )}
      >
        {/* SVG Dot Grid Background */}
        <svg
          className="absolute inset-0 pointer-events-none h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="dot-grid"
              x={viewport.x % (24 * viewport.zoom)}
              y={viewport.y % (24 * viewport.zoom)}
              width={24 * viewport.zoom}
              height={24 * viewport.zoom}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={2 * viewport.zoom}
                cy={2 * viewport.zoom}
                r={1.2 * Math.max(0.6, viewport.zoom)}
                className="fill-neutral-300 dark:fill-neutral-700/60"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
        </svg>

        {/* Viewport Transform Container */}
        <div
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: "0 0",
          }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* SVG Connections Layer */}
          <svg
            className="absolute inset-0 overflow-visible pointer-events-none z-0"
            style={{ width: "100%", height: "100%" }}
          >
            {connections.map((conn) => {
              const from = nodes.find((n) => n.id === conn.fromId);
              const to = nodes.find((n) => n.id === conn.toId);
              if (!from || !to) return null;

              const x1 = from.x + from.width / 2;
              const y1 = from.y + from.height / 2;
              const x2 = to.x + to.width / 2;
              const y2 = to.y + to.height / 2;

              // Curved path bezier calculation
              const dx = x2 - x1;
              const cx1 = x1 + dx * 0.4;
              const cy1 = y1;
              const cx2 = x2 - dx * 0.4;
              const cy2 = y2;

              const pathData =
                conn.style === "curved"
                  ? `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
                  : `M ${x1} ${y1} L ${x2} ${y2}`;

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g key={conn.id} className="group pointer-events-auto">
                  <path
                    d={pathData}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeDasharray={conn.style === "dashed" ? "6,6" : undefined}
                    className="text-neutral-400 dark:text-neutral-600 transition-colors group-hover:text-sky-500"
                  />
                  {/* Arrowhead */}
                  <circle
                    cx={x2}
                    cy={y2}
                    r={4}
                    className="fill-neutral-400 dark:fill-neutral-600 group-hover:fill-sky-500"
                  />
                  {conn.label && (
                    <foreignObject
                      x={midX - 50}
                      y={midY - 12}
                      width={100}
                      height={24}
                    >
                      <div className="flex justify-center items-center">
                        <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-medium text-faint border border-line shadow-xs">
                          {conn.label}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Canvas Nodes Layer */}
          {nodes.map((node) => {
            const isSelected = selectedIds.includes(node.id);
            const isConnectingFrom = connectingFromId === node.id;
            const styleTheme = COLOR_CLASSES[node.color || "yellow"] || COLOR_CLASSES.yellow;

            return (
              <div
                key={node.id}
                style={{
                  transform: `translate(${node.x}px, ${node.y}px) rotate(${node.rotation || 0}deg)`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                  zIndex: node.zIndex,
                }}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                className={cx(
                  "absolute pointer-events-auto group rounded-xl transition-shadow duration-100 flex flex-col",
                  styleTheme.bg,
                  styleTheme.border,
                  "border shadow-sm hover:shadow-md",
                  isSelected && "ring-2 ring-sky-500 shadow-lg",
                  isConnectingFrom && "ring-2 ring-amber-500 animate-pulse",
                )}
              >
                {/* Node Top Drag/Control Header */}
                <div
                  className={cx(
                    "flex items-center justify-between px-2 py-1 border-b border-line-soft/40 cursor-grab active:cursor-grabbing rounded-t-xl",
                    styleTheme.header,
                  )}
                >
                  <span className="text-[10px] font-mono tracking-tight text-faint uppercase select-none flex items-center gap-1">
                    {node.type === "sticky" && <StickyNote size={11} />}
                    {node.type === "card" && <Square size={11} />}
                    {node.type === "image" && <ImageIcon size={11} />}
                    {node.type === "shape" && <Sparkles size={11} />}
                    {node.type === "text" && <Type size={11} />}
                    {node.type === "folder_link" && <Folder size={11} className="text-amber-500" />}
                    {node.type === "note_link" && <FileText size={11} className="text-sky-500" />}
                    {node.type === "folder_link" ? "Pasta" : node.type === "note_link" ? "Nota" : node.type}
                  </span>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="Connect arrow"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectingFromId(node.id);
                        setActiveTool("connector");
                        toast.info("Click target note to create arrow connection");
                      }}
                      className="p-0.5 rounded text-faint hover:text-ink hover:bg-hover"
                    >
                      <CornerDownRight size={11} />
                    </button>
                    <button
                      type="button"
                      title="Delete note"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNodes([node.id]);
                      }}
                      className="p-0.5 rounded text-faint hover:text-rose-600 hover:bg-hover"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>

                {/* Content Renderer */}
                <div className="flex-1 p-2.5 overflow-auto flex flex-col">
                  {(node.type === "folder_link" || node.type === "note_link") ? (
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex items-start gap-2 mb-1">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-panel border border-line shrink-0">
                          {node.type === "folder_link" ? (
                            <Folder size={18} className="text-amber-500" />
                          ) : (
                            <FileText size={18} className="text-sky-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-ink">{node.title || "Vínculo"}</p>
                          <p className="truncate text-[10px] text-faint">{node.linkRel || node.content}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (node.linkRel || node.content) {
                            const rel = node.linkRel || node.content;
                            if (node.type === "note_link") {
                              useVault.getState().setView({ type: "note", rel });
                            } else {
                              useVault.getState().expandTo(`${rel}/x`);
                              toast.info(`Pasta do projeto: ${rel}`);
                            }
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 py-1.5 text-[11px] font-semibold transition-colors mt-2"
                      >
                        <span>{node.type === "folder_link" ? "Abrir Pasta do Projeto" : "Abrir Nota"}</span>
                      </button>
                    </div>
                  ) : node.type === "card" ? (
                    <input
                      type="text"
                      value={node.title || ""}
                      placeholder="Card Title"
                      onChange={(e) => updateNode(node.id, { title: e.target.value })}
                      className="w-full bg-transparent text-[13px] font-semibold text-ink outline-none mb-1 border-b border-transparent focus:border-line-soft"
                    />
                  ) : null}

                  {node.type === "image" && node.imageUrl && (
                    <div className="relative mb-2 rounded-lg overflow-hidden bg-bg/50 border border-line-soft max-h-[140px] flex items-center justify-center">
                      <img
                        src={node.imageUrl}
                        alt={node.title || "Moodboard image"}
                        className="object-cover max-h-full w-full"
                      />
                    </div>
                  )}

                  {node.type === "shape" ? (
                    <div className="flex-1 flex items-center justify-center text-center">
                      <textarea
                        value={node.content}
                        placeholder="Type..."
                        onChange={(e) => updateNode(node.id, { content: e.target.value })}
                        className="w-full bg-transparent text-center text-[13px] font-semibold text-ink outline-none resize-none"
                      />
                    </div>
                  ) : node.type !== "folder_link" && node.type !== "note_link" ? (
                    <textarea
                      value={node.content}
                      placeholder="Type your notes or ideas..."
                      onChange={(e) => updateNode(node.id, { content: e.target.value })}
                      onFocus={() => setEditingNodeId(node.id)}
                      onBlur={() => setEditingNodeId(null)}
                      className={cx(
                        "w-full flex-1 bg-transparent text-[12.5px] leading-relaxed outline-none resize-none font-sans",
                        styleTheme.text,
                      )}
                    />
                  ) : null}
                </div>

                {/* Bottom Corner Resize Handle */}
                <div
                  onPointerDown={(e) => handleResizePointerDown(e, node)}
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 flex items-center justify-center text-faint"
                >
                  <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-faint rounded-br-xs" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Node Floating Action Toolbar */}
      {selectedNode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-xl border border-line bg-panel p-1.5 shadow-xl backdrop-blur-md">
          {/* Colors */}
          <div className="flex items-center gap-1 px-1 border-r border-line-soft pr-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                onClick={() => updateNode(selectedNode.id, { color: c.id })}
                className={cx(
                  "h-4.5 w-4.5 rounded-full border transition-transform hover:scale-110",
                  c.dot,
                  selectedNode.color === c.id && "ring-2 ring-sky-500 scale-110",
                )}
              />
            ))}
          </div>

          <Tooltip label="Connect to another node">
            <button
              type="button"
              onClick={() => {
                setConnectingFromId(selectedNode.id);
                setActiveTool("connector");
                toast.info("Click another note to connect");
              }}
              className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-ink hover:bg-hover"
            >
              <CornerDownRight size={13} />
              Connect
            </button>
          </Tooltip>

          <Tooltip label="Duplicate element">
            <button
              type="button"
              onClick={() => duplicateNodes([selectedNode.id])}
              className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-ink hover:bg-hover"
            >
              <CopyPlus size={13} />
              Duplicate
            </button>
          </Tooltip>

          <Tooltip label="Bring to Front">
            <button
              type="button"
              onClick={() => bringToFront([selectedNode.id])}
              className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-hover"
            >
              <BringToFront size={13} />
            </button>
          </Tooltip>

          <Tooltip label="Send to Back">
            <button
              type="button"
              onClick={() => sendToBack([selectedNode.id])}
              className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-hover"
            >
              <SendToBack size={13} />
            </button>
          </Tooltip>

          <div className="h-4 w-px bg-line-soft" />

          <Tooltip label="Delete element">
            <button
              type="button"
              onClick={() => deleteNodes([selectedNode.id])}
              className="p-1.5 rounded-lg text-faint hover:text-rose-600 hover:bg-hover"
            >
              <Trash2 size={13} />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Floating Bottom Center FigJam-style Toolbar */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-2xl border border-line bg-panel/95 p-1.5 shadow-2xl backdrop-blur-lg">
        <ToolButton
          icon={<MousePointer size={16} />}
          label="Select (V)"
          active={activeTool === "select"}
          onClick={() => setActiveTool("select")}
        />
        <ToolButton
          icon={<Hand size={16} />}
          label="Pan canvas (H / Space)"
          active={activeTool === "pan"}
          onClick={() => setActiveTool("pan")}
        />

        <div className="h-5 w-px bg-line-soft mx-0.5" />

        <ToolButton
          icon={<StickyNote size={16} className="text-amber-500" />}
          label="Sticky Note (N)"
          active={activeTool === "sticky"}
          onClick={() => setActiveTool("sticky")}
        />
        <ToolButton
          icon={<Square size={16} className="text-sky-500" />}
          label="Card Frame (C)"
          active={activeTool === "card"}
          onClick={() => setActiveTool("card")}
        />
        <ToolButton
          icon={<Type size={16} className="text-emerald-500" />}
          label="Text Heading (T)"
          active={activeTool === "text"}
          onClick={() => setActiveTool("text")}
        />
        <ToolButton
          icon={<ImageIcon size={16} className="text-purple-500" />}
          label="Add Image"
          active={activeTool === "image"}
          onClick={() => setImageUrlModal(true)}
        />
        <ToolButton
          icon={<CornerDownRight size={16} className="text-rose-500" />}
          label="Connector Arrow"
          active={activeTool === "connector"}
          onClick={() => setActiveTool("connector")}
        />
        <ToolButton
          icon={<FolderPlus size={16} className="text-amber-500" />}
          label="Vincular Projeto / Pasta / Nota"
          active={false}
          onClick={() => setVaultPickerOpen(true)}
        />

        <div className="h-5 w-px bg-line-soft mx-0.5" />

        {/* Color Palette Choice */}
        <div className="flex items-center gap-1 px-1">
          {COLOR_OPTIONS.slice(0, 4).map((c) => (
            <button
              key={c.id}
              type="button"
              title={`Default ${c.label}`}
              onClick={() => setActiveColor(c.id)}
              className={cx(
                "h-4 w-4 rounded-full border transition-transform",
                c.dot,
                activeColor === c.id && "ring-2 ring-sky-500 scale-110",
              )}
            />
          ))}
        </div>
      </div>

      {/* Bottom Right Zoom Control Dock */}
      <div className="absolute bottom-5 right-5 z-40 flex items-center gap-1 rounded-xl border border-line bg-panel/90 p-1 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={zoomOut}
          title="Zoom out"
          className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-hover hover:text-ink"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          onClick={resetZoom}
          title="Reset zoom to 100%"
          className="px-2 text-[11px] font-mono font-medium text-ink hover:bg-hover rounded-md py-1"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          title="Zoom in"
          className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-hover hover:text-ink"
        >
          <ZoomIn size={14} />
        </button>
      </div>

      {/* Add Image URL Modal */}
      {imageUrlModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-semibold text-ink flex items-center gap-2">
                <ImageIcon size={16} className="text-purple-500" />
                Add Image to Moodboard
              </h3>
              <button
                type="button"
                onClick={() => setImageUrlModal(false)}
                className="p-1 rounded-lg text-faint hover:text-ink hover:bg-hover"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[12px] text-faint mb-4">
              Enter a web image URL, or drag and drop any image file directly onto the canvas.
            </p>

            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={inputImageUrl}
              onChange={(e) => setInputImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddImageUrl()}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-[12.5px] text-ink outline-none mb-4 focus:border-sky-500"
            />

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setImageUrlModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddImageUrl}>
                Add Image
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Vault Link Picker Modal */}
      <VaultItemPickerModal
        open={vaultPickerOpen}
        onClose={() => setVaultPickerOpen(false)}
        onSelect={(item) => {
          addNode({
            type: item.kind === "folder" ? "folder_link" : "note_link",
            x: -viewport.x / viewport.zoom + 250,
            y: -viewport.y / viewport.zoom + 180,
            width: 280,
            height: 140,
            title: item.name,
            linkRel: item.rel,
            content: item.rel,
          });
          toast.success(`Vínculo com "${item.name}" adicionado ao Moodboard!`);
        }}
      />
    </div>
  );
}

function ToolButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        className={cx(
          "grid h-8 w-8 place-items-center rounded-xl transition-all duration-100",
          active
            ? "bg-ink text-bg shadow-sm scale-105"
            : "text-muted hover:bg-hover hover:text-ink",
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
