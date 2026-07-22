import { NewsletterForm } from './NewsletterForm';

/**
 * Slim "what's next" strip — kept intentionally small so a first-time visitor
 * stays focused on the one product they can buy today (the digital storybook).
 * Audio, printed keepsakes and gifts are future work, mentioned once, honestly.
 */
export function ComingSoon() {
  return (
    <section className="dband dband-soft" id="range">
      <div className="container">
        <div className="nextstrip">
          <div>
            <h2 className="nextstrip-h">Storybooks today. More on the way.</h2>
            <p className="nextstrip-d">
              Audio stories, printed keepsakes and gifts are coming next. Want a nudge when they land?
            </p>
          </div>
          <div className="nextstrip-form">
            <NewsletterForm />
          </div>
        </div>
      </div>
    </section>
  );
}
