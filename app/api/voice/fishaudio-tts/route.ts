import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy-fetch";

export const runtime = "nodejs";
// 长文本合成可能耗时较久，参照 image-generation 路由给足时间。
export const maxDuration = 120;

const DEFAULT_FISHAUDIO_BASE_URL = "https://api.fish.audio";
const FISHAUDIO_SPEED_MIN = 0.5;
const FISHAUDIO_SPEED_MAX = 2.0;

function normalizeBaseUrl(value: unknown): string {
    const raw = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_FISHAUDIO_BASE_URL;
    return raw.replace(/\/$/, "");
}

// 手机中文输入法打模型 ID / Voice ID 时，句点、连字符等标点常被自动转成看起来
// 一模一样、实际是全角的字符（U+FF01-FF5E，以及全角空格 U+3000）——这里先转回半角，
// 而不是让用户去猜是哪个字符打错了。
function normalizeFullwidthAscii(value: string): string {
    return value.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/　/g, " ");
}

// 转换后仍可能剩下真正的中文/表情等无法放进请求头的字符——服务端 fetch 对请求头
// 字节范围的要求和浏览器一致，这里兜底校验，换成能看懂的提示。
function sanitizeHeaderValue(value: string): string | null {
    const normalized = normalizeFullwidthAscii(value);
    return /^[\u0000-ÿ]*$/.test(normalized) ? normalized : null;
}

export async function POST(request: Request) {
    try {
        return await handleTts(request);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: "tts_failed", message: message.slice(0, 500) }, { status: 502 });
    }
}

async function handleTts(request: Request) {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const apiKeyRaw = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const modelRaw = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "s1";
    const text = typeof body.text === "string" ? body.text : "";
    const baseUrl = normalizeBaseUrl(body.baseUrl);
    const referenceIdRaw = typeof body.referenceId === "string" ? body.referenceId.trim() : "";
    const speedRaw = typeof body.speed === "number" && Number.isFinite(body.speed) ? body.speed : undefined;

    if (!apiKeyRaw) return NextResponse.json({ error: "missing_api_key" }, { status: 400 });
    if (!text.trim()) return NextResponse.json({ error: "missing_text" }, { status: 400 });

    const apiKey = sanitizeHeaderValue(apiKeyRaw);
    if (!apiKey) return NextResponse.json({ error: "invalid_api_key", message: "Fish Audio API Key 里有无法放进请求头的字符" }, { status: 400 });
    const model = sanitizeHeaderValue(modelRaw);
    if (!model) {
        return NextResponse.json(
            { error: "invalid_model", message: "语音模型 (Model) 里有无法放进请求头的字符（比如中文/全角符号），请改成英文/数字，例如 s1" },
            { status: 400 },
        );
    }
    const referenceId = referenceIdRaw ? normalizeFullwidthAscii(referenceIdRaw) : "";
    const speed = speedRaw === undefined ? undefined : Math.min(FISHAUDIO_SPEED_MAX, Math.max(FISHAUDIO_SPEED_MIN, speedRaw));

    const upstream = await proxyFetch(`${baseUrl}/v1/tts`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            model,
        },
        body: JSON.stringify({
            text,
            format: "mp3",
            mp3_bitrate: 128,
            normalize: true,
            latency: "normal",
            ...(referenceId ? { reference_id: referenceId } : {}),
            ...(speed !== undefined ? { prosody: { speed } } : {}),
        }),
    });

    if (!upstream.ok) {
        const errText = await upstream.text().catch(() => "");
        return NextResponse.json(
            { error: "tts_failed", message: `Fish Audio TTS 请求失败 (${upstream.status}): ${errText.slice(0, 300)}` },
            { status: 502 },
        );
    }

    const audio = await upstream.arrayBuffer();
    return new NextResponse(audio, {
        status: 200,
        headers: { "Content-Type": upstream.headers.get("content-type") || "audio/mpeg" },
    });
}
