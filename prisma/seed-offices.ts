import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const OFFICES = [
  "EU - Atlas Investments P Ltd",
  "EU - Renoir Consulting (UK) Limited",
  "EU - Renoir Mauritius",
  "EU - Shenkuo France",
  "EU - YCP Netherlands",
  "GC - Renoir Consulting (Hk) Private Limited",
  "GC - Shenkuo Hong Kong",
  "GC - Shenkuo Shanghai",
  "GC - YCP Holdings (Hong Kong)",
  "GC - YCP Hong Kong",
  "GC - YCP Investment",
  "GC - YCP Shanghai",
  "GC - YCP Taiwan",
  "IN - Consus India",
  "IN - Renoir Management Consulting (India) Pvt Ltd",
  "IN - YCP Auctus",
  "JP - Green Impact Labs, Inc",
  "JP - YCP Japan",
  "ME - ESG Integrate Fze",
  "ME - Renoir Consulting Sole Proprietorship LLC",
  "NA - Consus Canada",
  "NA - Consus US",
  "NA - Renoir Brasil Ltda",
  "NA - Renoir Management Corporation",
  "NA - YCP US",
  "SEA - Consus Malaysia",
  "SEA - Consus Singapore",
  "SEA - PT Renoir Consulting Indonesia",
  "SEA - Renoir Consulting (Malaysia) Sdn Bhd",
  "SEA - Renoir Consulting (Singapore) Pte Ltd",
  "SEA - Renoir Holdings Pte. Ltd",
  "SEA - Renoir Implementation Services Inc",
  "SEA - Unison Mining Consulting Pte Ltd",
  "SEA - YCP Holdings (Singapore)",
  "SEA - YCP Indonesia",
  "SEA - YCP Malaysia",
  "SEA - YCP Myanmar",
  "SEA - YCP Philippines",
  "SEA - YCP Singapore",
  "SEA - YCP Thailand",
  "SEA - YCP Vietnam",
  "UAE - Consus Dubai",
  "YCP Solidiance India",
  "YCP Solidiance Lebanon",
  "YCP Solidiance United Arab Emirates",
]

async function main() {
  console.log("🌱  Seeding offices…")
  for (const name of OFFICES) {
    await prisma.office.upsert({
      where: { name },
      create: { name },
      update: {},
    })
  }
  console.log(`✅  ${OFFICES.length} offices seeded`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
