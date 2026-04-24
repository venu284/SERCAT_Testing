import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { institutions } from './schema/institutions.js';
import { users } from './schema/users.js';
import { hashPassword } from '../lib/auth-utils.js';
import { getRequiredDatabaseUrl } from '../lib/env.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const sql = neon(getRequiredDatabaseUrl());
const db = drizzle(sql);

const SEED_INSTITUTIONS = [
  { name: 'University of Georgia', abbreviation: 'UGA' },
  { name: 'Rosalind Franklin University of Medicine and Science', abbreviation: 'RFU' },
  { name: 'University of Arkansas Medical Sciences ', abbreviation: 'UAMS1' },
  { name: 'University of Arkansas Medical Sciences', abbreviation: 'UAMS2' },
  { name: 'University of Missouri-Kansas City', abbreviation: 'UMKC' },
  { name: 'University of North Carolina at Chapel Hill', abbreviation: 'UNC' },
  { name: 'University of Notre Dame', abbreviation: 'ND' },
  { name: 'University of South Carolina', abbreviation: 'USC' },
  { name: 'University of South Florida', abbreviation: 'USF' },
  { name: 'University of Texas MD Anderson', abbreviation: 'MD Anderson' },
  { name: 'University of Virginia', abbreviation: 'UVA' },
  { name: 'Duke University Medical Center', abbreviation: 'DUKE' },
  { name: 'Emory University', abbreviation: 'Emory' },
  { name: 'Georgia Tech Research Corporation', abbreviation: 'GIT' },
  { name: 'Bayer US', abbreviation: 'BAYER' },
  { name: 'SFCUniversity of Florida Scripps', abbreviation: 'Scripps' },
  { name: 'St. Jude Children’s Research Hospital', abbreviation: 'St.Jude' },
  { name: 'University of Kentucky Research Foundation', abbreviation: 'UKY' },
  { name: 'National Institute of Allergy and Infectious Diseases', abbreviation: 'NIH' },
  { name: 'Centers for Disease Control and Prevention', abbreviation: 'CDC' },
];

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create default admin account
  const adminPasswordHash = await hashPassword('Admin@123');
  const adminValues = {
    email: 'admin@sercat.org',
    passwordHash: adminPasswordHash,
    name: 'SER-CAT Admin',
    role: 'admin',
    isActive: true,
    isActivated: true,
  };

  const [admin] = await db.insert(users).values(adminValues).onConflictDoUpdate({
    target: users.email,
    set: {
      passwordHash: adminValues.passwordHash,
      name: adminValues.name,
      role: adminValues.role,
      isActive: adminValues.isActive,
      isActivated: adminValues.isActivated,
      updatedAt: new Date(),
    },
  }).returning();
  console.log(`✅ Admin ensured: ${admin.email}`);

  // 2. Create institutions
  const insertedInstitutions = [];
  for (const inst of SEED_INSTITUTIONS) {
    const [row] = await db.insert(institutions).values(inst).onConflictDoUpdate({
      target: institutions.abbreviation,
      set: {
        name: inst.name,
        updatedAt: new Date(),
      },
    }).returning();
    insertedInstitutions.push(row);
  }
  console.log(`✅ ${insertedInstitutions.length} institutions ensured`);

  console.log(' Seed complete!');
  console.log('');
  console.log('Default admin login:');
  console.log('  Email: admin@sercat.org');
  console.log('  Password: Admin@123');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
