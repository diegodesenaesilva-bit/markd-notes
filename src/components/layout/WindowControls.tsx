import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isTauri } from "@/lib/utils";

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isWebMinimized, setIsWebMinimized] = useState(false);

  useEffect(() => {
    if (isTauri()) {
      let unlisten: (() => void) | undefined;
      const updateState = async () => {
        try {
          const appWindow = getCurrentWindow();
          setIsMaximized(await appWindow.isMaximized());
          unlisten = await appWindow.onResized(async () => {
            setIsMaximized(await appWindow.isMaximized());
          });
        } catch {
          // Non-tauri browser fallback
        }
      };
      void updateState();
      return () => {
        unlisten?.();
      };
    } else {
      const handleFullscreenChange = () => {
        setIsMaximized(Boolean(document.fullscreenElement));
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
      };
    }
  }, []);

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTauri()) {
      void getCurrentWindow().minimize().catch(() => {});
    } else {
      setIsWebMinimized(true);
      toast("Markd minimizado", {
        description: "Clique em 'Restaurar' para voltar ao aplicativo.",
      });
    }
  };

  const handleMaximizeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTauri()) {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.toggleMaximize();
        setIsMaximized(await appWindow.isMaximized());
      } catch {
        // Ignore
      }
    } else {
      try {
        if (!document.fullscreenElement) {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          } else {
            setIsMaximized(true);
          }
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else {
            setIsMaximized(false);
          }
        }
      } catch {
        setIsMaximized((prev) => !prev);
        toast(isMaximized ? "Janela restaurada" : "Janela maximizada");
      }
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTauri()) {
      void getCurrentWindow().close().catch(() => {});
    } else {
      try {
        window.close();
      } catch {
        // Ignore
      }
      setTimeout(() => {
        toast.info("Para fechar o Markd no navegador", {
          description: "Feche esta aba do seu navegador.",
        });
      }, 100);
    }
  };

  return (
    <>
      {/* Web Minimized Overlay */}
      {isWebMinimized && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-md animate-in fade-in duration-150">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-panel p-8 shadow-2xl text-center max-w-sm mx-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-ink">
              <Minus size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-ink">Markd Minimizado</h3>
              <p className="text-xs text-muted">O aplicativo está em segundo plano na web.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsWebMinimized(false);
                toast("Janela restaurada");
              }}
              className="mt-2 flex items-center gap-2 rounded-xl bg-invert px-5 py-2.5 text-xs font-semibold text-invert-ink transition-transform active:scale-95"
            >
              <Maximize2 size={14} />
              <span>Restaurar Aplicativo</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Control Buttons */}
      <div
        className="flex items-center shrink-0 self-stretch"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* Minimize */}
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleMinimize}
          title="Minimizar"
          className="grid h-full w-10 place-items-center text-faint transition-colors duration-100 hover:bg-hover hover:text-ink"
        >
          <Minus size={13} strokeWidth={1.75} />
        </button>

        {/* Maximize / Restore */}
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleMaximizeToggle}
          title={isMaximized ? "Restaurar" : "Maximizar"}
          className="grid h-full w-10 place-items-center text-faint transition-colors duration-100 hover:bg-hover hover:text-ink"
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="1" width="8" height="8" rx="1" />
              <path d="M1 3v7a1 1 0 0 0 1 1h7" />
            </svg>
          ) : (
            <Square size={12} strokeWidth={1.5} />
          )}
        </button>

        {/* Close */}
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleClose}
          title="Fechar"
          className="grid h-full w-10 place-items-center text-faint transition-colors duration-100 hover:bg-red-500 hover:text-white"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    </>
  );
}

