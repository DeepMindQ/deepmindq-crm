/**
 * Task 4.5 — CRM API: Available Providers
 *
 * GET /api/crm/providers — List available CRM providers with auth requirements
 */

import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess } from '@/lib/apiHelpers';
import { getRegisteredProviders } from '@/lib/crm/crm-connector';

export async function GET(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const providers = getRegisteredProviders().map(connector => ({
    id: connector.id,
    type: connector.type,
    name: connector.name,
    webhookUrl: connector.getWebhookUrl(),
    authRequirements: {
      type: connector.type === 'salesforce' ? 'oauth2_jwt' : 'oauth2_authorization_code',
      description:
        connector.type === 'salesforce'
          ? 'OAuth2 with JWT bearer flow. Requires Salesforce Connected App with REST API scopes.'
          : 'OAuth2 authorization code flow. Requires HubSpot App with CRM scopes.',
      envVars: connector.type === 'salesforce'
        ? [
            'SALESFORCE_CLIENT_ID',
            'SALESFORCE_CLIENT_SECRET',
            'SALESFORCE_API_BASE (optional)',
            'SALESFORCE_REDIRECT_URI',
          ]
        : [
            'HUBSPOT_CLIENT_ID',
            'HUBSPOT_CLIENT_SECRET',
            'HUBSPOT_API_BASE (optional)',
            'HUBSPOT_REDIRECT_URI',
          ],
      scopes: connector.type === 'salesforce'
        ? ['refresh_token', 'full', 'api']
        : [
            'crm.objects.companies.read',
            'crm.objects.companies.write',
            'crm.objects.contacts.read',
            'crm.objects.contacts.write',
            'crm.objects.deals.read',
            'crm.objects.deals.write',
          ],
      helpUrl:
        connector.type === 'salesforce'
          ? 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/quickstart_oauth.htm'
          : 'https://developers.hubspot.com/docs/api/crm/understanding-scopes',
    },
  }));

  return apiSuccess(providers);
}
