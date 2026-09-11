import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:studytracker.db");
  }
  return db;
}

export async function dbInit(): Promise<void> {
  const database = await getDb();
  await database.execute("SELECT 1");
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const database = await getDb();
  return (await database.select<T[]>(sql, params)) as T[];
}

export async function execute(
  sql: string,
  params: unknown[] = [],
): Promise<unknown> {
  const database = await getDb();
  return database.execute(sql, params);
}