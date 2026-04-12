const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/afonsystem';
let db;

// ─── Time-series collection definitions ──────────────────────────────────────
const TIME_SERIES_COLLECTIONS = [
  {
    name: 'commits',
    options: {
      timeseries: {
        timeField: 'committed_date',
        metaField: 'project_id',
        granularity: 'hours',
      },
    },
  },
  {
    name: 'daily_conformance',
    options: {
      timeseries: {
        timeField: 'evaluated_at',
        metaField: 'project_id',
        granularity: 'hours',
      },
    },
  },
];

/**
 * Ensure time-series collections exist with the correct configuration.
 * If a regular collection exists with the same name, it is dropped and
 * recreated as time-series.
 */
async function ensureTimeSeriesCollections(database) {
  const collections = await database.listCollections().toArray();
  const collMap = Object.fromEntries(collections.map(c => [c.name, c]));

  for (const tsDef of TIME_SERIES_COLLECTIONS) {
    const existing = collMap[tsDef.name];

    if (existing && existing.type === 'timeseries') {
      continue; // already time-series
    }

    if (existing) {
      // Regular collection exists — drop it to recreate as time-series
      console.log(`[DB] Migrating '${tsDef.name}' from regular to time-series collection...`);
      await database.collection(tsDef.name).drop();
    }

    await database.createCollection(tsDef.name, tsDef.options);
    console.log(`[DB] Created time-series collection: ${tsDef.name}`);
  }
}

async function connectDB() {
  const client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  console.log('[DB] Connected to MongoDB:', uri);
  await ensureTimeSeriesCollections(db);
  return db;
}

function getDB() {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}

async function closeDB() {
  if (db) {
    await db.client.close();
    db = null;
  }
}

module.exports = { connectDB, getDB, closeDB, ensureTimeSeriesCollections };
