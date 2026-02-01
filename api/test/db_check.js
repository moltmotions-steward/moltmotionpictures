
const { Client } = require('pg');
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'; // Target default postgres DB

console.log(`Connecting to: ${connectionString}`);

const client = new Client({ connectionString });

client.connect()
  .then(async () => {
    console.log('✅ Connected successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Time:', res.rows[0]);
    await client.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Connection error:', err.message);
    if (err.message.includes('database "moltstudios" does not exist')) {
        console.log('Database missing, trying to connect to "postgres" default DB...');
        // Try connecting to default postgres db to verify auth
        const client2 = new Client({ connectionString: connectionString.replace('/moltstudios', '/postgres') });
        try {
            await client2.connect();
            console.log('✅ Connected to "postgres" DB! You need to create "moltstudios" DB.');
            await client2.end();
        } catch (err2) {
             console.error('❌ Failed to connect to "postgres" DB too:', err2.message);
        }
    }
    await client.end();
    process.exit(1);
  });
