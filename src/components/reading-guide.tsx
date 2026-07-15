import { Icon } from './ui';

interface ReadingGuide {
  vocabulary: string[];
  discussionQuestions: string[];
  activity: string | null;
}

export function ReadingGuidePanel({ guide, title = 'Parent reading guide' }: { guide?: ReadingGuide | null; title?: string }) {
  if (!guide) return null;
  const hasVocabulary = guide.vocabulary.length > 0;
  const hasQuestions = guide.discussionQuestions.length > 0;
  const hasActivity = Boolean(guide.activity);
  if (!hasVocabulary && !hasQuestions && !hasActivity) return null;

  return (
    <section
      style={{
        marginTop: 22,
        padding: '20px 0 0',
        borderTop: '2px solid var(--hairline)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--soft-sage)',
          }}
        >
          <Icon name="book" size={18} stroke="var(--teal)" />
        </span>
        <h3 className="display" style={{ fontSize: 21 }}>{title}</h3>
      </div>

      {hasVocabulary && (
        <div style={{ marginBottom: 14 }}>
          <p className="label" style={{ marginBottom: 8 }}>Words to notice</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {guide.vocabulary.slice(0, 8).map((word) => (
              <span key={word} className="pill" style={{ background: 'var(--soft-butter)', borderColor: '#F2D28D' }}>{word}</span>
            ))}
          </div>
        </div>
      )}

      {hasQuestions && (
        <div style={{ marginBottom: 14 }}>
          <p className="label" style={{ marginBottom: 8 }}>After-story questions</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {guide.discussionQuestions.slice(0, 3).map((question, index) => (
              <p key={question} style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--ink-soft)' }}>
                <strong style={{ color: 'var(--ink)' }}>{index + 1}.</strong> {question}
              </p>
            ))}
          </div>
        </div>
      )}

      {hasActivity && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.45 }}>
          <Icon name="sun" size={17} stroke="var(--gold)" style={{ flex: 'none', marginTop: 1 }} />
          <p>{guide.activity}</p>
        </div>
      )}
    </section>
  );
}
