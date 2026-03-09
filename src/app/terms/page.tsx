import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service – Sometime.Chat",
  description: "Terms governing your use of Sometime.Chat",
};

export default function TermsOfService() {
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
              Terms of Service
            </span>
            <span className="w-[48px]" />
          </div>

          <div className="px-8 py-8 space-y-6 text-[14px] leading-relaxed text-foreground/90">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Terms of Service
              </h1>
              <p className="mt-1 text-xs text-muted">
                Last updated: March 9, 2026
              </p>
            </div>

            <p>
              By using Sometime.Chat, you agree to these terms. If you do not
              agree, please do not use the service.
            </p>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                The Service
              </h2>
              <p>
                Sometime.Chat is a free, open-source tool that helps groups find
                overlapping availability by aggregating scheduling links and
                calendar data. It is provided as-is, without charge.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Your Responsibilities
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-foreground/80">
                <li>
                  You are responsible for the scheduling links and calendar data
                  you share. Only share links that you have permission to share.
                </li>
                <li>
                  You must not use the service to collect or harvest other
                  people&apos;s availability data without their knowledge or
                  consent.
                </li>
                <li>
                  You must not attempt to abuse, overload, or interfere with the
                  service.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Session Links
              </h2>
              <p>
                Each session has a unique URL. Anyone with the link can view and
                contribute to that session. Treat session links like you would
                any shared document — share them only with intended
                participants.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Third-Party Services
              </h2>
              <p>
                Sometime.Chat integrates with third-party platforms including
                Google Calendar, Calendly, Cal.com, and Notion Calendar. Your
                use of those services is governed by their respective terms and
                privacy policies. We are not responsible for the availability,
                accuracy, or conduct of any third-party service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Google Calendar
              </h2>
              <p>
                If you connect your Google Calendar, you authorize Sometime.Chat
                to access your calendar free/busy data via Google&apos;s OAuth
                2.0. You can revoke this access at any time from your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-foreground transition-colors"
                >
                  Google Account settings
                </a>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                No Warranty
              </h2>
              <p>
                Sometime.Chat is provided{" "}
                <strong>&quot;as is&quot;</strong> and{" "}
                <strong>&quot;as available&quot;</strong> without warranties of
                any kind, express or implied. We do not guarantee that the
                service will be uninterrupted, error-free, or that availability
                data will be accurate or complete.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Limitation of Liability
              </h2>
              <p>
                To the fullest extent permitted by law, Sometime.Chat and its
                maintainers shall not be liable for any indirect, incidental,
                special, or consequential damages arising from your use of the
                service, including but not limited to missed meetings, scheduling
                errors, or data loss.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Open Source
              </h2>
              <p>
                The source code for Sometime.Chat is available on{" "}
                <a
                  href="https://github.com/krathish/sometime.chat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
                . The software is provided under its open-source license. These
                Terms of Service govern your use of the hosted service at
                sometime.chat, not the source code itself.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Changes to These Terms
              </h2>
              <p>
                We may update these terms from time to time. Continued use of
                the service after changes constitutes acceptance of the updated
                terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Contact
              </h2>
              <p>
                Questions about these terms? Reach out at{" "}
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
