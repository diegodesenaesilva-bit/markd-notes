import { useState } from "react";
import { FileText, Folder, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useVault } from "@/stores/vault";
import type { TreeNode } from "@/lib/types";

interface VaultItemPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: { rel: string; name: string; kind: "folder" | "note" }) => void;
}

export function VaultItemPickerModal({
  open,
  onClose,
  onSelect,
}: VaultItemPickerModalProps) {
  const tree = useVault((s) => s.tree);
  const [search, setSearch] = useState("");

  const flattenNodes = (nodes: TreeNode[]): { rel: string; name: string; kind: "folder" | "note" }[] => {
    let result: { rel: string; name: string; kind: "folder" | "note" }[] = [];
    for (const node of nodes) {
      result.push({
        rel: node.rel,
        name: node.kind === "note" ? node.name.replace(/\.md$/i, "") : node.name,
        kind: node.kind,
      });
      if (node.children) {
        result = result.concat(flattenNodes(node.children));
      }
    }
    return result;
  };

  const allItems = flattenNodes(tree);
  const filtered = allItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.rel.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col max-h-[80vh] w-[460px] max-w-full rounded-2xl bg-panel border border-line p-5 shadow-2xl text-ink">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-base font-bold">Vincular Nota ou Pasta ao Moodboard</h2>
            <p className="text-[11px] text-faint">
              Selecione um projeto, pasta ou nota do seu cofre para conectar no canvas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-faint hover:text-ink hover:bg-hover"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="relative my-3">
          <Search size={14} className="absolute left-2.5 top-2.5 text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nota ou pasta..."
            className="h-8 w-full rounded-lg border border-line bg-bg pl-8 pr-2 text-xs text-ink outline-none focus:border-purple-500"
          />
        </div>

        {/* List */}
        <div className="no-scrollbar my-1 flex-1 overflow-y-auto space-y-1 max-h-[320px]">
          {filtered.map((item) => (
            <button
              key={item.rel}
              type="button"
              onClick={() => {
                onSelect(item);
                onClose();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-left hover:border-line hover:bg-hover transition-colors"
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-bg border border-line">
                {item.kind === "folder" ? (
                  <Folder size={15} className="text-amber-500" />
                ) : (
                  <FileText size={15} className="text-sky-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
                <p className="truncate text-[10px] text-faint">{item.rel}</p>
              </div>
              <span className="rounded bg-panel border border-line px-2 py-0.5 text-[10px] text-muted uppercase tracking-wider font-semibold">
                {item.kind === "folder" ? "Pasta" : "Nota"}
              </span>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="py-8 text-center text-xs text-faint">
              Nenhuma pasta ou nota encontrada.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
