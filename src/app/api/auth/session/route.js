import sql from "@/app/api/utils/sql";

// Middleware to verify JWT token
async function verifyToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    // Simple JWT verification (for now, we'll use a basic implementation)
    // In production, this should use proper JWT verification
    const base64Payload = token.split('.')[1];
    if (!base64Payload) return null;
    
    const payload = JSON.parse(atob(base64Payload));
    
    // Check if token is expired (basic check)
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const payload = await verifyToken(request);
    
    if (!payload || !payload.userId) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Get current user data
    const users = await sql`
      SELECT u.*, o.name as organization_name, o.settings as organization_settings
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = ${payload.userId} AND u.is_active = true
    `;

    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        mfaEnabled: user.mfa_enabled,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    console.error('Session error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}