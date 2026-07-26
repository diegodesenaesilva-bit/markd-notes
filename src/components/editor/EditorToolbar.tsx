import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Code2,
  List,
  ListOrdered,
  ListTodo,
  Palette,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Quote,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table,
  Link,
  Image,
  Paperclip,
  Columns2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useState } from "react";
import { BACKGROUND_COLORS, TEXT_COLORS } from "./textColors";
import { useUi, type NoteWidth } from "@/stores/ui";

interface EditorToolbarProps {
  editor: Editor;
  onOpenAskMark?: () => void;
  isAskMarkOpen?: boolean;
}

const WIDTH_ICONS: Record<NoteWidth, typeof Minimize2> = {
  focused: Minimize2,
  normal: Columns2,
  expanded: Maximize2,
};
const WIDTH_LABELS: Record<NoteWidth, string> = {
  focused: "Foco (estreito)",
  normal: "Normal",
  expanded: "Expandido (largo)",
};

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState<"text" | "background" | null>(null);
  const [showHeadings, setShowHeadings] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const noteWidth = useUi((s) => s.noteWidth);
  const cycleNoteWidth = useUi((s) => s.cycleNoteWidth);

  if (!editor) return null;

  const currentHeading = editor.isActive("heading", { level: 1 })
    ? "Título 1"
    : editor.isActive("heading", { level: 2 })
    ? "Título 2"
    : editor.isActive("heading", { level: 3 })
    ? "Título 3"
    : "Texto Normal";

  const WidthIcon = WIDTH_ICONS[noteWidth];

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b border-line bg-bg/95 px-2 py-1 backdrop-blur-md">

      {/* — Headings dropdown — */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowHeadings(!showHeadings); setShowInsertMenu(false); setShowColorPicker(null); }}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink hover:bg-hover"
        >
          <Type size={13} />
          <span className="hidden sm:inline">{currentHeading}</span>
        </button>
        {showHeadings && (
          <div
            className="absolute left-0 top-full z-30 mt-1 w-36 rounded-lg border border-line bg-bg p-1 shadow-lg"
            onMouseLeave={() => setShowHeadings(false)}
          >
            {(
              [
                { label: "Texto Normal", action: () => editor.chain().focus().setParagraph().run(), icon: <Type size={13} />, cls: "text-xs" },
                { label: "Título 1", action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), icon: <Heading1 size={13} />, cls: "text-sm font-bold" },
                { label: "Título 2", action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), icon: <Heading2 size={13} />, cls: "text-xs font-semibold" },
                { label: "Título 3", action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), icon: <Heading3 size={13} />, cls: "text-xs font-medium" },
              ] as const
            ).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => { item.action(); setShowHeadings(false); }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-ink hover:bg-hover ${item.cls}`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-0.5 h-4 w-px bg-line" />

      {/* — Formatting marks — */}
      <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)"><Bold size={13} /></Btn>
      <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)"><Italic size={13} /></Btn>
      <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado (Ctrl+U)"><Underline size={13} /></Btn>
      <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><Strikethrough size={13} /></Btn>
      <Btn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Destacar"><Highlighter size={13} /></Btn>
      <Btn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Código inline"><Code size={13} /></Btn>
      <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Bloco de código"><Code2 size={13} /></Btn>

      <div className="mx-0.5 h-4 w-px bg-line" />

      {/* — Alignment — */}
      <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Alinhar à esquerda"><AlignLeft size={13} /></Btn>
      <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Centralizar"><AlignCenter size={13} /></Btn>
      <Btn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Alinhar à direita"><AlignRight size={13} /></Btn>

      <div className="mx-0.5 h-4 w-px bg-line" />

      {/* — Lists — */}
      <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista de marcadores"><List size={13} /></Btn>
      <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered size={13} /></Btn>
      <Btn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist"><ListTodo size={13} /></Btn>
      <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação"><Quote size={13} /></Btn>

      <div className="mx-0.5 h-4 w-px bg-line" />

      {/* — Insert menu — */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowInsertMenu(!showInsertMenu); setShowHeadings(false); setShowColorPicker(null); }}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-hover hover:text-ink"
          title="Inserir"
        >
          <Plus size={13} />
          <span className="hidden sm:inline">Inserir</span>
        </button>
        {showInsertMenu && (
          <div
            className="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-line bg-bg p-1 shadow-lg"
            onMouseLeave={() => setShowInsertMenu(false)}
          >
            <InsertItem
              icon={<Table size={13} />}
              label="Tabela 3×3"
              onClick={() => {
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                setShowInsertMenu(false);
              }}
            />
            <InsertItem
              icon={<Image size={13} />}
              label="Imagem / Foto"
              onClick={() => {
                const url = prompt("Cole a URL da imagem:");
                if (url) editor.chain().focus().setImage({ src: url }).run();
                setShowInsertMenu(false);
              }}
            />
            <InsertItem
              icon={<Paperclip size={13} />}
              label="Anexo / Arquivo"
              onClick={() => {
                const url = prompt("Cole o link do anexo / arquivo:");
                const label = prompt("Nome do arquivo:") || "Anexo";
                if (url) editor.chain().focus().insertContent(`<a href="${url}" target="_blank" rel="noopener noreferrer">📎 ${label}</a>`).run();
                setShowInsertMenu(false);
              }}
            />
            <InsertItem
              icon={<Link size={13} />}
              label="Link"
              onClick={() => {
                const url = prompt("URL do link:");
                if (url) editor.chain().focus().setLink({ href: url }).run();
                setShowInsertMenu(false);
              }}
            />
            <InsertItem
              icon={<Minus size={13} />}
              label="Divisor horizontal"
              onClick={() => {
                editor.chain().focus().setHorizontalRule().run();
                setShowInsertMenu(false);
              }}
            />
          </div>
        )}
      </div>

      {/* — Colors — */}
      <div className="relative flex items-center gap-0.5">
        <Btn
          active={Boolean(editor.getAttributes("textStyle").color)}
          onClick={() => { setShowColorPicker(showColorPicker === "text" ? null : "text"); setShowInsertMenu(false); setShowHeadings(false); }}
          title="Cor do Texto"
        >
          <Palette size={13} />
        </Btn>

        {showColorPicker && (
          <div
            className="absolute left-0 top-full z-30 mt-1 flex flex-wrap gap-1 rounded-lg border border-line bg-bg p-2 shadow-lg"
            onMouseLeave={() => setShowColorPicker(null)}
          >
            {(showColorPicker === "text" ? TEXT_COLORS : BACKGROUND_COLORS).map((item) => (
              <button
                key={item.label}
                type="button"
                className="h-5 w-5 rounded-full border border-line shadow-xs transition-transform hover:scale-110"
                style={{ backgroundColor: item.value }}
                title={item.label}
                onClick={() => {
                  if (showColorPicker === "text") {
                    editor.chain().focus().setColor(item.value).run();
                  } else {
                    editor.chain().focus().setMark("textStyle", { backgroundColor: item.value }).run();
                  }
                  setShowColorPicker(null);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* — Note width toggle — */}
      <div className="mx-0.5 h-4 w-px bg-line" />
      <Btn onClick={cycleNoteWidth} title={`Largura: ${WIDTH_LABELS[noteWidth]}`}>
        <WidthIcon size={13} />
      </Btn>


    </div>
  );
}

function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-ink transition-colors ${
        active ? "bg-hover text-amber-500" : "text-muted hover:bg-hover hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function InsertItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink hover:bg-hover"
    >
      {icon} {label}
    </button>
  );
}

// Re-export for use in toolbar
function Plus({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
