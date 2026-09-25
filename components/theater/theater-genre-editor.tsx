"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/form";
import { addTheaterGenre, updateTheaterGenre } from "@/lib/theater-storage";
import { THEATER_STYLE_LABELS, type TheaterGenre, type TheaterStyleKey } from "@/lib/theater-types";

const STYLE_OPTIONS = Object.entries(THEATER_STYLE_LABELS) as [TheaterStyleKey, string][];

export function TheaterGenreEditor({
    genre,
    onClose,
    onSaved,
}: {
    genre: TheaterGenre | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [title, setTitle] = useState(genre?.title || "");
    const [styleKey, setStyleKey] = useState<TheaterStyleKey>(genre?.styleKey || "forum");
    const [setting, setSetting] = useState(genre?.setting || "");
    const [error, setError] = useState("");

    const handleSave = () => {
        if (!title.trim()) {
            setError("请填写剧场标题/题材名称");
            return;
        }
        if (genre) {
            updateTheaterGenre(genre.id, { title: title.trim(), styleKey, setting: setting.trim() });
        } else {
            addTheaterGenre({ title: title.trim(), styleKey, setting: setting.trim() });
        }
        onSaved();
    };

    return (
        <BottomSheet title={genre ? "编辑题材" : "新增题材"} onClose={onClose} onDone={handleSave}>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <label className="menu-desc ml-1">剧场标题</label>
                    <Input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="例如：茶水间八卦局"
                        disabled={genre?.builtIn}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="menu-desc ml-1">互动风格</label>
                    <Select value={styleKey} onChange={e => setStyleKey(e.target.value as TheaterStyleKey)} disabled={genre?.builtIn}>
                        {STYLE_OPTIONS.map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </Select>
                    <span className="menu-desc ml-1">决定生成页会做成哪种平台的互动样式（论坛/小红书/聊天记录等）。</span>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="menu-desc ml-1">题材设定</label>
                    <Textarea
                        value={setting}
                        onChange={e => setSetting(e.target.value)}
                        placeholder="写清楚这个题材围绕什么展开、有什么侧重点，生成时会作为背景设定交给 AI。"
                        rows={6}
                    />
                </div>
                {error && <span className="menu-desc" style={{ color: "var(--c-danger)" }}>{error}</span>}
                {genre?.builtIn && (
                    <span className="menu-desc ml-1">内置题材的标题/风格不可改，只能调整题材设定。</span>
                )}
            </div>
        </BottomSheet>
    );
}
