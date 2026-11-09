import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount what each test rendered (Testing Library only does it by itself with test globals).
afterEach(() => cleanup());
