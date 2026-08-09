/**
 * DeepMindQ — Incident Manager
 *
 * In-memory incident tracking system for managing operational incidents.
 * Provides creation, status tracking, assignment, SLA monitoring, and
 * timeline management for all severity levels (SEV1–SEV4).
 *
 * Usage:
 *   import { incidentManager } from '@/lib/incident-manager'
 *   const incident = incidentManager.create('DB Down', 'SEV1', '...', 'on-call')
 */

import { db } from '@/lib/db'

export type Severity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'postmortem'

export interface Incident {
  id: string
  title: string
  severity: Severity
  status: IncidentStatus
  description: string
  assignedTo: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  timeline: IncidentEvent[]
  impact: {
    affectedSystems: string[]
    affectedUsers: number | null
    startedAt: string
  }
}

export interface IncidentEvent {
  timestamp: string
  type: 'status_change' | 'assignment' | 'note' | 'escalation' | 'resolution'
  author: string
  message: string
}

export interface SLACheckResult {
  breached: boolean
  remainingMs: number
  severity: Severity
  incidentId: string
}

export interface IncidentSummary {
  total: number
  active: number
  bySeverity: Record<Severity, number>
  byStatus: Record<IncidentStatus, number>
  slaBreached: number
}

/**
 * Severity label mapping for display purposes.
 */
export const SEVERITY_LABELS: Record<Severity, string> = {
  SEV1: 'Critical',
  SEV2: 'Major',
  SEV3: 'Minor',
  SEV4: 'Low',
}

/**
 * Severity color mapping for UI rendering.
 */
export const SEVERITY_COLORS: Record<Severity, string> = {
  SEV1: '#dc2626',
  SEV2: '#f59e0b',
  SEV3: '#3b82f6',
  SEV4: '#6b7280',
}

/**
 * Valid status transitions for incident lifecycle.
 */
const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  investigating: ['identified', 'resolved'],
  identified: ['monitoring', 'resolved'],
  monitoring: ['investigating', 'resolved'],
  resolved: ['postmortem'],
  postmortem: [],
}

const INCIDENTS_PERSIST_KEY = 'incidents_persist'

class IncidentManager {
  private incidents = new Map<string, Incident>()
  private loaded = false

  /**
   * Response SLA in milliseconds for each severity level.
   * SEV1: 15 minutes, SEV2: 30 minutes, SEV3: 2 hours, SEV4: 24 hours.
   */
  private readonly responseSLA: Record<Severity, number> = {
    SEV1: 15 * 60 * 1000,
    SEV2: 30 * 60 * 1000,
    SEV3: 2 * 60 * 60 * 1000,
    SEV4: 24 * 60 * 60 * 1000,
  }

  /**
   * Maximum number of incidents to retain in memory.
   */
  private readonly maxIncidents = 1000

  /**
   * Create a new incident.
   */
  create(title: string, severity: Severity, description: string, author: string): Incident {
    this.evictIfNeeded()

    const id = `INC-${Date.now()}`
    const now = new Date().toISOString()

    const incident: Incident = {
      id,
      title,
      severity,
      status: 'investigating',
      description,
      assignedTo: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      timeline: [
        {
          timestamp: now,
          type: 'status_change',
          author,
          message: `Incident opened (${severity}: ${SEVERITY_LABELS[severity]})`,
        },
      ],
      impact: {
        affectedSystems: [],
        affectedUsers: null,
        startedAt: now,
      },
    }

    this.incidents.set(id, incident)
    this.persistIncidents()
    return incident
  }

  /**
   * Update the status of an incident.
   * Validates status transitions to prevent invalid state changes.
   */
  updateStatus(
    id: string,
    newStatus: IncidentStatus,
    author: string,
    message?: string
  ): Incident | null {
    const incident = this.incidents.get(id)
    if (!incident) return null

    // Validate transition
    const validTransitions = VALID_TRANSITIONS[incident.status]
    if (!validTransitions.includes(newStatus)) {
      console.warn(
        `[IncidentManager] Invalid transition: ${incident.status} → ${newStatus} for ${id}. ` +
        `Valid: ${validTransitions.join(', ')}`
      )
      return incident // Return unchanged
    }

    const now = new Date().toISOString()
    incident.status = newStatus
    incident.updatedAt = now

    if (newStatus === 'resolved') {
      incident.resolvedAt = now
    }

    incident.timeline.push({
      timestamp: now,
      type: newStatus === 'resolved' ? 'resolution' : 'status_change',
      author,
      message: message || `Status changed to ${newStatus}`,
    })

    this.persistIncidents()
    return incident
  }

  /**
   * Assign an incident to a team member.
   */
  assign(id: string, assignee: string, author: string): Incident | null {
    const incident = this.incidents.get(id)
    if (!incident) return null

    const now = new Date().toISOString()
    const previousAssignee = incident.assignedTo
    incident.assignedTo = assignee
    incident.updatedAt = now

    incident.timeline.push({
      timestamp: now,
      type: 'assignment',
      author,
      message: previousAssignee
        ? `Reassigned from ${previousAssignee} to ${assignee}`
        : `Assigned to ${assignee}`,
    })

    this.persistIncidents()
    return incident
  }

  /**
   * Add a note to the incident timeline.
   */
  addNote(id: string, author: string, message: string): Incident | null {
    const incident = this.incidents.get(id)
    if (!incident) return null

    const now = new Date().toISOString()
    incident.updatedAt = now

    incident.timeline.push({
      timestamp: now,
      type: 'note',
      author,
      message,
    })

    this.persistIncidents()
    return incident
  }

  /**
   * Record an escalation event in the incident timeline.
   */
  escalate(id: string, author: string, message: string): Incident | null {
    const incident = this.incidents.get(id)
    if (!incident) return null

    const now = new Date().toISOString()
    incident.updatedAt = now

    incident.timeline.push({
      timestamp: now,
      type: 'escalation',
      author,
      message: message || `Escalated by ${author}`,
    })

    this.persistIncidents()
    return incident
  }

  /**
   * Update the impact assessment for an incident.
   */
  updateImpact(
    id: string,
    systems: string[],
    affectedUsers: number | null
  ): Incident | null {
    const incident = this.incidents.get(id)
    if (!incident) return null

    incident.impact.affectedSystems = systems
    incident.impact.affectedUsers = affectedUsers
    incident.updatedAt = new Date().toISOString()

    this.persistIncidents()
    return incident
  }

  /**
   * Get all currently active (non-resolved, non-postmortem) incidents.
   */
  getActiveIncidents(): Incident[] {
    return Array.from(this.incidents.values()).filter(
      (i) => i.status !== 'resolved' && i.status !== 'postmortem'
    )
  }

  /**
   * Get a single incident by ID.
   */
  getIncident(id: string): Incident | null {
    return this.incidents.get(id) || null
  }

  /**
   * Get all incidents, sorted by creation date (newest first).
   */
  getAllIncidents(): Incident[] {
    return Array.from(this.incidents.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  /**
   * Get incidents filtered by severity.
   */
  getBySeverity(severity: Severity): Incident[] {
    return this.getAllIncidents().filter((i) => i.severity === severity)
  }

  /**
   * Get incidents filtered by status.
   */
  getByStatus(status: IncidentStatus): Incident[] {
    return this.getAllIncidents().filter((i) => i.status === status)
  }

  /**
   * Check SLA compliance for an incident.
   * Returns whether the SLA has been breached and remaining time.
   */
  checkSLA(id: string): SLACheckResult {
    const incident = this.incidents.get(id)
    if (!incident) {
      return { breached: false, remainingMs: Infinity, severity: 'SEV4', incidentId: id }
    }

    if (incident.status === 'resolved' || incident.status === 'postmortem') {
      return { breached: false, remainingMs: Infinity, severity: incident.severity, incidentId: id }
    }

    const sla = this.responseSLA[incident.severity]
    const elapsed = Date.now() - new Date(incident.createdAt).getTime()
    const remaining = sla - elapsed

    return {
      breached: remaining < 0,
      remainingMs: Math.max(0, remaining),
      severity: incident.severity,
      incidentId: id,
    }
  }

  /**
   * Check all active incidents for SLA breaches.
   */
  checkAllSLAs(): SLACheckResult[] {
    return this.getActiveIncidents().map((incident) => this.checkSLA(incident.id))
  }

  /**
   * Generate a summary of all incidents.
   */
  getSummary(): IncidentSummary {
    const all = this.getAllIncidents()
    const active = this.getActiveIncidents()
    const slaBreached = this.checkAllSLAs().filter((s) => s.breached).length

    const bySeverity: Record<Severity, number> = { SEV1: 0, SEV2: 0, SEV3: 0, SEV4: 0 }
    const byStatus: Record<IncidentStatus, number> = {
      investigating: 0,
      identified: 0,
      monitoring: 0,
      resolved: 0,
      postmortem: 0,
    }

    for (const incident of all) {
      bySeverity[incident.severity]++
      byStatus[incident.status]++
    }

    return {
      total: all.length,
      active: active.length,
      bySeverity,
      byStatus,
      slaBreached,
    }
  }

  /**
   * Delete an incident (for testing/cleanup purposes).
   */
  delete(id: string): boolean {
    const result = this.incidents.delete(id)
    this.persistIncidents()
    return result
  }

  /**
   * Clear all incidents (for testing purposes).
   */
  clear(): void {
    this.incidents.clear()
    this.persistIncidents()
  }

  /**
   * Get the total count of incidents.
   */
  get count(): number {
    return this.incidents.size
  }

  // ── Persistence (Gap 2) ──────────────────────────────────────────
  // Store incidents in SystemSetting for durability across restarts.

  /**
   * Load incidents from SystemSetting into memory.
   * Call this once at startup to restore state from a previous session.
   */
  async loadIncidents(): Promise<void> {
    if (this.loaded) return

    try {
      const row = await db.systemSetting.findUnique({
        where: { key: INCIDENTS_PERSIST_KEY },
      })

      if (row) {
        const parsed: Incident[] = JSON.parse(row.value)
        for (const inc of parsed) {
          this.incidents.set(inc.id, inc)
        }
        console.log(`[IncidentManager] Loaded ${parsed.length} incidents from DB`)
      }
    } catch (error) {
      console.warn('[IncidentManager] Failed to load incidents from DB:', error)
    }

    this.loaded = true
  }

  /**
   * Persist current in-memory incidents to SystemSetting.
   * Non-blocking (fire-and-forget) to avoid changing sync method signatures.
   */
  private persistIncidents(): void {
    // Fire-and-forget: don't await, don't block callers
    const incidentList: Incident[] = [];
    this.incidents.forEach((inc) => incidentList.push(inc));

    (async () => {
      try {
        await db.systemSetting.upsert({
          where: { key: INCIDENTS_PERSIST_KEY },
          update: { value: JSON.stringify(incidentList) },
          create: { key: INCIDENTS_PERSIST_KEY, value: JSON.stringify(incidentList) },
        })
      } catch (error) {
        // Non-blocking — never let persistence break incident management
        console.warn('[IncidentManager] Failed to persist incidents to DB:', error)
      }
    })()
  }

  /**
   * Evict oldest resolved incidents when max capacity is reached.
   */
  private evictIfNeeded(): void {
    if (this.incidents.size < this.maxIncidents) return

    // Remove oldest resolved/postmortem incidents first
    const resolved = Array.from(this.incidents.entries())
      .filter(([, i]) => i.status === 'resolved' || i.status === 'postmortem')
      .sort((a, b) => new Date(a[1].resolvedAt || a[1].createdAt).getTime() -
                      new Date(b[1].resolvedAt || b[1].createdAt).getTime())

    const toRemove = Math.min(resolved.length, this.incidents.size - this.maxIncidents + 10)
    for (let i = 0; i < toRemove; i++) {
      this.incidents.delete(resolved[i][0])
    }
  }
}

/**
 * Singleton incident manager instance.
 */
export const incidentManager = new IncidentManager()
