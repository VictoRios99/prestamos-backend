const { Client } = require('pg');

async function clearDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    database: 'prestamos_db',
    user: 'victorrios',
    password: '',
    
  });

  try {
    await client.connect();
    console.log('Eliminando todas las tablas...');
    
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO victorrios');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    
    console.log('Base de datos limpiada exitosamente');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

clearDatabase();
