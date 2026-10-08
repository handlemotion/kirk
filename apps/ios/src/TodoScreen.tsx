import {
  useIsOnline,
  useTodoActions,
  useTodos,
  type Todo,
  type TodoId,
} from "@kirk/shared";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
        <FlatList
          data={todos}
          keyExtractor={(t) => t._id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>Nothing to do.</Text>}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Pressable
                disabled={!online}
                onPress={() => void actions.setDone(item._id, !item.done)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done, disabled: !online }}
                style={styles.check}
              >
                <Text style={styles.checkText}>{item.done ? "☑" : "☐"}</Text>
              </Pressable>
              {editingId === item._id ? (
                <TextInput
                  style={[styles.input, styles.grow]}
                  value={editText}
                  autoFocus
                  onChangeText={setEditText}
                  onBlur={finishEdit}
                  onSubmitEditing={finishEdit}
                  returnKeyType="done"
                />
              ) : (
                <Pressable
                  style={styles.grow}
                  disabled={!online}
                  onPress={() => {
                    setEditingId(item._id);
                    setEditText(item.title);
                  }}
                >
                  <Text style={[styles.rowTitle, item.done && styles.done]}>
                    {item.title}
                  </Text>
                </Pressable>
              )}
              {reordering && (
                <>
                  <Pressable
                    disabled={!online || index === 0}
                    onPress={() => void actions.move(item._id, index - 1)}
                    accessibilityLabel="Move up"
                    style={styles.iconButton}
                  >
                    <Text style={index === 0 || !online ? styles.dim : undefined}>
                      ▲
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={!online || index === todos.length - 1}
                    onPress={() => void actions.move(item._id, index + 1)}
                    accessibilityLabel="Move down"
                    style={styles.iconButton}
                  >
                    <Text
                      style={
                        index === todos.length - 1 || !online
                          ? styles.dim
                          : undefined
                      }
                    >
                      ▼
                    </Text>
                  </Pressable>
                </>
              )}
              <Pressable
                disabled={!online}
                onPress={() => void actions.remove(item._id)}
                accessibilityLabel="Delete"
                style={styles.iconButton}
              >
                <Text style={[styles.delete, !online && styles.dim]}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      )}
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
  delete: { color: "#c0392b", fontSize: 16 },
  dim: { opacity: 0.3 },
});
