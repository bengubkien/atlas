import { describe, expect, it } from "vitest";

import { plainMessage } from "./messages";

describe("micasa's messages, plainly", () => {
  it("names the field and ends the sentence", () => {
    expect(plainMessage("serviced_at: invalid date value")).toBe("Serviced at: invalid date value.");
  });
  it("says what still depends on a record", () => {
    expect(plainMessage("project has 2 active quote(s) -- delete them first")).toBe("This project still has 2 quotes. Delete them first.");
    expect(plainMessage("appliance has 1 active maintenance item(s) -- delete or reassign them first")).toBe(
      "This appliance still has 1 maintenance item. Delete or reassign them first.",
    );
  });
});
