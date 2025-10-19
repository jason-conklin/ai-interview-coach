import { render, screen } from "@testing-library/react";

import { FeedbackPanel } from "../FeedbackPanel";

describe("FeedbackPanel", () => {
  it("shows a helper message before evaluation", () => {
    render(<FeedbackPanel evaluation={null} />);
    expect(screen.getByText(/Submit your answer/i)).toBeInTheDocument();
  });

  it("renders evaluation details when provided", () => {
    render(
      <FeedbackPanel
        evaluation={{
          id: 1,
          score: 7.2,
          rubric: { clarity: 7 },
          feedback_markdown: "Great job.",
          suggested_improvements: ["Add metrics"],
          readiness_tier: "Emerging",
        }}
      />,
    );

    expect(screen.getByText(/Score 7\.2/)).toBeInTheDocument();
    expect(screen.getByText(/Emerging readiness/)).toBeInTheDocument();
  });
});
