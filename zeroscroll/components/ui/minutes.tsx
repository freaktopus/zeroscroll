import { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";

export default function MinuteScroller({
  minutes,
  setMinutes,
}: {
  minutes: number;
  setMinutes: (m: number) => void;
}) {
  // 5 → 180 minutes (step 5)
  const values = useMemo(() => {
    const arr: number[] = [];
    for (let m = 5; m <= 180; m += 5) arr.push(m);
    return arr;
  }, []);

  return (
    <View className="mt-2">
      <Text className="text-gray-400 text-sm mb-2">
        Screen Time Limit (minutes)
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-row"
        contentContainerStyle={{ paddingRight: 12 }}
      >
        {values.map((m) => {
          const active = m === minutes;
          return (
            <Pressable
              key={m}
              onPress={() => setMinutes(m)}
              className={`mr-2 px-4 py-3 rounded-xl border ${
                active
                  ? "bg-blue-500/15 border-blue-400"
                  : "bg-[#23242b] border-[#333]"
              }`}
            >
              <Text
                className={`text-base font-semibold ${active ? "text-blue-200" : "text-white"}`}
              >
                {m}
              </Text>
              <Text className="text-[11px] text-gray-400 -mt-0.5">min</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
