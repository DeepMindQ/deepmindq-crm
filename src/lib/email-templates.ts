/**
 * DeepMindQ Intelligence OS — Email Notification Template Engine
 *
 * Provides 7 pre-built notification templates with HTML and plain-text versions.
 * All HTML uses inline styles for maximum email-client compatibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailContext {
  companyName?: string;
  productUrl?: string;
  logoUrl?: string;
  primaryColor?: string;
  footerText?: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  subject: string;
  variables: string[];
  htmlTemplate: (vars: Record<string, string>, ctx: EmailContext) => string;
  textTemplate: (vars: Record<string, string>, ctx: EmailContext) => string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

// ---------------------------------------------------------------------------
// Default context
// ---------------------------------------------------------------------------

const DEFAULT_CONTEXT: Required<EmailContext> = {
  companyName: 'DeepMindQ Intelligence',
  productUrl: 'https://deepmindq.io',
  logoUrl: 'https://deepmindq.io/logo.png',
  primaryColor: '#1a56db',
  footerText: '© {{year}} DeepMindQ Intelligence. All rights reserved.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function interpolate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

function currentYear(): string {
  return new Date().getFullYear().toString();
}

// ---------------------------------------------------------------------------
// Email Wrapper
// ---------------------------------------------------------------------------

function emailWrapper(
  ctx: EmailContext,
  title: string,
  body: string,
  cta?: { label: string; url: string },
): string {
  const merged = { ...DEFAULT_CONTEXT, ...ctx };
  const footer = interpolate(merged.footerText, { year: currentYear() });

  const ctaBlock = cta
    ? `
    <tr>
      <td style="padding: 24px 0 8px 0; text-align: center;">
        <a href="${cta.url}"
           target="_blank"
           style="display: inline-block; padding: 12px 28px; background-color: ${merged.primaryColor}; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px;">
          ${cta.label}
        </a>
      </td>
    </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: ${merged.primaryColor}; padding: 20px 32px; text-align: left;">
              <img src="${merged.logoUrl}" alt="${merged.companyName}" width="140" style="display: block;" />
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #111827;">${title}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 16px 32px 8px 32px; font-size: 15px; line-height: 1.6; color: #374151;">
              ${body}
            </td>
          </tr>

          <!-- CTA -->
          ${ctaBlock}

          <!-- Spacer -->
          <tr><td style="height: 24px;">&nbsp;</td></tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 32px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
              ${footer}<br/>
              <a href="${merged.productUrl}" style="color: ${merged.primaryColor}; text-decoration: none;">${merged.productUrl}</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 1. signal.detected — New AI signal for a tracked company
// ---------------------------------------------------------------------------

const signalDetectedTemplate: TemplateDefinition = {
  id: 'signal.detected',
  name: 'AI Signal Detected',
  description: 'Notifies user when a new AI signal is detected for a tracked company',
  category: 'signals',
  subject: '🚀 New AI Signal: {{signalName}} for {{companyName}}',
  variables: ['companyName', 'signalName', 'signalType', 'confidence', 'summary', 'signalUrl'],
  htmlTemplate(vars, ctx) {
    const body = `
      <p>Hi there,</p>
      <p>We detected a new AI signal for <strong>${vars.companyName}</strong>:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 16px 0; border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 10px 16px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px 4px 0 0;">
            <strong style="color: #1e40af;">${vars.signalName}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background-color: #ffffff; border-left: 1px solid #bfdbfe; border-right: 1px solid #bfdbfe;">
            <p style="margin: 0 0 8px 0; color: #374151;">${vars.summary}</p>
            <p style="margin: 0; font-size: 13px; color: #6b7280;">
              Type: ${vars.signalType} &nbsp;|&nbsp; Confidence: <strong>${vars.confidence}%</strong>
            </p>
          </td>
        </tr>
      </table>
      <p>Click below to view the full signal details and take action.</p>
    `;
    return emailWrapper(ctx, `New AI Signal for ${vars.companyName}`, body, {
      label: 'View Signal Details',
      url: vars.signalUrl || '{{signalUrl}}',
    });
  },
  textTemplate(vars) {
    return `New AI Signal Detected
========================

Company: ${vars.companyName}
Signal:  ${vars.signalName}
Type:    ${vars.signalType}
Confidence: ${vars.confidence}%

${vars.summary}

View details: ${vars.signalUrl}
`;
  },
};

// ---------------------------------------------------------------------------
// 2. score.changed — Company intelligence score changed
// ---------------------------------------------------------------------------

const scoreChangedTemplate: TemplateDefinition = {
  id: 'score.changed',
  name: 'Intelligence Score Changed',
  description: 'Alerts user when a tracked company intelligence score changes significantly',
  category: 'scores',
  subject: '📊 Score Update: {{companyName}} moved from {{previousScore}} to {{newScore}}',
  variables: ['companyName', 'previousScore', 'newScore', 'direction', 'factors', 'companyUrl'],
  htmlTemplate(vars, ctx) {
    const isUp = vars.direction === 'up';
    const arrow = isUp ? '▲' : '▼';
    const color = isUp ? '#059669' : '#dc2626';
    const bg = isUp ? '#ecfdf5' : '#fef2f2';

    const body = `
      <p>Hi there,</p>
      <p>The intelligence score for <strong>${vars.companyName}</strong> has changed:</p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="display: inline-block; font-size: 28px; font-weight: 700; color: ${color};">
          ${arrow} ${vars.previousScore} → ${vars.newScore}
        </span>
      </div>
      <p><strong>Key factors:</strong></p>
      <p style="color: #4b5563; line-height: 1.7;">${vars.factors}</p>
    `;
    return emailWrapper(ctx, `Score Update: ${vars.companyName}`, body, {
      label: 'View Company Profile',
      url: vars.companyUrl || '{{companyUrl}}',
    });
  },
  textTemplate(vars) {
    return `Intelligence Score Changed
===========================

Company: ${vars.companyName}
Change:  ${vars.previousScore} → ${vars.newScore} (${vars.direction})

Key factors:
${vars.factors}

View company: ${vars.companyUrl}
`;
  },
};

// ---------------------------------------------------------------------------
// 3. brief.weekly — Weekly intelligence briefing summary
// ---------------------------------------------------------------------------

const weeklyBriefTemplate: TemplateDefinition = {
  id: 'brief.weekly',
  name: 'Weekly Intelligence Briefing',
  description: 'A weekly digest summarising intelligence activity across tracked companies',
  category: 'briefings',
  subject: 'Weekly Intelligence Briefing — {{weekLabel}}',
  variables: ['weekLabel', 'totalSignals', 'totalScoreChanges', 'topCompanies', 'keyHighlights', 'dashboardUrl'],
  htmlTemplate(vars, ctx) {
    const body = `
      <p>Hi there,</p>
      <p>Here is your weekly intelligence briefing for <strong>${vars.weekLabel}</strong>.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
        <tr>
          <td style="padding: 12px 16px; background-color: #eff6ff; border-radius: 6px; width: 50%;">
            <div style="font-size: 24px; font-weight: 700; color: #1e40af;">${vars.totalSignals}</div>
            <div style="font-size: 13px; color: #6b7280;">Signals Detected</div>
          </td>
          <td style="padding: 12px 16px; background-color: #fef3c7; border-radius: 6px; width: 50%;">
            <div style="font-size: 24px; font-weight: 700; color: #92400e;">${vars.totalScoreChanges}</div>
            <div style="font-size: 13px; color: #6b7280;">Score Changes</div>
          </td>
        </tr>
      </table>

      <p><strong>Top Companies:</strong></p>
      <p style="color: #4b5563; line-height: 1.7;">${vars.topCompanies}</p>

      <p><strong>Key Highlights:</strong></p>
      <p style="color: #4b5563; line-height: 1.7;">${vars.keyHighlights}</p>
    `;
    return emailWrapper(ctx, `Weekly Briefing — ${vars.weekLabel}`, body, {
      label: 'Open Dashboard',
      url: vars.dashboardUrl || '{{dashboardUrl}}',
    });
  },
  textTemplate(vars) {
    return `Weekly Intelligence Briefing — ${vars.weekLabel}
==============================================

Signals Detected:  ${vars.totalSignals}
Score Changes:     ${vars.totalScoreChanges}

Top Companies:
${vars.topCompanies}

Key Highlights:
${vars.keyHighlights}

Open dashboard: ${vars.dashboardUrl}
`;
  },
};

// ---------------------------------------------------------------------------
// 4. opportunity.created — New sales opportunity created
// ---------------------------------------------------------------------------

const opportunityCreatedTemplate: TemplateDefinition = {
  id: 'opportunity.created',
  name: 'Opportunity Created',
  description: 'Notifies when the system identifies a new sales opportunity',
  category: 'opportunities',
  subject: '💡 New Opportunity: {{opportunityName}} ({{value}})',
  variables: ['opportunityName', 'companyName', 'value', 'stage', 'likelihood', 'description', 'opportunityUrl'],
  htmlTemplate(vars, ctx) {
    const body = `
      <p>Hi there,</p>
      <p>A new sales opportunity has been identified:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 16px 0; border-collapse: collapse; width: 100%; border: 1px solid #e5e7eb; border-radius: 6px;">
        <tr>
          <td style="padding: 14px 16px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
            <strong style="font-size: 16px; color: #111827;">${vars.opportunityName}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 14px 16px;">
            <p style="margin: 0 0 10px 0; color: #374151;">${vars.description}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="font-size: 13px; color: #6b7280;">
              <tr><td style="padding: 2px 8px 2px 0;">Company:</td><td style="font-weight: 600; color: #111827;">${vars.companyName}</td></tr>
              <tr><td style="padding: 2px 8px 2px 0;">Value:</td><td style="font-weight: 600; color: #111827;">${vars.value}</td></tr>
              <tr><td style="padding: 2px 8px 2px 0;">Stage:</td><td style="font-weight: 600; color: #111827;">${vars.stage}</td></tr>
              <tr><td style="padding: 2px 8px 2px 0;">Likelihood:</td><td style="font-weight: 600; color: #111827;">${vars.likelihood}</td></tr>
            </table>
          </td>
        </tr>
      </table>
    `;
    return emailWrapper(ctx, `New Opportunity: ${vars.opportunityName}`, body, {
      label: 'View Opportunity',
      url: vars.opportunityUrl || '{{opportunityUrl}}',
    });
  },
  textTemplate(vars) {
    return `New Sales Opportunity
======================

Opportunity: ${vars.opportunityName}
Company:     ${vars.companyName}
Value:       ${vars.value}
Stage:       ${vars.stage}
Likelihood:  ${vars.likelihood}

${vars.description}

View opportunity: ${vars.opportunityUrl}
`;
  },
};

// ---------------------------------------------------------------------------
// 5. data.quality_alert — Data quality issue detected
// ---------------------------------------------------------------------------

const dataQualityAlertTemplate: TemplateDefinition = {
  id: 'data.quality_alert',
  name: 'Data Quality Alert',
  description: 'Alerts administrators when a data quality issue is detected',
  category: 'alerts',
  subject: '⚠️ Data Quality Alert: {{issueType}} on {{sourceName}}',
  variables: ['issueType', 'sourceName', 'severity', 'affectedRecords', 'description', 'resolutionUrl'],
  htmlTemplate(vars, ctx) {
    const severityColor =
      vars.severity === 'critical' ? '#dc2626'
        : vars.severity === 'high' ? '#f59e0b'
          : '#3b82f6';

    const body = `
      <p>Hi there,</p>
      <p>A data quality issue has been detected:</p>
      <div style="margin: 16px 0; padding: 14px 18px; border-left: 4px solid ${severityColor}; background-color: #fef2f2; border-radius: 0 6px 6px 0;">
        <strong style="color: ${severityColor};">${vars.severity.toUpperCase()}: ${vars.issueType}</strong>
        <p style="margin: 8px 0 0 0; color: #374151;">${vars.description}</p>
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size: 13px; color: #6b7280; margin: 8px 0;">
        <tr><td style="padding: 2px 8px 2px 0;">Source:</td><td style="font-weight: 600; color: #111827;">${vars.sourceName}</td></tr>
        <tr><td style="padding: 2px 8px 2px 0;">Affected Records:</td><td style="font-weight: 600; color: #111827;">${vars.affectedRecords}</td></tr>
      </table>
    `;
    return emailWrapper(ctx, `Data Quality Alert: ${vars.issueType}`, body, {
      label: 'Review & Resolve',
      url: vars.resolutionUrl || '{{resolutionUrl}}',
    });
  },
  textTemplate(vars) {
    return `Data Quality Alert
==================

Severity:      ${vars.severity.toUpperCase()}
Issue:         ${vars.issueType}
Source:        ${vars.sourceName}
Records:       ${vars.affectedRecords}

${vars.description}

Review & resolve: ${vars.resolutionUrl}
`;
  },
};

// ---------------------------------------------------------------------------
// 6. user.welcome — Welcome / onboarding email
// ---------------------------------------------------------------------------

const userWelcomeTemplate: TemplateDefinition = {
  id: 'user.welcome',
  name: 'Welcome',
  description: 'Onboarding email sent when a new user signs up',
  category: 'user',
  subject: 'Welcome to DeepMindQ Intelligence 🎉',
  variables: ['userName', 'workspaceName', 'setupUrl', 'docsUrl'],
  htmlTemplate(vars, ctx) {
    const body = `
      <p>Hi ${vars.userName},</p>
      <p>Welcome to <strong>DeepMindQ Intelligence</strong>! We're excited to have you on board.</p>
      <p>Your workspace <strong>"${vars.workspaceName}"</strong> is ready to go. Here's how to get started:</p>
      <ol style="padding-left: 24px; color: #374151; line-height: 2;">
        <li>Complete your profile and connect your data sources</li>
        <li>Add the companies you want to track</li>
        <li>Set up your notification preferences</li>
        <li>Explore the intelligence dashboard</li>
      </ol>
      <p>If you need any help, check out our documentation or reach out to the support team.</p>
    `;
    return emailWrapper(ctx, `Welcome, ${vars.userName}!`, body, {
      label: 'Complete Your Setup',
      url: vars.setupUrl || '{{setupUrl}}',
    });
  },
  textTemplate(vars) {
    return `Welcome to DeepMindQ Intelligence!
==================================

Hi ${vars.userName},

Your workspace "${vars.workspaceName}" is ready.

Getting started:
1. Complete your profile and connect data sources
2. Add the companies you want to track
3. Set up notification preferences
4. Explore the intelligence dashboard

Complete your setup: ${vars.setupUrl}
Documentation:      ${vars.docsUrl}
`;
  },
};

// ---------------------------------------------------------------------------
// 7. pipeline.at_risk — Pipeline risk alert
// ---------------------------------------------------------------------------

const pipelineAtRiskTemplate: TemplateDefinition = {
  id: 'pipeline.at_risk',
  name: 'Pipeline at Risk',
  description: 'Alerts when a sales pipeline opportunity is at risk of stalling or being lost',
  category: 'pipeline',
  subject: '🔴 Pipeline Alert: {{opportunityName}} is at risk',
  variables: ['opportunityName', 'companyName', 'value', 'riskReason', 'lastActivity', 'pipelineUrl'],
  htmlTemplate(vars, ctx) {
    const body = `
      <p>Hi there,</p>
      <p>An opportunity in your pipeline needs attention:</p>
      <div style="margin: 16px 0; padding: 16px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
        <strong style="font-size: 16px; color: #991b1b;">${vars.opportunityName}</strong>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 10px; font-size: 13px; width: 100%;">
          <tr>
            <td style="padding: 2px 8px 2px 0; color: #6b7280;">Company:</td>
            <td style="color: #111827; font-weight: 600;">${vars.companyName}</td>
          </tr>
          <tr>
            <td style="padding: 2px 8px 2px 0; color: #6b7280;">Value:</td>
            <td style="color: #111827; font-weight: 600;">${vars.value}</td>
          </tr>
          <tr>
            <td style="padding: 2px 8px 2px 0; color: #6b7280;">Last Activity:</td>
            <td style="color: #111827; font-weight: 600;">${vars.lastActivity}</td>
          </tr>
        </table>
        <p style="margin: 12px 0 0 0; color: #991b1b; font-size: 14px;">
          <strong>Risk:</strong> ${vars.riskReason}
        </p>
      </div>
    `;
    return emailWrapper(ctx, `Pipeline Alert: ${vars.opportunityName}`, body, {
      label: 'Review Opportunity',
      url: vars.pipelineUrl || '{{pipelineUrl}}',
    });
  },
  textTemplate(vars) {
    return `Pipeline Alert — Opportunity at Risk
======================================

Opportunity:  ${vars.opportunityName}
Company:      ${vars.companyName}
Value:        ${vars.value}
Last Activity: ${vars.lastActivity}

Risk: ${vars.riskReason}

Review opportunity: ${vars.pipelineUrl}
`;
  },
};

// ---------------------------------------------------------------------------
// Template Registry
// ---------------------------------------------------------------------------

export const EMAIL_TEMPLATES: Record<string, TemplateDefinition> = {
  'signal.detected': signalDetectedTemplate,
  'score.changed': scoreChangedTemplate,
  'brief.weekly': weeklyBriefTemplate,
  'opportunity.created': opportunityCreatedTemplate,
  'data.quality_alert': dataQualityAlertTemplate,
  'user.welcome': userWelcomeTemplate,
  'pipeline.at_risk': pipelineAtRiskTemplate,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render an email template by ID with the given variables and context.
 * Returns the compiled HTML, plain-text, and subject line.
 */
export function renderEmail(
  templateId: string,
  vars: Record<string, string>,
  context: EmailContext = {},
): RenderedEmail {
  const template = EMAIL_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Unknown email template: "${templateId}"`);
  }

  const missingVars = template.variables.filter((v) => !(v in vars));
  if (missingVars.length > 0) {
    throw new Error(
      `Missing variables for template "${templateId}": ${missingVars.join(', ')}`,
    );
  }

  const subject = interpolate(template.subject, vars);
  const html = template.htmlTemplate(vars, context);
  const text = template.textTemplate(vars, context);

  return { html, text, subject };
}

/**
 * List all registered email templates.
 */
export function listTemplates(): TemplateDefinition[] {
  return Object.values(EMAIL_TEMPLATES);
}
