// Node 20.12+ can load local environment values without another dependency.
// A missing .env is normal for the fully local synthetic demonstration.
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
