import { useCallback, useEffect, useState } from "react";
import { MessageSquarePlus, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useCopilot } from "@/stores/copilot";
import { useUi } from "@/stores/ui";
import type { Editor } from "@tiptap/react";

interface CopilotCommentPopoverProps {
  editor: Editor | null;
  active?: boolean;
}

export function CopilotCommentPopover({ editor, active = true }: CopilotCommentPopoverProps) {
  const setCopilotMode = useCopilot((s) => s.setCopilotMode);
  const addInlineComment = useCopilot((s) => s.addInlineComment);
  const openRightPanel = useUi((s) => s.openRightPanel);

  const [selectionRange, setSelectionRange] = useState<{
    text: string;
    coords: { left: number; top: number; bottom: number };
  } | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [commentText, setCommentText] = useState("");

  const updateSelection = useCallback(() => {
    if (!editor || !active) {
      setSelectionRange(null);
      return;
    }

    const { selection, doc } = editor.state;
    if (!selection || selection.empty || selection.from === selection.to) {
      if (!isFormOpen) {
        setSelectionRange(null);
      }
      return;
    }

    try {
      const selectedText = doc.textBetween(selection.from, selection.to, " ", " ").trim();
      if (!selectedText || selectedText.length < 2) {
        if (!isFormOpen) setSelectionRange(null);
        return;
      }

      const coords = editor.view.coordsAtPos(selection.to);
      setSelectionRange({
        text: selectedText,
        coords: {
          left: Math.max(16, Math.min(coords.left, window.innerWidth - 260)),
          top: coords.top,
          bottom: coords.bottom,
        },
      });
    } catch {
      if (!isFormOpen) setSelectionRange(null);
    }
  }, [editor, active, isFormOpen]);

  useEffect(() => {
    if (!editor) return;

    const handleSelection = () => {
      updateSelection();
    };

    editor.on("selectionUpdate", handleSelection);
    return () => {
      editor.off("selectionUpdate", handleSelection);
    };
  }, [editor, updateSelection]);

  const handleSubmitComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || !selectionRange) return;

    addInlineComment(selectionRange.text, commentText.trim());
    toast.success("Comentário adicionado ao trecho da nota!");
    
    // Auto open Copilot panel
    openRightPanel("mark");
    setCopilotMode(true);

    setCommentText("");
    setIsFormOpen(false);
    setSelectionRange(null);
  };

  if (!selectionRange) return null;

  const topPos = selectionRange.coords.bottom + 8;
  const isTooBottom = topPos + 180 > window.innerHeight;
  const finalTop = isTooBottom ? Math.max(8, selectionRange.coords.top - 180) : topPos;

  return (
    <div
      style={{
        position: "fixed",
        left: `${selectionRange.coords.left}px`,
        top: `${finalTop}px`,
      }}
      className="z-50 select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {!isFormOpen ? (
        <div className="flex items-center gap-1 rounded-xl border border-purple-500/40 bg-panel/95 p-1 text-ink shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition-colors active:scale-95"
          >
            <MessageSquarePlus size={13} />
            <span>Comentar com o Copiloto</span>
          </button>
        </div>
      ) : (
        <div className="w-72 rounded-2xl border border-purple-500/30 bg-panel p-3 shadow-xl backdrop-blur-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
              <Sparkles size={13} />
              <span>Instrução no Trecho</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setCommentText("");
              }}
              className="text-faint hover:text-ink p-0.5 rounded-md hover:bg-hover"
            >
              <X size={13} />
            </button>
          </div>

          <div className="text-[11px] font-mono text-faint line-clamp-2 italic bg-sunken/60 p-1.5 rounded-lg border border-line-soft">
            "{selectionRange.text}"
          </div>

          <form onSubmit={handleSubmitComment} className="space-y-2">
            <textarea
              autoFocus
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
              placeholder="O que deve ser reescrito ou alterado aqui? (ex: Reescreva com tom mais profissional)"
              className="w-full resize-none rounded-xl border border-line bg-bg px-2.5 py-1.5 text-xs text-ink placeholder:text-faint focus:border-purple-500 focus:outline-none"
            />

            <div className="flex items-center justify-between pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setCommentText("Reescreva tornando este trecho mais claro e fluido.");
                }}
                className="text-[10px] text-purple-600 dark:text-purple-400 font-medium hover:underline"
              >
                + Reescrever
              </button>

              <button
                type="submit"
                disabled={!commentText.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1 text-xs font-semibold text-white shadow-xs disabled:opacity-40 hover:bg-purple-700 transition-colors"
              >
                <span>Adicionar</span>
                <Send size={11} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
