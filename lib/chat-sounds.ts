import { kvGet, kvSet } from "./kv-db";
import { getChatImageFromIndexedDB } from "./chat-asset-storage";
const activeCalls = new Set<string>();
export function setCallSoundActive(sessionId: string, active: boolean) { if (active) activeCalls.add(sessionId); else activeCalls.delete(sessionId); }
export function isCallSoundActive(sessionId: string) { return activeCalls.has(sessionId); }
export const soundLabels = { receive: "新消息音效", send: "发送消息音效", incoming: "来电音效", outgoing: "致电音效", hangup: "挂断音效" };
export type SoundKind = keyof typeof soundLabels;
export type SoundSetting = { mode: "global" | "custom" | "off"; asset?: string; name?: string };
export type SoundSettings = Partial<Record<SoundKind, SoundSetting>>;
export function loadGlobalSounds(): SoundSettings { try { return JSON.parse(kvGet("chat-sounds") || "{}"); } catch { return {}; } }
export function saveGlobalSounds(value: SoundSettings) { kvSet("chat-sounds", JSON.stringify(value)); }
export function playChatSound(kind: SoundKind, settings?: SoundSettings, loop = false): () => void {
    let stopped = false;
    let audio: HTMLAudioElement | undefined;
    const local = settings?.[kind];
    const selected = !local || local.mode === "global" ? loadGlobalSounds()[kind] : local;
    if (selected?.mode !== "custom" || !selected.asset) return () => {};
    void getChatImageFromIndexedDB(selected.asset).then(url => {
        if (stopped || !url) return;
        audio = new Audio(url); audio.loop = loop;
        void audio.play().catch(() => {});
    }).catch(() => {});
    return () => { stopped = true; if (audio) { audio.pause(); audio.src = ""; } };
}
