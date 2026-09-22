import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy-fetch";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_FISHAUDIO_BASE_URL = "https://api.fish.audio";
const MAX_AUDIO_SIZE = 20 * 1024 * 1024;

function normalizeBaseUrl(value: unknown): string {
    const raw = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_FISHAUDIO_BASE_URL;
    return raw.replace(/\/$/, "");
}

function fieldText(form: FormData, key: string): string {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
}

function getRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export async function POST(request: Request) {
    try {
        return await handleClone(request);
    } catch (err) {
        // 出网失败(本地 dev 需代理)/表单解析失败等都带上原因返回，不裸抛 500。
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: "clone_failed", message: message.slice(0, 500) }, { status: 502 });
    }
}

async function handleClone(request: Request) {
    const form = await request.formData();
    const apiKey = fieldText(form, "apiKey");
    const baseUrl = normalizeBaseUrl(fieldText(form, "baseUrl"));
    const title = fieldText(form, "title");
    const audio = form.get("audio");

    if (!apiKey) return NextResponse.json({ error: "missing_api_key" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "missing_title" }, { status: 400 });
    if (!(audio instanceof File)) return NextResponse.json({ error: "missing_audio" }, { status: 400 });
    if (audio.size <= 0 || audio.size > MAX_AUDIO_SIZE) {
        return NextResponse.json({ error: "invalid_audio_size" }, { status: 400 });
    }

    const upstreamForm = new FormData();
    upstreamForm.set("type", "tts");
    upstreamForm.set("visibility", "private");
    upstreamForm.set("train_mode", "fast");
    upstreamForm.set("title", title);
    upstreamForm.set("enhance_audio_quality", "true");
    upstreamForm.append("voices", audio, audio.name || "voice-sample.mp3");

    const response = await proxyFetch(`${baseUrl}/model`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: upstreamForm,
    });

    const text = await response.text();
    let data: unknown = null;
    try {
        data = JSON.parse(text);
    } catch {
        // fall through, upstream returned non-JSON
    }

    const record = getRecord(data);
    if (!response.ok || !data) {
        const message = String(record.message || record.detail || text || `HTTP ${response.status}`);
        return NextResponse.json({ error: "clone_failed", message: message.slice(0, 500) }, { status: 502 });
    }

    const id = record._id ?? record.id;
    if (typeof id !== "string" || !id.trim()) {
        return NextResponse.json({ error: "missing_voice_id", message: text.slice(0, 500) }, { status: 502 });
    }

    return NextResponse.json({ ok: true, id: id.trim(), state: typeof record.state === "string" ? record.state : "" });
}
