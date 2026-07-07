export function getMessageGroupPosition(messages, index, senderKey = 'senderId') {
  if (!Array.isArray(messages) || index < 0 || index >= messages.length) {
    return 'single';
  }

  const current = messages[index];
  const currentSender = current?.[senderKey];
  const prevSender = index > 0 ? messages[index - 1]?.[senderKey] : undefined;
  const nextSender = index < messages.length - 1 ? messages[index + 1]?.[senderKey] : undefined;

  const startsGroup = index === 0 || prevSender !== currentSender;
  const endsGroup = index === messages.length - 1 || nextSender !== currentSender;

  if (startsGroup && endsGroup) return 'single';
  if (startsGroup) return 'first';
  if (endsGroup) return 'last';
  return 'middle';
}
