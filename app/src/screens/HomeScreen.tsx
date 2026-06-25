import { useQuery } from "@apollo/client/react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { graphql } from "../generated";

export const UsersQuery = graphql(`
  query Users {
    users {
      _id
      name
      email
    }
  }
`);

export function HomeScreen() {
  const { data, loading, error } = useQuery(UsersQuery);

  return (
    <View style={styles.container} testID="home-screen">
      <Text style={styles.title}>Vamp</Text>
      <Text style={styles.subtitle}>Collaborative music-making</Text>

      {loading && <ActivityIndicator accessibilityLabel="Loading users" />}

      {error && (
        <Text style={styles.error} testID="error">
          Could not load users: {error.message}
        </Text>
      )}

      {data && (
        <FlatList
          testID="user-list"
          style={styles.list}
          data={data.users}
          keyExtractor={(user) => user._id}
          ListEmptyComponent={<Text style={styles.empty}>No users yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 8,
    backgroundColor: "#0f1115",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 16,
    color: "#9aa4b2",
    marginBottom: 16,
  },
  list: {
    flex: 1,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222831",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e7ecf3",
  },
  email: {
    fontSize: 14,
    color: "#9aa4b2",
  },
  empty: {
    color: "#9aa4b2",
  },
  error: {
    color: "#ff6b6b",
  },
});
