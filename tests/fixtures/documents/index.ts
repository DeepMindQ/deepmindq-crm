/**
 * DeepMindQ Enterprise Test Fixtures — Documents
 * Milestone 3: 10 test documents across types
 */

export const testDocuments = [
  {
    "id": "doc-001",
    "title": "Q4 2025 Financial Report",
    "type": "financial",
    "format": "pdf",
    "pages": 48,
    "company": "TechCorp Solutions",
    "confidential": true,
    "tags": [
      "quarterly",
      "financial",
      "annual"
    ]
  },
  {
    "id": "doc-002",
    "title": "Product Roadmap 2026",
    "type": "strategy",
    "format": "docx",
    "pages": 32,
    "company": "Global Finance Group",
    "confidential": true,
    "tags": [
      "roadmap",
      "strategy",
      "product"
    ]
  },
  {
    "id": "doc-003",
    "title": "AI Research Whitepaper",
    "type": "research",
    "format": "pdf",
    "pages": 24,
    "company": "InnovateLabs",
    "confidential": false,
    "tags": [
      "research",
      "ai",
      "whitepaper"
    ]
  },
  {
    "id": "doc-004",
    "title": "Security Audit Report",
    "type": "security",
    "format": "pdf",
    "pages": 56,
    "company": "CyberShield",
    "confidential": true,
    "tags": [
      "audit",
      "security",
      "compliance"
    ]
  },
  {
    "id": "doc-005",
    "title": "Partnership Agreement",
    "type": "legal",
    "format": "docx",
    "pages": 18,
    "company": "QuantumLeap AI",
    "confidential": true,
    "tags": [
      "legal",
      "partnership",
      "contract"
    ]
  },
  {
    "id": "doc-006",
    "title": "Technical Architecture Doc",
    "type": "technical",
    "format": "md",
    "pages": 42,
    "company": "CloudNine Infrastructure",
    "confidential": false,
    "tags": [
      "architecture",
      "technical",
      "cloud"
    ]
  },
  {
    "id": "doc-007",
    "title": "Customer Success Report",
    "type": "analytics",
    "format": "xlsx",
    "pages": 12,
    "company": "SmartRetail ME",
    "confidential": false,
    "tags": [
      "analytics",
      "customer",
      "success"
    ]
  },
  {
    "id": "doc-008",
    "title": "Compliance Checklist",
    "type": "compliance",
    "format": "pdf",
    "pages": 8,
    "company": "NexusGov Solutions",
    "confidential": true,
    "tags": [
      "compliance",
      "government",
      "regulatory"
    ]
  },
  {
    "id": "doc-009",
    "title": "Market Analysis Report",
    "type": "research",
    "format": "pdf",
    "pages": 36,
    "company": "MediaPulse Analytics",
    "confidential": false,
    "tags": [
      "market",
      "analysis",
      "competitive"
    ]
  },
  {
    "id": "doc-010",
    "title": "Integration API Specification",
    "type": "technical",
    "format": "yaml",
    "pages": 28,
    "company": "FinStack",
    "confidential": false,
    "tags": [
      "api",
      "integration",
      "technical"
    ]
  }
] as const;

export const testDocumentsByType = (type: string) =>
  testDocuments.filter(d => d.type === type);

export const testConfidentialDocuments = () =>
  testDocuments.filter(d => d.confidential);

export default testDocuments;
