import type { Editor } from "@tiptap/react";
import {
  Plus,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface TableToolbarProps {
  editor: Editor;
}

export function TableToolbar({ editor }: TableToolbarProps) {
  if (!editor.isActive("table")) return null;

  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-line bg-panel px-1.5 py-1 shadow-lg">
      {/* Columns */}
      <TBtn
        title="Inserir coluna à esquerda"
        onClick={() => editor.chain().focus().addColumnBefore().run()}
      >
        <ChevronLeft size={13} />
        <Plus size={11} />
      </TBtn>
      <TBtn
        title="Inserir coluna à direita"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        <Plus size={11} />
        <ChevronRight size={13} />
      </TBtn>
      <TBtn
        title="Deletar coluna"
        danger
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        <Trash2 size={12} />
        <span className="text-[10px] leading-none">col</span>
      </TBtn>

      <div className="mx-1 h-3.5 w-px bg-line" />

      {/* Rows */}
      <TBtn
        title="Inserir linha acima"
        onClick={() => editor.chain().focus().addRowBefore().run()}
      >
        <ChevronUp size={13} />
        <Plus size={11} />
      </TBtn>
      <TBtn
        title="Inserir linha abaixo"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        <Plus size={11} />
        <ChevronDown size={13} />
      </TBtn>
      <TBtn
        title="Deletar linha"
        danger
        onClick={() => editor.chain().focus().deleteRow().run()}
      >
        <Trash2 size={12} />
        <span className="text-[10px] leading-none">row</span>
      </TBtn>

      <div className="mx-1 h-3.5 w-px bg-line" />

      {/* Alignment */}
      <TBtn
        title="Alinhar à esquerda"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft size={13} />
      </TBtn>
      <TBtn
        title="Centralizar"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter size={13} />
      </TBtn>
      <TBtn
        title="Alinhar à direita"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight size={13} />
      </TBtn>

      <div className="mx-1 h-3.5 w-px bg-line" />

      {/* Delete table */}
      <TBtn
        title="Deletar tabela"
        danger
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Trash2 size={12} />
        <span className="text-[10px] leading-none">tabela</span>
      </TBtn>
    </div>
  );
}

function TBtn({
  children,
  onClick,
  title,
  active,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-6 min-w-[24px] items-center justify-center gap-0.5 rounded-md px-1 text-xs transition-colors ${
        danger
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-500"
          : active
          ? "bg-hover text-ink"
          : "text-muted hover:bg-hover hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
