import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * RBAC Access Matrix
 * Maps feature scopes to the roles that can access them.
 */
const ACCESS_MATRIX: Record<string, string[]> = {
  // Project management
  "project:create": ["architect_admin", "project_lead"],
  "project:view": ["architect_admin", "project_lead", "team_member", "client", "client_representative", "consultant"],
  "project:edit_facts": ["architect_admin", "project_lead", "team_member"],

  // Gates
  "gate:override": ["architect_admin"],
  "gate:view": ["architect_admin", "project_lead", "team_member", "client", "client_representative"],

  // Approvals
  "approval:request": ["architect_admin", "project_lead", "team_member"],
  "approval:review": ["architect_admin", "project_lead", "client", "client_representative", "approver"],

  // Consultants & procurement
  "consultant:invite": ["architect_admin", "project_lead"],
  "bidder:invite": ["architect_admin", "project_lead"],
  "tender:view": ["architect_admin", "project_lead", "team_member", "client", "consultant", "bidder"],
  "bid:submit": ["bidder"],

  // Execution
  "execution:submit": ["general_contractor", "trade_contractor"],
  "execution:review": ["architect_admin", "project_lead"],

  // Documents
  "document:manage": ["architect_admin", "project_lead", "team_member", "document_controller"],
  "document:view": ["architect_admin", "project_lead", "team_member", "client", "client_representative", "consultant", "reviewer"],

  // Reviews
  "review:manage": ["architect_admin", "project_lead", "reviewer"],
  "review:view": ["architect_admin", "project_lead", "team_member", "reviewer"],

  // Audit
  "audit:view": ["architect_admin", "project_lead"],
  "audit:export": ["architect_admin"],

  // Workspace
  "workspace:manage": ["architect_admin"],

  // Settings
  "settings:view": ["architect_admin", "project_lead"],
  "settings:manage": ["architect_admin"],

  // Invitations
  "invitation:manage": ["architect_admin", "project_lead"],
  "invitation:view": ["architect_admin", "project_lead", "team_member"],

  // Inbox
  "inbox:view": ["architect_admin", "project_lead", "team_member"],
  "inbox:manage": ["architect_admin", "project_lead"],
};

/**
 * Check if a role has access to a given scope.
 */
export function hasAccess(role: string, scope: string): boolean {
  const allowed = ACCESS_MATRIX[scope];
  if (!allowed) return true; // Unknown scope = allow (open by default for undefined scopes)
  return allowed.includes(role);
}

/**
 * Create a Fastify preHandler that enforces RBAC for a given scope.
 * Usage: { preHandler: requireAccess("gate:override") }
 */
export function requireAccess(scope: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    if (!hasAccess(request.auth.role, scope)) {
      return reply.status(403).send({
        error: "Forbidden",
        message: `Role '${request.auth.role}' does not have '${scope}' permission`,
      });
    }
  };
}
