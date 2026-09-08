import { UiText } from '@ory/client';

function Message({ message }: { message: UiText }) {
  const isError = message.type === 'error';
  return (
    <div
      className={`message ${isError ? 'message-error' : 'message-info'}`}
      data-testid={`ui/message/${message.id}`}
    >
      {message.text}
    </div>
  );
}

export function Messages({ messages }: { messages?: UiText[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }
  return (
    <div className="messages">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
    </div>
  );
}