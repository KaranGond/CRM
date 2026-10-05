import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0a0a1a" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#0a0a1a" },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
      </Stack>
    </>
  );
}
