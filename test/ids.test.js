const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');

test('creates UUIDs on HTTP where crypto.randomUUID is unavailable', () => {
  const context = {crypto: {getRandomValues: bytes => webcrypto.getRandomValues(bytes)}};
  vm.runInNewContext(readFileSync(require.resolve('../ids.js'), 'utf8'), context);
  assert.equal(context.crypto.randomUUID, undefined);
  const ids = Array.from({length: 1000}, () => context.TeamspaceIds.createId());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
