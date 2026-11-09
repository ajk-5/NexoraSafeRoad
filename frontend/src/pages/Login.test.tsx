import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { makeOperator } from "../test/fixtures";
import type { Role } from "../types/api";
import { Login } from "./Login";

const login = vi.hoisted(() => vi.fn());
vi.mock("../services/auth", () => ({ useAuth: () => ({ operator: null, login }) }));
beforeEach(() => { login.mockReset(); });

function Destination() { return <p>Dashboard: {useLocation().pathname}</p>; }
function renderLogin() {
  render(<MemoryRouter initialEntries={["/login"]}><Routes>
    <Route path="/login" element={<Login />} /><Route path="*" element={<Destination />} />
  </Routes></MemoryRouter>);
}

it.each<[Role, string]>([
  ["SUPERADMIN", "/superadmin"], ["ADMIN", "/admin"], ["POLICE", "/operator"],
  ["AMBULANCE", "/operator"], ["POMPIERS", "/operator"], ["DEPANNAGE", "/operator"],
])("opens the server-provided %s dashboard without asking for a role", async (role, path) => {
  login.mockResolvedValue(makeOperator({ role }));
  renderLogin();
  expect(screen.queryByRole("combobox")).toBeNull();
  await userEvent.type(screen.getByLabelText("Username"), "police1");
  await userEvent.type(screen.getByLabelText("Password"), "Existing password");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(login).toHaveBeenCalledWith("police1", "Existing password");
  expect(await screen.findByText(`Dashboard: ${path}`)).toBeTruthy();
});

it("keeps a failed login on the form and explains the error", async () => {
  login.mockRejectedValue(new Error("Wrong username or password."));
  renderLogin();
  await userEvent.type(screen.getByLabelText("Username"), "someone");
  await userEvent.type(screen.getByLabelText("Password"), "wrong");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Wrong username or password.");
  expect(screen.getByText("Wrong username or password.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
});
