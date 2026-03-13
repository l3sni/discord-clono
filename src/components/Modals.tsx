import React, { useState } from 'react';

type ModalProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ─── Create Server Modal ────────────────────────────────────────────────────

export function CreateServerModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  return (
    <Modal title="Create a Server" onClose={onClose}>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim());
        }}
      >
        <label className="modal-label">SERVER NAME</label>
        <input
          className="modal-input"
          type="text"
          placeholder="My Awesome Server"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button type="button" className="modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="modal-btn-primary" disabled={!name.trim()}>
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Join Server Modal ──────────────────────────────────────────────────────

export function JoinServerModal({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState('');

  return (
    <Modal title="Join a Server" onClose={onClose}>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (code.trim()) onJoin(code.trim());
        }}
      >
        <label className="modal-label">INVITE CODE</label>
        <input
          className="modal-input"
          type="text"
          placeholder="Enter invite code"
          value={code}
          onChange={e => setCode(e.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button type="button" className="modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="modal-btn-primary" disabled={!code.trim()}>
            Join
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Create Channel Modal ───────────────────────────────────────────────────

export function CreateChannelModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, topic: string) => void;
}) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');

  return (
    <Modal title="Create Channel" onClose={onClose}>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim(), topic.trim());
        }}
      >
        <label className="modal-label">CHANNEL NAME</label>
        <div className="channel-name-input">
          <span className="channel-prefix">#</span>
          <input
            className="modal-input"
            type="text"
            placeholder="new-channel"
            value={name}
            onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            autoFocus
          />
        </div>
        <label className="modal-label">TOPIC (optional)</label>
        <input
          className="modal-input"
          type="text"
          placeholder="What's this channel about?"
          value={topic}
          onChange={e => setTopic(e.target.value)}
        />
        <div className="modal-actions">
          <button type="button" className="modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="modal-btn-primary" disabled={!name.trim()}>
            Create Channel
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Set Name Modal ─────────────────────────────────────────────────────────

export function SetNameModal({
  currentName,
  onClose,
  onSetName,
}: {
  currentName: string;
  onClose: () => void;
  onSetName: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);

  return (
    <Modal title="Set Your Name" onClose={onClose}>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (name.trim()) {
            onSetName(name.trim());
            onClose();
          }
        }}
      >
        <label className="modal-label">DISPLAY NAME</label>
        <input
          className="modal-input"
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button type="button" className="modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="modal-btn-primary" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
