import {pathToFileURL} from 'node:url';

export async function triggerDeployment({hook,commit,fetchImpl=fetch}) {
  if(!hook)throw new Error('Set the RENDER_DEPLOY_HOOK_URL repository Actions secret from the existing Render service Settings.');
  if(!/^[0-9a-f]{40}$/i.test(commit??''))throw new Error('A full tested Git commit SHA is required.');
  let url;
  try{url=new URL(hook);}catch{throw new Error('Invalid Render deploy hook URL.');}
  if(url.origin!=='https://api.render.com'||!/^\/deploy\/srv-[A-Za-z0-9]+$/.test(url.pathname)||!url.searchParams.get('key')||url.username||url.password||url.hash)
    throw new Error('Expected an HTTPS Render deploy hook with a service ID and key.');
  url.searchParams.set('ref',commit);
  let response;
  try{response=await fetchImpl(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000)});}
  catch{throw new Error('Could not reach the Render deploy hook. Check Render and retry the workflow.');}
  if(response.status!==200&&response.status!==202)throw new Error(`Render rejected the deployment request (HTTP ${response.status}). Check the deploy hook and service settings.`);
  return {queued:response.status===202,commit};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const result=await triggerDeployment({hook:process.env.RENDER_DEPLOY_HOOK_URL,commit:process.env.DEPLOY_COMMIT_SHA});
    console.log(`Render deployment ${result.queued?'queued':'requested'} for ${result.commit}. Check Render Events for completion.`);
    if(process.env.GITHUB_STEP_SUMMARY) {
      const {appendFile}=await import('node:fs/promises');
      await appendFile(process.env.GITHUB_STEP_SUMMARY,`MCP deployment ${result.queued?'queued':'requested'} for commit \`${result.commit}\`. This confirms the request, not deployment completion. Check the existing Render service Events.\n`);
    }
  }catch(error){console.error(error.message);process.exitCode=1;}
}
