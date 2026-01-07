interface StatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'connecting' | 'emulator';
  projectId?: string;
}

export default function StatusIndicator({ status, projectId }: StatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          color: 'var(--color-success)',
          bgColor: 'var(--color-success)',
          text: 'Connected',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ),
        };
      case 'emulator':
        return {
          color: 'var(--color-orange)',
          bgColor: 'var(--color-orange)',
          text: 'Emulator',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                clipRule="evenodd"
              />
            </svg>
          ),
        };
      case 'connecting':
        return {
          color: 'var(--color-warning)',
          bgColor: 'var(--color-warning)',
          text: 'Connecting...',
          icon: (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ),
        };
      default:
        return {
          color: 'var(--color-error)',
          bgColor: 'var(--color-error)',
          text: 'Disconnected',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          ),
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-md"
      style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
    >
      <div
        className="flex items-center justify-center"
        style={{ color: config.color }}
        aria-hidden="true"
      >
        {config.icon}
      </div>
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: config.bgColor }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: config.color }}
        >
          {config.text}
        </p>
        {projectId && (
          <p
            className="text-xs truncate"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {projectId}
          </p>
        )}
      </div>
    </div>
  );
}
