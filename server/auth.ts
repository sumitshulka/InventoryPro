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

async function hashPassword(password: string): Promise<string> {
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
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security, don't reveal if email exists or not
        return res.status(200).json({ 
          message: "If an account with this email exists, you will receive a password reset link." 
        });
      }

      // Generate reset token
      const resetToken = randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token in user record
      await storage.updateUser(user.id, {
        resetToken,
        resetTokenExpiry: resetTokenExpiry.toISOString()
      });

      // Get email service and send reset email
      let emailService = getEmailService();
      
      if (!emailService) {
        // Initialize email service with current settings
        const emailSettings = await storage.getEmailSettings();
        if (emailSettings && emailSettings.isActive) {
          emailService = initializeEmailService(emailSettings);
        }
      }

      if (emailService) {
        // Generate proper reset URL for Replit hosting
        const host = req.get('host');
        const replitDomain = process.env.REPLIT_DOMAINS;
        
        let baseUrl;
        if (replitDomain) {
          // Use Replit domain if available
          baseUrl = `https://${replitDomain}`;
        } else if (host?.includes('.replit.dev') || host?.includes('.replit.app') || host?.includes('.repl.co')) {
          // Use host if it's a Replit domain
          baseUrl = `https://${host}`;
        } else {
          // Fallback to request protocol and host
          baseUrl = `${req.protocol}://${host}`;
        }
        
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
        
        const emailSent = await emailService.sendEmail({
          to: user.email,
          subject: 'Password Reset Request',
          html: `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your inventory management account.</p>
            <p>Click the link below to reset your password:</p>
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
          `,
          text: `Password Reset Request
          
You requested a password reset for your inventory management account.
          
Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.
If you didn't request this reset, please ignore this email.`
        });

        if (!emailSent) {
          console.error("Failed to send password reset email");
        }
      } else {
        console.error("Email service not configured");
      }

      res.status(200).json({ 
        message: "If an account with this email exists, you will receive a password reset link." 
      });
    } catch (error: any) {
      console.error("Forgot password error:", error);
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

// Export hash function for external use
export { hashPassword };
