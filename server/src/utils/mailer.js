/**
 * Email delivery is not used in this project (no email service is configured).
 * These helpers only log what would have been sent, so callers keep working.
 * Never throws: email must not break an API call.
 */
export async function sendEmail({ to, subject }) {
  if (!to) return false;
  console.log(`[Mailer] Email not configured; skipped email to ${to}: ${subject}`);
  return false;
}

export async function sendBulkEmail(recipients, { subject, text }, limit = 100) {
  const list = [...new Set(recipients.filter(Boolean))].slice(0, limit);
  const results = await Promise.all(list.map((to) => sendEmail({ to, subject, text })));
  return { attempted: list.length, sent: results.filter(Boolean).length };
}
