import * as schema from './schema.js';

// Database configuration
interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  sqlite?: {
    path: string;
  };
  postgresql?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
}

// Get database config from environment or default to SQLite
function getDatabaseConfig(): DatabaseConfig {
  const dbType = (process.env.DB_TYPE || 'sqlite') as 'sqlite' | 'postgresql';

  if (dbType === 'postgresql') {
    return {
      type: 'postgresql',
      postgresql: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'activitypub',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
      },
    };
  }

  return {
    type: 'sqlite',
    sqlite: {
      path: process.env.DB_PATH || './data/activitypub.db',
    },
  };
}

// Initialize database connection
let db: any;

export function initializeDatabase() {
  const config = getDatabaseConfig();

  if (config.type === 'postgresql' && config.postgresql) {
    const { host, port, database, username, password } = config.postgresql;
    const connectionString = `postgres://${username}:${password}@${host}:${port}/${database}`;
    const client = postgres(connectionString);
    db = drizzlePg(client, { schema });
  } else if (config.type === 'sqlite' && config.sqlite) {
    const sqlite = new Database(config.sqlite.path);
    // Enable WAL mode for better concurrency
    sqlite.pragma('journal_mode = WAL');
    db = drizzle(sqlite, { schema });
  }

  return db;
}

export function getDatabase() {
  if (!db) {
    db = initializeDatabase();
  }
  return db;
}

export { schema };
