const CHICKEN_PIECES = 24;

const randomBetween = (minimum: number, maximum: number) =>
  minimum + Math.random() * (maximum - minimum);

export const launchChickenConfetti = (origin: HTMLElement | null) => {
  if (
    typeof document === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const originBounds = origin?.getBoundingClientRect();
  const originX = originBounds
    ? originBounds.left + originBounds.width / 2
    : window.innerWidth / 2;
  const originY = originBounds
    ? originBounds.top + originBounds.height / 2
    : window.innerHeight;

  for (let index = 0; index < CHICKEN_PIECES; index += 1) {
    const piece = document.createElement("span");
    piece.textContent = "🍗";
    piece.setAttribute("aria-hidden", "true");
    Object.assign(piece.style, {
      position: "fixed",
      left: `${originX}px`,
      top: `${originY}px`,
      zIndex: "100",
      pointerEvents: "none",
      fontSize: `${randomBetween(16, 28)}px`,
      lineHeight: "1",
    });
    document.body.append(piece);

    const horizontalDistance = randomBetween(-220, 220);
    const lift = randomBetween(-180, -90);
    const fall = randomBetween(70, 190);
    const rotation = randomBetween(-540, 540);
    const animation = piece.animate(
      [
        {
          transform: "translate(-50%, -50%) rotate(0deg) scale(0.5)",
          opacity: 1,
        },
        {
          transform: `translate(calc(-50% + ${horizontalDistance * 0.45}px), calc(-50% + ${lift}px)) rotate(${rotation * 0.45}deg) scale(1)`,
          opacity: 1,
          offset: 0.45,
        },
        {
          transform: `translate(calc(-50% + ${horizontalDistance}px), calc(-50% + ${fall}px)) rotate(${rotation}deg) scale(0.8)`,
          opacity: 0,
        },
      ],
      {
        duration: randomBetween(900, 1300),
        easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
      },
    );

    animation.addEventListener("finish", () => piece.remove(), { once: true });
  }
};
