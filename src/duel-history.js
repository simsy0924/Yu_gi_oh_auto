export async function replayPlayerInputs({createSession,playerInputs,resolveOpponent}) {
  const session=await createSession();
  let cursor=0;
  try {
    for(const input of playerInputs) {
      if(session.prompt?.player===1)cursor=resolveOpponent(session,cursor);
      if(session.ended||session.prompt?.player!==0)throw new Error('저장된 플레이어 행동을 재생할 수 없습니다.');
      session.respond(input);
      cursor=resolveOpponent(session,cursor);
    }
    return {session,cursor};
  }catch(error){
    session.destroy();
    throw error;
  }
}
