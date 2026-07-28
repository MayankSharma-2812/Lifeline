require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const DonorProfile = require('./models/DonorProfile');
const EmergencyRequest = require('./models/EmergencyRequest');
const AuditLog = require('./models/AuditLog');

const JAIPUR_CENTER = { lat: 26.9124, lng: 75.7873 };

// Offsets in approx km
const SEED_DONORS = [
  { name: 'Dr. Aarav Sharma', email: 'aarav@lifeline.org', bloodGroup: 'O-', dLat: 0.010, dLng: 0.012, reliability: 98 },  // ~1.5 km
  { name: 'Priya Verma',      email: 'priya@lifeline.org', bloodGroup: 'O+', dLat: -0.015, dLng: 0.020, reliability: 95 }, // ~2.8 km
  { name: 'Rajesh Gupta',    email: 'rajesh@lifeline.org', bloodGroup: 'A+', dLat: 0.025, dLng: -0.018, reliability: 92 }, // ~3.5 km
  { name: 'Ananya Iyer',     email: 'ananya@lifeline.org', bloodGroup: 'A-', dLat: -0.035, dLng: -0.025, reliability: 96 },// ~4.8 km
  { name: 'Vikram Singh',    email: 'vikram@lifeline.org', bloodGroup: 'B+', dLat: 0.045, dLng: 0.040, reliability: 90 },  // ~6.5 km
  { name: 'Kavita Patel',    email: 'kavita@lifeline.org', bloodGroup: 'B-', dLat: -0.055, dLng: 0.050, reliability: 94 }, // ~8.2 km
  { name: 'Rohan Mehta',     email: 'rohan@lifeline.org', bloodGroup: 'AB+', dLat: 0.070, dLng: -0.060, reliability: 89 }, // ~10.5 km
  { name: 'Neha Chawla',     email: 'neha@lifeline.org', bloodGroup: 'AB-', dLat: -0.085, dLng: -0.075, reliability: 97 }, // ~13.0 km
];

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  // Clean existing collections
  await Promise.all([
    User.deleteMany({}),
    DonorProfile.deleteMany({}),
    EmergencyRequest.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('Cleaned existing collections.');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Requester User
  const requester = await User.create({
    name: 'Hospital ER Desk',
    email: 'requester@lifeline.org',
    phone: '+919876543210',
    passwordHash,
    role: 'requester',
    location: {
      type: 'Point',
      coordinates: [JAIPUR_CENTER.lng, JAIPUR_CENTER.lat],
    },
  });
  console.log('Created Requester user: requester@lifeline.org / password123');

  // 2. Create Donor Users & Profiles
  for (const d of SEED_DONORS) {
    const lng = JAIPUR_CENTER.lng + d.dLng;
    const lat = JAIPUR_CENTER.lat + d.dLat;

    const user = await User.create({
      name: d.name,
      email: d.email,
      phone: '+91980000' + Math.floor(10000 + Math.random() * 90000),
      passwordHash,
      role: 'donor',
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
    });

    await DonorProfile.create({
      userId: user._id,
      bloodGroup: d.bloodGroup,
      status: 'available',
      isAvailable: true,
      reliabilityScore: d.reliability,
    });

    console.log(`Created Donor: ${d.name} (${d.bloodGroup}) - ${d.email} / password123`);
  }

  console.log('\nSeeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log('Demo Credentials:');
  console.log('Requester: requester@lifeline.org | password123');
  console.log('Universal Donor (O-): aarav@lifeline.org | password123');
  console.log('----------------------------------------------------');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
