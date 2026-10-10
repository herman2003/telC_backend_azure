import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  escapeHtml,
  LERNIQO_LOGO_ATTACHMENT,
  readLerniqoLogo,
  renderLerniqoEmail,
  type EmailContent,
} from './email.template';

/** Same fallback as `DEFAULT_SUPPORT_EMAIL` in center-support (avoid cycle). */
const TEAM_EMAIL_FALLBACK = 'ngeukeualain@gmail.com';

@Injectable()
export class EmailService {
  private readonly resend: Resend;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow<string>('RESEND_API_KEY'));
  }

  /**
   * Every transactional email leaves through here, so the branded shell, the
   * CID logo attachment and the plain-text alternative cannot be forgotten on
   * a new message — which is how five of the six ended up unbranded before.
   */
  private async send(
    to: string,
    content: EmailContent,
    replyTo?: string,
  ): Promise<void> {
    await this.resend.emails.send({
      from: this.config.getOrThrow<string>('EMAIL_FROM'),
      to,
      ...(replyTo ? { replyTo } : {}),
      subject: content.subject,
      html: renderLerniqoEmail(content),
      text: content.text,
      attachments: [{ ...LERNIQO_LOGO_ATTACHMENT, content: readLerniqoLogo() }],
    });
  }

  /**
   * Trailing slashes are stripped here rather than trusted to whoever edits
   * the environment. `https://www.lerniqo.tech/` would otherwise build
   * `...tech//verify-email`, which some routers answer with a 404 — and the
   * failure would only ever be visible in a real inbox.
   */
  private getVitrineUrl(): string {
    const configured =
      this.config.get<string>('VITRINE_URL') ||
      this.config.getOrThrow<string>('FRONTEND_URL');

    return configured.trim().replace(/\/+$/, '');
  }

  /** Same inbox as NouveauCentre / center support — no demo-specific env. */
  private getSupportEmail(): string {
    return (
      this.config.get<string>('SUPPORT_EMAIL')?.trim() || TEAM_EMAIL_FALLBACK
    );
  }

  /**
   * Both audiences verify on the same website page. The `type` parameter is
   * what tells that page which endpoint to call, so a center token is never
   * sent to the student verifier.
   */
  private verificationLink(rawToken: string, isCenter: boolean): string {
    const suffix = isCenter ? '&type=center' : '';
    return `${this.getVitrineUrl()}/verify-email?token=${rawToken}${suffix}`;
  }

  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    const link = this.verificationLink(rawToken, false);

    await this.send(to, {
      subject: 'Bestätige deine E-Mail-Adresse',
      preheader: 'Nur noch ein Schritt bis zu deinem Lerniqo-Konto.',
      heading: 'E-Mail-Adresse bestätigen',
      paragraphs: [
        'Willkommen bei Lerniqo.',
        'Bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren:',
      ],
      action: { label: 'E-Mail bestätigen', url: link },
      notice:
        'Wenn du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.',
      text: [
        'E-Mail-Adresse bestätigen',
        '',
        'Willkommen bei Lerniqo.',
        'Bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren:',
        link,
        '',
        'Wenn du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.',
      ].join('\n'),
    });
  }

  /**
   * Sent when someone registers with an address that already has an
   * unverified account.
   *
   * The HTTP response to `POST /auth/register` is deliberately identical for
   * new and existing addresses so it cannot be used to enumerate accounts.
   * That leaves a returning user with no explanation, which is what this email
   * is for — only the inbox owner sees it, so it can say more than the API can.
   *
   * It must not imply the password was changed. The stored credentials are
   * deliberately left untouched on this path (see `AuthService.register`), so
   * a user who no longer remembers their password is pointed at password reset
   * rather than being silently locked out.
   */
  async sendExistingAccountVerificationEmail(
    to: string,
    rawToken: string,
  ): Promise<void> {
    const link = this.verificationLink(rawToken, false);

    await this.send(to, {
      subject: 'Schließe die Einrichtung deines Kontos ab',
      preheader: 'Für diese Adresse gibt es bereits ein unbestätigtes Konto.',
      heading: 'Konto noch nicht bestätigt',
      paragraphs: [
        'Für diese E-Mail-Adresse wurde bereits ein Konto angelegt, das noch nicht bestätigt ist.',
        'Bestätige es mit diesem neuen Link:',
      ],
      action: { label: 'E-Mail bestätigen', url: link },
      notice:
        'Dein Passwort wurde nicht geändert. Wenn du es nicht mehr weißt, bestätige zuerst deine Adresse und nutze dann die Funktion &bdquo;Passwort vergessen&ldquo;. Wenn du kein Konto erstellen wolltest, kannst du diese E-Mail ignorieren &mdash; es hat sich nichts geändert.',
      text: [
        'Konto noch nicht bestätigt',
        '',
        'Für diese E-Mail-Adresse wurde bereits ein Konto angelegt, das noch nicht bestätigt ist.',
        'Bestätige es mit diesem neuen Link:',
        link,
        '',
        'Dein Passwort wurde nicht geändert.',
      ].join('\n'),
    });
  }

  /**
   * Maquette `Email-Confirmation` — sent on center register / resend.
   * `centerName` is interpolated into the body when known.
   */
  async sendCenterVerificationEmail(
    to: string,
    rawToken: string,
    centerName?: string,
  ): Promise<void> {
    const link = this.verificationLink(rawToken, true);
    const school = centerName?.trim();
    const body = school
      ? `Das Konto der ${school} ist fast bereit. Bestätigen Sie Ihre Adresse, um es zu aktivieren und Ihren 14-Tage-Test zu starten.`
      : 'Ihr Zentrumskonto ist fast bereit. Bestätigen Sie Ihre Adresse, um es zu aktivieren und Ihren 14-Tage-Test zu starten.';

    await this.send(to, {
      subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
      preheader: 'Willkommen bei Lerniqo — nur noch ein Klick.',
      heading: 'Willkommen bei Lerniqo!',
      paragraphs: [
        escapeHtml(body),
        'Dieser Link ist 24 Stunden gültig.',
        'Sie haben sich nicht registriert? Ignorieren Sie diese E-Mail einfach.',
      ],
      action: { label: 'E-Mail bestätigen', url: link },
      footer:
        'Sie erhalten diese E-Mail aufgrund einer Aktion auf lerniqo.tech.',
      text: [
        'Willkommen bei Lerniqo!',
        '',
        body,
        '',
        'E-Mail bestätigen:',
        link,
        '',
        'Dieser Link ist 24 Stunden gültig.',
        'Sie haben sich nicht registriert? Ignorieren Sie diese E-Mail einfach.',
      ].join('\n'),
    });
  }

  async sendExistingCenterVerificationEmail(
    to: string,
    rawToken: string,
    centerName?: string,
  ): Promise<void> {
    const link = this.verificationLink(rawToken, true);
    const school = centerName?.trim();

    await this.send(to, {
      subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
      preheader:
        'Für diese Adresse besteht bereits ein unbestätigtes Sprachschulkonto.',
      heading: 'Willkommen bei Lerniqo!',
      paragraphs: [
        school
          ? `Für diese Adresse besteht bereits ein unbestätigtes Konto (${escapeHtml(school)}). Bestätigen Sie es mit diesem neuen Link:`
          : 'Für diese Adresse besteht bereits ein unbestätigtes Sprachschulkonto. Bestätigen Sie es mit diesem neuen Link:',
        'Dieser Link ist 24 Stunden gültig.',
      ],
      action: { label: 'E-Mail bestätigen', url: link },
      notice:
        'Ihr Passwort und Ihre Sprachschuldaten wurden nicht geändert. Wenn Sie das Passwort nicht mehr kennen, bestätigen Sie zuerst Ihre E-Mail-Adresse und nutzen Sie dann &bdquo;Passwort vergessen&ldquo;.',
      footer:
        'Sie erhalten diese E-Mail aufgrund einer Aktion auf lerniqo.tech.',
      text: [
        'Willkommen bei Lerniqo!',
        '',
        'Für diese Adresse besteht bereits ein unbestätigtes Sprachschulkonto.',
        'Bestätigen Sie es mit diesem neuen Link:',
        link,
        '',
        'Ihr Passwort wurde nicht geändert.',
      ].join('\n'),
    });
  }

  /** Maquette `Email-CodeMotDePasse` — 6-digit code (TTL matches backend: 10 min). */
  async sendCenterPasswordResetEmail(
    to: string,
    rawCode: string,
  ): Promise<void> {
    await this.send(to, {
      subject: `Ihr Lerniqo-Code: ${rawCode}`,
      preheader: 'Ihr Code zum Zurücksetzen des Passworts.',
      heading: 'Ihr Code zum Zurücksetzen',
      paragraphs: [
        'Geben Sie diesen Code auf der Seite „Passwort vergessen“ ein, um ein neues Passwort zu wählen.',
        'Er läuft in 10 Minuten ab.',
        'Nichts angefordert? Ignorieren Sie diese E-Mail: Ihr Passwort bleibt unverändert.',
      ],
      code: { label: 'Ihr Code', value: rawCode },
      footer:
        'Sie erhalten diese E-Mail aufgrund einer Aktion auf lerniqo.tech.',
      text: [
        'Ihr Code zum Zurücksetzen',
        '',
        'Geben Sie diesen Code auf der Seite „Passwort vergessen“ ein.',
        '',
        `Ihr Code: ${rawCode}`,
        '',
        'Er läuft in 10 Minuten ab.',
        'Nichts angefordert? Ignorieren Sie diese E-Mail.',
      ].join('\n'),
    });
  }

  /** Maquette `Email-MotDePasseModifie` — after reset or change-password. */
  async sendCenterPasswordChangedEmail(
    to: string,
    details?: { deviceName?: string; at?: Date },
  ): Promise<void> {
    const when = (details?.at ?? new Date()).toLocaleString('de-DE', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/Berlin',
    });
    const device = details?.deviceName?.trim() || 'Unbekanntes Gerät';
    const secureUrl = `${this.getVitrineUrl()}/center/forgot-password`;

    await this.send(to, {
      subject: 'Ihr Passwort wurde geändert',
      preheader: 'Das Passwort Ihres Zentrumskontos wurde geändert.',
      heading: 'Passwort geändert',
      paragraphs: [
        'Das Passwort des Zentrumskontos wurde geändert. Andere Geräte wurden abgemeldet.',
      ],
      rows: [
        { label: 'Datum', value: when },
        { label: 'Gerät', value: device },
      ],
      notice:
        '<strong>Das waren nicht Sie?</strong> Sichern Sie Ihr Konto sofort.',
      action: { label: 'Konto sichern', url: secureUrl },
      footer:
        'Sie erhalten diese E-Mail aufgrund einer Aktion auf lerniqo.tech.',
      text: [
        'Passwort geändert',
        '',
        'Das Passwort des Zentrumskontos wurde geändert. Andere Geräte wurden abgemeldet.',
        `Datum: ${when}`,
        `Gerät: ${device}`,
        '',
        'Das waren nicht Sie? Sichern Sie Ihr Konto:',
        secureUrl,
      ].join('\n'),
    });
  }

  /** Maquette `Email-NouveauCentre` — internal alert to the Lerniqo team. */
  async sendNewCenterRegisteredToTeam(input: {
    managerFirstName: string;
    managerLastName: string;
    email: string;
    centerName: string;
    locale?: string;
  }): Promise<void> {
    const team = this.getSupportEmail();

    const when = new Date().toLocaleString('de-DE', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/Berlin',
    });
    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const trialEndsLabel = trialEnds.toLocaleDateString('de-DE', {
      dateStyle: 'long',
      timeZone: 'Europe/Berlin',
    });
    const fullName =
      `${input.managerFirstName.trim()} ${input.managerLastName.trim()}`.trim();
    const dashUrl = `${this.getVitrineUrl()}/center/login`;

    await this.send(team, {
      subject: `Neuer Center registriert — ${input.centerName.trim()}`,
      preheader: 'Ein neuer Center hat ein Konto erstellt.',
      heading: 'Ein neuer Center hat sein Konto erstellt',
      paragraphs: [
        'Der 14-Tage-Test ist gestartet. Angaben bei der Registrierung:',
      ],
      rows: [
        { label: 'Name', value: fullName },
        { label: 'E-Mail', value: input.email.trim().toLowerCase() },
        { label: 'Center', value: input.centerName.trim() },
        { label: 'Sprache', value: input.locale?.trim() || '—' },
        { label: 'Datum', value: when },
        { label: 'Ende des Tests', value: trialEndsLabel },
      ],
      action: { label: 'Willkommen wünschen', url: dashUrl },
      footer:
        'Sie erhalten diese E-Mail aufgrund einer Aktion auf lerniqo.tech.',
      text: [
        'Ein neuer Center hat sein Konto erstellt',
        '',
        `Name: ${fullName}`,
        `E-Mail: ${input.email}`,
        `Center: ${input.centerName}`,
        `Datum: ${when}`,
        `Ende des Tests: ${trialEndsLabel}`,
      ].join('\n'),
    });
  }

  /** Maquette `Email-DemoClient` — confirmation to the school that booked. */
  async sendDemoConfirmationToClient(input: {
    fullName: string;
    email: string;
    whatsapp: string;
    centerName: string;
    studentBand: string;
    message?: string;
    locale: 'fr' | 'en' | 'de';
    slotLabel: string;
    slotStart: Date;
  }): Promise<void> {
    const first =
      input.fullName.trim().split(/\s+/)[0] ||
      (input.locale === 'fr'
        ? 'bonjour'
        : input.locale === 'en'
          ? 'there'
          : '');
    // CTA reuses the same team inbox as the rest of the backend (SUPPORT_EMAIL).
    const support = this.getSupportEmail();
    const contactUrl = `mailto:${encodeURIComponent(support)}`;
    const dur =
      input.locale === 'fr'
        ? '30 minutes en visio'
        : input.locale === 'en'
          ? '30 minutes on video'
          : '30 Minuten per Video';
    const copy =
      input.locale === 'fr'
        ? {
            subject: 'Votre démo Lerniqo est réservée',
            preheader: 'Récapitulatif de votre demande de démo.',
            heading: `Votre démo est réservée, ${first}.`,
            intro:
              'Merci pour votre intérêt. Voici le récapitulatif de votre demande. Notre équipe vous confirmera le lien de visio par e-mail.',
            slotL: 'Votre créneau',
            join: 'Nous écrire',
            recap: 'Les informations que vous nous avez transmises :',
            change:
              'Besoin de changer l’horaire ? Répondez simplement à cet e-mail.',
            labels: {
              name: 'Nom',
              email: 'E-mail',
              wa: 'WhatsApp',
              center: 'Centre',
              size: 'Nombre d’élèves',
              msg: 'Message',
            },
          }
        : input.locale === 'en'
          ? {
              subject: 'Your Lerniqo demo is booked',
              preheader: 'Summary of your demo request.',
              heading: `Your demo is booked, ${first}.`,
              intro:
                'Thanks for your interest. Here is a summary of your request. Our team will send you the video-call link by email.',
              slotL: 'Your time slot',
              join: 'Contact us',
              recap: 'The details you sent us:',
              change: 'Need another time? Just reply to this email.',
              labels: {
                name: 'Name',
                email: 'Email',
                wa: 'WhatsApp',
                center: 'Centre',
                size: 'Students',
                msg: 'Message',
              },
            }
          : {
              subject: 'Ihre Lerniqo-Demo ist gebucht',
              preheader: 'Zusammenfassung Ihrer Demo-Anfrage.',
              heading: first
                ? `Ihre Demo ist gebucht, ${first}.`
                : 'Ihre Demo ist gebucht.',
              intro:
                'Danke für Ihr Interesse. Hier ist die Zusammenfassung Ihrer Anfrage. Unser Team sendet Ihnen den Video-Link per E-Mail.',
              slotL: 'Ihr Termin',
              join: 'Schreiben Sie uns',
              recap: 'Ihre Angaben:',
              change:
                'Anderer Termin? Antworten Sie einfach auf diese E-Mail.',
              labels: {
                name: 'Name',
                email: 'E-Mail',
                wa: 'WhatsApp',
                center: 'Zentrum',
                size: 'Lernende',
                msg: 'Nachricht',
              },
            };

    const rows = [
      { label: copy.labels.name, value: input.fullName },
      { label: copy.labels.email, value: input.email },
      { label: copy.labels.wa, value: input.whatsapp },
      { label: copy.labels.center, value: input.centerName },
      { label: copy.labels.size, value: input.studentBand },
    ];
    if (input.message) {
      rows.push({ label: copy.labels.msg, value: input.message });
    }

    await this.send(input.email, {
      subject: copy.subject,
      preheader: copy.preheader,
      heading: copy.heading,
      paragraphs: [
        copy.intro,
        `<strong>${escapeHtml(copy.slotL)}</strong><br>${escapeHtml(input.slotLabel)}<br>${escapeHtml(dur)}`,
        copy.recap,
      ],
      rows,
      action: { label: copy.join, url: contactUrl },
      notice: copy.change,
      footer:
        'Sie erhalten diese E-Mail aufgrund einer Aktion auf lerniqo.tech.',
      text: [
        copy.heading,
        '',
        copy.intro,
        `${copy.slotL}: ${input.slotLabel}`,
        dur,
        '',
        ...rows.map((r) => `${r.label}: ${r.value}`),
        '',
        `${copy.join}: ${support}`,
        copy.change,
      ].join('\n'),
    });
  }

  /** Maquette `Email-DemoEquipe` — alert the Lerniqo team. */
  async sendDemoRequestToTeam(input: {
    fullName: string;
    email: string;
    whatsapp: string;
    centerName: string;
    studentBand: string;
    message?: string;
    locale: 'fr' | 'en' | 'de';
    slotLabel: string;
  }): Promise<void> {
    const team = this.getSupportEmail();
    const localeLabel =
      input.locale === 'fr'
        ? 'Français'
        : input.locale === 'en'
          ? 'English'
          : 'Deutsch';
    const waDigits = input.whatsapp.replace(/\D/g, '');
    const waUrl = waDigits
      ? `https://wa.me/${waDigits}`
      : 'https://wa.me/4915734177259';
    const mailto = `mailto:${encodeURIComponent(input.email)}`;

    await this.send(team, {
      subject: `Neue Demo-Anfrage — ${input.centerName} (${input.studentBand})`,
      preheader: 'Eine Demo-Anfrage wurde auf lerniqo.tech gesendet.',
      heading: 'Neue Demo-Anfrage',
      paragraphs: [
        'Eine Anfrage wurde soeben über lerniqo.tech gesendet. Angaben:',
      ],
      rows: [
        { label: 'Name', value: input.fullName },
        { label: 'E-Mail', value: input.email },
        { label: 'WhatsApp', value: input.whatsapp },
        { label: 'Center', value: input.centerName },
        { label: 'Lernende', value: input.studentBand },
        { label: 'Termin', value: input.slotLabel },
        { label: 'Nachricht', value: input.message?.trim() || '—' },
        { label: 'Sprache der Seite', value: localeLabel },
      ],
      action: { label: 'Per WhatsApp antworten', url: waUrl },
      notice: `<a href="${escapeHtml(mailto)}" style="color:#0061A4;font-weight:700;">Per E-Mail antworten</a><br><br>Der Client hat eine Bestätigung mit diesem Termin erhalten. Denken Sie daran, den Video-Link zu schicken.`,
      footer:
        'Sie erhalten diese E-Mail aufgrund einer Aktion auf lerniqo.tech.',
      text: [
        'Neue Demo-Anfrage',
        '',
        `Name: ${input.fullName}`,
        `E-Mail: ${input.email}`,
        `WhatsApp: ${input.whatsapp}`,
        `Center: ${input.centerName}`,
        `Lernende: ${input.studentBand}`,
        `Termin: ${input.slotLabel}`,
        `Nachricht: ${input.message?.trim() || '—'}`,
        `Sprache: ${localeLabel}`,
        '',
        `WhatsApp: ${waUrl}`,
        `E-Mail: ${mailto}`,
      ].join('\n'),
    });
  }

  /** Maquette `Email-CodeActive` — notify the center when a seat is redeemed. */
  async sendCodeActivatedToCenter(input: {
    to: string;
    codeMasked: string;
    studentName: string;
    planLabel: string;
    seatsUsedLabel: string;
    at?: Date;
  }): Promise<void> {
    const when = (input.at ?? new Date()).toLocaleString('de-DE', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/Berlin',
    });
    const dashUrl = `${this.getVitrineUrl()}/center/dashboard`;

    await this.send(input.to, {
      subject: 'Ein Code wurde aktiviert',
      preheader: 'Ein Code Ihres Zentrums wurde gerade verwendet.',
      heading: 'Neue:r Lernende:r aktiviert',
      paragraphs: ['Ein Code Ihres Zentrums wurde gerade verwendet.'],
      rows: [
        { label: 'Code', value: input.codeMasked },
        { label: 'Lernende:r', value: input.studentName },
        { label: 'Tarif', value: input.planLabel },
        { label: 'Datum', value: when },
        { label: 'Belegte Plätze', value: input.seatsUsedLabel },
      ],
      action: { label: 'Dashboard öffnen', url: dashUrl },
      footer:
        'Sie erhalten diese E-Mail aufgrund einer Aktion auf lerniqo.tech.',
      text: [
        'Neue:r Lernende:r aktiviert',
        '',
        'Ein Code Ihres Zentrums wurde gerade verwendet.',
        `Code: ${input.codeMasked}`,
        `Lernende:r: ${input.studentName}`,
        `Tarif: ${input.planLabel}`,
        `Datum: ${when}`,
        `Belegte Plätze: ${input.seatsUsedLabel}`,
        dashUrl,
      ].join('\n'),
    });
  }

  /**
   * Sent when a center provisions a student.
   *
   * It gates nothing — the student activates with the key their school hands
   * them, not from here. It exists to prove the address works, so a typo comes
   * back as a bounce the center can fix rather than silence, and so the
   * student has heard from Lerniqo directly from day one.
   *
   * It deliberately carries no activation key: the key goes to the center.
   */
  async sendStudentWelcomeEmail(to: string, firstName: string): Promise<void> {
    const greeting = firstName?.trim()
      ? `Hallo ${firstName.trim()},`
      : 'Hallo,';

    await this.send(to, {
      subject: 'Deine Sprachschule hat dich zu Lerniqo hinzugefügt',
      preheader:
        'Dein Zugang zu Lerniqo wurde von deiner Sprachschule angelegt.',
      heading: 'Willkommen bei Lerniqo',
      paragraphs: [
        greeting,
        'deine Sprachschule hat für dich ein Lerniqo-Konto angelegt.',
        'Du erhältst deinen persönlichen Aktivierungscode direkt von deiner Sprachschule. Damit legst du dein eigenes Passwort fest und startest.',
      ],
      notice:
        'Dein Passwort wählst nur du selbst — deine Sprachschule kennt es nicht. Wenn du nicht weißt, worum es geht, wende dich an deine Sprachschule.',
      text: [
        'Willkommen bei Lerniqo',
        '',
        greeting,
        '',
        'deine Sprachschule hat für dich ein Lerniqo-Konto angelegt.',
        'Deinen persönlichen Aktivierungscode erhältst du direkt von deiner Sprachschule.',
        '',
        'Dein Passwort wählst nur du selbst.',
      ].join('\n'),
    });
  }

  async sendPasswordResetEmail(to: string, rawCode: string): Promise<void> {
    await this.send(to, {
      subject: 'Dein Lerniqo-Code zum Zurücksetzen des Passworts',
      preheader:
        'Mit diesem Code kannst du dein Lerniqo-Passwort zurücksetzen.',
      heading: 'Passwort zurücksetzen',
      paragraphs: [
        'Hallo,',
        'wir haben eine Anfrage erhalten, dein Lerniqo-Passwort zurückzusetzen.',
      ],
      code: { label: 'Dein Bestätigungscode:', value: rawCode },
      notice:
        '<strong>Sicherheitshinweis:</strong> Gib diesen Code in der Lerniqo-App ein. Er ist 10 Minuten gültig. Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren &mdash; dein Passwort bleibt unverändert.',
      text: [
        'Passwort zurücksetzen',
        '',
        'Hallo,',
        '',
        'wir haben eine Anfrage erhalten, dein Lerniqo-Passwort zurückzusetzen.',
        '',
        `Dein Bestätigungscode: ${rawCode}`,
        '',
        'Gib diesen Code in der Lerniqo-App ein. Er ist 10 Minuten gültig.',
        '',
        'Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.',
      ].join('\n'),
    });
  }

  /**
   * A support message or deletion request, to the Lerniqo team (D24, D37).
   * In English: it is read by the team, not by a school.
   *
   * Every field was typed by a caller, so each is escaped before it enters the
   * HTML — the template takes paragraphs as markup.
   */
  async sendSupportRequestToTeam(
    to: string,
    request: {
      subject: string;
      replyTo: string;
      fields: [label: string, value: string][];
      message?: string;
    },
  ): Promise<void> {
    const rows = request.fields.map(
      ([label, value]) => `<strong>${label}:</strong> ${escapeHtml(value)}`,
    );
    const message = request.message
      ? escapeHtml(request.message).replace(/\n/g, '<br>')
      : null;
    await this.send(
      to,
      {
        subject: request.subject,
        preheader: request.subject,
        heading: request.subject,
        paragraphs: message ? [...rows, message] : rows,
        text: [
          request.subject,
          '',
          ...request.fields.map(([label, value]) => `${label}: ${value}`),
          ...(request.message ? ['', request.message] : []),
        ].join('\n'),
      },
      request.replyTo,
    );
  }

  /** "We received your message", to the manager's account address (D24). */
  async sendSupportAcknowledgement(
    to: string,
    firstName: string,
  ): Promise<void> {
    const greeting = `Hallo ${escapeHtml(firstName.trim())},`;
    await this.send(to, {
      subject: 'Wir haben Ihre Nachricht erhalten',
      preheader: 'Das Lerniqo-Team meldet sich so bald wie möglich bei Ihnen.',
      heading: 'Nachricht erhalten',
      paragraphs: [
        greeting,
        'vielen Dank für Ihre Nachricht an das Lerniqo-Team. Wir melden uns so bald wie möglich bei Ihnen.',
      ],
      text: [
        `Hallo ${firstName.trim()},`,
        '',
        'vielen Dank für Ihre Nachricht an das Lerniqo-Team. Wir melden uns so bald wie möglich bei Ihnen.',
      ].join('\n'),
    });
  }

  /** The deletion request was received; nothing is deleted yet (D37). */
  async sendDeletionRequestAcknowledgement(
    to: string,
    firstName: string,
  ): Promise<void> {
    const greeting = `Hallo ${escapeHtml(firstName.trim())},`;
    const body =
      'wir haben Ihre Anfrage erhalten, Ihr Lerniqo-Konto und alle zugehörigen Daten zu löschen. Eine Administratorin oder ein Administrator wird Sie kontaktieren, um die Löschung mit Ihnen zu besprechen.';
    const notice =
      'Bis dahin bleibt Ihr Konto unverändert: Plätze, Codes und Lernende funktionieren weiter.';
    await this.send(to, {
      subject: 'Ihre Anfrage zur Kontolöschung',
      preheader: 'Wir melden uns bei Ihnen, bevor etwas gelöscht wird.',
      heading: 'Anfrage erhalten',
      paragraphs: [greeting, body],
      notice,
      text: [`Hallo ${firstName.trim()},`, '', body, '', notice].join('\n'),
    });
  }
}
