// "Email these readings": a mailto link that opens the reader's own email
// program with a plain-text summary and the link back to OmniRose. It's
// addressed to no one, so they choose who it goes to (often themselves).

export function mailto(subject, lines) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\r\n"))}`;
}
