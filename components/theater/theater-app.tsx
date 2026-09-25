"use client";

// Small Theater 小剧场：题材管理（可开关的生成题材库）+ 剧场存放（生成历史，可重复查看/分享到聊天）。

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Clock3, Drama, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Toggle } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import {
    loadTheaterEntries,
    loadTheaterGenres,
    removeTheaterEntry,
    removeTheaterGenre,
    updateTheaterGenre,
} from "@/lib/theater-storage";
import { THEATER_STYLE_LABELS, type TheaterEntry, type TheaterGenre } from "@/lib/theater-types";
import { TheaterGenreEditor } from "./theater-genre-editor";
import { TheaterGenerateModal } from "./theater-generate-modal";
import { TheaterViewer } from "./theater-viewer";

type TheaterTab = "genres" | "entries";

export function TheaterApp({
    onClose,
    openEntryId,
    onOpenEntryConsumed,
}: {
    onClose: () => void;
    openEntryId?: string | null;
    onOpenEntryConsumed?: () => void;
}) {
    const [tab, setTab] = useState<TheaterTab>("genres");
    const [genres, setGenres] = useState<TheaterGenre[]>([]);
    const [entries, setEntries] = useState<TheaterEntry[]>([]);
    const [search, setSearch] = useState("");
    const [editingGenre, setEditingGenre] = useState<TheaterGenre | "new" | null>(null);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [viewingEntry, setViewingEntry] = useState<TheaterEntry | null>(null);
    const [confirmDeleteGenre, setConfirmDeleteGenre] = useState<TheaterGenre | null>(null);
    const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<TheaterEntry | null>(null);

    const refresh = useCallback(() => {
        setGenres(loadTheaterGenres());
        setEntries(loadTheaterEntries());
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    // 从聊天卡片点进来：直接跳去看那条剧场
    useEffect(() => {
        if (!openEntryId) return;
        const entry = loadTheaterEntries().find(e => e.id === openEntryId);
        if (entry) {
            setEntries(loadTheaterEntries());
            setViewingEntry(entry);
            setTab("entries");
        }
        onOpenEntryConsumed?.();
    }, [openEntryId, onOpenEntryConsumed]);

    const enabledGenres = useMemo(() => genres.filter(g => g.enabled), [genres]);

    const filteredGenres = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return genres;
        return genres.filter(g => g.title.toLowerCase().includes(q) || g.setting.toLowerCase().includes(q));
    }, [genres, search]);

    const filteredEntries = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter(e => e.title.toLowerCase().includes(q) || e.genreTitle.toLowerCase().includes(q));
    }, [entries, search]);

    const handleToggleGenre = (genre: TheaterGenre) => {
        updateTheaterGenre(genre.id, { enabled: !genre.enabled });
        refresh();
    };

    const handleDeleteGenre = () => {
        if (!confirmDeleteGenre) return;
        removeTheaterGenre(confirmDeleteGenre.id);
        setConfirmDeleteGenre(null);
        refresh();
    };

    const handleDeleteEntry = () => {
        if (!confirmDeleteEntry) return;
        removeTheaterEntry(confirmDeleteEntry.id);
        setConfirmDeleteEntry(null);
        refresh();
    };

    if (viewingEntry) {
        return (
            <TheaterViewer
                entry={viewingEntry}
                onClose={() => setViewingEntry(null)}
                onDeleted={() => { setViewingEntry(null); refresh(); }}
            />
        );
    }

    return (
        <div className="theater-app">
            <div className="theater-app-header">
                <button type="button" className="theater-app-header-btn" onClick={onClose} aria-label="返回">
                    <ChevronLeft size={22} />
                </button>
                <div className="theater-app-header-title">
                    <Drama size={18} strokeWidth={2} />
                    <span>Small Theater 小剧场</span>
                </div>
                <button
                    type="button"
                    className="theater-app-header-btn theater-app-header-btn-action"
                    onClick={() => tab === "genres" ? setEditingGenre("new") : setShowGenerateModal(true)}
                    aria-label={tab === "genres" ? "新增题材" : "新建剧场"}
                >
                    <Plus size={20} />
                </button>
            </div>

            <div className="theater-app-search">
                <Search size={15} />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={tab === "genres" ? "搜索题材" : "搜索剧场标题或题材"}
                />
                <span className="theater-app-search-count">{tab === "genres" ? genres.length : entries.length}</span>
            </div>

            <div className="theater-app-body">
                {tab === "genres" ? (
                    filteredGenres.length === 0 ? (
                        <div className="theater-app-empty">还没有题材，点右上角「+」新建一个吧。</div>
                    ) : (
                        <div className="theater-genre-list">
                            {filteredGenres.map(genre => (
                                <div key={genre.id} className="theater-genre-row">
                                    <div className="theater-genre-row-main" onClick={() => setEditingGenre(genre)}>
                                        <div className="theater-genre-row-title">{genre.title}</div>
                                        <div className="theater-genre-row-sub">
                                            {THEATER_STYLE_LABELS[genre.styleKey]}
                                            {genre.builtIn ? " · 内置" : " · 自定义"}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="theater-icon-btn"
                                        onClick={() => setEditingGenre(genre)}
                                        aria-label="编辑题材"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className="theater-icon-btn theater-icon-btn-danger"
                                        onClick={() => setConfirmDeleteGenre(genre)}
                                        aria-label={genre.builtIn ? "停用题材" : "删除题材"}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <Toggle checked={genre.enabled} onChange={() => handleToggleGenre(genre)} />
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    filteredEntries.length === 0 ? (
                        <div className="theater-app-empty">
                            还没有生成过剧场，点右上角「+」选一个题材开始吧。
                        </div>
                    ) : (
                        <div className="theater-entry-list">
                            {filteredEntries.map(entry => (
                                <div key={entry.id} className="theater-entry-card" onClick={() => setViewingEntry(entry)}>
                                    <div className="theater-entry-card-head">
                                        <span className="theater-entry-card-genre">{entry.genreTitle}</span>
                                        <button
                                            type="button"
                                            className="theater-icon-btn theater-icon-btn-danger"
                                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteEntry(entry); }}
                                            aria-label="删除剧场"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                    <div className="theater-entry-card-title">{entry.title}</div>
                                    <div className="theater-entry-card-summary">{entry.summary}</div>
                                    <div className="theater-entry-card-meta">
                                        <Clock3 size={12} />
                                        <span>{new Date(entry.createdAt).toLocaleString()}</span>
                                        {entry.characterName ? <span>· {entry.characterName}</span> : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            <div className="theater-app-tabbar">
                <button
                    type="button"
                    className="theater-app-tabbar-btn"
                    data-active={tab === "genres" || undefined}
                    onClick={() => setTab("genres")}
                >
                    题材管理
                </button>
                <button
                    type="button"
                    className="theater-app-tabbar-btn"
                    data-active={tab === "entries" || undefined}
                    onClick={() => setTab("entries")}
                >
                    剧场存放
                </button>
            </div>

            {editingGenre && (
                <TheaterGenreEditor
                    genre={editingGenre === "new" ? null : editingGenre}
                    onClose={() => setEditingGenre(null)}
                    onSaved={() => { setEditingGenre(null); refresh(); }}
                />
            )}

            {showGenerateModal && (
                <TheaterGenerateModal
                    genres={enabledGenres}
                    onClose={() => setShowGenerateModal(false)}
                    onGenerated={(entry) => {
                        setShowGenerateModal(false);
                        refresh();
                        setViewingEntry(entry);
                    }}
                />
            )}

            {confirmDeleteGenre && (
                <ConfirmDialog
                    title={confirmDeleteGenre.builtIn ? "停用题材？" : "删除题材？"}
                    message={confirmDeleteGenre.builtIn ? "内置题材不能删除，会先停用，之后可以再打开。" : "删除后无法恢复，已生成的剧场不受影响。"}
                    variant="danger"
                    confirmLabel={confirmDeleteGenre.builtIn ? "停用" : "删除"}
                    onConfirm={handleDeleteGenre}
                    onCancel={() => setConfirmDeleteGenre(null)}
                />
            )}

            {confirmDeleteEntry && (
                <ConfirmDialog
                    title="删除这个剧场？"
                    message="删除后无法恢复。"
                    variant="danger"
                    confirmLabel="删除"
                    onConfirm={handleDeleteEntry}
                    onCancel={() => setConfirmDeleteEntry(null)}
                />
            )}
        </div>
    );
}
