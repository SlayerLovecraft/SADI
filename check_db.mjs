import postgres from './_react_legacy/SADI_React-Node.js/node_modules/postgres/src/index.js';

const sql = postgres({
  host: 'aws-1-us-east-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  username: 'postgres.ospsgzzudwrdjyvldmmo',
  password: 'nqW8MXRabhpq75c1',
  ssl: 'require',
  connect_timeout: 10
});

async function main() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log('Tables in Supabase:', tables.map(t => t.table_name));

    // Also check columns of patients and signos_vitales if they exist
    for (const t of ['patients', 'signos_vitales', 'interactions', 'campaigns']) {
      const cols = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = ${t};
      `;
      console.log(`\nColumns of ${t}:`, cols.map(c => `${c.column_name} (${c.data_type})`));
    }

    await sql.end();
  } catch (err) {
    console.error('Error connecting to Supabase:', err);
    await sql.end();
  }
}

main();
