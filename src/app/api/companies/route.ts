import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const DEMO_COMPANIES = [
  { id: 'demo-c1', rawName: 'Stripe', normalizedName: 'stripe', domain: 'stripe.com', industry: 'Fintech', _count: { contacts: 2 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c2', rawName: 'Salesforce', normalizedName: 'salesforce', domain: 'salesforce.com', industry: 'Technology', _count: { contacts: 1 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c3', rawName: 'Infosys', normalizedName: 'infosys', domain: 'infosys.com', industry: 'IT Services', _count: { contacts: 1 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c4', rawName: 'JPMorgan Chase', normalizedName: 'jpmorgan chase', domain: 'jpmorgan.com', industry: 'Financial Services', _count: { contacts: 3 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c5', rawName: 'Apollo Hospitals', normalizedName: 'apollo hospitals', domain: 'apollohospital.com', industry: 'Healthcare', _count: { contacts: 1 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c6', rawName: 'Samsung Electronics', normalizedName: 'samsung electronics', domain: 'samsung.com', industry: 'Technology', _count: { contacts: 1 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c7', rawName: 'NHS Digital', normalizedName: 'nhs digital', domain: 'nhs.uk', industry: 'Healthcare', _count: { contacts: 1 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c8', rawName: 'Tata Consultancy Services', normalizedName: 'tata consultancy services', domain: 'tata.com', industry: 'IT Services', _count: { contacts: 2 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c9', rawName: 'Shopify', normalizedName: 'shopify', domain: 'shopify.com', industry: 'E-commerce', _count: { contacts: 1 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c10', rawName: 'Siemens AG', normalizedName: 'siemens ag', domain: 'siemens.com', industry: 'Manufacturing', _count: { contacts: 1 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c11', rawName: 'Paystack', normalizedName: 'paystack', domain: 'paystack.com', industry: 'Fintech', _count: { contacts: 1 }, researchCard: null, createdAt: new Date().toISOString() },
  { id: 'demo-c12', rawName: 'Boeing', normalizedName: 'boeing', domain: 'boeing.com', industry: 'Aerospace', _count: { contacts: 1 }, researchCard: null, createdAt: new Date().toISOString() },
];

export async function GET() {
  try {
    const companies = await db.company.findMany({
      include: {
        _count: { select: { contacts: true } },
        researchCard: true,
      },
      orderBy: {
        contacts: { _count: 'desc' },
      },
    });

    const result = companies.map((c: any) => ({
      ...c,
      contactCount: c._count.contacts,
    }));

    // If no real data, return demo companies
    if (result.length === 0) {
      return NextResponse.json(
        DEMO_COMPANIES.map(c => ({ ...c, contactCount: c._count.contacts }))
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Companies error:', error);
    return NextResponse.json(
      DEMO_COMPANIES.map(c => ({ ...c, contactCount: c._count.contacts }))
    );
  }
}