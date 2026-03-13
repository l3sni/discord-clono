import React from 'react';

type Server = {
  id: bigint;
  name: string;
  iconColor: string;
  ownerId: any;
};

type Props = {
  servers: Server[];
  selectedServerId: bigint | null;
  onSelectServer: (id: bigint) => void;
  onCreateServer: () => void;
  onJoinServer: () => void;
};

export default function ServerSidebar({
  servers,
  selectedServerId,
  onSelectServer,
  onCreateServer,
  onJoinServer,
}: Props) {
  return (
    <div className="server-sidebar">
      <div
        className={`server-icon home-icon ${selectedServerId === null ? 'selected' : ''}`}
        title="Home"
        onClick={() => onSelectServer(null!)}
      >
        <svg width="28" height="20" viewBox="0 0 28 20">
          <path
            fill="currentColor"
            d="M23.0212 1.67671C21.3107 0.879656 19.5079 0.318797 17.6584 0C17.4062 0.461742 17.1749 0.934541 16.966 1.4168C15.0099 1.11499 13.0424 1.11499 11.0863 1.4168C10.8774 0.934541 10.6461 0.461742 10.3939 0C8.54337 0.320046 6.7398 0.881925 5.02889 1.68048C1.3579 7.04624 0.341468 12.2722 0.849622 17.4318C2.81806 18.8744 4.96547 19.9892 7.22167 20.7358C7.74569 20.0269 8.21034 19.2729 8.61044 18.4811C7.85576 18.2016 7.12583 17.856 6.42871 17.4482C6.6196 17.3096 6.80561 17.1666 6.98653 17.0192C11.5748 19.149 16.5257 19.149 21.0639 17.0192C21.2448 17.1666 21.4308 17.3096 21.6217 17.4482C20.9246 17.856 20.1946 18.2016 19.44 18.4811C19.84 19.2729 20.3047 20.0269 20.8287 20.7358C23.0849 19.9892 25.2323 18.8744 27.2008 17.4318C27.7995 11.4514 26.2877 6.27618 23.0212 1.67671Z"
          />
        </svg>
      </div>
      <div className="server-separator" />
      {servers.map(server => (
        <div
          key={server.id.toString()}
          className={`server-icon ${selectedServerId === server.id ? 'selected' : ''}`}
          style={{ backgroundColor: server.iconColor }}
          title={server.name}
          onClick={() => onSelectServer(server.id)}
        >
          {server.name.charAt(0).toUpperCase()}
        </div>
      ))}
      <div className="server-separator" />
      <div className="server-icon add-server" title="Create Server" onClick={onCreateServer}>
        +
      </div>
      <div className="server-icon join-server" title="Join Server" onClick={onJoinServer}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2a1 1 0 011 1v4h4a1 1 0 110 2H9v4a1 1 0 11-2 0V9H3a1 1 0 010-2h4V3a1 1 0 011-1z" />
        </svg>
      </div>
    </div>
  );
}
