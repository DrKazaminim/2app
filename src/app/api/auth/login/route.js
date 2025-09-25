import sql from "@/app/api/utils/sql";
import * as argon2 from "argon2";
import { createToken, logAudit } from "@/app/api/utils/auth";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Find user by email
    const users = await sql`
      SELECT u.*, o.name as organization_name, o.settings as organization_settings
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE u.email = ${email.toLowerCase()} AND u.is_active = true
    `;

    if (users.length === 0) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await argon2.verify(user.password_hash, password);
    if (!isValidPassword) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Update last login
    await sql`
      UPDATE users 
      SET last_login = NOW(), updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // Create JWT token
    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    });

    // Log audit event
    await logAudit(user.organization_id, user.id, "login", "auth", null, {
      email: user.email,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        mfaEnabled: user.mfa_enabled,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
