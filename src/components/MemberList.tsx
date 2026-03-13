import React from 'react';

type User = {
  identity: any;
  name?: string;
  avatarColor: string;
  online: boolean;
};

type Props = {
  members: User[];
};

export default function MemberList({ members }: Props) {
  const online = members.filter(m => m.online);
  const offline = members.filter(m => !m.online);

  const displayName = (u: User) => u.name || u.identity.toHexString().substring(0, 8);

  return (
    <div className="member-list">
      <h3 className="member-category">ONLINE — {online.length}</h3>
      {online.map((user, i) => (
        <div key={i} className="member-item">
          <div className="member-avatar" style={{ backgroundColor: user.avatarColor }}>
            {displayName(user).charAt(0).toUpperCase()}
            <div className="status-dot online" />
          </div>
          <span className="member-name">{displayName(user)}</span>
        </div>
      ))}
      {offline.length > 0 && (
        <>
          <h3 className="member-category">OFFLINE — {offline.length}</h3>
          {offline.map((user, i) => (
            <div key={i} className="member-item offline">
              <div className="member-avatar" style={{ backgroundColor: user.avatarColor, opacity: 0.5 }}>
                {displayName(user).charAt(0).toUpperCase()}
                <div className="status-dot offline" />
              </div>
              <span className="member-name">{displayName(user)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
