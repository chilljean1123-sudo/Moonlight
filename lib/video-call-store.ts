import type { ChatSession } from "./chat-storage";
import type { Character } from "./character-types";

type VideoCall = {
    id: string;
    session: ChatSession;
    character: Character;
    initiator: "user" | "character";
    minimized: boolean;
};
let current: VideoCall | null = null;
const listeners = new Set<() => void>();
const endedListeners = new Set<(sessionId: string) => void>();
const emit = () => { listeners.forEach(listener => listener()); };
export const getVideoCall = () => current;
export const getServerVideoCall = () => null;
export function subscribeVideoCall(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export function subscribeVideoCallEnd(listener: (sessionId: string) => void) {
    endedListeners.add(listener);
    return () => { endedListeners.delete(listener); };
}
export function startVideoCall(session: ChatSession, character: Character, initiator: "user" | "character") {
    // Re-rendering or reopening a chat must never restart a running call.
    if (current) return current.session.id === session.id;
    current = { id: crypto.randomUUID(), session: { ...session }, character: { ...character }, initiator, minimized: false };
    emit();
    return true;
}
export function minimizeVideoCall(minimized: boolean) {
    if (!current || current.minimized === minimized) return;
    current = { ...current, minimized };
    emit();
}
export function endVideoCall(id: string) {
    if (!current || current.id !== id) return;
    const sessionId = current.session.id;
    current = null;
    emit();
    endedListeners.forEach(listener => listener(sessionId));
}
