#!/bin/bash
# Bulk fix common TypeScript error patterns across the codebase
# These are all Prisma schema drift fixes — field renames and model renames

cd /home/z/my-project

# 1. Fix contact.name → contact.rawName (in template strings where it's just "name")
# But NOT rawName, normalizedName, editedName which are already correct
# This targets: ${contact.name}, contact?.name, contact.name
# Be careful not to replace in comments or strings where 'name' is used generically

# 2. Fix company.name → company.rawName in select fields
find src/ -name "*.ts" -o -name "*.tsx" | while read f; do
  # Fix select: { name: true → rawName: true
  sed -i 's/{ name: true,/{ rawName: true,/g' "$f"
  sed -i 's/{ name: true }/{ rawName: true }/g' "$f"
  # Fix specific known patterns
  sed -i 's/contact\.name\b/contact.rawName/g' "$f"
  sed -i 's/contact\.company\.name\b/contact.company.rawName/g' "$f"
  # Fix company.name → company.rawName in data objects (but not normalizedName, rawName)
  sed -i 's/company\.name\b/company.rawName/g' "$f"
  # Fix in select objects for contacts: name → rawName
  # Fix contact.jobTitle → contact.title
  sed -i 's/contact\.jobTitle\b/contact.title/g' "$f"
  # Fix { jobTitle: true → { title: true in selects
  sed -i 's/jobTitle: true/title: true/g' "$f"
  # Fix company.employeeSize → company.sizeRange
  sed -i 's/company\.employeeSize\b/company.sizeRange/g' "$f"
  # Fix company.linkedinUrl → company.website (linkedinUrl doesn't exist on Company)
  sed -i 's/company\.linkedinUrl\b/company.website/g' "$f"
  # Fix contact.roleBucket → contact.role
  sed -i 's/contact\.roleBucket\b/contact.role/g' "$f"
  # Fix researchCard.currentTechLandscape → researchCard.techLandscape
  sed -i 's/researchCard\.currentTechLandscape\b/researchCard.techLandscape/g' "$f"
  sed -i 's/\.currentTechLandscape\b/.techLandscape/g' "$f"
  # Fix db.opportunity → db.opportunityRecommendation (most cases)
  # sed -i 's/db\.opportunity\b/db.opportunityRecommendation/g' "$f"
  # Fix enrichment.archivedAt removal (already handled per-file)
  # Fix company.dataFreshness → (doesn't exist)
  sed -i 's/, dataFreshness:.*//g' "$f"
  # Fix db.emailHealthCheck → db.emailEvent
  sed -i 's/db\.emailHealthCheck/db.emailEvent/g' "$f"
  # Fix remaining db.userPreferences → db.systemSetting
  sed -i 's/db\.userPreferences/db.systemSetting/g' "$f"
done

echo "Done with bulk pattern fixes"
