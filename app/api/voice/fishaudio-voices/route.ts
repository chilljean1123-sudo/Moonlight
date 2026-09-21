import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy-fetch";

export const runtime = "nodejs";
export const maxDuration = 15;

const DEFAULT_FISHAUDIO_BASE_URL = "https://api.fish.audio";

const STATE_LABELS: Record<string, string> = {
    created: "已创建",
    training: "训练中",
    failed: "训练失败",
};

function normalizeBaseUrl(value: unknown): string {
    const raw = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_FISHAUDIO_BASE_URL;
    return raw.replace(/\/$/, "");
}

function getRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function voiceName(item: Record<string, unknown>): string {
    const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : "未命名音色";
    const state = typeof item.state === "string" ? item.state : "";
    const stateLabel = STATE_LABELS[state];
    return stateLabel ? `${title}（${stateLabel}）` : title;
}

export async function POST(request: Request) {
    try {
        return await handleGetVoices(request);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: "get_voice_failed", message: message.slice(0, 500) }, { status: 502 });
    }
}

async function handleGetVoices(request: Request) {
    const body = await request.json().catch(() => ({}));
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const baseUrl = normalizeBaseUrl(body.baseUrl);

    if (!apiKey) return NextResponse.json({ error: "missing_api_key" }, { status: 400 });

    const response = await proxyFetch(
        `${baseUrl}/model?self=true&page_size=100&sort_by=created_at`,
        { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } },
    );

    const text = await response.text();
    let data: unknown = null;
    try {
        data = JSON.parse(text);
    } catch {
        return NextResponse.json({ error: "upstream_not_json", message: text.slice(0, 500) }, { status: 502 });
    }

    const root = getRecord(data);
    if (!response.ok) {
        const message = String(root.message || root.detail || text || `HTTP ${response.status}`);
        return NextResponse.json({ error: "get_voice_failed", message: message.slice(0, 500) }, { status: 502 });
    }

    const items = Array.isArray(root.items) ? root.items : [];
    const voices = items.flatMap(item => {
        const record = getRecord(item);
        const id = record._id ?? record.id;
        if (typeof id !== "string" || !id.trim()) return [];
        return [{ id: id.trim(), name: voiceName(record) }];
    });

    return NextResponse.json({ ok: true, voices });
}
