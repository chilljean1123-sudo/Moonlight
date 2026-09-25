"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { loadCharacters } from "@/lib/character-storage";
import { generateTheaterEntry } from "@/lib/theater-engine";
import type { TheaterEntry, TheaterGenre } from "@/lib/theater-types";

export function TheaterGenerateModal({
    genres,
    onClose,
    onGenerated,
}: {
    genres: TheaterGenre[];
    onClose: () => void;
    onGenerated: (entry: TheaterEntry) => void;
}) {
    const characters = useMemo(() => loadCharacters(), []);
    const [genreId, setGenreId] = useState(genres[0]?.id || "");
    const genre = genres.find(g => g.id === genreId) || null;
    const [title, setTitle] = useState(genre?.title || "");
    const [setting, setSetting] = useState("");
    const [characterId, setCharacterId] = useState(characters[0]?.id || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const handleGenreChange = (id: string) => {
        setGenreId(id);
        const next = genres.find(g => g.id === id);
        if (next && (!title.trim() || title === genre?.title)) setTitle(next.title);
    };

    const handleGenerate = async () => {
        if (!genre) { setError("请先选一个题材"); return; }
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            const entry = await generateTheaterEntry({
                genre,
                title,
                setting,
                characterId: characterId || undefined,
            });
            onGenerated(entry);
        } catch (err) {
            setError(err instanceof Error ? err.message : "生成失败，请重试");
        } finally {
            setBusy(false);
        }
    };

    if (genres.length === 0) {
        return (
            <BottomSheet title="新建剧场" onClose={onClose}>
                <div className="theater-app-empty">
                    没有已开启的题材。先去「题材管理」里开启或新建一个题材吧。
                </div>
            </BottomSheet>
        );
    }

    return (
        <BottomSheet title="新建剧场" onClose={busy ? () => {} : onClose} onDone={busy ? undefined : handleGenerate}>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <label className="menu-desc ml-1">题材</label>
                    <Select value={genreId} onChange={e => handleGenreChange(e.target.value)} disabled={busy}>
                        {genres.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="menu-desc ml-1">剧场标题</label>
                    <Input type="text" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="menu-desc ml-1">补充设定（可选）</label>
                    <Textarea
                        value={setting}
                        onChange={e => setSetting(e.target.value)}
                        placeholder="这次想让内容围绕什么具体的事展开？留空就只用题材自带的设定。"
                        rows={4}
                        disabled={busy}
                    />
                </div>
                {characters.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <label className="menu-desc ml-1">关联角色（可选）</label>
                        <Select value={characterId} onChange={e => setCharacterId(e.target.value)} disabled={busy}>
                            <option value="">不指定</option>
                            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                        <span className="menu-desc ml-1">指定角色会把 TA 的人设写进生成内容，也决定用哪个绑定的 API 配置。</span>
                    </div>
                )}
                {error && (
                    <Alert variant="danger">{error}</Alert>
                )}
                {busy && (
                    <div className="theater-generating-hint">
                        <Loader2 size={16} className="animate-spin" />
                        <span>正在生成，内容较长可能要一会儿……</span>
                    </div>
                )}
            </div>
        </BottomSheet>
    );
}
