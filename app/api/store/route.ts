import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { userStores } from "@/db/schema";

export const dynamic = "force-dynamic";

const MAX_STORE_BYTES = 5 * 1024 * 1024;

async function authenticatedEmail() {
  const user = await getChatGPTUser();
  return user?.email.trim().toLowerCase() ?? null;
}

export async function GET() {
  const email = await authenticatedEmail();
  if (!email)
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const db = await getDb();
  const [row] = await db
    .select()
    .from(userStores)
    .where(eq(userStores.userEmail, email))
    .limit(1);

  if (!row)
    return Response.json({
      store: null,
      updatedAt: null,
      hasPrevious: false,
    });

  try {
    return Response.json({
      store: JSON.parse(row.storeJson),
      updatedAt: row.updatedAt,
      hasPrevious: Boolean(row.previousStoreJson),
    });
  } catch {
    return Response.json(
      { error: "저장된 계정 데이터를 읽을 수 없습니다." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const email = await authenticatedEmail();
  if (!email)
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let payload: {
    store?: unknown;
    baseUpdatedAt?: string | null;
    createIfMissing?: boolean;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "잘못된 저장 요청입니다." }, { status: 400 });
  }

  if (!payload.store || typeof payload.store !== "object")
    return Response.json({ error: "저장할 데이터가 없습니다." }, { status: 400 });

  const storeJson = JSON.stringify(payload.store);
  if (new TextEncoder().encode(storeJson).byteLength > MAX_STORE_BYTES)
    return Response.json(
      { error: "계정 데이터가 5MB 제한을 초과했습니다." },
      { status: 413 },
    );

  const schemaVersion =
    "schemaVersion" in payload.store &&
    typeof payload.store.schemaVersion === "number"
      ? payload.store.schemaVersion
      : 1;
  const updatedAt = new Date().toISOString();

  const db = await getDb();
  const [current] = await db
    .select()
    .from(userStores)
    .where(eq(userStores.userEmail, email))
    .limit(1);

  if (current && payload.baseUpdatedAt !== current.updatedAt)
    return Response.json(
      {
        error:
          "다른 기기에서 더 최근에 저장한 데이터가 있어 덮어쓰기를 중단했습니다. 계정 데이터를 다시 불러와 확인하세요.",
        conflict: true,
        updatedAt: current.updatedAt,
      },
      { status: 409 },
    );

  if (!current && !payload.createIfMissing)
    return Response.json(
      {
        error:
          "계정 저장소가 아직 없습니다. 계정 창에서 이 기기 데이터를 처음 저장할지 직접 선택하세요.",
      },
      { status: 409 },
    );

  if (current) {
    await db
      .update(userStores)
      .set({
        previousStoreJson: current.storeJson,
        previousUpdatedAt: current.updatedAt,
        storeJson,
        schemaVersion,
        updatedAt,
      })
      .where(eq(userStores.userEmail, email));
  } else {
    await db.insert(userStores).values({
      userEmail: email,
      storeJson,
      schemaVersion,
      updatedAt,
    });
  }

  return Response.json({
    saved: true,
    updatedAt,
    hasPrevious: Boolean(current),
  });
}

export async function PATCH() {
  const email = await authenticatedEmail();
  if (!email)
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const db = await getDb();
  const [current] = await db
    .select()
    .from(userStores)
    .where(eq(userStores.userEmail, email))
    .limit(1);

  if (!current?.previousStoreJson)
    return Response.json(
      { error: "복원할 이전 서버 저장본이 없습니다." },
      { status: 404 },
    );

  const restoredJson = current.previousStoreJson;
  const restoredUpdatedAt = new Date().toISOString();
  await db
    .update(userStores)
    .set({
      storeJson: restoredJson,
      updatedAt: restoredUpdatedAt,
      previousStoreJson: current.storeJson,
      previousUpdatedAt: current.updatedAt,
    })
    .where(eq(userStores.userEmail, email));

  try {
    return Response.json({
      store: JSON.parse(restoredJson),
      updatedAt: restoredUpdatedAt,
      hasPrevious: true,
    });
  } catch {
    return Response.json(
      { error: "이전 서버 저장본을 읽을 수 없습니다." },
      { status: 500 },
    );
  }
}
