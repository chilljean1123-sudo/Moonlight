export type MusicChatSharePayload = {
    type: "music";
    title: string;
    artist: string;
};

export type XiaohongshuNoteChatSharePayload = {
    type: "xiaohongshu_note";
    authorName: string;
    title: string;
    body: string;
    description?: string;
    noteType: "post" | "video";
    tags?: string[];
    imageAssetId?: string;
    coverIcon?: string;
    tone?: string;
};

export type TheaterChatSharePayload = {
    type: "theater";
    entryId: string;
    title: string;
    genreTitle: string;
    summary: string;
};

export type ChatSharePayload = MusicChatSharePayload | XiaohongshuNoteChatSharePayload | TheaterChatSharePayload;

function compactShareText(value: string | undefined, fallback: string): string {
    const text = (value || "").replace(/\s+/g, " ").trim();
    return text || fallback;
}

export function formatXiaohongshuShareForPrompt(input: {
    author?: string;
    title?: string;
    body?: string;
    description?: string;
}): string {
    const author = compactShareText(input.author, "未知作者");
    const title = compactShareText(input.title, "无标题");
    const body = compactShareText(input.body, "无正文内容");
    const description = compactShareText(input.description, "");
    return `分享了一条小红书帖子，作者：${author}, 标题：${title}, 正文内容：${body}，图片/视频描述：${description || "无"}`;
}

export function formatTheaterShareForPrompt(input: {
    genreTitle?: string;
    title?: string;
    summary?: string;
}): string {
    const genreTitle = compactShareText(input.genreTitle, "小剧场");
    const title = compactShareText(input.title, "无标题");
    const summary = compactShareText(input.summary, "无摘要");
    return `分享了一个小剧场，题材：${genreTitle}，标题：${title}，内容摘要：${summary}`;
}
