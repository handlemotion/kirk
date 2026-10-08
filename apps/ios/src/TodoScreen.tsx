import {
  useIsOnline,
  useTodoActions,
  useTodos,
  type Todo,
  type TodoActions,
  type TodoId,
} from "@kirk/shared";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ReorderableList, {
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";
import { useSignOut } from "./auth";

export function TodoScreen() {
  const todos = useTodos();
  const online = useIsOnline();
  const signOut = useSignOut();

  const latest = useRef<readonly Todo[]>([]);
  latest.current = todos ?? [];
  const getTodos = useCallback(() => latest.current, []);
  const actions = useTodoActions(getTodos);

  const [draft, setDraft] = useState("");
  const [reordering, setReordering] = useState(false);
  const [editingId, setEditingId] = useState<TodoId | null>(null);
  const [editText, setEditText] = useState("");

  const add = () => {
    const title = draft.trim();
    if (!online || title === "") return;
    setDraft("");
    void actions.add(title);
  };

  const finishEdit = () => {
    if (editingId === null) return;
    const title = editText.trim();
    const original = latest.current.find((t) => t._id === editingId);
    if (online && title !== "" && original && title !== original.title) {
      void actions.rename(editingId, title);
    }
    setEditingId(null);
  };

  // The drop index is where the todo sits after the move. That is what move takes.
  const onMove = (id: TodoId, toIndex: number) => {
    if (!online) return;
    void actions.move(id, toIndex);
  };

  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const todo = latest.current[from];
    if (todo) onMove(todo._id, to);
  };

  return (
    <View style={styles.container}>
      {!online && (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>
            You are offline. Editing is paused until the connection returns.
          </Text>
        </View>
      )}
      <View style={styles.header}>
        <Text style={styles.title}>Todos</Text>
        <Pressable onPress={() => setReordering(!reordering)}>
          <Text style={styles.link}>{reordering ? "Done" : "Reorder"}</Text>
        </Pressable>
        <Pressable onPress={() => void signOut()}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, !online && styles.disabled]}
          placeholder="Add a todo"
          value={draft}
          editable={online}
          onChangeText={setDraft}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Pressable
          style={[styles.addButton, !online && styles.disabled]}
          disabled={!online}
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel="Add"
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
      {todos === undefined ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <ReorderableList
          data={todos}
          keyExtractor={(t) => t._id}
          dragEnabled={online && reordering}
          onReorder={onReorder}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>Nothing to do.</Text>}
          renderItem={({ item, index }) => (
            <TodoRow
              todo={item}
              index={index}
              count={todos.length}
              online={online}
              reordering={reordering}
              editing={editingId === item._id}
              editText={editText}
              onEditText={setEditText}
              onStartEdit={() => {
                setEditingId(item._id);
                setEditText(item.title);
              }}
              onFinishEdit={finishEdit}
              actions={actions}
              onMove={onMove}
            />
          )}
        />
      )}
    </View>
  );
}

type RowProps = {
  todo: Todo;
  index: number;
  count: number;
  online: boolean;
  reordering: boolean;
  editing: boolean;
  editText: string;
  onEditText: (text: string) => void;
  onStartEdit: () => void;
  onFinishEdit: () => void;
  actions: TodoActions;
  onMove: (id: TodoId, toIndex: number) => void;
};

function TodoRow({
  todo,
  index,
  count,
  online,
  reordering,
  editing,
  editText,
  onEditText,
  onStartEdit,
  onFinishEdit,
  actions,
  onMove,
}: RowProps) {
  const drag = useReorderableDrag();

  return (
    <View style={styles.row}>
      <Pressable
        disabled={!online}
        onPress={() => void actions.setDone(todo._id, !todo.done)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: todo.done, disabled: !online }}
        style={styles.check}
      >
        <Text style={styles.checkText}>{todo.done ? "☑" : "☐"}</Text>
      </Pressable>
      {editing ? (
        <TextInput
          style={[styles.input, styles.grow]}
          value={editText}
          autoFocus
          onChangeText={onEditText}
          onBlur={onFinishEdit}
          onSubmitEditing={onFinishEdit}
          returnKeyType="done"
        />
      ) : (
        <Pressable
          style={styles.grow}
          disabled={!online || reordering}
          onPress={onStartEdit}
        >
          <Text style={[styles.rowTitle, todo.done && styles.done]}>
            {todo.title}
          </Text>
        </Pressable>
      )}
      {reordering && (
        <Pressable
          disabled={!online}
          onLongPress={drag}
          delayLongPress={150}
          accessibilityRole="adjustable"
          accessibilityLabel={`Reorder ${todo.title}`}
          accessibilityHint="Touch and hold, then drag. Or use the actions rotor."
          accessibilityState={{ disabled: !online }}
          accessibilityActions={[
            { name: "moveUp", label: "Move up" },
            { name: "moveDown", label: "Move down" },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "moveUp" && index > 0) {
              onMove(todo._id, index - 1);
            } else if (
              e.nativeEvent.actionName === "moveDown" &&
              index < count - 1
            ) {
              onMove(todo._id, index + 1);
            }
          }}
          style={styles.iconButton}
        >
          <Text style={[styles.handle, !online && styles.dim]}>☰</Text>
        </Pressable>
      )}
      <Pressable
        disabled={!online}
        onPress={() => void actions.remove(todo._id)}
        accessibilityLabel="Delete"
        style={styles.iconButton}
      >
        <Text style={[styles.delete, !online && styles.dim]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: { backgroundColor: "#b45309", padding: 10 },
  bannerText: { color: "#fff", textAlign: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { flex: 1, fontSize: 28, fontWeight: "700" },
  link: { color: "#2563eb", fontSize: 16 },
  addRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#888",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  grow: { flex: 1 },
  addButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  addButtonText: { color: "#fff", fontWeight: "600" },
  disabled: { opacity: 0.5 },
  loading: { marginTop: 32 },
  empty: { textAlign: "center", marginTop: 32, color: "#888" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  check: { padding: 4 },
  checkText: { fontSize: 24 },
  rowTitle: { fontSize: 17 },
  done: { textDecorationLine: "line-through", color: "#888" },
  iconButton: { padding: 8 },
  handle: { fontSize: 20, color: "#555" },
  delete: { color: "#c0392b", fontSize: 16 },
  dim: { opacity: 0.3 },
});
