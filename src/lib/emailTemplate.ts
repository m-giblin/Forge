/** Generates a rich HTML assignment notification email. Table-based layout for email client compatibility. */

export type OpenTicket = {
  key: string;      // e.g. "WEB-5"
  title: string;
  status: string;
  priority: string;
};

export type EmailData = {
  tenantDisplayName: string;
  tenantPrimaryColor: string;   // hex, e.g. "#111827"
  assigneeName: string;
  assigneeEmail: string;
  actorLabel: string;
  issueKey: string;
  issueTitle: string;
  issuePriority: string;
  issueStatus: string;
  issueUrl: string;
  openTickets: OpenTicket[];    // all open tickets for this user (includes the new one)
  unassignedCount: number;
  boardUrl: string;
};

function priorityColor(p: string): { bg: string; text: string; dot: string } {
  switch (p.toLowerCase()) {
    case "urgent": return { bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" };
    case "high":   return { bg: "#fff7ed", text: "#9a3412", dot: "#f97316" };
    case "medium": return { bg: "#eff6ff", text: "#1e40af", dot: "#3b82f6" };
    default:       return { bg: "#f9fafb", text: "#374151", dot: "#9ca3af" };
  }
}

function statusBadge(s: string): { label: string; bg: string; text: string } {
  switch (s.toLowerCase()) {
    case "in_progress": return { label: "In Progress", bg: "#dbeafe", text: "#1e40af" };
    case "in_review":   return { label: "In Review",   bg: "#ede9fe", text: "#5b21b6" };
    case "todo":        return { label: "To Do",       bg: "#f3f4f6", text: "#374151" };
    case "done":        return { label: "Done",        bg: "#d1fae5", text: "#065f46" };
    default:            return { label: s,             bg: "#f3f4f6", text: "#6b7280" };
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function buildAssignmentEmail(d: EmailData): { subject: string; html: string } {
  const primary = d.tenantPrimaryColor || "#111827";
  const pr = priorityColor(d.issuePriority);
  const st = statusBadge(d.issueStatus);

  const ticketRows = d.openTickets
    .map((t) => {
      const ts = statusBadge(t.status);
      const tp = priorityColor(t.priority);
      const isNew = t.key === d.issueKey;
      return `
        <tr style="border-bottom:1px solid #f3f4f6;${isNew ? "background:#f0fdf4;" : ""}">
          <td style="padding:10px 12px;font-family:monospace;font-size:13px;font-weight:600;color:${primary};white-space:nowrap;">
            ${t.key}${isNew ? ' <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;color:#16a34a;background:#dcfce7;padding:1px 5px;border-radius:3px;vertical-align:middle;">NEW</span>' : ""}
          </td>
          <td style="padding:10px 12px;font-size:13px;color:#1f2937;max-width:260px;">
            ${truncate(t.title, 60)}
          </td>
          <td style="padding:10px 12px;white-space:nowrap;">
            <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${ts.bg};color:${ts.text};">
              ${ts.label}
            </span>
          </td>
          <td style="padding:10px 12px;white-space:nowrap;">
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:${tp.text};">
              <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${tp.dot};"></span>
              ${cap(t.priority)}
            </span>
          </td>
        </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Assigned: ${d.issueKey}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:${primary};border-radius:12px 12px 0 0;padding:20px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="font-size:18px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">
              FORGE
            </span>
          </td>
          <td align="right">
            <span style="font-size:13px;font-weight:500;color:rgba(255,255,255,0.75);">
              ${d.tenantDisplayName}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- HERO -->
  <tr>
    <td style="background:#ffffff;padding:28px 28px 20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">
        New assignment
      </p>
      <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
        Hi ${d.assigneeName},<br/>
        <span style="font-weight:400;color:#374151;">you've been assigned a ticket.</span>
      </p>

      <!-- Issue card -->
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border:2px solid ${primary};border-radius:10px;overflow:hidden;">
        <tr>
          <td style="background:${primary};padding:10px 16px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:monospace;font-size:13px;font-weight:700;color:#ffffff;padding-right:12px;">
                  ${d.issueKey}
                </td>
                <td>
                  <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:${pr.bg};color:${pr.text};">
                    ${cap(d.issuePriority)}
                  </span>
                </td>
                <td style="padding-left:8px;">
                  <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${st.bg};color:${st.text};">
                    ${st.label}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 16px 8px;">
            <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#111827;line-height:1.4;">
              ${d.issueTitle}
            </p>
            <p style="margin:0;font-size:13px;color:#6b7280;">
              Assigned by <strong style="color:#374151;">${d.actorLabel}</strong>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px 16px;">
            <a href="${d.issueUrl}"
               style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 20px;border-radius:7px;letter-spacing:0.02em;">
              View ticket &rarr;
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  ${d.openTickets.length > 0 ? `
  <!-- OPEN TICKETS -->
  <tr>
    <td style="background:#ffffff;padding:0 28px 24px;border-top:1px solid #f3f4f6;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">
        Your open tickets &nbsp;<span style="background:#f3f4f6;color:#374151;padding:1px 7px;border-radius:12px;font-size:11px;">${d.openTickets.length}</span>
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Key</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Title</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Priority</th>
          </tr>
        </thead>
        <tbody>${ticketRows}</tbody>
      </table>
    </td>
  </tr>` : ""}

  ${d.unassignedCount > 0 ? `
  <!-- UNASSIGNED QUEUE -->
  <tr>
    <td style="background:#ffffff;padding:0 28px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#92400e;">
              &#9888;&#65039; ${d.unassignedCount} unassigned ticket${d.unassignedCount !== 1 ? "s" : ""} in the queue
            </p>
            <p style="margin:0 0 12px;font-size:12px;color:#a16207;">
              These tickets are waiting to be picked up by someone on your team.
            </p>
            <a href="${d.boardUrl}"
               style="display:inline-block;background:#b45309;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;padding:8px 16px;border-radius:6px;">
              View unassigned &rarr;
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>` : ""}

  <!-- FOOTER -->
  <tr>
    <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:20px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#374151;">
              Forge &mdash; Issue tracking for ${d.tenantDisplayName}
            </p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              You received this because a ticket was assigned to ${d.assigneeEmail}.
            </p>
          </td>
          <td align="right" style="vertical-align:bottom;">
            <span style="font-size:10px;font-weight:800;letter-spacing:0.05em;color:#d1d5db;">FORGE</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body>
</html>`;

  return {
    subject: `[${d.issueKey}] Assigned to you: ${d.issueTitle}`,
    html,
  };
}

// ---------------------------------------------------------------------------
// Merge notification — sent to tenant admins when a PR linked to a Forge
// issue merges. Table-based layout, same conventions as the assignment email
// above (tenant branding color, Forge footer).
// ---------------------------------------------------------------------------

export type MergedIssue = {
  key: string;
  title: string;
  url: string;
  autoClosed: boolean;
};

export type MergeEmailData = {
  tenantDisplayName: string;
  tenantPrimaryColor: string;
  repoFullName: string;
  prTitle: string;
  prNumber: number;
  prUrl: string;
  mergedBy: string;
  issues: MergedIssue[];
};

export function buildMergeNotificationEmail(d: MergeEmailData): { subject: string; html: string } {
  const primary = d.tenantPrimaryColor || "#111827";
  const closedCount = d.issues.filter((i) => i.autoClosed).length;
  const keysLabel = d.issues.map((i) => i.key).join(", ");

  const issueRows = d.issues
    .map(
      (i) => `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:12px;font-family:monospace;font-size:13px;font-weight:600;color:${primary};white-space:nowrap;vertical-align:top;">
            <a href="${i.url}" style="color:${primary};text-decoration:none;">${i.key}</a>
          </td>
          <td style="padding:12px;font-size:13px;color:#1f2937;vertical-align:top;">
            ${truncate(i.title, 80)}
          </td>
          <td style="padding:12px;white-space:nowrap;vertical-align:top;">
            ${i.autoClosed
              ? `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:#d1fae5;color:#065f46;">✓ Closed</span>`
              : `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#f3f4f6;color:#6b7280;">Linked</span>`
            }
          </td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Merged: ${d.prTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:${primary};border-radius:12px 12px 0 0;padding:20px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="font-size:18px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">
              FORGE
            </span>
          </td>
          <td align="right">
            <span style="font-size:13px;font-weight:500;color:rgba(255,255,255,0.75);">
              ${d.tenantDisplayName}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- HERO -->
  <tr>
    <td style="background:#ffffff;padding:28px 28px 20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7a4fa0;">
        🔀 Pull request merged
      </p>
      <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">
        ${truncate(d.prTitle, 90)}
      </p>

      <!-- PR card -->
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:14px 16px;background:#faf7fc;">
            <p style="margin:0 0 2px;font-size:13px;color:#374151;">
              <span style="font-family:monospace;font-weight:600;">${d.repoFullName}</span> #${d.prNumber}
            </p>
            <p style="margin:0;font-size:12px;color:#6b7280;">
              Merged by <strong style="color:#374151;">${d.mergedBy}</strong>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px 16px;">
            <a href="${d.prUrl}"
               style="display:inline-block;background:#ffffff;border:1px solid ${primary};color:${primary};text-decoration:none;font-size:13px;font-weight:700;padding:9px 18px;border-radius:7px;">
              View on GitHub &rarr;
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- LINKED ISSUES -->
  <tr>
    <td style="background:#ffffff;padding:0 28px 28px;border-top:1px solid #f3f4f6;">
      <p style="margin:20px 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">
        Linked issue${d.issues.length !== 1 ? "s" : ""} &nbsp;<span style="background:#f3f4f6;color:#374151;padding:1px 7px;border-radius:12px;font-size:11px;">${d.issues.length}</span>
        ${closedCount > 0 ? `&nbsp;&middot;&nbsp;<span style="color:#059669;">${closedCount} auto-closed</span>` : ""}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Key</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Title</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
          </tr>
        </thead>
        <tbody>${issueRows}</tbody>
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:20px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#374151;">
              Forge &mdash; Issue tracking for ${d.tenantDisplayName}
            </p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              You received this as a workspace admin — a merged PR touched ${d.issues.length === 1 ? "an issue" : "issues"} this workspace tracks.
            </p>
          </td>
          <td align="right" style="vertical-align:bottom;">
            <span style="font-size:10px;font-weight:800;letter-spacing:0.05em;color:#d1d5db;">FORGE</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body>
</html>`;

  return {
    subject: `🔀 Merged: ${truncate(d.prTitle, 60)} (${keysLabel})`,
    html,
  };
}
