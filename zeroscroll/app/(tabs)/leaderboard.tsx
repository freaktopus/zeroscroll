import { Image } from "expo-image";
import { Platform, StyleSheet, View, Text } from "react-native";
import { Fonts } from "@/constants/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function Leaderboard() {
  return (
    <View>
      <MaterialIcons
        size={310}
        color="#808080"
        name="space-dashboard"
        style={styles.headerImage}
      />
      add
    </View>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
  },
});
