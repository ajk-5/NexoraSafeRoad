import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ChangePassword } from "./ChangePassword";

const changePassword = vi.hoisted(() => vi.fn());
vi.mock("../services/auth", () => ({ useAuth: () => ({ changePassword }) }));
beforeEach(() => { changePassword.mockReset(); });

async function fill(password: string, confirm = password) {
  await userEvent.type(screen.getByLabelText("Current password"), "existing-password");
  await userEvent.type(screen.getByLabelText("New password"), password);
  await userEvent.type(screen.getByLabelText("Confirm new password"), confirm);
  await userEvent.click(screen.getByRole("button", { name: "Update password" }));
}

it("changes the password and clears all password fields", async () => {
  changePassword.mockResolvedValue(undefined);
  render(<ChangePassword />);
  await fill("Three otters cross a river!");
  expect(changePassword).toHaveBeenCalledWith("existing-password", "Three otters cross a river!");
  expect(await screen.findByRole("status")).toBeTruthy();
  expect((screen.getByLabelText("Current password") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("New password") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Confirm new password") as HTMLInputElement).value).toBe("");
});

it("rejects a weak password before sending it", async () => {
  render(<ChangePassword />);
  await fill("passwordpassword");
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(changePassword).not.toHaveBeenCalled();
});

it("rejects mismatched confirmation before sending it", async () => {
  render(<ChangePassword />);
  await fill("Three otters cross a river!", "A different long password!");
  expect(await screen.findByText("The two passwords are different.")).toBeTruthy();
  expect(changePassword).not.toHaveBeenCalled();
});
