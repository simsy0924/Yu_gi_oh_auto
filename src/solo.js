import {ghostChoice} from './prompts.js';

export function soloOpponentChoice(prompt,cursor=0) {
  const safeKind=prompt?.type==='SELECT_IDLECMD'||prompt?.type==='SELECT_BATTLECMD'?'end':prompt?.type==='SELECT_CHAIN'?'pass':prompt?.type==='SELECT_EFFECTYN'||prompt?.type==='SELECT_YESNO'?'no':null;
  const safeChoice=safeKind&&prompt.choices.find(choice=>choice.kind===safeKind);
  if(safeChoice)return {choice:safeChoice.id,cursor};
  return ghostChoice(prompt,{fallback:'basic'},cursor);
}
