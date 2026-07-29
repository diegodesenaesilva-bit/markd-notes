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
  Loader2,
  CheckCircle2,
  AlertCircle,
  Baseline,
  ChevronDown,
  Check,
} from "lucide-react";
import { useState } from "react";
import { BACKGROUND_COLORS, TEXT_COLORS } from "./textColors";
import { useUi, type NoteWidth } from "@/stores/ui";
import { FONT_OPTIONS, FONT_SIZES, ensureGoogleFont } from "@/lib/fonts";
import { cx } from "@/lib/utils";

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
  const [showFonts, setShowFonts] = useState(false);

  const noteWidth = useUi((s) => s.noteWidth);
  const cycleNoteWidth = useUi((s) => s.cycleNoteWidth);
  const saveState = useUi((s) => s.saveState);
  const noteFont = useUi((s) => s.noteFont);
  const setNoteFont = useUi((s) => s.setNoteFont);
  const noteFontSize = useUi((s) => s.noteFontSize);
  const setNoteFontSize = useUi((s) => s.setNoteFontSize);

  if (!editor) return null;

  const currentHeading = editor.isActive("heading", { level: 1 })
    ? "Título 1"
    : editor.isActive("heading", { level: 2 })
    ? "Título 2"
    : editor.isActive("heading", { level: 3 })
    ? "Título 3"
    : "Texto Normal";

  const WidthIcon = WIDTH_ICONS[noteWidth];
  const activeFont = FONT_OPTIONS.find((f) => f.id === noteFont) || FONT_OPTIONS[0];

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-0.5 border-b border-line bg-bg/95 px-2 py-1 backdrop-blur-md">

      {/* — Headings dropdown — */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowHeadings(!showHeadings); setShowInsertMenu(false); setShowColorPicker(null); setShowFonts(false); }}
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

      {/* — Typography dropdown — */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowFonts(!showFonts);
            setShowHeadings(false);
            setShowInsertMenu(false);
            setShowColorPicker(null);
          }}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink hover:bg-hover transition-colors"
          title="Fonte e Tipografia do Editor"
        >
          <Baseline size={13} className="text-muted" />
          <span className="hidden md:inline max-w-[110px] truncate">{activeFont.name}</span>
          <ChevronDown size={11} className="text-faint" />
        </button>

        {showFonts && (
          <div
            className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-line bg-bg p-2 shadow-xl backdrop-blur-md"
            onMouseLeave={() => setShowFonts(false)}
          >
            <div className="px-2 py-1 text-[10px] font-semibold text-faint uppercase tracking-wider">
              Tipografia / Fonte
            </div>
            <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5 no-scrollbar">
              {FONT_OPTIONS.map((font) => {
                ensureGoogleFont(font.id);
                const isSelected = font.id === noteFont;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => {
                      setNoteFont(font.id);
                      setShowFonts(false);
                    }}
                    className={cx(
                      "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                      isSelected
                        ? "bg-hover font-semibold text-ink"
                        : "text-muted hover:bg-hover/70 hover:text-ink"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ fontFamily: font.fontFamily }}>
                        {font.name}
                      </span>
                      {isSelected && <Check size={12} className="text-ink" />}
                    </div>
                    <span className="text-[10px] text-faint font-normal line-clamp-1">
                      {font.description}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="my-1.5 h-px bg-line" />

            <div className="px-2 py-1 text-[10px] font-semibold text-faint uppercase tracking-wider">
              Tamanho do Texto
            </div>
            <div className="grid grid-cols-4 gap-1 px-1">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => setNoteFontSize(size.value)}
                  className={cx(
                    "rounded-md py-1 text-[11px] font-medium transition-colors text-center",
                    noteFontSize === size.value
                      ? "bg-invert text-invert-ink font-semibold"
                      : "bg-panel text-muted hover:text-ink hover:bg-hover"
                  )}
                >
                  {size.value}
                </button>
              ))}
            </div>
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
          onClick={() => { setShowInsertMenu(!showInsertMenu); setShowHeadings(false); setShowColorPicker(null); setShowFonts(false); }}
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
          onClick={() => { setShowColorPicker(showColorPicker === "text" ? null : "text"); setShowInsertMenu(false); setShowHeadings(false); setShowFonts(false); }}
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

      {/* — Save Status Badge — */}
      <div className="mx-0.5 h-4 w-px bg-line" />
      <div
        className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all duration-200 select-none"
        title={
          saveState === "saving"
            ? "Salvando alterações no disco..."
            : saveState === "error"
            ? "Erro ao salvar nota"
            : "Todas as alterações foram salvas"
        }
      >
        {saveState === "saving" ? (
          <>
            <Loader2 size={12} className="animate-spin text-amber-500 dark:text-amber-400" />
            <span className="text-amber-600 dark:text-amber-400 font-medium">Salvando...</span>
          </>
        ) : saveState === "error" ? (
          <>
            <AlertCircle size={12} className="text-danger" />
            <span className="text-danger font-medium">Erro ao salvar</span>
          </>
        ) : (
          <>
            <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-faint hover:text-muted transition-colors">Salvo</span>
          </>
        )}
      </div>

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
