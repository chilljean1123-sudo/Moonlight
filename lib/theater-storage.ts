// lib/theater-storage.ts — 小剧场：题材（genre）与剧场存放（entry）的本地存储

import { kvGet, kvSet, registerKvMigration } from "./kv-db";
import type { TheaterEntry, TheaterGenre } from "./theater-types";

const GENRES_KEY = "ai_phone_theater_genres_v1";
const ENTRIES_KEY = "ai_phone_theater_entries_v1";

registerKvMigration(GENRES_KEY);
registerKvMigration(ENTRIES_KEY);

function makeId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ── 内置题材：论坛按用户给的 14 条互动规则做旗舰示例；其余给对应平台的生成侧重点。
//    用户可以随时自建/编辑/停用，这里只是开箱可用的起点，不是穷举。

export const BUILTIN_THEATER_GENRES: TheaterGenre[] = [
    {
        id: "builtin-forum",
        title: "论坛/贴吧",
        styleKey: "forum",
        setting: "围绕角色近期的传闻、偶遇、日常片段展开的贴吧风格讨论串，网友各执一词、有争有和。",
        enabled: true,
        builtIn: true,
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "builtin-xiaohongshu",
        title: "小红书",
        styleKey: "xiaohongshu",
        setting: "围绕角色的探店/穿搭/日常分享的小红书笔记，配图描述 + 高赞评论区。",
        enabled: true,
        builtIn: true,
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "builtin-chatlog",
        title: "聊天记录",
        styleKey: "chatlog",
        setting: "一段被截图流出的群聊/私聊聊天记录，围绕角色的一件事展开讨论。",
        enabled: true,
        builtIn: true,
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "builtin-douyin",
        title: "抖音",
        styleKey: "douyin",
        setting: "一条关于角色的抖音短视频页面（标题/文案 + 评论区），评论区讨论热烈。",
        enabled: true,
        builtIn: true,
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "builtin-checkphone",
        title: "查手机",
        styleKey: "checkphone",
        setting: "翻看角色手机时看到的聊天/相册/搜索记录片段，带一点心跳感的私密感。",
        enabled: true,
        builtIn: true,
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "builtin-memo",
        title: "备忘录",
        styleKey: "memo",
        setting: "角色手机备忘录里的一篇私人笔记/清单/心情记录。",
        enabled: true,
        builtIn: true,
        createdAt: "2026-01-01T00:00:00.000Z",
    },
];

function normalizeGenre(raw: unknown): TheaterGenre | null {
    if (!raw || typeof raw !== "object") return null;
    const g = raw as Partial<TheaterGenre>;
    if (typeof g.id !== "string" || typeof g.title !== "string") return null;
    return {
        id: g.id,
        title: g.title,
        styleKey: (g.styleKey as TheaterGenre["styleKey"]) || "generic",
        setting: typeof g.setting === "string" ? g.setting : "",
        enabled: g.enabled !== false,
        builtIn: g.builtIn === true,
        createdAt: typeof g.createdAt === "string" ? g.createdAt : new Date().toISOString(),
    };
}

/** 读取题材列表：内置题材第一次读取时落盘写入，之后用户的启停/编辑以存档为准。 */
export function loadTheaterGenres(): TheaterGenre[] {
    if (typeof window === "undefined") return BUILTIN_THEATER_GENRES;
    try {
        const raw = kvGet(GENRES_KEY);
        if (!raw) {
            saveTheaterGenres(BUILTIN_THEATER_GENRES);
            return BUILTIN_THEATER_GENRES;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return BUILTIN_THEATER_GENRES;
        const normalized = parsed.map(normalizeGenre).filter((g): g is TheaterGenre => g !== null);

        // 老存档补齐后续新增的内置题材（不影响用户已有的启停状态/自定义题材）
        const existingIds = new Set(normalized.map(g => g.id));
        const missingBuiltins = BUILTIN_THEATER_GENRES.filter(g => !existingIds.has(g.id));
        if (missingBuiltins.length > 0) {
            const merged = [...normalized, ...missingBuiltins];
            saveTheaterGenres(merged);
            return merged;
        }
        return normalized;
    } catch {
        return BUILTIN_THEATER_GENRES;
    }
}

export function saveTheaterGenres(genres: TheaterGenre[]): void {
    if (typeof window === "undefined") return;
    kvSet(GENRES_KEY, JSON.stringify(genres));
}

export function addTheaterGenre(input: { title: string; styleKey: TheaterGenre["styleKey"]; setting: string }): TheaterGenre {
    const genre: TheaterGenre = {
        id: makeId("genre"),
        title: input.title.trim() || "未命名题材",
        styleKey: input.styleKey,
        setting: input.setting.trim(),
        enabled: true,
        builtIn: false,
        createdAt: new Date().toISOString(),
    };
    saveTheaterGenres([...loadTheaterGenres(), genre]);
    return genre;
}

export function updateTheaterGenre(id: string, patch: Partial<Pick<TheaterGenre, "title" | "styleKey" | "setting" | "enabled">>): void {
    saveTheaterGenres(loadTheaterGenres().map(g => g.id === id ? { ...g, ...patch } : g));
}

/** 内置题材只能停用，不能删除；自定义题材可以直接删掉。 */
export function removeTheaterGenre(id: string): void {
    const genres = loadTheaterGenres();
    const target = genres.find(g => g.id === id);
    if (!target) return;
    if (target.builtIn) {
        updateTheaterGenre(id, { enabled: false });
        return;
    }
    saveTheaterGenres(genres.filter(g => g.id !== id));
}

// ── 剧场存放（历史记录） ──

function normalizeEntry(raw: unknown): TheaterEntry | null {
    if (!raw || typeof raw !== "object") return null;
    const e = raw as Partial<TheaterEntry>;
    if (typeof e.id !== "string" || typeof e.html !== "string") return null;
    return {
        id: e.id,
        genreId: typeof e.genreId === "string" ? e.genreId : "",
        genreTitle: typeof e.genreTitle === "string" ? e.genreTitle : "",
        styleKey: (e.styleKey as TheaterEntry["styleKey"]) || "generic",
        title: typeof e.title === "string" ? e.title : "未命名剧场",
        setting: typeof e.setting === "string" ? e.setting : "",
        characterId: typeof e.characterId === "string" ? e.characterId : undefined,
        characterName: typeof e.characterName === "string" ? e.characterName : undefined,
        html: e.html,
        summary: typeof e.summary === "string" ? e.summary : "",
        wordCount: typeof e.wordCount === "number" ? e.wordCount : 0,
        truncated: e.truncated === true,
        createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
        updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : new Date().toISOString(),
    };
}

export function loadTheaterEntries(): TheaterEntry[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = kvGet(ENTRIES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizeEntry).filter((e): e is TheaterEntry => e !== null)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
        return [];
    }
}

export function saveTheaterEntries(entries: TheaterEntry[]): void {
    if (typeof window === "undefined") return;
    kvSet(ENTRIES_KEY, JSON.stringify(entries));
}

export function getTheaterEntry(id: string): TheaterEntry | null {
    return loadTheaterEntries().find(e => e.id === id) ?? null;
}

export function addTheaterEntry(entry: Omit<TheaterEntry, "id" | "createdAt" | "updatedAt">): TheaterEntry {
    const now = new Date().toISOString();
    const full: TheaterEntry = { ...entry, id: makeId("theater"), createdAt: now, updatedAt: now };
    saveTheaterEntries([full, ...loadTheaterEntries()]);
    return full;
}

export function removeTheaterEntry(id: string): void {
    saveTheaterEntries(loadTheaterEntries().filter(e => e.id !== id));
}
