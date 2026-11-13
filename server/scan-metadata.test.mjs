import {test} from 'node:test';import assert from 'node:assert/strict';import {attachSecurityMetadata} from './scan-metadata.mjs';
test('preserves hybrid security labels in scan results',()=>{const r=attachSecurityMetadata({buy:[{symbol:'AIRTP'}]},[{symbol:'AIRTP',kind:'preferred',note:'trust_preferred_hybrid'}]);assert.equal(r.buy[0].securityType,'preferred');assert.equal(r.buy[0].securityNote,'trust_preferred_hybrid')});
test('missing classification cannot silently pass',()=>{assert.throws(()=>attachSecurityMetadata({buy:[{symbol:'MISSING'}]},[]))});
