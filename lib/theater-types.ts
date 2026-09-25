// lib/theater-types.ts — 小剧场（Small Theater）数据模型

/** 题材对应的生成/互动风格族：决定 theater-engine 用哪套 prompt 指令 */
export type TheaterStyleKey =
    | "forum"        // 论坛/贴吧讨论串
    | "xiaohongshu"   // 小红书笔记+评论
    | "chatlog"       // 聊天记录截图风格
    | "douyin"        // 抖音视频+评论区
    | "checkphone"    // 查/反查手机记录
    | "memo"          // 备忘录/便签
    | "generic";      // 无匹配风格时的通用兜底

export const THEATER_STYLE_LABELS: Record<TheaterStyleKey, string> = {
    forum: "论坛/贴吧",
    xiaohongshu: "小红书",
    chatlog: "聊天记录",
    douyin: "抖音",
    checkphone: "查手机",
    memo: "备忘录",
    generic: "通用",
};

export type TheaterGenre = {
    id: string;
    title: string;
    styleKey: TheaterStyleKey;
    /** 题材设定：写给生成引擎的背景/侧重点说明 */
    setting: string;
    enabled: boolean;
    builtIn: boolean;
    createdAt: string;
};

export type TheaterEntry = {
    id: string;
    genreId: string;
    genreTitle: string;
    styleKey: TheaterStyleKey;
    title: string;
    setting: string;
    characterId?: string;
    characterName?: string;
    /** 生成的互动 HTML 正文（```html 代码块，交给 StoryHtmlRenderer 渲染） */
    html: string;
    /** 简短摘要：用于剧场存放列表预览 + 分享卡片 + 角色能"看到"的上下文 */
    summary: string;
    wordCount: number;
    createdAt: string;
    updatedAt: string;
};
