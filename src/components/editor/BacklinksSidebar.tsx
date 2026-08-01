import { Link2, PanelRightClose, PenTool } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "@/components/ui/Tooltip";
import { GeminiIcon } from "@/components/ui/GeminiIcon";
import { SPRING_PANEL } from "@/lib/ease";
import { cx } from "@/lib/utils";
import { LinkedMentions } from "./LinkedMentions";
import { AskMarkSidebar } from "./AskMarkSidebar";
import { WritingAssistantSidebar } from "./WritingAssistantSidebar";
import { useUi } from "@/stores/ui";
import { useCopilot } from "@/stores/copilot";

const WIDTH = 380;

export function BacklinksToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip label="Linked Mentions (Menções Relacionadas)" side="bottom">
      <button
        type="button"
        aria-pressed={open}
        onClick={onToggle}
        className={cx(
          "grid h-7 w-7 place-items-center rounded-full border transition-[color,background-color,border-color,transform] duration-100 active:scale-[0.96]",
          open
            ? "border-line-soft bg-invert text-invert-ink"
            : "border-line-soft bg-hover text-muted hover:bg-active hover:text-ink",
        )}
      >
        <Link2 size={15} strokeWidth={1.85} />
      </button>
    </Tooltip>
  );
}

export function BacklinksSidebar({
  rel,
}: {
  rel: string | null;
  open?: boolean;
  onClose?: () => void;
}) {
  const {
    rightPanelOpen,
    rightPanelTab,
    setRightPanelTab,
    closeRightPanel,
  } = useUi();

  const setCopilotMode = useCopilot((s) => s.setCopilotMode);
  const inlineComments = useCopilot((s) => s.inlineComments);

  const visible = rightPanelOpen;

  return (
    <motion.div
      animate={{ width: visible ? WIDTH : 0 }}
      initial={false}
      transition={SPRING_PANEL}
      className="h-full shrink-0 overflow-hidden border-l border-line bg-panel z-20"
    >
      <div style={{ width: WIDTH }} className="flex h-full flex-col">
        {/* Unified Header with Centered Tabs and PanelRightClose on Left */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 bg-sunken/40">
          {/* Left: Collapse button */}
          <Tooltip label="Recolher painel" side="bottom">
            <button
              type="button"
              onClick={closeRightPanel}
              className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink transition-colors active:scale-[0.96]"
            >
              <PanelRightClose size={16} strokeWidth={1.85} />
            </button>
          </Tooltip>

          {/* Center: Segmented Pill Tabs (Active shows text, Inactive shows icon-only) */}
          <div className="flex items-center gap-1 rounded-full bg-sunken/70 p-1 border border-line-soft/60 shadow-2xs mx-auto">
            {/* Gemini Tab */}
            <Tooltip label="Peça ao Gemini" side="bottom">
              <button
                type="button"
                onClick={() => {
                  setRightPanelTab("mark");
                  setCopilotMode(false);
                }}
                className={cx(
                  "flex items-center gap-1.5 rounded-full text-xs font-medium transition-all duration-150 shrink-0",
                  rightPanelTab === "mark"
                    ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold shadow-sm px-3 py-1"
                    : "px-2.5 py-1 text-muted hover:text-ink hover:bg-hover"
                )}
              >
                <GeminiIcon size={14} animated={rightPanelTab === "mark"} />
                {rightPanelTab === "mark" && <span>Peça ao Gemini</span>}
                {inlineComments.length > 0 && (
                  <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white/20 px-1 text-[9px] font-bold text-white">
                    {inlineComments.length}
                  </span>
                )}
              </button>
            </Tooltip>

            {/* Assistente Tab */}
            <Tooltip label="Assistente de Escrita" side="bottom">
              <button
                type="button"
                onClick={() => setRightPanelTab("writing-assistant")}
                className={cx(
                  "flex items-center gap-1.5 rounded-full text-xs font-medium transition-all duration-150 shrink-0",
                  rightPanelTab === "writing-assistant"
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold shadow-xs px-3 py-1"
                    : "px-2.5 py-1 text-muted hover:text-ink hover:bg-hover"
                )}
              >
                <PenTool size={14} className={rightPanelTab === "writing-assistant" ? "text-amber-500" : "text-muted"} />
                {rightPanelTab === "writing-assistant" && <span>Assistente</span>}
              </button>
            </Tooltip>

            {/* Backlinks Tab */}
            <Tooltip label="Menções Relacionadas" side="bottom">
              <button
                type="button"
                onClick={() => setRightPanelTab("backlinks")}
                className={cx(
                  "flex items-center gap-1.5 rounded-full text-xs font-medium transition-all duration-150 shrink-0",
                  rightPanelTab === "backlinks"
                    ? "bg-invert text-invert-ink font-semibold shadow-xs px-3 py-1"
                    : "px-2.5 py-1 text-muted hover:text-ink hover:bg-hover"
                )}
              >
                <Link2 size={14} />
                {rightPanelTab === "backlinks" && <span>Mencionados</span>}
              </button>
            </Tooltip>
          </div>

          {/* Right spacer for symmetry */}
          <div className="w-7" />
        </div>

        {/* Panel Body */}
        <div className="relative min-h-0 flex-1">
          <div className={cx("absolute inset-0 flex flex-col", rightPanelTab !== "mark" && "hidden")}>
            <AskMarkSidebar hideHeader isOpen={visible && rightPanelTab === "mark"} onClose={closeRightPanel} />
          </div>
          <div className={cx("absolute inset-0 flex flex-col", rightPanelTab !== "writing-assistant" && "hidden")}>
            <WritingAssistantSidebar isOpen={visible && rightPanelTab === "writing-assistant"} onClose={closeRightPanel} />
          </div>
          <div className={cx("absolute inset-0 flex flex-col", rightPanelTab !== "backlinks" && "hidden")}>
            {rel ? (
              <LinkedMentions hideHeader rel={rel} active={visible && rightPanelTab === "backlinks"} onClose={closeRightPanel} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-faint">
                <Link2 size={32} className="mb-2 opacity-30 text-muted" />
                <p className="text-xs font-semibold text-ink">Nenhuma nota ativa</p>
                <p className="text-[11px] text-muted mt-1 max-w-[220px]">Abra uma nota para visualizar as menções e conexões entre arquivos.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
