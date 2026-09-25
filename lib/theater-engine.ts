// lib/theater-engine.ts — 小剧场：一次性调用 LLM 生成互动 HTML 剧场页面

import { loadCharacters } from "./character-storage";
import type { Character } from "./character-types";
import { ChatEngineError } from "./chat-engine";
import { simpleLLMCall } from "./api-helpers";
import { loadApiConfigs, loadBindingConfig, resolveBinding, resolveUserIdentity } from "./settings-storage";
import type { ApiConfig } from "./settings-types";
import { addTheaterEntry } from "./theater-storage";
import type { TheaterEntry, TheaterGenre, TheaterStyleKey } from "./theater-types";

/** 小剧场绑定走独立的 appId：设置 → 绑定管理 → 小剧场，指定用哪套 API 配置生成。 */
export const THEATER_BINDING_APP_ID = "theater";

export function resolveTheaterApiConfig(characterId?: string): ApiConfig {
    const bindings = loadBindingConfig();
    const slot = resolveBinding(bindings, characterId, THEATER_BINDING_APP_ID);
    if (!slot.apiConfigId) {
        throw new ChatEngineError("小剧场还没绑定 API 配置，请去设置 → 绑定管理 → 小剧场 指定一个。");
    }
    const apiConfig = loadApiConfigs().find(c => c.id === slot.apiConfigId);
    if (!apiConfig) throw new ChatEngineError("小剧场绑定的 API 配置已被删除，请重新绑定。");
    return apiConfig;
}

// ── 各题材风格的生成指令 ──
// forum 是旗舰示例，按用户给的 14 条互动规则逐条落实；其余题材给对应平台的
// 结构/语气侧重点。所有指令都要求：只用原生 HTML/CSS 实现交互（<details>
// 折叠、radio/checkbox 做投票选择），不依赖外部资源。

const FORUM_STYLE_PROMPT = `
请生成一个「贴吧/论坛讨论串」风格的完整可交互 HTML 页面（<html>...</html> 或至少一个自包含的根容器 + <style>），正文文字不少于 5000 字（不含 HTML 标签），围绕角色近期的传闻、偶遇、日常片段展开。必须包含以下全部互动机制，每一条都要有真实内容，不是摆样子：

1. 楼层排序：给每个楼层用 class 或角标标出类型——热评楼层（回复多，显著突出/置顶感）、普通楼层、低赞水楼（简短附和）、争议楼层（观点对立，明显冲突感）。热评楼层要视觉上更突出（比如强调色/边框/"热"字样徽章）。
2. 楼中楼嵌套回复：至少两处楼层下面有多级嵌套的追评/附和/对线/补充细节，缩进或视觉层级要体现嵌套关系。
3. 折叠/隐藏区块：至少 2-3 处用原生 <details><summary>折叠标题（如"点击查看完整聊天记录截图描述" "点击展开楼主原话"）</summary>正文内容</details> 包裹较长或敏感的内容，默认收起。
4. 双选项投票：至少一处嵌入投票模块（用 <input type="radio"> 配合 CSS :checked 选择器或简单原生 <script> 实现选择后显示结果比例的效果），选项要贴合讨论主题。
5. 随机路人插楼：穿插几个匿名感强的路人 ID（如"过路观众233" "萍水相逢"之类的网名），乱入发言打乱楼层顺序，制造真实刷帖临场感。
6. 楼主专属更新楼层：至少一条楼层明确标注"楼主更新"角标，内容是楼主追加的辟谣/新线索/新素材，风格与普通回复区分开。
7. 楼层热度标识：靠回复量/点赞数（可以是虚构的数字，比如"233 赞"）给每层做热度视觉分级。
8. 时间差发言：楼层时间戳跨度要体现早期首发、中途插楼、深夜补楼等不同时段，不能全部挤在同一时间。
9. 举报提醒层：一条独立楼层，内容是版务/管理员语气温和的劝导话术，提醒理性讨论、不要人身攻击。
10. 求素材楼：一条楼层是网友求线下偶遇记录/往期物料，楼中楼里有人分享"素材"（可以是文字描述的"我这有张照片"之类）。
11. 纠错补楼：一条独立楼层专门纠正前文的不实猜测，附带"佐证"（哪怕是虚构的旁证）。
12. 对比脑洞楼：网友发布私人轻度脑补，对比角色不同时期的状态，楼中楼里有人补充新旧素材差异。
13. 许愿脑洞楼：网友写下期待看到角色的日常片段，其他人附和或理性讨论可行性。
14. 歪楼娱乐楼层：至少一处穿插轻松闲聊/玩梗的楼层，短暂脱离主线，随后自然回归主线讨论。

视觉上做成暗色系贴吧/论坛的既视感（卡片式楼层、楼层号、用户名、时间戳、回复数），配色和字体可以自由发挥但要统一。`.trim();

const STYLE_PROMPTS: Record<TheaterStyleKey, string> = {
    forum: FORUM_STYLE_PROMPT,
    xiaohongshu: `
请生成一个「小红书笔记」风格的完整可交互 HTML 页面，正文不少于 1500 字。包含：笔记标题、正文（配图用文字描述占位，如"[配图：...]"）、标签、点赞/收藏/评论数（虚构数字即可）、以及至少 15 条风格各异的评论（含至少 2 处楼中楼回复、1 处博主自己的回复置顶）。用原生 <details> 折叠"展开更多评论"。视觉做成卡片式、浅色系、贴近小红书真实排版的既视感。`.trim(),
    chatlog: `
请生成一个「聊天记录截图」风格的完整可交互 HTML 页面，正文不少于 1500 字。做成即时通讯软件的对话气泡样式（左右分布、头像占位、时间戳），呈现一段围绕角色某件事的群聊/私聊记录，至少包含 3 个不同发言人、一次话题转折、以及一处用 <details> 折叠的"查看更早的聊天记录"。`.trim(),
    douyin: `
请生成一个「抖音短视频页」风格的完整可交互 HTML 页面，正文不少于 1500 字。包含：视频标题/文案、作者信息、点赞/收藏/转发/评论数（虚构数字）、以及至少 15 条评论（含点赞数、楼中楼回复、至少一条"作者回复"）。视觉做成深色沉浸式短视频信息流的既视感（竖屏卡片、右侧互动按钮占位）。`.trim(),
    checkphone: `
请生成一个「翻看手机」风格的完整可交互 HTML 页面，正文不少于 1500 字。模拟翻看角色手机时看到的片段：聊天记录截图、相册缩略图占位（文字描述）、搜索记录、通知栏消息等，用原生 <details> 做"点击查看完整对话"的折叠交互，营造一点点心跳感和私密感，但内容要克制、不越界。`.trim(),
    memo: `
请生成一个「手机备忘录」风格的完整可交互 HTML 页面，正文不少于 1000 字。做成便签/备忘录 App 的既视感（列表项、复选框待办、时间戳），内容是角色私人的笔记/清单/心情记录，可以用 <input type="checkbox"> 表现打勾的待办事项。`.trim(),
    generic: `
请生成一个贴合上述题材设定的完整可交互 HTML 页面，正文不少于 1500 字，尽量贴合题材本身的平台/媒介特征来设计版式和交互（折叠、投票、列表等原生 HTML 交互皆可使用）。`.trim(),
};

function characterPersonaBlock(character: Character | undefined): string {
    if (!character) return "";
    return `\n【角色设定】\n姓名：${character.name}\n人设：${(character.persona || "").slice(0, 2000)}\n`;
}

function buildTheaterPrompt(genre: TheaterGenre, title: string, setting: string, character: Character | undefined, userName: string): string {
    const styleInstruction = STYLE_PROMPTS[genre.styleKey] || STYLE_PROMPTS.generic;
    return [
        `你在为一款虚构角色扮演应用生成"小剧场"内容——一段关于角色的网络内容快照，仅供{{user}}私下查看，不是真实事件。`,
        `剧场标题：${title}`,
        `题材：${genre.title}`,
        `题材设定：${genre.setting}`,
        setting ? `本次补充设定：${setting}` : "",
        character ? characterPersonaBlock(character) : "",
        `用户称呼：${userName}`,
        "",
        styleInstruction,
        "",
        "【输出格式要求】",
        "1. 只输出一个 ```html 代码块，块内是完整自包含的页面（可以内联 <style>，不要引用外部资源/图片 URL/外部字体/JS 库）。",
        "2. 不要输出代码块之外的任何说明文字。",
        "3. 代码块结束后另起一行，输出 ===SUMMARY=== 标记，然后写 1-2 句这个剧场内容的简介（给{{user}}快速预览用，不超过 80 字）。",
    ].filter(Boolean).join("\n");
}

function expandUserPlaceholder(text: string, userName: string): string {
    return text.replace(/\{\{user\}\}/g, userName);
}

function extractHtmlAndSummary(raw: string): { html: string; summary: string } {
    const markerIndex = raw.indexOf("===SUMMARY===");
    const contentPart = (markerIndex >= 0 ? raw.slice(0, markerIndex) : raw).trim();
    const summaryPart = markerIndex >= 0 ? raw.slice(markerIndex + "===SUMMARY===".length).trim() : "";

    const hasFence = /```html/i.test(contentPart);
    const html = hasFence ? contentPart : "```html\n" + contentPart + "\n```";

    const fallbackSummary = contentPart
        .replace(/```html[\s\S]*?```/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);

    return { html, summary: (summaryPart || fallbackSummary || "点开查看小剧场内容").slice(0, 120) };
}

export type GenerateTheaterInput = {
    genre: TheaterGenre;
    title: string;
    /** 本次的补充设定，留空则只用题材自带的 setting */
    setting?: string;
    characterId?: string;
};

export async function generateTheaterEntry(input: GenerateTheaterInput): Promise<TheaterEntry> {
    const title = input.title.trim() || input.genre.title;
    const apiConfig = resolveTheaterApiConfig(input.characterId);
    const character = input.characterId ? loadCharacters().find(c => c.id === input.characterId) : undefined;
    const userName = resolveUserIdentity(input.characterId, THEATER_BINDING_APP_ID)?.name || "用户";

    const prompt = expandUserPlaceholder(
        buildTheaterPrompt(input.genre, title, (input.setting || "").trim(), character, userName),
        userName,
    );

    const result = await simpleLLMCall(apiConfig, [{ role: "user", content: prompt }], {
        temperature: 0.9,
        max_tokens: 8000,
    });
    if (!result.content) throw new ChatEngineError(result.error || "小剧场生成失败，请重试。");

    const { html, summary } = extractHtmlAndSummary(result.content);
    const wordCount = html.replace(/```html|```/gi, "").replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;

    return addTheaterEntry({
        genreId: input.genre.id,
        genreTitle: input.genre.title,
        styleKey: input.genre.styleKey,
        title,
        setting: (input.setting || "").trim(),
        characterId: character?.id,
        characterName: character?.name,
        html,
        summary,
        wordCount,
    });
}
