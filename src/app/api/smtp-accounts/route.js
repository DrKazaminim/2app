import sql from "@/app/api/utils/sql";
import { authenticate, encrypt, decrypt, logAudit } from "@/app/api/utils/auth";

export async function POST(request) {
  try {
    const auth = await authenticate(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { name, host, port, username, password, useTls, useSsl, dailyQuota, monthlyQuota } = await request.json();

    if (!name || !host || !username || !password) {
      return Response.json({ error: 'Required fields: name, host, username, password' }, { status: 400 });
    }

    const encryptedPassword = encrypt(password);

    const result = await sql`
      INSERT INTO smtp_accounts (
        organization_id, user_id, name, host, port, username, password_encrypted,
        use_tls, use_ssl, daily_quota, monthly_quota
      ) VALUES (
        ${auth.user.organization_id}, ${auth.user.id}, ${name}, ${host}, 
        ${port || 587}, ${username}, ${encryptedPassword},
        ${useTls !== false}, ${useSsl || false}, 
        ${dailyQuota || 1000}, ${monthlyQuota || 30000}
      ) RETURNING id, name, host, port, username, use_tls, use_ssl, daily_quota, monthly_quota, created_at
    `;

    await logAudit(auth.user.organization_id, auth.user.id, 'create', 'smtp_account', result[0].id, {
      name, host, username
    });

    return Response.json(result[0]);

  } catch (error) {
    console.error('Create SMTP account error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const auth = await authenticate(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const accounts = await sql`
      SELECT id, name, host, port, username, use_tls, use_ssl, is_active,
             daily_quota, monthly_quota, daily_sent, monthly_sent, last_reset_date,
             created_at, updated_at
      FROM smtp_accounts 
      WHERE organization_id = ${auth.user.organization_id}
      ORDER BY created_at DESC
    `;

    return Response.json({ accounts });

  } catch (error) {
    console.error('List SMTP accounts error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}