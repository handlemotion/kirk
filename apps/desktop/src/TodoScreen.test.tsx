import type { Todo, TodoId } from "@kirk/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The screen is tested against mocked hooks. The hooks have their own tests
// in packages/shared.
const state = vi.hoisted(() => ({
  todos: undefined as Todo[] | undefined,
  online: true,
  actions: {
    add: vi.fn(),
    rename: vi.fn(),
    setDone: vi.fn(),
    move: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@kirk/shared", () => ({
  useTodos: () => state.todos,
  useIsOnline: () => state.online,
  useTodoActions: () => state.actions,
}));
vi.mock("./auth", () => ({ useSignOut: () => vi.fn() }));

import { TodoScreen } from "./TodoScreen";

function todo(n: number, extra: Partial<Todo> = {}): Todo {
  return {
    _id: `t${n}` as TodoId,
    _creationTime: n,
    ownerId: "u1" as Todo["ownerId"],
    title: `todo ${n}`,
    done: false,
    order: `a${n}`,
    ...extra,
  };
}

const rows = () => screen.getAllByRole("listitem");
const row = (title: string) =>
  rows().find((r) => within(r).queryByText(title) !== null)!;

beforeEach(() => {
  state.todos = [todo(1), todo(2, { done: true }), todo(3)];
  state.online = true;
  for (const fn of Object.values(state.actions)) fn.mockReset();
});

afterEach(cleanup);

describe("TodoScreen list", () => {
  it("renders todos in the order it is given", () => {
    state.todos = [todo(3), todo(1), todo(2)];
    render(<TodoScreen />);
    expect(rows().map((r) => r.querySelector(".title")!.textContent)).toEqual([
      "todo 3",
      "todo 1",
      "todo 2",
    ]);
  });

  it("shows the done state of each todo", () => {
    render(<TodoScreen />);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((b) => b.checked)).toEqual([false, true, false]);
  });

  it("shows loading and empty states", () => {
    state.todos = undefined;
    const { rerender } = render(<TodoScreen />);
    expect(screen.getByText("Loading")).toBeTruthy();
    state.todos = [];
    rerender(<TodoScreen />);
    expect(screen.getByText("Nothing to do.")).toBeTruthy();
  });

  it("does not show the offline banner when online", () => {
    render(<TodoScreen />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("TodoScreen offline", () => {
  beforeEach(() => {
    state.online = false;
  });

  it("shows the banner", () => {
    render(<TodoScreen />);
    expect(screen.getByRole("alert").textContent).toMatch(/offline/i);
  });

  it("still shows the list", () => {
    render(<TodoScreen />);
    expect(rows()).toHaveLength(3);
  });

  it("disables the add box and button", () => {
    render(<TodoScreen />);
    const box = screen.getByPlaceholderText("Add a todo") as HTMLInputElement;
    const add = screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
    expect(box.disabled).toBe(true);
    expect(add.disabled).toBe(true);
  });

  it("disables every checkbox", () => {
    render(<TodoScreen />);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.every((b) => b.disabled)).toBe(true);
  });

  it("disables every move and delete button", () => {
    render(<TodoScreen />);
    for (const name of ["Move up", "Move down", "Delete"]) {
      const buttons = screen.getAllByRole("button", {
        name,
      }) as HTMLButtonElement[];
      expect(buttons).toHaveLength(3);
      expect(buttons.every((b) => b.disabled)).toBe(true);
    }
  });

  it("makes no row draggable", () => {
    render(<TodoScreen />);
    expect(rows().every((r) => r.getAttribute("draggable") === "false")).toBe(
      true,
    );
  });

  it("does not start a rename on double-click", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    await user.dblClick(screen.getByText("todo 1"));
    expect(document.querySelector("input.edit")).toBeNull();
  });

  it("does not move on a drop", () => {
    render(<TodoScreen />);
    fireEvent.dragStart(row("todo 1"));
    fireEvent.dragOver(row("todo 3"));
    fireEvent.drop(row("todo 3"));
    expect(state.actions.move).not.toHaveBeenCalled();
  });

  it("does not add a draft typed before the connection dropped", async () => {
    state.online = true;
    const user = userEvent.setup();
    const { rerender } = render(<TodoScreen />);
    await user.type(screen.getByPlaceholderText("Add a todo"), "late");
    state.online = false;
    rerender(<TodoScreen />);
    fireEvent.submit(screen.getByPlaceholderText("Add a todo"));
    expect(state.actions.add).not.toHaveBeenCalled();
  });

  it("enables the controls again when the connection returns", () => {
    const { rerender } = render(<TodoScreen />);
    state.online = true;
    rerender(<TodoScreen />);
    expect(screen.queryByRole("alert")).toBeNull();
    const box = screen.getByPlaceholderText("Add a todo") as HTMLInputElement;
    expect(box.disabled).toBe(false);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.some((b) => b.disabled)).toBe(false);
  });
});

describe("TodoScreen checkbox", () => {
  it("calls setDone(id, true) on an unchecked todo", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    await user.click(screen.getByRole("checkbox", { name: "Done: todo 1" }));
    expect(state.actions.setDone).toHaveBeenCalledExactlyOnceWith("t1", true);
  });

  it("calls setDone(id, false) on a checked todo", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    await user.click(screen.getByRole("checkbox", { name: "Done: todo 2" }));
    expect(state.actions.setDone).toHaveBeenCalledExactlyOnceWith("t2", false);
  });
});

describe("TodoScreen add", () => {
  it("adds a trimmed title and clears the box", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    const box = screen.getByPlaceholderText("Add a todo") as HTMLInputElement;
    await user.type(box, "  buy milk  {Enter}");
    expect(state.actions.add).toHaveBeenCalledExactlyOnceWith("buy milk");
    expect(box.value).toBe("");
  });

  it("adds with the Add button", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    await user.type(screen.getByPlaceholderText("Add a todo"), "x");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(state.actions.add).toHaveBeenCalledExactlyOnceWith("x");
  });

  it("does not add an empty title", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(screen.getByPlaceholderText("Add a todo"), "{Enter}");
    expect(state.actions.add).not.toHaveBeenCalled();
  });

  it("does not add a blank title", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    const box = screen.getByPlaceholderText("Add a todo");
    await user.type(box, "   {Enter}");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(state.actions.add).not.toHaveBeenCalled();
  });
});

describe("TodoScreen rename", () => {
  async function startEdit(user: ReturnType<typeof userEvent.setup>) {
    await user.dblClick(screen.getByText("todo 1"));
    return document.querySelector("input.edit") as HTMLInputElement;
  }

  it("calls rename on double-click, edit, Enter", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    const input = await startEdit(user);
    expect(input.value).toBe("todo 1");
    await user.clear(input);
    await user.type(input, "  renamed {Enter}");
    expect(state.actions.rename).toHaveBeenCalledExactlyOnceWith(
      "t1",
      "renamed",
    );
    expect(document.querySelector("input.edit")).toBeNull();
  });

  it("does not rename when the connection drops during the edit", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TodoScreen />);
    const input = await startEdit(user);
    await user.clear(input);
    await user.type(input, "late");
    state.online = false;
    rerender(<TodoScreen />);
    await user.keyboard("{Enter}");
    expect(state.actions.rename).not.toHaveBeenCalled();
  });

  it("does not rename on Escape", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    const input = await startEdit(user);
    await user.clear(input);
    await user.type(input, "nope{Escape}");
    expect(state.actions.rename).not.toHaveBeenCalled();
    expect(document.querySelector("input.edit")).toBeNull();
  });

  it("does not rename to a blank title", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    const input = await startEdit(user);
    await user.clear(input);
    await user.type(input, "   {Enter}");
    expect(state.actions.rename).not.toHaveBeenCalled();
  });

  it("does not rename when the title is unchanged", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    await startEdit(user);
    await user.keyboard("{Enter}");
    expect(state.actions.rename).not.toHaveBeenCalled();
  });
});

describe("TodoScreen move and delete", () => {
  it("moves with the buttons", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    await user.click(within(row("todo 2")).getByRole("button", { name: "Move up" }));
    expect(state.actions.move).toHaveBeenLastCalledWith("t2", 0);
    await user.click(
      within(row("todo 2")).getByRole("button", { name: "Move down" }),
    );
    expect(state.actions.move).toHaveBeenLastCalledWith("t2", 2);
  });

  it("disables Move up on the first row and Move down on the last", () => {
    render(<TodoScreen />);
    const up = within(rows()[0]).getByRole("button", {
      name: "Move up",
    }) as HTMLButtonElement;
    const down = within(rows()[2]).getByRole("button", {
      name: "Move down",
    }) as HTMLButtonElement;
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(true);
  });

  it("deletes", async () => {
    const user = userEvent.setup();
    render(<TodoScreen />);
    await user.click(within(row("todo 2")).getByRole("button", { name: "Delete" }));
    expect(state.actions.remove).toHaveBeenCalledExactlyOnceWith("t2");
  });
});

describe("TodoScreen drag", () => {
  it("moves a row down to the row it is dropped on", () => {
    render(<TodoScreen />);
    fireEvent.dragStart(row("todo 1"));
    fireEvent.dragOver(row("todo 3"));
    fireEvent.drop(row("todo 3"));
    expect(state.actions.move).toHaveBeenCalledExactlyOnceWith("t1", 2);
  });

  it("moves a row up to the row it is dropped on", () => {
    render(<TodoScreen />);
    fireEvent.dragStart(row("todo 3"));
    fireEvent.dragOver(row("todo 1"));
    fireEvent.drop(row("todo 1"));
    expect(state.actions.move).toHaveBeenCalledExactlyOnceWith("t3", 0);
  });

  it("does nothing when a row is dropped on itself", () => {
    render(<TodoScreen />);
    fireEvent.dragStart(row("todo 2"));
    fireEvent.drop(row("todo 2"));
    expect(state.actions.move).not.toHaveBeenCalled();
  });

  it("does nothing after the drag ends without a drop", () => {
    render(<TodoScreen />);
    fireEvent.dragStart(row("todo 1"));
    fireEvent.dragEnd(row("todo 1"));
    fireEvent.drop(row("todo 3"));
    expect(state.actions.move).not.toHaveBeenCalled();
  });

  it("marks the row being dragged and the row it is over", () => {
    render(<TodoScreen />);
    fireEvent.dragStart(row("todo 1"));
    fireEvent.dragOver(row("todo 2"));
    expect(row("todo 1").className).toContain("dragging");
    expect(row("todo 2").className).toContain("over");
    fireEvent.dragEnd(row("todo 1"));
    expect(row("todo 1").className).not.toContain("dragging");
    expect(row("todo 2").className).not.toContain("over");
  });
});
