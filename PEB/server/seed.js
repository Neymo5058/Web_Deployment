import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

import Event from './models/Event.js';
import User from './models/User.js';

const resolveEnvPath = () => {
  if (process.env.DOTENV_CONFIG_PATH) {
    return process.env.DOTENV_CONFIG_PATH;
  }

  const candidate = path.resolve(process.cwd(), '.env');
  return candidate;
};

dotenv.config({ path: resolveEnvPath() });

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@peb.test';

const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || '123456';
const SEED_ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Pro Event Admin';
const RESET_ADMIN_PASSWORD = parseBoolean(
  process.env.SEED_RESET_ADMIN_PASSWORD,
  false
);
const RESET_EVENTS = parseBoolean(process.env.SEED_RESET_EVENTS, false);

const ensureMongoUri = () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI environment variable is required to run the seed');
  }
  return uri;
};

const ensureAdminUser = async () => {
  const normalizedEmail = SEED_ADMIN_EMAIL.trim().toLowerCase();
  let admin = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!admin) {
    const hashedPassword = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
    admin = await User.create({
      fullname: SEED_ADMIN_NAME,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'admin',
    });

    console.log(`✅ Created admin user ${normalizedEmail}`);
    return admin;
  }

  let hasUpdates = false;

  if (admin.role !== 'admin') {
    admin.role = 'admin';
    hasUpdates = true;
  }

  if (!admin.fullname) {
    admin.fullname = SEED_ADMIN_NAME;
    hasUpdates = true;
  }

  if (RESET_ADMIN_PASSWORD) {
    admin.password = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
    hasUpdates = true;
    console.log('ℹ️ Admin password reset requested via SEED_RESET_ADMIN_PASSWORD');
  }

  if (hasUpdates) {
    await admin.save();
    console.log(`✅ Updated admin user ${normalizedEmail}`);
  } else {
    console.log(`ℹ️ Admin user ${normalizedEmail} already exists – no changes applied`);
  }

  return admin;
};

const buildSampleEvents = (admin) => {
  const now = new Date();
  const baseYear = now.getUTCFullYear();
  const baseMonth = now.getUTCMonth();

  const templates = [
    {
      title: 'Vue.js Summit Montréal',
      subtitle: 'A deep dive into the Vue ecosystem with community experts.',
      imageUrl:
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
      startsAt: new Date(Date.UTC(baseYear, baseMonth + 1, 5, 13, 30)),
      hour: '09:30',
      place: { name: 'Palais des congrès', city: 'Montréal', country: 'CA' },
      organizer: 'Pro Event Booking',
      price: 189,
      capacity: 150,
    },
    {
      title: 'Design Systems Workshop',
      subtitle: 'Hands-on sessions to craft scalable product design systems.',
      imageUrl:
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
      startsAt: new Date(Date.UTC(baseYear, baseMonth + 1, 19, 15, 0)),
      hour: '11:00',
      place: { name: 'Centre Phi', city: 'Montréal', country: 'CA' },
      organizer: 'Creative Labs',
      price: 129,
      capacity: 80,
    },
    {
      title: 'AI for Event Planners',
      subtitle: 'Practical strategies to integrate AI into modern event workflows.',
      imageUrl:
        'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=1200&q=80',
      startsAt: new Date(Date.UTC(baseYear, baseMonth + 2, 2, 16, 0)),
      hour: '12:00',
      place: { name: 'Maison Notman House', city: 'Montréal', country: 'CA' },
      organizer: 'AI Montreal',
      price: 99,
      capacity: 120,
    },
  ];

  const approvalMeta = {
    approvedAt: now,
    approvedBy: admin ? admin._id : undefined,
    isApproved: true,
    status: 'approved',
  };

  return templates.map((event) => ({
    ...event,
    available: event.capacity,
    currency: 'CAD',
    ...approvalMeta,
  }));
};

const seedEvents = async (admin) => {
  if (RESET_EVENTS) {
    await Event.deleteMany({});
    console.log('ℹ️ Existing events removed (SEED_RESET_EVENTS=true)');
  }

  const existingCount = await Event.countDocuments();
  if (existingCount > 0) {
    console.log(`ℹ️ Found ${existingCount} event(s) – skipping sample event creation.`);
    return { created: 0 };
  }

  const sampleEvents = buildSampleEvents(admin);
  const created = await Event.insertMany(sampleEvents);
  console.log(`✅ Seeded ${created.length} sample event(s).`);
  return { created: created.length };
};

export const seedDatabase = async () => {
  const mongoUri = ensureMongoUri();

  const { readyState } = mongoose.connection;
  const isConnected = readyState === 1; // already connected
  const shouldManageConnection = !isConnected;

  if (shouldManageConnection) {
    await mongoose.connect(mongoUri);
  }


  try {
    const admin = await ensureAdminUser();
    await seedEvents(admin);
  } finally {
    if (shouldManageConnection) {
      await mongoose.disconnect();
    }

  }
};

const runDirectly = () => {
  const executedPath = process.argv[1];
  const currentFilePath = fileURLToPath(import.meta.url);
  return executedPath === currentFilePath;
};

if (runDirectly()) {
  seedDatabase()
    .then(() => {
      console.log('✨ Seeding completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}
