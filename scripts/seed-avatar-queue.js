#!/usr/bin/env node

/**
 * Seed the avatar queue with 20 pre-generated avatars
 * Run: node scripts/seed-avatar-queue.js
 */

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function seedQueue() {
  console.log('🌱 Seeding avatar queue...');
  console.log(`Using base URL: ${baseUrl}`);

  try {
    const response = await fetch(`${baseUrl}/api/nightclub/queue/backfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 20 }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log('✅ Queue seeded successfully!');
    console.log(`   Generated: ${result.generated}`);
    console.log(`   Failed: ${result.failed}`);
    console.log(`   Total: ${result.total}`);
  } catch (error) {
    console.error('❌ Failed to seed queue:', error.message);
    process.exit(1);
  }
}

seedQueue();

