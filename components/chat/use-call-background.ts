import { useEffect, useState } from "react";
import { loadChatSessions } from "@/lib/chat-storage";
import { getChatImageFromIndexedDB } from "@/lib/chat-asset-storage";
export function useCallBackground(sessionId: string, field: "voiceBackground" | "videoBackground", fallback?: string) {
    const [image, setImage] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        const value = loadChatSessions().find(s => s.id === sessionId)?.[field] ?? fallback;
        setImage(null);
        if (value) {
            const result = /^(data:|blob:|https?:|\/)/.test(value) ? Promise.resolve(value) : getChatImageFromIndexedDB(value);
            void result.then(url => { if (!cancelled) setImage(url); }).catch(() => { if (!cancelled) setImage(null); });
        }
        return () => { cancelled = true; };
    }, [sessionId, field, fallback]);
    return image;
}
