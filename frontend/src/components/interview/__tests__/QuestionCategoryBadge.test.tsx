import { render, screen } from "@testing-library/react";

import { QuestionCategoryBadge } from "../QuestionCategoryBadge";

describe("QuestionCategoryBadge", () => {
  it("renders a readable label for the category", () => {
    render(<QuestionCategoryBadge category="behavioral" />);
    expect(screen.getByText(/Behavioral/i)).toBeInTheDocument();
  });
});
