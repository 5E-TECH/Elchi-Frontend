import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../i18n";
import PageLoader from "./PageLoader";

/**
 * Ilova yuklanish ekrani (`PageLoader`) — ko'rinish v2 tokenlarida. v1 holat o'ramlari (EmptyState, QueryErrorState,
 * TableSkeleton, Loader) iste'molchisiz qolgach o'chirildi — o'rniga `src/shared/ui/primitives` (`EmptyState`,
 * `ErrorState`, `Skeleton*`, `Spinner`, `QueryBoundary`).
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("PageLoader", () => {
  it("PageLoader — navy fon, logotip, «Yuklanmoqda…», harakat kamaytiriladi", () => {
    render(<PageLoader />);
    const status = screen.getByRole("status", { name: "Ilova yuklanmoqda" });
    expect(status).toHaveClass("fixed", "inset-0", "bg-nav");
    expect(screen.getByRole("img", { name: "Elchi Pochta" })).toBeInTheDocument();
    expect(status).toHaveTextContent("Yuklanmoqda…");
    expect(status.querySelector(".motion-reduce\\:animate-none")).not.toBeNull();
    expect(status.className).not.toMatch(/gradient|bg-linear|text-white|font-black/);
  });
});
