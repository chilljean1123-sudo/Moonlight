const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const moduleUnderTest = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync('lib/video-call-store.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(compiled, { module: moduleUnderTest, exports: moduleUnderTest.exports, crypto: { randomUUID } });
const calls = moduleUnderTest.exports;
const session = { id: 'chat-1' };
const character = { id: 'character-1' };
let ended = 0;
const unsubscribeChat = calls.subscribeVideoCallEnd(() => ended++);
assert.equal(calls.startVideoCall(session, character, 'user'), true);
const callId = calls.getVideoCall().id;
calls.minimizeVideoCall(true);
unsubscribeChat(); // Leaving a chat unmounts its launcher, not the shell's call.
assert.equal(calls.getVideoCall().id, callId);
assert.equal(calls.getVideoCall().minimized, true);
assert.equal(ended, 0);
assert.equal(calls.startVideoCall(session, character, 'character'), true);
assert.equal(calls.getVideoCall().id, callId, 'reopening chat must not restart the call');
assert.equal(calls.getVideoCall().minimized, true, 'reopening must preserve minimization');
assert.equal(calls.startVideoCall({ id: 'chat-2' }, character, 'user'), false);
assert.equal(calls.getVideoCall().id, callId, 'another call must not replace the running call');
calls.minimizeVideoCall(false);
assert.equal(calls.getVideoCall().id, callId, 'restoring must retain the original component key');
calls.endVideoCall('stale-call-id');
assert.equal(calls.getVideoCall().id, callId);
calls.subscribeVideoCallEnd(() => ended++);
calls.endVideoCall(callId);
assert.equal(calls.getVideoCall(), null);
assert.equal(ended, 1);
calls.endVideoCall(callId);
assert.equal(ended, 1, 'hangup notification must be emitted once');
console.log('Video call lifetime regression checks passed.');
