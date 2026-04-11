/**
 * ══════════════════════════════════════════════════════════════
 *  AutoAssist360 — Master Seed File
 *  Super-realistic data covering every table in the schema.
 *
 *  Accounts seeded:
 *    1 Admin
 *   15 Users   (with 1-2 vehicles each)
 *   10 Technicians (diverse locations, ratings, types, skills)
 *    4 Vendors  (with warehouses & full inventory)
 *
 *  All passwords: Test@1234
 *  Run:  node prisma/seed.mjs  (from backend/)
 * ══════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import crypto from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import bcrypt from "bcrypt";

const adapter = new PrismaPg( { connectionString: process.env.DATABASE_URL } );
const prisma = new PrismaClient( { adapter } );

const SALT_ROUNDS = 10;
const PASSWORD = "Test@1234";

// ─── Utility helpers ────────────────────────────────────────
const uuid = () => crypto.randomUUID();
const pick = ( arr ) => arr[ Math.floor( Math.random() * arr.length ) ];
const int = ( min, max ) => Math.floor( Math.random() * ( max - min + 1 ) ) + min;
const daysAgo = ( n ) => { const d = new Date(); d.setDate( d.getDate() - n ); return d; };
const hoursAgo = ( n ) => { const d = new Date(); d.setHours( d.getHours() - n ); return d; };
const minAgo = ( n ) => new Date( Date.now() - n * 60_000 );

async function upsertUser ( data )
{
  try
  {
    return await prisma.user.upsert( {
      where: { email: data.email },
      update: {
        full_name: data.full_name,
        phone_number: data.phone_number,
        role: data.role,
        is_active: true,
        deleted_at: null,
        ...(data.is_verified !== undefined ? { is_verified: data.is_verified } : {}),
      },
      create: data,
    } );
  } catch
  {
    return await prisma.user.findUnique( { where: { email: data.email } } );
  }
}

// ─── Static data pools ──────────────────────────────────────

const NAGPUR_LOCATIONS = {
  users: [
    { lat: 21.1458, lng: 79.0882, label: "Sitabuldi" },
    { lat: 21.1500, lng: 79.0750, label: "Dharampeth" },
    { lat: 21.1260, lng: 79.0500, label: "Hingna" },
    { lat: 21.1700, lng: 79.1100, label: "Sadar" },
    { lat: 21.1350, lng: 79.1200, label: "Nandanvan" },
    { lat: 21.1050, lng: 79.0600, label: "Wadi" },
    { lat: 21.1600, lng: 79.0400, label: "Manewada" },
    { lat: 21.1800, lng: 79.0900, label: "Kamptee Road" },
    { lat: 21.1100, lng: 79.1000, label: "Pardi" },
    { lat: 21.1400, lng: 79.0300, label: "Trimurti Nagar" },
    { lat: 21.1650, lng: 79.0650, label: "Laxmi Nagar" },
    { lat: 21.1200, lng: 79.0800, label: "Pratap Nagar" },
    { lat: 21.1300, lng: 79.1050, label: "Jaripatka" },
    { lat: 21.1900, lng: 79.0700, label: "Bhandara Road" },
    { lat: 21.1000, lng: 79.1200, label: "Besa" },
  ],
  technicians: [
    { lat: 21.1460, lng: 79.0885, label: "Sitabuldi Center", radius: 15 },
    { lat: 21.1550, lng: 79.0700, label: "Laxmi Nagar", radius: 10 },
    { lat: 21.1300, lng: 79.0600, label: "Trimurti Nagar", radius: 20 },
    { lat: 21.1700, lng: 79.1050, label: "Sadar Area", radius: 8 },
    { lat: 21.1200, lng: 79.1300, label: "Nandanvan", radius: 25 },
    { lat: 21.1000, lng: 79.0500, label: "Wadi Industrial", radius: 30 },
    { lat: 21.2000, lng: 79.1200, label: "Kamptee", radius: 12 },
    { lat: 21.0800, lng: 79.0400, label: "Besa South", radius: 50 },
    { lat: 21.1650, lng: 79.0450, label: "Manewada", radius: 18 },
    { lat: 21.1100, lng: 79.0900, label: "South Nagpur", radius: 22 },
  ],
  warehouses: [
    { lat: 21.1500, lng: 79.0800, label: "MIDC Hingna - Auto Zone", city: "Nagpur", state: "Maharashtra", postal: "440016" },
    { lat: 21.1600, lng: 79.1000, label: "Sadar Automotive Hub", city: "Nagpur", state: "Maharashtra", postal: "440001" },
    { lat: 21.1300, lng: 79.0700, label: "Wadi Spare Parts Market", city: "Nagpur", state: "Maharashtra", postal: "440023" },
    { lat: 21.1400, lng: 79.0500, label: "Trimurti Nagar Central Store", city: "Nagpur", state: "Maharashtra", postal: "440022" },
    { lat: 21.2500, lng: 79.1500, label: "NH-7 Highway Auto Parts & Tyres", city: "Nagpur", state: "Maharashtra", postal: "440026" },
    { lat: 21.0900, lng: 79.0600, label: "Besa Wholesale Parts Depot", city: "Nagpur", state: "Maharashtra", postal: "440034" },
  ],
};

const BREAKDOWN_SPOTS = [
  { lat: 21.1458, lng: 79.0882, label: "Sitabuldi Main Sq" },
  { lat: 21.1520, lng: 79.0780, label: "Dharampeth Ring Rd" },
  { lat: 21.1380, lng: 79.0650, label: "Trimurti Nagar Flyover" },
  { lat: 21.1650, lng: 79.1000, label: "Sadar Market Entry" },
  { lat: 21.1250, lng: 79.1150, label: "Nandanvan NH Junction" },
  { lat: 21.1100, lng: 79.0550, label: "Hingna Bypass Turn" },
  { lat: 21.1750, lng: 79.0950, label: "Kamptee Bridge" },
  { lat: 21.0900, lng: 79.0450, label: "Besa Outer Ring" },
  { lat: 21.1900, lng: 79.1100, label: "Amravati Road NH" },
  { lat: 21.1350, lng: 79.0400, label: "Manewada Junction" },
  { lat: 21.1580, lng: 79.0550, label: "Ring Road West" },
  { lat: 21.1200, lng: 79.0900, label: "Pratap Nagar Signal" },
  { lat: 21.1450, lng: 79.1300, label: "Nari Road" },
  { lat: 21.1680, lng: 79.0820, label: "Civil Lines" },
  { lat: 21.1020, lng: 79.0750, label: "Wadi Main Road" },
];

// ─── Static catalogs ────────────────────────────────────────

const CAR_CATALOG = [
  {
    company: "Maruti Suzuki",
    models: [
      {
        name: "Swift", variants: [
          { name: "LXi", year: 2022, fuel: "petrol", tx: "manual" },
          { name: "VXi", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "ZXi", year: 2024, fuel: "petrol", tx: "automatic" },
          { name: "ZXi+", year: 2024, fuel: "petrol", tx: "automatic" },
        ]
      },
      {
        name: "Baleno", variants: [
          { name: "Delta", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "Alpha", year: 2024, fuel: "petrol", tx: "automatic" },
        ]
      },
      {
        name: "WagonR", variants: [
          { name: "LXi CNG", year: 2023, fuel: "cng", tx: "manual" },
          { name: "VXi", year: 2024, fuel: "petrol", tx: "automatic" },
        ]
      },
      {
        name: "Brezza", variants: [
          { name: "LXi", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "ZXi", year: 2024, fuel: "petrol", tx: "automatic" },
        ]
      },
      {
        name: "Ertiga", variants: [
          { name: "VXi", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "ZXi CNG", year: 2024, fuel: "cng", tx: "manual" },
        ]
      },
    ],
  },
  {
    company: "Hyundai",
    models: [
      {
        name: "i20", variants: [
          { name: "Magna", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "Sportz", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "Asta", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
      {
        name: "Creta", variants: [
          { name: "EX", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "SX", year: 2024, fuel: "diesel", tx: "automatic" },
          { name: "SX+", year: 2024, fuel: "petrol", tx: "automatic" },
        ]
      },
      {
        name: "Venue", variants: [
          { name: "S", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "SX", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
      {
        name: "Verna", variants: [
          { name: "S+", year: 2024, fuel: "petrol", tx: "automatic" },
        ]
      },
    ],
  },
  {
    company: "Tata",
    models: [
      {
        name: "Nexon", variants: [
          { name: "Smart", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "Creative+", year: 2024, fuel: "diesel", tx: "automatic" },
          { name: "EV Max LR", year: 2024, fuel: "electric", tx: "automatic" },
        ]
      },
      {
        name: "Punch", variants: [
          { name: "Pure", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "Adventure", year: 2024, fuel: "petrol", tx: "automatic" },
        ]
      },
      {
        name: "Harrier", variants: [
          { name: "Smart", year: 2023, fuel: "diesel", tx: "manual" },
          { name: "Adventure", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
      {
        name: "Tiago", variants: [
          { name: "XE", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "XM", year: 2024, fuel: "cng", tx: "manual" },
        ]
      },
    ],
  },
  {
    company: "Mahindra",
    models: [
      {
        name: "Thar", variants: [
          { name: "LX", year: 2023, fuel: "diesel", tx: "manual" },
          { name: "LX AT", year: 2024, fuel: "diesel", tx: "automatic" },
          { name: "Roxx", year: 2024, fuel: "petrol", tx: "automatic" },
        ]
      },
      {
        name: "XUV700", variants: [
          { name: "MX", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "AX7 L", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
      {
        name: "Scorpio N", variants: [
          { name: "Z4", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "Z8 L", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
      {
        name: "Bolero Camper", variants: [
          { name: "Standard", year: 2023, fuel: "diesel", tx: "manual" },
        ]
      },
    ],
  },
  {
    company: "Honda",
    models: [
      {
        name: "City", variants: [
          { name: "V", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "ZX", year: 2024, fuel: "petrol", tx: "automatic" },
          { name: "e:HEV", year: 2024, fuel: "hybrid", tx: "automatic" },
        ]
      },
      {
        name: "Amaze", variants: [
          { name: "S", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "VX", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
      {
        name: "Elevate", variants: [
          { name: "S", year: 2024, fuel: "petrol", tx: "manual" },
          { name: "ZX", year: 2024, fuel: "petrol", tx: "automatic" },
        ]
      },
    ],
  },
  {
    company: "Toyota",
    models: [
      {
        name: "Fortuner", variants: [
          { name: "4x2 MT", year: 2023, fuel: "diesel", tx: "manual" },
          { name: "4x4 AT", year: 2024, fuel: "diesel", tx: "automatic" },
          { name: "Legender", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
      {
        name: "Innova Crysta", variants: [
          { name: "GX", year: 2023, fuel: "diesel", tx: "manual" },
          { name: "VX", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
      {
        name: "Glanza", variants: [
          { name: "S", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "V", year: 2024, fuel: "petrol", tx: "automatic" },
        ]
      },
    ],
  },
  {
    company: "Kia",
    models: [
      {
        name: "Seltos", variants: [
          { name: "HTK", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "GTX Plus", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
      {
        name: "Sonet", variants: [
          { name: "HTK", year: 2023, fuel: "petrol", tx: "manual" },
          { name: "GTX+", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
      {
        name: "Carens", variants: [
          { name: "Premium", year: 2024, fuel: "petrol", tx: "manual" },
          { name: "Luxury+", year: 2024, fuel: "diesel", tx: "automatic" },
        ]
      },
    ],
  },
];

const PART_CATALOG = [
  {
    category: "Engine Parts", parts: [
      "Engine Oil Filter",
      "Spark Plug Set (NGK, Set of 4)",
      "Air Filter (OEM)",
      "Timing Belt Kit",
      "Piston Ring Set (STD)",
      "Valve Cover Gasket",
      "Crankshaft Pulley",
      "Intake Manifold Gasket",
      "Fuel Injector (OEM)",
      "Throttle Body Sensor",
    ]
  },
  {
    category: "Brake System", parts: [
      "Brake Pad Set Front (Bosch)",
      "Brake Pad Set Rear (Bosch)",
      "Brake Disc Rotor Front",
      "Brake Disc Rotor Rear",
      "Brake Fluid DOT4 500ml",
      "Brake Caliper Assembly",
      "Master Cylinder",
      "ABS Sensor",
      "Brake Hose Rear",
      "Handbrake Cable",
    ]
  },
  {
    category: "Electrical & Battery", parts: [
      "Car Battery 12V 65Ah (Amaron)",
      "Car Battery 12V 75Ah (Exide)",
      "Alternator (OEM)",
      "Starter Motor",
      "Headlight Bulb Set H4 (Philips)",
      "Fuse Box Assembly",
      "Ignition Switch",
      "Horn (Minda)",
      "Wiper Motor Front",
      "Relay Module",
      "ECU (Engine Control Unit)",
      "Oxygen Sensor",
    ]
  },
  {
    category: "Suspension & Steering", parts: [
      "Shock Absorber Front (Monroe)",
      "Shock Absorber Rear (Monroe)",
      "Coil Spring Front",
      "Coil Spring Rear",
      "Control Arm Lower",
      "Ball Joint Lower",
      "Power Steering Pump",
      "Tie Rod End",
      "Stabilizer Link Bar",
      "Strut Mount Bearing",
    ]
  },
  {
    category: "Filters & Fluids", parts: [
      "Engine Oil 5W-30 Synthetic 4L (Castrol)",
      "Engine Oil 10W-40 Semi-Synthetic 4L",
      "AC Cabin Filter",
      "Transmission Fluid ATF (1L)",
      "Power Steering Fluid 500ml",
      "Engine Coolant Long Life 1L",
      "Windshield Washer Fluid 1L",
      "Brake Flush Kit",
    ]
  },
  {
    category: "Body & Exterior", parts: [
      "Side Mirror Assembly Left",
      "Side Mirror Assembly Right",
      "Front Bumper Assembly",
      "Rear Bumper Assembly",
      "Windshield Wiper Blade Pair",
      "Door Handle Front Left",
      "Door Handle Front Right",
      "Bonnet Gas Strut",
      "Headlight Assembly Left (OEM)",
      "Tail Light Assembly Right",
    ]
  },
  {
    category: "Cooling System", parts: [
      "Radiator (OEM)",
      "Coolant Thermostat",
      "Water Pump",
      "Radiator Upper Hose",
      "Radiator Lower Hose",
      "Cooling Fan Assembly",
      "Expansion Tank",
    ]
  },
  {
    category: "Transmission", parts: [
      "Clutch Plate Assembly",
      "Clutch Bearing (Release Bearing)",
      "Flywheel",
      "CV Joint Boot Kit",
      "Gear Oil 75W-90 1L",
      "Drive Shaft Assembly",
      "Gearshift Cable",
    ]
  },
  {
    category: "Tyres & Wheels", parts: [
      "Tubeless Tyre 185/65R15",
      "Tubeless Tyre 195/65R15",
      "Tubeless Tyre 215/60R17",
      "Alloy Wheel 15 inch (Set 4)",
      "Alloy Wheel 16 inch (Set 4)",
      "Wheel Bearing Front",
      "Wheel Bearing Rear",
      "Tyre Valve Stem Set",
      "Wheel Nut Set (20 pcs)",
      "Spare Tyre (Crossply 135/70R15)",
    ]
  },
];

// ─── Part unit cost reference (₹) ───────────────────────────
const PART_COST_RANGES = {
  "Engine Parts": [ 200, 6500 ],
  "Brake System": [ 300, 5500 ],
  "Electrical & Battery": [ 150, 15000 ],
  "Suspension & Steering": [ 500, 9500 ],
  "Filters & Fluids": [ 80, 900 ],
  "Body & Exterior": [ 400, 22000 ],
  "Cooling System": [ 200, 7000 ],
  "Transmission": [ 600, 12000 ],
  "Tyres & Wheels": [ 600, 18000 ],
};


// ─── Main Seeder ────────────────────────────────────────────

async function main ()
{
  console.log( "══════════════════════════════════════════════════════════════" );
  console.log( "  🌱 Seeding Comprehensive Test Data into Neon DB..." );
  console.log( "  🔑 Default Password: " + PASSWORD );
  console.log( "══════════════════════════════════════════════════════════════\n" );

  const hashedPassword = await bcrypt.hash( PASSWORD, SALT_ROUNDS );

  // ─── 0. Reset sequences if needed (PostgreSQL specific, optional) ───

  // ─── 1. Core Catalog: Companies, Models, Variants ───────────
  console.log( "🚗 Seeding Car Catalog..." );
  const dbCompanies = [];
  const dbVariants = [];
  for ( const comp of CAR_CATALOG )
  {
    const c = await prisma.carCompany.upsert( {
      where: { company_name: comp.company },
      update: {}, create: { company_name: comp.company }
    } );
    dbCompanies.push( c );

    for ( const mod of comp.models )
    {
      const m = await prisma.carModel.upsert( {
        where: { company_id_model_name: { company_id: c.company_id, model_name: mod.name } },
        update: {}, create: { company_id: c.company_id, model_name: mod.name }
      } );

      for ( const v of mod.variants )
      {
        const variant = await prisma.carVariant.upsert( {
          where: { model_id_variant_name_year: { model_id: m.model_id, variant_name: v.name, year: v.year } },
          update: {}, create: {
            model_id: m.model_id, variant_name: v.name, year: v.year,
            fuel_type: v.fuel, transmission: v.tx
          }
        } );
        dbVariants.push( variant );
      }
    }
  }
  console.log( `   ✅ Brands: ${ dbCompanies.length } | Variants: ${ dbVariants.length }` );

  // ─── 2. Core Catalog: Part Categories & Parts ───────────────
  console.log( "⚙️  Seeding Parts Catalog..." );
  const dbParts = [];
  for ( const cat of PART_CATALOG )
  {
    const c = await prisma.carPartCategory.upsert( {
      where: { category_name: cat.category },
      update: {}, create: { category_name: cat.category }
    } );

    for ( const partName of cat.parts )
    {
      let p = await prisma.carPart.findFirst( { where: { part_name: partName, category_id: c.category_id } } );
      if ( !p )
      {
        p = await prisma.carPart.create( {
          data: { category_id: c.category_id, part_name: partName }
        } );
      }
      dbParts.push( p );

      // Add dummy prices across variants
      const range = PART_COST_RANGES[ cat.category ] || [ 200, 5000 ];
      const selectedVariants = [ ...dbVariants ].sort( () => 0.5 - Math.random() ).slice( 0, 5 );
      for ( const sv of selectedVariants )
      {
        try
        {
          await prisma.partPrice.upsert( {
            where: { part_id_variant_id: { part_id: p.part_id, variant_id: sv.variant_id } },
            update: {},
            create: { part_id: p.part_id, variant_id: sv.variant_id, price: int( range[ 0 ], range[ 1 ] ) }
          } );
        } catch { /* skip duplicate */ }
      }
    }
  }
  console.log( `   ✅ Categories: ${ PART_CATALOG.length } | Parts: ${ dbParts.length }` );

  // ─── 3. Users & Vehicles ────────────────────────────────────
  console.log( "👥 Seeding Admin & Users..." );
  const admin = await upsertUser( {
    user_id: uuid(), full_name: "Quick Assist Admin", email: "admin@quickassist.com",
    phone_number: "9000000000", password: hashedPassword, role: "admin"
  } );

  const users = [];
  const userVehicles = [];
  const userNames = [
    "Aarav Sharma", "Priya Patel", "Rohan Mehta", "Sneha Deshmukh", "Vikram Singh",
    "Ananya Joshi", "Karan Gupta", "Meera Iyer", "Arjun Reddy", "Divya Nair",
    "Siddharth Kapoor", "Nisha Agarwal", "Rahul Verma", "Kajal Tiwari", "Aditya Bose"
  ];

  for ( let i = 0; i < userNames.length; i++ )
  {
    const u = await upsertUser( {
      user_id: uuid(), full_name: userNames[ i ], email: `user${ i + 1 }@test.com`,
      phone_number: `9100000${ i.toString().padStart( 3, '0' ) }`, password: hashedPassword,
      role: "user"
    } );
    users.push( u );

    // Give each user 1 or 2 cars
    const carCount = i % 3 === 0 ? 2 : 1;
    for ( let c = 0; c < carCount; c++ )
    {
      const vnt = pick( dbVariants );
      const reg = `MH31${ String.fromCharCode( 65 + c ) }${ String.fromCharCode( 65 + i % 26 ) }${ 1000 + i * 10 + c }`;
      try
      {
        const uv = await prisma.userVehicle.create( {
          data: {
            vehicle_id: uuid(), user_id: u.user_id, variant_id: vnt.variant_id,
            registration_number: reg, vin_number: `VIN${ Date.now() }${ c }${ i }`
          }
        } );
        userVehicles.push( { uv, owner: u } );
      } catch ( e ) { /* ignore collision */ }
    }
  }
  console.log( `   ✅ Users: 15 | Vehicles registered: ${ userVehicles.length }` );

  // ─── 4. Technicians & Profiles ──────────────────────────────
  console.log( "🔧 Seeding Technicians..." );
  const techNames = [
    [ "Rajesh Auto Care", "Rajesh Kumar", "individual" ],
    [ "AutoFix Garage", "Speedy Motors", "garage" ],
    [ "Sanjay Repair Help", "Sanjay Patil", "individual" ],
    [ "SpeedWrench Workshop", "Amit Verma", "garage" ],
    [ "MechPro Services", "MechPro", "garage" ],
    [ "Deepak Emergency Fix", "Deepak Tiwari", "individual" ],
    [ "QuickFix 24/7 Garage", "QuickFix", "garage" ],
    [ "City Auto Services", "Rakesh Sharma", "individual" ],
    [ "Reliable Motors Hub", "Anil Chauhan", "garage" ],
    [ "Kishore Roadside Help", "Kishore Jadhav", "individual" ],
  ];

  const dbTechs = []; // Array of { profile, user } objects
  for ( let i = 0; i < techNames.length; i++ )
  {
    const [ biz, name, type ] = techNames[ i ];
    const loc = NAGPUR_LOCATIONS.technicians[ i ];
    const t = await upsertUser( {
      user_id: uuid(), full_name: name, email: `tech${ i + 1 }@test.com`,
      phone_number: `9200000${ i.toString().padStart( 3, '0' ) }`, password: hashedPassword,
      role: "technician"
    } );

    const isVerified = i !== 5; // one unverified
    const tp = await prisma.technicianProfile.upsert( {
      where: { user_id: t.user_id },
      update: {},
      create: {
        technician_id: uuid(), user_id: t.user_id, business_name: biz, technician_type: type,
        location: loc.label, latitude: loc.lat, longitude: loc.lng, service_radius: loc.radius,
        rating: ( Math.random() * ( 5 - 3.5 ) + 3.5 ).toFixed( 1 ), total_reviews: int( 5, 120 ),
        is_verified: isVerified, is_online: Math.random() > 0.2
      }
    } );

    // Support a few random car brands
    const supportedBrands = [ ...dbCompanies ].sort( () => 0.5 - Math.random() ).slice( 0, type === 'garage' ? 7 : 3 );
    for ( const b of supportedBrands )
    {
      try
      {
        await prisma.technicianCarSupport.create( {
          data: { technician_id: tp.technician_id, company_id: b.company_id }
        } );
      } catch { /* skip */ }
    }

    // Assign skills (random parts)
    const skills = [ ...dbParts ].sort( () => 0.5 - Math.random() ).slice( 0, type === 'garage' ? 30 : 15 );
    for ( const s of skills )
    {
      try
      {
        await prisma.technicianPartSkill.create( {
          data: { technician_id: tp.technician_id, part_id: s.part_id }
        } );
      } catch { /* skip */ }
    }

    // Certifications for verified
    if ( isVerified )
    {
      for ( let x = 0; x < int( 1, 2 ); x++ )
      {
        await prisma.technicianCertification.create( {
          data: {
            technician_id: tp.technician_id, certification: `Certified Auto Mech ${ x + 1 }`,
            issued_by: "AutoSkill India", issue_date: daysAgo( int( 100, 500 ) )
          }
        } );
      }
    }
    dbTechs.push( { profile: tp, user: t } );
  }
  console.log( `   ✅ Technicians: 10 (with profiles, skills, certs)` );

  // ─── 5. Vendors, Warehouses, & Inventory ────────────────────
  console.log( "🏭 Seeding Vendors & Inventory..." );
  const vendorBiz = [ "AutoParts Hub", "Mega Spares", "Nagpur Auto Components", "SpeedStore Retail" ];
  const dbVendors = [];
  const dbWarehouses = [];

  for ( let i = 0; i < vendorBiz.length; i++ )
  {
    const isVerified = i !== 0;
    const v = await upsertUser( {
      user_id: uuid(), full_name: vendorBiz[ i ], email: `vendor${ i + 1 }@test.com`,
      phone_number: `9300000${ i.toString().padStart( 3, '0' ) }`, password: hashedPassword,
      role: "vendor",
      is_verified: isVerified
    } );
    dbVendors.push( v );

    // Give each vendor 1 or 2 warehouses
    const numWh = i < 2 ? 2 : 1;
    for ( let w = 0; w < numWh; w++ )
    {
      const loc = NAGPUR_LOCATIONS.warehouses.pop(); // consume from static list
      if ( !loc ) break;
      const wh = await prisma.warehouse.create( {
        data: {
          warehouse_id: uuid(), vendor_id: v.user_id, name: loc.label, address: loc.label,
          city: loc.city, state: loc.state, postal_code: loc.postal,
          latitude: loc.lat, longitude: loc.lng, phone: `94000${ int( 10000, 99999 ) }`
        }
      } );
      dbWarehouses.push( wh );

      // Stock up 80% of catalog in each warehouse
      const stockParts = [ ...dbParts ].sort( () => 0.5 - Math.random() ).slice( 0, Math.floor( dbParts.length * 0.8 ) );
      for ( const sp of stockParts )
      {
        await prisma.inventory.create( {
          data: {
            inventory_id: uuid(), warehouse_id: wh.warehouse_id, part_id: sp.part_id,
            quantity_available: int( 5, 50 ), quantity_reserved: 0,
            unit_cost: int( 150, 6000 ), reorder_level: int( 2, 8 )
          }
        } );
      }
    }
  }
  console.log( `   ✅ Vendors: ${ dbVendors.length } | Warehouses: ${ dbWarehouses.length } (Fully stocked)` );

  // ─── 6. Service Requests & Jobs flow ────────────────────────
  console.log( "🛠️  Seeding Service Requests, Offers, Jobs & Invoices..." );
  let reqs = 0, offers = 0, jobs = 0, invoices = 0;

  for ( const uv of userVehicles )
  {
    const numReqs = Math.random() > 0.5 ? 2 : 1; // 1-2 requests per car
    for ( let r = 0; r < numReqs; r++ )
    {
      const isCompleted = Math.random() > 0.3;     // 70% completed jobs, 30% pending/in-progress
      const issue = pick( [ "mechanical_failure", "electrical_issue", "tire_related", "battery_issue", "engine_problem", "brake_issue" ] );
      const brk = pick( BREAKDOWN_SPOTS );

      const status = isCompleted ? "completed" : pick( [ "created", "pending_offers", "in_progress" ] );
      const reqDate = daysAgo( int( 1, 40 ) );

      const req = await prisma.serviceRequest.create( {
        data: {
          request_id: uuid(), user_id: uv.owner.user_id, vehicle_id: uv.uv.vehicle_id,
          issue_description: `Experiencing ${ issue.replace( '_', ' ' ) } near ${ brk.label }. Car stalled.`, issue_type: issue,
          breakdown_latitude: brk.lat, breakdown_longitude: brk.lng,
          service_location_type: pick( [ "roadside", "home", "office" ] ),
          requires_towing: Math.random() > 0.7, status, created_at: reqDate, updated_at: reqDate
        }
      } );
      reqs++;

      if ( status !== "created" )
      {
        // Create 2-3 offers
        const numOff = int( 2, 3 );
        const randTechs = [ ...dbTechs ].sort( () => 0.5 - Math.random() ).slice( 0, numOff );
        let acceptedOffer = null;
        let selectedTech = null;

        for ( let i = 0; i < randTechs.length; i++ )
        {
          const isWinner = ( status !== "pending_offers" && i === 0 );
          const off = await prisma.technicianOffer.create( {
            data: {
              offer_id: uuid(), request_id: req.request_id, technician_id: randTechs[ i ].profile.technician_id,
              repair_mode: pick( [ "onsite", "tow_to_garage" ] ), estimated_cost: int( 500, 8000 ), estimated_time: int( 30, 180 ),
              message: `Hi, I can fix your ${ issue }.`,
              status: isWinner ? "accepted" : ( status !== "pending_offers" ? "rejected" : "pending" )
            }
          } );
          offers++;
          if ( isWinner ) { acceptedOffer = off; selectedTech = randTechs[ i ]; }
        }

        // Create job if accepted
        if ( acceptedOffer && [ "in_progress", "completed" ].includes( status ) )
        {
          const job = await prisma.job.create( {
            data: {
              job_id: uuid(), request_id: req.request_id, technician_id: selectedTech.profile.technician_id,
              offer_id: acceptedOffer.offer_id, status: status === "completed" ? "completed" : "in_progress",
              started_at: hoursAgo( int( 4, 24 ) ), completed_at: status === "completed" ? hoursAgo( int( 1, 3 ) ) : null
            }
          } );
          jobs++;

          // Create invoice and review for completed job
          if ( status === "completed" )
          {
            const labor = int( 300, 1500 );
            const partCost = int( 1000, 6000 );
            const tax = ( labor + partCost ) * 0.18;
            await prisma.invoice.create( {
              data: {
                invoice_id: uuid(), job_id: job.job_id, subtotal: labor + partCost, tax: tax, total: labor + partCost + tax,
                payment_status: "completed", payment_method: "upi", transaction_id: `TXN-SRV-${ Date.now() }${ reqs }${ r }`,
                issued_at: hoursAgo( int( 1, 3 ) ), paid_at: hoursAgo( 1 ),
                items: {
                  create: [
                    { item_type: "labor", description: "Diagnosis & Repair fees", quantity: 1, unit_price: labor, total_price: labor },
                    { item_type: "part", description: "Replacement Parts", quantity: 1, unit_price: partCost, total_price: partCost }
                  ]
                }
              }
            } );
            invoices++;

            await prisma.review.create( {
              data: {
                review_id: uuid(), user_id: uv.owner.user_id, job_id: job.job_id, technician_id: selectedTech.profile.technician_id,
                rating: int( 3, 5 ), comment: pick( [ "Great service!", "Fast and reliable.", "Saved me on the highway!" ] )
              }
            } );

            // Admin Payout to Tech
            await prisma.payout.create( {
              data: {
                recipient_id: selectedTech.user.user_id, recipient_role: "technician", amount: labor + partCost,
                month: new Date().getMonth() + 1, year: new Date().getFullYear(), status: "completed",
                source_type: "invoice", source_id: job.job_id, payment_method: "bank_transfer", paid_at: new Date()
              }
            } );
          }
        }
      }
    }
  }
  console.log( `   ✅ Reqs: ${ reqs } | Offers: ${ offers } | Jobs: ${ jobs } | Invoices: ${ invoices } | Reviews & Payouts linked` );

  // ─── 7. Orders & Fulfillments ───────────────────────────────
  console.log( "📦 Seeding Parts Orders..." );
  let oCount = 0;
  for ( const u of users )
  {
    // 30% users place parts orders
    if ( Math.random() > 0.7 )
    {
      const wh = pick( dbWarehouses );
      const isDelivered = Math.random() > 0.4;
      const oStatus = isDelivered ? "delivered" : pick( [ "pending", "confirmed", "shipped" ] );
      const sub = int( 800, 15000 );
      const tt = sub * 1.18;

      const order = await prisma.order.create( {
        data: {
          order_id: uuid(), order_number: `ORD-${ Date.now() }-${ u.user_id.slice( 0, 4 ) }`, user_id: u.user_id, warehouse_id: wh.warehouse_id,
          delivery_address: NAGPUR_LOCATIONS.users[ int( 0, 14 ) ].label + ", Nagpur", delivery_phone: u.phone_number,
          subtotal: sub, tax: sub * 0.18, total: tt, payment_status: oStatus === "pending" ? "pending" : "completed",
          order_status: oStatus, payment_method: oStatus !== "pending" ? pick( [ "upi", "card" ] ) : null,
          transaction_id: oStatus !== "pending" ? `TXN-ORD-${ Date.now() }` : null, created_at: daysAgo( int( 2, 10 ) ),
          items: {
            create: [
              { part_id: pick( dbParts ).part_id, quantity: int( 1, 4 ), unit_price: sub / 2, total_price: sub / 2 },
              { part_id: pick( dbParts ).part_id, quantity: int( 1, 2 ), unit_price: sub / 2, total_price: sub / 2 }
            ]
          }
        }
      } );
      oCount++;

      if ( [ "shipped", "delivered" ].includes( oStatus ) )
      {
        await prisma.fulfillment.create( {
          data: {
            fulfillment_id: uuid(), order_id: order.order_id, status: oStatus === "delivered" ? "delivered" : "shipped",
            tracking_number: `AWB${ Date.now() }`, carrier: "Delhivery", shipped_at: daysAgo( int( 1, 2 ) ),
            delivered_at: oStatus === "delivered" ? daysAgo( 0 ) : null
          }
        } );

        // Payout to Vendor for delivered goods
        if ( oStatus === "delivered" )
        {
          await prisma.payout.create( {
            data: {
              recipient_id: wh.vendor_id, recipient_role: "vendor", amount: tt * 0.9, // Admin takes 10% platform fee
              month: new Date().getMonth() + 1, year: new Date().getFullYear(), status: "completed",
              source_type: "order", source_id: order.order_id, payment_method: "bank_transfer", paid_at: new Date()
            }
          } );
        }
      }
    }
  }
  console.log( `   ✅ Orders: ${ oCount } (With fulfillments & vendor payouts)` );

  // ─── 8. Notifications ───────────────────────────────────────
  console.log( "🔔 Distributing Notifications..." );
  const allUserIds = [
    ...users.map( u => u.user_id ),
    ...dbTechs.map( t => t.user.user_id ),
    ...dbVendors.map( v => v.user_id ),
  ];
  for ( const uid of allUserIds )
  {
    await prisma.notification.createMany( {
      data: [
        { notification_id: uuid(), user_id: uid, type: "system", title: "Welcome!", message: "Welcome to AutoAssist360", created_at: daysAgo( 10 ) },
        { notification_id: uuid(), user_id: uid, type: "system", title: "Security Alert", message: "New login from unknown device", created_at: daysAgo( 2 ) }
      ]
    } );
  }
  console.log( `   ✅ Notifications deployed across accounts` );

  // ─── Finish ─────────────────────────────────────────────────
  console.log( "══════════════════════════════════════════════════════════════" );
  console.log( "  🎉 SEED COMPLETE! Your database is heavily populated." );
  console.log( "  📋 Login quick references (Role: Email Password) " );
  console.log( "     Admin:      admin@quickassist.com     Test@1234" );
  console.log( "     User:       user1@test.com            Test@1234" );
  console.log( "     Tech:       tech1@test.com            Test@1234" );
  console.log( "     Vendor:     vendor1@test.com          Test@1234" );
  console.log( "══════════════════════════════════════════════════════════════" );

}

main()
  .then( () => prisma.$disconnect() )
  .catch( ( e ) =>
  {
    console.error( "❌ Seed failed:", e );
    prisma.$disconnect();
    process.exit( 1 );
  } );

