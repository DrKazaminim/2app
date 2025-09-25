import sql from "@/app/api/utils/sql";
import { authenticate, decrypt, logAudit } from "@/app/api/utils/auth";

export async function POST(request) {
  try {
    const auth = await authenticate(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { 
      recipients, 
      subject, 
      bodyText, 
      bodyHtml, 
      messageType = 'email',
      smtpAccountId,
      scheduledAt 
    } = await request.json();

    if (!recipients || recipients.length === 0) {
      return Response.json({ error: 'Recipients are required' }, { status: 400 });
    }

    if (!subject && !bodyText && !bodyHtml) {
      return Response.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Verify SMTP account belongs to user's organization
    const smtpAccounts = await sql`
      SELECT * FROM smtp_accounts 
      WHERE id = ${smtpAccountId} 
      AND organization_id = ${auth.user.organization_id}
      AND is_active = true
    `;

    if (smtpAccounts.length === 0) {
      return Response.json({ error: 'Invalid or inactive SMTP account' }, { status: 400 });
    }

    const smtpAccount = smtpAccounts[0];

    // Check quota
    if (smtpAccount.daily_sent >= smtpAccount.daily_quota) {
      return Response.json({ error: 'Daily quota exceeded for SMTP account' }, { status: 429 });
    }

    const status = scheduledAt ? 'scheduled' : 'pending';

    const result = await sql`
      INSERT INTO messages (
        organization_id, user_id, smtp_account_id, message_type,
        recipients, subject, body_text, body_html, status, scheduled_at
      ) VALUES (
        ${auth.user.organization_id}, ${auth.user.id}, ${smtpAccountId}, ${messageType},
        ${JSON.stringify(recipients)}, ${subject}, ${bodyText}, ${bodyHtml}, 
        ${status}, ${scheduledAt ? new Date(scheduledAt) : null}
      ) RETURNING id, status, created_at
    `;

    await logAudit(auth.user.organization_id, auth.user.id, 'create', 'message', result[0].id, {
      recipients: recipients.length,
      messageType,
      scheduled: !!scheduledAt
    });

    // If not scheduled, trigger immediate sending (in real app, use queue)
    if (!scheduledAt) {
      // TODO: Add to queue for processing
      console.log('Message queued for sending:', result[0].id);
    }

    return Response.json({
      id: result[0].id,
      status: result[0].status,
      message: scheduledAt ? 'Message scheduled successfully' : 'Message queued for sending'
    });

  } catch (error) {
    console.error('Send message error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}