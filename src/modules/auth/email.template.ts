import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Lerniqo transactional email shell — aligned with vitrine maquettes
 * (`docs/maquettes/source/Email-*.dc.html`): navy #0061A4, pill CTA, light footer.
 *
 * Table + inline styles for Outlook; logo as CID attachment.
 */

const NAVY = '#0061A4';
const INK = '#1A1C1E';
const MUTED = '#43474E';
const FOOT = '#5C6169';
const PAGE_BG = '#EEF1F6';
const CARD_BORDER = '#DFE2EB';

export interface EmailContent {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  /** Key/value rows (MotDePasseModifie, NouveauCentre, CodeActive). */
  rows?: { label: string; value: string }[];
  code?: { label: string; value: string };
  action?: { label: string; url: string };
  notice?: string;
  /** Override default footer line (maquette `foot`). */
  footer?: string;
  text: string;
}

export function readLerniqoLogo(): Buffer {
  return readFileSync(join(__dirname, '..', '..', '..', 'public', 'logo.png'));
}

export const LERNIQO_LOGO_ATTACHMENT = {
  filename: 'lerniqo-logo.png',
  contentId: 'lerniqo-logo',
};

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const DEFAULT_FOOTER =
  'Sie erhalten diese E-Mail aufgrund einer Aktion auf lerniqo.tech.';

export function renderLerniqoEmail(content: EmailContent): string {
  const paragraphs = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${MUTED};">${p}</p>`,
    )
    .join('\n');

  const rowsBlock =
    content.rows && content.rows.length > 0
      ? `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 18px;border:1px solid ${CARD_BORDER};border-radius:12px;overflow:hidden;">
                  ${content.rows
                    .map(
                      (row, index) => `
                  <tr>
                    <td style="padding:12px 16px;font-size:14px;line-height:1.5;color:${FOOT};border-top:${index === 0 ? '0' : `1px solid ${CARD_BORDER}`};width:40%;">${escapeHtml(row.label)}</td>
                    <td style="padding:12px 16px;font-size:14px;line-height:1.5;color:${INK};font-weight:700;border-top:${index === 0 ? '0' : `1px solid ${CARD_BORDER}`};">${escapeHtml(row.value)}</td>
                  </tr>`,
                    )
                    .join('')}
                </table>`
      : '';

  const codeBlock = content.code
    ? `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#F7F9FC;border:1px solid ${CARD_BORDER};border-radius:14px;margin:0 0 18px;">
                  <tr>
                    <td align="center" style="padding:24px 16px;">
                      <p style="margin:0 0 12px;color:${INK};font-size:15px;line-height:1.4;font-weight:700;">${escapeHtml(content.code.label)}</p>
                      <p style="margin:0;color:${NAVY};font-family:'Courier New',Courier,monospace;font-size:38px;line-height:1.2;font-weight:800;letter-spacing:8px;">${escapeHtml(content.code.value)}</p>
                    </td>
                  </tr>
                </table>`
    : '';

  const actionBlock = content.action
    ? `
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:4px 0 20px;">
                  <tr>
                    <td align="center" bgcolor="${NAVY}" style="border-radius:999px;">
                      <a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:999px;">${escapeHtml(content.action.label)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:${FOOT};word-break:break-all;">
                  ${escapeHtml(content.action.url)}
                </p>`
    : '';

  const noticeBlock = content.notice
    ? `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#FBEBDD;border:1px solid #E0A266;border-radius:10px;">
                  <tr>
                    <td style="padding:16px;color:#6B3A0C;font-size:14px;line-height:1.6;">${content.notice}</td>
                  </tr>
                </table>`
    : '';

  const footerLine = content.footer ?? DEFAULT_FOOTER;

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light only">
    <title>${escapeHtml(content.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(content.preheader)}</div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:${PAGE_BG};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${CARD_BORDER};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:22px 32px;border-bottom:1px solid ${PAGE_BG};">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px;">
                      <img src="cid:lerniqo-logo" width="30" height="30" alt="Lerniqo" style="display:block;width:30px;height:30px;border:0;outline:none;">
                    </td>
                    <td style="vertical-align:middle;font-size:19px;font-weight:800;color:${NAVY};">Lerniqo</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 18px;color:${INK};font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.01em;">${escapeHtml(content.heading)}</h1>
${paragraphs}
${rowsBlock}
${codeBlock}
${noticeBlock}
${actionBlock}
              </td>
            </tr>

            <tr>
              <td style="padding:22px 32px;background-color:#F7F9FC;border-top:1px solid ${PAGE_BG};color:${FOOT};font-size:12px;line-height:1.6;">
                ${escapeHtml(footerLine)}<br>
                KOM GROUPE · Matoua, Kamerun · <a href="mailto:contact@lerniqo.tech" style="color:${NAVY};">contact@lerniqo.tech</a> · WhatsApp +49 157 34177259
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
