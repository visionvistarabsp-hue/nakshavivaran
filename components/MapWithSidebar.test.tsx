import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MapWithSidebar from "./MapWithSidebar";
import { makeMap, makePlot } from "@/test/fixtures";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// PlotMap draws onto a <canvas>, which jsdom cannot provide. It is replaced by a
// button that hands a plot back, so selection-driven sidebar chrome can be tested.
vi.mock("./PlotMap", () => ({
  default: ({ plots, onSelect }: { plots: unknown[]; onSelect: (p: unknown) => void }) => (
    <button onClick={() => onSelect(plots[0])}>stub-plot</button>
  ),
}));

const jali = makeMap({ id: "1", slug: "jali", name: "JALI", is_default: true });
const map2 = makeMap({ id: "2", slug: "map-2", name: "Map 2", is_default: false });

/** Opens the plot detail panel through the stubbed map. */
function selectFirstPlot(container: HTMLElement) {
  fireEvent.click(screen.getByRole("button", { name: "stub-plot" }));
  return container;
}

describe("MapWithSidebar", () => {
  describe("default", () => {
    it("offers a button for every map when there is more than one", () => {
      render(<MapWithSidebar plots={[]} maps={[jali, map2]} activeMap={jali} />);

      expect(screen.getByRole("button", { name: "JALI" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Map 2" })).toBeInTheDocument();
    });

    it("omits the switcher when a single map is passed", () => {
      render(<MapWithSidebar plots={[]} maps={[jali]} activeMap={jali} />);

      expect(screen.queryByRole("button", { name: "JALI" })).not.toBeInTheDocument();
    });

    it("links a selected plot to the admin editor", () => {
      const { container } = render(
        <MapWithSidebar plots={[makePlot()]} maps={[jali, map2]} activeMap={jali} />
      );
      selectFirstPlot(container);

      expect(screen.getByRole("link", { name: /Edit in Admin/ })).toBeInTheDocument();
    });
  });

  describe("showMapSwitcher={false}", () => {
    it("hides every map button", () => {
      render(
        <MapWithSidebar showMapSwitcher={false} plots={[]} maps={[jali, map2]} activeMap={jali} />
      );

      expect(screen.queryByRole("button", { name: "JALI" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Map 2" })).not.toBeInTheDocument();
    });

    it("still opens the plot detail panel, without the admin editor link", () => {
      const { container } = render(
        <MapWithSidebar
          showMapSwitcher={false}
          plots={[makePlot()]}
          maps={[jali, map2]}
          activeMap={jali}
        />
      );
      selectFirstPlot(container);

      expect(screen.getByText("Plot Details")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Edit in Admin/ })).not.toBeInTheDocument();
    });

    it("never navigates, even if a switcher button were somehow rendered", () => {
      render(
        <MapWithSidebar showMapSwitcher={false} plots={[]} maps={[jali, map2]} activeMap={jali} />
      );

      expect(push).not.toHaveBeenCalled();
    });
  });
});
