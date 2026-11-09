import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../services/api";
import { makeOperator } from "../../test/fixtures";
import { CreateAccount } from "./Accounts";

const api = vi.hoisted(() => ({ createOperator: vi.fn() }));

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return { ...actual, api };
});

// Braces matter: a function returned from beforeEach is run as a cleanup step after each test.
beforeEach(() => {
  api.createOperator.mockReset();
});

async function fill(password = "longenough", confirm = password) {
  await userEvent.type(screen.getByLabelText("Full name"), "Police Operator 02");
  await userEvent.type(screen.getByLabelText("Username"), "police2");
  await userEvent.selectOptions(screen.getByLabelText("Role"), "POLICE");
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.type(screen.getByLabelText("Confirm password"), confirm);
}

describe("create an account (super admin)", () => {
  it("creates the account and says so once the server confirmed", async () => {
    api.createOperator.mockResolvedValue(makeOperator({ username: "police2", role: "POLICE", status: "OFFLINE" }));
    const onCreated = vi.fn();
    render(<CreateAccount onCreated={onCreated} />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(api.createOperator).toHaveBeenCalledWith({ displayName: "Police Operator 02", username: "police2", role: "POLICE", password: "longenough" });
    expect(await screen.findByText(/created \(Police\)/)).toBeTruthy();
    expect(onCreated).toHaveBeenCalled();
  });

  it("will not submit two different passwords", async () => {
    render(<CreateAccount onCreated={vi.fn()} />);
    await fill("longenough", "different1");
    expect(screen.getByText("The two passwords are different.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.createOperator).not.toHaveBeenCalled();
  });

  it("explains why the server refused it", async () => {
    api.createOperator.mockRejectedValue(new ApiError(409, "USERNAME_TAKEN", "The username 'police2' is already used."));
    render(<CreateAccount onCreated={vi.fn()} />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/already used/)).toBeTruthy();
  });
});
