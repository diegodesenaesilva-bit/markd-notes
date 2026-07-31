import { Link2, PenTool, Settings, Wand2, X } from "lucide-react";
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
          "grid h-7 w-7 place-items-center rounded-md border transition-[color,background-color,border-color,transform] duration-100 active:scale-[0.96]",
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
    openSettings,
  } = useUi();

  const copilotMode = useCopilot((s) => s.copilotMode);
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
        {/* Unified Header with Tabs */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-2.5 bg-sunken/40">
          <div className="flex items-center gap-0.5 rounded-lg bg-bg/80 p-0.5 border border-line-soft overflow-x-auto [scrollbar-width:none]">
            <button
              type="button"
              onClick={() => {
                setRightPanelTab("mark");
                setCopilotMode(false);
              }}
              className={cx(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-100 shrink-0",
                rightPanelTab === "mark" && !copilotMode
                  ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold shadow-2xs"
                  : "text-muted hover:text-ink hover:bg-hover"
              )}
            >
              <GeminiIcon size={13} animated={rightPanelTab === "mark" && !copilotMode} />
              <span>Peça ao Gemini</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRightPanelTab("mark");
                setCopilotMode(true);
              }}
              className={cx(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-100 shrink-0",
                rightPanelTab === "mark" && copilotMode
                  ? "bg-purple-600 text-white font-semibold shadow-2xs"
                  : "text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
              )}
            >
              <Wand2 size={13} />
              <span>Copiloto</span>
              {inlineComments.length > 0 && (
                <span className="ml-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-purple-400 px-1 text-[9px] font-bold text-slate-950">
                  {inlineComments.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setRightPanelTab("writing-assistant")}
              className={cx(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-100 shrink-0",
                rightPanelTab === "writing-assistant"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold shadow-2xs"
                  : "text-muted hover:text-ink hover:bg-hover"
              )}
            >
              <PenTool size={13} className={rightPanelTab === "writing-assistant" ? "text-amber-500" : "text-muted"} />
              <span>Assistente</span>
            </button>

            <button
              type="button"
              onClick={() => setRightPanelTab("backlinks")}
              className={cx(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-100 shrink-0",
                rightPanelTab === "backlinks"
                  ? "bg-invert text-invert-ink font-semibold shadow-2xs"
                  : "text-muted hover:text-ink hover:bg-hover"
              )}
            >
              <Link2 size={13} />
              <span>Mentions</span>
            </button>
          </div>

          <div className="flex items-center gap-0.5">
            {rightPanelTab === "mark" && (
              <button
                type="button"
                onClick={() => openSettings("general")}
                className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink"
                title="Configurações de IA"
              >
                <Settings size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={closeRightPanel}
              className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink"
              title="Fechar painel"
            >
              <X size={14} strokeWidth={1.9} />
            </button>
          </div>
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
