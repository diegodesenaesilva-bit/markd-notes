import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  Book,
  Bookmark,
  BookPlus,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  FilePlus,
  Palette,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { FileTree } from "@/components/tree/FileTree";
import { PinnedNotes } from "@/components/tree/PinnedNotes";
import { Tooltip } from "@/components/ui/Tooltip";
import { Spinner } from "@/components/ui/Spinner";
import { ContextMenu, type MenuPosition } from "@/components/ui/ContextMenu";
import { cx } from "@/lib/utils";
import { useCanvas } from "@/stores/canvas";
import { useTabs } from "@/stores/tabs";
import { useUi } from "@/stores/ui";
import { useUpdater } from "@/stores/updater";
import { activeDir, useVault } from "@/stores/vault";
import { TrashModal } from "@/components/trash/TrashModal";
import { toast } from "sonner";

type NavKey = "calendar" | "todos" | "bookmarks" | "canvas";

interface NavItemConfig {
  key: NavKey;
  label: string;
  icon: React.ReactNode;
  shortcutKey: "openCalendar" | "openTodos" | "openBookmarks" | "openCanvas";
  viewType: "calendar" | "todos" | "bookmarks" | "canvas";
}

const ALL_NAV_ITEMS: Record<NavKey, NavItemConfig> = {
  calendar: {
    key: "calendar",
    label: "Calendário",
    icon: <CalendarDays size={16} strokeWidth={1.5} />,
    shortcutKey: "openCalendar",
    viewType: "calendar",
  },
  todos: {
    key: "todos",
    label: "Tarefas",
    icon: <CheckCircle2 size={16} strokeWidth={1.5} />,
    shortcutKey: "openTodos",
    viewType: "todos",
  },
  bookmarks: {
    key: "bookmarks",
    label: "Bookmarks",
    icon: <Bookmark size={16} strokeWidth={1.5} />,
    shortcutKey: "openBookmarks",
    viewType: "bookmarks",
  },
  canvas: {
    key: "canvas",
    label: "Moodboard",
    icon: <Palette size={16} strokeWidth={1.5} />,
    shortcutKey: "openCanvas",
    viewType: "canvas",
  },
};

const DEFAULT_ORDER: NavKey[] = ["calendar", "todos", "bookmarks", "canvas"];

function getStoredNavOrder(): NavKey[] {
  try {
    const raw = localStorage.getItem("markd_nav_order");
    if (raw) {
      const parsed = JSON.parse(raw) as NavKey[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validKeys = parsed.filter((k) => k in ALL_NAV_ITEMS);
        const missing = DEFAULT_ORDER.filter((k) => !validKeys.includes(k));
        return [...validKeys, ...missing];
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_ORDER;
}

export function Sidebar() {
  const view = useVault((s) => s.view);
  const setView = useVault((s) => s.setView);
  const createNote = useVault((s) => s.createNote);
  const createFolder = useVault((s) => s.createFolder);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);

  const canvasList = useCanvas((s) => s.canvasList);
  const loadCanvasList = useCanvas((s) => s.loadList);
  const createCanvas = useCanvas((s) => s.createCanvas);
  const renameCanvas = useCanvas((s) => s.renameCanvas);
  const deleteCanvas = useCanvas((s) => s.deleteCanvas);
  const reorderCanvas = useCanvas((s) => s.reorderCanvas);

  const [navOrder, setNavOrder] = useState<NavKey[]>(getStoredNavOrder);
  const [draggedKey, setDraggedKey] = useState<NavKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<NavKey | null>(null);
  const [draggedCanvasId, setDraggedCanvasId] = useState<string | null>(null);
  const [dragOverCanvasId, setDragOverCanvasId] = useState<string | null>(null);
  const [canvasExpanded, setCanvasExpanded] = useState(true);
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [editingCanvasName, setEditingCanvasName] = useState("");
  const [canvasMenu, setCanvasMenu] = useState<{
    position: MenuPosition;
    meta: { id: string; name: string };
  } | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);

  useEffect(() => {
    void loadCanvasList();
  }, [loadCanvasList]);

  const handleDrop = (targetKey: NavKey) => {
    if (!draggedKey || draggedKey === targetKey) return;
    const fromIndex = navOrder.indexOf(draggedKey);
    const toIndex = navOrder.indexOf(targetKey);
    if (fromIndex === -1 || toIndex === -1) return;

    const newOrder = [...navOrder];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    setNavOrder(newOrder);
    localStorage.setItem("markd_nav_order", JSON.stringify(newOrder));
    setDraggedKey(null);
    setDragOverKey(null);
  };

  const handleCanvasDrop = (targetId: string) => {
    if (!draggedCanvasId || draggedCanvasId === targetId) return;
    const fromIndex = canvasList.findIndex((c) => c.id === draggedCanvasId);
    const toIndex = canvasList.findIndex((c) => c.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    void reorderCanvas(fromIndex, toIndex);
    setDraggedCanvasId(null);
    setDragOverCanvasId(null);
  };

  const openNavTab = (key: NavKey, canvasId?: string) => {
    const openTab = useTabs.getState().open;
    if (key === "calendar") {
      openTab("__calendar__");
      setView({ type: "calendar" });
    } else if (key === "todos") {
      openTab("__todos__");
      setView({ type: "todos" });
    } else if (key === "bookmarks") {
      openTab("__bookmarks__");
      setView({ type: "bookmarks" });
    } else if (key === "canvas") {
      const targetId = canvasId || (canvasList[0]?.id ?? "default");
      openTab(`__canvas:${targetId}__`);
      setView({ type: "canvas", id: targetId });
    }
  };

  return (
    <aside
      data-markd-sidebar
      className="flex h-full w-[240px] shrink-0 flex-col border-r border-line-soft bg-panel"
    >
      {/* drag region + traffic-light clearance */}
      <div data-tauri-drag-region className="flex h-10 items-end px-3 pb-1" />

      <div className="px-2 pb-2">
        <button
          data-sidebar-focus-fallback
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex w-full items-center gap-2 rounded-md border border-line-soft bg-bg px-2.5 py-1.5 text-[12.5px] text-faint transition-colors duration-100 hover:border-line hover:text-muted"
        >
          <Search size={14} strokeWidth={2} className="shrink-0" />
          <span>Buscar…</span>
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 pb-1">
        {navOrder.map((key) => {
          const item = ALL_NAV_ITEMS[key];
          if (!item) return null;

          const isCanvasItem = key === "canvas";
          const active = isCanvasItem
            ? view?.type === "canvas"
            : view?.type === item.viewType;
          return (
            <div key={key} className="flex flex-col">
              <PageLink
                active={active}
                icon={item.icon}
                label={item.label}
                isDragging={draggedKey === key}
                isDragOver={dragOverKey === key}
                extraAction={
                  isCanvasItem ? (
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <button
                        type="button"
                        title="Criar novo Moodboard"
                        onClick={(e) => {
                          e.stopPropagation();
                          void (async () => {
                            const newId = await createCanvas(`Moodboard ${canvasList.length + 1}`);
                            openNavTab("canvas", newId);
                            toast.success("Novo Moodboard criado!");
                          })();
                        }}
                        className="p-0.5 rounded text-faint hover:text-ink hover:bg-hover transition-colors"
                      >
                        <Plus size={13} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        title={canvasExpanded ? "Ocultar moodboards" : "Expandir moodboards"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCanvasExpanded(!canvasExpanded);
                        }}
                        className="p-0.5 rounded text-faint hover:text-ink hover:bg-hover transition-colors"
                      >
                        {canvasExpanded ? (
                          <ChevronDown size={12} />
                        ) : (
                          <ChevronRight size={12} />
                        )}
                      </button>
                    </div>
                  ) : null
                }
                onClick={() => openNavTab(key)}
                onDragStart={() => setDraggedKey(key)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverKey(key);
                }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={() => handleDrop(key)}
              />

              {/* Multi-Moodboard Projects Sub-List */}
              {isCanvasItem && canvasExpanded && (
                <div className="pl-4 pr-1 my-0.5 flex flex-col gap-0.5">
                  {canvasList.map((meta) => {
                    const isMetaActive =
                      view?.type === "canvas" &&
                      (view.id === meta.id || (!view.id && meta.id === "default"));

                    const isEditing = editingCanvasId === meta.id;

                    const commitCanvasRename = () => {
                      if (editingCanvasName.trim() && editingCanvasName.trim() !== meta.name) {
                        void renameCanvas(meta.id, editingCanvasName.trim());
                        toast.success(`Moodboard renomeado para "${editingCanvasName.trim()}"`);
                      }
                      setEditingCanvasId(null);
                    };

                    return (
                      <div
                        key={meta.id}
                        draggable={!isEditing}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggedCanvasId(meta.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverCanvasId(meta.id);
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          setDragOverCanvasId(null);
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          handleCanvasDrop(meta.id);
                        }}
                        onClick={() => {
                          if (!isEditing) openNavTab("canvas", meta.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCanvasId(meta.id);
                          setEditingCanvasName(meta.name);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCanvasMenu({
                            position: { x: e.clientX, y: e.clientY },
                            meta,
                          });
                        }}
                        className={cx(
                          "group/canvas flex h-6.5 items-center justify-between rounded-md px-2 text-[12px] select-none transition-all",
                          !isEditing ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                          isMetaActive
                            ? "bg-active font-medium text-ink"
                            : "text-muted hover:bg-hover hover:text-ink",
                          draggedCanvasId === meta.id && "opacity-30 border border-dashed border-line",
                          dragOverCanvasId === meta.id && "ring-2 ring-primary/60 bg-hover scale-[1.01]",
                        )}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingCanvasName}
                            onChange={(e) => setEditingCanvasName(e.target.value)}
                            onBlur={commitCanvasRename}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitCanvasRename();
                              if (e.key === "Escape") setEditingCanvasId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-bg px-1.5 py-0.5 text-[12px] text-ink outline-none border border-primary rounded"
                          />
                        ) : (
                          <>
                            <Palette size={13.5} strokeWidth={1.5} className="mr-2 shrink-0 text-faint" />
                            <span className="truncate flex-1" title="Duplo clique para renomear">
                              {meta.name}
                            </span>
                            <div className="opacity-0 group-hover/canvas:opacity-100 flex items-center gap-1 transition-opacity">
                              <button
                                type="button"
                                title="Renomear"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCanvasId(meta.id);
                                  setEditingCanvasName(meta.name);
                                }}
                                className="p-0.5 text-faint hover:text-ink rounded"
                              >
                                <Edit2 size={11} />
                              </button>
                              {canvasList.length > 1 && (
                                <button
                                  type="button"
                                  title="Excluir este moodboard"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    void deleteCanvas(meta.id);
                                  }}
                                  className="p-0.5 text-faint hover:text-rose-500 rounded"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mx-2 my-2 border-t border-line-soft" />

      <PinnedNotes />

      <div className="px-2">
        <div className="flex h-8 items-center justify-between px-2.5 text-[12px] font-medium text-faint">
          <div className="flex items-center gap-3">
            <Book size={16} strokeWidth={1.5} className="shrink-0" />
            <span>Cadernos</span>
          </div>
          <div className="flex items-center gap-0.5">
            <IconAction
              label="Nova nota"
              onClick={() => createNote(activeDir(useVault.getState()))}
            >
              <FilePlus size={14.5} strokeWidth={1.75} />
            </IconAction>
            <IconAction
              label="Novo caderno"
              onClick={() => createFolder("", "Novo Caderno")}
            >
              <BookPlus size={14.5} strokeWidth={1.75} />
            </IconAction>
          </div>
        </div>
      </div>

      <FileTree />

      <UpdateRow />

      <div className="border-t border-line-soft px-2 py-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex h-[30px] flex-1 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-muted transition-colors duration-100 hover:bg-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
        >
          <Settings size={15} strokeWidth={1.75} />
          <span>Configurações</span>
        </button>

        <Tooltip label="Lixeira">
          <button
            type="button"
            onClick={() => setTrashOpen(true)}
            className="relative grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md text-muted transition-colors duration-100 hover:bg-hover hover:text-rose-500"
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        </Tooltip>
      </div>

      <TrashModal open={trashOpen} onClose={() => setTrashOpen(false)} />

      {canvasMenu && (
        <ContextMenu
          position={canvasMenu.position}
          items={[
            {
              label: "Renomear",
              icon: Edit2,
              onSelect: () => {
                setEditingCanvasId(canvasMenu.meta.id);
                setEditingCanvasName(canvasMenu.meta.name);
              },
            },
            {
              label: "Duplicar Moodboard",
              icon: Copy,
              onSelect: () => {
                const name = canvasMenu.meta.name;
                void (async () => {
                  const newId = await createCanvas(`${name} (Cópia)`);
                  openNavTab("canvas", newId);
                  toast.success(`Moodboard "${name}" duplicado`);
                })();
              },
            },
            ...(canvasList.length > 1
              ? [
                  {
                    label: "Mover para Lixeira",
                    icon: Trash2,
                    danger: true,
                    onSelect: () => {
                      void deleteCanvas(canvasMenu.meta.id);
                    },
                  },
                ]
              : []),
          ]}
          onClose={() => setCanvasMenu(null)}
        />
      )}
    </aside>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        className="grid h-6.5 w-6.5 place-items-center rounded-md text-faint transition-colors duration-100 hover:bg-hover hover:text-ink"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function UpdateRow() {
  const status = useUpdater((s) => s.status);
  const version = useUpdater((s) => s.version);
  const requestInstall = useUpdater((s) => s.requestInstall);

  if (
    status !== "available" &&
    status !== "downloading" &&
    status !== "ready"
  ) {
    return null;
  }
  const busy = status !== "available";

  return (
    <div className="border-t border-line-soft px-2 py-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => void requestInstall()}
        className="flex w-full items-center gap-2 rounded-md bg-hover px-2.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors duration-100 hover:bg-active disabled:cursor-default disabled:hover:bg-hover"
      >
        {busy ? (
          <Spinner size={14} className="text-faint" />
        ) : (
          <ArrowDownToLine size={14} strokeWidth={2} className="shrink-0" />
        )}
        <span className="truncate">
          {busy ? "Updating…" : `Update to ${version}`}
        </span>
        {!busy && (
          <span className="ml-auto shrink-0 text-[11px] text-faint">
            Restart
          </span>
        )}
      </button>
    </div>
  );
}

function PageLink({
  active,
  icon,
  label,
  isDragging,
  isDragOver,
  extraAction,
  onClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  isDragging: boolean;
  isDragOver: boolean;
  extraAction?: React.ReactNode;
  onClick: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={cx(
        "group relative flex h-[34px] w-full items-center justify-between rounded-lg px-2.5 text-[13.5px] cursor-grab active:cursor-grabbing transition-all duration-100 select-none",
        active
          ? "bg-hover font-medium text-ink"
          : "text-muted hover:bg-hover hover:text-ink",
        isDragging && "opacity-30 border border-dashed border-line",
        isDragOver && "ring-2 ring-primary/60 bg-hover scale-[1.01]",
      )}
    >
      <div className="flex flex-1 items-center gap-3 text-left outline-none min-w-0 pointer-events-none">
        <span className="shrink-0 text-muted group-hover:text-ink transition-colors">{icon}</span>
        <span className="truncate">{label}</span>
      </div>

      {extraAction && (
        <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          {extraAction}
        </div>
      )}
    </div>
  );
}


