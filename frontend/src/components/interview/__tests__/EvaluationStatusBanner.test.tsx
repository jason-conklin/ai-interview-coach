import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { EvaluationStatusBanner } from "../EvaluationStatusBanner";

describe("EvaluationStatusBanner", () => {
  it("renders the alert when status is heuristic", () => {
    const onDismiss = vi.fn();
    render(<EvaluationStatusBanner status="heuristic" visible onDismiss={onDismiss} />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("AI Evaluation Unavailable");
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not render when status is llm", () => {
    render(<EvaluationStatusBanner status="llm" visible onDismiss={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("responds to escape key presses", () => {
    const onDismiss = vi.fn();
    render(<EvaluationStatusBanner status="heuristic" visible onDismiss={onDismiss} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });
});
