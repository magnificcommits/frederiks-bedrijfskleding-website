export function Stars({ value = 5, className = '' }: { value?: number; className?: string }) {
  return (
    <span className={`inline-flex ${className}`} aria-label={`${value} van 5 sterren`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4" fill={i < value ? '#f5a623' : '#d8dde3'} aria-hidden="true">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15.9 4.8 17.6l1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}
