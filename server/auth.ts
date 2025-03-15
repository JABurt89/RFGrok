import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  console.log("[Auth] Starting authentication setup...");

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Allow cookies in cross-site requests
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/",
      httpOnly: true
    }
  };

  console.log("[Auth] Session settings:", {
    secure: sessionSettings.cookie?.secure,
    sameSite: sessionSettings.cookie?.sameSite,
    maxAge: sessionSettings.cookie?.maxAge,
    path: sessionSettings.cookie?.path,
    httpOnly: sessionSettings.cookie?.httpOnly
  });

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          console.log("[Auth] Attempting login for email:", email);
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            console.log("[Auth] Login failed for email:", email);
            return done(null, false);
          }
          console.log("[Auth] Login successful for user:", user.id);
          return done(null, user);
        } catch (error) {
          console.error("[Auth] Login error:", error);
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    console.log("[Auth] Serializing user:", user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log("[Auth] Deserializing user:", id);
      const user = await storage.getUser(id);
      if (user) {
        console.log("[Auth] User deserialized successfully:", user.id);
      } else {
        console.log("[Auth] User not found during deserialization:", id);
      }
      done(null, user);
    } catch (error) {
      console.error("[Auth] Deserialization error:", error);
      done(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("[Auth] Login request received:", {
      body: req.body,
      cookies: req.cookies,
      session: req.session
    });

    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("[Auth] Login error:", err);
        return next(err);
      }
      if (!user) {
        console.log("[Auth] Login failed - invalid credentials");
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.login(user, (err) => {
        if (err) {
          console.error("[Auth] Login error:", err);
          return next(err);
        }
        console.log("[Auth] Login successful, user:", user.id);
        console.log("[Auth] Session after login:", {
          id: req.sessionID,
          cookie: req.session.cookie,
          passport: req.session.passport
        });
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("[Auth] Registration attempt for email:", req.body.email);
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        console.log("[Auth] Registration failed - email exists:", req.body.email);
        return res.status(400).json({ error: "Email already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      console.log("[Auth] User registered successfully:", user.id);
      req.login(user, (err) => {
        if (err) {
          console.error("[Auth] Login after registration failed:", err);
          return next(err);
        }
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("[Auth] Registration error:", error);
      next(error);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    console.log("[Auth] Logout request for user:", req.user?.id);
    console.log("[Auth] Session before logout:", {
      id: req.sessionID,
      cookie: req.session.cookie,
      passport: req.session.passport
    });

    req.logout((err) => {
      if (err) {
        console.error("[Auth] Logout error:", err);
        return next(err);
      }
      console.log("[Auth] Logout successful");
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    console.log("[Auth] User check - authenticated:", req.isAuthenticated(), "user:", req.user?.id);
    console.log("[Auth] Current session:", {
      id: req.sessionID,
      cookie: req.session.cookie,
      passport: req.session.passport
    });

    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  console.log("[Auth] Authentication setup complete");
}