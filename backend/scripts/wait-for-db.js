#!/usr/bin/env node
/**
 * wait-for-db.js
 * Waits for the Postgres database to become reachable before running
 * `prisma db push` and starting the main server.
 *
 * Fixes Render free-tier P1001 race condition where `prisma db push`
 * runs before the database container is ready to accept connections.
 */

'use strict';
const { execSync } = require('child_process');
const path = require('path');

const MAX_RETRIES = 20;    // Up to ~100 seconds
const RETRY_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkDb() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  });
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return true;
  } catch (err) {
    try { await prisma.$disconnect(); } catch {}
    throw err;
  }
}

async function main() {
  console.log('[startup] Waiting for database to become available...');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await checkDb();
      console.log(`[startup] ✅ Database ready on attempt ${attempt}.`);
      break;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error(`[startup] ❌ Database not reachable after ${MAX_RETRIES} attempts. Proceeding anyway...`);
        break;
      }
      const isP1001 = err.message && (
        err.message.includes('P1001') ||
        err.message.includes("Can't reach database")
      );
      if (isP1001) {
        console.log(`[startup] Attempt ${attempt}/${MAX_RETRIES}: DB not ready yet, retrying in ${RETRY_DELAY_MS / 1000}s...`);
      } else {
        console.log(`[startup] Attempt ${attempt}/${MAX_RETRIES}: ${err.message.split('\n')[0]}, retrying...`);
      }
      await sleep(RETRY_DELAY_MS);
    }
  }

  // Run migrations / schema push
  console.log('[startup] Running prisma db push...');
  try {
    execSync('npx prisma db push --accept-data-loss', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
    console.log('[startup] ✅ prisma db push complete.');
  } catch (err) {
    console.error('[startup] ⚠️  prisma db push failed (schema may already be up to date):', err.message);
  }

  // Start the Express server
  console.log('[startup] 🚀 Starting server...');
  require(path.resolve(__dirname, '..', 'index.js'));
}

main().catch(err => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
