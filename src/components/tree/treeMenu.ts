import {
  FilePlus,
  FolderOpen,
  FolderPlus,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import type { TreeNode } from "@/lib/types";
import type { MenuItem } from "@/components/ui/ContextMenu";
import { usePins } from "@/stores/pins";
import { useVault } from "@/stores/vault";
import { isMac } from "@/lib/utils";

type PinMode = "toggle" | "unpin" | "none";

export function entryMenuItems(
  node: TreeNode,
  options: {
    onRename: (rel: string) => void;
    pinMode?: PinMode;
  },
): MenuItem[] {
  const vault = useVault.getState();
  const pins = usePins.getState();
  const items: MenuItem[] = [];

  if (node.kind === "folder") {
    items.push(
      {
        label: "Nova nota",
        icon: FilePlus,
        onSelect: () => void vault.createNote(node.rel),
      },
      {
        label: "Nova pasta",
        icon: FolderPlus,
        onSelect: () => {
          void vault.createFolder(node.rel, "Nova pasta").then((rel) => {
            if (rel) options.onRename(rel);
          });
        },
      },
    );
  }

  if (options.pinMode === "unpin") {
    items.push({
      label: node.kind === "folder" ? "Desafixar pasta" : "Desafixar nota",
      icon: PinOff,
      onSelect: () => void pins.unpin(node.rel),
    });
  } else if (options.pinMode === "toggle") {
    const pinned = pins.pins.includes(node.rel);
    items.push({
      label: pinned
        ? node.kind === "folder"
          ? "Desafixar pasta"
          : "Desafixar nota"
        : node.kind === "folder"
          ? "Fixar pasta"
          : "Fixar nota",
      icon: pinned ? PinOff : Pin,
      onSelect: () => void pins.toggle(node.rel),
    });
  }

  items.push(
    {
      label: isMac() ? "Revelar no Finder" : "Revelar no Gerenciador de Arquivos",
      icon: FolderOpen,
      onSelect: () => {
        if (!vault.root) return;
        void revealItemInDir(`${vault.root}/${node.rel}`).catch((error) =>
          toast.error("Não foi possível revelar o item", {
            description: error instanceof Error ? error.message : String(error),
          }),
        );
      },
    },
    {
      label: "Renomear",
      icon: Pencil,
      onSelect: () => options.onRename(node.rel),
    },
    {
      label: "Mover para a Lixeira",
      icon: Trash2,
      danger: true,
      onSelect: () => void vault.deleteEntry(node.rel),
    },
  );

  return items;
}
