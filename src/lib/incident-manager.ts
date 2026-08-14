/**
 * Incident Manager — Active Incident Tracking
 *
 * Tracks and manages active incidents for the Prometheus metrics endpoint.
 * In production, this integrates with PagerDuty/Opsgenie.
 * For now, provides in-memory tracking with manual resolution.
 */

import { logger } from '@/lib/logger';

interface Incident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'acknowledged' | 'resolved';
  startedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  slaBreachAt?: Date;
}

const incidents = new Map<string, Incident>();

function isBreached(incident: Incident): boolean {
  if (incident.status === 'resolved') return false;
  if (!incident.slaBreachAt) return false;
  return new Date() > incident.slaBreachAt;
}

export const incidentManager = {
  create(title: string, severity: Incident['severity'], slaMinutes?: number): string {
    const id = `INC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const incident: Incident = {
      id,
      title,
      severity,
      status: 'active',
      startedAt: new Date(),
      slaBreachAt: slaMinutes
        ? new Date(Date.now() + slaMinutes * 60 * 1000)
        : undefined,
    };
    incidents.set(id, incident);
    logger.warn(`[Incident] Created: ${id} — ${title} (${severity})`);
    return id;
  },

  acknowledge(id: string): boolean {
    const incident = incidents.get(id);
    if (!incident) return false;
    incident.status = 'acknowledged';
    incident.acknowledgedAt = new Date();
    logger.info(`[Incident] Acknowledged: ${id}`);
    return true;
  },

  resolve(id: string): boolean {
    const incident = incidents.get(id);
    if (!incident) return false;
    incident.status = 'resolved';
    incident.resolvedAt = new Date();
    logger.info(`[Incident] Resolved: ${id}`);
    return true;
  },

  getSummary(): {
    active: number;
    acknowledged: number;
    resolved: number;
    slaBreached: number;
    bySeverity: Record<string, number>;
  } {
    let active = 0;
    let acknowledged = 0;
    let resolved = 0;
    let slaBreached = 0;
    const bySeverity: Record<string, number> = {};

    for (const incident of incidents.values()) {
      if (incident.status === 'active') active++;
      if (incident.status === 'acknowledged') acknowledged++;
      if (incident.status === 'resolved') resolved++;
      if (isBreached(incident)) slaBreached++;
      bySeverity[incident.severity] = (bySeverity[incident.severity] || 0) + 1;
    }

    return { active, acknowledged, resolved, slaBreached, bySeverity };
  },

  list(): Incident[] {
    return Array.from(incidents.values()).sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
    );
  },
};
