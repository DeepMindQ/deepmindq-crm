import { db } from '@/lib/db';
import { NextResponse, NextRequest } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  // Admin-only endpoint
  const auth = await checkApiAuth();
  if (auth.errorResponse) return auth.errorResponse;
  if (auth.session) {
    const adminCheck = requireAdminRole(auth.session);
    if (adminCheck) return adminCheck;
  }

  try {
    const existingCount = await db.contact.count();
    if (existingCount > 0) {
      return NextResponse.json({ seeded: false });
    }

    // ── Create ImportBatches ──
    const batch1 = await db.importBatch.create({
      data: {
        fileName: 'tech_leads_q1_2025.csv',
        fileHash: 'sha256:abc123batch1',
        totalRows: 120,
        acceptedRows: 98,
        duplicateRows: 12,
        invalidRows: 6,
        questionableRows: 4,
        status: 'completed',
        mappingProfile: 'standard_b2b',
      },
    });

    const batch2 = await db.importBatch.create({
      data: {
        fileName: 'finance_contacts_mar.csv',
        fileHash: 'sha256:def456batch2',
        totalRows: 85,
        acceptedRows: 72,
        duplicateRows: 5,
        invalidRows: 3,
        questionableRows: 5,
        status: 'completed',
        mappingProfile: 'financial_services',
      },
    });

    const batch3 = await db.importBatch.create({
      data: {
        fileName: 'healthcare_prospects_apr.csv',
        fileHash: 'sha256:ghi789batch3',
        totalRows: 200,
        acceptedRows: 180,
        duplicateRows: 10,
        invalidRows: 5,
        questionableRows: 5,
        status: 'processing',
        mappingProfile: 'healthcare_v2',
      },
    });

    // ── Create Companies ──
    const companies = await Promise.all([
      db.company.create({
        data: {
          rawName: 'NovaTech Solutions',
          normalizedName: 'novatech solutions',
          domain: 'novatech.io',
          industry: 'Technology',
          sizeRange: '51-200',
          location: 'Austin, TX',
          website: 'https://novatech.io',
          internalSummary: 'Mid-size SaaS company focused on developer tools and cloud infrastructure.',
        },
      }),
      db.company.create({
        data: {
          rawName: 'Greenfield Financial Group',
          normalizedName: 'greenfield financial group',
          domain: 'greenfieldfg.com',
          industry: 'Finance',
          sizeRange: '201-500',
          location: 'New York, NY',
          website: 'https://greenfieldfg.com',
          internalSummary: 'Regional financial services firm offering wealth management and advisory.',
        },
      }),
      db.company.create({
        data: {
          rawName: 'MedCore Health Systems',
          normalizedName: 'medcore health systems',
          domain: 'medcorehealth.com',
          industry: 'Healthcare',
          sizeRange: '501-1000',
          location: 'Chicago, IL',
          website: 'https://medcorehealth.com',
          internalSummary: 'Large healthcare network with 12 hospitals across the Midwest.',
        },
      }),
      db.company.create({
        data: {
          rawName: 'Apex Manufacturing Inc.',
          normalizedName: 'apex manufacturing inc',
          domain: 'apexmfg.com',
          industry: 'Manufacturing',
          sizeRange: '201-500',
          location: 'Detroit, MI',
          website: 'https://apexmfg.com',
          internalSummary: 'Precision manufacturing specializing in automotive and aerospace components.',
        },
      }),
      db.company.create({
        data: {
          rawName: 'SwiftRoute Logistics',
          normalizedName: 'swiftroute logistics',
          domain: 'swiftroute.com',
          industry: 'Logistics',
          sizeRange: '51-200',
          location: 'Memphis, TN',
          website: 'https://swiftroute.com',
          internalSummary: 'Last-mile delivery and warehousing startup backed by Series B funding.',
        },
      }),
      db.company.create({
        data: {
          rawName: 'Clarion Consulting Partners',
          normalizedName: 'clarion consulting partners',
          domain: 'clarioncp.com',
          industry: 'Consulting',
          sizeRange: '11-50',
          location: 'Boston, MA',
          website: 'https://clarioncp.com',
          internalSummary: 'Boutique management consulting firm focused on digital transformation.',
        },
      }),
    ]);

    // ── Create CompanyResearchCards ──
    await Promise.all([
      db.companyResearchCard.create({
        data: {
          companyId: companies[0].id,
          businessOverview: 'NovaTech provides developer productivity tools including CI/CD, observability, and cloud cost optimization platforms.',
          techLandscape: 'AWS primary, some GCP. Kubernetes, Terraform, Go microservices.',
          potentialChallenges: 'Scaling their customer success team, high churn in self-serve tier.',
          possibleOpportunities: 'Need managed services for their enterprise onboarding. Could benefit from dedicated support packages.',
          relevantServices: 'Enterprise onboarding, managed infrastructure, training workshops.',
          keyDecisionMakers: 'CTO: Sarah Chen, VP Eng: Marcus Johnson, Head of CS: Diana Patel',
        },
      }),
      db.companyResearchCard.create({
        data: {
          companyId: companies[1].id,
          businessOverview: 'Greenfield Financial Group manages $4.2B in assets. Growing digital advisory platform.',
          techLandscape: 'On-prem legacy systems transitioning to Azure. .NET stack, SQL Server.',
          potentialChallenges: 'Legacy system migration risks, regulatory compliance during transition.',
          possibleOpportunities: 'Cloud migration strategy and execution. Compliance automation tooling.',
          relevantServices: 'Cloud migration, compliance framework, DevOps transformation.',
          keyDecisionMakers: 'CIO: Robert Kim, VP Technology: Lisa Tran, CISO: James O\'Brien',
        },
      }),
      db.companyResearchCard.create({
        data: {
          companyId: companies[2].id,
          businessOverview: 'MedCore operates 12 hospitals and 200+ clinics. Investing heavily in telehealth and AI diagnostics.',
          techLandscape: 'Hybrid cloud (Azure + on-prem). Epic EHR system. MuleSoft for integration.',
          potentialChallenges: 'HIPAA compliance complexity, interoperability between hospital systems.',
          possibleOpportunities: 'Data integration platform modernization, AI/ML pipeline for diagnostics.',
          relevantServices: 'Data engineering, HIPAA-compliant cloud architecture, ML operations.',
          keyDecisionMakers: 'CIO: Dr. Amanda Foster, CTO: Kevin Park, VP Innovation: Rachel Green',
        },
      }),
    ]);

    // ── Create Contacts (25 total) ──
    const contactData = [
      // NovaTech (company 0)
      { rawName: 'Sarah Chen', normalizedName: 'sarah chen', email: 'sarah.chen@novatech.io', title: 'Chief Technology Officer', role: 'C-suite', companyId: companies[0].id, batchId: batch1.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 95, status: 'sent', leadScore: 92, isSuppressed: false },
      { rawName: 'Marcus Johnson', normalizedName: 'marcus johnson', email: 'marcus.j@novatech.io', title: 'VP of Engineering', role: 'VP', companyId: companies[0].id, batchId: batch1.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 90, status: 'replied', leadScore: 88, isSuppressed: false },
      { rawName: 'Diana Patel', normalizedName: 'diana patel', email: 'diana.patel@novatech.io', title: 'Head of Customer Success', role: 'Director', companyId: companies[0].id, batchId: batch1.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 88, status: 'queued', leadScore: 75, isSuppressed: false },
      { rawName: 'Tom Richards', normalizedName: 'tom richards', email: 'tom.r@novatech.io', title: 'Senior DevOps Engineer', role: 'Individual Contributor', companyId: companies[0].id, batchId: batch1.id, consentStatus: 'unknown', emailHealth: 'risky', emailHealthScore: 45, status: 'imported', leadScore: 30, isSuppressed: false },

      // Greenfield Financial (company 1)
      { rawName: 'Robert Kim', normalizedName: 'robert kim', email: 'r.kim@greenfieldfg.com', title: 'Chief Information Officer', role: 'C-suite', companyId: companies[1].id, batchId: batch2.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 97, status: 'replied', leadScore: 95, isSuppressed: false },
      { rawName: 'Lisa Tran', normalizedName: 'lisa tran', email: 'l.tran@greenfieldfg.com', title: 'VP of Technology', role: 'VP', companyId: companies[1].id, batchId: batch2.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 92, status: 'drafted', leadScore: 85, isSuppressed: false },
      { rawName: 'James OBrien', normalizedName: 'james obrien', email: 'j.obrien@greenfieldfg.com', title: 'Chief Information Security Officer', role: 'C-suite', companyId: companies[1].id, batchId: batch2.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 94, status: 'sent', leadScore: 90, isSuppressed: false },
      { rawName: 'Nancy Drew', normalizedName: 'nancy drew', email: 'n.drew@greenfieldfg.com', title: 'IT Director', role: 'Director', companyId: companies[1].id, batchId: batch2.id, consentStatus: 'opted_out', emailHealth: 'valid', emailHealthScore: 80, status: 'suppressed', leadScore: 10, isSuppressed: true, suppressionReason: 'opted_out' },

      // MedCore Health (company 2)
      { rawName: 'Dr. Amanda Foster', normalizedName: 'amanda foster', email: 'a.foster@medcorehealth.com', title: 'Chief Information Officer', role: 'C-suite', companyId: companies[2].id, batchId: batch3.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 96, status: 'replied', leadScore: 94, isSuppressed: false },
      { rawName: 'Kevin Park', normalizedName: 'kevin park', email: 'k.park@medcorehealth.com', title: 'Chief Technology Officer', role: 'C-suite', companyId: companies[2].id, batchId: batch3.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 93, status: 'sent', leadScore: 91, isSuppressed: false },
      { rawName: 'Rachel Green', normalizedName: 'rachel green', email: 'r.green@medcorehealth.com', title: 'VP of Innovation', role: 'VP', companyId: companies[2].id, batchId: batch3.id, consentStatus: 'opted_in', emailHealth: 'risky', emailHealthScore: 55, status: 'bounced', leadScore: 40, isSuppressed: false },
      { rawName: 'Mike Hernandez', normalizedName: 'mike hernandez', email: 'm.hernandez@medcorehealth.com', title: 'Data Engineering Manager', role: 'Manager', companyId: companies[2].id, batchId: batch3.id, consentStatus: 'unknown', emailHealth: 'unknown', emailHealthScore: 0, status: 'imported', leadScore: 20, isSuppressed: false },

      // Apex Manufacturing (company 3)
      { rawName: 'Patricia Williams', normalizedName: 'patricia williams', email: 'p.williams@apexmfg.com', title: 'VP of Operations', role: 'VP', companyId: companies[3].id, batchId: batch1.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 89, status: 'queued', leadScore: 72, isSuppressed: false },
      { rawName: 'David Brown', normalizedName: 'david brown', email: 'd.brown@apexmfg.com', title: 'IT Manager', role: 'Manager', companyId: companies[3].id, batchId: batch1.id, consentStatus: 'unknown', emailHealth: 'risky', emailHealthScore: 40, status: 'imported', leadScore: 25, isSuppressed: false },
      { rawName: 'Sandra Lee', normalizedName: 'sandra lee', email: 's.lee@apexmfg.com', title: 'Director of Digital Transformation', role: 'Director', companyId: companies[3].id, batchId: batch1.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 85, status: 'cleaned', leadScore: 68, isSuppressed: false },
      { rawName: 'Frank Martinez', normalizedName: 'frank martinez', email: 'f.martinez@apexmfg.com', title: 'Plant Manager', role: 'Manager', companyId: companies[3].id, batchId: batch1.id, consentStatus: 'opted_out', emailHealth: 'invalid', emailHealthScore: 5, status: 'suppressed', leadScore: 0, isSuppressed: true, suppressionReason: 'bounce' },

      // SwiftRoute Logistics (company 4)
      { rawName: 'Jennifer Liu', normalizedName: 'jennifer liu', email: 'j.liu@swiftroute.com', title: 'Chief Technology Officer', role: 'C-suite', companyId: companies[4].id, batchId: batch2.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 91, status: 'sent', leadScore: 87, isSuppressed: false },
      { rawName: 'Carlos Rivera', normalizedName: 'carlos rivera', email: 'c.rivera@swiftroute.com', title: 'Head of Engineering', role: 'Director', companyId: companies[4].id, batchId: batch2.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 87, status: 'drafted', leadScore: 78, isSuppressed: false },
      { rawName: 'Angela Wu', normalizedName: 'angela wu', email: 'a.wu@swiftroute.com', title: 'Product Manager', role: 'Manager', companyId: companies[4].id, batchId: batch2.id, consentStatus: 'unknown', emailHealth: 'unknown', emailHealthScore: 0, status: 'imported', leadScore: 35, isSuppressed: false },
      { rawName: 'Brian Scott', normalizedName: 'brian scott', email: 'b.scott@swiftroute.com', title: 'Senior Software Engineer', role: 'Individual Contributor', companyId: companies[4].id, batchId: batch2.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 82, status: 'cleaned', leadScore: 45, isSuppressed: false },

      // Clarion Consulting (company 5)
      { rawName: 'Emily Watson', normalizedName: 'emily watson', email: 'e.watson@clarioncp.com', title: 'Managing Partner', role: 'C-suite', companyId: companies[5].id, batchId: batch3.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 96, status: 'replied', leadScore: 90, isSuppressed: false },
      { rawName: 'Daniel Kim', normalizedName: 'daniel kim', email: 'd.kim@clarioncp.com', title: 'Director of Technology Practice', role: 'Director', companyId: companies[5].id, batchId: batch3.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 88, status: 'queued', leadScore: 80, isSuppressed: false },
      { rawName: 'Sophie Turner', normalizedName: 'sophie turner', email: 's.turner@clarioncp.com', title: 'Senior Consultant', role: 'Individual Contributor', companyId: companies[5].id, batchId: batch3.id, consentStatus: 'unknown', emailHealth: 'risky', emailHealthScore: 50, status: 'bounced', leadScore: 15, isSuppressed: false },
      { rawName: 'Oliver Grant', normalizedName: 'oliver grant', email: 'o.grant@clarioncp.com', title: 'Business Development Lead', role: 'Manager', companyId: companies[5].id, batchId: batch3.id, consentStatus: 'opted_in', emailHealth: 'valid', emailHealthScore: 84, status: 'cleaned', leadScore: 62, isSuppressed: false },
    ];

    const contacts = await db.$transaction(
      contactData.map((c) => db.contact.create({ data: c }))
    );

    // ── Create CapabilityAssets (8) ──
    const capabilities = await Promise.all([
      db.capabilityAsset.create({
        data: {
          title: 'Cloud Infrastructure Migration',
          summary: 'End-to-end cloud migration from on-prem to AWS/Azure/GCP with zero-downtime strategies.',
          category: 'service_line',
          serviceLine: 'Cloud & Infrastructure',
          targetIndustries: 'Finance, Healthcare, Manufacturing',
          targetRoles: 'CTO, VP Engineering, IT Director',
          problems: 'Legacy system technical debt, scalability limitations, high infrastructure costs',
          evidence: 'Migrated 50+ enterprise workloads in 2024 with 99.9% uptime SLA maintained.',
          content: 'Our cloud migration service covers assessment, planning, execution, and optimization. We specialize in lift-and-shift, re-platforming, and re-architecting strategies tailored to your business needs.',
          isActive: true,
          version: 3,
        },
      }),
      db.capabilityAsset.create({
        data: {
          title: 'NovaTech Enterprise Onboarding Success',
          summary: 'Reduced NovaTech customer onboarding time by 60% through automated provisioning pipelines.',
          category: 'case_study',
          serviceLine: 'Cloud & Infrastructure',
          targetIndustries: 'Technology',
          targetRoles: 'CTO, VP Engineering, Head of CS',
          problems: 'Manual onboarding processes, inconsistent customer experience, long time-to-value',
          evidence: 'NovaTech CTO Sarah Chen cited 60% reduction in onboarding time. Case study published Q1 2025.',
          content: 'Challenge: NovaTech was spending 3 weeks onboarding each enterprise customer with manual steps. Solution: We built automated provisioning pipelines with Terraform and custom scripts. Result: Onboarding reduced to 5 business days.',
          isActive: true,
          version: 1,
        },
      }),
      db.capabilityAsset.create({
        data: {
          title: '99.97% Uptime Track Record',
          summary: 'Maintained 99.97% uptime across all managed services over the past 36 months.',
          category: 'proof_point',
          serviceLine: 'Managed Services',
          targetIndustries: 'Finance, Healthcare',
          targetRoles: 'CIO, CTO, VP Engineering',
          problems: 'System reliability concerns, unplanned downtime costs',
          evidence: 'Third-party SLA monitoring reports available. Zero P1 incidents in 18 months.',
          content: 'Our managed services team maintains rigorous SRE practices including chaos engineering, automated failover, and proactive monitoring.',
          isActive: true,
          version: 2,
        },
      }),
      db.capabilityAsset.create({
        data: {
          title: '"We already have an internal team for that"',
          summary: 'Response framework for prospects who believe their internal team can handle the work.',
          category: 'objection_response',
          targetIndustries: 'Technology, Finance',
          targetRoles: 'CTO, VP Engineering',
          problems: 'Internal capacity constraints, skill gaps, opportunity cost of DIY approach',
          evidence: '64% of clients who initially said this later engaged us when internal projects fell behind.',
          content: 'Acknowledge their strong team, then pivot to capacity and specialization. "Your team is clearly talented. We typically complement internal teams by handling specialized workloads, allowing your engineers to focus on core product development."',
          isActive: true,
          version: 4,
        },
      }),
      db.capabilityAsset.create({
        data: {
          title: 'Data Engineering & Analytics Platform',
          summary: 'Build modern data platforms with real-time analytics, ML pipelines, and data governance.',
          category: 'service_line',
          serviceLine: 'Data & AI',
          targetIndustries: 'Healthcare, Finance, Logistics',
          targetRoles: 'CTO, CIO, VP Data, Head of Analytics',
          problems: 'Data silos, lack of real-time insights, compliance requirements for data handling',
          evidence: 'Built data platforms processing 10TB+ daily for 3 healthcare clients.',
          content: 'From data warehouse modernization to real-time streaming analytics, we design and implement data platforms that turn raw data into actionable insights while maintaining compliance.',
          isActive: true,
          version: 2,
        },
      }),
      db.capabilityAsset.create({
        data: {
          title: 'Greenfield Financial Cloud Migration',
          summary: 'Migrated Greenfield\'s core banking systems to Azure with zero regulatory incidents.',
          category: 'case_study',
          serviceLine: 'Cloud & Infrastructure',
          targetIndustries: 'Finance',
          targetRoles: 'CIO, CTO, VP Technology',
          problems: 'Legacy on-prem systems, regulatory compliance during migration, minimizing downtime',
          evidence: 'Completed 18-month migration in 14 months. Zero compliance incidents. 40% infrastructure cost reduction.',
          content: 'Greenfield Financial needed to modernize while maintaining strict regulatory compliance. Our phased migration approach ensured continuous operation while transitioning 200+ workloads to Azure.',
          isActive: true,
          version: 1,
        },
      }),
      db.capabilityAsset.create({
        data: {
          title: 'Schedule a 30-Minute Discovery Call',
          summary: 'Standard CTA offering a free 30-minute discovery call to discuss challenges and explore fit.',
          category: 'cta',
          targetIndustries: '',
          targetRoles: '',
          problems: '',
          evidence: 'Discovery calls have a 35% conversion rate to proposal stage.',
          content: 'Let\'s spend 30 minutes discussing your current challenges. No pitch, no pressure — just an honest conversation about where you are and where you want to be.',
          isActive: true,
          version: 6,
        },
      }),
      db.capabilityAsset.create({
        data: {
          title: 'DevOps Transformation & CI/CD Modernization',
          summary: 'Transform software delivery with modern CI/CD, GitOps, and automated testing pipelines.',
          category: 'service_line',
          serviceLine: 'DevOps',
          targetIndustries: 'Technology, Manufacturing, Logistics',
          targetRoles: 'VP Engineering, Head of DevOps, IT Director',
          problems: 'Slow release cycles, manual deployment processes, lack of testing automation',
          evidence: 'Average client sees 3x faster deployment frequency within 90 days of engagement.',
          content: 'We implement modern DevOps practices including infrastructure as code, automated testing, continuous deployment, and observability — tailored to your team\'s current maturity level.',
          isActive: true,
          version: 2,
        },
      }),
    ]);

    // ── Create Drafts (6) ──
    const drafts = await Promise.all([
      db.draft.create({
        data: {
          contactId: contacts[1].id,
          subject: 'Accelerating NovaTech\'s Customer Onboarding',
          body: 'Hi Marcus, I noticed NovaTech has been growing its enterprise client base rapidly. We helped a similar SaaS company reduce their onboarding time by 60% through automated provisioning. Would love to share how we did it.',
          cta: 'Schedule a 30-Minute Discovery Call',
          confidenceScore: 87,
          sourceSnippetsUsed: 'NovaTech growth announcement, onboarding automation case study',
          assumptionFlags: 'assumes_onboarding_pain',
          status: 'pending_review',
        },
      }),
      db.draft.create({
        data: {
          contactId: contacts[5].id,
          subject: 'Greenfield Cloud Migration — Lessons from Similar Projects',
          body: 'Lisa, given Greenfield\'s Azure transition plans, I thought you\'d find our recent financial services migration relevant. We completed a zero-incident migration for a firm of comparable size in 14 months.',
          cta: 'Schedule a 30-Minute Discovery Call',
          confidenceScore: 91,
          sourceSnippetsUsed: 'Greenfield tech landscape research, financial migration case study',
          assumptionFlags: 'assumes_active_migration',
          status: 'pending_review',
        },
      }),
      db.draft.create({
        data: {
          contactId: contacts[8].id,
          subject: 'Data Platform Modernization for MedCore',
          body: 'Dr. Foster, with MedCore\'s investment in AI diagnostics, a robust data platform is critical. We\'ve built platforms processing 10TB+ daily for healthcare clients while maintaining full HIPAA compliance.',
          cta: 'Schedule a 30-Minute Discovery Call',
          confidenceScore: 93,
          sourceSnippetsUsed: 'MedCore AI investment news, healthcare data platform case study',
          assumptionFlags: 'assumes_data_infrastructure_gap',
          status: 'approved',
        },
      }),
      db.draft.create({
        data: {
          contactId: contacts[14].id,
          subject: 'Digital Transformation for Apex Manufacturing',
          body: 'Sandra, Apex\'s digital transformation initiative aligns well with our DevOps practice. We typically help manufacturing clients achieve 3x faster deployment cycles. Happy to share our approach.',
          cta: 'Schedule a 30-Minute Discovery Call',
          confidenceScore: 72,
          sourceSnippetsUsed: 'Apex manufacturing digital initiative, DevOps transformation proof point',
          assumptionFlags: 'assumes_slow_deployments',
          status: 'approved',
        },
      }),
      db.draft.create({
        data: {
          contactId: contacts[11].id,
          subject: 'Logistics Tech Stack Review',
          body: 'Rachel, SwiftRoute\'s growth trajectory is impressive. We\'ve worked with logistics companies to modernize their tech stacks and improve delivery optimization algorithms.',
          cta: 'Schedule a 30-Minute Discovery Call',
          confidenceScore: 55,
          sourceSnippetsUsed: 'SwiftRoute Series B announcement',
          assumptionFlags: 'assumes_tech_debt,assumes_scaling_pain',
          status: 'rejected',
          rejectReason: 'Insufficient personalization — needs more specific pain point identification.',
        },
      }),
      db.draft.create({
        data: {
          contactId: contacts[20].id,
          subject: 'Scaling Clarion\'s Technology Practice',
          body: 'Daniel, as Clarion\'s tech practice grows, having the right delivery infrastructure becomes critical. We partner with consulting firms to provide technical execution capability.',
          cta: 'Schedule a 30-Minute Discovery Call',
          confidenceScore: 78,
          sourceSnippetsUsed: 'Clarion consulting growth, partnership model',
          assumptionFlags: 'assumes_delivery_capacity_constraint',
          status: 'pending_review',
        },
      }),
    ]);

    // ── Create SendQueue items (4) ──
    const now = new Date();
    await Promise.all([
      db.sendQueue.create({
        data: {
          draftId: drafts[2].id,
          scheduledAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          sentAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          status: 'sent',
        },
      }),
      db.sendQueue.create({
        data: {
          draftId: drafts[3].id,
          scheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          status: 'scheduled',
        },
      }),
      db.sendQueue.create({
        data: {
          draftId: drafts[0].id,
          scheduledAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
          status: 'pending',
        },
      }),
      db.sendQueue.create({
        data: {
          draftId: drafts[1].id,
          scheduledAt: new Date(now.getTime() + 1 * 60 * 60 * 1000),
          status: 'pending',
        },
      }),
    ]);

    // ── Create Replies (3) ──
    await Promise.all([
      db.reply.create({
        data: {
          contactId: contacts[4].id,
          subject: 'Re: Cloud Migration Discussion',
          body: 'Thanks for reaching out. We are actually in the middle of evaluating vendors for our Azure migration. Can we schedule a call next week?',
          category: 'positive',
          receivedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        },
      }),
      db.reply.create({
        data: {
          contactId: contacts[8].id,
          subject: 'Re: Data Platform Modernization',
          body: 'This is interesting. Can you send over the case study you mentioned? We\'re particularly interested in the HIPAA compliance aspects.',
          category: 'positive',
          receivedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        },
      }),
      db.reply.create({
        data: {
          contactId: contacts[9].id,
          subject: 'Out of Office: Kevin Park',
          body: 'I will be out of the office until March 15th. For urgent matters, please contact Rachel Green at r.green@medcorehealth.com.',
          category: 'out_of_office',
          receivedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    // ── Create Bounces (2) ──
    await Promise.all([
      db.bounce.create({
        data: {
          contactId: contacts[10].id,
          bounceType: 'soft',
          reason: 'Mailbox full',
          bouncedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        },
      }),
      db.bounce.create({
        data: {
          contactId: contacts[22].id,
          bounceType: 'hard',
          reason: 'Recipient not found',
          bouncedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    // ── Create Suppressions (2) ──
    await Promise.all([
      db.suppression.create({
        data: {
          contactId: contacts[7].id,
          reason: 'manual',
        },
      }),
      db.suppression.create({
        data: {
          contactId: contacts[15].id,
          reason: 'bounce',
        },
      }),
    ]);

    // ── Create AuditLogs (5) ──
    await Promise.all([
      db.auditLog.create({
        data: {
          action: 'create',
          entity: 'ImportBatch',
          entityId: batch1.id,
          details: 'Imported tech_leads_q1_2025.csv — 120 total rows, 98 accepted.',
        },
      }),
      db.auditLog.create({
        data: {
          action: 'create',
          entity: 'ImportBatch',
          entityId: batch2.id,
          details: 'Imported finance_contacts_mar.csv — 85 total rows, 72 accepted.',
        },
      }),
      db.auditLog.create({
        data: {
          action: 'approve',
          entity: 'Draft',
          entityId: drafts[2].id,
          details: 'Draft for Dr. Amanda Foster approved by system. Confidence: 93.',
        },
      }),
      db.auditLog.create({
        data: {
          action: 'reject',
          entity: 'Draft',
          entityId: drafts[4].id,
          details: 'Draft for Rachel Green rejected. Reason: insufficient personalization.',
        },
      }),
      db.auditLog.create({
        data: {
          action: 'send',
          entity: 'SendQueue',
          entityId: drafts[2].id,
          details: 'Email sent to Dr. Amanda Foster (MedCore Health Systems).',
        },
      }),
    ]);

    // ── Gather final counts ──
    const [contactsCount, companiesCount, batchesCount, capabilitiesCount, draftsCount, queueCount, repliesCount, bouncesCount, suppressionsCount, auditCount] = await Promise.all([
      db.contact.count(),
      db.company.count(),
      db.importBatch.count(),
      db.capabilityAsset.count(),
      db.draft.count(),
      db.sendQueue.count(),
      db.reply.count(),
      db.bounce.count(),
      db.suppression.count(),
      db.auditLog.count(),
    ]);

    return NextResponse.json({
      seeded: true,
      counts: {
        contacts: contactsCount,
        companies: companiesCount,
        batches: batchesCount,
        capabilities: capabilitiesCount,
        drafts: draftsCount,
        queue: queueCount,
        replies: repliesCount,
        bounces: bouncesCount,
        suppressions: suppressionsCount,
        auditLogs: auditCount,
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: String(error) },
      { status: 500 }
    );
  }
}