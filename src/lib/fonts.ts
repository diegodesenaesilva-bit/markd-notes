export interface FontOption {
  id: string;
  name: string;
  category: "sans" | "serif" | "mono" | "handwriting";
  categoryLabel: string;
  fontFamily: string;
  googleFontSpec?: string;
  description: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "inter",
    name: "Inter",
    category: "sans",
    categoryLabel: "Sem Serifa (Sans)",
    fontFamily: '"Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    description: "Padrão limpo, neutro e moderno",
  },
  {
    id: "plus-jakarta",
    name: "Plus Jakarta Sans",
    category: "sans",
    categoryLabel: "Sem Serifa (Sans)",
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    googleFontSpec: "Plus+Jakarta+Sans:ital,wght@0,400..700;1,400..700",
    description: "Geométrica, elegante e sofisticada",
  },
  {
    id: "outfit",
    name: "Outfit",
    category: "sans",
    categoryLabel: "Sem Serifa (Sans)",
    fontFamily: '"Outfit", sans-serif',
    googleFontSpec: "Outfit:wght@400;500;600;700",
    description: "Geométrica minimalista contemporânea",
  },
  {
    id: "lexend",
    name: "Lexend",
    category: "sans",
    categoryLabel: "Sem Serifa (Sans)",
    fontFamily: '"Lexend", sans-serif',
    googleFontSpec: "Lexend:wght@400;500;600;700",
    description: "Projetada para leitura fácil e rápida",
  },
  {
    id: "lora",
    name: "Lora",
    category: "serif",
    categoryLabel: "Com Serifa (Serif)",
    fontFamily: '"Lora", Georgia, serif',
    googleFontSpec: "Lora:ital,wght@0,400..700;1,400..700",
    description: "Elegante com toques caligráficos",
  },
  {
    id: "playfair",
    name: "Playfair Display",
    category: "serif",
    categoryLabel: "Com Serifa (Serif)",
    fontFamily: '"Playfair Display", Georgia, serif',
    googleFontSpec: "Playfair+Display:ital,wght@0,400..700;1,400..700",
    description: "Clássica e editorial sofisticada",
  },
  {
    id: "merriweather",
    name: "Merriweather",
    category: "serif",
    categoryLabel: "Com Serifa (Serif)",
    fontFamily: '"Merriweather", Georgia, serif',
    googleFontSpec: "Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400",
    description: "Confortável e legível para textos longos",
  },
  {
    id: "jetbrains",
    name: "JetBrains Mono",
    category: "mono",
    categoryLabel: "Monospaçada (Mono)",
    fontFamily: '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, monospace',
    description: "Monospaçada ideal para código e notas técnicas",
  },
  {
    id: "fira-code",
    name: "Fira Code",
    category: "mono",
    categoryLabel: "Monospaçada (Mono)",
    fontFamily: '"Fira Code", monospace',
    googleFontSpec: "Fira+Code:wght@400;500;600;700",
    description: "Monospaçada moderna para notas de programação",
  },
  {
    id: "caveat",
    name: "Caveat",
    category: "handwriting",
    categoryLabel: "Manuscrita (Handwriting)",
    fontFamily: '"Caveat", cursive',
    googleFontSpec: "Caveat:wght@400;500;600;700",
    description: "Estilo manuscrito pessoal e fluido",
  },
];

export const FONT_SIZES = [
  { label: "Pequeno", value: "14px" },
  { label: "Padrão", value: "16px" },
  { label: "Grande", value: "18px" },
  { label: "Muito Grande", value: "20px" },
] as const;

export const FONT_WEIGHTS = [
  { label: "Normal", value: "400" },
  { label: "Médio", value: "500" },
  { label: "Semibold", value: "600" },
] as const;

const loadedFonts = new Set<string>();

export function ensureGoogleFont(fontId: string) {
  const option = FONT_OPTIONS.find((f) => f.id === fontId) || FONT_OPTIONS[0];
  if (option.googleFontSpec && !loadedFonts.has(option.id)) {
    const linkId = `google-font-${option.id}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${option.googleFontSpec}&display=swap`;
      document.head.appendChild(link);
    }
    loadedFonts.add(option.id);
  }
  return option;
}
