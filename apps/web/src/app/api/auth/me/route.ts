import { withAuth } from "@/server/auth";
import { json } from "@/server/errors";

export const GET = withAuth(async (_req, { user }) => json({ user }));
