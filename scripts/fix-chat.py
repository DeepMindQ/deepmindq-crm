import re

filepath = '/home/z/my-project/src/app/api/ai/chat/route.ts'
with open(filepath, 'r') as f:
    content = f.read()

replacements = [
    # Fix company include
    ("contacts: { where: { archivedAt: null }, take: 5, orderBy: { createdAt: 'desc' } },",
     "contacts: { take: 5, orderBy: { createdAt: 'desc' } },"),
    ("opportunities: { take: 3, orderBy: { updatedAt: 'desc' } },",
     "timeline: { take: 3, orderBy: { createdAt: 'desc' } },"),
    # Fix company.name -> rawName
    ("company.name", "company.rawName"),
    ("c.name) (", "c.rawName) ("),
    # Fix c.jobTitle -> c.title
    ("c.jobTitle", "c.title"),
    # Fix employeeSize -> sizeRange
    ("company.employeeSize", "company.sizeRange"),
    ("- Employees:", "- Size:"),
    # Fix dataFreshness reference  
    ("- Data Freshness: ${company.dataFreshness || 'Unknown'}\n\n", ""),
    # Fix company.opportunities -> company.timeline
    ("company.opportunities.length > 0", "company.timeline.length > 0"),
    ('company.opportunities\n', 'company.timeline\n'),
    # Fix opportunity mapping
    ('.map((o) => `  - "${o.title}"', '.map((t) => `  - ${t.eventType || "Event"'),
    ("(${o.status}) — Next: ${o.nextAction || 'N/A'})", "${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A'}"),
    # Fix contact fields
    ("contact.name", "contact.rawName"),
    ("contact.jobTitle", "contact.title"),
    ("contact.company?.name", "contact.company?.rawName"),
    # Fix roleBucket
    ("contact.roleBucket || 'Unknown'", "''"),
    ("- Role Bucket: ${contact.roleBucket || 'Unknown'}\n +", ""),
    # Fix matchScore in drafts
    (", match: ${d.matchScore ?? 'N/A'}", ""),
    # Fix db.opportunity -> db.pursuit
    ("db.opportunity.findUnique", "db.pursuit.findUnique"),
    # Fix opp.title references
    ("opp.title", "opp.opportunity?.opportunityTitle || opp.status"),
    ("opp.company?.name", "opp.company?.rawName"),
    ("opp.description", "opp.notes"),
    # Fix targetContact
    ("opp.targetContact?.name || 'None assigned'", "''"),
    ("- Target Contact: ${opp.targetContact?.name || 'None assigned'}\n +", ""),
    ("- Description: ${opp.description || 'N/A'}", "- Notes: ${opp.notes || 'N/A'}"),
]

for old, new in replacements:
    content = content.replace(old, new)

with open(filepath, 'w') as f:
    f.write(content)

print("Chat route: applied", len(replacements), "replacements")
