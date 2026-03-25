import { configureLocalDotenv } from './utils/local-env.js';

const run = async () => {
  configureLocalDotenv(import.meta.url);

  const { seedDatabase } = await import('./seed.js');

  try {
    await seedDatabase();
    console.log('✨ Local database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Local database seeding failed:', error);
    process.exit(1);
  }
};

run();
