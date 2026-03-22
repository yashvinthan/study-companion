export function resolveMultipleChoiceAnswer(options: string[], rawAnswer: string) {
  const trimmed = rawAnswer.trim();
  const letterMatch = trimmed.match(/^([A-D])(?:[).:\s-]|$)/i);

  if (!letterMatch) {
    return trimmed;
  }

  const index = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
  return options[index] ?? trimmed;
}
