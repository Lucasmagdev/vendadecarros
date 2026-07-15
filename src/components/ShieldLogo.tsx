export default function ShieldLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5d980" />
          <stop offset="40%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#a07c1e" />
        </linearGradient>
      </defs>
      {/* Shield outline */}
      <path
        d="M50 8 L88 22 L88 52 C88 72 68 88 50 95 C32 88 12 72 12 52 L12 22 Z"
        stroke="url(#goldGrad)"
        strokeWidth="4"
        fill="none"
      />
      {/* Car silhouette */}
      <path
        d="M25 58 L28 50 L35 44 L50 42 L65 44 L72 50 L75 58 L75 64 L25 64 Z"
        fill="url(#goldGrad)"
        opacity="0.95"
      />
      <path
        d="M33 44 L38 36 L62 36 L67 44"
        fill="url(#goldGrad)"
        opacity="0.85"
      />
      {/* Wheels */}
      <circle cx="34" cy="64" r="5" fill="url(#goldGrad)" />
      <circle cx="66" cy="64" r="5" fill="url(#goldGrad)" />
      {/* Windshield shine */}
      <path d="M40 43 L43 37 L57 37 L60 43 Z" fill="#0a192f" opacity="0.4" />
    </svg>
  );
}
