import { describe, expect, it } from "vitest";

function canUserAccessBook(input: {
  isOwner: boolean;
  catalogStatus: "PRIVATE_ONLY" | "SHARED";
}) {
  if (input.catalogStatus === "SHARED") {
    return true;
  }

  return input.isOwner;
}

describe("visibility rules", () => {
  it("allows shared books for everyone", () => {
    expect(canUserAccessBook({ isOwner: false, catalogStatus: "SHARED" })).toBe(true);
  });

  it("prevents private books from leaking to other users", () => {
    expect(canUserAccessBook({ isOwner: false, catalogStatus: "PRIVATE_ONLY" })).toBe(false);
    expect(canUserAccessBook({ isOwner: true, catalogStatus: "PRIVATE_ONLY" })).toBe(true);
  });
});
