/**
 * DeepMindQ Enterprise Test Framework — Milestone 3
 * Section: Fixtures / Companies
 *
 * 50 enterprise benchmark companies for AI testing.
 * Each company has deterministic test data for use across:
 *   - AI Intelligence tests
 *   - Golden dataset validation
 *   - Recommendation engine tests
 *   - Scoring engine tests
 *   - E2E business workflow tests
 *
 * Permanent enterprise test asset stored in GitHub.
 */

export interface TestCompany {
  id: string
  name: string
  domain: string
  industry: string
  size: 'enterprise' | 'mid-market' | 'startup' | 'smb'
  website: string
  description: string
  status: 'new' | 'active' | 'qualified' | 'archived'
  annualRevenue: string
  employeeCount: number
  headquarters: string
  technologies: string[]
  fundingStage: string
  intelligenceScore: number
  // Deterministic test timestamps
  createdAt: string
  updatedAt: string
}

export const TEST_COMPANIES: TestCompany[] = [
  // ═══ TECHNOLOGY — Enterprise (10) ═══
  {
    id: 'tc-001', name: 'Acme Cloud Solutions', domain: 'acmecloud.com', industry: 'Cloud Infrastructure',
    size: 'enterprise', website: 'https://acmecloud.com',
    description: 'Enterprise cloud platform providing IaaS, PaaS, and SaaS solutions globally.',
    status: 'active', annualRevenue: '$4.2B', employeeCount: 18500, headquarters: 'San Francisco, CA',
    technologies: ['AWS', 'Kubernetes', 'Go', 'Python', 'PostgreSQL', 'Redis'],
    fundingStage: 'public', intelligenceScore: 92, createdAt: '2024-01-15T08:00:00Z', updatedAt: '2024-06-01T12:00:00Z',
  },
  {
    id: 'tc-002', name: 'DataForge Analytics', domain: 'dataforge.io', industry: 'Data Analytics',
    size: 'enterprise', website: 'https://dataforge.io',
    description: 'AI-powered business intelligence and analytics platform for Fortune 500 companies.',
    status: 'active', annualRevenue: '$1.8B', employeeCount: 8200, headquarters: 'Boston, MA',
    technologies: ['Python', 'Spark', 'Snowflake', 'TensorFlow', 'React', 'TypeScript'],
    fundingStage: 'public', intelligenceScore: 88, createdAt: '2024-02-20T10:00:00Z', updatedAt: '2024-07-15T09:30:00Z',
  },
  {
    id: 'tc-003', name: 'CyberShield Corp', domain: 'cybershield.com', industry: 'Cybersecurity',
    size: 'enterprise', website: 'https://cybershield.com',
    description: 'Zero-trust security platform with AI-driven threat detection and response.',
    status: 'qualified', annualRevenue: '$950M', employeeCount: 5600, headquarters: 'Austin, TX',
    technologies: ['Rust', 'Go', 'Kubernetes', 'Elasticsearch', 'Python'],
    fundingStage: 'series-d', intelligenceScore: 85, createdAt: '2024-03-10T14:00:00Z', updatedAt: '2024-08-01T16:00:00Z',
  },
  {
    id: 'tc-004', name: 'QuantumLeap AI', domain: 'quantumleap.ai', industry: 'Artificial Intelligence',
    size: 'enterprise', website: 'https://quantumleap.ai',
    description: 'Enterprise AI platform for generative AI, NLP, and computer vision applications.',
    status: 'active', annualRevenue: '$2.1B', employeeCount: 7200, headquarters: 'Seattle, WA',
    technologies: ['Python', 'PyTorch', 'CUDA', 'Kubernetes', 'React', 'Node.js'],
    fundingStage: 'public', intelligenceScore: 95, createdAt: '2024-01-05T08:00:00Z', updatedAt: '2024-08-10T11:00:00Z',
  },
  {
    id: 'tc-005', name: 'NetScale Networks', domain: 'netscale.com', industry: 'Networking',
    size: 'enterprise', website: 'https://netscale.com',
    description: 'Software-defined networking and network observability platform.',
    status: 'active', annualRevenue: '$3.5B', employeeCount: 14200, headquarters: 'San Jose, CA',
    technologies: ['C++', 'Go', 'Prometheus', 'Grafana', 'Kubernetes'],
    fundingStage: 'public', intelligenceScore: 82, createdAt: '2024-02-01T09:00:00Z', updatedAt: '2024-07-20T14:00:00Z',
  },
  {
    id: 'tc-006', name: 'InnovateTech Labs', domain: 'innovatetech.com', industry: 'SaaS',
    size: 'enterprise', website: 'https://innovatetech.com',
    description: 'Enterprise SaaS platform for project management and collaboration.',
    status: 'active', annualRevenue: '$1.2B', employeeCount: 4500, headquarters: 'New York, NY',
    technologies: ['React', 'Node.js', 'PostgreSQL', 'Redis', 'Docker'],
    fundingStage: 'public', intelligenceScore: 78, createdAt: '2024-03-15T10:00:00Z', updatedAt: '2024-06-30T08:00:00Z',
  },
  {
    id: 'tc-007', name: 'CloudPeak Systems', domain: 'cloudpeak.io', industry: 'Cloud Services',
    size: 'enterprise', website: 'https://cloudpeak.io',
    description: 'Multi-cloud management and optimization platform for enterprise workloads.',
    status: 'qualified', annualRevenue: '$780M', employeeCount: 3200, headquarters: 'Denver, CO',
    technologies: ['Terraform', 'Go', 'AWS', 'Azure', 'GCP', 'Kubernetes'],
    fundingStage: 'series-c', intelligenceScore: 80, createdAt: '2024-04-01T11:00:00Z', updatedAt: '2024-08-05T10:00:00Z',
  },
  {
    id: 'tc-008', name: 'SecureNet Global', domain: 'securenetglobal.com', industry: 'Cybersecurity',
    size: 'enterprise', website: 'https://securenetglobal.com',
    description: 'Global managed security services and SIEM platform.',
    status: 'active', annualRevenue: '$2.8B', employeeCount: 11000, headquarters: 'Reston, VA',
    technologies: ['Python', 'Splunk', 'Elasticsearch', 'Kafka', 'Docker'],
    fundingStage: 'public', intelligenceScore: 84, createdAt: '2024-01-20T08:00:00Z', updatedAt: '2024-07-25T09:00:00Z',
  },
  {
    id: 'tc-009', name: 'Pinnacle Software', domain: 'pinnacle-sw.com', industry: 'Enterprise Software',
    size: 'enterprise', website: 'https://pinnacle-sw.com',
    description: 'ERP and financial management software for large enterprises.',
    status: 'active', annualRevenue: '$5.1B', employeeCount: 22000, headquarters: 'Chicago, IL',
    technologies: ['Java', 'Oracle', 'React', 'TypeScript', 'SAP'],
    fundingStage: 'public', intelligenceScore: 75, createdAt: '2024-02-10T08:00:00Z', updatedAt: '2024-06-15T14:00:00Z',
  },
  {
    id: 'tc-010', name: 'Velocity Digital', domain: 'velocitydigital.com', industry: 'Digital Transformation',
    size: 'enterprise', website: 'https://velocitydigital.com',
    description: 'Digital transformation consulting and platform for enterprise modernization.',
    status: 'new', annualRevenue: '$650M', employeeCount: 2800, headquarters: 'Atlanta, GA',
    technologies: ['React', 'Node.js', 'AWS', 'Docker', 'GraphQL'],
    fundingStage: 'series-d', intelligenceScore: 72, createdAt: '2024-05-01T10:00:00Z', updatedAt: '2024-08-01T12:00:00Z',
  },

  // ═══ TECHNOLOGY — Mid-Market (10) ═══
  {
    id: 'tc-011', name: 'BrightPath AI', domain: 'brightpath.ai', industry: 'Machine Learning',
    size: 'mid-market', website: 'https://brightpath.ai',
    description: 'ML-powered customer churn prediction and retention platform.',
    status: 'active', annualRevenue: '$85M', employeeCount: 450, headquarters: 'Portland, OR',
    technologies: ['Python', 'scikit-learn', 'FastAPI', 'PostgreSQL', 'React'],
    fundingStage: 'series-b', intelligenceScore: 87, createdAt: '2024-03-01T09:00:00Z', updatedAt: '2024-08-10T10:00:00Z',
  },
  {
    id: 'tc-012', name: 'CodeStream Dev', domain: 'codestream.dev', industry: 'Developer Tools',
    size: 'mid-market', website: 'https://codestream.dev',
    description: 'AI-assisted code review and development workflow platform.',
    status: 'active', annualRevenue: '$42M', employeeCount: 220, headquarters: 'San Francisco, CA',
    technologies: ['TypeScript', 'Go', 'PostgreSQL', 'Docker', 'Kubernetes'],
    fundingStage: 'series-a', intelligenceScore: 83, createdAt: '2024-04-15T10:00:00Z', updatedAt: '2024-08-05T08:00:00Z',
  },
  {
    id: 'tc-013', name: 'DataVault Pro', domain: 'datavaultpro.com', industry: 'Data Management',
    size: 'mid-market', website: 'https://datavaultpro.com',
    description: 'Enterprise data governance and compliance management platform.',
    status: 'qualified', annualRevenue: '$120M', employeeCount: 580, headquarters: 'Washington, DC',
    technologies: ['Java', 'Spring', 'PostgreSQL', 'MongoDB', 'React'],
    fundingStage: 'series-c', intelligenceScore: 79, createdAt: '2024-02-28T11:00:00Z', updatedAt: '2024-07-20T12:00:00Z',
  },
  {
    id: 'tc-014', name: 'FlowMetrics', domain: 'flowmetrics.io', industry: 'Observability',
    size: 'mid-market', website: 'https://flowmetrics.io',
    description: 'Application performance monitoring and distributed tracing platform.',
    status: 'active', annualRevenue: '$65M', employeeCount: 340, headquarters: 'Berlin, Germany',
    technologies: ['Go', 'ClickHouse', 'Kafka', 'Grafana', 'OpenTelemetry'],
    fundingStage: 'series-b', intelligenceScore: 81, createdAt: '2024-03-20T08:00:00Z', updatedAt: '2024-07-30T14:00:00Z',
  },
  {
    id: 'tc-015', name: 'GreenStack Cloud', domain: 'greenstack.cloud', industry: 'Green Cloud',
    size: 'mid-market', website: 'https://greenstack.cloud',
    description: 'Sustainable cloud infrastructure with carbon-neutral computing.',
    status: 'new', annualRevenue: '$28M', employeeCount: 150, headquarters: 'Stockholm, Sweden',
    technologies: ['Go', 'Kubernetes', 'Terraform', 'Prometheus', 'Rust'],
    fundingStage: 'series-a', intelligenceScore: 76, createdAt: '2024-05-10T09:00:00Z', updatedAt: '2024-08-01T08:00:00Z',
  },
  {
    id: 'tc-016', name: 'HyperEdge Networks', domain: 'hyperedge.net', industry: 'Edge Computing',
    size: 'mid-market', website: 'https://hyperedge.net',
    description: 'Edge computing platform for IoT and real-time data processing.',
    status: 'active', annualRevenue: '$55M', employeeCount: 280, headquarters: 'Austin, TX',
    technologies: ['Rust', 'C++', 'MQTT', 'Kafka', 'Docker'],
    fundingStage: 'series-b', intelligenceScore: 74, createdAt: '2024-04-01T10:00:00Z', updatedAt: '2024-07-15T11:00:00Z',
  },
  {
    id: 'tc-017', name: 'InsightBridge', domain: 'insightbridge.com', industry: 'Business Intelligence',
    size: 'mid-market', website: 'https://insightbridge.com',
    description: 'Embedded analytics API for SaaS platforms.',
    status: 'active', annualRevenue: '$38M', employeeCount: 190, headquarters: 'Toronto, Canada',
    technologies: ['TypeScript', 'D3.js', 'PostgreSQL', 'Redis', 'React'],
    fundingStage: 'series-a', intelligenceScore: 77, createdAt: '2024-03-05T08:00:00Z', updatedAt: '2024-08-08T10:00:00Z',
  },
  {
    id: 'tc-018', name: 'LogicOps AI', domain: 'logicops.ai', industry: 'AIOps',
    size: 'mid-market', website: 'https://logicops.ai',
    description: 'AI-powered IT operations automation and incident management.',
    status: 'qualified', annualRevenue: '$72M', employeeCount: 380, headquarters: 'Boston, MA',
    technologies: ['Python', 'MLflow', 'Kubernetes', 'Elasticsearch', 'Slack API'],
    fundingStage: 'series-c', intelligenceScore: 82, createdAt: '2024-02-15T09:00:00Z', updatedAt: '2024-07-28T08:00:00Z',
  },
  {
    id: 'tc-019', name: 'NovaSoft Solutions', domain: 'novasoft.com', industry: 'Enterprise Software',
    size: 'mid-market', website: 'https://novasoft.com',
    description: 'Legacy modernization and microservices migration platform.',
    status: 'active', annualRevenue: '$95M', employeeCount: 520, headquarters: 'Dallas, TX',
    technologies: ['Java', 'Spring Boot', 'Kubernetes', 'Istio', 'React'],
    fundingStage: 'series-c', intelligenceScore: 71, createdAt: '2024-01-25T10:00:00Z', updatedAt: '2024-06-20T12:00:00Z',
  },
  {
    id: 'tc-020', name: 'PixelForge', domain: 'pixelforge.io', industry: 'Design Tools',
    size: 'mid-market', website: 'https://pixelforge.io',
    description: 'AI-powered design system and component library platform.',
    status: 'active', annualRevenue: '$32M', employeeCount: 165, headquarters: 'London, UK',
    technologies: ['TypeScript', 'React', 'Figma API', 'PostgreSQL', 'Vercel'],
    fundingStage: 'series-a', intelligenceScore: 78, createdAt: '2024-04-20T08:00:00Z', updatedAt: '2024-08-12T09:00:00Z',
  },

  // ═══ FINANCE & FINTECH (8) ═══
  {
    id: 'tc-021', name: 'CapitalFlow Systems', domain: 'capitalflow.com', industry: 'FinTech',
    size: 'enterprise', website: 'https://capitalflow.com',
    description: 'Enterprise treasury management and cash flow optimization platform.',
    status: 'active', annualRevenue: '$1.5B', employeeCount: 6800, headquarters: 'New York, NY',
    technologies: ['Java', 'Spring', 'Oracle', 'React', 'Kafka'],
    fundingStage: 'public', intelligenceScore: 86, createdAt: '2024-01-10T08:00:00Z', updatedAt: '2024-07-15T10:00:00Z',
  },
  {
    id: 'tc-022', name: 'PayStream Global', domain: 'paystream.com', industry: 'Payments',
    size: 'enterprise', website: 'https://paystream.com',
    description: 'Cross-border payment processing and currency exchange platform.',
    status: 'active', annualRevenue: '$3.2B', employeeCount: 9500, headquarters: 'London, UK',
    technologies: ['Java', 'Kafka', 'PostgreSQL', 'Redis', 'Docker'],
    fundingStage: 'public', intelligenceScore: 90, createdAt: '2024-02-05T09:00:00Z', updatedAt: '2024-08-01T11:00:00Z',
  },
  {
    id: 'tc-023', name: 'WealthBridge Advisors', domain: 'wealthbridge.com', industry: 'Wealth Management',
    size: 'mid-market', website: 'https://wealthbridge.com',
    description: 'Digital wealth management and robo-advisory platform.',
    status: 'qualified', annualRevenue: '$45M', employeeCount: 200, headquarters: 'Zurich, Switzerland',
    technologies: ['Python', 'React', 'PostgreSQL', 'AWS', 'Stripe'],
    fundingStage: 'series-b', intelligenceScore: 80, createdAt: '2024-03-18T10:00:00Z', updatedAt: '2024-07-22T12:00:00Z',
  },
  {
    id: 'tc-024', name: 'InsureTech Plus', domain: 'insuretechplus.com', industry: 'InsurTech',
    size: 'mid-market', website: 'https://insuretechplus.com',
    description: 'AI-powered claims processing and risk assessment for insurance.',
    status: 'active', annualRevenue: '$68M', employeeCount: 350, headquarters: 'Hartford, CT',
    technologies: ['Python', 'TensorFlow', 'FastAPI', 'PostgreSQL', 'React'],
    fundingStage: 'series-b', intelligenceScore: 79, createdAt: '2024-02-22T08:00:00Z', updatedAt: '2024-07-18T10:00:00Z',
  },
  {
    id: 'tc-025', name: 'CryptoVault Exchange', domain: 'cryptovault.io', industry: 'Cryptocurrency',
    size: 'mid-market', website: 'https://cryptovault.io',
    description: 'Institutional cryptocurrency exchange and custody platform.',
    status: 'new', annualRevenue: '$120M', employeeCount: 420, headquarters: 'Singapore',
    technologies: ['Go', 'Rust', 'PostgreSQL', 'Redis', 'Kubernetes'],
    fundingStage: 'series-c', intelligenceScore: 73, createdAt: '2024-05-05T08:00:00Z', updatedAt: '2024-08-10T08:00:00Z',
  },
  {
    id: 'tc-026', name: 'LendSmart AI', domain: 'lendsmart.ai', industry: 'Lending',
    size: 'mid-market', website: 'https://lendsmart.ai',
    description: 'AI-driven lending platform for alternative credit scoring.',
    status: 'active', annualRevenue: '$35M', employeeCount: 180, headquarters: 'Charlotte, NC',
    technologies: ['Python', 'scikit-learn', 'Django', 'PostgreSQL', 'AWS'],
    fundingStage: 'series-a', intelligenceScore: 75, createdAt: '2024-04-10T09:00:00Z', updatedAt: '2024-07-25T14:00:00Z',
  },
  {
    id: 'tc-027', name: 'TradeOptimize Pro', domain: 'tradeoptimize.com', industry: 'Trading',
    size: 'enterprise', website: 'https://tradeoptimize.com',
    description: 'Algorithmic trading platform with ML-based signal detection.',
    status: 'active', annualRevenue: '$890M', employeeCount: 4100, headquarters: 'Chicago, IL',
    technologies: ['C++', 'Python', 'Kafka', 'Redis', 'Kubernetes'],
    fundingStage: 'public', intelligenceScore: 88, createdAt: '2024-01-08T08:00:00Z', updatedAt: '2024-08-02T10:00:00Z',
  },
  {
    id: 'tc-028', name: 'RegTech Solutions', domain: 'regtechsolutions.com', industry: 'RegTech',
    size: 'mid-market', website: 'https://regtechsolutions.com',
    description: 'Regulatory compliance automation for financial institutions.',
    status: 'active', annualRevenue: '$52M', employeeCount: 260, headquarters: 'Dublin, Ireland',
    technologies: ['Java', 'Spring', 'PostgreSQL', 'Elasticsearch', 'Docker'],
    fundingStage: 'series-b', intelligenceScore: 77, createdAt: '2024-03-12T10:00:00Z', updatedAt: '2024-07-28T09:00:00Z',
  },

  // ═══ HEALTHCARE (7) ═══
  {
    id: 'tc-029', name: 'MediCloud Health', domain: 'medicloud.com', industry: 'HealthTech',
    size: 'enterprise', website: 'https://medicloud.com',
    description: 'Cloud-based EHR and practice management platform for hospitals.',
    status: 'active', annualRevenue: '$2.1B', employeeCount: 12500, headquarters: 'Nashville, TN',
    technologies: ['Java', 'PostgreSQL', 'FHIR', 'React', 'AWS'],
    fundingStage: 'public', intelligenceScore: 84, createdAt: '2024-01-15T08:00:00Z', updatedAt: '2024-07-20T10:00:00Z',
  },
  {
    id: 'tc-030', name: 'BioData Analytics', domain: 'biodata.com', industry: 'Bioinformatics',
    size: 'mid-market', website: 'https://biodata.com',
    description: 'Genomic data analysis platform for pharmaceutical research.',
    status: 'active', annualRevenue: '$95M', employeeCount: 480, headquarters: 'Cambridge, MA',
    technologies: ['Python', 'R', 'Spark', 'AWS', 'Nextflow'],
    fundingStage: 'series-c', intelligenceScore: 91, createdAt: '2024-02-10T09:00:00Z', updatedAt: '2024-08-05T11:00:00Z',
  },
  {
    id: 'tc-031', name: 'CareConnect AI', domain: 'careconnect.ai', industry: 'AI Health',
    size: 'mid-market', website: 'https://careconnect.ai',
    description: 'AI-powered patient triage and clinical decision support system.',
    status: 'qualified', annualRevenue: '$42M', employeeCount: 210, headquarters: 'San Francisco, CA',
    technologies: ['Python', 'TensorFlow', 'FastAPI', 'PostgreSQL', 'React'],
    fundingStage: 'series-b', intelligenceScore: 85, createdAt: '2024-03-08T10:00:00Z', updatedAt: '2024-08-01T12:00:00Z',
  },
  {
    id: 'tc-032', name: 'PharmaTrack Systems', domain: 'pharmatrack.com', industry: 'Pharma Tech',
    size: 'enterprise', website: 'https://pharmatrack.com',
    description: 'Clinical trial management and drug safety monitoring platform.',
    status: 'active', annualRevenue: '$1.3B', employeeCount: 7800, headquarters: 'Philadelphia, PA',
    technologies: ['Java', 'Oracle', 'React', 'TypeScript', 'SAP'],
    fundingStage: 'public', intelligenceScore: 80, createdAt: '2024-01-22T08:00:00Z', updatedAt: '2024-07-10T14:00:00Z',
  },
  {
    id: 'tc-033', name: 'TeleHealth Plus', domain: 'telehealthplus.com', industry: 'Telemedicine',
    size: 'mid-market', website: 'https://telehealthplus.com',
    description: 'HIPAA-compliant telemedicine and remote patient monitoring platform.',
    status: 'active', annualRevenue: '$58M', employeeCount: 290, headquarters: 'Miami, FL',
    technologies: ['React', 'Node.js', 'PostgreSQL', 'WebRTC', 'AWS'],
    fundingStage: 'series-b', intelligenceScore: 78, createdAt: '2024-04-05T09:00:00Z', updatedAt: '2024-08-08T10:00:00Z',
  },
  {
    id: 'tc-034', name: 'HealthDataSecure', domain: 'healthdatasec.com', industry: 'Health Security',
    size: 'mid-market', website: 'https://healthdatasec.com',
    description: 'Healthcare data security and HIPAA compliance platform.',
    status: 'active', annualRevenue: '$38M', employeeCount: 180, headquarters: 'Washington, DC',
    technologies: ['Python', 'Go', 'Kubernetes', 'Vault', 'PostgreSQL'],
    fundingStage: 'series-a', intelligenceScore: 76, createdAt: '2024-03-25T10:00:00Z', updatedAt: '2024-07-15T12:00:00Z',
  },
  {
    id: 'tc-035', name: 'DeviceMed IoT', domain: 'devicemed.com', industry: 'Medical IoT',
    size: 'mid-market', website: 'https://devicemed.com',
    description: 'IoT platform for connected medical device monitoring and management.',
    status: 'new', annualRevenue: '$22M', employeeCount: 120, headquarters: 'Minneapolis, MN',
    technologies: ['Go', 'MQTT', 'InfluxDB', 'Grafana', 'Kubernetes'],
    fundingStage: 'series-a', intelligenceScore: 74, createdAt: '2024-05-15T08:00:00Z', updatedAt: '2024-08-10T10:00:00Z',
  },

  // ═══ MANUFACTURING & INDUSTRIAL (5) ═══
  {
    id: 'tc-036', name: 'SmartFactory Pro', domain: 'smartfactory.com', industry: 'Industrial IoT',
    size: 'enterprise', website: 'https://smartfactory.com',
    description: 'Industrial IoT platform for manufacturing automation and predictive maintenance.',
    status: 'active', annualRevenue: '$1.8B', employeeCount: 9200, headquarters: 'Detroit, MI',
    technologies: ['Python', 'Spark', 'MQTT', 'Kafka', 'PostgreSQL', 'React'],
    fundingStage: 'public', intelligenceScore: 83, createdAt: '2024-02-01T08:00:00Z', updatedAt: '2024-07-18T10:00:00Z',
  },
  {
    id: 'tc-037', name: 'SupplyChain AI', domain: 'supplychain.ai', industry: 'Supply Chain',
    size: 'mid-market', website: 'https://supplychain.ai',
    description: 'AI-driven supply chain optimization and demand forecasting platform.',
    status: 'active', annualRevenue: '$75M', employeeCount: 380, headquarters: 'Memphis, TN',
    technologies: ['Python', 'scikit-learn', 'FastAPI', 'PostgreSQL', 'React'],
    fundingStage: 'series-b', intelligenceScore: 81, createdAt: '2024-03-15T09:00:00Z', updatedAt: '2024-08-02T12:00:00Z',
  },
  {
    id: 'tc-038', name: 'AutoTech Solutions', domain: 'autotech.com', industry: 'Automotive Tech',
    size: 'enterprise', website: 'https://autotech.com',
    description: 'Connected vehicle platform and autonomous driving software.',
    status: 'qualified', annualRevenue: '$2.5B', employeeCount: 15000, headquarters: 'Munich, Germany',
    technologies: ['C++', 'Rust', 'Python', 'ROS', 'Kubernetes', 'CUDA'],
    fundingStage: 'public', intelligenceScore: 89, createdAt: '2024-01-20T08:00:00Z', updatedAt: '2024-08-05T14:00:00Z',
  },
  {
    id: 'tc-039', name: 'CleanEnergy Ops', domain: 'cleanenergyops.com', industry: 'Energy Tech',
    size: 'mid-market', website: 'https://cleanenergyops.com',
    description: 'Operations management platform for renewable energy installations.',
    status: 'active', annualRevenue: '$48M', employeeCount: 240, headquarters: 'Austin, TX',
    technologies: ['Python', 'Django', 'PostgreSQL', 'InfluxDB', 'React'],
    fundingStage: 'series-b', intelligenceScore: 77, createdAt: '2024-04-08T10:00:00Z', updatedAt: '2024-07-30T09:00:00Z',
  },
  {
    id: 'tc-040', name: 'RoboWorks AI', domain: 'roboworks.ai', industry: 'Robotics',
    size: 'mid-market', website: 'https://roboworks.ai',
    description: 'AI-powered robotic process automation for warehouse operations.',
    status: 'new', annualRevenue: '$55M', employeeCount: 280, headquarters: 'Boston, MA',
    technologies: ['Python', 'ROS', 'PyTorch', 'Kubernetes', 'Go'],
    fundingStage: 'series-a', intelligenceScore: 80, createdAt: '2024-05-20T08:00:00Z', updatedAt: '2024-08-12T10:00:00Z',
  },

  // ═══ RETAIL & E-COMMERCE (5) ═══
  {
    id: 'tc-041', name: 'RetailGenius', domain: 'retailgenius.com', industry: 'E-Commerce',
    size: 'enterprise', website: 'https://retailgenius.com',
    description: 'AI-powered personalization and recommendation platform for retailers.',
    status: 'active', annualRevenue: '$1.1B', employeeCount: 5500, headquarters: 'Seattle, WA',
    technologies: ['Python', 'TensorFlow', 'Redis', 'Kafka', 'React', 'Node.js'],
    fundingStage: 'public', intelligenceScore: 87, createdAt: '2024-01-18T08:00:00Z', updatedAt: '2024-07-22T10:00:00Z',
  },
  {
    id: 'tc-042', name: 'ShopStream', domain: 'shopstream.io', industry: 'Retail Tech',
    size: 'mid-market', website: 'https://shopstream.io',
    description: 'Live shopping and social commerce platform.',
    status: 'active', annualRevenue: '$35M', employeeCount: 175, headquarters: 'Los Angeles, CA',
    technologies: ['React', 'Node.js', 'WebRTC', 'PostgreSQL', 'Redis'],
    fundingStage: 'series-a', intelligenceScore: 76, createdAt: '2024-03-28T10:00:00Z', updatedAt: '2024-08-05T08:00:00Z',
  },
  {
    id: 'tc-043', name: 'LogiTrack Pro', domain: 'logitrack.com', industry: 'Logistics',
    size: 'enterprise', website: 'https://logitrack.com',
    description: 'End-to-end logistics and last-mile delivery optimization platform.',
    status: 'active', annualRevenue: '$2.3B', employeeCount: 11000, headquarters: 'Memphis, TN',
    technologies: ['Java', 'Kafka', 'PostgreSQL', 'Redis', 'Kubernetes'],
    fundingStage: 'public', intelligenceScore: 82, createdAt: '2024-02-12T08:00:00Z', updatedAt: '2024-07-25T11:00:00Z',
  },
  {
    id: 'tc-044', name: 'PriceOptimizer AI', domain: 'priceoptimizer.ai', industry: 'Pricing Tech',
    size: 'mid-market', website: 'https://priceoptimizer.ai',
    description: 'Dynamic pricing and competitive intelligence platform.',
    status: 'active', annualRevenue: '$28M', employeeCount: 140, headquarters: 'New York, NY',
    technologies: ['Python', 'scikit-learn', 'FastAPI', 'PostgreSQL', 'React'],
    fundingStage: 'series-a', intelligenceScore: 78, createdAt: '2024-04-15T09:00:00Z', updatedAt: '2024-08-10T12:00:00Z',
  },
  {
    id: 'tc-045', name: 'MarketSense', domain: 'marketsense.com', industry: 'Market Intelligence',
    size: 'mid-market', website: 'https://marketsense.com',
    description: 'Real-time market intelligence and competitive monitoring platform.',
    status: 'qualified', annualRevenue: '$62M', employeeCount: 310, headquarters: 'Chicago, IL',
    technologies: ['Python', 'NLP', 'Elasticsearch', 'Kafka', 'React'],
    fundingStage: 'series-b', intelligenceScore: 81, createdAt: '2024-03-10T10:00:00Z', updatedAt: '2024-07-28T10:00:00Z',
  },

  // ═══ EDUCATION & MEDIA (5) ═══
  {
    id: 'tc-046', name: 'EduTech Global', domain: 'edutechglobal.com', industry: 'EdTech',
    size: 'enterprise', website: 'https://edutechglobal.com',
    description: 'Enterprise learning management and corporate training platform.',
    status: 'active', annualRevenue: '$750M', employeeCount: 3800, headquarters: 'San Francisco, CA',
    technologies: ['React', 'Node.js', 'PostgreSQL', 'AWS', 'TypeScript'],
    fundingStage: 'public', intelligenceScore: 79, createdAt: '2024-02-08T08:00:00Z', updatedAt: '2024-07-15T10:00:00Z',
  },
  {
    id: 'tc-047', name: 'MediaFlow AI', domain: 'mediaflow.ai', industry: 'Media Tech',
    size: 'mid-market', website: 'https://mediaflow.ai',
    description: 'AI-powered content generation and media optimization platform.',
    status: 'active', annualRevenue: '$45M', employeeCount: 220, headquarters: 'New York, NY',
    technologies: ['Python', 'GPT', 'React', 'PostgreSQL', 'Redis'],
    fundingStage: 'series-b', intelligenceScore: 84, createdAt: '2024-03-22T09:00:00Z', updatedAt: '2024-08-02T14:00:00Z',
  },
  {
    id: 'tc-048', name: 'ContentGuard', domain: 'contentguard.com', industry: 'Content Security',
    size: 'mid-market', website: 'https://contentguard.com',
    description: 'AI content moderation and brand safety platform for publishers.',
    status: 'new', annualRevenue: '$18M', employeeCount: 95, headquarters: 'London, UK',
    technologies: ['Python', 'TensorFlow', 'FastAPI', 'PostgreSQL', 'React'],
    fundingStage: 'seed', intelligenceScore: 72, createdAt: '2024-06-01T10:00:00Z', updatedAt: '2024-08-10T10:00:00Z',
  },
  {
    id: 'tc-049', name: 'SkillBridge Academy', domain: 'skillbridge.io', industry: 'Online Education',
    size: 'mid-market', website: 'https://skillbridge.io',
    description: 'Skill-based online learning and credential verification platform.',
    status: 'active', annualRevenue: '$32M', employeeCount: 160, headquarters: 'Austin, TX',
    technologies: ['React', 'Node.js', 'MongoDB', 'Redis', 'AWS'],
    fundingStage: 'series-a', intelligenceScore: 75, createdAt: '2024-04-25T08:00:00Z', updatedAt: '2024-08-08T11:00:00Z',
  },
  {
    id: 'tc-050', name: 'AdTech Precision', domain: 'adtechprecision.com', industry: 'AdTech',
    size: 'mid-market', website: 'https://adtechprecision.com',
    description: 'Programmatic advertising optimization and attribution platform.',
    status: 'active', annualRevenue: '$85M', employeeCount: 420, headquarters: 'San Francisco, CA',
    technologies: ['Python', 'Spark', 'Kafka', 'PostgreSQL', 'React'],
    fundingStage: 'series-c', intelligenceScore: 80, createdAt: '2024-01-28T08:00:00Z', updatedAt: '2024-07-20T12:00:00Z',
  },
]

/**
 * Get companies by industry for targeted testing.
 */
export function getCompaniesByIndustry(industry: string): TestCompany[] {
  return TEST_COMPANIES.filter(c => c.industry === industry)
}

/**
 * Get companies by size for segmentation testing.
 */
export function getCompaniesBySize(size: TestCompany['size']): TestCompany[] {
  return TEST_COMPANIES.filter(c => c.size === size)
}

/**
 * Get companies by status for workflow testing.
 */
export function getCompaniesByStatus(status: TestCompany['status']): TestCompany[] {
  return TEST_COMPANIES.filter(c => c.status === status)
}

/**
 * Get top N companies by intelligence score.
 */
export function getTopCompanies(n: number = 10): TestCompany[] {
  return [...TEST_COMPANIES].sort((a, b) => b.intelligenceScore - a.intelligenceScore).slice(0, n)
}
