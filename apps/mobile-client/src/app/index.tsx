import { cn } from "@/helpers/cn";
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className={cn("text-xl font-bold text-blue-500 bg-green-500 p-3", "text-red-500 px-10")}>
        Welcome to Nativewind!
      </Text>
    </View>
  );
}
