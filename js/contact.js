// Contact address, put together only when someone asks for it, so it isn't
// sitting in the page or the source for spam harvesters to pick up.

const parts = ["moc.liamg", "grubrednov.dnumde"];

function address() {
  const [domain, user] = parts.map((p) => [...p].reverse().join(""));
  return `${user}@${domain}`;
}

document.querySelectorAll("[data-contact]").forEach((button) =>
  button.addEventListener("click", () => {
    const link = Object.assign(document.createElement("a"), { href: `mailto:${address()}`, textContent: address() });
    button.replaceWith(link);
    link.focus();
  }),
);
