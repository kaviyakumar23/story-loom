import { serviceClient } from './supabase';

/**
 * DPDP record-keeping (§9). Records consent, generation, payment, and deletion
 * events. Best-effort: an audit write must never break the main flow, but
 * failures are logged for investigation.
 */
export async function audit(opts: {
  actor: 'parent' | 'system' | 'admin';
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await serviceClient().from('audit_log').insert({
    actor: opts.actor,
    action: opts.action,
    entity: opts.entity,
    entity_id: opts.entityId,
    metadata: opts.metadata ?? {},
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('audit_log write failed', { action: opts.action, error: error.message });
  }
}
