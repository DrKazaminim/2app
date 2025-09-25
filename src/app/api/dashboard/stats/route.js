import sql from "@/app/api/utils/sql";
import { authenticate } from "@/app/api/utils/auth";

export async function GET(request) {
  try {
    const auth = await authenticate(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    // Get stats for the organization
    const stats = await sql.transaction([
      // Total messages for organization
      sql`
        SELECT COUNT(*) as count
        FROM messages 
        WHERE organization_id = ${auth.user.organization_id}
      `,
      // Messages sent today
      sql`
        SELECT COUNT(*) as count
        FROM messages 
        WHERE organization_id = ${auth.user.organization_id}
        AND DATE(created_at) = CURRENT_DATE
        AND status = 'sent'
      `,
      // Success rate calculation
      sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
          COUNT(*) as total_count
        FROM messages 
        WHERE organization_id = ${auth.user.organization_id}
        AND created_at >= NOW() - INTERVAL '30 days'
      `,
      // Active SMTP accounts
      sql`
        SELECT COUNT(*) as count
        FROM smtp_accounts 
        WHERE organization_id = ${auth.user.organization_id}
        AND is_active = true
      `,
    ]);

    const totalMessages = parseInt(stats[0][0]?.count || 0);
    const sentToday = parseInt(stats[1][0]?.count || 0);
    const successStats = stats[2][0];
    const activeAccounts = parseInt(stats[3][0]?.count || 0);

    const successRate =
      successStats?.total_count > 0
        ? successStats.sent_count / successStats.total_count
        : 0;

    return Response.json({
      totalMessages,
      sentToday,
      successRate,
      activeAccounts,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
