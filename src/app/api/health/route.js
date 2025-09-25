import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    // Test database connection
    const result = await sql`SELECT 1 as healthy`;
    
    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      database: result.length > 0 ? 'connected' : 'disconnected',
      version: '1.0.0'
    });

  } catch (error) {
    console.error('Health check error:', error);
    return Response.json({
      ok: false,
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    }, { status: 500 });
  }
}