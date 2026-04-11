import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const latestRequests = await prisma.serviceRequest.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    include: {
      user: { select: { email: true, full_name: true } },
      media: true
    }
  });

  const techs = await prisma.technicianProfile.findMany({
    take: 2,
    include: { user: { select: { email: true, full_name: true } } }
  });

  console.log("=== Latest 5 Requests ===");
  latestRequests.forEach(req => {
    console.log(`ID: ${req.request_id} | Status: ${req.status} | User: ${req.user.email} | Lat/Lng: ${req.breakdown_latitude}, ${req.breakdown_longitude}`);
  });

  console.log("\n=== Technicians ===");
  techs.forEach(tech => {
    console.log(`Tech: ${tech.user.email} | Profile Lat/Lng: ${tech.latitude}, ${tech.longitude} | Radius: ${tech.service_radius}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
