import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy – Sometime.Chat",
  description: "How Sometime.Chat handles your data",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <div className="aqua-panel overflow-hidden">
          <div className="aqua-title-bar">
            <Link
              href="/"
              aria-label="Close"
              className="inline-flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80"
            >
              <span className="aqua-traffic-light aqua-traffic-close" />
            </Link>
            <span className="aqua-traffic-disabled" />
            <span className="aqua-traffic-disabled" />
            <span className="flex-1 text-center text-[11px] font-semibold text-muted select-none">
              Privacy Policy
            </span>
            <span className="w-[48px]" />
          </div>

          <div className="px-8 py-8 space-y-6 text-[14px] leading-relaxed text-foreground/90">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Privacy Policy
              </h1>
              <p className="mt-1 text-xs text-muted">
                Last updated: March 9, 2026
              </p>
            </div>

            <p>
              Sometime.Chat is a free, open-source tool that helps groups find
              common availability. This policy explains what data we collect, how
              we use it, and your choices.
            </p>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Data We Collect
              </h2>
              <p>
                Sometime.Chat does not require an account. When you use the
                service, we may collect:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-foreground/80">
                <li>
                  <strong>Session data</strong> — a randomly generated session
                  ID and an optional session name. No personal identifiers are
                  required to create a session.
                </li>
                <li>
                  <strong>Scheduling links</strong> — URLs you share from
                  Calendly, Cal.com, or Notion Calendar, along with a display
                  name you provide and your timezone.
                </li>
                <li>
                  <strong>Parsed availability</strong> — time slots extracted
                  from the scheduling links you provide, stored as structured
                  data.
                </li>
                <li>
                  <strong>Google Calendar data</strong> — if you choose to
                  connect Google Calendar, we request read-only access to your
                  free/busy information. We store your email address, OAuth
                  access token, and refresh token to retrieve and refresh your
                  availability.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                How We Use Your Data
              </h2>
              <p>
                All data collected is used solely to calculate and display
                overlapping availability among session participants. We do not:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-foreground/80">
                <li>Sell, rent, or share your data with third parties</li>
                <li>Use your data for advertising or profiling</li>
                <li>Send you marketing emails or notifications</li>
                <li>Track you across websites with cookies or analytics</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Google Calendar & OAuth
              </h2>
              <p>
                When you connect Google Calendar, we use Google&apos;s OAuth 2.0
                protocol to request limited, read-only access to your calendar
                free/busy data. We store your OAuth tokens securely in our
                database to fetch and refresh availability on your behalf. You
                can revoke access at any time from your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-foreground transition-colors"
                >
                  Google Account permissions
                </a>
                .
              </p>
              <p>
                Sometime.Chat&apos;s use and transfer to any other app of
                information received from Google APIs will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-foreground transition-colors"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Third-Party Scheduling Platforms
              </h2>
              <p>
                When you paste a Calendly, Cal.com, or Notion Calendar link, we
                fetch the publicly available scheduling page to extract time
                slots. We do not access your account on those platforms — only
                the information visible on the public link you share.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Data Storage & Retention
              </h2>
              <p>
                Session data is stored in a database hosted alongside the
                application. Sessions and their associated data (links,
                availability, calendar tokens) are retained as long as the
                session exists. We do not currently offer automatic expiration,
                but may introduce it in the future.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Cookies & Tracking
              </h2>
              <p>
                Sometime.Chat does not use cookies, analytics services, or
                tracking pixels. We do not collect IP addresses or browser
                fingerprints for tracking purposes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Open Source
              </h2>
              <p>
                Sometime.Chat is open source. You can review the full source
                code on{" "}
                <a
                  href="https://github.com/krathish/sometime.chat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-foreground transition-colors"
                >
                  GitHub
                </a>{" "}
                to verify how your data is handled.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Changes to This Policy
              </h2>
              <p>
                We may update this policy from time to time. Changes will be
                reflected on this page with an updated date.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Contact
              </h2>
              <p>
                If you have questions about this policy, you can reach out at{" "}
                <a
                  href="http://krathish.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-foreground transition-colors"
                >
                  krathish.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
