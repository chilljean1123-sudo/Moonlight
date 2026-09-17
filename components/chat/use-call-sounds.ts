import { useEffect, useRef } from "react";
import { loadChatSessions } from "@/lib/chat-storage";
import { playChatSound, setCallSoundActive } from "@/lib/chat-sounds";
export function useCallSounds(sessionId: string, state: string, initiator: string) {
    const ended = useRef(false);
    useEffect(() => {
        setCallSoundActive(sessionId, true);
        return () => setCallSoundActive(sessionId, false);
    }, [sessionId]);
    useEffect(() => {
        const sounds = loadChatSessions().find(s => s.id === sessionId)?.sounds;
        if (state === "CONNECTING") return playChatSound(initiator === "character" ? "incoming" : "outgoing", sounds, true);
        if (state === "ENDED" && !ended.current) { ended.current = true; return playChatSound("hangup", sounds); }
    }, [sessionId, state, initiator]);
}
