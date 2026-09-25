"use client";

import { useState } from "react";
import { ChevronLeft, Share2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/modal";
import { StoryHtmlRenderer } from "@/components/ui/story-html-renderer";
import { removeTheaterEntry } from "@/lib/theater-storage";
import type { TheaterEntry } from "@/lib/theater-types";
import type { TheaterChatSharePayload } from "@/lib/chat-share";

export function TheaterViewer({
    entry,
    onClose,
    onDeleted,
}: {
    entry: TheaterEntry;
    onClose: () => void;
    onDeleted: () => void;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleShare = () => {
        const share: TheaterChatSharePayload = {
            type: "theater",
            entryId: entry.id,
            title: entry.title,
            genreTitle: entry.genreTitle,
            summary: entry.summary,
        };
        window.dispatchEvent(new CustomEvent("open-mini-chat", { detail: { share } }));
    };

    const handleDelete = () => {
        removeTheaterEntry(entry.id);
        setConfirmDelete(false);
        onDeleted();
    };

    return (
        <div className="theater-app">
            <div className="theater-app-header">
                <button type="button" className="theater-app-header-btn" onClick={onClose} aria-label="返回">
                    <ChevronLeft size={22} />
                </button>
                <div className="theater-app-header-title theater-app-header-title-ellipsis">{entry.title}</div>
                <div className="theater-app-header-actions">
                    <button type="button" className="theater-app-header-btn" onClick={handleShare} aria-label="分享到聊天">
                        <Share2 size={18} />
                    </button>
                    <button type="button" className="theater-app-header-btn theater-app-header-btn-danger" onClick={() => setConfirmDelete(true)} aria-label="删除">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="theater-viewer-body">
                <div className="theater-viewer-meta">
                    <span className="theater-viewer-genre">{entry.genreTitle}</span>
                    {entry.characterName ? <span>· {entry.characterName}</span> : null}
                    <span>· {new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                <StoryHtmlRenderer content={entry.html} messageId={entry.id} htmlPageMode="contained" />
            </div>

            {confirmDelete && (
                <ConfirmDialog
                    title="删除这个剧场？"
                    message="删除后无法恢复。"
                    variant="danger"
                    confirmLabel="删除"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(false)}
                />
            )}
        </div>
    );
}
