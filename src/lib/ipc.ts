import { invoke } from "@tauri-apps/api/core";
import type {
  BacklinkMention,
  CanvasMeta,
  CloudAccountStatus,
  CloudAccount,
  Bookmark,
  PublishedNoteStatus,
  PublishPageDraft,
  PublishedShare,
  OtpChallenge,
  SearchHit,
  Theme,
  Todo,
  TreeNode,
  VaultSnapshot,
} from "./types";

interface ErrorPayload {
  kind: string;
  message: string;
}

export class IpcError extends Error {
  kind: string;
  constructor(payload: ErrorPayload) {
    super(payload.message);
    this.kind = payload.kind;
  }
}

export function isTauriAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as any).__TAURI_INTERNALS__) &&
    !(window as any).__TAURI_IS_WEB__
  );
}

// Default seed data for Web Mode
const SEED_NOTES: Record<string, string> = {
  "Welcome.md": `# Welcome to Markd

Markd is a local-first, plain Markdown notes app.

- **Fast & Minimalist**: Built with React 19, Vite, and Tiptap 3.
- **Key Features**: Rich Markdown editing, wiki links (\`[[Getting Started]]\`), Todos, Bookmarks, and Backlinks.
- **Command Palette**: Press \`Cmd+K\` or \`Ctrl+K\` to search or execute commands.
- **Slash Commands**: Type \`/\` inside any note to insert components or links.

Start by exploring your notes on the sidebar or create a new note!`,

  "Getting Started.md": `# Getting Started

Here are some helpful tips to get the most out of Markd:

## Formatting Options
- **Headings**: Use \`#\` for H1, \`##\` for H2, \`###\` for H3.
- **Lists**: Bullet lists with \`-\` or numbered lists with \`1.\`.
- **Code Blocks**: Type \`\`\` code blocks with syntax highlighting.
- **Task Lists**: Type \`- [ ]\` for checkboxes.

## Internal Linking
Use double brackets like \`[[Welcome]]\` to create instant internal links between notes!`,

  "Projects/App.md": `# App Roadmap

- [x] Initial GitHub import migration
- [x] Client-side web fallback engine
- [ ] Custom theme expansion
- [ ] Cloud publishing integration`,

  "Daily Notes/2026-07-25.md": `# 2026-07-25

Today's focus:
- Review app layout and theme switching
- Test note creation, renaming, and deletion
- Verify Todo manager and Bookmark manager`,
};

const SEED_TODOS: Todo[] = [
  {
    id: "todo-1",
    text: "Explore Markd markdown editor",
    done: false,
    createdAt: Date.now() - 3600000,
    completedAt: null,
    tags: ["welcome"],
  },
  {
    id: "todo-2",
    text: "Try creating internal note links with [[Getting Started]]",
    done: true,
    createdAt: Date.now() - 7200000,
    completedAt: Date.now() - 1800000,
    tags: ["tips"],
  },
];

const SEED_BOOKMARKS: Bookmark[] = [
  {
    id: "bm-1",
    url: "https://markd.app",
    title: "Markd - Quiet, local-first Markdown notes",
    image: null,
    favicon: null,
    metaFetched: true,
    tags: ["tools"],
    createdAt: Date.now(),
  },
];

// Helper utilities for web storage
function getStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function getWebNotes(): Record<string, string> {
  let notes = getStorage<Record<string, string> | null>("markd_web_notes", null);
  if (!notes) {
    notes = { ...SEED_NOTES };
    setStorage("markd_web_notes", notes);
  }
  return notes;
}

function setWebNotes(notes: Record<string, string>): void {
  setStorage("markd_web_notes", notes);
}

function getWebTree(): TreeNode[] {
  const notes = getWebNotes();
  const treeMap: Record<string, TreeNode> = {};
  const rootNodes: TreeNode[] = [];
  const paths = Object.keys(notes).sort();

  for (const rel of paths) {
    const parts = rel.split("/");
    let currentRel = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const parentRel = currentRel;
      currentRel = currentRel ? `${currentRel}/${part}` : part;

      if (!treeMap[currentRel]) {
        const node: TreeNode = {
          name: part,
          rel: currentRel,
          kind: isLast ? "note" : "folder",
          modifiedMs: Date.now(),
          ...(isLast ? {} : { children: [] }),
        };
        treeMap[currentRel] = node;

        if (parentRel && treeMap[parentRel]) {
          if (!treeMap[parentRel].children) treeMap[parentRel].children = [];
          treeMap[parentRel].children!.push(node);
        } else if (!parentRel) {
          rootNodes.push(node);
        }
      }
    }
  }

  return rootNodes;
}

const webHandlers: Record<string, (args?: any) => any> = {
  startup: (): VaultSnapshot => {
    const theme = getStorage<Theme>("markd_web_theme", "system");
    return {
      root: "/My Vault",
      name: "My Vault",
      tree: getWebTree(),
      theme,
    };
  },

  choose_vault: (): VaultSnapshot => {
    const theme = getStorage<Theme>("markd_web_theme", "system");
    return {
      root: "/My Vault",
      name: "My Vault",
      tree: getWebTree(),
      theme,
    };
  },

  create_vault: (): VaultSnapshot => {
    setWebNotes({ ...SEED_NOTES });
    const theme = getStorage<Theme>("markd_web_theme", "system");
    return {
      root: "/My Vault",
      name: "My Vault",
      tree: getWebTree(),
      theme,
    };
  },

  load_tree: (): TreeNode[] => getWebTree(),

  read_note: (args: { rel: string }): string => {
    const notes = getWebNotes();
    return notes[args.rel] ?? `# ${args.rel.split("/").pop()?.replace(/\.md$/, "")}\n\n`;
  },

  write_note: (args: { rel: string; content: string }): void => {
    const notes = getWebNotes();
    notes[args.rel] = args.content;
    setWebNotes(notes);
  },

  create_note: (args: { dir: string; title: string }): string => {
    const notes = getWebNotes();
    let title = args.title || "Untitled";
    let rel = args.dir ? `${args.dir}/${title}.md` : `${title}.md`;
    let counter = 2;
    while (notes[rel]) {
      const nextTitle = `${title} ${counter}`;
      rel = args.dir ? `${args.dir}/${nextTitle}.md` : `${nextTitle}.md`;
      counter++;
    }
    notes[rel] = `# ${title}\n\n`;
    setWebNotes(notes);
    return rel;
  },

  create_note_with_content: (args: { dir: string; title: string; content: string }): string => {
    const notes = getWebNotes();
    let title = args.title || "Untitled";
    let rel = args.dir ? `${args.dir}/${title}.md` : `${title}.md`;
    let counter = 2;
    while (notes[rel]) {
      const nextTitle = `${title} ${counter}`;
      rel = args.dir ? `${args.dir}/${nextTitle}.md` : `${nextTitle}.md`;
      counter++;
    }
    notes[rel] = args.content;
    setWebNotes(notes);
    return rel;
  },

  open_daily_note: (args: { date: string }): string => {
    const notes = getWebNotes();
    const rel = `Daily Notes/${args.date}.md`;
    if (!notes[rel]) {
      notes[rel] = `# ${args.date}\n\n`;
      setWebNotes(notes);
    }
    return rel;
  },

  show_quick_capture: () => {},
  close_quick_capture: () => {},

  create_folder: (args: { dir: string; name: string }): string => {
    const notes = getWebNotes();
    const folderRel = args.dir ? `${args.dir}/${args.name}` : args.name;
    const placeholderNote = `${folderRel}/Untitled.md`;
    if (!notes[placeholderNote]) {
      notes[placeholderNote] = `# Untitled\n\n`;
      setWebNotes(notes);
    }
    return folderRel;
  },

  rename_entry: (args: { rel: string; name: string }): string => {
    const notes = getWebNotes();
    const oldRel = args.rel;
    const isFolder = !oldRel.endsWith(".md");

    if (!isFolder) {
      const dir = oldRel.includes("/") ? oldRel.slice(0, oldRel.lastIndexOf("/")) : "";
      const newName = args.name.endsWith(".md") ? args.name : `${args.name}.md`;
      const newRel = dir ? `${dir}/${newName}` : newName;
      if (notes[oldRel] !== undefined) {
        notes[newRel] = notes[oldRel];
        delete notes[oldRel];
        setWebNotes(notes);
      }
      return newRel;
    } else {
      const parent = oldRel.includes("/") ? oldRel.slice(0, oldRel.lastIndexOf("/")) : "";
      const newRel = parent ? `${parent}/${args.name}` : args.name;
      const updated: Record<string, string> = {};
      for (const [key, val] of Object.entries(notes)) {
        if (key.startsWith(`${oldRel}/`)) {
          const suffix = key.slice(oldRel.length);
          updated[`${newRel}${suffix}`] = val;
        } else {
          updated[key] = val;
        }
      }
      setWebNotes(updated);
      return newRel;
    }
  },

  move_entry: (args: { rel: string; dir: string }): string => {
    const notes = getWebNotes();
    const oldRel = args.rel;
    const fileName = oldRel.split("/").pop()!;
    const newRel = args.dir ? `${args.dir}/${fileName}` : fileName;

    if (notes[oldRel] !== undefined) {
      notes[newRel] = notes[oldRel];
      delete notes[oldRel];
      setWebNotes(notes);
    }
    return newRel;
  },

  delete_entry: (args: { rel: string }): void => {
    const notes = getWebNotes();
    const rel = args.rel;
    for (const key of Object.keys(notes)) {
      if (key === rel || key.startsWith(`${rel}/`)) {
        delete notes[key];
      }
    }
    setWebNotes(notes);
  },

  search_notes: (args: { query: string; limit?: number }): SearchHit[] => {
    const query = (args.query || "").trim().toLowerCase();
    if (!query) return [];
    const limit = args.limit || 20;
    const notes = getWebNotes();
    const hits: SearchHit[] = [];

    for (const [rel, content] of Object.entries(notes)) {
      const title = rel.split("/").pop()?.replace(/\.md$/, "") ?? rel;
      const titleMatch = title.toLowerCase().includes(query);
      const contentLower = content.toLowerCase();
      const matchIdx = contentLower.indexOf(query);

      if (titleMatch || matchIdx !== -1) {
        let snippet = "";
        if (matchIdx !== -1) {
          const start = Math.max(0, matchIdx - 30);
          const end = Math.min(content.length, matchIdx + query.length + 50);
          snippet = (start > 0 ? "..." : "") + content.slice(start, end) + (end < content.length ? "..." : "");
        } else {
          snippet = content.slice(0, 80);
        }

        hits.push({
          rel,
          title,
          snippet,
          titleMatch,
        });

        if (hits.length >= limit) break;
      }
    }

    hits.sort((a, b) => (b.titleMatch ? 1 : 0) - (a.titleMatch ? 1 : 0));
    return hits;
  },

  backlinks_for: (args: { rel: string }): BacklinkMention[] => {
    const targetTitle = args.rel.split("/").pop()?.replace(/\.md$/, "").toLowerCase() ?? "";
    if (!targetTitle) return [];

    const notes = getWebNotes();
    const mentions: BacklinkMention[] = [];

    for (const [sourceRel, content] of Object.entries(notes)) {
      if (sourceRel === args.rel) continue;

      const lines = content.split("\n");
      lines.forEach((lineText, lineIdx) => {
        const lower = lineText.toLowerCase();
        if (lower.includes(`[[${targetTitle}`) || lower.includes(`](${args.rel.toLowerCase()})`)) {
          mentions.push({
            sourceRel,
            context: lineText.trim(),
            line: lineIdx + 1,
            occurrence: 1,
          });
        }
      });
    }

    return mentions;
  },

  cloud_account_status: (): CloudAccountStatus => ({
    account: { email: "demo@markd.app", plan: "cloud" },
  }),

  cloud_request_otp: (args: { email: string }): OtpChallenge => ({
    challengeId: "mock-otp-id",
    email: args.email,
    expiresIn: 300,
    resendAfter: 60,
  }),

  cloud_verify_otp: (_args: { challengeId: string; code: string }): CloudAccount => ({
    email: "demo@markd.app",
    plan: "cloud",
  }),

  cloud_sign_out: () => {},
  cloud_plans_url: (): string => "#",
  cloud_billing_portal_url: (): string => "#",

  published_note_status: (_args: { rel: string; title: string; content: string; pages: PublishPageDraft[] }): PublishedNoteStatus => ({
    account: { email: "demo@markd.app", plan: "cloud" },
    share: null,
    isOutdated: false,
  }),

  is_note_published: (): boolean => false,

  publish_note: (args: { rel: string; title: string; content: string; pages: PublishPageDraft[] }): PublishedShare => ({
    id: "share-1",
    entryId: "entry-1",
    slug: "demo-note",
    url: "https://markd.app/s/demo-note",
    title: args.title,
    contentHash: "hash-123",
    publishedAt: Date.now(),
    updatedAt: Date.now(),
    pageCount: args.pages.length,
    assetCount: 0,
  }),

  update_published_note: (args: { rel: string; title: string; content: string; pages: PublishPageDraft[] }): PublishedShare => ({
    id: "share-1",
    entryId: "entry-1",
    slug: "demo-note",
    url: "https://markd.app/s/demo-note",
    title: args.title,
    contentHash: "hash-123",
    publishedAt: Date.now(),
    updatedAt: Date.now(),
    pageCount: args.pages.length,
    assetCount: 0,
  }),

  revoke_published_note: () => {},

  pins_list: (): string[] => getStorage<string[]>("markd_web_pins", ["Welcome.md"]),
  pin_note: (args: { rel: string }): string[] => {
    const pins = getStorage<string[]>("markd_web_pins", ["Welcome.md"]);
    if (!pins.includes(args.rel)) pins.push(args.rel);
    setStorage("markd_web_pins", pins);
    return pins;
  },
  unpin_note: (args: { rel: string }): string[] => {
    let pins = getStorage<string[]>("markd_web_pins", ["Welcome.md"]);
    pins = pins.filter((p) => p !== args.rel);
    setStorage("markd_web_pins", pins);
    return pins;
  },
  pins_save: (args: { pins: string[] }): string[] => {
    setStorage("markd_web_pins", args.pins);
    return args.pins;
  },

  todos_list: (): Todo[] => getStorage<Todo[]>("markd_web_todos", SEED_TODOS),
  todo_add: (args: { text: string }): Todo => {
    const todos = getStorage<Todo[]>("markd_web_todos", SEED_TODOS);
    const newTodo: Todo = {
      id: `todo-${Date.now()}`,
      text: args.text,
      done: false,
      createdAt: Date.now(),
      completedAt: null,
      tags: [],
    };
    todos.unshift(newTodo);
    setStorage("markd_web_todos", todos);
    return newTodo;
  },
  todo_toggle: (args: { id: string }): Todo => {
    const todos = getStorage<Todo[]>("markd_web_todos", SEED_TODOS);
    const todo = todos.find((t) => t.id === args.id);
    if (todo) {
      todo.done = !todo.done;
      todo.completedAt = todo.done ? Date.now() : null;
      setStorage("markd_web_todos", todos);
      return todo;
    }
    throw new Error("Todo not found");
  },
  todo_update: (args: { id: string; text: string }): Todo => {
    const todos = getStorage<Todo[]>("markd_web_todos", SEED_TODOS);
    const todo = todos.find((t) => t.id === args.id);
    if (todo) {
      todo.text = args.text;
      setStorage("markd_web_todos", todos);
      return todo;
    }
    throw new Error("Todo not found");
  },
  todo_set_tags: (args: { id: string; tags: string[] }): Todo => {
    const todos = getStorage<Todo[]>("markd_web_todos", SEED_TODOS);
    const todo = todos.find((t) => t.id === args.id);
    if (todo) {
      todo.tags = args.tags;
      setStorage("markd_web_todos", todos);
      return todo;
    }
    throw new Error("Todo not found");
  },
  todo_tags_list: (): string[] => getStorage<string[]>("markd_web_todo_tags", ["welcome", "tips"]),
  todo_tag_create: (args: { name: string }): string[] => {
    const tags = getStorage<string[]>("markd_web_todo_tags", ["welcome", "tips"]);
    if (!tags.includes(args.name)) tags.push(args.name);
    setStorage("markd_web_todo_tags", tags);
    return tags;
  },
  todo_tag_delete: (args: { name: string }): string[] => {
    let tags = getStorage<string[]>("markd_web_todo_tags", ["welcome", "tips"]);
    tags = tags.filter((t) => t !== args.name);
    setStorage("markd_web_todo_tags", tags);
    return tags;
  },
  todo_delete: (args: { id: string }): void => {
    let todos = getStorage<Todo[]>("markd_web_todos", SEED_TODOS);
    todos = todos.filter((t) => t.id !== args.id);
    setStorage("markd_web_todos", todos);
  },
  todos_clear_completed: (): Todo[] => {
    let todos = getStorage<Todo[]>("markd_web_todos", SEED_TODOS);
    todos = todos.filter((t) => !t.done);
    setStorage("markd_web_todos", todos);
    return todos;
  },

  bookmarks_list: (): Bookmark[] => getStorage<Bookmark[]>("markd_web_bookmarks", SEED_BOOKMARKS),
  bookmark_add: (args: { url: string }): Bookmark => {
    const bookmarks = getStorage<Bookmark[]>("markd_web_bookmarks", SEED_BOOKMARKS);
    let title = args.url;
    try {
      title = new URL(args.url).hostname;
    } catch {
      // ignore
    }
    const newBm: Bookmark = {
      id: `bm-${Date.now()}`,
      url: args.url,
      title,
      image: null,
      favicon: null,
      metaFetched: true,
      tags: [],
      createdAt: Date.now(),
    };
    bookmarks.unshift(newBm);
    setStorage("markd_web_bookmarks", bookmarks);
    return newBm;
  },
  bookmark_update_title: (args: { id: string; title: string }): Bookmark => {
    const bookmarks = getStorage<Bookmark[]>("markd_web_bookmarks", SEED_BOOKMARKS);
    const bm = bookmarks.find((b) => b.id === args.id);
    if (bm) {
      bm.title = args.title;
      setStorage("markd_web_bookmarks", bookmarks);
      return bm;
    }
    throw new Error("Bookmark not found");
  },
  bookmark_set_tags: (args: { id: string; tags: string[] }): Bookmark => {
    const bookmarks = getStorage<Bookmark[]>("markd_web_bookmarks", SEED_BOOKMARKS);
    const bm = bookmarks.find((b) => b.id === args.id);
    if (bm) {
      bm.tags = args.tags;
      setStorage("markd_web_bookmarks", bookmarks);
      return bm;
    }
    throw new Error("Bookmark not found");
  },
  bookmark_tags_list: (): string[] => getStorage<string[]>("markd_web_bm_tags", ["tools"]),
  bookmark_tag_create: (args: { name: string }): string[] => {
    const tags = getStorage<string[]>("markd_web_bm_tags", ["tools"]);
    if (!tags.includes(args.name)) tags.push(args.name);
    setStorage("markd_web_bm_tags", tags);
    return tags;
  },
  bookmark_tag_delete: (args: { name: string }): string[] => {
    let tags = getStorage<string[]>("markd_web_bm_tags", ["tools"]);
    tags = tags.filter((t) => t !== args.name);
    setStorage("markd_web_bm_tags", tags);
    return tags;
  },
  bookmark_delete: (args: { id: string }): void => {
    let bookmarks = getStorage<Bookmark[]>("markd_web_bookmarks", SEED_BOOKMARKS);
    bookmarks = bookmarks.filter((b) => b.id !== args.id);
    setStorage("markd_web_bookmarks", bookmarks);
  },
  bookmark_fetch_meta: (args: { id: string }): Bookmark => {
    const bookmarks = getStorage<Bookmark[]>("markd_web_bookmarks", SEED_BOOKMARKS);
    const bm = bookmarks.find((b) => b.id === args.id);
    if (bm) return bm;
    throw new Error("Bookmark not found");
  },
  export_bookmarks: (): string => {
    const bookmarks = getStorage<Bookmark[]>("markd_web_bookmarks", SEED_BOOKMARKS);
    return JSON.stringify(bookmarks, null, 2);
  },
  export_note: (args: { rel: string; content: string }): string => {
    const filename = args.rel.split("/").pop() || "note.md";
    const blob = new Blob([args.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return filename;
  },

  save_image_asset: (args: { data: string; extension: string }): string => args.data,

  canvas_load: (args?: { id?: string }): any => {
    const id = args?.id || "default";
    return getStorage<any>(`markd_web_canvas_${id}`, getStorage<any>("markd_web_canvas", null));
  },
  canvas_save: (args: { id?: string; data: any }): void => {
    const id = args?.id || "default";
    setStorage(`markd_web_canvas_${id}`, args.data);
    if (id === "default") {
      setStorage("markd_web_canvas", args.data);
    }
  },
  canvas_list_load: (): any => {
    return getStorage<any>("markd_web_canvas_list", [
      { id: "default", name: "Moodboard Geral", createdAt: Date.now(), updatedAt: Date.now() },
    ]);
  },
  canvas_list_save: (args: { list: any }): void => {
    setStorage("markd_web_canvas_list", args.list);
  },

  set_theme: (args: { theme: Theme }): void => {
    setStorage("markd_web_theme", args.theme);
  },

  get_theme: (): Theme => getStorage<Theme>("markd_web_theme", "system"),
};

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauriAvailable()) {
    try {
      return await invoke<T>(command, args);
    } catch (raw) {
      if (raw && typeof raw === "object" && "message" in raw) {
        throw new IpcError(raw as ErrorPayload);
      }
      throw new IpcError({ kind: "other", message: String(raw) });
    }
  }

  // Web fallback mode
  if (command in webHandlers) {
    return webHandlers[command](args);
  }

  throw new IpcError({ kind: "not_found", message: `Command ${command} not supported in web mode` });
}

export const ipc = {
  startup: () => call<VaultSnapshot | null>("startup"),
  chooseVault: () => call<VaultSnapshot | null>("choose_vault"),
  createVault: () => call<VaultSnapshot | null>("create_vault"),
  loadTree: () => call<TreeNode[]>("load_tree"),

  readNote: (rel: string) => call<string>("read_note", { rel }),
  writeNote: (rel: string, content: string) =>
    call<void>("write_note", { rel, content }),
  createNote: (dir: string, title: string) =>
    call<string>("create_note", { dir, title }),
  createNoteWithContent: (dir: string, title: string, content: string) =>
    call<string>("create_note_with_content", { dir, title, content }),
  openDailyNote: (date: string) => call<string>("open_daily_note", { date }),
  showQuickCapture: () => call<void>("show_quick_capture"),
  closeQuickCapture: () => call<void>("close_quick_capture"),
  createFolder: (dir: string, name: string) =>
    call<string>("create_folder", { dir, name }),
  renameEntry: (rel: string, name: string) =>
    call<string>("rename_entry", { rel, name }),
  moveEntry: (rel: string, dir: string) =>
    call<string>("move_entry", { rel, dir }),
  deleteEntry: (rel: string) => call<void>("delete_entry", { rel }),
  searchNotes: (query: string, limit?: number) =>
    call<SearchHit[]>("search_notes", { query, limit }),
  backlinksFor: (rel: string) =>
    call<BacklinkMention[]>("backlinks_for", { rel }),
  cloudAccountStatus: () => call<CloudAccountStatus>("cloud_account_status"),
  cloudRequestOtp: (email: string) =>
    call<OtpChallenge>("cloud_request_otp", { email }),
  cloudVerifyOtp: (challengeId: string, code: string) =>
    call<CloudAccount>("cloud_verify_otp", { challengeId, code }),
  cloudSignOut: () => call<void>("cloud_sign_out"),
  cloudPlansUrl: () => call<string>("cloud_plans_url"),
  cloudBillingPortalUrl: () => call<string>("cloud_billing_portal_url"),
  publishedNoteStatus: (
    rel: string,
    title: string,
    content: string,
    pages: PublishPageDraft[],
  ) => call<PublishedNoteStatus>("published_note_status", { rel, title, content, pages }),
  isNotePublished: (rel: string) =>
    call<boolean>("is_note_published", { rel }),
  publishNote: (
    rel: string,
    title: string,
    content: string,
    pages: PublishPageDraft[],
  ) => call<PublishedShare>("publish_note", { rel, title, content, pages }),
  updatePublishedNote: (
    rel: string,
    title: string,
    content: string,
    pages: PublishPageDraft[],
  ) => call<PublishedShare>("update_published_note", { rel, title, content, pages }),
  revokePublishedNote: (rel: string) =>
    call<void>("revoke_published_note", { rel }),
  pinsList: () => call<string[]>("pins_list"),
  pinNote: (rel: string) => call<string[]>("pin_note", { rel }),
  unpinNote: (rel: string) => call<string[]>("unpin_note", { rel }),
  pinsSave: (pins: string[]) => call<string[]>("pins_save", { pins }),

  todosList: () => call<Todo[]>("todos_list"),
  todoAdd: (text: string) => call<Todo>("todo_add", { text }),
  todoToggle: (id: string) => call<Todo>("todo_toggle", { id }),
  todoUpdate: (id: string, text: string) =>
    call<Todo>("todo_update", { id, text }),
  todoSetTags: (id: string, tags: string[]) =>
    call<Todo>("todo_set_tags", { id, tags }),
  todoTagsList: () => call<string[]>("todo_tags_list"),
  todoTagCreate: (name: string) => call<string[]>("todo_tag_create", { name }),
  todoTagDelete: (name: string) => call<string[]>("todo_tag_delete", { name }),
  todoDelete: (id: string) => call<void>("todo_delete", { id }),
  todosClearCompleted: () => call<Todo[]>("todos_clear_completed"),

  bookmarksList: () => call<Bookmark[]>("bookmarks_list"),
  bookmarkAdd: (url: string) => call<Bookmark>("bookmark_add", { url }),
  bookmarkUpdateTitle: (id: string, title: string) =>
    call<Bookmark>("bookmark_update_title", { id, title }),
  bookmarkSetTags: (id: string, tags: string[]) =>
    call<Bookmark>("bookmark_set_tags", { id, tags }),
  bookmarkTagsList: () => call<string[]>("bookmark_tags_list"),
  bookmarkTagCreate: (name: string) =>
    call<string[]>("bookmark_tag_create", { name }),
  bookmarkTagDelete: (name: string) =>
    call<string[]>("bookmark_tag_delete", { name }),
  bookmarkDelete: (id: string) => call<void>("bookmark_delete", { id }),
  bookmarkFetchMeta: (id: string) => call<Bookmark>("bookmark_fetch_meta", { id }),
  exportBookmarks: () => call<string | null>("export_bookmarks"),
  exportNote: (rel: string, content: string) =>
    call<string | null>("export_note", { rel, content }),

  saveImageAsset: (data: string, extension: string) =>
    call<string>("save_image_asset", { data, extension }),
  canvasLoad: (id?: string) => call<any>("canvas_load", { id }),
  canvasSave: (data: any, id?: string) => call<void>("canvas_save", { id, data }),
  canvasListLoad: () => call<CanvasMeta[]>("canvas_list_load"),
  canvasListSave: (list: CanvasMeta[]) => call<void>("canvas_list_save", { list }),
  setTheme: (theme: Theme) => call<void>("set_theme", { theme }),
  getTheme: () => call<Theme>("get_theme"),
  geminiGenerate: (url: string, body: string) => call<string>("gemini_generate", { url, body }),
};
