import { useRef, useState } from "react";
import { ArrowRight, Bookmark, CheckSquare, ChevronLeft, ChevronRight, Edit2, FileText, Palette, X, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "@/components/ui/Tooltip";
import { ContextMenu, type MenuPosition } from "@/components/ui/ContextMenu";
import { SPRING_LAYOUT } from "@/lib/ease";
import type { View } from "@/lib/types";
import { cx, noteTitle } from "@/lib/utils";
import { useCanvas } from "@/stores/canvas";
import { nextAfterClose, useTabs } from "@/stores/tabs";
import { useVault } from "@/stores/vault";
import { toast } from "sonner";

function getActiveTabId(view: View | null): string | null {
  if (!view) return null;
  if (view.type === "note") return view.rel;
  if (view.type === "todos") return "__todos__";
  if (view.type === "bookmarks") return "__bookmarks__";
  if (view.type === "canvas") return `__canvas:${view.id || "default"}__`;
  return null;
}

function activateTab(tabId: string) {
  const setView = useVault.getState().setView;
  if (tabId === "__todos__") {
    setView({ type: "todos" });
  } else if (tabId === "__bookmarks__") {
    setView({ type: "bookmarks" });
  } else if (tabId.startsWith("__canvas:")) {
    const canvasId = tabId.slice(9, tabId.endsWith("__") ? -2 : undefined);
    setView({ type: "canvas", id: canvasId });
  } else {
    setView({ type: "note", rel: tabId });
  }
}

/** Close `tabId`; if it was active, activate its neighbor. */
export function closeTab(tabId: string) {
  const { tabs, close } = useTabs.getState();
  const vault = useVault.getState();
  const currentActive = getActiveTabId(vault.view);
  const wasActive = currentActive === tabId;
  const next = wasActive ? nextAfterClose(tabs, tabId) : null;
  close(tabId);
  if (wasActive) {
    if (next) {
      activateTab(next);
    } else {
      vault.setView(null);
    }
  }
}

/**
 * Code-editor style tab strip for open notes and views. Active tab is derived from
 * `vault.view`; the strip owns which tabs exist and their order.
 */
export function TabBar() {
  const tabs = useTabs((s) => s.tabs);
  const view = useVault((s) => s.view);
  const active = getActiveTabId(view);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (tabs.length === 0) return null;

  const scrollTabs = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -180 : 180;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="relative flex min-w-0 flex-1 items-stretch overflow-hidden group/tabbar">
      <button
        type="button"
        onClick={() => scrollTabs("left")}
        title="Rolar abas para esquerda"
        className="z-10 hidden items-center justify-center bg-sunken/80 px-1 text-muted hover:bg-hover hover:text-ink group-hover/tabbar:flex"
      >
        <ChevronLeft size={13} />
      </button>

      <motion.div
        ref={scrollRef}
        layoutRoot
        role="tablist"
        className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] scroll-smooth"
      >
        {tabs.map((tabId, index) => (
          <Tab
            key={tabId}
            tabId={tabId}
            active={tabId === active}
            focusable={tabId === active || (!active && index === 0)}
          />
        ))}
      </motion.div>

      <button
        type="button"
        onClick={() => scrollTabs("right")}
        title="Rolar abas para direita"
        className="z-10 hidden items-center justify-center bg-sunken/80 px-1 text-muted hover:bg-hover hover:text-ink group-hover/tabbar:flex"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

function TabContent({ tabId, isEditing, editingName, setEditingName, onCommitRename }: {
  tabId: string;
  isEditing?: boolean;
  editingName?: string;
  setEditingName?: (v: string) => void;
  onCommitRename?: () => void;
}) {
  const canvasList = useCanvas((s) => s.canvasList);

  if (tabId === "__todos__") {
    return (
      <>
        <CheckSquare size={13} strokeWidth={1.75} className="relative z-10 shrink-0 text-sky-500" />
        <span className="relative z-10 truncate font-medium">Tarefas</span>
      </>
    );
  }

  if (tabId === "__bookmarks__") {
    return (
      <>
        <Bookmark size={13} strokeWidth={1.75} className="relative z-10 shrink-0 text-amber-500" />
        <span className="relative z-10 truncate font-medium">Bookmarks</span>
      </>
    );
  }

  if (tabId.startsWith("__canvas:")) {
    const canvasId = tabId.slice(9, tabId.endsWith("__") ? -2 : undefined);
    const meta = canvasList.find((c) => c.id === canvasId);
    const label = meta ? meta.name : "Moodboard";

    if (isEditing) {
      return (
        <input
          type="text"
          autoFocus
          value={editingName}
          onChange={(e) => setEditingName?.(e.target.value)}
          onBlur={onCommitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename?.();
          }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-20 w-24 rounded bg-bg px-1 py-0.5 text-xs text-ink outline-none border border-primary"
        />
      );
    }

    return (
      <>
        <Palette size={13} strokeWidth={1.75} className="relative z-10 shrink-0 text-purple-500" />
        <span className="relative z-10 truncate font-medium" title="Duplo clique para renomear">{label}</span>
      </>
    );
  }

  if (isEditing) {
    return (
      <input
        type="text"
        autoFocus
        value={editingName}
        onChange={(e) => setEditingName?.(e.target.value)}
        onBlur={onCommitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommitRename?.();
        }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-20 w-24 rounded bg-bg px-1 py-0.5 text-xs text-ink outline-none border border-primary"
      />
    );
  }

  return (
    <>
      <FileText size={13} strokeWidth={1.75} className="relative z-10 shrink-0 text-muted" />
      <span className="relative z-10 truncate font-medium" title="Duplo clique para renomear">{noteTitle(tabId)}</span>
    </>
  );
}

function Tab({
  tabId,
  active,
  focusable,
}: {
  tabId: string;
  active: boolean;
  focusable: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const renameCanvas = useCanvas((s) => s.renameCanvas);
  const renameEntry = useVault((s) => s.renameEntry);

  const startRename = () => {
    if (tabId === "__todos__" || tabId === "__bookmarks__") return;
    if (tabId.startsWith("__canvas:")) {
      const canvasId = tabId.slice(9, tabId.endsWith("__") ? -2 : undefined);
      const meta = useCanvas.getState().canvasList.find((c) => c.id === canvasId);
      setEditingName(meta?.name || "Moodboard");
      setIsEditing(true);
    } else {
      setEditingName(noteTitle(tabId));
      setIsEditing(true);
    }
  };

  const commitRename = () => {
    if (!isEditing) return;
    const trimmed = editingName.trim();
    if (trimmed) {
      if (tabId.startsWith("__canvas:")) {
        const canvasId = tabId.slice(9, tabId.endsWith("__") ? -2 : undefined);
        void renameCanvas(canvasId, trimmed);
        toast.success(`Moodboard renomeado para "${trimmed}"`);
      } else {
        void renameEntry(tabId, trimmed);
        toast.success(`Nota renomeada para "${trimmed}"`);
      }
    }
    setIsEditing(false);
  };

  const isRenamable = tabId !== "__todos__" && tabId !== "__bookmarks__";

  const closeOthers = () => {
    const allTabs = useTabs.getState().tabs;
    allTabs.forEach((t) => {
      if (t !== tabId) closeTab(t);
    });
  };

  const closeToRight = () => {
    const allTabs = useTabs.getState().tabs;
    const idx = allTabs.indexOf(tabId);
    if (idx !== -1) {
      const rightTabs = allTabs.slice(idx + 1);
      rightTabs.forEach((t) => closeTab(t));
    }
  };

  return (
    <>
      <div
        role="tab"
        aria-selected={active}
        tabIndex={focusable ? 0 : -1}
        title={tabId}
        className={cx(
          "group/tab relative flex h-full min-w-0 max-w-[180px] shrink-0 cursor-pointer select-none items-center gap-1.5 pl-3 pr-1.5 text-[12.5px] transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink",
          active ? "text-ink" : "text-muted hover:text-ink",
        )}
        onClick={() => {
          if (!active) activateTab(tabId);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          startRename();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuPosition({ x: e.clientX, y: e.clientY });
        }}
        onAuxClick={(event) => {
          if (event.button === 1) closeTab(tabId);
        }}
        onKeyDown={(event) => {
          const tabs = Array.from(
            event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
              '[role="tab"]',
            ) ?? [],
          );
          const index = tabs.indexOf(event.currentTarget);
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
          else if (event.key === "ArrowLeft") {
            next = (index - 1 + tabs.length) % tabs.length;
          } else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = tabs.length - 1;
          else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activateTab(tabId);
            return;
          } else return;
          event.preventDefault();
          tabs[next]?.focus();
          tabs[next]?.click();
        }}
      >
        {active ? (
          <motion.div
            layoutId="tab-active-fill"
            transition={SPRING_LAYOUT}
            className="absolute inset-0 bg-bg"
          />
        ) : (
          <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-100 group-hover/tab:bg-hover/60 group-hover/tab:opacity-100" />
        )}
        <TabContent
          tabId={tabId}
          isEditing={isEditing}
          editingName={editingName}
          setEditingName={setEditingName}
          onCommitRename={commitRename}
        />
        <Tooltip label="Fechar aba ⌘W" side="bottom">
          <button
            type="button"
            aria-label="Fechar aba"
            className={cx(
              "relative z-10 grid h-5 w-5 shrink-0 place-items-center rounded transition-opacity duration-75 hover:bg-hover",
              active
                ? "opacity-60 hover:opacity-100"
                : "opacity-0 group-hover/tab:opacity-60 group-hover/tab:hover:opacity-100",
            )}
            onClick={(event) => {
              event.stopPropagation();
              closeTab(tabId);
            }}
          >
            <X size={11} strokeWidth={2} />
          </button>
        </Tooltip>
      </div>

      {menuPosition && (
        <ContextMenu
          position={menuPosition}
          items={[
            ...(isRenamable
              ? [
                  {
                    label: "Renomear",
                    icon: Edit2,
                    onSelect: startRename,
                  },
                ]
              : []),
            {
              label: "Fechar aba",
              icon: X,
              onSelect: () => closeTab(tabId),
            },
            {
              label: "Fechar outras abas",
              icon: XCircle,
              onSelect: closeOthers,
            },
            {
              label: "Fechar abas à direita",
              icon: ArrowRight,
              onSelect: closeToRight,
            },
          ]}
          onClose={() => setMenuPosition(null)}
        />
      )}
    </>
  );
}
