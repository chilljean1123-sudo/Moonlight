"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ChatSession } from "@/lib/chat-storage";
import type { Character } from "@/lib/character-types";
import { endVideoCall, getVideoCall, getServerVideoCall, minimizeVideoCall, startVideoCall, subscribeVideoCall, subscribeVideoCallEnd } from "@/lib/video-call-store";
import { VideoCallScreen } from "./video-call-screen";

// The launcher may unmount with its chat. The call itself belongs to the shell.
export function PersistentVideoCall({ session, character, initiator, onEnd, onBusy }: {
    session: ChatSession;
    character: Character;
    initiator: "user" | "character";
    onEnd: () => void;
    onBusy: () => void;
}) {
    const callbacks = useRef({ onEnd, onBusy });
    callbacks.current = { onEnd, onBusy };
    useEffect(() => {
        const unsubscribe = subscribeVideoCallEnd(id => {
            if (id === session.id) callbacks.current.onEnd();
        });
        if (!startVideoCall(session, character, initiator)) {
            alert("当前视频通话尚未结束，请先返回小窗挂断");
            callbacks.current.onBusy();
        }
        return unsubscribe;
    // Keep a call's original identity and state throughout chat re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.id]);
    return null;
}

export function PersistentVideoCallHost() {
    const call = useSyncExternalStore(subscribeVideoCall, getVideoCall, getServerVideoCall);
    if (!call) return null;
    return <div className="persistent-video-call-layer" data-minimized={call.minimized}>
        <VideoCallScreen
            key={call.id}
            session={call.session}
            character={call.character}
            initiator={call.initiator}
            minimized={call.minimized}
            onMinimize={() => minimizeVideoCall(true)}
            onRestore={() => minimizeVideoCall(false)}
            onEnd={() => endVideoCall(call.id)}
        />
    </div>;
}
