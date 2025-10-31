import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { createHash, randomBytes } from "crypto";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { getEmailService, initializeEmailService } from "./email-service";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hashedPassword = createHash('md5').update(password + salt).digest('hex');
  return `${hashedPassword}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  // Check if stored password has the expected format (MD5 hash + salt)
  if (!stored || !stored.includes('.')) {
    // For legacy plain text passwords, do direct comparison (backward compatibility)
    return supplied === stored;
  }
  
  const [hashedPassword, salt] = stored.split(".");
  if (!hashedPassword || !salt) {
    return false;
  }
  
  try {
    const suppliedHash = createHash('md5').update(supplied + salt).digest('hex');
    return suppliedHash === hashedPassword;
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const SESSION_SECRET = process.env.SESSION_SECRET || "inventory-management-secret";
  
  const sessionSettings: session.SessionOptions = {
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax',
      path: '/'
    },
    name: 'inventory.sid' // Specific name helps with identification
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Try to find user by username first
        let user = await storage.getUserByUsername(username);
        
        // If not found by username, try to find by email
        if (!user) {
          user = await storage.getUserByEmail(username);
        }
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        } else if (!user.isActive) {
          return done(null, false, { message: "Account has been deactivated. Please contact your administrator." });
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Login route
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message?: string }) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info.message || "Invalid username or password" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        console.log("User logged in successfully:", user.id, user.username);
        console.log("Session after login:", req.session);
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return next(err);
          }
          return res.status(200).json(user);
        });
      });
    })(req, res, next);
  });

  // Registration route
  app.post("/api/register", async (req, res, next) => {
    try {
      // Use zod to validate the user data
      const registerSchema = insertUserSchema.extend({
        confirmPassword: z.string()
      }).refine(data => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"]
      });
      
      const userData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create the user with a default role of "user"
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        role: "user" // Force regular user role on registration
      });
      
      // Omit the password from the response
      const { password, ...userWithoutPassword } = user;
      
      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        console.log("User registered successfully:", user.id, user.username);
        console.log("Session after registration:", req.session);
        req.session.save((err) => {
          if (err) {
            console.error("Session save error after registration:", err);
            return next(err);
          }
          return res.status(201).json(userWithoutPassword);
        });
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  // Logout route
  app.post("/api/logout", (req, res, next) => {
    console.log("Logging out user:", req.user?.id, req.user?.username);
    req.logout((err) => {
      if (err) return next(err);
      
      // Destroy the session completely
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return next(err);
        }
        
        // Clear the cookie on the client
        res.clearCookie('inventory.sid', { path: '/' });
        
        res.status(200).json({ message: "Logged out successfully" });
      });
    });
  });

  // Get current user route
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("User not authenticated:", req.session);
      return res.status(401).json({ message: "Not authenticated" });
    }
    console.log("User authenticated:", req.user);
    res.json(req.user);
  });

  // Forgot password route
app.post("/api/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    
    console.log("=== FORGOT PASSWORD REQUEST ===");
    console.log("Request email:", email);
    console.log("Request body:", req.body);
    
    if (!email) {
      console.log("❌ No email provided in request");
      return res.status(400).json({ message: "Email is required" });
    }

    // Find user by email
    console.log("🔍 Searching for user by email:", email);
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      console.log("❌ No user found with email:", email);
      // For security, don't reveal if email exists or not
      return res.status(200).json({ 
        message: "If an account with this email exists, you will receive a password reset link." 
      });
    }

    console.log("✅ User found:", { id: user.id, username: user.username, email: user.email });

    // Generate reset token
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    console.log("🔐 Generated reset token:", resetToken.substring(0, 10) + "...");
    console.log("⏰ Token expiry:", resetTokenExpiry);

    // Store reset token in user record
    console.log("💾 Storing reset token in user record...");
    await storage.updateUser(user.id, {
      resetToken,
      resetTokenExpiry: resetTokenExpiry.toISOString()
    });
    console.log("✅ Reset token stored successfully");

    // Get email service and send reset email
    let emailService = getEmailService();
    console.log("📧 Email service status:", emailService ? "Available" : "Not available");
    
    if (!emailService) {
      console.log("🔄 Email service not found, initializing...");
      const emailSettings = await storage.getEmailSettings();
      console.log("📋 Email settings from storage:", emailSettings);
      
      if (emailSettings && emailSettings.isActive) {
        console.log("✅ Email settings are active, initializing service...");
        emailService = initializeEmailService(emailSettings);
        console.log("📧 Email service initialized:", emailService ? "Success" : "Failed");
      } else {
        console.log("❌ Email settings are inactive or not found");
        console.log("Settings active?:", emailSettings?.isActive);
        console.log("Settings exists?:", !!emailSettings);
      }
    }

    if (emailService) {
      console.log("🎯 Email service is available, generating reset URL...");
      
      // Generate proper reset URL - prioritize actual request host for custom domains
      const host = req.get('host');
      const protocol = req.protocol;
      const replitDomain = process.env.REPLIT_DOMAINS;
      
      console.log("🌐 Host:", host);
      console.log("🔗 Protocol:", protocol);
      console.log("🏠 Replit domain:", replitDomain);
      
      let baseUrl;
      if (host) {
        // Always prioritize the actual request host (works for custom domains)
        // Use HTTPS for production domains, follow request protocol otherwise
        const useHttps = host.includes('.sumits.me') || 
                        host.includes('.replit.dev') || 
                        host.includes('.replit.app') || 
                        host.includes('.repl.co') ||
                        protocol === 'https';
        
        console.log("🔒 Use HTTPS:", useHttps);
        baseUrl = `${useHttps ? 'https' : protocol}://${host}`;
      } else if (replitDomain) {
        // Fallback to Replit domain if host is not available
        console.log("🔄 Using Replit domain fallback");
        baseUrl = `https://${replitDomain}`;
      } else {
        // Final fallback
        console.log("🔄 Using localhost fallback");
        baseUrl = `${protocol}://${host || 'localhost:5000'}`;
      }
      
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
      
      console.log("📍 Base URL:", baseUrl);
      console.log("🔗 Reset URL:", resetUrl);
      console.log("📤 Attempting to send reset email to:", user.email);
      
      // Generate random subject line with timestamp
      const subjectOptions = [
        'You requested for a change in password',
        'Reset information for your password',
        'Password change request received',
        'Your password reset link is ready',
        'Security alert: Password reset requested',
        'Action required: Reset your account password',
        'Password recovery assistance',
        'Account security: Password reset link'
      ];
      
      const randomSubject = subjectOptions[Math.floor(Math.random() * subjectOptions.length)];
      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
      const subjectWithTimestamp = `${randomSubject} - ${timestamp}`;
      
      console.log("✉️ Email subject:", subjectWithTimestamp);
      
      console.log("🚀 Sending email via email service...");
      const emailSent = await emailService.sendEmail({
        to: user.email,
        subject: subjectWithTimestamp,
        html: `
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your inventory management account.</p>
          <p>Click the button below to reset your password:</p>
          <p style="margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </p>
          <p><strong>If the button doesn't work, copy and paste this link into your browser:</strong></p>
          <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 14px;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
        `,
        text: `Password Reset Request
          
You requested a password reset for your inventory management account.
          
Copy and paste this link into your browser to reset your password:
${resetUrl}

This link will expire in 1 hour.
If you didn't request this reset, please ignore this email.`
      });

      console.log(`📨 Email send result: ${emailSent}`);
      if (!emailSent) {
        console.error("❌ Failed to send password reset email");
      } else {
        console.log("✅ Password reset email sent successfully");
      }
    } else {
      console.error("❌ Email service not configured - cannot send reset email");
      console.log("💡 Please configure email settings using /api/email-settings endpoint");
    }

    console.log("✅ Forgot password process completed");
    res.status(200).json({ 
      message: "If an account with this email exists, you will receive a password reset link." 
    });
    
  } catch (error: any) {
    console.error("❌ Forgot password error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ message: "Failed to process password reset request" });
  }
});

  // Reset password route
  app.post("/api/reset-password", async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Find user by reset token
      const allUsers = await storage.getAllUsers();
      const user = allUsers.find(u => u.resetToken === token);
      
      if (!user || !user.resetTokenExpiry) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token is expired
      const tokenExpiry = new Date(user.resetTokenExpiry);
      if (tokenExpiry < new Date()) {
        return res.status(400).json({ message: "Reset token has expired" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password and clear reset token
      await storage.updateUser(user.id, {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      });

      res.status(200).json({ message: "Password successfully reset" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Password migration route - one-time use to hash existing plain text passwords
  app.post("/api/migrate-passwords", async (req, res) => {
    try {
      const { adminKey } = req.body;
      
      // Security check - require admin key
      if (adminKey !== "MIGRATE_PASSWORDS_2024") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const users = await storage.getAllUsers();
      let migratedCount = 0;
      
      for (const user of users) {
        // Check if password is already hashed (contains a dot)
        if (!user.password.includes('.')) {
          console.log(`Migrating password for user: ${user.username}`);
          const hashedPassword = await hashPassword(user.password);
          await storage.updateUser(user.id, { password: hashedPassword });
          migratedCount++;
        }
      }
      
      res.json({ 
        message: `Password migration completed. ${migratedCount} passwords updated.`,
        migratedCount 
      });
    } catch (error: any) {
      console.error("Password migration error:", error);
      res.status(500).json({ message: "Migration failed", error: error.message });
    }
  });
}

// hashPassword is already exported above
