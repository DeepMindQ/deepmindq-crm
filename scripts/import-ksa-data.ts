/**
 * import-ksa-data.ts
 *
 * Imports "Total KSA data40K IN.xlsx" into the Neon PostgreSQL database.
 * Reads the Excel file, creates unique Companies first, then links Contacts.
 * Uses batched inserts (500 per batch) for performance.
 *
 * Excel columns → DB mapping:
 *   Col 0:  Contact First Name     → Contact.rawName (First + Last)
 *   Col 1:  Contact Last Name
 *   Col 2:  Contact Email          → Contact.email
 *   Col 3:  Contact Title          → Contact.title
 *   Col 4:  Contact Department     → Contact.role
 *   Col 5:  Contact LinkedIn       → Contact.linkedinUrl
 *   Col 6:  Company Name           → Company.rawName
 *   Col 7:  Company Website        → Company.domain / Company.website
 *   Col 8:  Company Employees Cat  → Company.sizeRange
 *   Col 9:  Company Employees Num  → (stored in tags JSON)
 *   Col 10: Company Industry      → Company.industry
 *   Col 11: Company LinkedIn      → (stored in tags JSON)
 *   Col 12: Company HQ Address 1   → Company.location
 *   Col 13: Company HQ Address 2
 *   Col 14: Company HQ City       → Company.location (combined)
 *   Col 15: Company HQ State
 *   Col 16: Company HQ ZIP Code
 *   Col 17: Company HQ Country     → Company.country
 *   Col 18: Contact (phone?)       → Contact.phone
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import crypto from "crypto";

const NEON_URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!;

const prisma = new PrismaClient({
  datasources: { db: { url: NEON_URL } },
  log: ["error"],
});

const FILE_PATH = "/home/z/my-project/upload/Total KSA data40K IN.xlsx";
const BATCH_SIZE = 500;

function normalize(s: string | null | undefined): string {
  return (s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function makeCuid(): string {
  return crypto.randomBytes(12).toString("hex").slice(0, 24);
}

async function main() {
  console.log(`📄 Reading Excel: ${FILE_PATH}`);
  const t0 = Date.now();

  // 1. Read Excel
  const workbook = XLSX.readFile(FILE_PATH, { type: "file" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as (string | number | null)[][];

  const header = rows[0] as string[];
  const dataRows = rows.slice(1);
  console.log(`📊 Total rows: ${dataRows.length}`);

  // 2. Create ImportBatch
  const batchId = makeCuid();
  const batch = await prisma.importBatch.create({
    data: {
      id: batchId,
      fileName: "Total KSA data40K IN.xlsx",
      fileHash: crypto.createHash("sha256").update(batchId).digest("hex"),
      totalRows: dataRows.length,
      acceptedRows: 0,
      status: "processing",
    },
  });
  console.log(`📦 ImportBatch: ${batch.id}`);

  // 3. Parse rows → unique companies + contacts
  const companyMap = new Map<string, {
    name: string;
    domain: string;
    website: string;
    sizeRange: string;
    empNum: string;
    industry: string;
    linkedin: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }>();

  const contacts: {
    firstName: string;
    lastName: string;
    email: string;
    title: string;
    dept: string;
    linkedin: string;
    phone: string;
    companyNormalizedName: string;
  }[] = [];

  let skippedNoEmail = 0;
  let skippedNoCompany = 0;
  let skippedNoName = 0;

  for (const row of dataRows) {
    const firstName = String(row[0] || "").trim();
    const lastName = String(row[1] || "").trim();
    const email = String(row[2] || "").trim().toLowerCase();
    const title = String(row[3] || "").trim();
    const dept = String(row[4] || "").trim();
    const linkedin = String(row[5] || "").trim();
    const companyName = String(row[6] || "").trim();
    const website = String(row[7] || "").trim();
    const sizeRange = String(row[8] || "").trim();
    const empNum = String(row[9] || "").trim();
    const industry = String(row[10] || "").trim();
    const companyLinkedin = String(row[11] || "").trim();
    const addr1 = String(row[12] || "").trim();
    const addr2 = String(row[13] || "").trim();
    const city = String(row[14] || "").trim();
    const state = String(row[15] || "").trim();
    const zip = String(row[16] || "").trim();
    const country = String(row[17] || "").trim();
    const phone = String(row[18] || "").trim();

    if (!email) { skippedNoEmail++; continue; }
    if (!companyName) { skippedNoCompany++; continue; }
    if (!firstName && !lastName) { skippedNoName++; continue; }

    const companyNorm = normalize(companyName);
    if (!companyMap.has(companyNorm)) {
      const domain = website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
      const location = [addr1, addr2, city, state, zip].filter(Boolean).join(", ").trim();
      companyMap.set(companyNorm, {
        name: companyName,
        domain,
        website: website.startsWith("http") ? website : `https://${website}`,
        sizeRange,
        empNum,
        industry,
        linkedin: companyLinkedin,
        address: addr1,
        city,
        state,
        zip,
        country,
      });
    }

    contacts.push({
      firstName,
      lastName,
      email,
      title,
      dept,
      linkedin,
      phone,
      companyNormalizedName: companyNorm,
    });
  }

  console.log(`🏢 Unique companies: ${companyMap.size}`);
  console.log(`👥 Valid contacts: ${contacts.length}`);
  console.log(`⏭  Skipped (no email): ${skippedNoEmail}`);
  console.log(`⏭  Skipped (no company): ${skippedNoCompany}`);
  console.log(`⏭  Skipped (no name): ${skippedNoName}`);

  // 4. Insert Companies in batches
  console.log(`\n🔧 Inserting companies...`);
  const companyNames = [...companyMap.values()];
  let companyInserted = 0;

  for (let i = 0; i < companyNames.length; i += BATCH_SIZE) {
    const batch_data = companyNames.slice(i, i + BATCH_SIZE);
    const result = await prisma.company.createMany({
      data: batch_data.map((c) => ({
        id: makeCuid(),
        rawName: c.name,
        normalizedName: normalize(c.name),
        domain: c.domain || null,
        website: c.website || null,
        sizeRange: c.sizeRange || null,
        industry: c.industry || null,
        location: [c.address, c.city, c.state, c.zip].filter(Boolean).join(", ").trim() || null,
        country: c.country || null,
        source: "import",
        tags: JSON.stringify({
          employeeNumber: c.empNum || null,
          companyLinkedIn: c.linkedin || null,
        }),
      })),
      skipDuplicates: true,
    });
    companyInserted += result.count;
    if ((i / BATCH_SIZE) % 20 === 0) {
      console.log(`  Companies: ${Math.min(i + BATCH_SIZE, companyNames.length)}/${companyNames.length}`);
    }
  }
  console.log(`  ✅ Companies inserted: ${companyInserted}`);

  // 5. Fetch created companies → build name→id map
  console.log(`\n🔍 Mapping company names to IDs...`);
  const allCompanies = await prisma.company.findMany({
    select: { id: true, normalizedName: true },
    where: { source: "import" },
  });
  const companyIdMap = new Map<string, string>();
  for (const c of allCompanies) {
    companyIdMap.set(c.normalizedName, c.id);
  }
  console.log(`  Found ${companyIdMap.size} companies in DB`);

  // 6. Insert Contacts in batches
  console.log(`\n🔧 Inserting contacts...`);
  let contactInserted = 0;
  let contactSkipped = 0;

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch_contacts = contacts.slice(i, i + BATCH_SIZE);
    const insertData = [];

    for (const c of batch_contacts) {
      const companyId = companyIdMap.get(c.companyNormalizedName);
      if (!companyId) {
        contactSkipped++;
        continue;
      }

      const rawName = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
      insertData.push({
        id: makeCuid(),
        rawName,
        normalizedName: normalize(rawName),
        email: c.email,
        linkedinUrl: c.linkedin || null,
        title: c.title || null,
        role: c.dept || null,
        phone: c.phone || null,
        companyId,
        batchId,
        source: "cold_list",
        status: "imported",
      });
    }

    if (insertData.length > 0) {
      try {
        const result = await prisma.contact.createMany({
          data: insertData,
          skipDuplicates: true,
        });
        contactInserted += result.count;
      } catch (err: any) {
        console.log(`  ⚠ Batch at ${i} error: ${err.message?.slice(0, 100)}`);
      }
    }

    if ((i / BATCH_SIZE) % 20 === 0) {
      console.log(`  Contacts: ${Math.min(i + BATCH_SIZE, contacts.length)}/${contacts.length}`);
    }
  }
  console.log(`  ✅ Contacts inserted: ${contactInserted}`);
  if (contactSkipped > 0) {
    console.log(`  ⚠ Contacts skipped (no company match): ${contactSkipped}`);
  }

  // 7. Update batch status
  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: "completed",
      acceptedRows: contactInserted,
    },
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n🎉 Import completed in ${elapsed}s`);
  console.log(`   Companies: ${companyInserted}`);
  console.log(`   Contacts: ${contactInserted}`);
  console.log(`   Batch ID: ${batchId}`);
}

main()
  .catch((err) => {
    console.error("❌ Import failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
