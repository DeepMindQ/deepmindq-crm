/**
 * DeepMindQ — Disaster Recovery Configuration
 */

export const DR_CONFIG = {
  backup: {
    schedule: '0 2 * * *',  // Daily at 2 AM UTC
    retention: {
      daily: 30,    // Keep 30 daily backups
      weekly: 12,   // Keep 12 weekly backups
      monthly: 6,   // Keep 6 monthly backups
    },
    storage: {
      local: './backups',
      s3: process.env.DR_S3_BUCKET || null,
      encryptionEnabled: true,
    },
  },

  recovery: {
    rto: '4 hours',      // Recovery Time Objective
    rpo: '1 hour',       // Recovery Point Objective
    failoverRegion: process.env.DR_FAILOVER_REGION || 'us-west-2',
    hotStandby: false,    // Cold standby (manual failover)
  },

  runbook: {
    steps: [
      '1. Assess the scope of the incident',
      '2. Notify the on-call engineer',
      '3. Identify the affected systems (database, API, workers)',
      '4. Switch to read-only mode if data integrity is at risk',
      '5. If primary DB is down: promote read replica or restore from latest backup',
      '6. Verify data integrity with checksum comparison',
      '7. Scale up the API instances if needed',
      '8. Monitor error rates and latency for 30 minutes post-recovery',
      '9. Send post-incident summary to stakeholders',
      '10. Schedule incident review within 48 hours',
    ],
    emergencyContacts: [
      { role: 'Primary On-Call', contact: process.env.ONCALL_PRIMARY || 'on-call@company.com' },
      { role: 'Engineering Lead', contact: process.env.ENGINEERING_LEAD || 'eng-lead@company.com' },
      { role: 'VP Engineering', contact: process.env.VP_ENG || 'vp-eng@company.com' },
    ],
  },
}
