import { NextRequest, NextResponse } from 'next/server'
import { incidentManager } from '@/lib/incident-manager'
import type { Severity, IncidentStatus } from '@/lib/incident-manager'
import { checkApiAuth } from '@/lib/api-auth'

/**
 * GET /api/incidents
 *
 * Returns active and all incidents, plus a summary.
 */
export async function GET(request: NextRequest) {
  const auth = await checkApiAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    active: incidentManager.getActiveIncidents(),
    all: incidentManager.getAllIncidents(),
    summary: incidentManager.getSummary(),
  })
}

/**
 * POST /api/incidents
 *
 * Dispatches actions: create, update_status, assign, note, escalate, update_impact.
 */
export async function POST(request: NextRequest) {
  const auth = await checkApiAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    action,
    title,
    severity,
    description,
    incidentId,
    status,
    message,
    author,
    assignee,
    systems,
    affectedUsers,
  } = body

  switch (action) {
    case 'create': {
      if (!title || !severity) {
        return NextResponse.json(
          { error: 'title and severity are required' },
          { status: 400 }
        )
      }

      const validSeverities: Severity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4']
      if (!validSeverities.includes(severity)) {
        return NextResponse.json(
          { error: `severity must be one of: ${validSeverities.join(', ')}` },
          { status: 400 }
        )
      }

      const incident = incidentManager.create(
        title,
        severity as Severity,
        description || '',
        author || 'system'
      )
      return NextResponse.json({ incident }, { status: 201 })
    }

    case 'update_status': {
      if (!incidentId || !status) {
        return NextResponse.json(
          { error: 'incidentId and status are required' },
          { status: 400 }
        )
      }

      const validStatuses: IncidentStatus[] = [
        'investigating',
        'identified',
        'monitoring',
        'resolved',
        'postmortem',
      ]
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `status must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }

      const updated = incidentManager.updateStatus(
        incidentId,
        status as IncidentStatus,
        author || 'system',
        message
      )

      if (!updated) {
        return NextResponse.json(
          { error: 'Incident not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ incident: updated })
    }

    case 'assign': {
      if (!incidentId || !assignee) {
        return NextResponse.json(
          { error: 'incidentId and assignee are required' },
          { status: 400 }
        )
      }

      const assigned = incidentManager.assign(
        incidentId,
        assignee,
        author || 'system'
      )

      if (!assigned) {
        return NextResponse.json(
          { error: 'Incident not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ incident: assigned })
    }

    case 'note': {
      if (!incidentId || !message) {
        return NextResponse.json(
          { error: 'incidentId and message are required' },
          { status: 400 }
        )
      }

      const noted = incidentManager.addNote(
        incidentId,
        author || 'system',
        message
      )

      if (!noted) {
        return NextResponse.json(
          { error: 'Incident not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ incident: noted })
    }

    case 'escalate': {
      if (!incidentId) {
        return NextResponse.json(
          { error: 'incidentId is required' },
          { status: 400 }
        )
      }

      const escalated = incidentManager.escalate(
        incidentId,
        author || 'system',
        message
      )

      if (!escalated) {
        return NextResponse.json(
          { error: 'Incident not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ incident: escalated })
    }

    case 'update_impact': {
      if (!incidentId) {
        return NextResponse.json(
          { error: 'incidentId is required' },
          { status: 400 }
        )
      }

      const updated = incidentManager.updateImpact(
        incidentId,
        Array.isArray(systems) ? systems : [],
        typeof affectedUsers === 'number' ? affectedUsers : null
      )

      if (!updated) {
        return NextResponse.json(
          { error: 'Incident not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ incident: updated })
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      )
  }
}
