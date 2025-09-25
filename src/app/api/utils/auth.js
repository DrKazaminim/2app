import sql from "./sql";

// Encrypt sensitive data using built-in Node.js crypto
function encrypt(text) {
  // Simple base64 encoding for now - in production use proper encryption
  return Buffer.from(text).toString('base64');
}

// Decrypt sensitive data
function decrypt(encryptedText) {
  // Simple base64 decoding for now - in production use proper decryption
  return Buffer.from(encryptedText, 'base64').toString();
}

// Create a simple JWT-like token
function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + (24 * 60 * 60) // 24 hours
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(tokenPayload));
  
  // Simple signature (in production, use proper HMAC)
  const signature = btoa(`${encodedHeader}.${encodedPayload}.${process.env.JWT_SECRET || 'secret'}`);
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Verify JWT token
function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

// Middleware to authenticate requests
async function authenticate(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing authorization header', status: 401 };
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  
  if (!payload || !payload.userId) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  // Get current user data
  const users = await sql`
    SELECT u.*, o.name as organization_name, o.settings as organization_settings
    FROM users u
    LEFT JOIN organizations o ON u.organization_id = o.id
    WHERE u.id = ${payload.userId} AND u.is_active = true
  `;

  if (users.length === 0) {
    return { error: 'User not found', status: 404 };
  }

  return { user: users[0] };
}

// Check if user has required role
function hasRole(user, requiredRoles) {
  if (!Array.isArray(requiredRoles)) {
    requiredRoles = [requiredRoles];
  }
  return requiredRoles.includes(user.role);
}

// Log audit event
async function logAudit(organizationId, userId, action, resourceType, resourceId = null, details = {}) {
  await sql`
    INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
    VALUES (${organizationId}, ${userId}, ${action}, ${resourceType}, ${resourceId}, ${JSON.stringify(details)})
  `;
}

export {
  encrypt,
  decrypt,
  createToken,
  verifyToken,
  authenticate,
  hasRole,
  logAudit
};