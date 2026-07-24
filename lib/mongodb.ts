import { MongoClient, type Db, type Collection } from "mongodb";
import type {
  CampaignDoc,
  RecipientDoc,
  SmtpProfileDoc,
  SourceDoc,
  TemplateDoc,
} from "./types";

const DB_NAME = process.env.MONGODB_DB || "bulk_mailer";

// The dev server re-evaluates modules on every hot reload; caching the client
// on globalThis keeps a single pool instead of leaking one per reload.
const globalForMongo = globalThis as unknown as {
  _mongoClient?: Promise<MongoClient>;
  _mongoIndexes?: Promise<void>;
};

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and point it at your MongoDB instance."
    );
  }
  return new MongoClient(uri, { maxPoolSize: 10 }).connect();
}

export async function getDb(): Promise<Db> {
  globalForMongo._mongoClient ??= connect();
  let client: MongoClient;
  try {
    client = await globalForMongo._mongoClient;
  } catch (err) {
    // Let the next request retry instead of caching a rejected promise forever.
    globalForMongo._mongoClient = undefined;
    throw err;
  }
  const db = client.db(DB_NAME);
  globalForMongo._mongoIndexes ??= ensureIndexes(db).catch((err) => {
    globalForMongo._mongoIndexes = undefined;
    throw err;
  });
  await globalForMongo._mongoIndexes;
  return db;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("recipients").createIndex({ campaignId: 1, status: 1 }),
    db.collection("recipients").createIndex({ campaignId: 1, index: 1 }),
    db.collection("campaigns").createIndex({ createdAt: -1 }),
    db.collection("templates").createIndex({ updatedAt: -1 }),
    db.collection("smtp_profiles").createIndex({ name: 1 }, { unique: true }),
  ]);
}

export async function collections() {
  const db = await getDb();
  return {
    smtp: db.collection<SmtpProfileDoc>("smtp_profiles"),
    templates: db.collection<TemplateDoc>("templates"),
    sources: db.collection<SourceDoc>("sources"),
    campaigns: db.collection<CampaignDoc>("campaigns"),
    recipients: db.collection<RecipientDoc>("recipients"),
  };
}

export type Collections = {
  smtp: Collection<SmtpProfileDoc>;
  templates: Collection<TemplateDoc>;
  sources: Collection<SourceDoc>;
  campaigns: Collection<CampaignDoc>;
  recipients: Collection<RecipientDoc>;
};
