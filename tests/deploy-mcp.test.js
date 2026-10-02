import test from 'node:test';
import assert from 'node:assert/strict';
import {triggerDeployment} from '../scripts/deploy-mcp.mjs';
const commit='a'.repeat(40),hook='https://api.render.com/deploy/srv-example?key=secret';
test('deploys the tested commit and reports accepted or queued requests',async()=>{
  for(const status of [200,202]) {
    const result=await triggerDeployment({hook,commit,fetchImpl:async(url,options)=>{
      assert.equal(url.searchParams.get('ref'),commit);
      assert.equal(url.searchParams.get('key'),'secret');
      assert.equal(options.method,'POST');
      assert.equal(options.redirect,'error');
      return {status};
    }});
    assert.equal(result.queued,status===202);
  }
});
test('rejects missing settings, untrusted hooks and invalid commits before sending',async()=>{
  for(const input of [{commit},{hook:'http://api.render.com/deploy/srv-example?key=secret',commit},{hook:'https://example.com/?key=secret',commit},{hook,commit:'main'}])
    await assert.rejects(triggerDeployment({...input,fetchImpl:()=>assert.fail('must not send')}));
});
test('does not expose secret URL through failure messages',async()=>{
  for(const fetchImpl of [async()=>({status:401}),async()=>{throw new Error(hook);}])
    await assert.rejects(triggerDeployment({hook,commit,fetchImpl}),error=>!error.message.includes('secret')&&!error.message.includes(hook));
});
