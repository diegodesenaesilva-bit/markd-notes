import { useState } from "react";
import {
  Bookmark,
  CheckSquare,
  FileText,
  Folder,
  Palette,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useTrash, type TrashedItem } from "@/stores/trash";
import { toast } from "sonner";

interface TrashModalProps {
  open: boolean;
  onClose: () => void;
}

export function TrashModal({ open, onClose }: TrashModalProps) {
  const items = useTrash((s) => s.items);
  const restoreItem = useTrash((s) => s.restoreItem);
  const restoreAll = useTrash((s) => s.restoreAll);
  const deletePermanently = useTrash((s) => s.deletePermanently);
  const emptyTrash = useTrash((s) => s.emptyTrash);

  const [search, setSearch] = useState("");

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const getItemIcon = (type: TrashedItem["type"]) => {
    switch (type) {
      case "note":
        return <FileText size={15} className="text-sky-500" />;
      case "folder":
        return <Folder size={15} className="text-amber-500" />;
      case "canvas":
        return <Palette size={15} className="text-purple-500" />;
      case "todo":
        return <CheckSquare size={15} className="text-emerald-500" />;
      case "bookmark":
        return <Bookmark size={15} className="text-amber-400" />;
      default:
        return <FileText size={15} className="text-faint" />;
    }
  };

  const getItemTypeLabel = (type: TrashedItem["type"]) => {
    switch (type) {
      case "note":
        return "Nota";
      case "folder":
        return "Pasta";
      case "canvas":
        return "Moodboard";
      case "todo":
        return "Tarefa";
      case "bookmark":
        return "Bookmark";
      default:
        return "Item";
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col max-h-[85vh] w-[540px] max-w-full rounded-2xl bg-panel border border-line p-5 shadow-2xl text-ink">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3.5">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-500">
              <Trash2 size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Lixeira</h2>
              <p className="text-[11px] text-faint">
                {items.length} {items.length === 1 ? "item excluído" : "itens excluídos"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-faint hover:text-ink hover:bg-hover"
          >
            <X size={16} />
          </button>
        </div>

        {/* Global Action Bar */}
        {items.length > 0 && (
          <div className="flex items-center justify-between gap-2 py-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-2.5 text-faint" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar na lixeira..."
                className="h-8 w-full rounded-lg border border-line bg-bg pl-8 pr-2 text-xs text-ink outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={() => void restoreAll()}
                className="bg-hover text-ink hover:bg-sunken text-xs font-semibold gap-1"
              >
                <RotateCcw size={13} />
                <span>Restaurar Tudo</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  emptyTrash();
                  toast.success("Lixeira esvaziada!");
                }}
                className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-xs font-semibold gap-1"
              >
                <Trash2 size={13} />
                <span>Esvaziar Lixeira</span>
              </Button>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="no-scrollbar my-2 flex-1 overflow-y-auto space-y-1.5 min-h-[220px] max-h-[380px]">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line/60 bg-bg px-3 py-2.5 transition-colors hover:border-line"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-panel border border-line">
                  {getItemIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-ink">
                      {item.name}
                    </span>
                    <span className="rounded bg-hover px-1.5 py-0.2 text-[10px] font-medium text-muted shrink-0">
                      {getItemTypeLabel(item.type)}
                    </span>
                  </div>
                  <p className="text-[10px] text-faint truncate">
                    Excluído em {new Date(item.deletedAt).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {/* Individual Item Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Restaurar este item"
                  onClick={() => void restoreItem(item.id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-sky-500 hover:bg-sky-500/10"
                >
                  <RotateCcw size={13} />
                  <span>Restaurar</span>
                </button>

                <button
                  type="button"
                  title="Excluir permanentemente"
                  onClick={() => {
                    deletePermanently(item.id);
                    toast.success(`"${item.name}" excluído permanentemente`);
                  }}
                  className="p-1 rounded-lg text-faint hover:text-rose-500 hover:bg-rose-500/10"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-faint">
              <Trash2 size={36} className="mb-2 opacity-20" />
              <p className="text-xs font-medium">A lixeira está vazia</p>
              <p className="text-[11px] text-faint">Itens excluídos aparecerão aqui para restauração.</p>
            </div>
          )}

          {items.length > 0 && filtered.length === 0 && (
            <div className="py-8 text-center text-xs text-faint">
              Nenhum item corresponde à busca.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
