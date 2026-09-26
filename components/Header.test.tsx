import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Header from "./Header";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("Header", () => {
  describe("default", () => {
    it("links to the main site pages", () => {
      render(<Header />);

      expect(screen.getByRole("link", { name: "JALI Map" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Map 2" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Admin Panel" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Contact" })).toBeInTheDocument();
    });

    it("keeps the brand linked to the home page", () => {
      render(<Header />);

      expect(screen.getByRole("link", { name: /Naksha Vivaran/ })).toHaveAttribute("href", "/");
    });

    it("offers the mobile menu button", () => {
      const { container } = render(<Header />);

      expect(container.querySelector("button")).not.toBeNull();
    });
  });

  describe("minimal", () => {
    it("hides every navigation link", () => {
      render(<Header minimal />);

      expect(screen.queryByRole("link", { name: "JALI Map" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Map 2" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Admin Panel" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Contact" })).not.toBeInTheDocument();
    });

    it("renders the brand as plain text, so nothing navigates away", () => {
      const { container } = render(<Header minimal />);

      expect(container.textContent).toContain("Naksha Vivaran");
      expect(screen.queryAllByRole("link")).toHaveLength(0);
    });

    it("hides the mobile menu button", () => {
      const { container } = render(<Header minimal />);

      expect(container.querySelector("button")).toBeNull();
    });
  });
});
