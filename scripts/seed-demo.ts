/**
 * seed-demo.ts — Comprehensive demo data for DeepMindQ CRM
 *
 * Generates: 1 admin user, 30+ companies, 100+ contacts, 15+ research cards,
 * 30+ opportunities, 50+ timeline entries, 40+ notes, 20+ drafts, 30+ health
 * checks, 5+ knowledge documents with snippets, and user preferences.
 *
 * Usage: cd /home/z/my-project && bun run scripts/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── Helpers ──────────────────────────────────────────────────────────

const DAY = 86_400_000
const HOUR = 3_600_000

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY)
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * HOUR)
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ─── Company Definitions ──────────────────────────────────────────────

interface CompanyDef {
  name: string
  domain: string
  website: string
  industry: string
  employeeSize: string
  country: string
  location: string
  status: string
  intelligenceScore: number
  dataFreshness: string
}

const companies: CompanyDef[] = [
  { name: 'NovaTech Solutions', domain: 'novatech.io', website: 'https://novatech.io', industry: 'Technology', employeeSize: '201-500', country: 'US', location: 'San Francisco, CA', status: 'active', intelligenceScore: 82, dataFreshness: 'fresh' },
  { name: 'HealthBridge Analytics', domain: 'healthbridge.com', website: 'https://healthbridge.com', industry: 'Healthcare', employeeSize: '51-200', country: 'US', location: 'Boston, MA', status: 'active', intelligenceScore: 85, dataFreshness: 'fresh' },
  { name: 'FinEdge Capital', domain: 'finedge.capital', website: 'https://finedge.capital', industry: 'FinTech', employeeSize: '51-200', country: 'US', location: 'New York, NY', status: 'active', intelligenceScore: 79, dataFreshness: 'fresh' },
  { name: 'CloudPeak Systems', domain: 'cloudpeak.io', website: 'https://cloudpeak.io', industry: 'SaaS', employeeSize: '201-500', country: 'US', location: 'Seattle, WA', status: 'active', intelligenceScore: 76, dataFreshness: 'fresh' },
  { name: 'DataVault AI', domain: 'datavault.ai', website: 'https://datavault.ai', industry: 'SaaS', employeeSize: '51-200', country: 'US', location: 'Austin, TX', status: 'active', intelligenceScore: 88, dataFreshness: 'fresh' },
  { name: 'RetailFlow Inc', domain: 'retailflow.com', website: 'https://retailflow.com', industry: 'Retail', employeeSize: '501-1000', country: 'US', location: 'Chicago, IL', status: 'active', intelligenceScore: 71, dataFreshness: 'stale' },
  { name: 'GreenGrid Energy', domain: 'greengrid.energy', website: 'https://greengrid.energy', industry: 'Energy', employeeSize: '201-500', country: 'Germany', location: 'Berlin, Germany', status: 'new', intelligenceScore: 64, dataFreshness: 'unknown' },
  { name: 'EduSpark Learning', domain: 'eduspark.com', website: 'https://eduspark.com', industry: 'Education', employeeSize: '11-50', country: 'India', location: 'Bangalore, India', status: 'active', intelligenceScore: 62, dataFreshness: 'fresh' },
  { name: 'MedSync Health', domain: 'medsync.health', website: 'https://medsync.health', industry: 'Healthcare', employeeSize: '201-500', country: 'US', location: 'San Diego, CA', status: 'active', intelligenceScore: 81, dataFreshness: 'fresh' },
  { name: 'CyberShield Corp', domain: 'cybershield.io', website: 'https://cybershield.io', industry: 'Technology', employeeSize: '51-200', country: 'US', location: 'Arlington, VA', status: 'active', intelligenceScore: 90, dataFreshness: 'fresh' },
  { name: 'AgriTech Solutions', domain: 'agritech.com', website: 'https://agritech.com', industry: 'Agriculture', employeeSize: '51-200', country: 'US', location: 'Des Moines, IA', status: 'new', intelligenceScore: 55, dataFreshness: 'unknown' },
  { name: 'BuildRight Construction', domain: 'buildright.co', website: 'https://buildright.co', industry: 'Manufacturing', employeeSize: '501-1000', country: 'UK', location: 'Manchester, UK', status: 'new', intelligenceScore: 48, dataFreshness: 'unknown' },
  { name: 'TravelWise Group', domain: 'travelwise.com', website: 'https://travelwise.com', industry: 'Travel', employeeSize: '201-500', country: 'US', location: 'Orlando, FL', status: 'active', intelligenceScore: 67, dataFreshness: 'stale' },
  { name: 'InsureGuard Plus', domain: 'insureguard.com', website: 'https://insureguard.com', industry: 'Insurance', employeeSize: '1001-5000', country: 'US', location: 'Hartford, CT', status: 'active', intelligenceScore: 73, dataFreshness: 'fresh' },
  { name: 'MediaPulse Digital', domain: 'mediapulse.io', website: 'https://mediapulse.io', industry: 'Media', employeeSize: '51-200', country: 'US', location: 'Los Angeles, CA', status: 'active', intelligenceScore: 77, dataFreshness: 'fresh' },
  { name: 'LogiTrack Supply', domain: 'logitrack.com', website: 'https://logitrack.com', industry: 'Logistics', employeeSize: '201-500', country: 'Netherlands', location: 'Amsterdam, Netherlands', status: 'new', intelligenceScore: 59, dataFreshness: 'unknown' },
  { name: 'LegalEdge Partners', domain: 'legaledge.law', website: 'https://legaledge.law', industry: 'Legal', employeeSize: '51-200', country: 'US', location: 'Washington, DC', status: 'new', intelligenceScore: 51, dataFreshness: 'unknown' },
  { name: 'GovTech Solutions', domain: 'govtech.gov', website: 'https://govtech.gov', industry: 'Government', employeeSize: '201-500', country: 'US', location: 'Washington, DC', status: 'active', intelligenceScore: 68, dataFreshness: 'stale' },
  { name: 'BioGenix Labs', domain: 'biogenix.com', website: 'https://biogenix.com', industry: 'Biotech', employeeSize: '201-500', country: 'US', location: 'Cambridge, MA', status: 'active', intelligenceScore: 87, dataFreshness: 'fresh' },
  { name: 'TeleConnect Networks', domain: 'teleconnect.net', website: 'https://teleconnect.net', industry: 'Telecommunications', employeeSize: '1001-5000', country: 'US', location: 'Dallas, TX', status: 'active', intelligenceScore: 70, dataFreshness: 'stale' },
  { name: 'AeroVista Systems', domain: 'aerovista.aero', website: 'https://aerovista.aero', industry: 'Aerospace', employeeSize: '1001-5000', country: 'US', location: 'Huntsville, AL', status: 'active', intelligenceScore: 83, dataFreshness: 'fresh' },
  { name: 'QuantumRetail Co', domain: 'quantumretail.com', website: 'https://quantumretail.com', industry: 'E-commerce', employeeSize: '501-1000', country: 'US', location: 'Denver, CO', status: 'active', intelligenceScore: 75, dataFreshness: 'fresh' },
  { name: 'Pinnacle Consulting', domain: 'pinnacle.consulting', website: 'https://pinnacle.consulting', industry: 'Consulting', employeeSize: '51-200', country: 'UK', location: 'London, UK', status: 'active', intelligenceScore: 69, dataFreshness: 'stale' },
  { name: 'SolarEdge Tech', domain: 'solaredgetech.com', website: 'https://solaredgetech.com', industry: 'Energy', employeeSize: '51-200', country: 'Germany', location: 'Munich, Germany', status: 'new', intelligenceScore: 61, dataFreshness: 'unknown' },
  { name: 'CareFirst Medical', domain: 'carefirst.med', website: 'https://carefirst.med', industry: 'Healthcare', employeeSize: '501-1000', country: 'Canada', location: 'Toronto, Canada', status: 'active', intelligenceScore: 78, dataFreshness: 'fresh' },
  { name: 'FleetWise Automotive', domain: 'fleetwise.auto', website: 'https://fleetwise.auto', industry: 'Automotive', employeeSize: '501-1000', country: 'Germany', location: 'Stuttgart, Germany', status: 'new', intelligenceScore: 56, dataFreshness: 'unknown' },
  { name: 'NonProfit Hub', domain: 'nonprofithub.org', website: 'https://nonprofithub.org', industry: 'Non-Profit', employeeSize: '11-50', country: 'US', location: 'Portland, OR', status: 'new', intelligenceScore: 42, dataFreshness: 'unknown' },
  { name: 'SecureNet Solutions', domain: 'securenet.io', website: 'https://securenet.io', industry: 'Technology', employeeSize: '201-500', country: 'US', location: 'Reston, VA', status: 'active', intelligenceScore: 84, dataFreshness: 'fresh' },
  { name: 'Apex Manufacturing', domain: 'apexmfg.com', website: 'https://apexmfg.com', industry: 'Manufacturing', employeeSize: '1001-5000', country: 'US', location: 'Detroit, MI', status: 'active', intelligenceScore: 66, dataFreshness: 'stale' },
  { name: 'BrightPath Education', domain: 'brightpath.edu', website: 'https://brightpath.edu', industry: 'Education', employeeSize: '201-500', country: 'US', location: 'New York, NY', status: 'new', intelligenceScore: 58, dataFreshness: 'unknown' },
  { name: 'VertexAI Labs', domain: 'vertexai.io', website: 'https://vertexai.io', industry: 'Technology', employeeSize: '51-200', country: 'US', location: 'Palo Alto, CA', status: 'active', intelligenceScore: 91, dataFreshness: 'fresh' },
  { name: 'ClearView Insurance', domain: 'clearview.ins', website: 'https://clearview.ins', industry: 'Insurance', employeeSize: '201-500', country: 'UK', location: 'London, UK', status: 'active', intelligenceScore: 72, dataFreshness: 'stale' },
]

// ─── Contact Definitions (per company) ───────────────────────────────

interface ContactDef {
  firstName: string
  lastName: string
  jobTitle: string
  roleBucket: string
  status: string
}

const contactTemplates: ContactDef[][] = [
  // NovaTech Solutions
  [
    { firstName: 'James', lastName: 'Chen', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Sarah', lastName: 'Mitchell', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Michael', lastName: 'Torres', jobTitle: 'VP Engineering', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Emily', lastName: 'Nakamura', jobTitle: 'Senior Engineer', roleBucket: 'Technical', status: 'active' },
    { firstName: 'David', lastName: 'Kim', jobTitle: 'Sales Director', roleBucket: 'Sales', status: 'active' },
  ],
  // HealthBridge Analytics
  [
    { firstName: 'Patricia', lastName: 'Wong', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Robert', lastName: 'Johnson', jobTitle: 'CFO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Amanda', lastName: 'Foster', jobTitle: 'Director of Product', roleBucket: 'Manager', status: 'active' },
    { firstName: 'Kevin', lastName: 'Patel', jobTitle: 'Head of Marketing', roleBucket: 'Manager', status: 'active' },
  ],
  // FinEdge Capital
  [
    { firstName: 'William', lastName: 'Blackwell', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Jennifer', lastName: 'Liu', jobTitle: 'COO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Thomas', lastName: 'Anderson', jobTitle: 'VP Sales', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Rachel', lastName: 'Dubois', jobTitle: 'Account Executive', roleBucket: 'Sales', status: 'active' },
    { firstName: 'Mark', lastName: 'Sullivan', jobTitle: 'Data Scientist', roleBucket: 'Technical', status: 'active' },
  ],
  // CloudPeak Systems
  [
    { firstName: 'Daniel', lastName: 'O\'Brien', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Lisa', lastName: 'Ramirez', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Andrew', lastName: 'Park', jobTitle: 'Engineering Manager', roleBucket: 'Manager', status: 'active' },
    { firstName: 'Nicole', lastName: 'Thompson', jobTitle: 'Lead Developer', roleBucket: 'Technical', status: 'active' },
  ],
  // DataVault AI
  [
    { firstName: 'Alexander', lastName: 'Petrov', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Christine', lastName: 'Wu', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Ryan', lastName: 'Garcia', jobTitle: 'DevOps Lead', roleBucket: 'Technical', status: 'active' },
    { firstName: 'Jessica', lastName: 'Martinez', jobTitle: 'Director of Product', roleBucket: 'Manager', status: 'active' },
    { firstName: 'Brian', lastName: 'Hayes', jobTitle: 'Sales Director', roleBucket: 'Sales', status: 'active' },
  ],
  // RetailFlow Inc
  [
    { firstName: 'Gregory', lastName: 'Wallace', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Diana', lastName: 'Ross', jobTitle: 'CFO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Paul', lastName: 'Williams', jobTitle: 'VP Engineering', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Samantha', lastName: 'Lee', jobTitle: 'Operations Manager', roleBucket: 'Operations', status: 'active' },
  ],
  // GreenGrid Energy
  [
    { firstName: 'Hans', lastName: 'Mueller', jobTitle: 'CEO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Klaus', lastName: 'Schmidt', jobTitle: 'CTO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Anna', lastName: 'Weber', jobTitle: 'Head of Marketing', roleBucket: 'Manager', status: 'new' },
  ],
  // EduSpark Learning
  [
    { firstName: 'Priya', lastName: 'Sharma', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Raj', lastName: 'Kapoor', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Arun', lastName: 'Reddy', jobTitle: 'Senior Engineer', roleBucket: 'Technical', status: 'active' },
    { firstName: 'Meera', lastName: 'Gupta', jobTitle: 'Director of Product', roleBucket: 'Manager', status: 'active' },
  ],
  // MedSync Health
  [
    { firstName: 'Elizabeth', lastName: 'Carter', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Jonathan', lastName: 'Reed', jobTitle: 'CFO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Maria', lastName: 'Gonzalez', jobTitle: 'VP Engineering', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Steven', lastName: 'Huang', jobTitle: 'Data Scientist', roleBucket: 'Technical', status: 'active' },
    { firstName: 'Laura', lastName: 'Bennett', jobTitle: 'HR Director', roleBucket: 'Operations', status: 'active' },
  ],
  // CyberShield Corp
  [
    { firstName: 'Christopher', lastName: 'Morris', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Victoria', lastName: 'Chang', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Nathan', lastName: 'Brooks', jobTitle: 'Lead Developer', roleBucket: 'Technical', status: 'active' },
    { firstName: 'Olivia', lastName: 'Foster', jobTitle: 'Account Executive', roleBucket: 'Sales', status: 'active' },
  ],
  // AgriTech Solutions
  [
    { firstName: 'George', lastName: 'Henderson', jobTitle: 'CEO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Carol', lastName: 'Davis', jobTitle: 'COO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Frank', lastName: 'Miller', jobTitle: 'Engineering Manager', roleBucket: 'Manager', status: 'new' },
  ],
  // BuildRight Construction
  [
    { firstName: 'Arthur', lastName: 'Crawford', jobTitle: 'CEO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Helen', lastName: 'Wright', jobTitle: 'CFO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Ian', lastName: 'Taylor', jobTitle: 'Operations Manager', roleBucket: 'Operations', status: 'new' },
    { firstName: 'Susan', lastName: 'Clark', jobTitle: 'Project Manager', roleBucket: 'Operations', status: 'new' },
  ],
  // TravelWise Group
  [
    { firstName: 'Kenneth', lastName: 'Scott', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Nancy', lastName: 'Adams', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Derek', lastName: 'Morgan', jobTitle: 'Sales Director', roleBucket: 'Sales', status: 'active' },
  ],
  // InsureGuard Plus
  [
    { firstName: 'Frederick', lastName: 'Baker', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Catherine', lastName: 'Evans', jobTitle: 'COO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Peter', lastName: 'Jensen', jobTitle: 'VP Sales', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Deborah', lastName: 'Cooper', jobTitle: 'Account Executive', roleBucket: 'Sales', status: 'active' },
    { firstName: 'Raymond', lastName: 'Bailey', jobTitle: 'Senior Engineer', roleBucket: 'Technical', status: 'active' },
  ],
  // MediaPulse Digital
  [
    { firstName: 'Jason', lastName: 'Reynolds', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Stephanie', lastName: 'Cole', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Eric', lastName: 'Ward', jobTitle: 'Head of Marketing', roleBucket: 'Manager', status: 'active' },
    { firstName: 'Michelle', lastName: 'Richardson', jobTitle: 'Director of Product', roleBucket: 'Manager', status: 'active' },
  ],
  // LogiTrack Supply
  [
    { firstName: 'Willem', lastName: 'de Vries', jobTitle: 'CEO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Annelies', lastName: 'Bakker', jobTitle: 'COO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Pieter', lastName: 'van Dijk', jobTitle: 'Engineering Manager', roleBucket: 'Manager', status: 'new' },
  ],
  // LegalEdge Partners
  [
    { firstName: 'Richard', lastName: 'Stevens', jobTitle: 'Managing Partner', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Catherine', lastName: 'Hughes', jobTitle: 'COO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Thomas', lastName: 'Kelley', jobTitle: 'Operations Manager', roleBucket: 'Operations', status: 'new' },
  ],
  // GovTech Solutions
  [
    { firstName: 'Martin', lastName: 'Pierce', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Linda', lastName: 'Griffin', jobTitle: 'VP Engineering', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Scott', lastName: 'Campbell', jobTitle: 'Project Manager', roleBucket: 'Operations', status: 'active' },
    { firstName: 'Barbara', lastName: 'Phillips', jobTitle: 'Account Executive', roleBucket: 'Sales', status: 'active' },
  ],
  // BioGenix Labs
  [
    { firstName: 'Alan', lastName: 'Richardson', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Karen', lastName: 'West', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Douglas', lastName: 'Holmes', jobTitle: 'Lead Developer', roleBucket: 'Technical', status: 'active' },
    { firstName: 'Angela', lastName: 'Stone', jobTitle: 'Data Scientist', roleBucket: 'Technical', status: 'active' },
    { firstName: 'Jeffrey', lastName: 'Palmer', jobTitle: 'Sales Director', roleBucket: 'Sales', status: 'active' },
  ],
  // TeleConnect Networks
  [
    { firstName: 'Bruce', lastName: 'Marshall', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Sharon', lastName: 'Fletcher', jobTitle: 'CFO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Gerald', lastName: 'Gordon', jobTitle: 'VP Engineering', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Janet', lastName: 'Lane', jobTitle: 'Director of Product', roleBucket: 'Manager', status: 'active' },
  ],
  // AeroVista Systems
  [
    { firstName: 'Harold', lastName: 'Webb', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Diane', lastName: 'Hunt', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Patrick', lastName: 'Crawford', jobTitle: 'Senior Engineer', roleBucket: 'Technical', status: 'active' },
    { firstName: 'Alice', lastName: 'Morrison', jobTitle: 'HR Director', roleBucket: 'Operations', status: 'active' },
  ],
  // QuantumRetail Co
  [
    { firstName: 'Timothy', lastName: 'Hudson', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Rebecca', lastName: 'Wheeler', jobTitle: 'COO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Jack', lastName: 'Lawson', jobTitle: 'VP Sales', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Hannah', lastName: 'Dunn', jobTitle: 'Business Development Rep', roleBucket: 'Sales', status: 'active' },
    { firstName: 'Carlos', lastName: 'Mendez', jobTitle: 'Lead Developer', roleBucket: 'Technical', status: 'active' },
  ],
  // Pinnacle Consulting
  [
    { firstName: 'Edward', lastName: 'Spencer', jobTitle: 'Managing Partner', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Margaret', lastName: 'Holland', jobTitle: 'Director of Product', roleBucket: 'Manager', status: 'active' },
    { firstName: 'George', lastName: 'Carter', jobTitle: 'Account Executive', roleBucket: 'Sales', status: 'active' },
  ],
  // SolarEdge Tech
  [
    { firstName: 'Wolfgang', lastName: 'Becker', jobTitle: 'CEO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Ingrid', lastName: 'Fischer', jobTitle: 'CTO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Stefan', lastName: 'Wagner', jobTitle: 'Engineering Manager', roleBucket: 'Manager', status: 'new' },
  ],
  // CareFirst Medical
  [
    { firstName: 'Robert', lastName: 'MacDonald', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Susan', lastName: 'Bernard', jobTitle: 'CFO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Andrew', lastName: 'Campbell', jobTitle: 'VP Engineering', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Patricia', lastName: 'Kelly', jobTitle: 'Director of Product', roleBucket: 'Manager', status: 'active' },
  ],
  // FleetWise Automotive
  [
    { firstName: 'Klaus', lastName: 'Richter', jobTitle: 'CEO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Bruno', lastName: 'Schneider', jobTitle: 'COO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Lukas', lastName: 'Braun', jobTitle: 'Operations Manager', roleBucket: 'Operations', status: 'new' },
    { firstName: 'Eva', lastName: 'Koch', jobTitle: 'Head of Marketing', roleBucket: 'Manager', status: 'new' },
  ],
  // NonProfit Hub
  [
    { firstName: 'Dorothy', lastName: 'Woods', jobTitle: 'Executive Director', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Henry', lastName: 'Jordan', jobTitle: 'Operations Manager', roleBucket: 'Operations', status: 'new' },
    { firstName: 'Ruth', lastName: 'Harrison', jobTitle: 'Project Manager', roleBucket: 'Operations', status: 'new' },
  ],
  // SecureNet Solutions
  [
    { firstName: 'Vincent', lastName: 'Palmer', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Monica', lastName: 'Reyes', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Dennis', lastName: 'Price', jobTitle: 'Lead Developer', roleBucket: 'Technical', status: 'active' },
    { firstName: 'Cynthia', lastName: 'Powell', jobTitle: 'Sales Director', roleBucket: 'Sales', status: 'active' },
    { firstName: 'Franklin', lastName: 'Howard', jobTitle: 'DevOps Lead', roleBucket: 'Technical', status: 'active' },
  ],
  // Apex Manufacturing
  [
    { firstName: 'Raymond', lastName: 'Cooper', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Martha', lastName: 'Peterson', jobTitle: 'CFO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Jerry', lastName: 'Gray', jobTitle: 'VP Engineering', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Teresa', lastName: 'Sanders', jobTitle: 'HR Director', roleBucket: 'Operations', status: 'active' },
  ],
  // BrightPath Education
  [
    { firstName: 'Nicholas', lastName: 'Barnes', jobTitle: 'CEO', roleBucket: 'Executive', status: 'new' },
    { firstName: 'Janet', lastName: 'Ross', jobTitle: 'Director of Product', roleBucket: 'Manager', status: 'new' },
    { firstName: 'Roy', lastName: 'Henderson', jobTitle: 'Engineering Manager', roleBucket: 'Manager', status: 'new' },
  ],
  // VertexAI Labs
  [
    { firstName: 'Marcus', lastName: 'Chen', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Sophia', lastName: 'Patel', jobTitle: 'CTO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Leo', lastName: 'Zhang', jobTitle: 'Lead Developer', roleBucket: 'Technical', status: 'active' },
    { firstName: 'Emma', lastName: 'Williams', jobTitle: 'Data Scientist', roleBucket: 'Technical', status: 'active' },
    { firstName: 'Owen', lastName: 'Bradley', jobTitle: 'Business Development Rep', roleBucket: 'Sales', status: 'active' },
  ],
  // ClearView Insurance
  [
    { firstName: 'Philip', lastName: 'Turner', jobTitle: 'CEO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Anne', lastName: 'Phillips', jobTitle: 'COO', roleBucket: 'Executive', status: 'active' },
    { firstName: 'Clifford', lastName: 'Evans', jobTitle: 'Account Executive', roleBucket: 'Sales', status: 'active' },
    { firstName: 'Grace', lastName: 'Collins', jobTitle: 'Director of Product', roleBucket: 'Manager', status: 'active' },
  ],
]

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Starting demo data seed...')

  // ── Step 1: Clear all existing data (respect FK constraints) ────────
  console.log('🗑️  Clearing existing data...')
  const deleteOrder = [
    'customFieldValue',
    'customFieldDefinition',
    'emailHealthCheck',
    'draft',
    'timelineEntry',
    'companyNote',
    'contactNote',
    'companyResearchSource',
    'companyResearchCard',
    'opportunity',
    'contact',
    'company',
    'importBatch',
    'capabilitySnippet',
    'capabilityDocument',
    'userPreferences',
    'notification',
    'task',
    'auditLog',
    'session',
    'account',
    'user',
    'verificationToken',
  ] as const

  for (const model of deleteOrder) {
    try {
      await (prisma as any)[model].deleteMany({})
    } catch (err) {
      console.log(`  ⚠️  Could not delete ${model}: ${(err as Error).message}`)
    }
  }

  console.log('✅ All existing data cleared.')

  // ── Step 2: Create Admin User ───────────────────────────────────────
  console.log('👤 Creating admin user...')
  const passwordHash = await bcrypt.hash('DeepMindQ@2024', 12)
  const adminUser = await prisma.user.create({
    data: {
      name: 'Ravi Kumar',
      email: 'ravi@deepmindq.com',
      passwordHash,
      role: 'admin',
      lastLoginAt: daysAgo(0),
    },
  })
  console.log(`  ✅ Created user: ${adminUser.email}`)

  // ── Step 3: Create Companies ────────────────────────────────────────
  console.log('🏢 Creating companies...')
  const createdCompanies: any[] = []
  for (const c of companies) {
    const company = await prisma.company.create({
      data: {
        name: c.name,
        domain: c.domain,
        website: c.website,
        linkedinUrl: `https://linkedin.com/company/${c.domain.split('.')[0]}`,
        industry: c.industry,
        employeeSize: c.employeeSize,
        country: c.country,
        location: c.location,
        status: c.status,
        intelligenceScore: c.intelligenceScore,
        dataFreshness: c.dataFreshness,
      },
    })
    createdCompanies.push(company)
  }
  console.log(`  ✅ Created ${createdCompanies.length} companies`)

  // ── Step 4: Create Contacts ─────────────────────────────────────────
  console.log('👥 Creating contacts...')
  const createdContacts: any[] = []
  for (let i = 0; i < createdCompanies.length; i++) {
    const company = createdCompanies[i]
    const templates = contactTemplates[i] || []
    for (const t of templates) {
      const emailLocal = `${t.firstName.toLowerCase()}.${t.lastName.toLowerCase().replace(/'/g, '')}`
      const contact = await prisma.contact.create({
        data: {
          companyId: company.id,
          name: `${t.firstName} ${t.lastName}`,
          email: `${emailLocal}@${company.domain}`,
          jobTitle: t.jobTitle,
          roleBucket: t.roleBucket,
          linkedinUrl: `https://linkedin.com/in/${emailLocal.replace(/\./g, '-')}`,
          phone: `+1 ${randomInt(200, 999)}-${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
          location: company.location,
          status: t.status,
          emailHealth: 'unknown',
        },
      })
      createdContacts.push(contact)
    }
  }
  console.log(`  ✅ Created ${createdContacts.length} contacts`)

  // ── Step 5: Create Research Cards (for first 18 active companies) ───
  console.log('🔍 Creating research cards...')
  let researchCount = 0
  function makeResearchTemplates(name: string) {
    return {
      overview: `${name} is a technology company focused on developing innovative software solutions for enterprise clients. They have built a strong reputation in the market by consistently delivering high-quality products that address critical business needs. Their technology stack includes modern cloud-native architectures and they have been investing heavily in AI and machine learning capabilities over the past two years. The company has experienced steady revenue growth of 20-30% year-over-year and has expanded their customer base significantly across North America and Europe. Their engineering team is known for adopting best practices in software development, including CI/CD, microservices, and comprehensive testing strategies.`,
      tech: `${name} currently operates on a modern technology stack built around cloud-native principles. Their primary infrastructure runs on AWS with Kubernetes orchestration for containerized workloads. The backend services are primarily built with Node.js and Python, utilizing microservices architecture with gRPC for inter-service communication. They use PostgreSQL and MongoDB for data storage, with Redis for caching and RabbitMQ for message queuing. On the frontend, they leverage React with TypeScript for their customer-facing applications. Their DevOps practices include Infrastructure as Code using Terraform, comprehensive CI/CD pipelines with GitHub Actions, and extensive monitoring with Datadog and Grafana.`,
      challenges: `${name} faces several key challenges in the current market. First, they are dealing with increasing competition from both established players and well-funded startups entering their space. Second, their rapid growth has created technical debt in some legacy services that need modernization. Third, hiring and retaining top engineering talent in the competitive tech market continues to be a significant challenge. Fourth, they need to scale their infrastructure to handle 3x projected growth while maintaining their current 99.9% uptime SLA. Finally, they are navigating complex data privacy regulations across multiple jurisdictions as they expand internationally.`,
      opportunities: `${name} has several compelling opportunities for growth. Their existing customer base provides a strong foundation for upselling and cross-selling additional services. The growing demand for AI-powered solutions aligns perfectly with their recent R&D investments. They are well-positioned to expand into adjacent markets, particularly in healthcare and financial services where digital transformation is accelerating. Their strong engineering culture and technical expertise make them an attractive partner for large enterprise digital transformation initiatives. Additionally, their reputation for quality and reliability gives them an advantage in winning government and regulated industry contracts.`,
      services: `Based on ${name}'s technology landscape and challenges, we can offer several relevant services: Cloud infrastructure optimization and cost reduction, Legacy system modernization and migration to microservices, AI/ML implementation and data engineering, DevOps maturity assessment and CI/CD pipeline enhancement, Security assessment and compliance engineering, and Talent acquisition strategy consulting for engineering teams.`,
      decisionMakers: `Key decision makers at ${name} include the CEO who drives strategic direction, the CTO who makes technology investment decisions, the VP of Engineering who influences technical tooling choices, and the Director of Product who defines product requirements. The CFO is also a critical stakeholder for any significant technology investment decisions, particularly those involving infrastructure costs or subscription-based services.`,
    }
  }

  function makeHealthcareTemplates(name: string) {
    return {
      overview: `${name} is a healthcare technology company that specializes in developing data analytics and patient management solutions for healthcare providers and hospital systems. They have built a comprehensive platform that helps healthcare organizations improve patient outcomes through data-driven insights and workflow automation. The company serves over 500 healthcare facilities across the United States and has been expanding their presence in European and Asian markets. Their solutions are HIPAA-compliant and have received several industry certifications for data security and interoperability with major EHR systems.`,
      tech: `${name} has built their technology platform with a strong emphasis on security and compliance given the healthcare context. Their infrastructure is hosted on AWS with dedicated VPCs and encryption at rest and in transit. The backend is built with Java Spring Boot microservices, using PostgreSQL for clinical data and Elasticsearch for analytics queries. They have implemented a FHIR-compliant API layer for EHR interoperability. Their data pipeline uses Apache Kafka for real-time event processing and Apache Spark for batch analytics. Security measures include SOC 2 Type II compliance, regular penetration testing, and a comprehensive audit logging system.`,
      challenges: `${name} faces unique challenges in the healthcare technology space. Navigating complex and evolving healthcare regulations (HIPAA, HITECH, 21st Century Cures Act) requires constant vigilance and compliance investment. Interoperability with the wide variety of EHR systems used by their clients remains technically challenging. They face pressure to demonstrate clear ROI to hospital administrators who are dealing with tight budgets. Additionally, the sensitivity of patient data requires them to maintain the highest security standards, which increases development and operational costs. Scaling their analytics platform to handle the growing volume of healthcare data from IoT devices and wearable health monitors is an ongoing technical challenge.`,
      opportunities: `The healthcare technology market is experiencing significant growth driven by the shift toward value-based care and digital health adoption. ${name} is well-positioned to capitalize on the growing demand for population health management solutions and AI-assisted clinical decision support. Their existing hospital relationships provide a strong base for expanding their product offerings. There are significant opportunities in telehealth integration, remote patient monitoring, and personalized medicine analytics. The company could also expand into the payer (insurance) market with their analytics capabilities.`,
      services: `For ${name}, we can provide specialized services including: Healthcare data engineering and analytics platform optimization, HIPAA compliance assessment and security hardening, FHIR API development and EHR integration, AI/ML model development for clinical decision support, Cloud infrastructure optimization for healthcare workloads, and Performance engineering for large-scale healthcare data processing.`,
      decisionMakers: `The buying process at ${name} involves the CEO for strategic partnerships, CTO for technology decisions, VP of Engineering for implementation details, and the Chief Medical Information Officer (CMIO) who evaluates clinical value. The compliance officer and CISO are also critical stakeholders for any technology that handles patient data.`,
    }
  }

  function makeFinTechTemplates(name: string) {
    return {
      overview: `${name} is a financial technology company that provides innovative digital banking and payment solutions to both consumers and businesses. They have rapidly grown their user base to over 2 million active users and process billions of dollars in transactions annually. The company operates under multiple regulatory licenses and maintains strict compliance with financial regulations including PCI-DSS, SOX, and various state money transmitter laws. Their product portfolio includes digital payment processing, lending platform, and financial analytics tools that serve a diverse range of clients from small businesses to enterprise corporations.`,
      tech: `${name} operates a robust technology infrastructure designed for high availability, low latency, and regulatory compliance. Their core transaction processing system is built with Go for performance-critical paths and Java for business logic services. They use Apache Kafka for event-driven architecture, enabling real-time transaction processing and monitoring. Data storage includes PostgreSQL for transactional data with read replicas, Cassandra for high-write-volume event storage, and Redis for real-time caching and session management. Their infrastructure runs on a multi-cloud setup with AWS as primary and GCP for specific AI/ML workloads. They have implemented comprehensive monitoring with real-time fraud detection models running on ML pipelines.`,
      challenges: `${name} navigates a complex landscape of challenges. Financial regulations are constantly evolving across different jurisdictions, requiring significant compliance engineering effort. The threat of cybersecurity attacks and fraud is ever-present, requiring continuous investment in security infrastructure and ML-based fraud detection. They face intense competition from both traditional financial institutions modernizing their technology and well-funded FinTech startups. Scaling their transaction processing infrastructure to handle peak loads during high-volume periods while maintaining sub-100ms response times is technically demanding. Additionally, attracting and retaining security-cleared engineering talent is increasingly difficult and expensive.`,
      opportunities: `${name} has significant growth opportunities in the expanding digital payments and embedded finance markets. The trend toward open banking and API-driven financial services aligns well with their platform architecture. They can expand into new geographic markets, particularly in Southeast Asia and Latin America where digital financial services adoption is accelerating. Their existing data assets and analytics capabilities position them well to offer premium business intelligence services to their merchant clients. Strategic partnerships with traditional banks looking to modernize their technology represent a high-value opportunity.`,
      services: `We can offer ${name} services including: High-performance transaction processing system optimization, Real-time fraud detection and anti-money laundering (AML) model development, Cloud infrastructure cost optimization and reliability engineering, API platform development and developer experience enhancement, Regulatory compliance automation and reporting, and Security assessment and penetration testing for financial systems.`,
      decisionMakers: `At ${name}, the CTO drives technology strategy and infrastructure decisions, the CISO oversees security investments, the VP of Engineering influences development tooling and processes, and the Chief Risk Officer is critical for any changes to fraud or compliance systems. The CFO evaluates cost implications of technology investments, and the Head of Product defines feature requirements that drive architectural decisions.`,
    }
  }

  function makeSaaSTemplates(name: string) {
    return {
      overview: `${name} is a Software-as-a-Service company providing enterprise-grade solutions in the productivity and collaboration space. They serve over 10,000 business customers globally, ranging from mid-market companies to large enterprises. Their platform has become a critical tool for their customers' daily operations, resulting in high retention rates and strong Net Promoter Scores. The company has been profitable for the past three years and has been selectively expanding their product portfolio through both organic development and strategic acquisitions. Their engineering team follows modern agile practices and has a strong culture of continuous improvement.`,
      tech: `${name} has built their SaaS platform on a modern, multi-tenant architecture. Their primary application is a React-based single-page application with a GraphQL API layer backed by Node.js microservices. Data storage uses PostgreSQL with Citus extension for horizontal scaling, Elasticsearch for full-text search and analytics, and S3 for document and media storage. Their infrastructure runs on AWS EKS (Kubernetes) with auto-scaling policies that handle traffic variations efficiently. They use Stripe for billing integration, Auth0 for authentication, and LaunchDarkly for feature flags. Their CI/CD pipeline is built on GitHub Actions with ArgoCD for GitOps-based Kubernetes deployments.`,
      challenges: `${name} faces several challenges common to mature SaaS companies. As their customer base has grown, maintaining consistent performance across their multi-tenant architecture requires ongoing optimization. They need to balance feature development velocity with platform stability and reliability. Customer expectations for customization and integrations continue to increase, requiring a robust API strategy and extensibility framework. International expansion demands localization, data residency compliance, and performance optimization for global users. Additionally, the competitive landscape is intensifying with both direct competitors and large platform vendors entering their market.`,
      opportunities: `${name} is positioned to capitalize on several market trends. The continued shift toward remote and hybrid work drives demand for their collaboration tools. Enterprise customers increasingly prefer integrated platform solutions, creating upselling opportunities. AI-powered features represent a significant differentiator they can leverage to increase value and pricing. Their strong customer relationships and high NPS scores provide an excellent foundation for expansion through customer referrals. The growing API economy creates opportunities for them to become a platform that other developers build upon, creating network effects.`,
      services: `For ${name}, relevant services include: Multi-tenant architecture optimization and performance tuning, AI/ML feature development for intelligent automation, API platform development and third-party integration framework, Global infrastructure optimization for latency and compliance, Developer experience and documentation improvement, and Reliability engineering and SLO implementation.`,
      decisionMakers: `Key decision makers at ${name} include the CTO who sets technical direction, VP of Engineering who manages development practices and tooling, Director of Product who defines product roadmap and feature priorities, and the VP of Customer Success who provides input on customer-driven technical needs. The CRO may also be involved for partnerships that have revenue implications.`,
    }
  }

  function getResearchContent(industry: string, companyName: string) {
    switch (industry) {
      case 'Healthcare': return makeHealthcareTemplates(companyName)
      case 'FinTech': return makeFinTechTemplates(companyName)
      case 'SaaS': return makeSaaSTemplates(companyName)
      default: return makeResearchTemplates(companyName)
    }
  }

  for (let i = 0; i < Math.min(18, createdCompanies.length); i++) {
    const company = createdCompanies[i]
    const content = getResearchContent(company.industry, company.name)
    await prisma.companyResearchCard.create({
      data: {
        companyId: company.id,
        businessOverview: content.overview,
        currentTechLandscape: content.tech,
        potentialChallenges: content.challenges,
        possibleOpportunities: content.opportunities,
        relevantServices: content.services,
        keyDecisionMakers: content.decisionMakers,
        confidenceScore: randomInt(70, 95),
        lastResearchedAt: daysAgo(randomInt(1, 14)),
      },
    })
    researchCount++
  }
  console.log(`  ✅ Created ${researchCount} research cards`)

  // ── Step 6: Create Opportunities ────────────────────────────────────
  console.log('💰 Creating opportunities...')
  const oppStatuses = ['researching', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
  const oppTitles = [
    'Enterprise Platform Modernization',
    'Cloud Migration & DevOps Setup',
    'AI/ML Analytics Implementation',
    'Security Assessment & Remediation',
    'Data Pipeline Architecture',
    'API Platform Development',
    'Performance Optimization Engagement',
    'Digital Transformation Consulting',
    'Custom Software Development',
    'Infrastructure Cost Optimization',
    'Mobile App Development',
    'Machine Learning Model Deployment',
    'Legacy System Migration',
    'Real-time Data Processing Setup',
    'CI/CD Pipeline Modernization',
    'Microservices Architecture Design',
    'Database Optimization & Scaling',
    'Observability & Monitoring Setup',
    'Compliance & Audit Automation',
    'Technical Due Diligence',
    'Product Engineering Partnership',
    'QA & Testing Automation',
    'Container Orchestration Setup',
    'Data Warehouse Modernization',
  ]

  const createdOpportunities: any[] = []
  for (let i = 0; i < 35; i++) {
    const company = createdCompanies[i % createdCompanies.length]
    const contacts = createdContacts.filter(c => c.companyId === company.id)
    const targetContact = contacts.length > 0 ? randomFrom(contacts) : null
    const opp = await prisma.opportunity.create({
      data: {
        companyId: company.id,
        title: oppTitles[i % oppTitles.length] + ` for ${company.name}`,
        description: `Explore engagement opportunities with ${company.name} for ${oppTitles[i % oppTitles.length].toLowerCase()}.`,
        targetContactId: targetContact?.id || null,
        status: oppStatuses[i % oppStatuses.length],
        nextAction: i % 3 === 0 ? `Schedule discovery call with ${targetContact?.name || 'decision maker'}` : i % 3 === 1 ? 'Prepare proposal document' : 'Follow up on previous discussion',
      },
    })
    createdOpportunities.push(opp)
  }
  console.log(`  ✅ Created ${createdOpportunities.length} opportunities`)

  // ── Step 7: Create Timeline Entries ─────────────────────────────────
  console.log('📅 Creating timeline entries...')
  const timelineActions: { action: string; companyId: string; details: string; daysBack: number }[] = []

  for (const company of createdCompanies) {
    timelineActions.push({
      action: 'company_created',
      companyId: company.id,
      details: `Company "${company.name}" was added to the database`,
      daysBack: randomInt(20, 30),
    })
  }

  for (let i = 0; i < 30; i++) {
    const contact = createdContacts[i % createdContacts.length]
    timelineActions.push({
      action: 'contact_added',
      companyId: contact.companyId,
      details: `Added ${contact.name} (${contact.jobTitle}) to the contact database`,
      daysBack: randomInt(10, 28),
    })
  }

  for (let i = 0; i < 10; i++) {
    const contact = createdContacts[i]
    timelineActions.push({
      action: 'email_generated',
      companyId: contact.companyId,
      details: `Generated personalized outreach email for ${contact.name}`,
      daysBack: randomInt(1, 20),
    })
  }

  for (let i = 0; i < 10; i++) {
    const company = createdCompanies[i % createdCompanies.length]
    timelineActions.push({
      action: 'research_generated',
      companyId: company.id,
      details: `AI research card generated for ${company.name}`,
      daysBack: randomInt(5, 25),
    })
  }

  for (let i = 0; i < 8; i++) {
    const company = createdCompanies[i]
    timelineActions.push({
      action: 'email_validated',
      companyId: company.id,
      details: `Batch email validation completed for ${company.name} contacts`,
      daysBack: randomInt(2, 15),
    })
  }

  // Sort by daysBack descending then create
  timelineActions.sort((a, b) => b.daysBack - a.daysBack)

  for (const entry of timelineActions) {
    await prisma.timelineEntry.create({
      data: {
        companyId: entry.companyId,
        action: entry.action,
        details: entry.details,
        createdAt: daysAgo(entry.daysBack),
      },
    })
  }
  console.log(`  ✅ Created ${timelineActions.length} timeline entries`)

  // ── Step 8: Create Notes ────────────────────────────────────────────
  console.log('📝 Creating notes...')
  const companyNoteBodies = [
    'Had an initial discovery call. They are looking to modernize their legacy infrastructure and are particularly interested in cloud migration. Budget is allocated for Q2. Next step is to schedule a technical deep-dive.',
    'Met with their engineering team at the conference. They mentioned struggling with their CI/CD pipeline and deployment frequency. Good potential for DevOps engagement.',
    'Research indicates strong growth trajectory. They recently raised Series C funding and are actively expanding their engineering team. Good timing for outreach.',
    'Previous outreach went unanswered. Trying a different approach — connecting through their VP of Engineering who I met at a meetup last month.',
    'They are evaluating multiple vendors for their data platform modernization. Our experience with similar companies gives us a competitive edge. Need to prepare a strong proposal.',
    'Excellent call with the CTO. They have a clear technical vision and are looking for a partner, not just a vendor. Alignment on technology stack and approach.',
    'Their current platform is experiencing performance issues at scale. They handle 10x growth in traffic during peak seasons and need help architecting for this.',
    'Discussion about AI/ML capabilities. They want to integrate machine learning into their product but lack internal expertise. This could be a significant engagement.',
    'Followed up on the proposal sent last week. They are reviewing with their board and expect a decision by end of month.',
    'Competitive intelligence: They recently chose a competitor for a smaller project. Need to understand why and adjust our approach for the larger engagement.',
    'Attended their product launch event. Impressive technology but they admitted their infrastructure team is stretched thin. Potential entry point.',
    'Referral from existing client. Their CTO recommended us for the security assessment work. Strong warm introduction.',
    'They are going through a digital transformation initiative and have budget approved for external consulting. Multiple workstreams available.',
    'Discussed their tech stack in detail. Heavy reliance on legacy Java applications that need gradual migration. Risk-averse culture — need to propose incremental approach.',
    'Annual review meeting went well. They renewed the maintenance contract and are interested in expanding scope to include performance monitoring.',
    'Received feedback that our initial pitch was too generic. Need to customize more for their specific industry challenges and regulatory requirements.',
    'Their new VP of Engineering is more open to external partnerships than the previous one. Great opportunity to re-engage.',
    'Shared a case study relevant to their industry. They expressed strong interest and requested a detailed proposal.',
    'Cold outreach via LinkedIn resulted in a positive response. Setting up an introductory call for next week.',
    'They mentioned during the call that compliance requirements are driving their need for better logging and monitoring infrastructure.',
  ]

  const contactNoteBodies = [
    'Very responsive to emails. Prefers morning calls. Technical background — can discuss architecture in detail.',
    'Met at the industry conference. Warm personality, genuinely interested in exploring partnerships. Follow up with technical whitepaper.',
    'Busy schedule — best to reach via email first. Has decision-making authority for technology vendors up to $100K.',
    'Prefers concise communications. Has expressed frustration with current vendor. Good opportunity to position ourselves.',
    'Recently promoted to VP — now has broader influence over technology decisions. Re-engage with updated messaging.',
    'Strong technical background. Will want to see detailed technical proposals and architecture diagrams.',
    'Not the primary decision maker but has significant influence. Cultivate relationship for future opportunities.',
    'Has mentioned budget constraints but is interested in a phased approach. Start with smaller engagement.',
    'Prefers video calls over phone. Detailed note-taker — always comes prepared to meetings.',
    'Connected through mutual contact. Very interested in AI capabilities and how they apply to their domain.',
    'Was skeptical initially but warmed up after seeing our case studies. Schedule a product demo.',
    'Their company is in the middle of a reorganization. Hold off on major proposals until things settle.',
    'Excellent rapport established. They see us as a trusted advisor, not just a vendor.',
    'Has requested a security assessment proposal. High priority — deliver within the week.',
    'Interested in our data engineering capabilities. Their current data pipeline is a major pain point.',
    'Long-term relationship potential. They are building a multi-year technology roadmap and want us involved.',
    'Prefers async communication. Send detailed email proposals rather than scheduling calls.',
    'Recently attended our webinar and had positive feedback. Good warm lead.',
    'Decision timeline is Q3. Need to stay top of mind with regular value-add touchpoints until then.',
    'Has introduced us to their CTO. Expanding our contact network within the account.',
  ]

  let noteCount = 0
  // Company notes
  for (let i = 0; i < 22; i++) {
    const company = createdCompanies[i % createdCompanies.length]
    await prisma.companyNote.create({
      data: {
        companyId: company.id,
        body: companyNoteBodies[i % companyNoteBodies.length],
        noteType: randomFrom(['call', 'meeting', 'note', 'research'] as const),
        createdAt: daysAgo(randomInt(1, 25)),
      },
    })
    noteCount++
  }
  // Contact notes
  for (let i = 0; i < 20; i++) {
    const contact = createdContacts[i % createdContacts.length]
    await prisma.contactNote.create({
      data: {
        contactId: contact.id,
        body: contactNoteBodies[i % contactNoteBodies.length],
        noteType: randomFrom(['call', 'meeting', 'email', 'note'] as const),
        createdAt: daysAgo(randomInt(1, 20)),
      },
    })
    noteCount++
  }
  console.log(`  ✅ Created ${noteCount} notes`)

  // ── Step 9: Create Email Drafts ─────────────────────────────────────
  console.log('📧 Creating email drafts...')
  const draftDefs: { contactIdx: number; subject: string; body: string; cta: string; serviceAngle: string; status: string; matchScore: number; confidenceScore: number }[] = [
    { contactIdx: 0, subject: 'Modernizing NovaTech\'s Cloud Infrastructure', body: 'Hi James,\n\nI noticed NovaTech has been growing rapidly, and scaling cloud infrastructure is often one of the biggest challenges at this stage. We\'ve helped several technology companies in the 200-500 employee range optimize their AWS infrastructure, reducing costs by 30-40% while improving reliability.\n\nWould you be open to a brief call to discuss your current infrastructure challenges?\n\nBest regards,\nRavi', cta: 'Schedule a 30-minute infrastructure review call', serviceAngle: 'Cloud infrastructure optimization and cost reduction', status: 'draft', matchScore: 92, confidenceScore: 88 },
    { contactIdx: 4, subject: 'Exploring DevOps Excellence at NovaTech', body: 'Hi David,\n\nI\'ve been following NovaTech\'s growth and I\'m impressed by your market position. Many sales leaders I speak with tell me that engineering delivery speed directly impacts their ability to close deals.\n\nWe specialize in helping companies like NovaTech accelerate their development velocity through modern DevOps practices. Our clients typically see 60% faster deployments and 90% reduction in production incidents.\n\nWould love to share some insights. Are you available for a brief conversation?\n\nRegards,\nRavi', cta: 'Book a discovery call to discuss DevOps transformation', serviceAngle: 'DevOps maturity assessment and CI/CD enhancement', status: 'approved', matchScore: 85, confidenceScore: 82 },
    { contactIdx: 5, subject: 'Data-Driven Healthcare Analytics', body: 'Hi Patricia,\n\nHealthBridge Analytics has built an impressive platform for healthcare data insights. As the healthcare industry moves toward value-based care, the ability to derive actionable insights from clinical and operational data becomes a critical competitive advantage.\n\nWe\'ve helped healthcare technology companies enhance their analytics capabilities, including real-time dashboards, predictive modeling, and AI-assisted clinical decision support.\n\nI\'d love to explore how we might support HealthBridge\'s next phase of growth.\n\nWarm regards,\nRavi', cta: 'Schedule a strategy session on analytics platform enhancement', serviceAngle: 'Healthcare data engineering and analytics optimization', status: 'draft', matchScore: 89, confidenceScore: 91 },
    { contactIdx: 8, subject: 'Securing FinEdge\'s Growing Platform', body: 'Hi William,\n\nAs FinEdge Capital continues to scale its financial platform, security and compliance become increasingly critical. With the evolving regulatory landscape in FinTech, maintaining robust security while enabling rapid innovation is a delicate balance.\n\nOur team has extensive experience securing financial services platforms, including PCI-DSS compliance, real-time fraud detection, and zero-trust architecture implementation.\n\nWould you be interested in a complimentary security assessment?\n\nBest,\nRavi', cta: 'Request a complimentary security assessment', serviceAngle: 'Financial services security assessment and hardening', status: 'sent', matchScore: 94, confidenceScore: 87 },
    { contactIdx: 11, subject: 'Scaling DataVault\'s AI Platform', body: 'Hi Alexander,\n\nDataVault AI\'s positioning in the AI/data space is excellent. We work with several AI-first companies helping them scale their data infrastructure and ML pipelines.\n\nCommon challenges we solve include: productionizing ML models at scale, building reliable feature stores, implementing MLOps best practices, and optimizing data pipeline performance.\n\nI think there could be strong synergy between our capabilities and DataVault\'s roadmap. Would you be open to an exploratory conversation?\n\nRegards,\nRavi', cta: 'Arrange a technical architecture review session', serviceAngle: 'AI/ML platform engineering and MLOps', status: 'draft', matchScore: 96, confidenceScore: 93 },
    { contactIdx: 16, subject: 'Digital Transformation for GreenGrid', body: 'Hi Hans,\n\nThe energy sector is undergoing a profound digital transformation, and GreenGrid Energy is well-positioned to lead this change. Modern energy companies are leveraging IoT, AI, and advanced analytics to optimize grid operations and accelerate the transition to renewable sources.\n\nWe\'ve helped energy companies implement real-time monitoring systems, predictive maintenance platforms, and smart grid analytics.\n\nI\'d welcome the opportunity to discuss how technology can accelerate GreenGrid\'s mission.\n\nBest regards,\nRavi', cta: 'Explore digital transformation opportunities for the energy sector', serviceAngle: 'IoT and analytics platform for energy companies', status: 'draft', matchScore: 78, confidenceScore: 75 },
    { contactIdx: 19, subject: 'Enhancing CyberShield\'s Security Offerings', body: 'Hi Christopher,\n\nCyberShield Corp has built a strong reputation in cybersecurity. As threats evolve in sophistication, staying ahead requires continuous innovation in detection and response capabilities.\n\nWe partner with security companies to enhance their platforms with advanced threat detection AI, automated incident response, and comprehensive security analytics dashboards.\n\nI believe there are interesting ways we could augment CyberShield\'s capabilities. Would you be open to a technical discussion?\n\nRegards,\nRavi', cta: 'Schedule a technical capabilities briefing', serviceAngle: 'Advanced threat detection and security AI', status: 'approved', matchScore: 91, confidenceScore: 86 },
    { contactIdx: 25, subject: 'Compliance-First Government Technology', body: 'Hi Martin,\n\nGovTech Solutions operates in a unique space where security, compliance, and innovation must coexist. We understand the specific requirements of government technology contracts, including FedRAMP, FISMA, and strict data residency requirements.\n\nOur experience includes helping government technology providers achieve compliance certifications, implement zero-trust architectures, and build secure development lifecycles.\n\nI\'d appreciate the chance to discuss how we might support GovTech\'s upcoming initiatives.\n\nBest,\nRavi', cta: 'Discuss government compliance and security requirements', serviceAngle: 'Government compliance engineering and secure development', status: 'draft', matchScore: 83, confidenceScore: 80 },
    { contactIdx: 30, subject: 'Accelerating BioGenix Research Platform', body: 'Hi Alan,\n\nBioGenix Labs is doing incredible work in biotechnology research. The computational demands of modern biotech research — genomics, drug discovery, clinical trials — require specialized infrastructure and data engineering expertise.\n\nWe\'ve helped biotech companies build high-performance computing pipelines, manage large-scale genomic datasets, and implement AI-assisted drug discovery platforms.\n\nWould be great to explore how we can support BioGenix\'s research infrastructure needs.\n\nWarm regards,\nRavi', cta: 'Set up a research infrastructure consultation', serviceAngle: 'High-performance computing and data engineering for biotech', status: 'draft', matchScore: 88, confidenceScore: 90 },
    { contactIdx: 38, subject: 'TeleConnect Network Modernization', body: 'Hi Bruce,\n\nTeleConnect Networks serves a critical role in the telecommunications infrastructure. As 5G adoption accelerates and IoT device numbers explode, the demands on network infrastructure are growing exponentially.\n\nWe specialize in helping telecommunications companies modernize their network management systems, implement AI-driven network optimization, and build real-time analytics platforms for network performance monitoring.\n\nI\'d welcome the opportunity to discuss TeleConnect\'s technology roadmap.\n\nBest regards,\nRavi', cta: 'Explore network modernization and AI optimization', serviceAngle: 'Telecommunications network optimization and AI', status: 'draft', matchScore: 80, confidenceScore: 77 },
    { contactIdx: 45, subject: 'Retail Technology Innovation at RetailFlow', body: 'Hi Gregory,\n\nRetailFlow Inc has established a strong position in retail technology. The retail sector is being transformed by AI-powered personalization, real-time inventory management, and omnichannel customer experiences.\n\nWe\'ve helped retail technology companies implement real-time recommendation engines, build scalable e-commerce platforms, and develop inventory optimization systems.\n\nI think there are compelling opportunities for us to support RetailFlow\'s innovation agenda. Would you be available for a conversation?\n\nRegards,\nRavi', cta: 'Schedule a retail technology innovation discussion', serviceAngle: 'AI-powered retail technology and e-commerce platforms', status: 'rejected', matchScore: 74, confidenceScore: 70 },
    { contactIdx: 50, subject: 'Cloud Security for SecureNet Solutions', body: 'Hi Vincent,\n\nSecureNet Solutions has built a commendable security practice. In today\'s threat landscape, even security companies need to continuously evolve their own infrastructure and detection capabilities.\n\nWe partner with security-focused companies to enhance their internal platforms, build advanced SOC dashboards, and implement AI-driven threat hunting capabilities.\n\nWould be interested in exploring synergies between our engineering capabilities and SecureNet\'s security mission.\n\nBest,\nRavi', cta: 'Discuss platform engineering and AI threat detection', serviceAngle: 'Security platform engineering and AI threat detection', status: 'draft', matchScore: 87, confidenceScore: 84 },
    { contactIdx: 55, subject: 'VertexAI Platform Engineering', body: 'Hi Marcus,\n\nVertexAI Labs is doing fascinating work in the AI space. We\'ve observed that many AI-first companies face similar scaling challenges — productionizing research models, building reliable data pipelines, and maintaining model quality at scale.\n\nOur team has deep expertise in MLOps, feature engineering platforms, and real-time model serving infrastructure. We\'ve helped AI companies reduce their model deployment time from weeks to hours.\n\nI\'d love to share some of our learnings. Are you open to a conversation?\n\nWarm regards,\nRavi', cta: 'Share MLOps best practices and explore partnership', serviceAngle: 'MLOps and AI platform engineering', status: 'approved', matchScore: 95, confidenceScore: 92 },
    { contactIdx: 60, subject: 'Optimizing Apex Manufacturing Systems', body: 'Hi Raymond,\n\nApex Manufacturing\'s scale presents unique technology challenges. Modern manufacturing increasingly relies on IoT sensors, real-time production monitoring, and predictive maintenance — all requiring robust data infrastructure.\n\nWe\'ve helped manufacturing companies implement Industry 4.0 solutions, including real-time production analytics, predictive maintenance platforms, and supply chain optimization systems.\n\nWould you be interested in exploring how we can support Apex\'s digital manufacturing initiatives?\n\nBest regards,\nRavi', cta: 'Discuss Industry 4.0 and smart manufacturing technology', serviceAngle: 'IoT and Industry 4.0 platform for manufacturing', status: 'draft', matchScore: 72, confidenceScore: 68 },
    { contactIdx: 65, subject: 'EduSpark Learning Platform Enhancement', body: 'Hi Priya,\n\nEduSpark Learning is making a real impact in education technology. The edtech space is evolving rapidly with personalized learning paths, AI tutoring, and gamification becoming standard expectations.\n\nWe\'ve helped education technology companies scale their platforms, implement personalized learning algorithms, and build robust content delivery systems.\n\nI\'d be excited to discuss how we might contribute to EduSpark\'s growth story.\n\nWarm regards,\nRavi', cta: 'Explore edtech platform scaling and AI personalization', serviceAngle: 'EdTech platform engineering and AI personalization', status: 'draft', matchScore: 76, confidenceScore: 73 },
    { contactIdx: 70, subject: 'TravelWise Digital Transformation', body: 'Hi Kenneth,\n\nThe travel industry has undergone dramatic digital transformation, and TravelWise Group is well-positioned to capitalize on the recovery and new traveler expectations.\n\nWe help travel technology companies build real-time booking engines, implement dynamic pricing algorithms, and create personalized travel recommendation systems.\n\nWould be great to discuss TravelWise\'s technology vision and how we might contribute.\n\nRegards,\nRavi', cta: 'Discuss travel technology modernization strategy', serviceAngle: 'Travel technology platform and real-time booking systems', status: 'draft', matchScore: 71, confidenceScore: 67 },
    { contactIdx: 75, subject: 'LogiTrack Supply Chain Intelligence', body: 'Hi Willem,\n\nSupply chain visibility and intelligence has never been more important. LogiTrack Supply has an opportunity to differentiate through advanced analytics, real-time tracking, and predictive logistics optimization.\n\nOur experience includes building real-time supply chain tracking platforms, demand forecasting systems, and logistics optimization engines for global supply chain companies.\n\nI\'d welcome a conversation about LogiTrack\'s technology roadmap.\n\nBest regards,\nRavi', cta: 'Explore supply chain analytics and tracking platform capabilities', serviceAngle: 'Supply chain analytics and logistics optimization', status: 'draft', matchScore: 69, confidenceScore: 65 },
    { contactIdx: 80, subject: 'LegalTech Innovation at LegalEdge', body: 'Hi Richard,\n\nThe legal industry is embracing technology at an unprecedented pace. LegalEdge Partners has the opportunity to lead in areas like contract analysis AI, legal research automation, and client-facing legal tech solutions.\n\nWe\'ve helped legal technology companies build document analysis platforms, implement natural language processing for legal research, and develop secure client portals.\n\nWould you be open to discussing LegalEdge\'s technology strategy?\n\nRegards,\nRavi', cta: 'Discuss LegalTech innovation and platform development', serviceAngle: 'Legal technology and AI-powered document analysis', status: 'draft', matchScore: 66, confidenceScore: 62 },
    { contactIdx: 85, subject: 'InsureGuard Digital Platform Strategy', body: 'Hi Frederick,\n\nThe insurance industry is being reshaped by digital-first players. InsureGuard Plus has a strong foundation to build upon with its established customer base and industry expertise.\n\nWe help insurance companies build modern claims processing platforms, implement AI-powered underwriting, and develop customer-facing digital experiences.\n\nI\'d appreciate the opportunity to discuss InsureGuard\'s digital strategy.\n\nBest,\nRavi', cta: 'Explore insurance platform modernization opportunities', serviceAngle: 'Insurance platform modernization and AI underwriting', status: 'draft', matchScore: 79, confidenceScore: 76 },
    { contactIdx: 90, subject: 'MediaPulse Content Platform Scaling', body: 'Hi Jason,\n\nMediaPulse Digital is at the forefront of the digital media revolution. As content consumption continues to shift toward streaming and digital platforms, the technology demands for content delivery, analytics, and monetization are growing rapidly.\n\nWe\'ve helped media companies build scalable content delivery networks, implement real-time audience analytics, and develop programmatic advertising platforms.\n\nWould be great to explore how we can support MediaPulse\'s growth.\n\nWarm regards,\nRavi', cta: 'Discuss content platform scaling and audience analytics', serviceAngle: 'Media content delivery and audience analytics platforms', status: 'draft', matchScore: 81, confidenceScore: 78 },
    { contactIdx: 95, subject: 'AeroVista Systems Engineering Support', body: 'Hi Harold,\n\nAeroVista Systems operates in a demanding engineering environment where precision, reliability, and compliance are non-negotiable. We understand the unique requirements of aerospace technology, including DO-178C compliance, real-time system monitoring, and high-assurance software development.\n\nOur team has experience with safety-critical systems development, real-time embedded systems, and aerospace-grade testing frameworks.\n\nI\'d welcome the chance to discuss how our engineering capabilities align with AeroVista\'s needs.\n\nBest regards,\nRavi', cta: 'Explore aerospace engineering support and compliance', serviceAngle: 'Aerospace-grade software engineering and compliance', status: 'draft', matchScore: 84, confidenceScore: 81 },
  ]

  for (const d of draftDefs) {
    if (d.contactIdx >= createdContacts.length) continue
    const contact = createdContacts[d.contactIdx]
    await prisma.draft.create({
      data: {
        contactId: contact.id,
        subject: d.subject,
        body: d.body,
        cta: d.cta,
        serviceAngle: d.serviceAngle,
        matchScore: d.matchScore,
        confidenceScore: d.confidenceScore,
        status: d.status,
      },
    })
  }
  console.log(`  ✅ Created ${draftDefs.length} drafts`)

  // ── Step 10: Create Email Health Checks ─────────────────────────────
  console.log('🔍 Creating email health checks...')
  let validCount = 0
  let riskyCount = 0
  let invalidCount = 0
  let unknownCount = 0

  for (let i = 0; i < 35; i++) {
    const contact = createdContacts[i % createdContacts.length]
    const roll = Math.random()
    let status: string
    let score: number
    let action: string | null = null
    let syntaxOk = true
    let domainOk = true
    let mxOk = true
    let disposableOk = true

    if (roll < 0.5) {
      status = 'valid'
      score = randomInt(85, 100)
      validCount++
    } else if (roll < 0.75) {
      status = 'risky'
      score = randomInt(40, 75)
      action = randomFrom([
        'Email appears valid but domain has low trust score. Consider alternative contact methods.',
        'Catch-all domain detected. Email may not reach intended recipient.',
        'Domain recently registered. Verify contact through other channels.',
      ])
      domainOk = Math.random() > 0.5
      riskyCount++
    } else if (roll < 0.9) {
      status = 'invalid'
      score = randomInt(0, 30)
      action = randomFrom([
        'Mailbox does not exist. Remove from outreach lists.',
        'Domain does not accept email. Try alternative contact method.',
      ])
      mxOk = false
      invalidCount++
    } else {
      status = 'unknown'
      score = randomInt(50, 70)
      action = 'Could not verify email deliverability. SMTP check timed out.'
      mxOk = false
      unknownCount++
    }

    await prisma.emailHealthCheck.create({
      data: {
        contactId: contact.id,
        status,
        score,
        actionRecommendation: action,
        syntaxOk,
        domainOk,
        mxOk,
        disposableOk,
        checkedAt: daysAgo(randomInt(0, 10)),
      },
    })

    // Update contact's email health
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        emailHealth: status,
        emailHealthScore: score,
        lastValidatedAt: daysAgo(randomInt(0, 10)),
      },
    })
  }
  console.log(`  ✅ Created ${validCount + riskyCount + invalidCount + unknownCount} health checks (valid: ${validCount}, risky: ${riskyCount}, invalid: ${invalidCount}, unknown: ${unknownCount})`)

  // ── Step 11: Create Knowledge Documents ─────────────────────────────
  console.log('📚 Creating knowledge documents...')

  const knowledgeDocs: { title: string; docType: string; description: string; snippets: { type: string; title: string; content: string; industries: string; outcomes: string }[] }[] = [
    {
      title: 'Cloud-Native Architecture & Migration',
      docType: 'whitepaper',
      description: 'Comprehensive guide to cloud-native architecture patterns, migration strategies, and best practices for enterprise applications.',
      snippets: [
        { type: 'capability', title: 'Cloud Migration Assessment', content: 'Our cloud migration assessment evaluates applications across 6 dimensions: architectural compatibility, data gravity, network dependencies, compliance requirements, performance characteristics, and cost implications. We produce a detailed migration roadmap with recommended strategies (rehost, replatform, refactor, repurchase) for each application, along with estimated timelines and cost projections.', industries: 'Technology, SaaS, FinTech, Healthcare', outcomes: 'Clear migration roadmap, 40% cost reduction, zero-downtime migration' },
        { type: 'process', title: 'Strangler Fig Migration Pattern', content: 'We implement the Strangler Fig pattern for legacy application migration: incrementally replace legacy components with cloud-native services while maintaining system functionality throughout the migration. This approach uses API gateways to route traffic between legacy and new services, feature flags to control rollout, and comprehensive monitoring to detect regressions. Typical migration timelines are 6-12 months for medium-complexity applications.', industries: 'Technology, FinTech, Healthcare, Manufacturing', outcomes: 'Zero-downtime migration, reduced risk, incremental value delivery' },
        { type: 'outcome', title: 'Enterprise SaaS Platform Migration', content: 'Migrated a 15-year-old monolithic enterprise SaaS platform to a cloud-native microservices architecture. The migration was completed over 9 months with zero customer-facing downtime. Results: 65% reduction in infrastructure costs, 10x improvement in deployment frequency, 99.99% availability (up from 99.5%), and 3x improvement in feature delivery velocity.', industries: 'Technology, SaaS', outcomes: '65% cost reduction, 99.99% availability, 10x deployment frequency' },
        { type: 'capability', title: 'Kubernetes Platform Engineering', content: 'We build and operate production-grade Kubernetes platforms with GitOps workflows, service mesh integration (Istio/Linkerd), comprehensive observability (Prometheus, Grafana, Loki, Tempo), and automated scaling policies. Our platform includes pre-configured CI/CD pipelines, security scanning, and compliance enforcement. Typical setup time is 4-6 weeks for a production-ready platform.', industries: 'Technology, SaaS, FinTech, E-commerce', outcomes: 'Production K8s in 4-6 weeks, self-service developer platform' },
      ],
    },
    {
      title: 'AI/ML Implementation & MLOps',
      docType: 'case-study',
      description: 'Real-world examples of AI/ML implementation projects including MLOps setup, model deployment, and data engineering pipelines.',
      snippets: [
        { type: 'capability', title: 'MLOps Platform Setup', content: 'We design and implement comprehensive MLOps platforms that cover the full ML lifecycle: feature engineering, model training, experiment tracking (MLflow), model registry, automated testing (data validation, model performance, bias detection), deployment (canary, blue-green, shadow), monitoring (data drift, model performance, latency), and automated retraining triggers. Our standard MLOps stack reduces model deployment time from weeks to hours.', industries: 'Technology, SaaS, FinTech, Healthcare, E-commerce', outcomes: 'Model deployment in hours, automated retraining, 90% less operational overhead' },
        { type: 'process', title: 'ML Model Productionization', content: 'Our ML productionization process transforms research models into production-grade services: (1) Model optimization (quantization, pruning, ONNX conversion), (2) API wrapping with proper input validation and error handling, (3) Load testing and performance benchmarking, (4) A/B testing framework setup, (5) Monitoring dashboard creation, (6) Documentation and runbook development. This process typically takes 2-4 weeks per model.', industries: 'Technology, SaaS, FinTech, Healthcare', outcomes: 'Research-to-production in 2-4 weeks, production-ready ML services' },
        { type: 'outcome', title: 'FinTech Fraud Detection System', content: 'Built a real-time fraud detection system for a FinTech company processing 5M+ transactions daily. The system uses an ensemble of ML models (gradient boosting, neural networks, graph analysis) to detect fraudulent transactions with 99.7% accuracy while maintaining a false positive rate below 0.1%. Real-time inference latency is under 50ms. The system prevents an estimated $15M in annual fraud losses.', industries: 'FinTech', outcomes: '99.7% detection accuracy, <50ms latency, $15M annual fraud prevention' },
        { type: 'capability', title: 'Data Engineering for AI', content: 'We build scalable data engineering pipelines for AI/ML workloads: real-time feature computation using Apache Kafka and Flink, feature stores (Feast/Tecton) for online and offline feature serving, data quality frameworks (Great Expectations), and automated data versioning (DVC). Our pipelines support both batch and streaming feature computation with exactly-once processing guarantees and sub-second online feature retrieval.', industries: 'Technology, FinTech, Healthcare, E-commerce, Biotech', outcomes: 'Real-time feature serving, sub-second retrieval, data quality automation' },
      ],
    },
    {
      title: 'Cybersecurity & Compliance Engineering',
      docType: 'whitepaper',
      description: 'Security architecture patterns, compliance frameworks, and implementation guides for building secure enterprise systems.',
      snippets: [
        { type: 'capability', title: 'Zero Trust Architecture', content: 'We implement Zero Trust security architectures following NIST SP 800-207 guidelines. Our approach includes: identity-centric access control (beyondcorp model), micro-segmentation of network zones, continuous authentication and authorization, encrypted communications (mTLS everywhere), comprehensive audit logging, and automated compliance reporting. Implementation typically follows a phased 6-12 month roadmap.', industries: 'Technology, FinTech, Healthcare, Government, Aerospace', outcomes: 'NIST-aligned Zero Trust, reduced attack surface, automated compliance' },
        { type: 'process', title: 'Security Development Lifecycle', content: 'We integrate security into every phase of the software development lifecycle: (1) Threat modeling during design (STRIDE/DREAD), (2) Secure coding guidelines and static analysis (SAST) in IDE, (3) Dependency scanning (SCA) in CI/CD, (4) Dynamic application security testing (DAST) in staging, (5) Container and infrastructure scanning before deployment, (6) Runtime protection (RASP) in production, (7) Regular penetration testing and bug bounty programs.', industries: 'Technology, FinTech, Healthcare, Government', outcomes: 'Security by design, shift-left security, 80% fewer vulnerabilities' },
        { type: 'outcome', title: 'SOC 2 Type II Compliance', content: 'Helped a SaaS company achieve SOC 2 Type II compliance in 4 months. Implemented comprehensive controls across all 5 Trust Service Criteria: security, availability, processing integrity, confidentiality, and privacy. The audit resulted in zero findings. Post-compliance, the company closed 3 enterprise deals that were previously blocked by compliance requirements, representing $2.5M in annual revenue.', industries: 'SaaS, Technology', outcomes: 'SOC 2 in 4 months, zero findings, $2.5M revenue unlocked' },
      ],
    },
    {
      title: 'DevOps & CI/CD Best Practices',
      docType: 'presentation',
      description: 'Internal presentation covering our DevOps practices, CI/CD pipeline patterns, and infrastructure-as-code approaches.',
      snippets: [
        { type: 'process', title: 'CI/CD Pipeline Architecture', content: 'Our standard CI/CD pipeline includes: code quality gates (linting, type checking), automated testing (unit, integration, E2E), security scanning (SAST, DAST, dependency audit), container building and scanning, staged deployment (dev → staging → production), automated rollback on failure, and comprehensive observability setup.', industries: 'Technology, SaaS, FinTech', outcomes: '60% faster deployments, 90% reduction in production incidents' },
        { type: 'capability', title: 'Infrastructure as Code', content: 'We use Terraform for cloud infrastructure provisioning and Kubernetes manifests for application deployment. All infrastructure changes go through the same code review and CI/CD process as application code. We maintain a library of reusable Terraform modules for common patterns.', industries: 'Technology, SaaS', outcomes: 'Reproducible environments, 80% faster infrastructure provisioning' },
        { type: 'outcome', title: 'Deployment Frequency Improvement', content: 'After implementing our CI/CD practices, clients typically see deployment frequency increase from weekly to multiple times daily, lead time for changes drop from weeks to hours, and change failure rate decrease by 60-80%. Mean time to recovery typically drops from hours to minutes.', industries: 'Technology, SaaS, E-commerce', outcomes: 'Daily deployments, 80% lower change failure rate' },
        { type: 'capability', title: 'Monitoring and Observability', content: 'We implement comprehensive observability using the three pillars: metrics (Prometheus/Grafana), logs (ELK/Loki), and traces (Jaeger/Tempo). Our monitoring setup includes SLO/SLI definition, alerting with proper escalation policies, and custom dashboards.', industries: 'Technology, SaaS, FinTech, E-commerce', outcomes: 'Proactive issue detection, 95% SLO compliance' },
      ],
    },
    {
      title: 'Digital Transformation Strategy',
      docType: 'whitepaper',
      description: 'Strategic framework for enterprise digital transformation, covering assessment, planning, and execution.',
      snippets: [
        { type: 'process', title: 'Digital Maturity Assessment', content: 'Our Digital Maturity Assessment evaluates organizations across 6 dimensions: customer experience, operational efficiency, technology infrastructure, data capabilities, organizational culture, and innovation capacity. The assessment produces a heat map of strengths and gaps, along with a prioritized roadmap for improvement.', industries: 'Consulting, Manufacturing, Retail, Logistics', outcomes: 'Clear transformation roadmap, stakeholder alignment' },
        { type: 'capability', title: 'Change Management Framework', content: 'We provide change management support alongside technical implementation, including stakeholder analysis, communication planning, training program design, and adoption metrics. Our approach is based on the ADKAR model and is tailored for technology-driven organizational change.', industries: 'Consulting, Manufacturing, Government, Education', outcomes: '85% adoption rate, minimized resistance to change' },
        { type: 'outcome', title: 'Manufacturing Digital Transformation', content: 'For a 1000-employee manufacturing company, we led a 12-month digital transformation that included IoT sensor deployment, real-time production monitoring, predictive maintenance, and digital supply chain management. Results: 30% reduction in unplanned downtime, 20% improvement in production efficiency, and $4.5M annual cost savings.', industries: 'Manufacturing, Logistics', outcomes: '30% less downtime, $4.5M annual savings' },
      ],
    },
    {
      title: 'API-First Product Development',
      docType: 'blog',
      description: 'Our approach to building API-first products for enterprise clients.',
      snippets: [
        { type: 'capability', title: 'API Design & Governance', content: 'We design APIs following OpenAPI 3.0 specifications with consistent naming conventions, pagination patterns, error handling, and authentication schemes. Our API governance framework includes design reviews, automated linting, backward compatibility checks, and comprehensive documentation generation.', industries: 'Technology, SaaS, FinTech', outcomes: 'Consistent APIs, 50% faster client integration' },
        { type: 'process', title: 'API Development Lifecycle', content: 'Our API development lifecycle: (1) API Design First — OpenAPI spec before code, (2) Contract Testing — ensure implementations match specs, (3) SDK Generation — auto-generate client libraries, (4) API Gateway — rate limiting, auth, analytics, (5) Developer Portal — interactive docs and onboarding. This approach reduces integration issues by 70%.', industries: 'Technology, SaaS', outcomes: '70% fewer integration issues, auto-generated SDKs' },
        { type: 'outcome', title: 'FinTech API Platform', content: 'Built a comprehensive API platform for a FinTech company serving 500+ enterprise clients. The platform handles 50M+ API calls daily with 99.99% availability. Developer adoption increased by 300% after launching the developer portal, and average integration time dropped from 3 weeks to 3 days.', industries: 'FinTech, SaaS', outcomes: '50M+ daily calls, 300% developer adoption increase' },
      ],
    },
  ]

  let snippetCount = 0
  for (const doc of knowledgeDocs) {
    const createdDoc = await prisma.capabilityDocument.create({
      data: {
        title: doc.title,
        docType: doc.docType,
        description: doc.description,
      },
    })

    for (const snippet of doc.snippets) {
      await prisma.capabilitySnippet.create({
        data: {
          documentId: createdDoc.id,
          snippetType: snippet.type,
          title: snippet.title,
          content: snippet.content,
          industries: snippet.industries,
          outcomes: snippet.outcomes,
        },
      })
      snippetCount++
    }
  }
  console.log(`  ✅ Created ${knowledgeDocs.length} knowledge documents with ${snippetCount} snippets`)

  // ── Step 12: Create User Preferences ────────────────────────────────
  console.log('⚙️  Creating user preferences...')
  await prisma.userPreferences.create({
    data: {
      userId: adminUser.id,
      tone: 'professional-casual',
      emailLength: 'medium',
      openerStyle: 'Hi [First Name]',
      signOff: 'Regards, Ravi',
      avoidPhrases: '',
      exampleEmail: null,
      ctaStyle: 'soft',
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      aiApiKey: null,
      scoringWeights: '{}',
    },
  })
  console.log('  ✅ Created user preferences')

  // ── Step 13: Create Sample Notifications ────────────────────────────
  console.log('🔔 Creating notifications...')
  const notificationDefs = [
    { title: 'Welcome to DeepMindQ', message: 'Your demo environment is set up with sample data. Explore the dashboard, companies, and contacts to see the CRM in action.', type: 'info', daysBack: 0 },
    { title: 'New company added', message: 'VertexAI Labs was added to your database with an intelligence score of 91.', type: 'success', daysBack: 1 },
    { title: 'Email validation complete', message: 'Batch email validation finished: 18 valid, 9 risky, 5 invalid, 3 unknown.', type: 'info', daysBack: 2 },
    { title: 'Research card generated', message: 'AI research analysis completed for DataVault AI with 95% confidence score.', type: 'success', daysBack: 3 },
    { title: 'Opportunity status changed', message: 'Enterprise Platform Modernization for FinEdge Capital moved to "negotiation" stage.', type: 'info', daysBack: 5 },
    { title: 'Draft email rejected', message: 'Email draft for Gregory Wallace at RetailFlow Inc was rejected. Review and revise.', type: 'warning', daysBack: 7 },
    { title: 'New contact added', message: 'Marcus Chen (CEO) added to VertexAI Labs. Consider scheduling an outreach.', type: 'info', daysBack: 8 },
    { title: 'Task overdue', message: 'Follow up with BioGenix Labs is overdue. Contact Alan Richardson today.', type: 'error', daysBack: 10 },
    { title: 'Weekly summary', message: 'This week: 3 new companies, 12 contacts added, 5 emails generated, 2 opportunities advanced.', type: 'info', daysBack: 14 },
    { title: 'High-intelligence company detected', message: 'CyberShield Corp (score: 90) and DataVault AI (score: 88) are your top prospects this week.', type: 'success', daysBack: 20 },
  ]

  for (const n of notificationDefs) {
    await prisma.notification.create({
      data: {
        userId: adminUser.id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.daysBack > 7,
        createdAt: daysAgo(n.daysBack),
      },
    })
  }
  console.log(`  ✅ Created ${notificationDefs.length} notifications`)

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n🎉 Demo data seed completed successfully!')
  console.log('─'.repeat(50))
  console.log(`  User:            ${adminUser.email}`)
  console.log(`  Companies:       ${createdCompanies.length}`)
  console.log(`  Contacts:        ${createdContacts.length}`)
  console.log(`  Research Cards:  ${researchCount}`)
  console.log(`  Opportunities:   ${createdOpportunities.length}`)
  console.log(`  Timeline:        ${timelineActions.length}`)
  console.log(`  Notes:           ${noteCount}`)
  console.log(`  Drafts:          ${draftDefs.length}`)
  console.log(`  Health Checks:   ${validCount + riskyCount + invalidCount + unknownCount}`)
  console.log(`  Knowledge Docs:  ${knowledgeDocs.length}`)
  console.log(`  Notifications:   ${notificationDefs.length}`)
  console.log('─'.repeat(50))
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })