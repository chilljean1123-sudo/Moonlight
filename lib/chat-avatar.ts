import { loadChatSessions, saveChatSessions, pushChatMessage, CHAT_REQUEST_REPLY_EVENT } from "./chat-storage";
import { loadCharacters, saveCharacters } from "./character-storage";
import { resolveUserIdentity } from "./settings-storage";
import { getChatImageFromIndexedDB } from "./chat-asset-storage";
export function requestAvatarReply(sessionId: string) {
    window.dispatchEvent(new CustomEvent(CHAT_REQUEST_REPLY_EVENT, { detail: { sessionId } }));
}
export function notifyAvatarChange(identityId: string, avatar: string) {
    for (const session of loadChatSessions()) {
        if (session.isGroup || session.isBlacklisted || session.avatarReaction === false || resolveUserIdentity(session.contactId, "chat")?.id !== identityId) continue;
        pushChatMessage({ sessionId: session.id, role: "user", content: "[头像更新] 我换了新的头像。请根据你的人设自然回应；只有实际能看到图片时才描述图片细节。", mediaType: "image", mediaUrl: avatar });
        requestAvatarReply(session.id);
    }
}
export function avatarPrompt(sessionId: string): string {
    const session = loadChatSessions().find(s => s.id === sessionId);
    if (!session?.suggestedAvatar || session.isGroup) return "";
    return `\n用户给你推荐了一张头像（见聊天图片）。根据你自己的性格、喜好和用户的要求，自行决定是否换头像，可以拒绝或提出要求。若同意，输出 <avatar-choice id="${session.suggestedAvatar}">accept</avatar-choice>；若拒绝，输出 <avatar-choice id="${session.suggestedAvatar}">reject</avatar-choice>。该标记会执行真实头像更换且不会作为对话展示。不要编造看不到的图片细节。\n`;
}
export async function applyAvatarChoice(text: string, sessionId: string): Promise<string> {
    const pattern = /<avatar-choice id="([^"]+)">\s*(accept|reject)\s*<\/avatar-choice>/g;
    for (const match of text.matchAll(pattern)) {
        const session = loadChatSessions().find(s => s.id === sessionId);
        if (!session || session.isGroup || session.suggestedAvatar !== match[1]) continue;
        if (match[2] === "accept") {
            const url = await getChatImageFromIndexedDB(match[1]);
            if (!url) continue;
            // Re-check after asynchronous storage reads: a newer recommendation wins.
            if (loadChatSessions().find(s => s.id === sessionId)?.suggestedAvatar !== match[1]) continue;
            const chars = loadCharacters();
            const character = chars.find(c => c.id === session.contactId);
            if (!character) continue;
            character.avatar = url;
            saveCharacters(chars);
            pushChatMessage({ sessionId, role: "system", content: `${character.name}更换了头像` });
            window.dispatchEvent(new Event("chat-avatar-updated"));
        }
        saveChatSessions(loadChatSessions().map(s => s.id === sessionId ? { ...s, suggestedAvatar: undefined } : s));
    }
    return text.replace(pattern, "");
}
