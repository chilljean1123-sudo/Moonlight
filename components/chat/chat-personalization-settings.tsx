"use client";
import { useEffect, useState } from "react";
import { ChatSession, loadChatSessions, saveChatSessions, pushChatMessage } from "@/lib/chat-storage";
import { soundLabels, SoundSettings, SoundKind, loadGlobalSounds, saveGlobalSounds, playChatSound } from "@/lib/chat-sounds";
import { saveChatImageToIndexedDB } from "@/lib/chat-asset-storage";
import { loadUserIdentities, saveUserIdentities, resolveUserIdentity } from "@/lib/settings-storage";
import { loadCharacters, saveCharacters } from "@/lib/character-storage";
import { requestAvatarReply } from "@/lib/chat-avatar";

export function ChatPersonalizationSettings({ session }: { session: ChatSession }) {
    const [global, setGlobal] = useState(false);
    const [sounds, setSounds] = useState(session.sounds || {});
    const [globalSounds, setGlobalSounds] = useState(loadGlobalSounds);
    const [reaction, setReaction] = useState(session.avatarReaction !== false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [stopPreview, setStopPreview] = useState<(() => void) | null>(null);
    useEffect(() => () => { stopPreview?.(); }, [stopPreview]);
    const update = (patch: Partial<ChatSession>) => {
        saveChatSessions(loadChatSessions().map(s => s.id === session.id ? { ...s, ...patch } : s));
        Object.assign(session, patch);
    };
    const current = global ? globalSounds : sounds;
    const change = (kind: SoundKind, value: SoundSettings[SoundKind]) => {
        const next = { ...current, [kind]: value };
        if (global) { setGlobalSounds(next); saveGlobalSounds(next); }
        else { setSounds(next); update({ sounds: next }); }
    };
    const uploadSound = async (kind: SoundKind, file?: File) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024 || (file.type && !file.type.startsWith("audio/"))) { setError("请选择不超过 10 MB 的音频文件"); return; }
        setBusy(true); setError("");
        try { const asset = await saveChatImageToIndexedDB(file); change(kind, { mode: "custom", asset, name: file.name }); }
        catch { setError("音频保存失败，请重试"); } finally { setBusy(false); }
    };
    const uploadAvatar = async (target: "self" | "character" | "recommend", file?: File) => {
        if (!file) return;
        if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) { setError("请选择不超过 10 MB 的图片"); return; }
        setBusy(true); setError("");
        try {
            const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
            if (target === "self") {
                const identity = resolveUserIdentity(session.contactId, "chat");
                if (!identity) throw new Error("请先在用户设定中创建身份");
                saveUserIdentities(loadUserIdentities().map(i => i.id === identity.id ? { ...i, avatarUrl: url } : i));
            } else if (target === "character") {
                saveCharacters(loadCharacters().map(c => c.id === session.contactId ? { ...c, avatar: url } : c));
                update({ suggestedAvatar: undefined });
            } else {
                const asset = await saveChatImageToIndexedDB(file);
                update({ suggestedAvatar: asset });
                pushChatMessage({ sessionId: session.id, role: "user", content: "推荐你用这张图片做头像，你可以按照自己的喜好决定，也可以提出要求。", mediaType: "image", mediaUrl: url });
                requestAvatarReply(session.id);
            }
            window.dispatchEvent(new Event("chat-avatar-updated"));
        } catch (err) { setError(err instanceof Error ? err.message : "头像保存失败，请重试"); }
        finally { setBusy(false); }
    };
    return <section className="menu-group" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}><strong>消息与通话音效</strong><select disabled={busy} aria-label="音效设置范围" value={global ? "global" : "character"} onChange={e => setGlobal(e.target.value === "global")}><option value="character">角色专属</option><option value="global">全局音效</option></select></div>
        {(Object.keys(soundLabels) as SoundKind[]).map(kind => <div key={kind} style={{ padding: "12px 0", borderBottom: "1px solid var(--c-border, #eee)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span>{soundLabels[kind]}</span><select disabled={busy} aria-label={soundLabels[kind]} value={current[kind]?.mode || (global ? "off" : "global")} onChange={e => change(kind, { ...current[kind], mode: e.target.value as "global" | "custom" | "off" })}>{!global && <option value="global">全局</option>}<option value="custom">{global ? "开启" : "专属"}</option><option value="off">关闭</option></select></div>
            {current[kind]?.mode === "custom" && <div style={{ marginTop: 10 }}><label style={{ cursor: "pointer" }}>{current[kind]?.name || "选择音频文件"}<input disabled={busy} type="file" accept="audio/*" className="hidden" onChange={e => { void uploadSound(kind, e.target.files?.[0]); e.target.value = ""; }} /></label>{current[kind]?.asset && <button type="button" style={{ marginLeft: 12 }} onClick={() => { stopPreview?.(); setStopPreview(() => playChatSound(kind, current)); }}>试听</button>}</div>}
        </div>)}
        {!session.isGroup && <div style={{ marginTop: 20 }}><strong>设置头像</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 16, margin: "16px 0" }}>{([["self", "我的头像"], ["character", "对方头像"], ["recommend", "推荐对方换头像"]] as const).map(([target, label]) => <label key={target} style={{ cursor: "pointer" }}>{label}<input disabled={busy} type="file" accept="image/*" className="hidden" onChange={e => { void uploadAvatar(target, e.target.files?.[0]); e.target.value = ""; }} /></label>)}</div><label style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>我换头像后希望对方做出反应<input type="checkbox" checked={reaction} onChange={e => { setReaction(e.target.checked); update({ avatarReaction: e.target.checked }); }} /></label></div>}
        {error && <p role="alert" style={{ color: "var(--c-danger)", marginTop: 12 }}>{error}</p>}
    </section>;
}
