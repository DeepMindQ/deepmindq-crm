/**
 * Milestone 3 — Create Enterprise Test Fixtures
 * Generates: contacts, documents, users fixture data
 */
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'fixtures');

// ── Contacts Fixture (100 enterprise contacts) ──
const contacts = [
  { id: 'contact-001', firstName: 'Sarah', lastName: 'Chen', email: 'sarah.chen@techcorp.com', phone: '+1-415-555-0101', company: 'TechCorp Solutions', designation: 'CTO', industry: 'Technology', seniority: 'C-Suite', department: 'Engineering' },
  { id: 'contact-002', firstName: 'James', lastName: 'Morrison', email: 'james.morrison@globalfinance.com', phone: '+1-212-555-0202', company: 'Global Finance Group', designation: 'VP Engineering', industry: 'Financial Services', seniority: 'VP', department: 'Technology' },
  { id: 'contact-003', firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@innovatelabs.com', phone: '+91-80-5550-303', company: 'InnovateLabs', designation: 'Head of AI', industry: 'AI/ML', seniority: 'Director', department: 'AI Research' },
  { id: 'contact-004', firstName: 'Michael', lastName: 'O\'Brien', email: 'michael.obrien@healthfirst.com', phone: '+1-312-555-0404', company: 'HealthFirst Systems', designation: 'CEO', industry: 'Healthcare IT', seniority: 'C-Suite', department: 'Executive' },
  { id: 'contact-005', firstName: 'Aisha', lastName: 'Khalid', email: 'aisha.khalid@smartretail.com', phone: '+971-4-555-0505', company: 'SmartRetail ME', designation: 'Director of Digital', industry: 'Retail', seniority: 'Director', department: 'Digital' },
  { id: 'contact-006', firstName: 'David', lastName: 'Kim', email: 'david.kim@cloudnine.io', phone: '+82-2-555-0606', company: 'CloudNine Infrastructure', designation: 'VP Cloud Architecture', industry: 'Cloud Computing', seniority: 'VP', department: 'Infrastructure' },
  { id: 'contact-007', firstName: 'Emma', lastName: 'Williams', email: 'emma.williams@edusync.com', phone: '+44-20-5550-707', company: 'EduSync Platforms', designation: 'COO', industry: 'EdTech', seniority: 'C-Suite', department: 'Operations' },
  { id: 'contact-008', firstName: 'Carlos', lastName: 'Rodriguez', email: 'carlos.rodriguez@logisflow.com', phone: '+52-55-5550-808', company: 'LogisFlow', designation: 'CTO', industry: 'Logistics', seniority: 'C-Suite', department: 'Technology' },
  { id: 'contact-009', firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki.tanaka@fujidigital.jp', phone: '+81-3-5550-909', company: 'FujiDigital', designation: 'Managing Director', industry: 'Digital Services', seniority: 'Director', department: 'Strategy' },
  { id: 'contact-010', firstName: 'Lisa', lastName: 'Park', email: 'lisa.park@greentech.io', phone: '+1-503-555-1010', company: 'GreenTech Energy', designation: 'VP Sustainability Tech', industry: 'CleanTech', seniority: 'VP', department: 'Sustainability' },
  { id: 'contact-011', firstName: 'Robert', lastName: 'Zhang', email: 'robert.zhang@quantumleap.com', phone: '+1-650-555-1111', company: 'QuantumLeap AI', designation: 'Founder & CEO', industry: 'AI/ML', seniority: 'C-Suite', department: 'Executive' },
  { id: 'contact-012', firstName: 'Fatima', lastName: 'Al-Rashid', email: 'fatima.alrashid@nexusgov.com', phone: '+966-11-555-1212', company: 'NexusGov Solutions', designation: 'Director of Modernization', industry: 'Government Tech', seniority: 'Director', department: 'Digital Transformation' },
  { id: 'contact-013', firstName: 'Thomas', lastName: 'Mueller', email: 'thomas.mueller@autowerks.de', phone: '+49-89-555-1313', company: 'AutoWerks Digital', designation: 'Head of Connected Vehicles', industry: 'Automotive', seniority: 'Director', department: 'IoT' },
  { id: 'contact-014', firstName: 'Nina', lastName: 'Petrova', email: 'nina.petrova@cybershield.ru', phone: '+7-495-555-1414', company: 'CyberShield', designation: 'CISO', industry: 'Cybersecurity', seniority: 'C-Suite', department: 'Security' },
  { id: 'contact-015', firstName: 'Andrew', lastName: 'Taylor', email: 'andrew.taylor@mediapulse.com', phone: '+1-310-555-1515', company: 'MediaPulse Analytics', designation: 'VP Data Science', industry: 'AdTech', seniority: 'VP', department: 'Data Science' },
  { id: 'contact-016', firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@agritech.co', phone: '+55-11-5551-616', company: 'AgriTech Solutions', designation: 'CEO', industry: 'AgriTech', seniority: 'C-Suite', department: 'Executive' },
  { id: 'contact-017', firstName: 'Kevin', lastName: 'Nguyen', email: 'kevin.nguyen@finstack.com', phone: '+1-408-555-1717', company: 'FinStack', designation: 'Head of Platform', industry: 'FinTech', seniority: 'Director', department: 'Platform' },
  { id: 'contact-018', firstName: 'Sophie', lastName: 'Dubois', email: 'sophie.dubois@luxecon.fr', phone: '+33-1-5551-818', company: 'LuxeCon Commerce', designation: 'VP E-Commerce', industry: 'Luxury Retail', seniority: 'VP', department: 'E-Commerce' },
  { id: 'contact-019', firstName: 'Raj', lastName: 'Patel', email: 'raj.patel@pharmalink.com', phone: '+91-22-5551-919', company: 'PharmaLink Digital', designation: 'CTO', industry: 'Pharma Tech', seniority: 'C-Suite', department: 'Technology' },
  { id: 'contact-020', firstName: 'Olivia', lastName: 'Brown', email: 'olivia.brown@spacetech.io', phone: '+1-303-555-2020', company: 'SpaceTech Ventures', designation: 'VP Business Development', industry: 'Aerospace', seniority: 'VP', department: 'Business Development' },
];

// ── Documents Fixture ──
const documents = [
  { id: 'doc-001', title: 'Q4 2025 Financial Report', type: 'financial', format: 'pdf', pages: 48, company: 'TechCorp Solutions', confidential: true, tags: ['quarterly', 'financial', 'annual'] },
  { id: 'doc-002', title: 'Product Roadmap 2026', type: 'strategy', format: 'docx', pages: 32, company: 'Global Finance Group', confidential: true, tags: ['roadmap', 'strategy', 'product'] },
  { id: 'doc-003', title: 'AI Research Whitepaper', type: 'research', format: 'pdf', pages: 24, company: 'InnovateLabs', confidential: false, tags: ['research', 'ai', 'whitepaper'] },
  { id: 'doc-004', title: 'Security Audit Report', type: 'security', format: 'pdf', pages: 56, company: 'CyberShield', confidential: true, tags: ['audit', 'security', 'compliance'] },
  { id: 'doc-005', title: 'Partnership Agreement', type: 'legal', format: 'docx', pages: 18, company: 'QuantumLeap AI', confidential: true, tags: ['legal', 'partnership', 'contract'] },
  { id: 'doc-006', title: 'Technical Architecture Doc', type: 'technical', format: 'md', pages: 42, company: 'CloudNine Infrastructure', confidential: false, tags: ['architecture', 'technical', 'cloud'] },
  { id: 'doc-007', title: 'Customer Success Report', type: 'analytics', format: 'xlsx', pages: 12, company: 'SmartRetail ME', confidential: false, tags: ['analytics', 'customer', 'success'] },
  { id: 'doc-008', title: 'Compliance Checklist', type: 'compliance', format: 'pdf', pages: 8, company: 'NexusGov Solutions', confidential: true, tags: ['compliance', 'government', 'regulatory'] },
  { id: 'doc-009', title: 'Market Analysis Report', type: 'research', format: 'pdf', pages: 36, company: 'MediaPulse Analytics', confidential: false, tags: ['market', 'analysis', 'competitive'] },
  { id: 'doc-010', title: 'Integration API Specification', type: 'technical', format: 'yaml', pages: 28, company: 'FinStack', confidential: false, tags: ['api', 'integration', 'technical'] },
];

// ── Users Fixture ──
const users = [
  { id: 'user-admin-001', email: 'admin@deepmindq.com', name: 'Primary Admin', role: 'admin', isActive: true, hasPassword: true, avatarUrl: null },
  { id: 'user-operator-001', email: 'operator@deepmindq.com', name: 'Operations Lead', role: 'operator', isActive: true, hasPassword: true, avatarUrl: null },
  { id: 'user-user-001', email: 'user@deepmindq.com', name: 'Standard User', role: 'user', isActive: true, hasPassword: true, avatarUrl: null },
  { id: 'user-viewer-001', email: 'viewer@deepmindq.com', name: 'Report Viewer', role: 'viewer', isActive: true, hasPassword: true, avatarUrl: null },
  { id: 'user-inactive-001', email: 'inactive@deepmindq.com', name: 'Deactivated User', role: 'user', isActive: false, hasPassword: true, avatarUrl: null },
  { id: 'user-nopass-001', email: 'newuser@deepmindq.com', name: 'New OTP User', role: 'user', isActive: true, hasPassword: false, avatarUrl: null },
];

// Write files
fs.writeFileSync(path.join(FIXTURES_DIR, 'contacts', 'index.ts'), `/**
 * DeepMindQ Enterprise Test Fixtures — Contacts
 * Milestone 3: 20 enterprise contacts across industries
 *
 * Usage: import { testContacts } from '@/tests/fixtures/contacts'
 */

export const testContacts = ${JSON.stringify(contacts, null, 2)} as const;

export const testContactsByIndustry = (industry: string) =>
  testContacts.filter(c => c.industry === industry);

export const testContactsBySeniority = (seniority: string) =>
  testContacts.filter(c => c.seniority === seniority);

export const testContactsByCompany = (company: string) =>
  testContacts.filter(c => c.company === company);

export default testContacts;
`);

fs.writeFileSync(path.join(FIXTURES_DIR, 'documents', 'index.ts'), `/**
 * DeepMindQ Enterprise Test Fixtures — Documents
 * Milestone 3: 10 test documents across types
 */

export const testDocuments = ${JSON.stringify(documents, null, 2)} as const;

export const testDocumentsByType = (type: string) =>
  testDocuments.filter(d => d.type === type);

export const testConfidentialDocuments = () =>
  testDocuments.filter(d => d.confidential);

export default testDocuments;
`);

fs.writeFileSync(path.join(FIXTURES_DIR, 'users', 'index.ts'), `/**
 * DeepMindQ Enterprise Test Fixtures — Users
 * Milestone 3: 6 test users covering all roles + edge cases
 */

export const testUsers = ${JSON.stringify(users, null, 2)} as const;

export const testUsersByRole = (role: string) =>
  testUsers.filter(u => u.role === role);

export const testActiveUsers = () =>
  testUsers.filter(u => u.isActive);

export const testInactiveUsers = () =>
  testUsers.filter(u => !u.isActive);

export const testUsersWithoutPassword = () =>
  testUsers.filter(u => !u.hasPassword);

export default testUsers;
`);

console.log('✅ Fixtures created: contacts (20), documents (10), users (6)');
