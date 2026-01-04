interface StatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'connecting' | 'emulator';
  projectId?: string;
}

export default function StatusIndicator({ status, projectId }: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'emulator':
        return 'bg-orange-500';
      case 'connecting':
        return 'bg-yellow-500';
      default:
        return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'emulator':
        return 'Emulator';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-md">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{getStatusText()}</p>
        {projectId && (
          <p className="text-xs text-slate-400 truncate">{projectId}</p>
        )}
      </div>
    </div>
  );
}
