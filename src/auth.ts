import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";

export const EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "seecs.edu.pk";
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const isAllowedEmail = (email: string) => email.toLowerCase().endsWith(`@${EMAIL_DOMAIN}`);

// Every allowed sign-in gets a row; new people stay "pending" until an admin
// approves them. Emails in ADMIN_EMAILS are approved admins from the start.
async function upsertUser(email: string, name: string, image?: string | null) {
  const db = await getDb();
  const lower = email.toLowerCase();
  const isAdmin = adminEmails.includes(lower);
  const [existing] = await db.select().from(t.users).where(eq(t.users.email, lower));
  if (existing) {
    await db
      .update(t.users)
      .set({
        name: existing.name || name,
        image: image ?? existing.image,
        ...(isAdmin ? { role: "admin" as const, status: "active" as const } : {}),
      })
      .where(eq(t.users.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(t.users)
    .values({
      email: lower,
      name,
      image,
      role: isAdmin ? "admin" : "member",
      status: isAdmin ? "active" : "pending",
    })
    .returning({ id: t.users.id });
  return row.id;
}

const providers: NextAuthConfig["providers"] = [
  Google({ authorization: { params: { hd: EMAIL_DOMAIN, prompt: "select_account" } } }),
];

// Local testing without Google credentials: DEV_LOGIN=1 enables an
// email-only login. Never set it in production.
if (process.env.DEV_LOGIN === "1") {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: { label: "Email" } },
      authorize: async (c) => {
        const email = String(c?.email ?? "").toLowerCase();
        return isAllowedEmail(email) ? { email, name: email.split("@")[0] } : null;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user }) {
      return !!user.email && isAllowedEmail(user.email);
    },
    async jwt({ token, user }) {
      if (user?.email) token.uid = await upsertUser(user.email, user.name ?? user.email, user.image);
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
