import { useEffect, useRef } from "react";
import { safeLog } from "@/lib/safe-logger";

const FASTEN_PUBLIC_ID = "public_test_vjql828oy61awhvrk4o2cq822379hx7n3ypdmd91ooolj";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "fasten-stitch-element": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { "public-id"?: string },
        HTMLElement
      >;
    }
  }
}

export function FastenStitchWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current?.querySelector("fasten-stitch-element");
    if (!el) return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      safeLog.info("Fasten Stitch event", {
        action: "fasten_stitch_event",
        eventType: detail?.data?.type ?? "unknown",
      });
    };

    el.addEventListener("eventBus", handler);
    return () => el.removeEventListener("eventBus", handler);
  }, []);

  return (
    <div ref={containerRef}>
      <fasten-stitch-element public-id={FASTEN_PUBLIC_ID} />
    </div>
  );
}
