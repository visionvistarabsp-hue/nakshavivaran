import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShareLinkButton from "./ShareLinkButton";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ShareLinkButton", () => {
  it("copies the unlisted single-map link for the current origin", async () => {
    render(<ShareLinkButton slug="map-2" mapName="Map 2" />);

    fireEvent.click(screen.getByRole("button"));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/m/map-2`);
  });

  it("confirms the copy, then falls back to the idle state", async () => {
    render(<ShareLinkButton slug="jali" mapName="JALI Map" />);

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Share");

    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveTextContent("Copied"));

    await waitFor(() => expect(button).toHaveTextContent("Share"), { timeout: 3000 });
  });

  it("names the map in its accessible name so both buttons are distinguishable", () => {
    render(<ShareLinkButton slug="jali" mapName="JALI Map" />);

    expect(
      screen.getByRole("button", { name: /JALI Map/ })
    ).toBeInTheDocument();
  });

  it("reports a failure instead of claiming success when the clipboard rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<ShareLinkButton slug="jali" mapName="JALI Map" />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveTextContent("Failed"));
    expect(button).toHaveTextContent("Try again");
  });
});
