const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks, globals = {}) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require: name => {
        if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
        return mocks[name];
    }, ...globals });
    return module.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
    let globalSounds = { receive: { mode: 'custom', asset: 'global' } };
    const played = [];
    class Audio {
        constructor(url) { this.url = url; played.push(this); }
        play() { return Promise.resolve(); }
        pause() { this.paused = true; }
    }
    const sounds = load('lib/chat-sounds.ts', {
        './kv-db': { kvGet: () => JSON.stringify(globalSounds), kvSet: (_, value) => { globalSounds = JSON.parse(value); } },
        './chat-asset-storage': { getChatImageFromIndexedDB: async id => 'data:audio/' + id },
    }, { Audio });
    sounds.playChatSound('receive'); await tick();
    assert.equal(played[0].url, 'data:audio/global');
    sounds.playChatSound('receive', { receive: { mode: 'off' } }); await tick();
    assert.equal(played.length, 1, 'off must override global');
    const stop = sounds.playChatSound('incoming', { incoming: { mode: 'custom', asset: 'ring' } }, true);
    await tick(); assert.equal(played[1].loop, true); stop(); assert.equal(played[1].paused, true);
    const cancel = sounds.playChatSound('receive'); cancel(); await tick();
    assert.equal(played.length, 2, 'cancel before storage resolves must prevent playback');

    let sessions = [{ id: 's', contactId: 'c', suggestedAvatar: 'candidate' }];
    let chars = [{ id: 'c', avatar: 'old' }];
    const messages = [];
    const avatars = load('lib/chat-avatar.ts', {
        './chat-storage': { loadChatSessions: () => sessions, saveChatSessions: value => { sessions = value; }, pushChatMessage: m => messages.push(m), CHAT_REQUEST_REPLY_EVENT: 'reply' },
        './character-storage': { loadCharacters: () => chars, saveCharacters: value => { chars = value; } },
        './settings-storage': { resolveUserIdentity: () => ({ id: 'me' }) },
        './chat-asset-storage': { getChatImageFromIndexedDB: async id => 'data:image/' + id },
    }, { window: { dispatchEvent() {} }, Event: class {}, CustomEvent: class {} });
    assert.equal(await avatars.applyAvatarChoice('不换<avatar-choice id="candidate">reject</avatar-choice>', 's'), '不换');
    assert.equal(chars[0].avatar, 'old'); assert.equal(sessions[0].suggestedAvatar, undefined);
    sessions[0].suggestedAvatar = 'new';
    await avatars.applyAvatarChoice('<avatar-choice id="candidate">accept</avatar-choice>', 's');
    assert.equal(chars[0].avatar, 'old', 'stale recommendation must not be applied');
    await avatars.applyAvatarChoice('换好了<avatar-choice id="new">accept</avatar-choice>', 's');
    assert.equal(chars[0].avatar, 'data:image/new');
    messages.length = 0;
    sessions[0].avatarReaction = false; avatars.notifyAvatarChange('me', 'new'); assert.equal(messages.length, 0);
    sessions[0].avatarReaction = true; avatars.notifyAvatarChange('me', 'new'); assert.equal(messages.length, 1);
    assert.equal(messages[0].mediaUrl, 'new');

    let effect, image;
    const background = load('components/chat/use-call-background.ts', {
        react: { useState: () => [null, value => { image = value; }], useEffect: cb => { effect = cb; } },
        '@/lib/chat-storage': { loadChatSessions: () => [{ id: 's', voiceBackground: 'saved', videoBackground: 'https://example.com/video.png' }] },
        '@/lib/chat-asset-storage': { getChatImageFromIndexedDB: async id => 'data:image/' + id },
    });
    background.useCallBackground('s', 'voiceBackground', 'stale-prop'); effect(); await tick();
    assert.equal(image, 'data:image/saved', 'latest stored settings must override stale call props');
    background.useCallBackground('s', 'videoBackground'); effect(); await tick();
    assert.equal(image, 'https://example.com/video.png');
    background.useCallBackground('s', 'voiceBackground'); const cleanup = effect(); cleanup(); await tick();
    assert.equal(image, null, 'unmounted calls must ignore asynchronous image results');
    console.log('Chat personalization regression checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
